#!/bin/bash
# 主题验收：对每个主题生成 starter，检查全路由渲染无错误
# 用法: bash tools/theme-check.sh [主题名...]   缺省=引擎全部主题
cd "$(dirname "$0")/.." || exit 1
THEMES=${*:-$(ls -1 themes/ | grep -v _fallback)}
PASS=0; FAIL=0
for t in $THEMES; do
  out=$(node bin/moonpress.js generate -d starter --theme "$t" 2>&1)
  rc=$?
  pub=starter/public
  problems=""
  [ $rc -ne 0 ] && problems="$problems GEN_ERR"
  # 关键页面必须存在且非空
  for f in index.html feed.xml sitemap.xml search.json robots.txt archives/index.html about/index.html \
           "2026/11/20/moonpress-是什么/index.html" "2026/11/18/写作与媒体/index.html" \
           "category/指南/index.html" "tag/教程/index.html" "page/2/index.html"; do
    [ -s "$pub/$f" ] || problems="$problems MISS:$f"
  done
  # 文章页须含正文与评论表单（评论开启时）
  art="$pub/2026/11/20/moonpress-是什么/index.html"
  [ -s "$art" ] || art=$(find "$pub/2026" -name index.html | head -1)
  grep -q "cmt-form\|cmt-form" "$art" || problems="$problems NO_COMMENT_FORM"
  grep -q "<title>" "$art" || problems="$problems NO_TITLE"
  # 首页不能含 EJS 泄漏或 undefined
  grep -qE "<%|undefined" "$pub/index.html" && problems="$problems EJS_LEAK"
  # css 必须被引用且文件存在
  cssfile=$(grep -o 'href="/css/[^"]*"' "$pub/index.html" | head -1 | sed 's/href="//;s/"//')
  [ -n "$cssfile" ] && [ -s "$pub/$cssfile" ] || problems="$problems CSS:[$cssfile]"
  # 归档页含文章链接
  grep -q 'href=".*moonpress\|href=".*写作\|href=".*主题' "$pub/archives/index.html" || problems="$problems EMPTY_ARCHIVE"
  if [ -z "$problems" ]; then echo "✓ $t"; PASS=$((PASS+1)); else echo "✗ $t →$problems"; FAIL=$((FAIL+1)); fi
done
echo "──────── 通过 $PASS / 失败 $FAIL"
[ $FAIL -eq 0 ]
