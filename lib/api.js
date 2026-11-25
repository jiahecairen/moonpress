'use strict';
/* 公共 API + 评论提交 + 请求解析工具（供 admin 复用） */
const { applyFilters } = require('./plugins');
const { addComment, listComments } = require('./source');
const { escapeHtml } = require('./markdown');

const MAX_BODY = 25 * 1024 * 1024; // 媒体上传上限

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let len = 0;
    req.on('data', c => {
      len += c.length;
      if (len > MAX_BODY) { reject(new Error('BODY_TOO_LARGE')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function parseUrlencoded(buf) {
  const out = {};
  for (const kv of buf.toString('utf8').split('&')) {
    if (!kv) continue;
    const i = kv.indexOf('=');
    const k = decodeURIComponent(kv.slice(0, i).replace(/\+/g, ' '));
    out[k] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
  }
  return out;
}
function parseMultipart(buf, boundary) {
  const parts = [];
  const head = Buffer.from('--' + boundary + '\r\n');
  const delim = Buffer.from('\r\n--' + boundary);
  let start = buf.indexOf(head);
  if (start === -1) return parts;
  start += head.length;
  for (let guard = 0; guard < 50; guard++) {
    const headerEnd = buf.indexOf('\r\n\r\n', start);
    if (headerEnd === -1) break;
    const headers = buf.slice(start, headerEnd).toString('utf8');
    const next = buf.indexOf(delim, headerEnd);
    if (next === -1) break;
    const nameM = /name="([^"]*)"/.exec(headers);
    const fileM = /filename="([^"]*)"/.exec(headers);
    parts.push({
      name: nameM ? nameM[1] : '',
      filename: fileM && fileM[1] ? fileM[1] : null,
      body: buf.slice(headerEnd + 4, next),
    });
    const tail = buf.slice(next + delim.length, next + delim.length + 2).toString();
    if (tail === '--') break;
    start = next + delim.length + 2;
  }
  return parts;
}
async function parseBody(req) {
  const raw = req.headers['content-type'] || '';
  const ct = raw.toLowerCase(); // boundary 必须用原始大小写，仅类型判断才小写
  const buf = await readBody(req);
  if (ct.includes('application/json')) { try { return JSON.parse(buf.toString('utf8') || '{}'); } catch (e) { return {}; } }
  if (ct.includes('multipart/form-data')) {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/.exec(raw);
    return { __files: parseMultipart(buf, (m && (m[1] || m[2]) || '').trim()) };
  }
  return parseUrlencoded(buf);
}
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

async function handleApi(req, res, url, getSite, config) {
  const site = getSite();
  const route = decodeURIComponent(url.pathname).replace(/^\/api\/?/, '');
  const method = req.method;

  try {
    if (method === 'GET') {
      if (route === 'posts') {
        let posts = site.posts.filter(p => p.published);
        const q = url.searchParams;
        if (q.get('category')) posts = posts.filter(p => p.categories.includes(q.get('category')));
        if (q.get('tag')) posts = posts.filter(p => p.tags.includes(q.get('tag')));
        if (q.get('q')) { const s = q.get('q').toLowerCase(); posts = posts.filter(p => (p.title + p.raw).toLowerCase().includes(s)); }
        const n = parseInt(q.get('limit') || '20', 10);
        return json(res, 200, { count: posts.length, posts: posts.slice(0, n).map(pub) });
      }
      if (route.startsWith('posts/')) {
        const slug = route.slice(6);
        const p = site.posts.find(x => x.slug === slug && x.published);
        if (!p) return json(res, 404, { error: 'not_found' });
        return json(res, 200, Object.assign(pub(p), {
          content_html: applyFilters('api_post', p.content, p, site),
          comments: listComments(site, p.slug).filter(c => c.status === 'approved')
            .map(c => ({ author: c.author, date: c.date, text: c.text })),
        }));
      }
      if (route === 'pages') return json(res, 200, { pages: site.pages.map(p => ({ title: p.title, path: '/' + p.path, updated: p.updated })) });
      if (route === 'config') return json(res, 200, {
        title: config.title, subtitle: config.subtitle, author: config.author,
        language: config.language, theme: config.theme, engine: require('../package.json').version,
        comments_enabled: !!(config.comments && config.comments.enabled !== false),
      });
      if (route === 'search') {
        const s = (url.searchParams.get('q') || '').toLowerCase();
        const hits = site.posts.filter(p => p.published && (p.title + p.excerpt + p.raw).toLowerCase().includes(s)).slice(0, 20);
        return json(res, 200, { hits: hits.map(p => ({ title: p.title, path: '/' + p.path, snippet: p.excerpt.slice(0, 120) })) });
      }
      if (route === 'categories') return json(res, 200, [...site.categories.keys()]);
      if (route === 'tags') return json(res, 200, [...site.tags.keys()]);
      return json(res, 404, { error: 'unknown_endpoint' });
    }

    if (method === 'POST' && route === 'comments') {
      if (!config.comments || config.comments.enabled === false) return json(res, 403, { error: 'comments_closed' });
      const b = await parseBody(req);
      if (b.website) return json(res, 200, { ok: true });                 // 蜜罐：机器人无声丢弃
      if (!b.slug || !b.text || !b.author) return json(res, 400, { error: 'missing_fields' });
      const p = site.posts.find(x => x.slug === b.slug && x.published);
      if (!p || !p.comments) return json(res, 404, { error: 'post_not_found' });
      addComment(site, b.slug, { author: String(b.author).slice(0, 40), email: String(b.email || '').slice(0, 80), text: String(b.text).slice(0, 2000) });
      applyFilters('comment_posted', b, site);
      const wantsJson = (req.headers.accept || '').includes('json');
      if (wantsJson) return json(res, 200, { ok: true, moderated: !!config.comments.moderation });
      res.writeHead(303, { location: encodeURI((req.headers.referer || ('/' + p.path)) + (config.comments.moderation ? '#c-wait' : '#comments')) });
      res.end();
      return;
    }
    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    console.error('[api]', e.stack || e);
    return json(res, 500, { error: 'server_error', message: String(e.message || e) });
  }
}

function pub(p) {
  return { title: p.title, slug: p.slug, path: '/' + p.path, date: p.date, updated: p.updated,
    tags: p.tags, categories: p.categories, excerpt: p.excerpt, cover: p.cover, featured: p.featured,
    reading_minutes: p.reading_minutes };
}

module.exports = { handleApi, parseBody, json, readBody, parseUrlencoded, parseMultipart };
