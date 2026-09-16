/* Exercise real worker event handlers against a Cache API boundary.
   Run: node tools/offline-test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function verify(scope, failShell) {
  const records = new Map(), handlers = {};
  let online = true, claimed = false, skipped = false;
  const absolute = r => new URL(typeof r === 'string' ? r : r.url, scope).href;
  const caches = {
    async open(name) {
      if (!records.has(name)) records.set(name, new Map());
      const rows = records.get(name);
      return {
        async match(r) { const v = rows.get(absolute(r)); return v && v.clone(); },
        async put(r, value) { rows.set(absolute(r), value.clone()); },
        async keys() { return Array.from(rows.keys(), url => new Request(url)); },
        async add(r) { await this.put(r, await network(r)); },
        async addAll(rs) { for (const r of rs) await this.add(r); }
      };
    },
    async keys() { return Array.from(records.keys()); },
    async delete(name) { return records.delete(name); },
    async match(r) {
      for (const name of records.keys()) { const value = await (await this.open(name)).match(r); if (value) return value; }
    }
  };
  async function network(r) {
    if (!online) throw new Error('offline');
    const url = new URL(absolute(r));
    const relative = url.pathname.slice(new URL(scope).pathname.length) || 'index.html';
    if (failShell && relative === 'script.js') throw new Error('Required shell asset failed');
    if (relative.startsWith('courses/')) return new Response('updated lesson');
    assert.ok(fs.existsSync(path.join(__dirname, '..', relative)), 'Missing precache asset: ' + relative);
    return new Response('shell: ' + relative);
  }
  const worker = {
    registration: { scope }, location: new URL('service-worker.js', scope),
    clients: { async claim() { claimed = true; } }, async skipWaiting() { skipped = true; },
    addEventListener(type, fn) { handlers[type] = fn; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../service-worker.js'), 'utf8'), {
    self: worker, caches, fetch: network, URL, Response, Request, Promise
  });
  async function dispatch(type, request) {
    const pending = []; let response;
    handlers[type]({ request, waitUntil(p) { pending.push(p); }, respondWith(p) { response = p; } });
    const result = await response;
    await Promise.all(pending);
    return result;
  }
  const unrelated = await caches.open('other-app-v1');
  await unrelated.put('https://example.test/other/data.json', new Response('keep other app'));
  const legacy = await caches.open('lingomitra-v7');
  const courseURL = new URL('courses/hindi-lesson.md', scope).href;
  await legacy.put(courseURL, new Response('saved lesson'));
  await legacy.put('https://example.test/other/courses/hindi-lesson.md', new Response('other course'));
  // A foreign index must never be selected as our offline navigation fallback.
  await unrelated.put(new URL('index.html', scope), new Response('foreign index'));
  if (failShell) {
    const oldName = 'lingomitra@' + scope + 'shell-v7';
    const oldShell = await caches.open(oldName);
    await oldShell.put('script.js', new Response('working previous shell'));
    await assert.rejects(dispatch('install'), /Required shell asset failed/);
    assert.equal(skipped, false, 'Partial install tried to replace the working worker');
    assert.equal(claimed, false);
    assert.ok((await caches.keys()).includes(oldName), 'Failed install lost previous cache');
    assert.equal(await (await oldShell.match('script.js')).text(), 'working previous shell');
    return;
  }
  await dispatch('install');
  await dispatch('activate');
  assert.ok(claimed);
  assert.ok((await caches.keys()).includes('other-app-v1'), 'Activation deleted another app cache');
  online = false;
  const saved = await dispatch('fetch', new Request(courseURL));
  assert.equal(await saved.text(), 'saved lesson', 'Update lost an already downloaded course');
  const page = await dispatch('fetch', { url: scope, method: 'GET', mode: 'navigate' });
  assert.equal(await page.text(), 'shell: index.html');
  online = true;
  const immediate = await dispatch('fetch', new Request(courseURL));
  assert.equal(await immediate.text(), 'saved lesson', 'Existing course should open immediately');
  online = false;
  const updated = await dispatch('fetch', new Request(courseURL));
  assert.equal(await updated.text(), 'updated lesson', 'Revalidation must finish writing before worker exits');
  await dispatch('activate');
  const stillSaved = await dispatch('fetch', new Request(courseURL));
  assert.equal(await stillSaved.text(), 'updated lesson', 'Reactivation overwrote the newer course with legacy data');
}
(async () => {
  await verify('https://example.test/');
  await verify('https://example.test/lingomitra/');
  await verify('https://example.test/', true);
  await verify('https://example.test/lingomitra/', true);
  console.log('Offline verified: root and subdirectory install, safe activation, preserved courses, revalidation and failed-install rollback.');
})().catch(e => { console.error(e); process.exitCode = 1; });
