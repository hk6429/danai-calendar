# 大乃日曆 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一個純前端 PWA「大乃日曆」：國曆＋農曆＋節氣＋台灣假日＋當日專屬場景圖（沿用名句日日聽 365 張）＋每日一句，加入主畫面後像會動的鎖屏卡。

**Architecture:** 無框架 ES modules；`calendar.js` 純函式算日期資訊（vendored lunar-javascript＋內建 holidays.json）；`quote.js`／`scene.js` 依「一年第幾天」取資料與圖；`app.js` 組裝 DOM 與互動；CSS keyframes 做動畫；service worker 快取 shell＋資料＋今日 ±7 天圖。圖片直接從名句日日聽複製並用 cwebp 重壓。

**Tech Stack:** HTML/CSS/JS (ESM)、lunar-javascript 1.7.7、Node 20+ `node --test`、cwebp、wrangler、netlify CLI。

**Spec:** `docs/superpowers/specs/2026-10-02-danai-calendar-design.md`

## Global Constraints

- 母版 `~/projects/danai-calendar`；GitHub `hk6429/danai-calendar` public；repo 內不得出現任何師生姓名。
- 不推 Vercel；部署只 CF Pages（project `danai-calendar`）＋ Netlify（`--site <id>` 指定）。部署後 curl 回讀比 md5。
- 無框架、無 build step、無 CDN；lunar-javascript vendored 到 `js/vendor/lunar.js`。
- 場景圖 `img/d001.webp`…`d365.webp`，來源 `~/projects/daily-quotes-365/img/NNN.webp`，4:3、寬 900px、每張 <150KB；缺圖用 `img/fallback.webp`。不生新圖。
- 動畫只用 transform/opacity；不對大元素用 `filter`；尊重 `prefers-reduced-motion`。
- sw.js：改 data/js 必升 `VERSION`。
- 每日一句不改句子內容（版權審查已在名句日日聽完成）。

## Review Focus

1. 閏年 2028-12-31 是第 366 天：quote/scene 必須回第 365 組而非 undefined。→ Task 3 測試 `day366 maps to 365`。
2. 跨日：App 開著放到隔天 00:00，畫面應自動換天。→ Task 5 `scheduleMidnightRefresh` 測試。
3. 使用者裝置時區非台灣：農曆／假日應以裝置本地日期算，不用 UTC（`new Date()` 的 getFullYear/getMonth/getDate，不用 toISOString）。→ Task 2 測試 `dateKey uses local components`。
4. holidays.json 沒有該年資料（例 2028）：不得拋錯，假日欄空白即可。→ Task 2 測試 `unknown year returns null holiday`。
5. 某天圖缺檔（404）：`<img>` onerror 換 fallback，且 sw 不得把 404 存進 cache。→ Task 5 onerror 測試＋ Task 6 sw 只 cache `res.ok`。

---

### Task 1: 專案骨架＋每日一句資料建置

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`, `scripts/build-quotes.mjs`, `test/quotes-data.test.mjs`
- Produces: `data/quotes.json` 格式 `[{d:1..365, lines:[{t,a,s}×5]}]`

- [ ] **Step 1: 骨架**

```bash
cd ~/projects/danai-calendar
cat > package.json <<'EOF'
{ "name": "danai-calendar", "private": true, "type": "module",
  "scripts": { "test": "node --test test/", "build:quotes": "node scripts/build-quotes.mjs", "build:holidays": "node scripts/build-holidays.mjs", "build:prompts": "node scripts/build-prompts.mjs" },
  "devDependencies": { "lunar-javascript": "1.7.7" } }
