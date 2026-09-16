# Expanded Course Catalogue Implementation Plan

> **For agentic workers:** Use superpowers:dispatching-parallel-agents for independent course authoring and superpowers:verification-before-completion for integration. Course authors do not change shared application files.

**Goal:** Add 27 substantial Markdown foundation courses and make all 34 courses usable in the original static app.

**Architecture:** Preserve the Vue static app, Markdown parser, exercise checker, local progress and hash routes. Move language metadata to one shared catalogue consumed by the app and speech layer. Load course files on demand.

**Tech Stack:** Existing browser JavaScript, Vue, marked, CSS, service worker, Node verification scripts.

**Spec:** `docs/course-expansion-spec.md`.

## Global Constraints

- Original HTML repository only; preserve existing seven courses and user progress.
- 27 additions, 25 numbered substantive lessons each, original AI-assisted drafts with honest review status.
- Preserve native Unicode, meaningful diacritics, romanisation, root/subpath hosting and offline support.
- No dependency or framework replacement, generated runtime lessons, force-push, or separate Sites edits.
- Authors own disjoint course files; the controller owns shared code and Git operations.

### Task 1: Author language-specific course files

- [x] Read existing pedagogy, examples and practice syntax.
- [x] Author 27 independent files against the detailed authoring contract, with references and language-specific caveats.
- [x] Run the real lesson splitter and exercise extractor and inspect per-lesson results.
- [x] Review course content and author reports; repair demonstrated defects. Fluent-speaker review remains pending.

### Task 2: Integrate the expanded catalogue

**Files:** `js/languages.js`, `script.js`, `js/speech.js`, `index.html`, `styles.css`, `service-worker.js`, `flags/`, `tools/catalog-test.js`.

- [x] Add regression checks for required course IDs, assets and speech tags; run them before implementation.
- [x] Implement one catalogue with names, native names, flags, language tags and review status.
- [x] Connect catalogue to navigation and speech; preserve existing hash routes and storage keys.
- [x] Show draft status and make the larger catalogue usable with search.
- [x] Isolate native RTL text in reading and practice; preserve Indic combining marks in checking.
- [x] Update offline shell version and asset list for added scripts.
- [x] Run existing and new checks, including all 34 course-loading routes and the prior-cache upgrade regression.
- [ ] Visual desktop/mobile review remains pending: the browser environment blocked the local preview. DOM checks do not replace it.

### Task 3: Document and deliver

**Files:** `README.md`, `PEDAGOGY.md`, course manifest/documentation and Git changes.

- [x] Update catalogue and factual content/review claims in documentation.
- [x] Verify every course loads and every new lesson has extractable practice; report actual counts.
- [x] Review the application diff and repair the review's course-switch, conversation-cancellation and cache-upgrade findings.

Delivery uses a GitHub Git-data transaction with blob hashes and the complete
tree checked against the local Git index, followed by a non-forced branch update.
The final response supplies the resulting commit link and review limitations.

## Verification result

The completed catalogue has 34 languages, 884 numbered lessons and 4,778 extracted
practice items. The 27 additions supply 675 lessons and 3,150 items. Practice tests
pass 37 cases; coach tests pass 14. Catalogue, all-course DOM, prior-cache upgrade,
session-boundary and offline migration/rollback checks pass. The original seven
course files remain byte-for-byte identical to the parent revision.
