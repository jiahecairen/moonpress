# 主题开发指南

一款 Moonpress 主题 = 一个目录。站点 `themes/` 覆盖引擎 `themes/` 同名主题。

```
themes/my-theme/
├── theme.yml        # 清单：name / description / author / version
├── _config.yml      # 主题设置，前台以 theme.xxx 取用
├── layout/
│   ├── layout.ejs   # 外壳：<%- body %> 注入视图；缺省则模板自带完整 HTML
│   ├── index.ejs    # 首页（含分页 page.pagination）
│   ├── post.ejs     # 文章（page.post = 文章对象，page.content = 渲染后 HTML）
│   ├── page.ejs     # 独立页面
│   ├── archive.ejs  # 归档/分类/标签共用（page.archive_name + page.posts）
│   └── 404.ejs      # 可选
└── source/          # 静态资源，拷到站点根（source/css/x.css → /css/x.css）
```

模板回退链：`page.layout > view > 别名 > index`；分类→归档→首页、页面→文章。
主题全缺时引擎落到内置 `_fallback`——永远不会白屏。

## 模板可用变量

| 变量 | 内容 |
|---|---|
| `site` | title/subtitle/author/description/url + `posts` `pages` `categories` `tags`(Map) `stats` |
| `page` | title/content/path + 视图专属：`post`(文章页) `posts`+`pagination`(列表页) `archive_name`(归档页) `comments_html`(文章/页面) |
| `theme` | 本主题 `_config.yml` 合并后的值 |
| `config` | 站点完整配置 |
| 助手 | `url_for()` `full_url_for()` `date(d,'YYYY-MM-DD')` `relative_date()` `number_format()` `markdown()` `strip_html()` `escape()` `is_home/is_post/is_page/is_archive` `year` |

文章对象 `post`：`title slug date updated excerpt content_html cover tags categories is_draft featured raw data.*`（front-matter 全部字段都在 `data` 下）+ 插件注入字段（如 `reading_minutes`）。

## 快速起步

```bash
cp -r themes/paper themes/mine   # 抄一款改
moonpress server --theme mine    # 覆盖主题实时预览（不改 _config.yml）
moonpress generate --theme mine  # 导出验证
bash tools/theme-check.sh mine   # 自动化验收（全路由+评论表单+CSS引用）
```

## 质量红线（DESIGN-RULES v0.2 摘要）

1. 间距全部 8pt 体系（--s1..--s6: 8/16/24/32/48/64px）
2. 正文对比度 ≥4.5:1，大字/图形 ≥3:1
3. 动效必须包 `@media (prefers-reduced-motion: no-preference)`
4. 图片必须有 `alt`；装饰图 `alt=""`
5. 键盘可达：`:focus-visible` 样式必须存在
6. 移动断点 ≤720px 单列化
7. 单页 CSS≤14KB、JS≤10KB（gzip 前）
8. 中文行高 ≥1.7，行长 32–45 汉字