EOF
printf 'node_modules/\nscratch/\n.netlify/\n.wrangler/\n.DS_Store\n' > .gitignore
mkdir -p js/vendor css data img test scripts scratch
npm install
```

- [ ] **Step 2: 寫失敗測試 `test/quotes-data.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
test('quotes.json has 365 days × 5 lines', () => {
  assert.ok(existsSync('data/quotes.json'), 'data/quotes.json missing');
  const q = JSON.parse(readFileSync('data/quotes.json', 'utf8'));
  assert.equal(q.length, 365);
  q.forEach((d, i) => {
    assert.equal(d.d, i + 1);
    assert.equal(d.lines.length, 5);
    for (const l of d.lines) { assert.ok(l.t && l.a && typeof l.s === 'string'); assert.equal(Object.keys(l).length, 3); }
  });
});
```

- [ ] **Step 3: 跑測試確認失敗** `npm test` → FAIL "data/quotes.json missing"

- [ ] **Step 4: 寫 `scripts/build-quotes.mjs`**

```js
import { readFileSync, writeFileSync } from 'node:fs';
const SRC = process.env.HOME + '/projects/daily-quotes-365/data/scenes.json';
const scenes = JSON.parse(readFileSync(SRC, 'utf8')).sort((a, b) => a.id - b.id);
if (scenes.length !== 365) throw new Error('expect 365 scenes, got ' + scenes.length);
const out = scenes.map((s, i) => ({ d: i + 1, lines: s.lines.slice(0, 5).map(l => ({ t: l.text, a: l.author, s: l.source || '' })) }));
writeFileSync('data/quotes.json', JSON.stringify(out));
console.log('quotes', out.length);
```

- [ ] **Step 5: 跑** `npm run build:quotes && npm test` → PASS

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: 骨架與每日一句資料"`

---

### Task 2: calendar.js（農曆／節氣／假日）＋ holidays 建置

**Files:**
- Create: `js/vendor/lunar.js`（複製自 node_modules）, `js/calendar.js`, `scripts/build-holidays.mjs`, `data/holidays.json`, `test/calendar.test.mjs`
- Produces: `dayInfo(date, holidays) → { y, m, d, weekday, dayOfYear, lunar:'八月廿一', lunarYear:'丙午', zodiac:'馬', term:{name, daysUntil}, holiday:{name, off}|null }`、`dateKey(date) → 'YYYY-MM-DD'`

- [ ] **Step 1: vendor lunar**

```bash
cp node_modules/lunar-javascript/lunar.js js/vendor/lunar.js
node -e "const {Solar}=require('./js/vendor/lunar.js');const l=Solar.fromYmd(2026,10,2).getLunar();console.log(l.getMonthInChinese(),l.getDayInChinese(),l.getYearInGanZhi(),l.getYearShengXiao(),l.getJieQi(),l.getNextJieQi().getName(),l.getNextJieQi().getSolar().toYmd())"
```
Expected 印出：`八 廿一 丙午 馬 "" 寒露 2026-10-08`（若 API 名稱不同，以 `node -e "console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(require('./js/vendor/lunar.js').Solar.fromYmd(2026,1,1).getLunar())).join(' '))"` 查對後改用正確名稱）。
ESM 匯入方式：`lunar.js` 是 UMD，在瀏覽器用 `<script src="js/vendor/lunar.js">` 掛 `window.Lunar/Solar`；在 Node 測試用 `createRequire`。`calendar.js` 因此接受 `Solar` 以參數注入：`dayInfo(date, holidays, Solar)`。

- [ ] **Step 2: 失敗測試 `test/calendar.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dayInfo, dateKey } from '../js/calendar.js';
const { Solar } = createRequire(import.meta.url)('../js/vendor/lunar.js');
const H = { '2026-02-16': { name: '除夕', off: true }, '2026-02-17': { name: '春節', off: true }, '2026-10-10': { name: '國慶日', off: true } };
const D = (y, m, d) => new Date(y, m - 1, d, 12);
test('dateKey uses local components', () => assert.equal(dateKey(new Date(2026, 9, 2, 23, 30)), '2026-10-02'));
test('2026-10-02 lunar 八月廿一, next term 寒露 in 6 days', () => {
  const i = dayInfo(D(2026, 10, 2), H, Solar);
  assert.equal(i.lunar, '八月廿一'); assert.equal(i.zodiac, '馬'); assert.equal(i.weekday, '五');
  assert.deepEqual(i.term, { name: '寒露', daysUntil: 6 }); assert.equal(i.holiday, null); assert.equal(i.dayOfYear, 275);
});
test('term day itself', () => assert.deepEqual(dayInfo(D(2026, 10, 8), H, Solar).term, { name: '寒露', daysUntil: 0 }));
test('除夕 / 春節', () => {
  assert.equal(dayInfo(D(2026, 2, 16), H, Solar).holiday.name, '除夕');
  assert.equal(dayInfo(D(2026, 2, 17), H, Solar).lunar, '正月初一');
});
test('leap month 2025-07-25 is 閏六月初一', () => assert.equal(dayInfo(D(2025, 7, 25), {}, Solar).lunar, '閏六月初一'));
test('unknown year returns null holiday', () => assert.equal(dayInfo(D(2028, 1, 1), H, Solar).holiday, null));
test('leap year dayOfYear 366', () => assert.equal(dayInfo(D(2028, 12, 31), {}, Solar).dayOfYear, 366));
```

