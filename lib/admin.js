'use strict';
/* 后台管理：登录（哈希+限速）、CSRF、文章/页面/媒体/评论/主题/设置 CRUD */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseBody, json } = require('./api');
const { readYaml, writeYaml, loadConfig, listThemes } = require('./config');
const { readPost, savePost, deleteSource, listUploads, saveUpload, allPendingComments,
  setCommentStatus, listComments, slugify } = require('./source');
const { renderMarkdown } = require('./markdown');

const ADMIN_DIR = path.join(__dirname, '..', 'admin');
const COOKIE = 'mp_admin';
const attempts = new Map(); // 登录限速 ip → {n, t}

/* ── 会话与凭据 ── */
function secret(ctx) {
  let s = ctx.config.security.secret;
  if (!s) {
    s = crypto.randomBytes(24).toString('hex');
    const raw = readYaml(path.join(ctx.config.site_dir, '_config.yml'));
    raw.security = Object.assign(raw.security || {}, { secret: s });
    writeYaml(path.join(ctx.config.site_dir, '_config.yml'), raw);
    ctx.config.security.secret = s;
    ctx.reload();
  }
  return s;
}
const hmac = (s, v) => crypto.createHmac('sha256', s).update(v).digest('hex');
function makeToken(sec) {
  const exp = Date.now() + 7 * 864e5;
  return exp + '.' + hmac(sec, 'sid' + exp);
}
function checkToken(sec, tok) {
  if (!tok) return false;
  const i = tok.indexOf('.');
  if (i < 0) return false;
  const exp = tok.slice(0, i);
  return Date.now() < Number(exp) && hmac(sec, 'sid' + exp) === tok.slice(i + 1);
}
const csrfFor = (sec, tok) => hmac(sec, 'csrf' + tok);
function cookies(req) {
  const out = {};
  for (const c of (req.headers.cookie || '').split(';')) {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  }
  return out;
}
function authed(req, ctx) {
  const tok = cookies(req)[COOKIE];
  return checkToken(secret(ctx), tok) ? tok : null;
}
function hashPw(pw, sec) {
  const salt = crypto.randomBytes(8).toString('hex');
  return `sha256$${salt}$` + crypto.createHash('sha256').update(salt + pw + sec).digest('hex');
}
function verifyPw(input, stored, sec) {
  if (typeof stored === 'string' && stored.startsWith('sha256$')) {
    const [, salt, hash] = stored.split('$');
    return crypto.createHash('sha256').update(salt + String(input) + sec).digest('hex') === hash;
  }
  return String(input) === String(stored); // 初始明文
}

