# 大乃日曆

手機用的動態日曆 PWA：國曆、農曆、二十四節氣、台灣國定假日／補班，配當日主題潑墨場景圖與每日一句古今名言。Safari「加入主畫面」後全螢幕開啟，離線也能用。

- Cloudflare Pages：https://danai-calendar.pages.dev
- Netlify：https://danai-calendar.netlify.app

## 使用
1. 手機 Safari 開上面任一網址。
2. 分享 → 加入主畫面。
3. 點圖片切換今天／明天／昨天；點句子換同日另一句（每日 5 句）；長按句子複製。

## 開發
```bash
npm install
npm test               # node --test，驗農曆／節氣／假日／資料完整性
npm run build:quotes   # 從 ~/projects/daily-quotes-365 抽 365×5 句 → data/quotes.json
npm run build:holidays # scratch/holidays-*.csv（人事總處辦公日曆表）→ data/holidays.json
npm run build:images   # 從 daily-quotes-365/img 複製 365 張並重壓 → img/dNNN.webp
python3 -m http.server 4173   # 本機預覽
```
改 `data/`、`js/`、`css/` 後要升 `sw.js` 的 `VERSION`。

## 部署
在 `main` 分支、工作樹乾淨時執行 `scripts/deploy.sh`：只把上線檔案 rsync 到 stage 目錄推 CF Pages 與 Netlify，並 curl 回讀比 md5。不推 Vercel。

## 資料來源
- 農曆／節氣：[lunar-javascript](https://github.com/6tail/lunar-javascript)（MIT），vendored 於 `js/vendor/lunar.js`，輸出轉繁體。
- 假日：行政院人事行政總處「政府行政機關辦公日曆表」（data.gov.tw 資料集 14718），內建 115、116 年。
- 句子與場景圖：[名句日日聽](https://github.com/hk6429/daily-quotes-365)。

## 授權
程式碼 MIT。場景圖與句子依名句日日聽的授權說明，保留所有權利。
