'use strict';
/* 内容模型：文件系统是唯一真相（Hexo 结构），WordPress 式的 CRUD 也写回文件 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { renderMarkdown } = require('./markdown');
const { applyFilters, initPlugins } = require('./plugins');

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const read = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
function writeAtomic(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, p);
}
function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}
function parseDate(v) {
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? new Date() : d;
}
const fmt = n => String(n).padStart(2, '0');
function safeMtime(f) { try { return fs.statSync(f).mtime; } catch (e) { return null; } }
function dateOf(d) { return { year: d.getFullYear(), month: fmt(d.getMonth() + 1), day: fmt(d.getDate()) }; }

/* ── 构建站点内容 ── */
function buildSite(config, opts = {}) {
  initPlugins(config, { safe: opts.safe });
  const site = {
    config,
    posts: [],
    pages: [],
    drafts: [],
    categories: new Map(),
    tags: new Map(),
    stats: { words: 0, posts: 0, updated: new Date() },
  };

  const postFiles = walk(path.join(config.site_dir, 'source/_posts'))
    .filter(f => /\.(md|markdown)$/.test(f));
  const draftFiles = opts.drafts ? walk(path.join(config.site_dir, 'source/_drafts'))
    .filter(f => /\.(md|markdown)$/.test(f)) : [];

  const now = new Date();
  for (const f of [...postFiles, ...draftFiles]) {
    let m;
    try { m = matter(read(f)); } catch (e) { continue; }
    const fm = m.data || {};
    const base = path.basename(f).replace(/\.(md|markdown)$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    // 无 front-matter 日期 → 用文件 mtime（而不是运行时刻），否则 date>now 会被误判为草稿
    const pdate = (fm.date || fm.published) ? parseDate(fm.date || fm.published) : (safeMtime(f) || new Date(0));
    const post = {
      source: f,
      source_rel: path.relative(config.site_dir, f),
      is_draft: f.includes('_drafts' + path.sep) || !!fm.draft,
      slug: fm.slug || base,
      title: fm.title || base.replace(/[-_]/g, ' '),
      date: pdate,
      updated: (fm.updated || fm.date || fm.published) ? parseDate(fm.updated || fm.date || fm.published) : pdate,
      lang: fm.lang || config.language || 'zh-CN',
      cover: fm.cover || '',
      layout: fm.layout || 'post',
      comments: fm.comments !== false,
      featured: !!fm.featured,
      order: Number(fm.order) || 999,
      excerpt: fm.excerpt || '',
      data: fm,
      raw: m.content,
      tags: [],
      categories: [],
    };
    const tagList = Array.isArray(fm.tags) ? fm.tags : (fm.tags ? String(fm.tags).split(/[,，]/) : []);
    post.tags = tagList.map(t => String(t).trim()).filter(Boolean);
    const catList = Array.isArray(fm.categories) ? fm.categories
      : fm.category ? (Array.isArray(fm.category) ? fm.category : [fm.category]) : [];
    post.categories = catList.map(c => String(c).trim()).filter(Boolean);
    if (!post.categories.length) post.categories = ['Uncategorized'];

    applyFilters('post_init', post, site);
    site.posts.push(post);
  }
  site.posts.sort((a, b) => b.date - a.date);

  for (const p of site.posts) {
    p.content = applyFilters('post_render', renderMarkdown(p.raw), p, site);
    if (!p.excerpt) p.excerpt = firstParagraph(p.content);
    p.words = p.raw.length;
    if (p.date <= now) site.stats.words += p.words;
    p.categories.forEach(c => pushMap(site.categories, c, p));
    p.tags.forEach(t => pushMap(site.tags, t, p));
    p.path = postPath(p, config);
    if (p.is_draft || p.date > now) { p.published = false; site.drafts.push(p); }
    else p.published = true;
  }

  // 页面：source/**/*.md，排除 _posts/_drafts
  const pageFiles = walk(path.join(config.site_dir, 'source'))
    .filter(f => /\.(md|markdown)$/.test(f)
      && !f.includes('_posts') && !f.includes('_drafts'));
  for (const f of pageFiles) {
    let m;
    try { m = matter(read(f)); } catch (e) { continue; }
    const fm = m.data || {};
    const rel = path.relative(path.join(config.site_dir, 'source'), f).replace(/\\/g, '/');
    let dir = rel.replace(/\.(md|markdown)$/, '');
    if (/(^|\/)index$/.test(dir)) dir = dir.replace(/\/?index$/, '');
    const page = {
      source: f,
      source_rel: path.relative(config.site_dir, f),
      path: dir ? dir + '/' : '',
      slug: path.basename(dir) || 'index',
      title: fm.title || '',
      date: parseDate(fm.date),
      updated: parseDate(fm.updated || fm.date),
      layout: fm.layout || 'page',
      comments: !!fm.comments,
      data: fm,
      raw: m.content,
    };
    page.content = applyFilters('post_render', renderMarkdown(page.raw), page, site);
    site.pages.push(page);
  }
  site.pages.sort((a, b) => (a.data.order || 0) - (b.data.order || 0) || a.path.localeCompare(b.path));

  site.stats.posts = site.posts.filter(p => p.published).length;
  return applyFilters('site_ready', site, config);
}

function pushMap(map, key, post) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(post);
}
function firstParagraph(html) {
  const m = /<p>([\s\S]*?)<\/p>/.exec(html || '');
  if (!m) return '';
  return m[1].replace(/<[^>]+>/g, '').slice(0, 140);
}
function postPath(p, config) {
  const d = dateOf(p.date);
  if (config.permalink === 'pretty') return p.slug + '/';
  if (config.permalink === 'ugly') return p.slug + '.html';
  return `${d.year}/${d.month}/${d.day}/${p.slug}/`;
}

