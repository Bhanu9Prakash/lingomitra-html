/* Behaviour tests for the practice checker. Run: node tools/practice-test.js */
const p = require('../js/practice.js');
let pass = 0, fail = 0;

const de = { answer: 'Wir wohnen in Hamburg.', roman: null };
const es = { answer: '(Yo) cocino la cena.', roman: null };
const kn = { answer: 'ನಾನು ಕಾಫಿ ಕುಡಿಯುತ್ತೇನೆ.', roman: 'naanu kaafi kuDiyutteene.' };
const ja = { answer: '私は本を読みます。', roman: 'Watashi wa hon o yomimasu.' };
const fr = { answer: 'Nous habitons à Montréal.', roman: null };

const cases = [
  // exact and near-exact
  ['exact',                de, 'Wir wohnen in Hamburg.',      'match',   true],
  ['no final stop',        de, 'Wir wohnen in Hamburg',       'match',   true],
  ['extra spaces',         de, '  Wir   wohnen in Hamburg. ', 'match',   true],
  ['lowercase noun',       de, 'wir wohnen in hamburg',       'case',    true],
  ['missing umlaut',       fr, 'Nous habitons a Montreal',    'accents', true],
  ['word order',           de, 'In Hamburg wohnen wir',       'order',   false],
  ['one word off',         de, 'Wir wohnen in Berlin',        'near',    false],
  ['unrelated',            de, 'Ich esse Pizza',              'differs', false],
  ['empty',                de, '   ',                         'empty',   undefined],

  // optional parenthesised subject (Spanish pro-drop)
  ['with pronoun',         es, '(Yo) cocino la cena.',        'match',   true],
  ['without pronoun',      es, 'Cocino la cena.',             'match',   true],
  ['pronoun no parens',    es, 'Yo cocino la cena.',          'match',   true],

  // romanisation accepted — a phone with no Kannada/Japanese keyboard
  ['kannada script',       kn, 'ನಾನು ಕಾಫಿ ಕುಡಿಯುತ್ತೇನೆ.',           'match',   true],
  ['kannada romanised',    kn, 'naanu kaafi kuDiyutteene',    'match',   true],
  ['kannada roman casing', kn, 'naanu kaafi kudiyutteene',    'case',    true],
  ['japanese script',      ja, '私は本を読みます。',              'match',   true],
  ['japanese romanised',   ja, 'watashi wa hon o yomimasu',   'case',    true],
];

for (const [name, item, attempt, want, wantCorrect] of cases) {
  const got = p.check(attempt, item);
  const ok = got.result === want && (wantCorrect === undefined || got.correct === wantCorrect);
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL ${name}: got ${got.result}/correct=${got.correct}, want ${want}/${wantCorrect}`); }
}

// three-state model: close is neither a tick nor a cross
for (const [name, item, attempt, want] of [
  ['order is close',   de, 'In Hamburg wohnen wir', 'close'],
  ['near is close',    de, 'Wir wohnen in Berlin',  'close'],
  ['match is correct', de, 'Wir wohnen in Hamburg', 'correct'],
  ['junk is different',de, 'Ich esse Pizza',        'different'],
]) {
  const got = p.check(attempt, item);
  if (got.status === want) pass++;
  else { fail++; console.log(`  FAIL ${name}: status=${got.status}, want ${want}`); }
}

// near-miss should point at the differing word
const near = p.check('Wir wohnen in Berlin', de);
if (near.expected === 'Hamburg' && near.gave === 'Berlin') pass++;
else { fail++; console.log(`  FAIL near-miss detail: ${JSON.stringify(near)}`); }

// session builder respects the ceiling and prefers recent lessons
const byLesson = {};
for (let n = 1; n <= 10; n++) {
  byLesson['l' + n] = Array.from({ length: 6 }, (_, i) => ({ id: `l${n}-${i}`, lessonNumber: n, answer: 'x', prompt: 'y' }));
}
const s = p.session(byLesson, 5, 8);
if (s.length === 8 && s.every(i => i.lessonNumber <= 5)) pass++;
else { fail++; console.log(`  FAIL session scope: len=${s.length} max=${Math.max(...s.map(i => i.lessonNumber))}`); }
const recentShare = s.filter(i => i.lessonNumber >= 4).length;
if (recentShare >= 4) pass++;
else { fail++; console.log(`  FAIL session weighting: only ${recentShare}/8 from recent lessons`); }

// early lessons must still produce a full session
const s1 = p.session(byLesson, 1, 8);
if (s1.length === 6 && s1.every(i => i.lessonNumber === 1)) pass++;
else { fail++; console.log(`  FAIL session at lesson 1: len=${s1.length}`); }

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
