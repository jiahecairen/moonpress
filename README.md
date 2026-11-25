# Moonpress 🌙 月亮的印刷厂

[![在线演示](https://img.shields.io/badge/🌐_在线演示-moonpress-6ea8fe)](https://jiahecairen.github.io/moonpress/)
[![release](https://img.shields.io/github/v/release/jiahecairen/moonpress)](https://github.com/jiahecairen/moonpress/releases/tag/v1.0.0)
[![主题](https://img.shields.io/badge/主题-30款-f5a623)](docs/ACCEPTANCE.md)

**Hexo 的结构 · WordPress 的功能 · 数据在你磁盘上。**

本地优先的网站系统：内容就是 `source/` 下的 Markdown 文件，写作体验是完整后台（编辑器/媒体库/评论审核），产物是纯静态站——`generate` 之后扔给任何静态托管。

```bash
git clone https://github.com/jiahecairen/moonpress.git
cd moonpress && npm install && npm link   # 全局获得 moonpress 命令
moonpress init my-site          # 建站（Hexo 式目录骨架）
cd my-site
moonpress server -p 4100        # 开发服务器 + 后台 http://localhost:4100/admin
moonpress new "文章标题"        # 用 scaffold/post.md 建文章
moonpress generate              # 导出静态站 public/
```

## 目录结构（Hexo 同款）

```
my-site/
├── _config.yml          站点配置（标题/permalink/主题/密码/评论…）
├── scaffold/            new 命令的模板（{{title}} {{date}}）
├── source/
│   ├── _posts/          文章：YYYY-MM-DD-slug.md + front-matter
│   ├── _drafts/         草稿（默认不上前台/不进RSS）
│   ├── uploads/         媒体库（后台拖拽上传落这里）
│   └── about/index.md   页面（目录/index.md → /about/）
├── themes/              站点主题（同名覆盖引擎出厂主题）
├── plugins/             插件 *.js（WordPress 式钩子）
└── data/comments/       评论数据（JSON，按文章 slug 分文件）
```

## WordPress 级功能

| 功能 | 入口 |
|---|---|
| 后台仪表盘/写作/媒体/评论/主题/设置 | `/admin`（初始密码 `admin`，**装好先改**） |
| 编辑器 | Markdown + 实时预览 + 分类标签封面精选 + Ctrl/Cmd+S |
| 评论 | 前台表单（蜜罐反垃圾）→ 后台先审后放 |
| 主题切换 | 后台主题页一键启用，或 `_config.yml` `theme:` |
| 插件 | `plugins/*.js` 导出 `(api, config)`，用 filter/action |
| 订阅 | `feed.xml`(RSS2.0) + `sitemap.xml` + `search.json` |
| API | `GET /api/posts` `/api/posts/:slug` `/api/config` `/api/search?q=` |
| 固定链接 | `date`(默认) / `pretty` / `ugly` 三模式 |

## 安全

- 后台密码：存 `sha256$盐$哈希`；登录限流（8次/分钟）
- 所有 POST 走 CSRF token（登录时下发，同源 SPA 自动携带）
- 会话 Cookie `HttpOnly + SameSite=Lax`，7 天过期
- 评论蜜罐 + 先审后放双闸

## 插件钩子

`post_init` `post_render` `page_render` `template_locals` `site_ready` `comment_posted` `server_start` `generate_end`

```js
// plugins/word-count.js
module.exports = (api) => {
  api.filter('post_init', p => { p.words_cn = p.raw.length; return p; });
};
```

引擎自带示范插件：`reading-time`（阅读时间）、`external-links`（外链加 noopener）。

## 主题

五分钟一款，见 [docs/themes.md](docs/themes.md)。**出厂 30 款**，全部通过自动化验收（全路由/评论表单/CSS 引用/EJS 泄漏检查）：

| 家族 | 主题 |
|---|---|
| 暗色画廊 | moonlit 深夜画廊 · eclipse 纯黑金蚀 · midnight 蓝黑玻璃 · nocturne 夜曲紫罗兰 · waffle 华夫暖橙 · grove 林间墨绿 |
| 编辑部亮色 | paper 纸面副刊 · slate 冷静板岩 · ivory 象牙文艺 · newsprint 米黄新闻纸 · swiss 瑞士网格 · kyoto 京都墨色 |
| 网格便当 | bento 暗色便当 · mosaic 亮色马赛克 · slab 石板三栏 · pixel 像素方块 · candy 糖果气泡 |
| 等宽字感 | terminal 绿磷终端 · mono-note 素色便签 · ledger 账簿 · blueprint 工程蓝图 · hanji 宣纸水墨 |
| 印刷波普 | risograph 双色孔版 · memphis 孟菲斯 · citrus 柑橘鲜彩 · zine 朋克拼贴 · dotgrid 点阵笔记 |
| 极简 | iwa 岩 · whitespace 留白禅 · atelier 画室 |

切换：后台「主题」页一键启用，或 `moonpress generate/server --theme <名字>` 实时预览。

## 设计纪律

主题遵循 [DESIGN-RULES](../Themes/DESIGN-RULES.md)：8pt 间距、WCAG AA 对比度、`prefers-reduced-motion`、单页 CSS≤14KB。

## 零框架血统

引擎纯 `node:http`，运行时依赖只有 ejs / gray-matter / js-yaml / marked。没有数据库，没有构建步骤，文件系统就是唯一真相源。
