'use strict';
/* 路由渲染：把站点内容渲染成 (path → html) —— server 与 generate 共用 */
const { renderView, resolveTemplate } = require('./theme');
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

/* ── 搜索页 / 404 页：主题有 search.ejs / 404.ejs 就用主题模板，否则引擎独立页 ── */
const searchBody = site => {
  const root = site.config.root || '/';
  return `<div style="max-width:600px;margin:0 auto">
<input id="mpSearch" type="search" placeholder="输入关键词…" autocomplete="off" autofocus style="width:100%;padding:13px 15px;font-size:16px;border:1px solid currentColor;border-radius:10px;background:transparent;color:inherit">
<p id="mpSearchInfo" style="opacity:.6;font-size:13px;margin:12px 2px"></p>
<div id="mpSearchList"></div></div>
<script>(function(){var q,timer;fetch('${root.replace(/\/$/, '')}/search.json').then(function(r){return r.json()}).then(function(d){var i=document.getElementById('mpSearch'),o=document.getElementById('mpSearchList'),m=document.getElementById('mpSearchInfo');function esc(s){var e=document.createElement('i');e.textContent=s==null?'':String(s);return e.innerHTML}function run(){var w=i.value.trim().toLowerCase();if(!w){o.innerHTML='';m.textContent='共 '+d.length+' 篇文章，输入即搜';return}var hits=d.filter(function(p){return (p.t+' '+p.s+' '+(p.x||'')+' '+(p.tags||[]).join(' ')+' '+(p.cats||[]).join(' ')).toLowerCase().indexOf(w)>-1}).slice(0,20);m.textContent=hits.length?hits.length+' 篇命中':'没有匹配——换个词试试';o.innerHTML=hits.map(function(p){return '<p style="margin:16px 0"><a href="'+p.u+'"><b>'+esc(p.t)+'</b></a><br><span style="opacity:.65;font-size:13px">'+p.date+' · '+esc(p.s).slice(0,80)+'</span></p>'}).join('')}m.textContent='共 '+d.length+' 篇文章，输入即搜';i.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(run,160)})})})()</script>`;
};
function standalonePage(site, title, inner, noindex) {
  const root = site.config.root || '/';
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<title>${esc(title)} · ${esc(site.config.title)}</title>
<style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;padding:32px 20px;line-height:1.7;
font-family:ui-sans-serif,system-ui,"PingFang SC","Noto Sans SC",sans-serif;background:#fff;color:#1c1b22}
a{color:inherit}header{text-align:center;margin-bottom:28px}header a{font-weight:700;text-decoration:none;font-size:17px}
footer{text-align:center;opacity:.55;font-size:12px;margin-top:48px}
@media(prefers-color-scheme:dark){body{background:#101014;color:#eceaf2}}</style></head>
<body><header><a href="${root}">${esc(site.config.title)}</a></header>
${inner}
<footer>Powered by Moonpress 🌙</footer></body></html>`;
}
function searchHtml(site) {
  const body = searchBody(site);
  if (resolveTemplate(site.config.theme_dir, ['search'])) {
    let html = renderView(site, 'search', {
      path: 'search/', title: `搜索 · ${site.config.title}`, archive_name: '搜索',
      posts: [], all_posts: site.posts.filter(p => p.published),
      pagination: { current: 1, total: 1, per: site.config.posts_per_page || 8 },
    }, body);
    return applyFilters('page_render', html, null, site);
  }
  return standalonePage(site, '搜索', body);
}
function notFoundHtml(site) {
  const body = `<div style="text-align:center;padding:40px 0">
<div style="font-size:56px;line-height:1">🌘</div>
<h1 style="font-size:22px;margin:14px 0 4px">404 — 这页不在月亮这一侧</h1>
<p style="opacity:.65;font-size:14px">地址可能变了，或者从来就没有过。</p>
<p style="margin-top:22px"><a href="${site.config.root || '/'}" style="display:inline-block;padding:10px 24px;border:1px solid currentColor;border-radius:99px;text-decoration:none">回首页</a>
&nbsp;<a href="${(site.config.root || '/').replace(/\/$/, '')}/search/" style="opacity:.7;text-decoration:none">去搜索 →</a></p></div>`;
  if (resolveTemplate(site.config.theme_dir, ['404'])) {
    try {
      return renderView(site, '404', {
        path: '404', title: `404 · ${site.config.title}`, posts: [], all_posts: [],
        pagination: { current: 1, total: 1, per: 8 },
      }, body);
    } catch (e) { /* 主题模板坏了也不该让 404 变 500 */ }
  }
  return standalonePage(site, '404', body, true);
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
  routes.set('search/', () => searchHtml(site));
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
    x: String(p.content || '').replace(/<[^>]+>/g, ' ').slice(0, 800),
    tags: p.tags, cats: p.categories, date: p.date.toISOString().slice(0, 10),
  })));
}
const esc = s => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

module.exports = { buildRoutes, postHtml, pageHtml, indexHtml, archiveLike, searchHtml, notFoundHtml, buildFeed, buildSitemap, buildSearchIndex, commentsHtml };
