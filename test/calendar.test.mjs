import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dayInfo, dateKey } from '../js/calendar.js';
const { Solar } = createRequire(import.meta.url)('../js/vendor/lunar.js');
const H = { '2026-02-16': { name: '除夕', off: true }, '2026-02-17': { name: '春節', off: true }, '2026-10-10': { name: '國慶日', off: true } };
const D = (y, m, d) => new Date(y, m - 1, d, 12);
test('dateKey uses local components', () => assert.equal(dateKey(new Date(2026, 9, 2, 23, 30)), '2026-10-02'));
test('2026-10-02 lunar 八月廿二, next term 寒露 in 6 days', () => {
  const i = dayInfo(D(2026, 10, 2), H, Solar);
  assert.equal(i.lunar, '八月廿二'); assert.equal(i.zodiac, '馬'); assert.equal(i.weekday, '五');
  assert.deepEqual(i.term, { name: '寒露', daysUntil: 6 }); assert.equal(i.holiday, null); assert.equal(i.dayOfYear, 275);
});
test('term day itself', () => assert.deepEqual(dayInfo(D(2026, 10, 8), H, Solar).term, { name: '寒露', daysUntil: 0 }));
test('term names are traditional (驚蟄/穀雨/處暑)', () => {
  assert.equal(dayInfo(D(2026, 3, 5), {}, Solar).term.name, '驚蟄');
  assert.equal(dayInfo(D(2026, 4, 20), {}, Solar).term.name, '穀雨');
  assert.equal(dayInfo(D(2026, 8, 23), {}, Solar).term.name, '處暑');
});
test('除夕 / 春節', () => {
  assert.equal(dayInfo(D(2026, 2, 16), H, Solar).holiday.name, '除夕');
  assert.equal(dayInfo(D(2026, 2, 17), H, Solar).lunar, '正月初一');
});
test('leap month 2025-07-25 is 閏六月初一', () => assert.equal(dayInfo(D(2025, 7, 25), {}, Solar).lunar, '閏六月初一'));
test('十一月/十二月 not 冬/腊', () => {
  assert.equal(dayInfo(D(2027, 1, 1), {}, Solar).lunar, '十一月廿四');
  assert.equal(dayInfo(D(2027, 1, 8), {}, Solar).lunar, '十二月初一');
});
test('unknown year returns null holiday', () => assert.equal(dayInfo(D(2028, 1, 1), H, Solar).holiday, null));
test('leap year dayOfYear 366', () => assert.equal(dayInfo(D(2028, 12, 31), {}, Solar).dayOfYear, 366));
test('zodiac 豬 is traditional', () => assert.equal(dayInfo(D(2031, 3, 1), {}, Solar).zodiac, '豬'));
test('leap 11th month 2033-12-22 is 閏十一月初一', () => assert.equal(dayInfo(D(2033, 12, 22), {}, Solar).lunar, '閏十一月初一'));
