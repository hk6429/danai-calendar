# 大乃日曆 — 設計規格

日期：2026-10-02　狀態：已與使用者口頭確認方案 A

## 目的
手機用的「動態 Q 版日曆」：Safari 加入主畫面後像一張會動的鎖屏卡。顯示國曆、農曆、節氣、台灣假日／補班，配 Q 版大乃公仔場景圖與每日一句。使用者本人與追蹤他的老師／家長／學生。

## 成功條件
1. iPhone Safari「加入主畫面」後全螢幕、無白邊、安全區正確；Android Chrome 亦可。
2. 任意日期的農曆／節氣／假日正確：自動測試比對 ≥10 個已知日期（含農曆除夕、春節、清明節氣當天、補班日、閏月年）。
3. 離線重開仍顯示今天（service worker 快取 shell＋資料＋圖）。
4. 動畫在 iPhone 上流暢（純 CSS transform/opacity，不用 filter、不動大元素 blur）。
5. 雙平台（CF Pages＋Netlify）部署後 curl 回讀 md5 一致。

## 版面（直式，9:19.5 優先，其他比例靠 flex 伸縮）
由上到下：
1. 大日期：`10 / 2`（月份用英文縮寫或數字，預設 `OCT. 2` 風格）＋ 星期（中文）。
2. 次行：農曆（例「八月廿一」）・節氣（當日或「距寒露 N 天」）・假日標籤（例「國慶日」「補班」，無則不顯示）。
3. 中段：當日專屬公仔場景圖，占高度約 45%。
4. 下段：每日一句（句子＋作者《出處》），字體用襯線中文（Noto Serif TC 本地子集或系統字）。

## 動態（方案 A，場景圖每日一張）
- 場景圖 365 張，每天專屬一張，檔名 `img/d001.webp`…`d365.webp`（閏年第 366 天用 d365）。
- 每張 1024×1024 去背 PNG → WebP，目標 <150KB（365 張約 50MB，在 CF Pages 單檔 25MB／Netlify 限制內）。
- Prompt 來源：名句日日聽 `scenes.json` 每天已有 `image_prompt_en`（chibi 場景描述），腳本 `scripts/build-prompts.mjs` 把主角替換成大乃公仔、加上該日節氣／季節／假日線索，輸出 `scratch/prompts.json`，使用者可先審再生。
- 生圖：codex-image2 走 /picture 公仔 reference，序列跑、每張包逾時、落盤 >1M 才算成功（[[feedback_imagegen_codex_oauth]]），分批（每批 30 張）跑數天；`scripts/gen-images.sh` 可續跑（跳過已存在）。去背用 rembg 批次。
- 缺圖 fallback：該日圖未產出時顯示 `img/fallback.webp`（教書姿勢）。
- CSS 動畫：公仔整體 `float`（上下 6px，4s）＋`breathe`（scaleY 1→1.02，3s）＋微 `sway`（±1.5°，6s）；背景季節粒子（春櫻瓣、夏螢光點、秋落葉、冬雪花）各 ≤12 個 DOM 元素，`prefers-reduced-motion` 時全關。
- 互動：點公仔→切換「今天／昨天／明天」預覽；點句子→換同日另一句（每日 5 句輪替）；長按句子→複製。

## 資料
- 農曆／節氣／生肖：`lunar-javascript`（6tail，MIT），vendored 單檔進 `js/vendor/`，不走 CDN。
- 台灣假日：`data/holidays.json`，由行政院人事總處「政府行政機關辦公日曆表」open data CSV 轉換，腳本 `scripts/build-holidays.mjs`；內建 2026、2027。格式 `{ "2026-10-10": {"name":"國慶日","off":true}, "2026-xx-xx": {"name":"補班","off":false} }`。
- 每日一句：`scripts/build-quotes.mjs` 從 `~/projects/daily-quotes-365/data/scenes.json` 抽成 `data/quotes.json`：`[{d:1, lines:[{t,a,s}]} ×365]`，只留文字／作者／出處。以「一年第幾天」取（閏年 366 天時第 366 天用第 365 組）。版權依該站既有審查結果，不另改句。

## 技術
- 純 HTML/CSS/JS（ES modules），無框架、無 build step。
- 檔案：`index.html`、`css/app.css`、`js/app.js`（組裝）、`js/calendar.js`（純函式：給 Date 回 {solar, lunar, term, holiday}）、`js/scene.js`（挑圖規則）、`js/quote.js`、`sw.js`、`manifest.webmanifest`、`404.html`、`_headers`。
- 測試：`test/calendar.test.mjs` 用 `node --test`，涵蓋成功條件 2；`test/scene.test.mjs` 涵蓋挑圖規則。
- PWA：manifest `display: standalone`、`theme_color` 米白、圖示用公仔裁切（依 [[feedback_project_icons_match_art_style]]）。
- Service worker：版本常數 `VERSION`，改 data/js 必升版；預快取 shell＋data＋fallback 圖，場景圖走 runtime cache（今日±7 天預抓）。

## 部署
- 母版 `~/projects/danai-calendar`，GitHub `hk6429/danai-calendar` public（無任何師生姓名）。
- CF Pages project `danai-calendar` ＋ Netlify（`--site` 指定 id）。不推 Vercel。
- 部署後 curl 兩站 `index.html`、`js/app.js` 比 md5。

## 不做（YAGNI）
- 不接天氣 API、不做推播、不做帳號、不做多角色、不做肢體 SVG 動畫（第二版再評估）。
