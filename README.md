# LingoMitra

LingoMitra teaches languages through patterns: how verbs change, how words fit
together, and how to build a sentence yourself. No account or build step is needed.

[Website](https://lingomitra.com/) · [Course files](courses/) · [Course review notes](docs/course-review.md)

## Languages and editorial status

The catalogue contains **34 courses, 884 numbered lessons and 4,778 extracted
practice items**. This expansion adds 27 foundation drafts with 25 lessons each
(675 lessons and 3,150 practice items) alongside the seven existing courses.
It covers all 22 scheduled Indian languages plus
German, Spanish, French, Chinese, Japanese, Persian, Russian, Italian, Arabic,
Brazilian Portuguese, Korean and Turkish.

**The new courses are original AI-assisted drafts. Fluent-speaker review is
pending.** Grammar references, the chosen variety, script and romanisation
conventions are stated in each introduction. Parser checks verify that the app
can read and practise the content; they do not certify linguistic accuracy or
proficiency. See the [review notes](docs/course-review.md) for availability and
any course-format limitations. Bodo, Kashmiri, Manipuri and Santali currently
use Roman transcription; native-script lessons are pending. Santali is a
historical-source foundation, with contemporary usage review also pending.

## What the app does

- **Reader:** a lesson rail, section index, dark/light themes and collapsible
  answer keys. English explanations remain left to right while embedded scripts
  set their own direction.
- **Search:** filter the home catalogue by English name, native name or language
  code. Cmd/Ctrl K searches the current course and switches languages.
- **Stable links and progress:** hashes such as `#/german/12` and saved progress
  continue to work. Progress stays in the browser's local storage.
- **Practice:** construct a sentence, then compare it with the course answer.
  Supplied romanisation is accepted. New courses preserve meaningful letters,
  tone and nasal marks; Turkish casing follows Turkish rules. Russian teaching
  stress accents may be omitted, as in ordinary spelling. A difference from
  one reference answer is not proof that a learner's alternative is wrong.
- **Optional speech:** use device voices where the course format and device
  support them. Voice input can depend on a remote browser service. Speech is
  not pronunciation scoring and is not required to read or practise.
- **Optional conversation:** configure a local model through Ollama or LM Studio,
  or a hosted provider with your own key. Prompts include the covered course
  material and ask the model to stay within it. Model output still requires
  judgment, particularly for draft courses. The rest of the app needs no model.
- **Offline use:** open a course online once to cache it. Downloaded courses
  survive app-shell updates. Caches are scoped to this installation so another
  app's data is not deleted.
- **Installable PWA:** icons, manifest, touch targets and relative paths support
  installation from a domain root or a subdirectory.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Page composition and shared styles |
| `script.js` | State, hash routes and saved progress |
| `js/languages.js` | Shared catalogue, course paths, locales and format metadata |
| `js/content.js` | Markdown lesson parsing and rendering |
| `js/practice.js` | Exercise extraction and reference comparison |
| `js/speech.js` | Device speech capabilities |
| `js/tutor.js`, `js/coach.js` | Optional model transport and course context |
| `courses/*.md` | Authored lesson content |
| `service-worker.js`, `manifest.json` | Offline behaviour and installation |
| `tools/` | Verification and PWA asset utilities |
| `vendor/`, `fonts/` | Locally served dependencies and fonts |

Vue, marked and Motion are served from `vendor/`; Inter is self-hosted.
Before editing the interface, read [DESIGN.md](DESIGN.md). Before changing
learner feedback, read [PEDAGOGY.md](PEDAGOGY.md).

## Run and verify

```sh
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000). A service worker requires localhost
or HTTPS. Serving the same directory under a subpath also works.

```sh
node tools/catalog-test.js
node tools/practice-test.js
node tools/coach-test.js
node tools/offline-test.js
node tools/practice-report.js --samples=0
```

The catalogue check requires every published course asset, sequential lesson
headings, disclosed draft status and usable exercise keys. Offline checks cover
both root and subdirectory installs, migration of downloaded lessons and cache
isolation. The report uses the app's actual lesson parser.

For DOM integration checks, install `jsdom` in your development environment and
run `node tools/dom-test.js` and `node tools/session-test.js`.
The upgrade regression is `node tools/dom-test.js --upgrade-from-v7`; it requires
the previous release in Git history. Alternatively set `LM_TEST_JSDOM` to an existing
jsdom package path. These checks execute the real Vue app, local Markdown parser
and course assets with browser I/O boundaries supplied by JSDOM. They check
routing, search, answer concealment and progress; they are not visual or actual
browser speech/service-worker tests.

`tools/make-icons.js` and `tools/make-screenshots.js` are optional asset utilities
that need Playwright and Chromium. Regenerate install screenshots after visible
UI changes before re-adding any outdated screenshot to the manifest.

## Contributing a course

Add `courses/<stable-slug>-lesson.md` and an entry in `js/languages.js`. Follow
the existing lesson and answer-key shape. Include references actually consulted,
a precise variety/script statement and an honest review status. Preserve the
old slugs because links and progress depend on them. Add new flags to the
service-worker shell list; the seven newly added international flags use
[flag-icons](https://github.com/lipis/flag-icons), under the included
[MIT licence](flags/LICENSE.flag-icons).
