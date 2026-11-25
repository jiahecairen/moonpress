#!/bin/bash
# clone-theme.sh 源主题 新主题名 显示名 描述 作者
# 复制族模板 → 换 CSS 文件名 → 重写清单。CSS 内容之后单独手写。
set -e
cd "$(dirname "$0")/.." || exit 1
SRC=$1; DST=$2; NAME=$3; DESC=$4; AUTHOR=${5:-Moonpress}
[ -d "themes/$SRC" ] || { echo "源主题不存在: $SRC"; exit 1; }
[ -d "themes/$DST" ] && { echo "已存在: $DST"; exit 1; }
mkdir -p "themes/$DST"
cp -R "themes/$SRC/." "themes/$DST/"
# CSS 文件合并改名为单一 <dst>.css
nf="themes/$DST/source/css/$DST.css"
tmp=$(mktemp)
for f in themes/$DST/source/css/*.css; do
  [ -e "$f" ] || continue
  [ "$f" = "$nf" ] && continue
  cat "$f" >> "$tmp"; echo "" >> "$tmp"
  rm "$f"
done
mv "$tmp" "$nf" 2>/dev/null || : > "$nf"
# 模板里的 css 引用改成新文件名并去重 link
grep -rl 'css/' "themes/$DST/layout" 2>/dev/null | while read -r t; do
  perl -0pi -e "s|css/[a-z0-9_-]+\.css|css/$DST.css|g" "$t"
  # 去重连续相同的 link 行
  awk -v pat="css/$DST.css" 'index($0,pat) && seen[$0]++ {next} {print}' "$t" > "$t.awk" && mv "$t.awk" "$t"
done
# 清单
printf 'name: %s\ndescription: %s\nauthor: %s\nversion: 1.0.0\n' "$NAME" "$DESC" "$AUTHOR" > "themes/$DST/theme.yml"
# 主题配置：原样继承源主题（族模板可能依赖完整字段），空则给最小壳
if [ -s "themes/$SRC/_config.yml" ] && [ "$(cat themes/$SRC/_config.yml)" != 'accent: ""' ]; then
  cp "themes/$SRC/_config.yml" "themes/$DST/_config.yml"
else
  printf 'accent: ""\n' > "themes/$DST/_config.yml"
fi
echo "✓ 已克隆 $SRC → $DST（接下来手写 themes/$DST/source/css/$DST.css）"
