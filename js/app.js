import { dayInfo, dateKey, dayOfYear } from './calendar.js';
import { quoteIndex, pickLine } from './quote.js';
import { sceneSrc, FALLBACK } from './scene.js';
import { spawnParticles } from './particles.js';
const MON = ['JAN.', 'FEB.', 'MAR.', 'APR.', 'MAY', 'JUN.', 'JUL.', 'AUG.', 'SEP.', 'OCT.', 'NOV.', 'DEC.'];
export const monthAbbr = m => MON[m - 1];
export const seasonOf = m => m <= 2 || m === 12 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
export const msUntilMidnight = now => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
export const formatTerm = t => t.daysUntil === 0 ? t.name : `${t.name}前 ${t.daysUntil} 天`;
export const shouldResetView = (lastKey, nowKey) => lastKey !== nowKey;

const $ = id => document.getElementById(id);
const load = async (u) => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; } };

function main() {
  let quotes = null, holidays = {}, offset = 0, lineN = 0, lastSeason = '', lastKey = '';
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  function render() {
    const base = today(); const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
    const i = dayInfo(date, holidays, window.Solar);
    $('mon').textContent = monthAbbr(i.m); $('day').textContent = i.d;
    $('wd').textContent = '星期' + i.weekday + (offset ? (offset > 0 ? '（明天）' : '（昨天）') : '');
    $('lunar').textContent = i.lunar; $('term').textContent = formatTerm(i.term);
    const h = $('holiday'); h.hidden = !i.holiday;
    if (i.holiday) { h.textContent = i.holiday.name; h.classList.toggle('work', !i.holiday.off); }
    const img = $('mascot'); const src = sceneSrc(i.dayOfYear);
    if (!img.src.endsWith(src)) { img.onerror = () => { img.onerror = null; img.src = FALLBACK; }; img.src = src; img.alt = `${i.m} 月 ${i.d} 日的場景`; }
    if (quotes) { const l = pickLine(quotes[quoteIndex(i.dayOfYear) - 1], lineN); $('qtext').textContent = l.t; $('qmeta').textContent = l.a + (l.s ? '　' + l.s : ''); }
    const season = seasonOf(i.m);
    if (season !== lastSeason) { spawnParticles($('particles'), season); lastSeason = season; }
  }
  const resetIfNewDay = () => { const k = dateKey(today()); if (shouldResetView(lastKey, k)) { offset = 0; lineN = 0; lastKey = k; } render(); };
  resetIfNewDay();
  Promise.all([load('data/quotes.json'), load('data/holidays.json')]).then(([q, h]) => { quotes = q; holidays = h || {}; render(); });

  $('mascot-btn').addEventListener('click', () => { offset = offset >= 1 ? -1 : offset + 1; render(); });
  let t0 = 0, moved = false, suppress = false, toastT;
  const toast = () => { const el = $('toast'); el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 1200); };
  const copy = () => navigator.clipboard?.writeText($('qtext').textContent + ' —' + $('qmeta').textContent).then(toast).catch(() => {});
  $('quote').addEventListener('touchstart', () => { t0 = Date.now(); moved = false; }, { passive: true });
  $('quote').addEventListener('touchmove', () => { moved = true; }, { passive: true });
  $('quote').addEventListener('touchcancel', () => { t0 = 0; }, { passive: true });
  $('quote').addEventListener('touchend', () => { if (t0 && !moved && Date.now() - t0 >= 500) { suppress = true; copy(); } t0 = 0; }, { passive: true });
  $('quote').addEventListener('contextmenu', e => { e.preventDefault(); });
  $('quote').addEventListener('click', () => { if (suppress) { suppress = false; return; } lineN++; render(); });
  $('quote').addEventListener('keydown', e => { if (e.key === 'c' && (e.metaKey || e.ctrlKey)) copy(); });

  const tick = () => setTimeout(() => { resetIfNewDay(); tick(); }, msUntilMidnight(new Date()) + 500);
  tick();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resetIfNewDay(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(reg => {
    const days = []; for (let o = -7; o <= 7; o++) { const d = today(); d.setDate(d.getDate() + o); days.push(sceneSrc(dayOfYear(d))); }
    (reg.active || navigator.serviceWorker.controller)?.postMessage({ type: 'prefetch', urls: days });
  }).catch(() => {});
}
if (typeof document !== 'undefined') main();
