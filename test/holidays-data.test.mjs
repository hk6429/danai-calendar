import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
test('holidays.json covers 2026 named holidays, skips plain weekends', () => {
  assert.ok(existsSync('data/holidays.json'), 'data/holidays.json missing');
  const h = JSON.parse(readFileSync('data/holidays.json', 'utf8'));
  assert.deepEqual(h['2026-10-10'], { name: '國慶日', off: true });
  assert.deepEqual(h['2026-02-17'], { name: '春節', off: true });
  assert.equal(h['2026-09-19'], undefined);
  for (const [k, v] of Object.entries(h)) { assert.match(k, /^\d{4}-\d{2}-\d{2}$/); assert.ok(v.name); assert.equal(typeof v.off, 'boolean'); }
});
