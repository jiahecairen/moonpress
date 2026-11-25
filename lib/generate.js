'use strict';
/* 静态导出：public/ 可直接扔 GitHub Pages */
const fs = require('fs');
const path = require('path');
const { buildRoutes, buildFeed, buildSitemap, buildSearchIndex, notFoundHtml } = require('./render');
const { themeStatic } = require('./theme');
const { walk, read } = require('./source');
const { doAction } = require('./plugins');

function copyTree(from, to, skip = []) {
  for (const f of walk(from)) {
    const rel = path.relative(from, f);
    if (skip.some(s => rel.startsWith(s))) continue;
    if (/\.(md|markdown)$/.test(f) && (rel.startsWith('_posts') || rel.startsWith('_drafts') || rel.includes('_posts/') || rel.includes('_drafts/'))) continue;
    const dst = path.join(to, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(f, dst);
  }
}

async function generate(site, opts = {}) {
  const out = path.join(site.config.site_dir, 'public');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  // 1. 主题静态资源（先铺底）
  const ts = themeStatic(site.config.theme_dir);
  if (ts) copyTree(ts, out);
  // 2. 站点静态资源（覆盖主题）
  copyTree(path.join(site.config.site_dir, 'source'), out, ['_posts', '_drafts']);

  // 3. 渲染路由
  const routes = buildRoutes(site);
  let count = 0;
  for (const [p, fn] of routes) {
    const html = fn();
    const file = p.endsWith('/') || p === '' ? path.join(out, p, 'index.html') : path.join(out, p);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    count++;
  }

  // 4. 附加产物
  fs.writeFileSync(path.join(out, 'feed.xml'), buildFeed(site));
  fs.writeFileSync(path.join(out, 'sitemap.xml'), buildSitemap(site));
  fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nDisallow: /admin\nSitemap: ${(site.config.url || '').replace(/\/$/, '')}/sitemap.xml\n`);
  fs.writeFileSync(path.join(out, 'search.json'), buildSearchIndex(site));
  fs.writeFileSync(path.join(out, '404.html'), notFoundHtml(site));
  fs.mkdirSync(path.join(out, 'api'), { recursive: true });
  fs.writeFileSync(path.join(out, 'api/posts.json'), JSON.stringify(site.posts.filter(p => p.published).map(p => ({
    title: p.title, path: '/' + p.path, date: p.date, tags: p.tags, categories: p.categories, excerpt: p.excerpt,
  })), null, 2));

  doAction('generate_end', site, out);
  site._generated = { count, at: new Date() };
  return { count, out };
}

module.exports = { generate };
