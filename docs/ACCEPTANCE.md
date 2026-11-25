# Moonpress 交付验收报告

**日期**：2026-11-25 · **状态**：✅ 引擎 + 30 款主题全部通过自动化验收

## 一、引擎（Hexo 结构 × WordPress 功能）

| # | 能力 | 状态 |
|---|---|---|
| 1 | Hexo 磁盘结构（source/_posts、scaffold、themes、_config.yml） | ✅ |
| 2 | CLI：init / new / generate / server（--drafts --safe -d -p --theme） | ✅ |
| 3 | Markdown + front-matter（gray-matter + marked），日期 mtime 回退 | ✅ |
| 4 | 路由：文章/页面/归档/分类/标签/分页/404，CJK 原文目录 + 编码 URL 双通道 | ✅ |
| 5 | 模板层级：page.layout > view > 别名 > index + layout.ejs 包裹 + _fallback 兜底 | ✅ |
| 6 | 热重载（source/data/theme_dir/_config.yml 监听，主题覆盖跨重载存活） | ✅ |
| 7 | 后台 SPA：仪表盘/文章/编辑器（预览+自动保存+快捷键）/页面/媒体/评论/主题/设置 | ✅ |
| 8 | 登录：sha256 加盐哈希 + 限流 + HttpOnly Cookie + CSRF（全 POST） | ✅ |
| 9 | 媒体库 multipart 上传（含大小写敏感 boundary 修复） | ✅ |
| 10 | 评论：蜜罐反垃圾 + 先审后放 + JSON 落盘 data/comments/ | ✅ |
| 11 | 主题切换：后台一键 / --theme 覆盖 / 站点覆盖引擎同名 | ✅ |
| 12 | 插件钩子：filter/action（post_init…generate_end），自带 2 个示范插件 | ✅ |
| 13 | 订阅与 SEO：RSS2.0、sitemap、robots、search.json（URL 逐段编码） | ✅ |
| 14 | JSON API：/api/posts、/api/posts/:slug、/api/search、/api/config | ✅ |
| 15 | 固定链接三模式 date/pretty/ugly；草稿隔离（前台/RSS/sitemap 全隐藏） | ✅ |
| 16 | 静态导出一致性：generate 产物 = server 路由（含 robots.txt） | ✅ |
| 17 | 零框架：纯 node:http，运行时依赖仅 ejs/gray-matter/js-yaml/marked | ✅ |
| 18 | 19 项运行时冒烟（登录/CSRF/预览/热发布/上传/评论流/权限 401/403…）全绿 | ✅ |

## 二、30 款主题（tools/theme-check.sh 全绿）

每款验收：首页/feed/sitemap/search/robots/归档/分类/标签/分页/about/2 篇文章/分类页 12 路由非空 + 评论表单存在 + EJS 无泄漏 + CSS 引用有效 + 归档含链接。

- **暗色画廊**：moonlit · eclipse · midnight · nocturne · waffle · grove
- **编辑部亮色**：paper · slate · ivory · newsprint · swiss · kyoto
- **网格便当**：bento · mosaic · slab · pixel · candy
- **等宽字感**：terminal · mono-note · ledger · blueprint · hanji
- **印刷波普**：risograph · memphis · citrus · zine · dotgrid
- **极简**：iwa · whitespace · atelier

## 三、DESIGN-RULES v0.2 合规

| 铁律 | 落实 |
|---|---|
| 8pt 间距体系 | 全部令牌化 --s1..--s6（moonlit 系逐款继承） |
| WCAG AA 对比度 | 正文/强调色按 AA 选色（暗色底 ≥#9d 级文字） |
| prefers-reduced-motion | 全部动效包进 no-preference 查询或 reduce 关闭 |
| 键盘可达 | :focus-visible 每款必有 |
| 移动断点 | ≤720/640px 单列化，导航折行 |
| CSS ≤14KB | 实测最大 12KB（moonlit/main.css） |
| JS ≤10KB | 全站零主题 JS（moonlit 系除外，<2KB） |
| 中文行高/行长 | 正文 ≥1.7，阅读列 60–72ch |

## 四、演示

- 引擎：`/Users/rain/DevSoftware/moonpress`（`npm run demo` → :4100）
- 演示站 `starter/`：10 文章 + 页面 + 草稿 + 媒体 + 评论数据
- 后台 `/admin`（初始密码 `admin`，设置页可改）
- 主题克隆流水线：`tools/clone-theme.sh` + `tools/theme-check.sh`

## 五、已知边界（v1 有意取舍）

- 邮件通知 / WebDAV / 增量构建 / i18n 内容层未做（chrome 级双语已内建）
- 主题后台预览为服务端渲染，非 iframe 沙箱
- 富文本编辑器为 Markdown + 工具条（非所见即所得）

## 六、移动端适配（v1.0.1）

- 30/30 主题 ≤640px 结构层：恒定边距（≥20px + `env(safe-area-inset)`）、
  标题 clamp 降档、导航防挤压换行、评论卡片化、输入框 16px（防 iOS 聚焦缩放）
- moonlit 系：文章页正文先行、meta 沉底卡片、h2 分隔线节奏、页脚长邮箱 clamp
- reveal 动画 `.js` 门：无 JS 环境内容全部可见；`.js` 前置由内联脚本注入
- 后台 `/admin`：≤900px 侧栏 → iOS 风格底部标签栏（含安全区），
  ≤640px 列表表格卡片化、按钮 42px+、登录卡自适应
- 图片 `loading="lazy" + decoding="async"`（引擎 markdown 渲染 + 全部模板）
- 验证：Chromium 393×852 真机视口逐主题截图；`theme-check` 30/30
