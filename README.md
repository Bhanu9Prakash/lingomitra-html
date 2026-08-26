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
- **Answer keys stay closed** until you ask for them, so practice exercises are
  worth attempting.
- **Keyboard** — ← / → move between lessons, Esc closes any overlay.
- **Themes** — dark by default, light on request, system preference respected on
  first visit.
- **Offline** — the app shell and every course you've opened are cached by the
  service worker.

## Built with

Vue 3, [marked](https://marked.js.org/) and [Motion](https://motion.dev/), all
served from `vendor/` — no build step, no CDN on the critical path. Inter is
self-hosted in `fonts/`.

The interface is composed entirely from an approved set of design sources.
**Before changing any UI, read [DESIGN.md](DESIGN.md)** — it records the palette,
the type scale, and which source every component comes from.

## Layout

```
index.html          page composition + icon sprite
styles.css          design tokens and the component layer
script.js           state, hash routing, storage
js/content.js       markdown → lesson model (pure)
js/motion-fx.js     the animation layer (Motion)
courses/*.md        lesson content
vendor/             Vue, marked, Motion
fonts/              Inter Variable
```

## Running it

Any static server works:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The service worker needs `localhost` or
HTTPS; everything else is plain files.
