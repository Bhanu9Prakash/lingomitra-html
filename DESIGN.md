# LingoMitra — design system & component provenance

Every UI component in this app is an implementation or adaptation of one of the
approved sources below. Nothing here is a home-grown design-system component.
Keep this table current: if you add UI, add the row first.

## Sources used

| Source | Role here |
| --- | --- |
| [Watermelon UI](https://ui.watermelon.sh/) | Primary production interface layer — controls, navigation, dialogs, feedback, data display |
| [Kokonut UI](https://kokonutui.com/) | Control surfaces, micro-labels, dropdown and loading treatments |
| [Motion Primitives](https://motion-primitives.com/) | Component-level transitions, text reveal, disclosure, scroll progress |
| [Motion](https://motion.dev/) | The only animation runtime (`vendor/motion.min.js`, MIT). All orchestration lives in `js/motion-fx.js` |
| [Haikei](https://haikei.app/) | The blurry-gradient backdrop on the home screen (inline SVG in `index.html`) |
| [Refero](https://styles.refero.design/) | Benchmark for reader layout, density and hierarchy — no code taken |
| [Realtime Colors](https://www.realtimecolors.com/?colors=050315-fbfbfe-2f27ce-dedcff-433bff&fonts=Inter-Inter) | Palette and typeface |

Two approved sources were evaluated and deliberately not used:

- **Bklit** is a charts and data-visualisation library. This product has no data
  visualisation; the only quantity shown is course progress, which is a
  Watermelon `progress` meter.
- **Componentry** is built on three.js, GSAP and Lenis for 3D and WebGL-driven
  effects. Those work against a calm, text-dense reading product and would add
  a second animation runtime alongside Motion.
- **React Spring** is React-only. This app is Vue 3 with no build step, so it
  cannot be used. Where spring physics genuinely help — the scroll island
  resizing, the command palette opening, the pager's text swap — Motion's own
  spring transitions do the work, with the source components' spring constants
  carried over verbatim.

## Colour

Realtime Colors, applied directly. Dark is the default; light is the same
palette inverted. No other colour families except the functional
success / warning / danger states.

| Token | Dark | Light |
| --- | --- | --- |
| `--bg` | `#050315` | `#fbfbfe` |
| `--fg` | `#fbfbfe` | `#050315` |
| `--primary` | `#2f27ce` | `#2f27ce` |
| `--secondary` | `#dedcff` | `#dedcff` |
| `--accent` | `#433bff` | `#433bff` |

Typeface: **Inter Variable**, self-hosted in `fonts/` (SIL OFL) with optical
sizing on, so the first paint never waits on a third party and the PWA renders
correctly offline.

## Existing UI → replacement → source

| Was | Is now | Source |
| --- | --- | --- |
| `.primary-btn` / `.secondary-btn` / `.language-btn` | `.btn` with `--primary` / `--outline` / `--secondary` / `--ghost` variants and `--sm` size | Watermelon UI · `button` |
| `.badge` (orange pill) | `.badge` with `--accent` / `--success` | Watermelon UI · `badge` |
| `.language-card` grid of bordered cards | `.lang-grid` — one panel of hairline-divided rows | Watermelon UI · `option-list` |
| `.language-dropdown` in the header | `.lang-switch` + `.menu` | Watermelon UI · `dropdown-menu`, Kokonut UI · `profile-dropdown` |
| `.floating-lesson-header` + `.lesson-selection-modal` | `.island` — progress ring, percentage, expandable section index | Watermelon UI · `scroll-island` |
| (nothing) lesson list was modal-only | `.rail` — persistent lesson rail with completion state | Watermelon UI · `macos-sidebar` |
| (nothing) no search existed | `.cmd` command palette on ⌘K / Ctrl K / `/` | Watermelon UI · `command-search` |
| (nothing) mobile had the same modal | `.sheet` bottom sheet | Watermelon UI · `sheet` |
| `.theme-toggle` (rotating icon) | `.icon-btn` + `.tip` | Watermelon UI · `button` (icon size), `tooltip` |
| `.lesson-navigation` prev/next buttons | `.pager` — round chevrons, animated destination title | Watermelon UI · `step-pager` |
| `.spinner` + "Loading lesson content..." | `.skeleton` blocks + shimmering label | Watermelon UI · `skeleton`, `spinner`; Motion Primitives · `text-shimmer` |
| `.error-message` / `.coming-soon` / `.placeholder-content` | `.state` blocks | Watermelon UI · `alert` composition |
| `.table-container` | `.table-wrap` with an edge fade when a table is wider than its column | Watermelon UI · `table`, `scroll-fade` |
| `.thinking-point` (💡 blockquote) | `.thinking` callout, now applied to **every** labelled blockquote, not just "Thinking Point" | Watermelon UI · `alert` |
| `.practice-answers` (always visible) | `.answers` — a disclosure, **collapsed by default** | Motion Primitives · `disclosure` |
| (nothing) no reading progress | `.scroll-progress` bar + the island's progress ring | Motion Primitives · `scroll-progress` |
| (nothing) exercises were read, not done | `.practice` — elicit, attempt, check, hear | Watermelon UI · `input`, `labeled-progress-indicator`, `alert`, `audio-player` transport |
| (nothing) no voice input | `.mic` + `.listening` waveform | Kokonut UI · `ai-voice` |
| (nothing) no answer feedback | `.verdict` + `.compare` | Watermelon UI · `alert`, `inline-toast` |
| (nothing) no conversation | `.talk` / `.turn` / `.turn__bubble` — tutor left, learner right, gloss under the sentence | Watermelon UI · `contextual-ai-bar` (round transport), Kokonut UI · `ai-chat` bubble |
| (nothing) nothing to type into | `.composer` — one field, mic, send | Kokonut UI · `ai-prompt` |
| (nothing) no voice state in chat | `.mic-big` + `.composer__hint` wave | Watermelon UI · `voice-chat-disclosure` |
| (nothing) waiting had no shape | `.thinking-dots` | Kokonut UI · `ai-loading` |
| (nothing) nothing to choose | `.scenario` / `.scenarios`, `.presets` | Watermelon UI · `select-ai-agent` (pressed pill) |
| (nothing) no settings screen | `.setup`, `.field`, `.field__select`, `.notice` | Watermelon UI · `input`, `select`, `alert` |
| (nothing) practice could not defer | `.second` — a dashed second opinion inside the verdict | Watermelon UI · `alert` (dashed variant) |
| `.hero-image` floating Font Awesome circles | `.backdrop` blurry-gradient SVG | Haikei · blurry gradient |
| `.hero h2` static headline | `.text-effect` word-by-word reveal | Motion Primitives · `text-effect` (`fade-in-blur`) |
| Font Awesome CDN (~75 KB for 10 icons) | inline SVG sprite in `index.html` | Lucide geometry, as used by every approved source |
| Nunito | Inter Variable | Realtime Colors |

## Animation

`js/motion-fx.js` is the only place animation is written. Every helper names the
component it implements and the spring constants come from that component:

| Helper | Implements | Transition |
| --- | --- | --- |
| `textEffect` | Motion Primitives · `text-effect` | 0.5 s, `fade-in-blur`, 0.05 s word stagger |
| `revealGroup` | Motion Primitives · `in-view` + `animated-group` | 0.42 s, 0.035 s stagger |
| `scrollBar` | Motion Primitives · `scroll-progress` | bound to document scroll |
| `islandResize` | Watermelon UI · `scroll-island` | spring, bounce 0.2, 0.7 s (FLIP) |
| `morphIn` | Watermelon UI · `command-search` | spring 280 / 25 / 0.8, from the trigger's rect |
| `sheetIn` | Watermelon UI · `sheet` | spring, bounce 0.12, 0.5 s |
| `menuIn` | Kokonut UI · `profile-dropdown` | 0.16 s |
| `swapText` | Watermelon UI · `step-pager` (AnimatedText) | spring 240 / 16 / 1.2, 0.014 s char stagger |

Everything is disabled under `prefers-reduced-motion: reduce`, in both CSS and
`fx.reduced()`.

## Mobile and PWA

The app is installable and works offline. Things worth not breaking:

- **Safe areas.** `viewport-fit=cover` plus a translucent iOS status bar means
  the web view runs *under* the notch, so the topbar pays the inset back with
  `padding-top: env(safe-area-inset-top)` and its height grows to match.
  The island, sheet and practice screen do the same at the bottom for the home
  indicator. Verified by emulating a 59px/34px inset through CDP.
- **`100dvh`, not `100vh`.** On phones the address bar makes `100vh` taller than
  what you can see. Every full-height shell sets `100vh` first as a fallback and
  `100dvh` after it.
- **16px minimum on inputs.** iOS zooms the whole page when a focused input is
  smaller, which is why `.cmd__input` is `1rem` and not `0.9375rem`.
- **44px touch targets.** Under `@media (hover: none) and (pointer: coarse)` the
  hit boxes grow while the painted controls stay the same size. The heading
  anchor link is hover-only, so it is hidden on touch rather than left as an
  11px target.
- **Icons.** A full-bleed icon must never be declared `maskable` — Android crops
  to a circle and clips it. `icon-*.png` are `any`; `icon-maskable-*.png` put the
  same mark at 74% on the brand gradient, inside the safe zone.
- **Relative paths everywhere.** `index.html`, `manifest.json` and
  `service-worker.js` reference each other and their assets relatively, so the
  app installs and works offline from a domain root *and* from a subdirectory.
  A root-absolute path costs nothing at the root and silently breaks the
  manifest and worker registration at a subpath, which is the harder case to
  notice. `manifest.json` therefore carries no `id`: `id` resolves against the
  origin rather than the manifest URL, so a relative one is not the fix —
  omitting it defaults the identity to `start_url`, which is right either way.
- **Screenshots** in the manifest are what make Chrome on Android show its
  richer install dialog, so they are part of setup, not marketing. Regenerate
  them after visible UI changes with `node tools/make-screenshots.js`.

## Architecture

Presentation, content and behaviour are separate so the visual layer can be
replaced again without touching parsing or state:

- `styles.css` — tokens and the component layer. No component here was invented.
- `index.html` — page composition and the icon sprite.
- `js/content.js` — markdown → lesson model. Pure; no app state, no live DOM.
- `js/motion-fx.js` — the animation layer.
- `script.js` — state, hash routing, storage, wiring.

## Practice

`js/practice.js` turns the exercises already written into the courses into
checkable items and checks an attempt against them. It is pure — no DOM, no app
state, no network — and runs under Node so extraction is measured against the
real course files rather than assumed:

```sh
node tools/practice-report.js    # extraction coverage per course
node tools/practice-test.js      # checker behaviour
```

`js/speech.js` wraps the browser's own Web Speech API for reading a sentence
aloud and for answering by voice. No model, no download.

**The rules this feature follows, and why, are in [PEDAGOGY.md](PEDAGOGY.md).**
Read it before adding anything that responds to a learner — in particular before
adding the on-device model layer, which has a brief there.

## Note on AI

Every practice prompt and answer is authored — 1,628 of them, extracted from the
course markdown. Nothing on the practice screen is generated, and the
deterministic checker in `js/practice.js` never calls a model.

On top of that sits an **opt-in** conversation tier (`js/tutor.js` transport,
`js/coach.js` pedagogy). It is off until the learner points it at a model, and
the app is fully usable without it — lessons, practice, voice and offline all
work with no model configured. Two surfaces use it:

* `#/<language>/talk` — a conversation partner held to lessons 1..N.
* A second opinion inside practice, offered only where the deterministic checker
  withheld judgement.

`PEDAGOGY.md` sets out what the model may and may not do. Two design rules that
show up in the UI: the key notice appears **before** the key field, not after
it; and a model running on the learner's own machine is labelled as such, in
green, because it is a materially different privacy story from a hosted one.
