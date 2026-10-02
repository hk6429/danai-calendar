#!/bin/bash
# 只部署上線檔案：rsync 到 stage 目錄再推 CF Pages ＋ Netlify，最後 curl 回讀比 md5。要在 main 分支、工作樹乾淨時跑。
set -eu
cd "$(dirname "$0")/.."
ST="${TMPDIR:-/tmp}/danai-calendar-stage"; /bin/rm -rf "$ST"; mkdir -p "$ST"
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'scratch' --exclude 'scripts' --exclude 'test' --exclude 'docs' \
  --exclude '.superpowers' --exclude '.netlify' --exclude '.wrangler' --exclude 'package*.json' --exclude '.gitignore' \
  --exclude 'README.md' --exclude 'LICENSE' --exclude 'js/vendor/package.json' ./ "$ST/"
wrangler pages deploy "$ST" --project-name danai-calendar --branch main --commit-dirty=true
netlify deploy --prod --dir "$ST" --site 75db2d2a-fff0-4207-ad62-b4facb338771
for f in js/app.js sw.js data/quotes.json css/app.css; do
  L=$(md5 -q "$f")
  for h in https://danai-calendar.pages.dev https://danai-calendar.netlify.app; do
    R=$(curl -sL -m 20 "$h/$f" | md5 -q); [ "$L" = "$R" ] && echo "OK $h/$f" || echo "MISMATCH $h/$f"
  done
done