- [ ] **Step 3: 跑** `npm test` → FAIL (module not found)

- [ ] **Step 4: 寫 `js/calendar.js`**

```js
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const pad = n => String(n).padStart(2, '0');
export const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function dayOfYear(d) {
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 864e5) + 1;
}
export function dayInfo(date, holidays, Solar) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  const today = lunar.getJieQi();
  let term;
  if (today) term = { name: today, daysUntil: 0 };
  else {
    const nx = lunar.getNextJieQi(); const s = nx.getSolar();
    term = { name: nx.getName(), daysUntil: Math.round((Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay()) - Date.UTC(y, m - 1, d)) / 864e5) };
  }
  const monthName = (lunar.getMonth() < 0 ? '閏' : '') + lunar.getMonthInChinese() + '月';
  return {
    y, m, d, weekday: WD[date.getDay()], dayOfYear: dayOfYear(date),
    lunar: monthName + lunar.getDayInChinese(), lunarYear: lunar.getYearInGanZhi(), zodiac: lunar.getYearShengXiao(),
    term, holiday: (holidays && holidays[dateKey(date)]) || null,
  };
}
```
注意：lunar-javascript 的 `getJieQi()` 回傳的是「節氣＋節令」表，含 `DONG_ZHI` 這類大寫鍵的可能；若測試 term 名稱不對，改用 `lunar.getJieQiTable()` 自行找最近者。

- [ ] **Step 5: 跑** `npm test` → PASS；不過就按 Step 1 的 API 查法修到過。

- [ ] **Step 6: 假日資料。** 到 https://data.gov.tw/dataset/14718 下載「115年中華民國政府行政機關辦公日曆表」與 116 年 CSV（若 116 尚未公布只放 115），存到 `scratch/holidays-115.csv`、`scratch/holidays-116.csv`。寫 `scripts/build-holidays.mjs`：

```js
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const out = {};
for (const f of readdirSync('scratch').filter(f => /^holidays-.*\.csv$/.test(f))) {
  let txt = readFileSync('scratch/' + f);
  txt = txt.toString('utf8'); if (txt.includes('�')) txt = new TextDecoder('big5').decode(readFileSync('scratch/' + f));
  txt = txt.replace(/^﻿/, '');
  const rows = txt.trim().split(/\r?\n/).slice(1).map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
  for (const [ymd, , off, note] of rows) {
    if (!/^\d{8}$/.test(ymd)) continue;
    const key = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6)}`;
    const isOff = off === '2';
    const wd = new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6)).getDay();
    const weekend = wd === 0 || wd === 6;
    if (isOff && !weekend) out[key] = { name: note || '放假', off: true };          // 平日放假
    else if (isOff && weekend && note) out[key] = { name: note, off: true };         // 週末但有名字（例 國慶日）
    else if (!isOff && weekend) out[key] = { name: note || '補班', off: false };    // 週末上班＝補班
  }
}
writeFileSync('data/holidays.json', JSON.stringify(out));
console.log('holidays', Object.keys(out).length);
```
跑 `npm run build:holidays`，再 `node -e "const h=require('./data/holidays.json');console.log(h['2026-10-10'],h['2026-02-17'])"` 應印出國慶日、春節。CSV 欄位順序若不同（實際是「西元日期,星期,是否放假,備註」），照實際調整解構。

- [ ] **Step 7: Commit** `git add -A && git commit -m "feat: calendar.js 農曆節氣假日"`

---

### Task 3: quote.js ＋ scene.js（依一年第幾天取資料）

**Files:**
- Create: `js/quote.js`, `js/scene.js`, `test/quote-scene.test.mjs`
- Consumes: `dayOfYear` from calendar.js
- Produces: `quoteIndex(dayOfYear) → 1..365`、`pickLine(day, n) → {t,a,s}`、`sceneSrc(dayOfYear) → 'img/d275.webp'`、`FALLBACK = 'img/fallback.webp'`

- [ ] **Step 1: 失敗測試**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteIndex, pickLine } from '../js/quote.js';
import { sceneSrc, FALLBACK } from '../js/scene.js';
const day = { d: 1, lines: [0, 1, 2, 3, 4].map(i => ({ t: 't' + i, a: 'a', s: 's' })) };
test('day366 maps to 365', () => { assert.equal(quoteIndex(366), 365); assert.equal(quoteIndex(1), 1); assert.equal(sceneSrc(366), 'img/d365.webp'); });
test('sceneSrc pads', () => assert.equal(sceneSrc(7), 'img/d007.webp'));
test('pickLine wraps', () => { assert.equal(pickLine(day, 0).t, 't0'); assert.equal(pickLine(day, 5).t, 't0'); assert.equal(pickLine(day, 7).t, 't2'); });
test('FALLBACK', () => assert.equal(FALLBACK, 'img/fallback.webp'));
```

