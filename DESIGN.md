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

## Architecture

Presentation, content and behaviour are separate so the visual layer can be
replaced again without touching parsing or state:

- `styles.css` — tokens and the component layer. No component here was invented.
- `index.html` — page composition and the icon sprite.
- `js/content.js` — markdown → lesson model. Pure; no app state, no live DOM.
- `js/motion-fx.js` — the animation layer.
- `script.js` — state, hash routing, storage, wiring.

## Note on AI and voice

This product has no AI, chat, voice or microphone surface, so the AI/chat part
of the redesign brief does not apply. No such interface was invented, because
adding non-functional chat UI would be worse than having none.
