'use strict';
/* 插件钩子系统 —— WordPress 的 add_filter / add_action 移植 */
const fs = require('fs');
const path = require('path');

const REG = { filters: {}, actions: {} };
let loaded = false;

function addFilter(name, fn, priority = 10) {
  (REG.filters[name] = REG.filters[name] || []).push({ fn, priority });
  REG.filters[name].sort((a, b) => a.priority - b.priority);
}
function addAction(name, fn, priority = 10) { addFilter(name, fn, priority); } // 内部同构

function applyFilters(name, value, ...args) {
  for (const h of (REG.filters[name] || [])) {
    try { const out = h.fn(value, ...args); if (out !== undefined) value = out; }
    catch (e) { console.warn(`[plugin:${name}]`, e.message); }
  }
  return value;
}
function doAction(name, ...args) { applyFilters(name, undefined, ...args); }

function initPlugins(config, opts = {}) {
  if (loaded) return;
  loaded = true;
  const api = {
    version: require('../package.json').version,
    filter: addFilter, action: addAction,
    doAction, applyFilters,
    on: addAction, addFilter, addAction, // WordPress 别名
  };
  if (opts.safe) { console.log('[moonpress] --safe：跳过插件'); return; }
  const dirs = [path.join(__dirname, '..', 'plugins'), path.join(config.site_dir, 'plugins')];
  for (const dir of dirs) {
    let files = [];
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.js')); } catch (e) { continue; }
    for (const f of files) {
      try {
        const mod = require(path.join(dir, f));
        if (typeof mod === 'function') mod(api, config);
        loaded_plugins.push(f);
      } catch (e) { console.warn(`[plugin ${f}] 加载失败：`, e.message); }
    }
  }
  if (loaded_plugins.length) console.log('[moonpress] 插件：', loaded_plugins.join(', '));
}
const loaded_plugins = [];

module.exports = { addFilter, addAction, applyFilters, doAction, initPlugins, loaded_plugins };
