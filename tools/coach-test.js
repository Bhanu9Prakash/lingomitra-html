/* Checks that the scoped prompt really is scoped. Run: node tools/coach-test.js */
const fs = require('fs'); const path = require('path');
const practice = require('../js/practice.js');

// coach.js/tutor.js attach to a global; give them one.
global.window = global; global.self = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require('../js/coach.js');
const coach = global.coach;

function splitLessons(md, code) {
  const out = []; let n = 1;
  md.split(/(?=^##\s)/m).forEach((raw, i) => {
    const s = raw.trim(); if (!s) return;
    if (s.startsWith('## ')) { out.push({ id: `${code}-lesson-${n}`, number: n, title: s.split('\n')[0].slice(3).trim(), content: s }); n++; }
    else if (i === 0) out.push({ id: `${code}-intro`, number: 0, title: 'Introduction', content: s });
  });
  return out;
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => cond ? pass++ : (fail++, console.log(`  FAIL ${name} ${extra}`));

const md = fs.readFileSync(path.join(__dirname, '..', 'courses', 'german-lesson.md'), 'utf8');
const lessons = splitLessons(md, 'german');
const itemsByLesson = {};
for (const l of lessons) { const got = practice.extract(l); if (got.length) itemsByLesson[l.id] = got; }

// A digest for lesson 3 must not leak anything from lesson 4+
const d3 = coach.syllabus(lessons, itemsByLesson, 3);
ok('digest respects the ceiling', d3.sentences.every(s => s.n <= 3), JSON.stringify(d3.sentences.filter(s => s.n > 3).slice(0,2)));
ok('digest has content at lesson 3', d3.sentences.length > 0 && d3.topics.length === 3, `s=${d3.sentences.length} t=${d3.topics.length}`);

const later = itemsByLesson['german-lesson-12'] || [];
const prompt3 = coach.conversationPrompt({ lessons, itemsByLesson, upTo: 3, languageName: 'German' });
ok('prompt excludes later material', later.length > 0 && !prompt3.includes(later[0].answer), later[0] && later[0].answer);
ok('prompt states the hard rules', /Never introduce or explain new grammar/.test(prompt3) && /Never hand over the answer/.test(prompt3));
ok('prompt names the language', /practise German/.test(prompt3));

// Bounded prompt on a long course
const dAll = coach.syllabus(lessons, itemsByLesson, 39);
ok('digest stays bounded', dAll.sentences.length <= 60 && dAll.topics.length <= 40, `s=${dAll.sentences.length} t=${dAll.topics.length}`);
const promptAll = coach.conversationPrompt({ lessons, itemsByLesson, upTo: 39, languageName: 'German' });
ok('prompt size is sane', promptAll.length < 12000, `${promptAll.length} chars`);

// Scenarios gate on progress
ok('early learner gets few scenarios', coach.scenariosFor(1).length === 2, JSON.stringify(coach.scenariosFor(1).map(s => s.id)));
ok('later learner gets more', coach.scenariosFor(12).length === 6);

// Verdict parsing
const good = coach.readVerdict('VERDICT: acceptable\nWHY: Fronting the adverbial is fine in German.');
ok('reads an acceptable verdict', good.acceptable === true && /Fronting/.test(good.why));
const bad = coach.readVerdict('VERDICT: not-acceptable\nWHY: The verb needs the -st ending for du.');
ok('reads a rejection', bad.acceptable === false && /-st/.test(bad.why));
ok('garbage does not read as acceptable', coach.readVerdict('who knows').acceptable === false);

// Vocabulary is deduped and scoped
const vocab = coach.vocabulary(lessons, itemsByLesson, 3);
ok('vocabulary is scoped', vocab.every(v => v.lessonNumber <= 3));
ok('vocabulary is deduped', new Set(vocab.map(v => v.answer.toLowerCase())).size === vocab.length);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
