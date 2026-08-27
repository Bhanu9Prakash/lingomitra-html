/* Adds the PWA icon variants the manifest needs, derived from the existing
   app mark so the identity does not change.

   Run: node tools/make-icons.js      (needs playwright + the bundled chromium)

   icons/icon-192x192.png / icon-512x512.png are the original mark and are left
   alone — they are declared purpose "any".

   Generated here:
   · icon-maskable-*.png  the mark at 76% on the brand gradient, so Android's
     circle/squircle crop lands inside the safe zone instead of clipping the
     ears. A full-bleed "any" icon must never be declared maskable.
   · apple-touch-icon.png 180px, opaque — iOS does not composite transparency. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const src = 'data:image/png;base64,' +
  fs.readFileSync(path.join(ROOT, 'icons', 'icon-512x512.png')).toString('base64');

/* The source mark is drawn on opaque white. For the maskable variant the white
   has to come off, or the brand gradient ends up framing a white square. The
   cream on the fox's face is well below this threshold, so it survives. */
const doc = (size, opts) => `
<style>
  html,body{margin:0;padding:0}
  .c{width:${size}px;height:${size}px;display:grid;place-items:center;background:${opts.bg}}
  .c canvas,.c img{width:${opts.scale}%;height:${opts.scale}%;object-fit:contain}
</style>
<div class="c"><img id="m" src="${src}"></div>
<script>
  const knockout = ${opts.knockout};
  const img = document.getElementById('m');
  window.ready = new Promise(res => {
    const go = () => {
      if (!knockout) return res();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] >= 248 && px[i+1] >= 248 && px[i+2] >= 248) px[i+3] = 0;
      }
      g.putImageData(d, 0, 0);
      img.replaceWith(c);
      document.querySelector('.c').appendChild(c);
      res();
    };
    if (img.complete) go(); else img.onload = go;
  });
</script>`;

const GRADIENT = 'linear-gradient(160deg,#2f27ce,#433bff)';
const JOBS = [
  { name: 'icon-maskable-192x192.png', size: 192, scale: 74, bg: GRADIENT, knockout: true },
  { name: 'icon-maskable-512x512.png', size: 512, scale: 74, bg: GRADIENT, knockout: true },
  { name: 'apple-touch-icon.png', size: 180, scale: 100, bg: '#ffffff', knockout: false }
];

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  for (const job of JOBS) {
    const ctx = await b.newContext({ viewport: { width: job.size, height: job.size }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.setContent(doc(job.size, job));
    await p.evaluate(() => window.ready);
    await p.waitForTimeout(150);
    await p.locator('.c').screenshot({ path: path.join(ROOT, 'icons', job.name) });
    console.log('  wrote icons/' + job.name);
    await ctx.close();
  }
  await b.close();
})();