- [ ] **Step 2: 跑** → FAIL

- [ ] **Step 3: 實作**

`js/quote.js`
```js
export const quoteIndex = doy => Math.min(Math.max(doy, 1), 365);
export const pickLine = (day, n) => day.lines[((n % day.lines.length) + day.lines.length) % day.lines.length];
```
`js/scene.js`
```js
export const FALLBACK = 'img/fallback.webp';
export const sceneSrc = doy => `img/d${String(Math.min(Math.max(doy, 1), 365)).padStart(3, '0')}.webp`;
```

- [ ] **Step 4: 跑** `npm test` → PASS　- [ ] **Step 5: Commit** `git commit -am "feat: quote/scene 選取"`

---

### Task 4: 版面與動畫（index.html / app.css）

**Files:**
- Create: `index.html`, `css/app.css`, `img/fallback.webp`（`cwebp -q 78 -resize 900 0 ~/projects/daily-quotes-365/img/001.webp -o img/fallback.webp`）

- [ ] **Step 1: `index.html`**

```html
<!doctype html><html lang="zh-Hant"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>大乃日曆</title>
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#f6f1e7"><link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/icon-180.png"><link rel="stylesheet" href="css/app.css">
</head><body>
<main id="card">
  <header class="date"><div class="big"><span id="mon">OCT.</span><span id="day">2</span></div><div id="wd" class="wd">星期五</div></header>
  <p class="sub"><span id="lunar"></span><span class="dot">·</span><span id="term"></span><span id="holiday" class="tag" hidden></span></p>
  <figure class="scene"><div id="particles" aria-hidden="true"></div><img id="mascot" alt="今日場景" decoding="async"></figure>
  <blockquote id="quote" class="quote"><p id="qtext"></p><footer id="qmeta"></footer></blockquote>
</main>
<script src="js/vendor/lunar.js"></script>
<script type="module" src="js/app.js"></script>
</body></html>
```

- [ ] **Step 2: `css/app.css`**（重點段落；全檔自行補齊字級與色票）

```css
:root{--bg:#f6f1e7;--ink:#3b3630;--muted:#8a8178;--accent:#d9774a}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:"Noto Serif TC","Songti TC",serif;-webkit-text-size-adjust:100%}
#card{min-height:100dvh;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top) + 20px) 24px calc(env(safe-area-inset-bottom) + 24px)}
.big{display:flex;align-items:baseline;gap:8px}#mon{font-size:22px;letter-spacing:.08em}#day{font-size:64px;font-weight:700;line-height:1}
.wd,.sub{color:var(--muted);font-size:15px}.sub{margin:6px 0 0}.dot{margin:0 6px}.tag{margin-left:8px;padding:1px 8px;border-radius:999px;background:var(--accent);color:#fff;font-size:12px}
.scene{position:relative;flex:1;min-height:40dvh;margin:12px 0;display:grid;place-items:center;overflow:hidden}
#mascot{width:min(88vw,420px);aspect-ratio:4/3;object-fit:cover;border-radius:22px;box-shadow:0 12px 30px rgba(60,40,20,.18);animation:float 4s ease-in-out infinite,sway 6s ease-in-out infinite;transform-origin:50% 100%;will-change:transform}
@keyframes float{50%{translate:0 -6px}}@keyframes sway{25%{rotate:1deg}75%{rotate:-1deg}}
.quote{margin:0;text-align:center}#qtext{font-size:18px;line-height:1.7;margin:0 0 6px}#qmeta{color:var(--muted);font-size:13px}
#particles{position:absolute;inset:0;pointer-events:none}.p{position:absolute;top:-10%;opacity:.8;animation:fall linear infinite}
@keyframes fall{to{translate:20px 120%;rotate:360deg;opacity:.2}}
.p.spring{width:10px;height:7px;border-radius:50% 0;background:#f7b7c4}.p.summer{width:6px;height:6px;border-radius:50%;background:#ffe27a}
.p.autumn{width:10px;height:6px;border-radius:60% 40%;background:#d08a4a}.p.winter{width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:0 0 4px #cfe3ff}
@media(prefers-reduced-motion:reduce){#mascot,.p{animation:none}}
```

