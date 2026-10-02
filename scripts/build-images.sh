#!/bin/bash
# 從名句日日聽複製 365 張場景圖，重壓成寬 900 的 webp；已存在且 >20KB 就跳過。超過 150KB 降品質重壓。
set -u
SRC="$HOME/projects/daily-quotes-365/img"; cd "$(dirname "$0")/.." || exit 1
for i in $(seq -w 1 365); do
  OUT="img/d$i.webp"; [ -f "$OUT" ] && [ "$(stat -f%z "$OUT")" -gt 20000 ] && continue
  [ -f "$SRC/$i.webp" ] || { echo "MISSING source $i"; continue; }
  dwebp -quiet "$SRC/$i.webp" -o /tmp/dcal-$i.png || continue
  for q in 76 66 56; do cwebp -quiet -q $q -resize 900 0 /tmp/dcal-$i.png -o "$OUT"; [ "$(stat -f%z "$OUT")" -lt 153600 ] && break; done
  [ "$(stat -f%z "$OUT")" -ge 153600 ] && cwebp -quiet -q 60 -m 6 -resize 720 0 /tmp/dcal-$i.png -o "$OUT"   # 高細節潑墨圖縮到 720 寬
  /bin/rm -f /tmp/dcal-$i.png
done
cp img/d001.webp img/fallback.webp; ls img/d*.webp | wc -l
