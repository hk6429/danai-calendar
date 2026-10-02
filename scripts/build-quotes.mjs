import { readFileSync, writeFileSync } from 'node:fs';
const SRC = process.env.HOME + '/projects/daily-quotes-365/data/scenes.json';
const scenes = JSON.parse(readFileSync(SRC, 'utf8')).sort((a, b) => a.id - b.id);
if (scenes.length !== 365) throw new Error('expect 365 scenes, got ' + scenes.length);
const out = scenes.map((s, i) => ({ d: i + 1, lines: s.lines.slice(0, 5).map(l => ({ t: l.text, a: l.author, s: l.source || '' })) }));
writeFileSync('data/quotes.json', JSON.stringify(out));
console.log('quotes', out.length);