- [ ] **Step 3: 本機看版面** `npx -y serve -l 4173 .`（或 `python3 -m http.server 4173`），用 Safari 「進入響應式設計模式」iPhone 15 Pro 看；此時 app.js 尚未寫，畫面是空殼。截圖存 `scratch/layout-check.png`。
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat: 版面與動畫"`

---

### Task 5: app.js 組裝、互動、跨日刷新

**Files:**
- Create: `js/app.js`, `js/particles.js`, `test/app-logic.test.mjs`
- Consumes: `dayInfo/dateKey`、`quoteIndex/pickLine`、`sceneSrc/FALLBACK`
- Produces: `js/app.js` 內匯出純函式 `monthAbbr(m)`、`seasonOf(m)`、`msUntilMidnight(now)`、`formatTerm(term)`；DOM 組裝在 `main()` 且 `if (typeof document !== 'undefined') main()`。

- [ ] **Step 1: 失敗測試 `test/app-logic.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthAbbr, seasonOf, msUntilMidnight, formatTerm } from '../js/app.js';
test('monthAbbr', () => { assert.equal(monthAbbr(10), 'OCT.'); assert.equal(monthAbbr(1), 'JAN.'); });
test('seasonOf', () => { assert.equal(seasonOf(3), 'spring'); assert.equal(seasonOf(7), 'summer'); assert.equal(seasonOf(10), 'autumn'); assert.equal(seasonOf(12), 'winter'); });
test('msUntilMidnight', () => assert.equal(msUntilMidnight(new Date(2026, 9, 2, 23, 59, 59, 0)), 1000));
test('formatTerm', () => { assert.equal(formatTerm({ name: '寒露', daysUntil: 0 }), '寒露'); assert.equal(formatTerm({ name: '寒露', daysUntil: 6 }), '寒露前 6 天'); });
```

- [ ] **Step 2: 跑** → FAIL

- [ ] **Step 3: `js/particles.js`**

```js
export function spawnParticles(root, season, n = 12) {
  root.replaceChildren();
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'); p.className = 'p ' + season;
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = 8 + Math.random() * 8 + 's';
    p.style.animationDelay = -Math.random() * 16 + 's';
    root.appendChild(p);
  }
}
```

- [ ] **Step 4: `js/app.js`**

```js
import { dayInfo } from './calendar.js';
import { quoteIndex, pickLine } from './quote.js';
import { sceneSrc, FALLBACK } from './scene.js';
import { spawnParticles } from './particles.js';
const MON = ['JAN.', 'FEB.', 'MAR.', 'APR.', 'MAY', 'JUN.', 'JUL.', 'AUG.', 'SEP.', 'OCT.', 'NOV.', 'DEC.'];
export const monthAbbr = m => MON[m - 1];
export const seasonOf = m => m <= 2 || m === 12 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
export const msUntilMidnight = now => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
export const formatTerm = t => t.daysUntil === 0 ? t.name : `${t.name}前 ${t.daysUntil} 天`;

async function main() {
  const $ = id => document.getElementById(id);
  const [quotes, holidays] = await Promise.all([fetch('data/quotes.json').then(r => r.json()), fetch('data/holidays.json').then(r => r.json())]);
  let offset = 0, lineN = 0;
  function render() {
    const now = new Date(); const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const i = dayInfo(date, holidays, window.Solar);
    $('mon').textContent = monthAbbr(i.m); $('day').textContent = i.d; $('wd').textContent = '星期' + i.weekday;
    $('lunar').textContent = i.lunar; $('term').textContent = formatTerm(i.term);
    $('holiday').hidden = !i.holiday; if (i.holiday) $('holiday').textContent = i.holiday.name;
    const img = $('mascot'); img.onerror = () => { img.onerror = null; img.src = FALLBACK; }; img.src = sceneSrc(i.dayOfYear);
    const day = quotes[quoteIndex(i.dayOfYear) - 1]; const l = pickLine(day, lineN);
    $('qtext').textContent = l.t; $('qmeta').textContent = l.a + (l.s ? '　' + l.s : '');
    spawnParticles($('particles'), seasonOf(i.m));
  }
  $('mascot').addEventListener('click', () => { offset = offset >= 1 ? -1 : offset + 1; render(); });
  $('quote').addEventListener('click', () => { lineN++; render(); });
  let t; $('quote').addEventListener('touchstart', () => { t = setTimeout(() => navigator.clipboard?.writeText($('qtext').textContent + ' —' + $('qmeta').textContent), 600); }, { passive: true });
  $('quote').addEventListener('touchend', () => clearTimeout(t));
  render();
  const tick = () => setTimeout(() => { offset = 0; lineN = 0; render(); tick(); }, msUntilMidnight(new Date()));
  tick();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
}
if (typeof document !== 'undefined') main();
```

