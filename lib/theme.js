'use strict';
/* 主题引擎：EJS + WordPress 式模板层级 + 编译缓存（按 mtime 失效） */
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { renderMarkdown } = require('./markdown');

const CACHE = new Map(); // file -> { mtime, fn }

function compile(file) {
  const mtime = fs.statSync(file).mtimeMs;
  const hit = CACHE.get(file);
  if (hit && hit.mtime === mtime) return hit.fn;
  const fn = ejs.compile(fs.readFileSync(file, 'utf8'), { filename: file, escape: c => escapeHtml(c) });
  CACHE.set(file, { mtime, fn });
  return fn;
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* 模板层级解析：page.layout > view > 别名链 > 引擎兜底 */
function resolveTemplate(themeDir, candidates) {
  for (const c of candidates) {
    if (!c) continue;
    const f = path.join(themeDir, 'layout', c + '.ejs');
    if (fs.existsSync(f)) return f;
    const f2 = path.join(themeDir, c + '.ejs');
    if (fs.existsSync(f2)) return f2;
  }
  return null;
}

const ALIAS = {
  index: ['index'], post: ['post'], page: ['page', 'post'],
  archive: ['archive', 'index'], category: ['category', 'archive'], tag: ['tag', 'archive'], 404: ['404', 'index'],
};

function renderView(site, view, pageOverride, bodyHtml) {
  const config = site.config;
  const themeDir = config.theme_dir;
  const candidates = [];
  if (pageOverride && pageOverride.layout) candidates.push(pageOverride.layout);
  candidates.push(view);
  for (const a of ALIAS[view] || []) candidates.push(a);
  candidates.push('index');

  const tpl = resolveTemplate(themeDir, candidates) || resolveTemplate(__dirname + '/../themes/_fallback', ['index']);
  if (!tpl) throw new Error(`主题 ${config.theme} 缺少模板：${candidates.join(', ')}`);

  const locals = buildLocals(site, view, pageOverride, bodyHtml);
  const ctx = applyThemeFilter('template_locals', locals, view, site);
  let out = compile(tpl)(ctx);
  // 主题若有 layout.ejs → 像 Hexo 一样用它包裹视图（body 注入）
  const layoutFile = resolveTemplate(themeDir, ['layout']);
  if (layoutFile && layoutFile !== tpl) {
    out = compile(layoutFile)(Object.assign({}, ctx, { body: out, view_name: view }));
  }
  return out;
}

function applyThemeFilter(name, value, ...args) {
  return require('./plugins').applyFilters(name, value, ...args);
}

function buildLocals(site, view, pageOverride, bodyHtml) {
  const config = site.config;
  const root = config.root || '/';
  const posts = site.posts.filter(p => p.published);

  const page = Object.assign({
    view,
    title: config.title,
    description: config.description || config.subtitle,
    path: '',
    content: bodyHtml || '',
  }, pageOverride || {});

  const helpers = {
    url_for(p) {
      if (!p) return root;
      if (/^(https?:|mailto:|\/\/|#)/.test(p)) return p;
      p = String(p).replace(/^\//, '');
      // 输出编码、磁盘存原文：服务端解码查表，Pages/任意静态托管都兼容
      const enc = p.split('/').map(s => encodeURIComponent(s)).join('/');
      return root.replace(/\/$/, '') + '/' + enc;
    },
    full_url_for(p) {
      const u = helpers.url_for(p);
      return /^https?:/.test(u) ? u : (config.url || '').replace(/\/$/, '') + u;
    },
    date(d, fmt2 = 'YYYY-MM-DD') {
      const x = d instanceof Date ? d : new Date(d);
      if (isNaN(x)) return '';
      const p = n => String(n).padStart(2, '0');
      return fmt2.replace('YYYY', x.getFullYear()).replace('MM', p(x.getMonth() + 1))
        .replace('DD', p(x.getDate())).replace('HH', p(x.getHours())).replace('mm', p(x.getMinutes()));
    },
    number_format: n => Number(n || 0).toLocaleString('en-US'),
    markdown: md => renderMarkdown(md),
    escape: escapeHtml,
    strip_html: h => String(h || '').replace(/<[^>]+>/g, ''),
    relative_date(d) {
      const diff = (Date.now() - new Date(d).getTime()) / 864e5;
      if (diff < 1) return '今天';
      if (diff < 2) return '昨天';
      if (diff < 30) return Math.floor(diff) + ' 天前';
      if (diff < 365) return Math.floor(diff / 30) + ' 个月前';
      return Math.floor(diff / 365) + ' 年前';
    },
  };

  const locals = Object.assign({}, helpers, {
    site: {
      title: config.title, subtitle: config.subtitle, author: config.author,
      description: config.description, url: config.url, language: config.language,
      posts, pages: site.pages, categories: site.categories, tags: site.tags,
      stats: site.stats,
    },
    config,
    theme: config.theme_config,
    page,
    is_home: view === 'index',
    is_post: !!(pageOverride && pageOverride.slug) && view === 'post',
    is_page: view === 'page',
    is_archive: ['archive', 'category', 'tag'].includes(view),
    year: new Date().getFullYear(),
  });
  return locals;
}

function themeStatic(themeDir) {
  const dir = path.join(themeDir, 'source');
  return fs.existsSync(dir) ? dir : null;
}

module.exports = { renderView, themeStatic, resolveTemplate, escapeHtml };
