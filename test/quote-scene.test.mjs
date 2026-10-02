import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteIndex, pickLine } from '../js/quote.js';
import { sceneSrc, FALLBACK } from '../js/scene.js';
const day = { d: 1, lines: [0, 1, 2, 3, 4].map(i => ({ t: 't' + i, a: 'a', s: 's' })) };
test('day366 maps to 365', () => { assert.equal(quoteIndex(366), 365); assert.equal(quoteIndex(1), 1); assert.equal(sceneSrc(366), 'img/d365.webp'); });
test('sceneSrc pads', () => assert.equal(sceneSrc(7), 'img/d007.webp'));
test('pickLine wraps', () => { assert.equal(pickLine(day, 0).t, 't0'); assert.equal(pickLine(day, 5).t, 't0'); assert.equal(pickLine(day, 7).t, 't2'); });
test('FALLBACK', () => assert.equal(FALLBACK, 'img/fallback.webp'));