- [ ] **Step 5: 跑** `npm test` → PASS；本機 serve 開 Safari 響應式模式確認日期／農曆／句子都出現、公仔用 fallback 浮動、粒子飄落。截圖 `scratch/app-check.png`。
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: app 組裝與互動"`

---

### Task 6: PWA（manifest、icons、sw.js、404、_headers）

**Files:**
- Create: `manifest.webmanifest`, `icons/icon-180.png`, `icons/icon-192.png`, `icons/icon-512.png`, `sw.js`, `404.html`, `_headers`, `netlify.toml`

- [ ] **Step 1: icons**（用公仔教學圖裁方形，背景米白）

```bash
mkdir -p icons; SRC=~/.claude/skills/picture/assets/mascots/20260519_danai_chibi_03_teaching.png
for s in 180 192 512; do magick "$SRC" -resize ${s}x${s}^ -gravity center -extent ${s}x${s} -background '#f6f1e7' -flatten icons/icon-$s.png; done
```

- [ ] **Step 2: `manifest.webmanifest`**

```json
{ "name": "大乃日曆", "short_name": "大乃日曆", "start_url": "./", "display": "standalone", "background_color": "#f6f1e7", "theme_color": "#f6f1e7", "orientation": "portrait",
  "icons": [{ "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" }, { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }] }
```

- [ ] **Step 3: `sw.js`**

```js
const VERSION = 'dc-v1', MEDIA = 'dc-media';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/calendar.js', 'js/quote.js', 'js/scene.js', 'js/particles.js', 'js/vendor/lunar.js', 'data/quotes.json', 'data/holidays.json', 'img/fallback.webp', 'manifest.webmanifest'];
const doy = d => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 864e5) + 1;
const scene = n => `img/d${String(Math.min(Math.max(n, 1), 365)).padStart(3, '0')}.webp`;
self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(VERSION); await c.addAll(SHELL); await self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERSION && k !== MEDIA) await caches.delete(k);
  await self.clients.claim();
  const m = await caches.open(MEDIA); const now = new Date();
  for (let o = -7; o <= 7; o++) { const u = scene(doy(new Date(now.getFullYear(), now.getMonth(), now.getDate() + o))); if (!(await m.match(u))) fetch(u).then(r => { if (r.ok) m.put(u, r); }).catch(() => {}); }
})()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url); if (url.origin !== location.origin) return;
  if (url.pathname.includes('/img/')) {
    e.respondWith(caches.open(MEDIA).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }
    catch { return (await c.match(e.request)) || (await c.match('./')); }
  })());
});
```

- [ ] **Step 4: `404.html`、`_headers`、`netlify.toml`**

`404.html`：`<!doctype html><meta charset="utf-8"><title>找不到</title><p>找不到這一頁。<a href="/">回大乃日曆</a>`
`_headers`：
```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
/img/*
  Cache-Control: public, max-age=31536000, immutable
/data/*
  Cache-Control: public, max-age=600
/sw.js
  Cache-Control: no-cache
```
`netlify.toml`：`[build]\n  publish = "."`

- [ ] **Step 5: 驗證** 本機 serve 後 Safari 開 → 開發者工具 Service Workers 看註冊成功；關掉 serve 重整仍顯示頁面。
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: PWA manifest/sw/headers"`

---

### Task 7: 場景圖（複製名句日日聽 365 張並重壓）

**Files:**
- Create: `scripts/build-images.sh`, `img/d001..d365.webp`, `test/images.test.mjs`

