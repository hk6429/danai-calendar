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
