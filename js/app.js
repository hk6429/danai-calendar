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
  let offset = 0, lineN = 0, lastSeason = '';
  function render() {
    const now = new Date(); const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const i = dayInfo(date, holidays, window.Solar);
    $('mon').textContent = monthAbbr(i.m); $('day').textContent = i.d; $('wd').textContent = '星期' + i.weekday + (offset ? (offset > 0 ? '（明天）' : '（昨天）') : '');
    $('lunar').textContent = i.lunar; $('term').textContent = formatTerm(i.term);
    const h = $('holiday'); h.hidden = !i.holiday;
    if (i.holiday) { h.textContent = i.holiday.name; h.classList.toggle('work', !i.holiday.off); }
    const img = $('mascot'); const src = sceneSrc(i.dayOfYear);
    if (!img.src.endsWith(src)) { img.onerror = () => { img.onerror = null; img.src = FALLBACK; }; img.src = src; }
    const l = pickLine(quotes[quoteIndex(i.dayOfYear) - 1], lineN);
    $('qtext').textContent = l.t; $('qmeta').textContent = l.a + (l.s ? '　' + l.s : '');
    const season = seasonOf(i.m);
    if (season !== lastSeason) { spawnParticles($('particles'), season); lastSeason = season; }
  }
  $('mascot').addEventListener('click', () => { offset = offset >= 1 ? -1 : offset + 1; render(); });
  $('quote').addEventListener('click', () => { lineN++; render(); });
  let t;
  $('quote').addEventListener('touchstart', () => { t = setTimeout(() => navigator.clipboard?.writeText($('qtext').textContent + ' —' + $('qmeta').textContent), 600); }, { passive: true });
  $('quote').addEventListener('touchend', () => clearTimeout(t));
  render();
  const tick = () => setTimeout(() => { offset = 0; lineN = 0; render(); tick(); }, msUntilMidnight(new Date()));
  tick();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
}
if (typeof document !== 'undefined') main();