/* ── 入口 ── */
async function handleAdminApi(req, res, url, ctx) {
  const route = decodeURIComponent(url.pathname).replace(/^\/api\/admin\/?/, '');
  const tok = authed(req, ctx);
  try {
    if (route === 'session') {
      return json(res, 200, { authed: !!tok, csrf: tok ? csrfFor(secret(ctx), tok) : undefined,
        title: ctx.config.title, theme: ctx.config.theme,
        engine: require('../package.json').version });
    }
    if (route === 'login') {
      const ip = req.socket.remoteAddress || '?';
      const a = attempts.get(ip) || { n: 0, t: Date.now() };
      if (Date.now() - a.t > 6e4) { a.n = 0; a.t = Date.now(); }
      if (a.n >= 8) return json(res, 429, { error: 'too_many_attempts', retry_after_s: Math.ceil((6e4 - (Date.now() - a.t)) / 1000) });
      const b = await parseBody(req);
      if (!verifyPw(b.password, ctx.config.security.password, secret(ctx))) {
        a.n++; attempts.set(ip, a);
        return json(res, 401, { error: 'wrong_password' });
      }
      attempts.delete(ip);
      const token = makeToken(secret(ctx));
      res.writeHead(200, { 'set-cookie': `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`,
        'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, csrf: csrfFor(secret(ctx), token) }));
    }
    if (route === 'logout') {
      res.writeHead(200, { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`, 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (!tok) return json(res, 401, { error: 'unauthorized' });
    if (req.method === 'POST' && req.headers['x-csrf-token'] !== csrfFor(secret(ctx), tok)) {
      return json(res, 403, { error: 'bad_csrf' });
    }

    const site = ctx.getSite();
    const b = req.method === 'POST' ? await parseBody(req) : {};

    if (req.method === 'GET') {
      if (route === 'stats') {
        const posts = site.posts;
        return json(res, 200, {
          posts: posts.filter(p => p.published).length,
          drafts: posts.filter(p => !p.published).length,
          pages: site.pages.length,
          uploads: listUploads(site).length,
          comments_pending: allPendingComments(site).length,
          words: site.stats.words,
          recent: posts.slice(0, 5).map(p => ({ title: p.title, path: p.path, status: p.published ? '发布' : '草稿', date: p.date })),
          theme: ctx.config.theme, theme_name: (ctx.config.theme_config.name || ctx.config.theme),
        });
      }
      if (route === 'posts') {
        const q = url.searchParams.get('status');
        let list = site.posts.slice();
        if (q === 'published') list = list.filter(p => p.published);
        if (q === 'draft') list = list.filter(p => !p.published);
        return json(res, 200, { posts: list.map(p => ({
          source_rel: p.source_rel, title: p.title, slug: p.slug, path: p.path,
          date: p.date, updated: p.updated, draft: !p.published,
          cats: p.categories, tags: p.tags, words: p.words,
          pending: listComments(site, p.slug).filter(c => c.status === 'pending').length,
        })) });
      }
      if (route === 'post') {
        const src = url.searchParams.get('src');
        const r = readPost(site, src);
        return json(res, 200, Object.assign({ comments_pending: 0 }, r));
      }
      if (route === 'pages') {
        return json(res, 200, { pages: site.pages.map(pg => ({ source_rel: pg.source_rel, title: pg.title, path: pg.path, updated: pg.updated })) });
      }
      if (route === 'media') return json(res, 200, { uploads: listUploads(site) });
      if (route === 'comments') {
        const pending = allPendingComments(site);
        const approved = [];
        for (const p of site.posts.slice(0, 10)) {
          for (const c of listComments(site, p.slug)) if (c.status === 'approved')
            approved.push({ slug: p.slug, post_title: p.title, id: c.id, author: c.author, date: c.date, text: c.text.slice(0, 160) });
        }
        return json(res, 200, { pending, approved: approved.slice(-15).reverse() });
      }
      if (route === 'themes') {
        return json(res, 200, { active: ctx.config.theme,
          themes: listThemes(ctx.config.site_dir).map(t => ({
            name: t.name, display: t.manifest.name || t.name, description: t.manifest.description || '',
            author: t.manifest.author || '', version: t.manifest.version || '', screenshot: t.manifest.screenshot || '',
          })) });
      }
      if (route === 'settings') {
        const raw = readYaml(path.join(ctx.config.site_dir, '_config.yml'));
        return json(res, 200, {
          title: ctx.config.title, subtitle: ctx.config.subtitle, author: ctx.config.author,
          description: ctx.config.description, url: ctx.config.url, language: ctx.config.language,
          permalink: ctx.config.permalink, posts_per_page: ctx.config.posts_per_page,
          comments_enabled: ctx.config.comments.enabled !== false, comments_moderation: !!ctx.config.comments.moderation,
          password_hashed: String(ctx.config.security.password || '').startsWith('sha256$'),
          raw_keys: Object.keys(raw),
        });
      }
      return json(res, 404, { error: 'unknown_admin_endpoint' });
    }

    /* ── POST 写操作 ── */
    if (route === 'post') {
      const type = b.type || 'post';
      let src = b.source_rel || null;
      const data = Object.assign({}, b.data || {});
      if (!data.date) data.date = new Date().toISOString().replace(/\.\d+Z$/, '');
      if (b.publish === false) data.draft = true; else delete data.draft;
      if (!src) {
        const title = data.title || '未命名';
        const slug = data.slug || slugify(title);
        const d = new Date();
        const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        src = type === 'page' ? `source/${slug}/index.md` : `source/_posts/${stamp}-${slug}.md`;
        data.title = title;
        delete data.slug; // slug 由文件名推导；需要覆盖时写 data.slug
      }
      if (!/^(source|_drafts)\//.test(src) || src.includes('..')) return json(res, 400, { error: 'bad_source_path' });
      savePost(site, { source_rel: src, data, body: b.body || '' });
      ctx.reload();
      return json(res, 200, { ok: true, source_rel: src });
    }
    if (route === 'post/delete') {
      if (!/^(source|_drafts)\//.test(b.source_rel || '') || b.source_rel.includes('..')) return json(res, 400, { error: 'bad_source_path' });
      deleteSource(site, b.source_rel);
      ctx.reload();
      return json(res, 200, { ok: true });
    }
    if (route === 'media') {
      const files = (b.__files || []).filter(f => f.filename);
      if (!files.length) return json(res, 400, { error: 'no_file' });
      const out = files.map(f => saveUpload(site, f.filename, f.body));
      ctx.reload();
      return json(res, 200, { ok: true, paths: out });
    }
    if (route === 'media/delete') {
      const abs = path.join(ctx.config.site_dir, 'source', (b.path || '').replace(/^\//, ''));
      if (!abs.startsWith(path.join(ctx.config.site_dir, 'source', 'uploads'))) return json(res, 400, { error: 'bad_path' });
      fs.rmSync(abs, { force: true });
      ctx.reload();
      return json(res, 200, { ok: true });
    }
    if (route === 'comment') {
      if (b.action === 'delete') setCommentStatus(site, b.slug, b.id, '__delete__');
      else setCommentStatus(site, b.slug, b.id, b.action === 'approve' ? 'approved' : 'pending');
      if (b.action === 'delete') {
        const file = path.join(ctx.config.site_dir, 'data/comments', slugify(b.slug) + '.json');
        const list = JSON.parse(fs.readFileSync(file, 'utf8')).filter(c => c.id !== b.id && c.status !== '__delete__');
        fs.writeFileSync(file, JSON.stringify(list, null, 2));
      }
      return json(res, 200, { ok: true });
    }
    if (route === 'theme') {
      const exists = listThemes(ctx.config.site_dir).some(t => t.name === b.name);
      if (!exists) return json(res, 404, { error: 'theme_not_found' });
      const raw = readYaml(path.join(ctx.config.site_dir, '_config.yml'));
      raw.theme = b.name;
      writeYaml(path.join(ctx.config.site_dir, '_config.yml'), raw);
      ctx.config.theme = b.name;
      ctx.reload();
      return json(res, 200, { ok: true, theme: b.name });
    }
    if (route === 'settings') {
      const file = path.join(ctx.config.site_dir, '_config.yml');
      const raw = readYaml(file);
      for (const k of ['title', 'subtitle', 'author', 'description', 'url', 'language', 'permalink', 'posts_per_page'])
        if (b[k] !== undefined && b[k] !== '') raw[k] = b[k];
      if (b.comments_enabled !== undefined) raw.comments = Object.assign(raw.comments || {}, { enabled: !!b.comments_enabled });
      if (b.comments_moderation !== undefined) raw.comments = Object.assign(raw.comments || {}, { moderation: !!b.comments_moderation });
      if (b.password) {
        raw.security = Object.assign(raw.security || {}, { password: hashPw(b.password, secret(ctx)) });
        if (!raw.security.secret) raw.security.secret = ctx.config.security.secret;
      }
      writeYaml(file, raw);
      ctx.reload();
      return json(res, 200, { ok: true, note: '设置已写入 _config.yml' });
    }
    if (route === 'preview') {
      return json(res, 200, { html: renderMarkdown(b.body || '') });
    }
    return json(res, 404, { error: 'unknown_admin_endpoint' });
  } catch (e) {
    console.error('[admin]', e.stack || e);
    return json(res, 500, { error: 'server_error', message: String(e.message || e) });
  }
}

/* SPA 静态服务：/admin 任意路径都回 index.html */
function handleAdmin(req, res, ctx) {
  const p = (url_path(req) || '').replace(/^\/admin\/?/, '');
  if (!p || !fs.existsSync(path.join(ADMIN_DIR, p)) || !p.includes('.')) return sendFile(res, path.join(ADMIN_DIR, 'index.html'));
  if (p.includes('..')) { res.writeHead(400); return res.end(); }
  sendFile(res, path.join(ADMIN_DIR, p));
}
function url_path(req) { try { return new URL(req.url, 'http://x').pathname; } catch (e) { return ''; } }
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };
function sendFile(res, f) {
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain', 'cache-control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
}

module.exports = { handleAdmin, handleAdminApi };
