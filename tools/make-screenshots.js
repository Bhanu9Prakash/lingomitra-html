/* Regenerates the manifest screenshots. Chrome on Android only shows its richer
   install dialog when the manifest carries screenshots with a form_factor, so
   these are part of PWA setup rather than marketing.

   Run: node tools/make-screenshots.js    (starts its own server) */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8931;

const SHOTS = [
  { name: 'narrow-home.png', w: 390, h: 844, url: '/', mobile: true },
  { name: 'narrow-lesson.png', w: 390, h: 844, url: '/#/german/1', mobile: true },
  { name: 'narrow-practice.png', w: 390, h: 844, url: '/#/german/1/practice', mobile: true },
  { name: 'wide-lesson.png', w: 1280, h: 800, url: '/#/german/1', mobile: false }
];

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ROOT], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const b = await chromium.launch({ executablePath: EXE });

  for (const s of SHOTS) {
    const ctx = await b.newContext({
      viewport: { width: s.w, height: s.h },
      deviceScaleFactor: 2, isMobile: s.mobile, hasTouch: s.mobile
    });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('lm.theme', 'dark');
        Object.defineProperty(navigator, 'serviceWorker', { get: () => undefined });
      } catch (e) { /* ignore */ }
    });
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${PORT}${s.url}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1600);
    await p.screenshot({ path: path.join(ROOT, 'screenshots', s.name) });
    console.log('  wrote screenshots/' + s.name + `  ${s.w * 2}x${s.h * 2}`);
    await ctx.close();
  }

  await b.close();
  srv.kill('SIGKILL');
})();
