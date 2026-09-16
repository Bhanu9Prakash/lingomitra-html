/* Validate the actual catalogue/course boundary and Unicode answer behavior.
   Run: node tools/catalog-test.js [--metadata-only] */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const practice = require('../js/practice.js');
const root = path.join(__dirname, '..');
const required = 'german spanish french hindi chinese japanese kannada assamese bengali bodo dogri gujarati kashmiri konkani maithili malayalam manipuri marathi nepali odia punjabi sanskrit santali sindhi tamil telugu urdu persian russian italian arabic portuguese korean turkish'.split(' ');
const legacy = new Set(required.slice(0, 7));
const context = { window: {} };
vm.createContext(context);
const metadata = path.join(root, 'js/languages.js');
assert.ok(fs.existsSync(metadata), 'The app needs the expanded shared course catalogue');
vm.runInContext(fs.readFileSync(metadata, 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/content.js'), 'utf8'), context);
const catalogue = context.window.languageCatalog;
assert.deepEqual(Array.from(catalogue, l => l.code).sort(), required.slice().sort());
let lessons = 0, exercises = 0;
for (const lang of catalogue) {
  assert.ok(fs.existsSync(path.join(root, 'flags', lang.flagCode + '.svg')), lang.code + ' flag missing');
  assert.ok(lang.tags.length && lang.tags.every(tag => Intl.getCanonicalLocales(tag).length), lang.code + ' invalid speech tag');
  if (!legacy.has(lang.code)) assert.equal(lang.reviewStatus, 'draft', lang.code + ' must disclose review status');
  if (process.argv.includes('--metadata-only')) continue;
  const file = path.join(root, lang.coursePath);
  assert.ok(fs.existsSync(file), lang.code + ' course missing');
  const text = fs.readFileSync(file, 'utf8');
  const parsed = context.window.content.splitLessons(text, lang.code).filter(l => l.number);
  assert.ok(parsed.length > 0, lang.code + ' has no lessons');
  if (!legacy.has(lang.code)) {
    assert.equal(parsed.length, 25, lang.code + ' needs 25 lessons');
    const numbers = Array.from(text.matchAll(/^## Lesson (\d+):/gm), m => Number(m[1]));
    assert.deepEqual(numbers, Array.from({ length: 25 }, (_, i) => i + 1), lang.code + ' heading sequence');
    assert.ok(/fluent-speaker review pending/i.test(text), lang.code + ' review note missing');
  }
  for (const lesson of parsed) {
    const items = practice.extract(lesson, lang);
    if (!legacy.has(lang.code)) assert.ok(items.length >= 4, lesson.id + ' has fewer than 4 usable exercises');
    for (const item of items) {
      assert.equal(practice.check(item.answer, item).correct, true, item.id + ' does not accept its own native answer');
      if (item.roman) assert.equal(practice.check(item.roman, item).correct, true, item.id + ' romanisation rejected');
    }
    lessons++;
    exercises += items.length;
  }
}
// NFC equivalence must count, while distinct Cyrillic letters and Indic vowel marks must not disappear.
assert.equal(practice.check('кофе\u0301', { answer: 'кофе́' }).correct, true);
assert.equal(practice.check('क़लम', { answer: 'क़लम' }).correct, true);
assert.notEqual(practice.check('и', { answer: 'й' }).correct, true);
assert.notEqual(practice.check('మన', { answer: 'మాన' }).correct, true);
assert.equal(practice.check('سلام', { answer: 'سلام؟' }).correct, true);
assert.equal(practice.check('मैं यहाँ हूँ', { answer: 'मैं यहाँ हूँ।' }).correct, true);
console.log(`Catalogue verified: ${catalogue.length} languages, ${lessons} lessons, ${exercises} exercises.`);
