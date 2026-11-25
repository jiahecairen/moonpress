'use strict';
/* 路由渲染：把站点内容渲染成 (path → html) —— server 与 generate 共用 */
const { renderView } = require('./theme');
const { applyFilters } = require('./plugins');
const { listComments } = require('./source');

function commentsHtml(site, slug) {
  if (!site.config.comments || site.config.comments.enabled === false) return '';
  const list = listComments(site, slug).filter(c => c.status === 'approved');
  const items = list.map(c => `<div class="cmt"><b>${escape(c.author)}</b><time>${c.date ? c.date.slice(0, 10) : ''}</time><p>${escape(c.text).replace(/\n/g, '<br>')}</p></div>`).join('');
  const n = list.length;
  return `<section class="comments" id="comments"><h3>留言 ${n ? '· ' + n : ''}</h3>${items}
<form method="post" action="/api/comments" class="cmt-form"><input type="hidden" name="slug" value="${escape(slug)}">
<input type="text" name="author" placeholder="称呼" maxlength="40" required>
<input type="email" name="email" placeholder="邮箱（不公开）" maxlength="80">
<textarea name="text" placeholder="友善的留言…（会先过审核）" maxlength="2000" required></textarea>
<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<button type="submit">提交</button></form></section>`;
}
const escape = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function postHtml(site, post) {
  const cfg = site.config;
  const pc = post.comments && cfg.comments && cfg.comments.enabled !== false;
  let html = renderView(site, 'post', Object.assign({
    title: post.title, path: post.path, slug: post.slug, post,
    comments_html: pc ? commentsHtml(site, post.slug) : '',
  }), post.content);
  return applyFilters('page_render', html, post, site);
}
function pageHtml(site, page) {
  const pc = page.comments && site.config.comments && site.config.comments.enabled !== false;
  let html = renderView(site, 'page', Object.assign({
    title: page.title ? page.title + ' · ' + site.config.title : site.config.title,
    page, comments_html: pc ? commentsHtml(site, page.slug) : '',
  }), page.content);
  return applyFilters('page_render', html, page, site);
}

function indexHtml(site, num = 1) {
  const per = site.config.posts_per_page || 8;
  const posts = site.posts.filter(p => p.published);
  const totalPages = Math.max(1, Math.ceil(posts.length / per));
  const slice = posts.slice((num - 1) * per, num * per);
  let html = renderView(site, 'index', {
    path: num > 1 ? `page/${num}/` : '',
    title: num > 1 ? `${site.config.title} · 第 ${num} 页` : site.config.title + (site.config.subtitle ? ' — ' + site.config.subtitle : ''),
    posts: slice, all_posts: posts, pagination: { current: num, total: totalPages, per },
  }, slice.map(p => `<article class="x-post"><h2><a href="${p.path}">${p.title}</a></h2><p>${p.excerpt}</p></article>`).join('\n'));
  return applyFilters('page_render', html, null, site);
}

function archiveLike(site, kind, name, posts, title) {
  const pfx = kind === 'category' ? 'category/' : kind === 'tag' ? 'tag/' : 'archives/';
  const pathName = kind === 'archive' ? '' : pfx + name + '/';
  let html = renderView(site, kind === 'category' ? 'category' : kind === 'tag' ? 'tag' : 'archive', {
    path: pathName, title: `${title} · ${site.config.title}`, archive_name: title, posts,
  }, '');
  return applyFilters('page_render', html, null, site);
}

/* 完整站点路由表：path → html */
function buildRoutes(site) {
  const routes = new Map();
  const posts = site.posts.filter(p => p.published);
  posts.forEach(p => routes.set(p.path, () => postHtml(site, p)));
  site.pages.forEach(pg => routes.set(pg.path, () => pageHtml(site, pg)));
  const per = site.config.posts_per_page || 8;
  const totalPages = Math.max(1, Math.ceil(posts.length / per));
  for (let n = 1; n <= totalPages; n++) routes.set(n === 1 ? '' : `page/${n}/`, () => indexHtml(site, n));
  routes.set('archives/', () => archiveLike(site, 'archive', '全部归档', posts, '全部归档'));
  for (const [name, ps] of site.categories) routes.set('category/' + name + '/', () => archiveLike(site, 'category', name, ps, name));
  for (const [name, ps] of site.tags) routes.set('tag/' + name + '/', () => archiveLike(site, 'tag', name, ps, '#' + name));
  return routes;
}

/* 站点内 URL 统一逐段编码（磁盘是原文 Unicode） */
const encPath = p => p.split('/').map(s => encodeURIComponent(s)).join('/');

/* RSS */
function buildFeed(site) {
  const base = (site.config.url || '').replace(/\/$/, '');
  const items = site.posts.filter(p => p.published).slice(0, site.config.feed_posts || 20).map(p =>
    `<item><title>${esc(p.title)}</title><link>${base}/${encPath(p.path)}</link><guid>${base}/${encPath(p.path)}</guid>` +
    `<pubDate>${new Date(p.date).toUTCString()}</pubDate><description><![CDATA[${p.excerpt}]]></description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(site.config.title)}</title>` +
    `<link>${base}/</link><description>${esc(site.config.description || site.config.subtitle)}</description>${items}</channel></rss>`;
}
function buildSitemap(site) {
  const base = (site.config.url || '').replace(/\/$/, '');
  const urls = [...buildRoutes(site).keys()].map(p => `<url><loc>${base}/${encPath(p)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
function buildSearchIndex(site) {
  return JSON.stringify(site.posts.filter(p => p.published).map(p => ({
    t: p.title, u: '/' + p.path, s: p.excerpt.slice(0, 140),
    tags: p.tags, cats: p.categories, date: p.date.toISOString().slice(0, 10),
  })));
}
const esc = s => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

module.exports = { buildRoutes, postHtml, pageHtml, indexHtml, archiveLike, buildFeed, buildSitemap, buildSearchIndex, commentsHtml };
