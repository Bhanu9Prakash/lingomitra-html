# Pedagogy

LingoMitra's courses are already written in the spirit of Language Transfer's
Thinking Method — they are full of "Thinking Point" and "Language Transfer
Intuition" blocks. This document records what that method actually is, where it
is weakest, and the rules the practice feature follows as a result.

**Read this before adding anything that talks back to the learner.** It is the
reason the practice engine is shaped the way it is, and it is the brief for the
on-device model layer when that gets built.

## The Thinking Method, as Language Transfer describes it

[Language Transfer](https://www.languagetransfer.org/) is Mihalis Eleftheriou's
free audio course project. Its method has a small number of load-bearing ideas:

1. **Elicit before you explain.** The teacher asks a guiding question and the
   learner constructs the answer before being told it. The approach is
   explicitly Socratic — *"invisibly leading the student by asking guiding
   questions"* so they eventually produce language by thinking for themselves.
2. **Transfer from what the learner already has.** English cognates, shared
   roots, and deconstructing English structure do most of the work. Learners are
   taught to recognise and use over a thousand words through cognate patterns
   rather than lists.
3. **No memorisation, no notes, no drills.** *"There are no other tools besides
   your mind and there's no memorization required."* Mihalis actively
   discourages writing anything down, on the grounds that it substitutes
   recording for reasoning.
4. **Small increments, immediately recombined.** One structure at a time, then
   folded straight back into everything already met.
5. **Errors are expected and designed for.** The learner hears a real student
   make real mistakes, which normalises being wrong.
6. **Active participation is the whole point.** *"If you just listen without
   participating, you will learn 'about Spanish' but not how to speak
   Spanish."*

## Where it is weakest

Reviewers converge on the same gaps, and they are worth stating plainly because
they are the openings this app can fill:

- **No feedback.** There is no way to find out whether what you said was right.
- **No speaking practice, and nothing that answers back.**
- **A passive-to-active gap.** You end up understanding the patterns without
  being able to produce under pressure.
- **No learner-initiated questions.** The only thing the student contributes is
  answers to the teacher's prompts.
- **It is a foundation, not a course.** Everyone recommends supplementing it.

Sources: [Rosano](https://rosano.ca/blog/language-transfer-the-thinking-method/),
[FluentU](https://www.fluentu.com/blog/reviews/language-transfer/),
[Lingopie](https://lingopie.com/blog/language-transfer-review/),
[Multilingual Mastery](https://multilingualmastery.com/language-transfer-review/).

## The eight rules practice follows

**1. Elicit first. The answer is never on screen before the attempt.**
The prompt appears, the learner produces, and only then does the course's answer
appear. This is the same rule the in-lesson answer key follows, and it is the
digital equivalent of Language Transfer's pause.

**2. Nothing is generated. Every prompt and answer was written by the author.**
The courses already contain 1,600+ worked exercises with answers. Practice reads
those. Because nothing is generated, nothing can be hallucinated — which matters
enormously for Kannada, where no small model is reliable.

**3. Scope to what the learner has met.** A session for lesson N draws only on
lessons 1..N, weighted about two-thirds towards the newest material. That is
Language Transfer's recombination, and it is what keeps earlier structures being
re-derived rather than left behind.

**4. Three verdicts, and only one of them is a judgement.**

| Result | Shown as | Why |
| --- | --- | --- |
| identical after normalising punctuation | **correct** | unambiguous |
| differs only in capitals | **correct**, with a note | in German the capitals carry meaning |
| differs only in diacritics | **correct**, with a note | the words were right |
| same words, different order | **close** — both shown, no verdict | reordering is often perfectly good grammar |
| one word different | **close** — both shown, no verdict | may be a synonym the course did not list |
| anything else | **different** — both shown, no verdict | the course gives one answer; another may also be right |

The checker never says "wrong". It says what the course has, and what the learner
wrote, and lets them compare. Asserting more than it can prove would be worse
than saying nothing.

**5. Romanisation counts as a correct answer.** A Kannada or Hindi learner on a
phone with no Indic keyboard must be able to answer. Typing the romanisation is
accepted, with a note that the script is the next step rather than a requirement.
Without this the feature is unusable for a large part of the audience.

**6. No scores, no streaks, no XP.** The method is explicitly a reaction against
conditioning; a points economy would be exactly that. The session summary gives a
count and a list to compare again, and stops there.

**7. Speaking is for production, not for pronunciation scoring.** Browser speech
recognition is dialect-biased and unreliable. Voice is a way to *answer*, and
text-to-speech is a way to *hear the pattern*. There is no pronunciation grade,
because a fair one is not available.

**8. Say what the device can actually do.** Voices come from the operating
system, so coverage varies. Where there is no voice for a language, the UI says
so instead of showing a button that does nothing.

## What this means for the on-device model layer

The model is not the teacher. The course is the teacher, and it already works.
When the model layer is built it gets the jobs the checker cannot do, under the
same constraints:

- **It may adjudicate, not author.** Its question is "does this attempt say the
  same thing as this reference?" — a comparison with a known-good answer in the
  prompt, not open-ended generation. That is the difference between a task a
  1–3B model can do and one it cannot.
- **It may not explain grammar the lesson has not reached.** Explanation belongs
  to the authored course.
- **The reference answer wins any disagreement**, and the UI says so. Correction
  that is itself wrong is worse than no correction.
- **It is an enhancement, never a dependency.** Everything above works with no
  model, no download and no network. That has to stay true.
- **Kannada gets no model feedback.** No small local model handles it reliably,
  and confident nonsense aimed at Kannada learners would make the product worse
  than it is today.

## Device reality (measured, not assumed)

**Voices.** Counts from the [Readium Speech](https://github.com/readium/speech)
voice inventory, which tracks what each OS actually ships:

| Language | macOS / iOS | Windows | Android / ChromeOS |
| --- | --- | --- | --- |
| Spanish, French, Chinese, German | yes | yes | yes |
| Hindi | yes | yes | yes |
| Japanese | yes | yes | yes |
| **Kannada** | yes (1 voice) | **none** | yes (2 voices) |

So Kannada text-to-speech works on a Mac, an iPhone and an Android phone, and
not on Windows. The app probes `speechSynthesis.getVoices()` at runtime and says
which case the user is in.

**Speech recognition** is Chromium-only and, in Chrome, is *not* on-device —
audio goes to a Google service. In a product whose selling point is that it works
offline that is worth stating, so the UI labels it while listening.

**Models**, for whenever that layer lands: WebLLM needs WebGPU, which rules out
most phones today. In its prebuilt list the plausible sizes are Llama-3.2-1B
(~0.9 GB), Qwen3-1.7B (~2.0 GB), Llama-3.2-3B (~2.3 GB) and Qwen3-4B (~3.4 GB).
Llama 3.2 covers German, French, Hindi and Spanish officially; Qwen is stronger
on Chinese. None covers Kannada. On a mobile-first, bandwidth-conscious audience
a 1–3 GB download has to be opt-in, clearly labelled, and never on the path to
practising.
