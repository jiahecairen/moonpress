'use strict';
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function parseYaml(txt) { try { return yaml.load(txt) || {}; } catch (e) { return {}; } }
function readYaml(file) { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch (e) { return {}; } }
function dumpYaml(obj) { return yaml.dump(obj, { lineWidth: 120, noRefs: true }); }
function writeYaml(file, obj) { const tmp = file + '.tmp'; fs.writeFileSync(tmp, dumpYaml(obj)); fs.renameSync(tmp, file); }

function loadConfig(siteDir, themeOverride) {
  const config = Object.assign({
    title: 'Moonpress 站点',
    subtitle: '本地优先的网站系统',
    author: '站长',
    description: '',
    url: 'http://localhost:4100',
    language: 'zh-CN',
    timezone: '',
    root: '/',
    permalink: 'date',        // date: /2026/11/slug/ · pretty: /slug/ · ugly: slug.html
    posts_per_page: 8,
    feed_posts: 20,
    theme: 'moonlit',
    theme_config: {},
    category_map: {},
    tag_map: {},
    security: {},
    comments: { enabled: true, moderation: true, keep_days: 365 },
    plugins: [],              // 插件开关；plugins/ 目录下 *.js 默认启用
    deploy: {},
  }, readYaml(path.join(siteDir, '_config.yml')));

  config.site_dir = siteDir;
  if (themeOverride) config.theme = themeOverride;
  config._theme_override = themeOverride || '';
  config.theme_dir = resolveThemeDir(siteDir, config.theme);
  const themeConf = readYaml(path.join(config.theme_dir, '_config.yml'));
  config.theme_config = Object.assign({}, themeConf, config.theme_config || {});
  config.security = Object.assign({
    password: 'admin',        // 首次可用；后台设置后变为哈希
    secret: '',               // 留空则自动生成并持久化
  }, config.security || {});
  return config;
}

/* 主题解析顺序：站点 themes/ → 引擎 themes/（出厂主题） */
function resolveThemeDir(siteDir, name) {
  const ENGINE_DIR = path.join(__dirname, '..');
  const candidates = [
    path.join(siteDir, 'themes', name),
    path.join(ENGINE_DIR, 'themes', name),
  ];
  for (const c of candidates) if (fs.existsSync(path.join(c, 'theme.yml'))) return c;
  for (const c of candidates) if (fs.existsSync(path.join(c, 'layout'))) return c;
  return candidates[0];
}

function listThemes(siteDir) {
  const ENGINE_DIR = path.join(__dirname, '..');
  const out = new Map();
  for (const base of [path.join(ENGINE_DIR, 'themes'), path.join(siteDir, 'themes')]) {
    let dirs = [];
    try { dirs = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory()); } catch (e) { continue; }
    for (const d of dirs) {
      if (d.name === '_fallback') continue; // 引擎内部兜底，不作为可选主题
      const dir = path.join(base, d.name);
      const manifest = readYaml(path.join(dir, 'theme.yml'));
      if (!out.has(d.name)) out.set(d.name, { name: d.name, dir, manifest });
      else out.get(d.name).dir = dir; // 站点同名主题覆盖引擎主题
    }
  }
  return [...out.values()];
}

module.exports = { loadConfig, readYaml, writeYaml, dumpYaml, parseYaml, listThemes, resolveThemeDir };