/* ── 后台用 CRUD（全部原子写回磁盘） ── */
function readPost(site, sourceRel) {
  const abs = path.join(site.config.site_dir, sourceRel);
  const m = matter(read(abs));
  return { source_rel: sourceRel, data: m.data, body: m.content, exists: true };
}
function savePost(site, { source_rel, data, body }) {
  const abs = path.join(site.config.site_dir, source_rel);
  if (fs.existsSync(abs)) {
    const old = matter(read(abs));
    data = Object.assign({}, old.data, data);
  }
  const fmText = require('js-yaml').dump(data, { lineWidth: 120 }).trim();
  writeAtomic(abs, `---\n${fmText}\n---\n\n${body}\n`);
  return source_rel;
}
function deleteSource(site, sourceRel) {
  const abs = path.join(site.config.site_dir, sourceRel);
  if (!abs.startsWith(site.config.site_dir)) throw new Error('非法路径');
  fs.rmSync(abs, { force: true });
}
function newPost(config, type, title, opts = {}) {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${fmt(d.getMonth() + 1)}-${fmt(d.getDate())}`;
  const slug = slugify(title);
  const scaffold = read(path.join(__dirname, '..', 'scaffold', type + '.md'))
    .replace('{{title}}', title).replace('{{date}}', stamp);
  const rel = type === 'page'
    ? `source/${slug}/index.md`
    : (opts.drafts ? '_drafts/' : 'source/_posts/') + (opts.drafts ? '' : `${stamp}-`) + slug + '.md';
  if (!rel.startsWith('source/') && !rel.startsWith('_drafts/')) throw new Error('非法路径');
  const abs = path.join(config.site_dir, rel.replace(/^_drafts/, 'source/_drafts'));
  if (fs.existsSync(abs)) { console.log('已存在：', rel); return rel; }
  writeAtomic(abs, scaffold);
  console.log('🌙 已创建：', rel);
  return rel;
}

/* 媒体库：source/uploads/** */
function listUploads(site) {
  return walk(path.join(site.config.site_dir, 'source/uploads')).map(f => ({
    path: '/uploads/' + path.relative(path.join(site.config.site_dir, 'source/uploads'), f).replace(/\\/g, '/'),
    bytes: fs.statSync(f).size,
    mtime: fs.statSync(f).mtime,
  })).sort((a, b) => b.mtime - a.mtime);
}
function saveUpload(site, name, buf) {
  const safe = path.basename(name).replace(/[^\p{L}\p{N}._-]+/gu, '-');
  const dir = path.join(site.config.site_dir, 'source/uploads');
  fs.mkdirSync(dir, { recursive: true });
  let target = path.join(dir, safe), i = 1;
  const ext = path.extname(safe), stem = safe.slice(0, -ext.length || undefined);
  while (fs.existsSync(target)) target = path.join(dir, `${stem}-${i++}${ext}`);
  fs.writeFileSync(target, buf);
  return '/uploads/' + path.basename(target);
}

function commentsFile(site, slug) {
  const safe = slugify(slug);
  return path.join(site.config.site_dir, 'data/comments', safe + '.json');
}
function listComments(site, slug) {
  try { return JSON.parse(read(commentsFile(site, slug)) || '[]'); } catch (e) { return []; }
}
function addComment(site, slug, c) {
  const list = listComments(site, slug);
  list.push(Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(), status: site.config.comments.moderation ? 'pending' : 'approved' }, c));
  writeAtomic(commentsFile(site, slug), JSON.stringify(list, null, 2));
}
function setCommentStatus(site, slug, id, status) {
  const list = listComments(site, slug).map(c => c.id === id ? Object.assign(c, { status }) : c);
  writeAtomic(commentsFile(site, slug), JSON.stringify(list, null, 2));
}
function allPendingComments(site) {
  const dir = path.join(site.config.site_dir, 'data/comments');
  const out = [];
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch (e) { return out; }
  for (const f of files) {
    let list = [];
    try { list = JSON.parse(read(path.join(dir, f)) || '[]'); } catch (e) { continue; }
    for (const c of list) if (c.status !== 'approved') out.push(Object.assign({ slug: f.replace(/\.json$/, ''), file: f }, c));
  }
  return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

module.exports = { buildSite, buildSiteFresh: buildSite, newPost, readPost, savePost, deleteSource,
  listUploads, saveUpload, listComments, addComment, setCommentStatus, allPendingComments,
  slugify, postPath, writeAtomic, walk, read };
