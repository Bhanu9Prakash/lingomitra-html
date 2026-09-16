/* Exercise the real static Vue app in a DOM runtime. This is not visual browser QA.
   Install jsdom in your test environment, then run node tools/dom-test.js.
   LM_TEST_JSDOM optionally points to an existing jsdom package. */
const { JSDOM, VirtualConsole } = require(process.env.LM_TEST_JSDOM || 'jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const catalogue = require('../js/languages.js');
const root = path.join(__dirname, '..');
const base = 'http://localhost/lingomitra/';
const logs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', err => { if (!/navigation|scroll/i.test(err.message)) logs.push(err.message); });
const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
  url: base, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc
});
const w = dom.window;
w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {};
w.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
w.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
w.fetch = async url => {
  const u = new URL(url, w.location.href);
  assert.ok(u.href.startsWith(base), 'Course fetch escaped the app subdirectory');
  const file = path.join(root, decodeURIComponent(u.pathname.slice('/lingomitra/'.length)));
  return { ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404, text: async () => fs.readFileSync(file, 'utf8') };
};
// Older workers can serve new network-first HTML with their cached shell assets.
// Simulate that boundary using the actual v7 or v8 precache list.
const upgrading = process.argv.includes('--upgrade-from-v7') || process.argv.includes('--upgrade-from-v8');
const previous = process.argv.includes('--upgrade-from-v8')
  ? '9ab246614205fc2e1c5c45fa37ed7bdd25a79e8d' : '19264f81ff34c668d8649e8fc3f808277b8036fd';
let cachedPaths = [];
if (upgrading) {
  const oldContext = vm.createContext({ self: { registration: { scope: base }, addEventListener() {} }, URL });
  vm.runInContext(execFileSync('git', ['show', previous + ':service-worker.js'], { cwd: root, encoding: 'utf8' }), oldContext);
  cachedPaths = Array.from(vm.runInContext('SHELL', oldContext));
}
for (const el of w.document.querySelectorAll('script[src]')) {
  const src = el.getAttribute('src');
  const file = new URL(src, base).pathname.slice('/lingomitra/'.length);
  const cached = upgrading && cachedPaths.includes(src);
  const source = cached
    ? execFileSync('git', ['show', previous + ':' + file], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
  w.eval(source);
}
const settle = () => new Promise(resolve => setTimeout(resolve, 35));
async function go(hash) { w.location.hash = hash; await settle(); }
async function input(el, text) {
  assert.ok(el, 'Missing text field');
  el.value = text;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  await settle();
}
(async () => {
  try {
    await settle();
    assert.equal(w.document.querySelectorAll('.lang-card').length, 34);
    const names = () => [...w.document.querySelectorAll('.lang-card__name')].map(el => el.textContent.trim());
    assert.deepEqual(names(), names().slice().sort((a, b) => a.localeCompare(b, 'en')), 'Catalogue is not alphabetical');
    async function filter(code) {
      const button = w.document.querySelector('[data-course-filter="' + code + '"]');
      assert.ok(button, 'Missing catalogue filter: ' + code);
      button.click(); await settle();
      assert.equal(button.getAttribute('aria-pressed'), 'true');
    }
    await filter('indian');
    assert.equal(names().length, 22);
    await input(w.document.querySelector('.course-search input'), 'తెలుగు');
    assert.equal(w.document.querySelectorAll('.lang-card').length, 1);
    assert.match(w.document.querySelector('.lang-card').textContent, /Telugu/);
    await input(w.document.querySelector('.course-search input'), 'no-such-language');
    assert.match(w.document.body.textContent, /No matching language/);
    await input(w.document.querySelector('.course-search input'), '');
    await filter('international');
    assert.equal(names().length, 12);
    await input(w.document.querySelector('.course-search input'), 'فارسی');
    assert.deepEqual(names(), ['Persian']);
    await input(w.document.querySelector('.course-search input'), 'Telugu');
    assert.equal(names().length, 0);
    w.document.querySelector('.catalogue-empty button').click(); await settle();
    assert.equal(names().length, 34);
    assert.equal(w.document.querySelector('.course-search input').value, '');
    await filter('started');
    assert.match(w.document.querySelector('.catalogue-empty').textContent, /No courses started yet/);
    await go('/persian/intro'); await go('/');
    assert.deepEqual(names(), ['Persian']);
    assert.match(w.document.querySelector('.resume__meta').textContent, /Introduction/);
    w.document.querySelector('.lang-card').click(); await settle();
    assert.equal(w.location.hash, '#/persian/intro', 'Started course did not reopen its saved place');
    await go('/'); await filter('all');

    const chosen = process.argv.includes('--legacy-only') ? catalogue.slice(0, 7) : catalogue;
    for (const lang of chosen) {
      await go('/' + lang.code + '/1');
      assert.ok(w.document.querySelector('article.prose'), lang.code + ' reader missing');
      assert.equal(w.document.querySelector('article.prose').getAttribute('dir'), 'ltr');
      assert.match(w.document.querySelector('.lesson-head').textContent, /Lesson 1 of/);
      if (lang.reviewStatus === 'draft') {
        assert.match(w.document.querySelector('.lesson-head').textContent, /Fluent-speaker review pending/);
        assert.ok(w.document.querySelector('details.answers:not([open])'), lang.code + ' answer key is not collapsed');
      }
      assert.ok(!w.document.querySelector('.state'), lang.code + ' error or missing course');
      const saved = JSON.parse(w.localStorage.getItem('lm.progress'));
      assert.equal(saved[lang.code].last, lang.code + '-lesson-1', lang.code + ' progress not saved');
      await go('/' + lang.code + '/1/practice');
      const field = w.document.querySelector('.answer-field input');
      assert.ok(field, lang.code + ' practice missing');
      assert.equal(field.getAttribute('lang'), lang.contentTag);
      assert.equal(field.getAttribute('dir'), 'auto');
      assert.equal(w.document.querySelector('.compare__row--answer'), null, lang.code + ' answer leaked before reveal');
      const reveal = [...w.document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Show the answer');
      reveal.click(); await settle();
      assert.ok(w.document.querySelector('.compare__row--answer bdi'), lang.code + ' native answer missing');
    }
    // Reopening an old route retains its stored place alongside the new courses.
    await go('/german/2');
    await go('/');
    assert.match(w.document.querySelector('.resume').textContent, /German/);
    w.document.querySelector('.resume').click(); await settle();
    assert.equal(w.location.hash, '#/german/2');
    assert.deepEqual(logs, []);
    console.log(`DOM integration passed for ${chosen.length} course readers, practice routes, search, answer concealment and stored progress.`);
  } finally { w.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
