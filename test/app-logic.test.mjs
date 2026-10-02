import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthAbbr, seasonOf, msUntilMidnight, formatTerm } from '../js/app.js';
test('monthAbbr', () => { assert.equal(monthAbbr(10), 'OCT.'); assert.equal(monthAbbr(1), 'JAN.'); });
test('seasonOf', () => { assert.equal(seasonOf(3), 'spring'); assert.equal(seasonOf(7), 'summer'); assert.equal(seasonOf(10), 'autumn'); assert.equal(seasonOf(12), 'winter'); });
test('msUntilMidnight', () => assert.equal(msUntilMidnight(new Date(2026, 9, 2, 23, 59, 59, 0)), 1000));
test('formatTerm', () => { assert.equal(formatTerm({ name: '寒露', daysUntil: 0 }), '寒露'); assert.equal(formatTerm({ name: '寒露', daysUntil: 6 }), '寒露前 6 天'); });
import { shouldResetView } from '../js/app.js';
test('shouldResetView when the local day changed', () => { assert.equal(shouldResetView('2026-10-02', '2026-10-03'), true); assert.equal(shouldResetView('2026-10-02', '2026-10-02'), false); });
