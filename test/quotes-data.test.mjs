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
