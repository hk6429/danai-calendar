// 人事總處「政府行政機關辦公日曆表」CSV（scratch/holidays-*.csv，UTF-8 BOM）→ data/holidays.json
// 欄位：西元日期,星期,是否放假(0/2),備註。只收：平日放假、有名字的週末假日、週末補班。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const out = {};
for (const f of readdirSync('scratch').filter(f => /^holidays-.*\.csv$/.test(f)).sort()) {
  const txt = readFileSync('scratch/' + f, 'utf8').replace(/^﻿/, '');
  for (const line of txt.trim().split(/\r?\n/).slice(1)) {
    const [ymd, , off, note = ''] = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
    if (!/^\d{8}$/.test(ymd)) continue;
    const key = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6)}`;
    const isOff = off === '2';
    const wd = new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6)).getDay();
    const weekend = wd === 0 || wd === 6;
    if (isOff && !weekend) out[key] = { name: note || '放假', off: true };
    else if (isOff && weekend && note) out[key] = { name: note, off: true };
    else if (!isOff && weekend) out[key] = { name: note || '補班', off: false };
  }
}
writeFileSync('data/holidays.json', JSON.stringify(out));
console.log('holidays', Object.keys(out).length);
