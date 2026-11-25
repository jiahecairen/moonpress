'use strict';
/* 开发/预览服务器：纯 node:http（Moonlit 血统），热重载 + 后台 + API */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./config');
const { buildSite } = require('./source');
const { buildRoutes, buildFeed, buildSitemap, buildSearchIndex } = require('./render');
const { themeStatic } = require('./theme');
const { handleApi } = require('./api');
const { handleAdmin, handleAdminApi } = require('./admin');
const { doAction } = require('./plugins');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.rss': 'application/rss+xml' };
// 无点别名：send() 用 MIME.html 之类取值（曾经全 undefined 导致 HTML 发成 text/plain）
for (const k of ['html', 'xml', 'json', 'txt', 'js', 'css', 'svg', 'rss']) MIME[k] = MIME['.' + k];

let site = null, routes = null, reloadTimer = null;

function rebuild(config, opts) {
  site = buildSite(config, opts);
  routes = buildRoutes(site);
  return site;
}

function serveStatic(req, res, abs) {
  const stat = fs.existsSync(abs) && fs.statSync(abs);
  if (!stat || !stat.isFile()) return false;
  res.writeHead(200, { 'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-cache' });
  fs.createReadStream(abs).pipe(res);
  return true;
}

function serve(config, opts = {}) {
  const port = opts.port || 4100;
  rebuild(config, opts);

  // 热重载：source/ themes/ data/ _config.yml
  const watchDirs = [path.join(config.site_dir, 'source'), path.join(config.site_dir, 'data'), config.theme_dir];
  for (const d of watchDirs) {
    try {
      fs.watch(d, { recursive: true }, () => {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          try { rebuild(loadConfig(config.site_dir, config._theme_override), opts); console.log('🔄 内容已热重载'); }
          catch (e) { console.warn('重载失败：', e.message); }
        }, 250);
      });
    } catch (e) { /* 目录不存在则跳过 */ }
  }
  try { fs.watch(config.site_dir, (ev, f) => { if (f === '_config.yml') rebuild(loadConfig(config.site_dir, config._theme_override), opts); }); } catch (e) {}

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    try {
      if (p === 'admin' || p.startsWith('admin/')) return handleAdmin(req, res, {
        getSite: () => site, config, opts,
        reload: () => { rebuild(loadConfig(config.site_dir, config._theme_override), opts); },
      });
      if (p.startsWith('api/admin/')) return handleAdminApi(req, res, url, {
        getSite: () => site, config, opts,
        reload: () => { rebuild(loadConfig(config.site_dir, config._theme_override), opts); },
      });
      if (p.startsWith('api/')) return await handleApi(req, res, url, () => site, config);

      // 静态：站点 source → 主题 source
      const srcAbs = path.join(config.site_dir, 'source', p);
      if (!p.startsWith('_') && srcAbs.startsWith(path.join(config.site_dir, 'source')) && serveStatic(req, res, srcAbs)) return;
      const ts = themeStatic(config.theme_dir);
      if (ts && serveStatic(req, res, path.join(ts, p))) return;

      // 系统路由
      if (p === 'feed.xml' || p === 'atom.xml') return send(res, 200, buildFeed(site), MIME.xml);
      if (p === 'sitemap.xml') return send(res, 200, buildSitemap(site), MIME.xml);
      if (p === 'search.json') return send(res, 200, buildSearchIndex(site), MIME.json);
      if (p === 'robots.txt') return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${(config.url || '')}/sitemap.xml\n`, MIME.txt);

      // 页面路由（补尾斜杠）
      if (routes.has(p)) return send(res, 200, routes.get(p)(), MIME.html);
      if (!p.endsWith('/') && routes.has(p + '/')) { res.writeHead(301, { location: '/' + p + '/' }); return res.end(); }

      // 404
      try {
        const html = require('./render').indexHtml(site, 1); // 兜底
        send(res, 404, `<pre style="padding:40px;font-size:18px">404 — 页面不存在：/${p}\n（主题可自定义 layout/404.ejs）</pre>`, MIME.html);
      } catch (e) { send(res, 404, '404 Not Found', MIME.txt); }
    } catch (e) {
      console.error('[server]', e.stack || e);
      send(res, 500, `<h2>500</h2><pre>${String(e.stack || e).replace(/</g, '&lt;')}</pre>`, MIME.html);
    }
  });

  server.listen(port, () => {
    console.log(`🌙 Moonpress 已启动`);
    console.log(`   站点：http://localhost:${port}/`);
    console.log(`   后台：http://localhost:${port}/admin  （初始密码见 _config.yml security.password，默认 admin）`);
    doAction('server_start', site, port);
  });
  return server;
}

function send(res, code, body, type) {
  res.writeHead(code, { 'content-type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

module.exports = { serve };
