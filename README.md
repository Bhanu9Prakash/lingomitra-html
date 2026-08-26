# LingoMitra

LingoMitra teaches languages through the patterns behind them rather than
flashcards — how verbs bend, how word order shifts, why a sound changes.

Seven courses, ~200 lessons, no account, works offline.
<https://lingomitra.com/>

## Languages

German · Spanish · French · Hindi · Chinese · Japanese · Kannada

## What the app does

- **Reader** — a persistent lesson rail, a measure-constrained prose column, and
  a floating index that tracks reading progress and jumps between sections.
- **Search** — ⌘K / Ctrl K (or `/`) opens a command palette over every lesson in
  the current course, and switches language.
- **Linkable lessons** — `#/german/12` is a real address; the back button works.
- **Progress** — the lesson you were last on and the ones you've marked read are
  kept in `localStorage`; the home screen offers to resume.
- **Practice** — build the lesson's sentences yourself instead of reading them.
  Type or speak an answer, get a specific read on how it differs from the
  course's, and hear the sentence spoken. 1,600+ exercises across the seven
  courses, all authored — nothing is generated. Romanised answers count, so it
  works on a phone with no Indic or CJK keyboard.
- **Answer keys stay closed** until you ask for them, so practice exercises are
  worth attempting.
- **Keyboard** — ← / → move between lessons, Esc closes any overlay.
- **Themes** — dark by default, light on request, system preference respected on
  first visit.
- **Offline** — the app shell and every course you've opened are cached by the
  service worker. Open a course once and it stays readable with no connection;
  one you have never opened says so plainly rather than failing.
- **Installable** — a real PWA: maskable icons, install screenshots, safe-area
  handling for notched phones, and 44px touch targets throughout.

## Built with

Vue 3, [marked](https://marked.js.org/) and [Motion](https://motion.dev/), all
served from `vendor/` — no build step, no CDN on the critical path. Inter is
self-hosted in `fonts/`.

The interface is composed entirely from an approved set of design sources.
**Before changing any UI, read [DESIGN.md](DESIGN.md)** — it records the palette,
the type scale, and which source every component comes from.
**Before changing anything that responds to a learner, read
[PEDAGOGY.md](PEDAGOGY.md)** — it records what the Thinking Method is and the
rules practice follows.

## Layout

```
index.html          page composition + icon sprite
styles.css          design tokens and the component layer
script.js           state, hash routing, storage
js/content.js       markdown → lesson model (pure)
js/practice.js      exercises → checkable items, and the checker (pure)
js/speech.js        text-to-speech and voice input (Web Speech API)
js/motion-fx.js     the animation layer (Motion)
courses/*.md        lesson content
icons/ screenshots/ PWA assets (see tools/)
tools/              checks, and the PWA asset generators
vendor/             Vue, marked, Motion
fonts/              Inter Variable
```

## Checks

```sh
node tools/practice-report.js   # how many exercises extract, per course
node tools/practice-test.js     # checker behaviour
```

Regenerating PWA assets (needs `playwright` and its bundled Chromium):

```sh
node tools/make-icons.js        # maskable + apple-touch icons, from the app mark
node tools/make-screenshots.js  # manifest install screenshots
```

Run `make-screenshots.js` after any visible UI change, since the install
prompt shows them.

## Running it

Any static server works:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The service worker needs `localhost` or
HTTPS; everything else is plain files.
