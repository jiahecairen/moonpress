'use strict';
/* moonpress init <dir> —— 生成 Hexo 式站点骨架 */
const fs = require('fs');
const path = require('path');
const { writeYaml } = require('./config');

const DIRS = ['source/_posts', 'source/_drafts', 'source/uploads', 'source/about', 'scaffold', 'themes', 'plugins', 'data/comments'];

function init(dir) {
  if (fs.existsSync(path.join(dir, '_config.yml'))) { console.log('已是一个 Moonpress 站点：', dir); return; }
  fs.mkdirSync(dir, { recursive: true });
  for (const d of DIRS) fs.mkdirSync(path.join(dir, d), { recursive: true });

  writeYaml(path.join(dir, '_config.yml'), {
    title: '我的站点', subtitle: 'Moonpress 驱动', author: '站长',
    description: '用 Moonpress 建立的站点', url: 'http://localhost:4100',
    language: 'zh-CN', permalink: 'date', posts_per_page: 8,
    theme: 'moonlit', security: { password: 'admin' },
    comments: { enabled: true, moderation: true },
  });

  const scaffold = require('./source');
  scaffold.writeAtomic(path.join(dir, 'source/_posts/欢迎使用-moonpress.md'),
`---
title: 欢迎使用 Moonpress
date: ${new Date().toISOString().slice(0, 10)}
tags: [起步]
categories: [指南]
---

这是你的第一篇 Moonpress 文章。**文件系统就是数据库**：\`source/_posts/\` 下的 Markdown 即内容。

## 三板斧

1. \`moonpress server\` —— 开发预览 + 后台 http://localhost:4100/admin
2. \`moonpress new "文章标题"\` —— 新建文章
3. \`moonpress generate\` —— 导出静态站到 public/（可直接上 GitHub Pages）

## 下一步

- 进后台把默认密码改掉（设置 → 密码）
- 换一款主题（后台 → 主题）
- 打开 \`_config.yml\` 改标题副标题

> 数据全在自己磁盘上。系统可以换，文章是你的。
`);
  scaffold.writeAtomic(path.join(dir, 'source/about/index.md'),
`---
title: 关于
---

这里是关于页。写写你是谁、在做什么。
`);
  for (const t of ['post', 'page']) {
    fs.copyFileSync(path.join(__dirname, '..', 'scaffold', t + '.md'), path.join(dir, 'scaffold', t + '.md'));
  }
  fs.writeFileSync(path.join(dir, '.gitignore'), 'public/\nnode_modules/\n.DS_Store\n');
  fs.writeFileSync(path.join(dir, 'data/comments/.gitkeep'), '');

  console.log(`🌙 站点已创建：${dir}\n   cd ${dir} && moonpress server`);
}
module.exports = { init };
