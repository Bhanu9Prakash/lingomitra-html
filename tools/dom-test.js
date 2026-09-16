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
// A v7 worker served new network-first HTML with its old unversioned shell.
// Simulate that cache boundary using the real previous release's precache list.
const upgrading = process.argv.includes('--upgrade-from-v7');
const previous = '19264f81ff34c668d8649e8fc3f808277b8036fd';
let cachedPaths = [];
if (upgrading) {
  const oldContext = vm.createContext({ self: { addEventListener() {} } });
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
    await input(w.document.querySelector('.course-search input'), 'తెలుగు');
    assert.equal(w.document.querySelectorAll('.lang-card').length, 1);
    assert.match(w.document.querySelector('.lang-card').textContent, /Telugu/);
    await input(w.document.querySelector('.course-search input'), 'no-such-language');
    assert.match(w.document.body.textContent, /No matching language/);
    await input(w.document.querySelector('.course-search input'), '');

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