- [ ] **Step 1: 失敗測試 `test/images.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync, existsSync } from 'node:fs';
test('365 scene images, each < 150KB', () => {
  for (let i = 1; i <= 365; i++) {
    const f = `img/d${String(i).padStart(3, '0')}.webp`;
    assert.ok(existsSync(f), f + ' missing');
    assert.ok(statSync(f).size < 150 * 1024, f + ' too big');
  }
  assert.ok(existsSync('img/fallback.webp'));
});
```

- [ ] **Step 2: 跑** `npm test` → FAIL (d001 missing)

- [ ] **Step 3: `scripts/build-images.sh`**

```bash
#!/bin/bash
# 從名句日日聽複製 365 張場景圖，重壓成寬 900 的 webp；已存在且 >20KB 就跳過
set -u
SRC="$HOME/projects/daily-quotes-365/img"; cd "$(dirname "$0")/.." || exit 1
for i in $(seq -w 1 365); do
  OUT="img/d$i.webp"; [ -f "$OUT" ] && [ "$(stat -f%z "$OUT")" -gt 20000 ] && continue
  [ -f "$SRC/$i.webp" ] || { echo "MISSING source $i"; continue; }
  dwebp -quiet "$SRC/$i.webp" -o /tmp/dcal-$i.png && cwebp -quiet -q 76 -resize 900 0 /tmp/dcal-$i.png -o "$OUT" && /bin/rm -f /tmp/dcal-$i.png
  [ "$(stat -f%z "$OUT")" -ge 153600 ] && cwebp -quiet -q 66 -resize 900 0 "$SRC/$i.webp" -o "$OUT"
done
cp img/d001.webp img/fallback.webp; ls img/d*.webp | wc -l
```
（cwebp 不吃 webp 輸入，所以先 `dwebp` 轉 png；若 `dwebp` 不存在 `brew install webp`。）

- [ ] **Step 4: 跑** `chmod +x scripts/build-images.sh && scripts/build-images.sh && npm test` → 印 365、PASS；`du -sh img` 預期約 35–45MB。用 Read 抽看 `img/d001.webp`、`img/d275.webp`。
- [ ] **Step 5: Commit** `git add img scripts test && git commit -m "feat: 365 張場景圖（沿用名句日日聽）"`

---

### Task 8: README、GitHub、雙平台部署與驗證

**Files:**
- Create: `README.md`, `LICENSE`（程式 MIT；圖片與句子另註「保留所有權利／各自來源」）

- [ ] **Step 1: README**（用途、加入主畫面步驟、資料來源：lunar-javascript、人事總處行事曆、名句日日聽；開發指令；部署）
- [ ] **Step 2: 實名檢查** `git grep -n -E "老師|同學|監試|指導教師" -- . ':!README.md'` 應只命中「大乃」相關；`git show --stat HEAD~3..HEAD | grep -E "xlsx|docx|csv"` 應為空。
- [ ] **Step 3: GitHub** `gh repo create hk6429/danai-calendar --public --source . --push`
- [ ] **Step 4: CF Pages** `wrangler pages project create danai-calendar --production-branch main`（已存在則略過）→ `wrangler pages deploy . --project-name danai-calendar --branch main --commit-dirty=true`
- [ ] **Step 5: Netlify** `netlify sites:create --name danai-calendar`（記下 siteId 寫進 README 部署段）→ `netlify deploy --prod --dir . --site <siteId>`
- [ ] **Step 6: md5 驗證**

```bash
for f in index.html js/app.js data/quotes.json; do L=$(md5 -q $f); for h in https://danai-calendar.pages.dev https://danai-calendar.netlify.app; do R=$(curl -sL $h/$f | md5 -q); [ "$L" = "$R" ] && echo "OK $h/$f" || echo "MISMATCH $h/$f"; done; done
curl -s -o /dev/null -w '%{http_code}\n' https://danai-calendar.pages.dev/img/d275.webp   # 200
```
- [ ] **Step 7: 真機** iPhone Safari 開 pages.dev → 分享 → 加入主畫面 → 全螢幕開啟、飛航模式重開仍顯示。截圖給使用者。
- [ ] **Step 8: 記憶** 寫 `project_danai_calendar_deploy.md`（網址、siteId、sw VERSION 規則、圖片來源）並更新 MEMORY.md；naicheng.tw works.ts 補一筆列待辦。
