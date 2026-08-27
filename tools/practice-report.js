/* Measures practice extraction against the real course files.
   Run: node tools/practice-report.js [--samples N] */
const fs = require('fs');
const path = require('path');
const practice = require('../js/practice.js');

function splitLessons(md, code) {
  const out = [];
  let n = 1;
  md.split(/(?=^##\s)/m).forEach((raw, i) => {
    const s = raw.trim();
    if (!s) return;
    if (s.startsWith('## ')) {
      out.push({ id: `${code}-lesson-${n}`, number: n, title: s.split('\n')[0].slice(3).trim(), content: s });
      n++;
    } else if (i === 0) {
      out.push({ id: `${code}-intro`, number: 0, title: 'Introduction', content: s });
    }
  });
  return out;
}

const nSamples = Number((process.argv.find(a => a.startsWith('--samples')) || '').split('=')[1] || 3);
let grand = 0, withRoman = 0;
const dir = path.join(__dirname, '..', 'courses');

for (const file of fs.readdirSync(dir).sort()) {
  if (!file.endsWith('.md')) continue;
  const code = file.replace('-lesson.md', '');
  const lessons = splitLessons(fs.readFileSync(path.join(dir, file), 'utf8'), code);
  let items = [];
  let covered = 0;
  for (const l of lessons) {
    const got = practice.extract(l);
    if (got.length) covered++;
    items = items.concat(got);
  }
  grand += items.length;
  withRoman += items.filter(i => i.roman).length;
  console.log(`  ${code.padEnd(10)} lessons=${String(lessons.length).padStart(3)}  with-practice=${String(covered).padStart(3)}  items=${String(items.length).padStart(4)}  romanised=${String(items.filter(i => i.roman).length).padStart(4)}`);
  for (const it of items.slice(0, nSamples)) {
    console.log(`      "${it.prompt}"${it.hint ? `  [${it.hint}]` : ''}`);
    console.log(`        -> "${it.answer}"${it.roman ? `  /${it.roman}/` : ''}`);
  }
}
console.log(`\n  TOTAL items = ${grand}   with romanisation = ${withRoman}`);
