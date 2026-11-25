#!/usr/bin/env bash
# 一键发布 GitHub Pages：以 Pages 子路径重新生成静态站并推送到 gh-pages
# 用法：bash tools/deploy-pages.sh [仓库地址]
#   环境变量：PAGES_URL（默认 https://<owner>/<repo>）、PAGES_BRANCH（默认 gh-pages）
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="${1:-$(git remote get-url origin)}"
PAGES_BRANCH="${PAGES_BRANCH:-gh-pages}"
PAGES_URL="${PAGES_URL:-$(echo "$REPO" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##; s#^#https://#')}"
SUBPATH="/$(basename "$REPO" .git)"

TMP=$(mktemp -d /tmp/mpdeploy.XXXXXX)
trap 'rm -rf "$TMP"' EXIT

echo "① 复制站点并以 $PAGES_URL 重新生成…"
cp -R starter "$TMP/site"
rm -rf "$TMP/site/public"
sed -i.bak "s|^url:.*|url: $PAGES_URL|" "$TMP/site/_config.yml" && rm -f "$TMP/site/_config.yml.bak"
printf 'root: %s/\n' "$SUBPATH" >> "$TMP/site/_config.yml"
node bin/moonpress.js generate -d "$TMP/site"

echo "② 同步到 ${PAGES_BRANCH} …"
git clone -q -b "$PAGES_BRANCH" --single-branch "$REPO" "$TMP/gh"
rsync -a --delete --exclude=.git "$TMP/site/public/" "$TMP/gh/"
cd "$TMP/gh"
git add -A
if git diff --cached --quiet; then echo "（无变化，跳过提交）"; else
  git commit -q -m "Pages 部署 $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git push -q origin "$PAGES_BRANCH"
fi
case "$PAGES_URL" in *"$SUBPATH"*) echo "✓ 已发布 → $PAGES_URL/";; *) echo "✓ 已发布 → $PAGES_URL$SUBPATH/";; esac
