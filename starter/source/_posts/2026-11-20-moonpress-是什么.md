---
title: Moonpress 是什么
date: 2026-11-20
tags: [系统, 理念]
categories: [指南]
featured: true
order: 1
outcome: "一套系统：本地写作体验像 WordPress，产物是纯静态站"
cover: /uploads/demo-cover.svg
role: 全站
period: 持续
platform: Node.js ≥ 18
tools: Markdown + 文件系统
metrics:
  - { value: 0, label: 数据库依赖 }
  - { value: 4, label: npm 依赖 }
  - { value: 100, label: 数据所有权 % }
---

## 问题

内容管理系统要么把内容锁进数据库（WordPress），要么只有生成没有后台（Hexo）。内容作者真正想要的其实是：**数据是纯文本在我手里，写作体验像 CMS，发布产物随便放。**

## 过程

Moonpress 把两家的长处拼起来：

- **Hexo 的结构**：`source/_posts/*.md` + `scaffold/` + `themes/` + `_config.yml`，`generate` 出静态站
- **WordPress 的功能**：后台面板、文章/页面编辑器、媒体库上传、分类标签、评论审核、主题切换、插件钩子

## 结果

- `moonpress server` 起开发预览 + 后台（`/admin`）
- `moonpress generate` 导出 `public/`——GitHub Pages / 任意静态托管直接放
- 文章就是 Markdown 文件，**系统换了文章还是你的**

## 学到什么

内容系统的终局不是"云"，是**可迁移的本地文件 + 顺手的写作界面**。这就是我们把后台做进生成器的原因。
