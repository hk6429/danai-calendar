// 純函式：給 Date 回今天的國曆／農曆／節氣／假日。Solar 由呼叫端注入（瀏覽器 window.Solar，Node 用 require）。
const WD = ['日', '一', '二', '三', '四', '五', '六'];
// lunar-javascript 輸出簡體，這裡轉台灣用字
const TRAD = { '马': '馬', '龙': '龍', '鸡': '雞', '猪': '豬', '惊蛰': '驚蟄', '谷雨': '穀雨', '处暑': '處暑', '小满': '小滿', '芒种': '芒種', '闰': '閏' };
const trad = s => s.replace(/马|龙|鸡|猪|惊蛰|谷雨|处暑|小满|芒种|闰/g, m => TRAD[m]);
const MONTH = { '冬': '十一', '腊': '十二' };
const pad = n => String(n).padStart(2, '0');
export const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dayOfYear = d => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 864e5) + 1;
export function dayInfo(date, holidays, Solar) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  const today = lunar.getJieQi();
  let term;
  if (today) term = { name: trad(today), daysUntil: 0 };
  else {
    const nx = lunar.getNextJieQi(); const s = nx.getSolar();
    term = { name: trad(nx.getName()), daysUntil: Math.round((Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay()) - Date.UTC(y, m - 1, d)) / 864e5) };
  }
  const mc = lunar.getMonthInChinese();
  const monthName = trad(mc.replace(/[冬腊]$/, c => MONTH[c])) + '月';
  return {
    y, m, d, weekday: WD[date.getDay()], dayOfYear: dayOfYear(date),
    lunar: monthName + lunar.getDayInChinese(), lunarYear: lunar.getYearInGanZhi(), zodiac: trad(lunar.getYearShengXiao()),
    term, holiday: (holidays && holidays[dateKey(date)]) || null,
  };
}
