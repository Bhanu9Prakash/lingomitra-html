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
    // A completed course response cannot overwrite the learner's newer choice.
    const realFetch = w.fetch;
    let releaseRussian;
    w.fetch = url => String(url).includes('russian-lesson.md')
      ? new Promise(resolve => { releaseRussian = () => realFetch(url).then(resolve); })
      : realFetch(url);
    await go('/russian/1');
    await go('/persian/1');
    releaseRussian(); await settle(); await settle();
    assert.match(w.document.querySelector('.lesson-head').textContent, /Make a sentence/);
    assert.equal(JSON.parse(w.localStorage.getItem('lm.progress')).persian.last, 'persian-lesson-1', 'Late response overwrote another course progress');
    assert.match(w.document.querySelector('article').textContent, /هستم/);
    w.fetch = realFetch;

    // Lowering a practice route must lower the actual exercise ceiling.
    await go('/turkish/25/practice');
    await go('/turkish/1/practice');
    const first = w.content.splitLessons(fs.readFileSync(path.join(root, 'courses/turkish-lesson.md'), 'utf8'), 'turkish').find(l => l.number === 1);
    const expected = w.practice.extract(first, catalogue.find(l => l.code === 'turkish')).map(i => i.prompt);
    let checked = 0;
    while (w.document.querySelector('.practice__prompt')) {
      const prompt = w.document.querySelector('.practice__prompt');
      assert.ok(expected.some(p => prompt.textContent.includes(p)), 'Practice retained later-lesson exercises');
      const reveal = [...w.document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Show the answer');
      reveal.click(); await settle();
      const next = [...w.document.querySelectorAll('button')].find(el => /^(Next|Finish)$/.test(el.textContent.trim()));
      next.click(); await settle();
      checked++;
      assert.ok(checked <= expected.length, 'Lesson-1 session contains more than its available material');
    }
    assert.equal(checked, expected.length);

    // Model requests are the I/O boundary; the real app and coach construct them.
    const modelRequests = [];
    w.tutor.status = () => ({ ready: true, local: true, model: 'test model' });
    w.tutor.chat = options => new Promise((resolve, reject) => modelRequests.push({ options, resolve, reject }));
    await go('/german/1/talk');
    w.document.querySelector('.scenario').click(); await settle();
    assert.match(modelRequests[0].options.system, /practise German/);
    modelRequests[0].resolve('Wie heißt du?'); await settle();
    await go('/russian/1/talk');
    assert.equal(w.document.querySelectorAll('.turn').length, 0, 'Conversation retained the previous language');
    w.document.querySelector('.scenario').click(); await settle();
    assert.match(modelRequests[1].options.system, /practise Russian/);
    await go('/persian/1/talk');
    assert.equal(modelRequests[1].options.signal.aborted, true, 'Leaving the course did not abort the pending model call');
    w.document.querySelector('.scenario').click(); await settle();
    modelRequests[1].resolve('Old Russian response'); await settle();
    assert.ok(!w.document.body.textContent.includes('Old Russian response'), 'A stale turn entered the new conversation');
    modelRequests[2].resolve('سلام'); await settle();
    assert.match(w.document.querySelector('.turn__bubble').textContent, /سلام/);
    await go('/persian/2/talk');
    assert.equal(w.document.querySelectorAll('.turn').length, 0, 'Conversation ceiling was not reset');

    // An installed native voice is not evidence of Roman/IPA pronunciation support.
    w.speech.canListen = () => true;
    w.speech.probeVoice = (code, callback) => callback({ ok: true, name: 'Native voice' });
    let spoken = 0;
    w.speech.speak = () => { spoken++; };
    await go('/kashmiri/1/practice');
    assert.equal(w.document.querySelector('.mic'), null, 'Roman transcription exposed voice input');
    const reveal = [...w.document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Show the answer');
    reveal.click(); await settle();
    assert.equal(spoken, 0, 'Academic transcription was sent to a native voice');
    assert.match(w.document.body.textContent, /Roman transcription/);
    await go('/kashmiri/1/talk');
    w.document.querySelector('.scenario').click(); await settle();
    assert.match(modelRequests[3].options.system, /Roman transcription/);
    modelRequests[3].resolve('Test'); await settle();
    // Cancelling an opening response must restore a usable conversation start.
    await go('/german/1/talk');
    w.document.querySelector('.scenario').click(); await settle();
    const cancelled = modelRequests[modelRequests.length - 1];
    w.document.querySelector('[aria-label="Leave the conversation"]').click(); await settle();
    const abortError = new Error('cancelled'); abortError.name = 'AbortError';
    cancelled.reject(abortError); await settle();
    await go('/german/1/talk');
    assert.ok(w.document.querySelector('.scenario'), 'Cancelled opening left a permanent thinking placeholder');
    assert.equal(w.document.querySelector('.thinking-dots'), null);

    // Settings remain in control if a course finishes downloading in the background.
    let releaseOdia;
    w.fetch = url => String(url).includes('odia-lesson.md')
      ? new Promise(resolve => { releaseOdia = () => realFetch(url).then(resolve); })
      : realFetch(url);
    await go('/odia/1/talk');
    await go('/settings');
    releaseOdia(); await settle(); await settle();
    assert.equal(w.location.hash, '#/settings');
    assert.ok(w.document.querySelector('main .setup'), 'Late course load replaced Settings with its old route mode');
    w.fetch = realFetch;
    assert.deepEqual(logs, []);
    console.log('Session boundaries verified: load races, practice ceiling, conversation language/ceiling, stale replies and Roman-format guards.');
  } finally { w.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
