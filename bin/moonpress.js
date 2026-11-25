#!/usr/bin/env node
'use strict';
/* Moonpress CLI — 参照 hexo-cli 的命令面 */
const path = require('path');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--drafts') args.drafts = true;
    else if (a === '-p' || a === '--port') args.port = parseInt(argv[++i], 10);
    else if (a === '-s' || a === '--safe') args.safe = true;
    else if (a === '-d' || a === '--site') args.d = argv[++i];
    else if (a === '--theme') args.theme = argv[++i];
    else if (a.startsWith('-')) args[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : true;
    else args._.push(a);
  }
  return args;
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const args = parseArgs(rest);
  const siteDir = path.resolve(args.d || args.site || process.cwd());

  if (cmd === 'version' || cmd === '-v') {
    console.log('moonpress v' + require('../package.json').version);
    return;
  }
  if (cmd === 'init') {
    const { init } = require('../lib/init');
    return init(path.resolve(args._[0] || siteDir));
  }
  if (cmd === 'new') {
    const { newPost } = require('../lib/source');
    const { loadConfig } = require('../lib/config');
    const type = args._[0] === 'page' ? 'page' : 'post';
    const title = args._.slice(type === 'page' ? 1 : 0).join(' ') || '未命名' + (type === 'page' ? '页面' : '文章');
    return newPost(loadConfig(siteDir), type, title, { drafts: !!args.drafts });
  }
  if (cmd === 'generate' || cmd === 'g') {
    const { loadConfig } = require('../lib/config');
    const { buildSite } = require('../lib/source');
    const { generate } = require('../lib/generate');
    const t0 = Date.now();
    const config = loadConfig(siteDir, args.theme);
    if (args.theme) {
      const { listThemes } = require('../lib/config');
      const known = listThemes(siteDir).map(t => t.name);
      if (!known.includes(args.theme)) { console.error(`主题不存在：${args.theme}（可选：${known.join(', ')}）`); process.exit(1); }
    }
    const site = buildSite(config, { drafts: !!args.drafts });
    await generate(site, { safe: !!args.safe });
    console.log(`🌙 生成完成：${site.posts.length} 文章 · ${site.pages.length} 页面 → public/ (${Date.now() - t0}ms)`);
    return;
  }
  if (cmd === 'server' || cmd === 's' || !cmd) {
    const { loadConfig } = require('../lib/config');
    const { serve } = require('../lib/server');
    return serve(loadConfig(siteDir, args.theme), { port: args.port, drafts: !!args.drafts, safe: !!args.safe });
  }
  console.log('用法: moonpress <init|server|generate|new> [-d 站点目录] [-p 端口] [--drafts] [--safe]');
  console.log('  moonpress init ./my-site      创建站点');
  console.log('  moonpress new "标题"          新文章（new page "关于" 新页面）');
  console.log('  moonpress server              开发服务器（热重载 + 后台）');
  console.log('  moonpress generate            导出静态站到 public/');
}

main().catch(e => { console.error('错误：', e && e.stack || e); process.exit(1); });
