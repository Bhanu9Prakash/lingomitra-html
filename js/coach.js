/* =============================================================================
   coach — the pedagogy layer for the conversation tier.

   This is where the Thinking Method is enforced. js/tutor.js moves messages;
   this decides what the tutor is allowed to say. The rules come from
   PEDAGOGY.md and they are not negotiable by the model:

     · Nothing beyond lessons 1..N. The syllabus digest below is built from the
       course itself, so "what the learner knows" is a fact, not a guess.
     · The tutor converses and adjudicates. It never teaches new grammar —
       explanation belongs to the authored lesson.
     · It elicits before it tells, and it does not hand over the answer.
     · When the course and the model disagree, the course wins.

   Pure: builds strings, holds no state, touches no DOM.
   ========================================================================== */

(function (global) {
  'use strict';

  /* Keeps the prompt bounded on a 39-lesson course while still giving the model
     enough to stay inside the syllabus. */
  var MAX_SENTENCES = 60;
  var MAX_TOPICS = 40;

  function clean(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  /* ── What has been covered ────────────────────────────────────────────────
     Lesson titles give the shape of the syllabus; the authored practice pairs
     are the most precise statement available of what the learner can actually
     say, because they are exactly the sentences the course asked them to build. */
  function syllabus(lessons, itemsByLesson, upTo) {
    var covered = lessons.filter(function (l) { return l.number <= upTo; });

    var topics = covered.map(function (l) {
      return l.number ? l.number + '. ' + l.title : l.title;
    });

    var sentences = [];
    covered.forEach(function (l) {
      (itemsByLesson[l.id] || []).forEach(function (item) {
        sentences.push({ n: l.number, en: item.prompt, target: item.answer, roman: item.roman });
      });
    });

    /* Prefer the newest material — that is what the learner is consolidating. */
    sentences.sort(function (a, b) { return b.n - a.n; });

    return {
      topics: topics.slice(-MAX_TOPICS),
      sentences: sentences.slice(0, MAX_SENTENCES),
      lessonCount: covered.length,
      furthest: upTo
    };
  }

  function renderSyllabus(digest, languageName) {
    var lines = [];
    lines.push('COVERED SO FAR (' + digest.lessonCount + ' lessons of ' + languageName + '):');
    digest.topics.forEach(function (t) { lines.push('  ' + t); });

    if (digest.sentences.length) {
      lines.push('');
      lines.push('SENTENCES THE LEARNER HAS BEEN ASKED TO BUILD.');
      lines.push('This is the ceiling of what they have met. Do not go past it.');
      digest.sentences.forEach(function (s) {
        lines.push('  ' + s.target + (s.roman ? '  [' + s.roman + ']' : '') + '  = ' + s.en);
      });
    }
    return lines.join('\n');
  }

  /* ── Conversation ─────────────────────────────────────────────────────── */
  function conversationPrompt(opts) {
    var digest = syllabus(opts.lessons, opts.itemsByLesson, opts.upTo);
    var lang = opts.languageName;

    return [
      'You are a patient conversation partner helping someone practise ' + lang + '.',
      'They are learning through the Thinking Method: they work structures out for',
      'themselves rather than memorising them. Your job is to give them something',
      'real to say — not to teach.',
      '',
      'HARD RULES',
      '1. Stay inside what the course has covered. Use only the structures and',
      '   vocabulary implied by the list below. If you want a word they have not',
      '   met, choose a different sentence instead.',
      '2. Never introduce or explain new grammar. If they ask about something the',
      '   course has not reached, say it comes later and offer to keep going.',
      '3. Never hand over the answer. If they are stuck, narrow the question or',
      '   ask a simpler one — do not translate it for them.',
      '4. Reply in ' + lang + ' first. Add a short English gloss in brackets only',
      '   when the sentence contains something new to them.',
      '5. Two sentences at most per turn. This is a conversation, not a lesson.',
      '6. When they make a mistake, reply naturally using the correct form so they',
      '   hear it, and only name the error if it repeats.',
      '',
      opts.scenario ? 'SCENARIO: ' + opts.scenario + '\n' : '',
      renderSyllabus(digest, lang),
      '',
      'Open with one short, easy question in ' + lang + '.'
    ].filter(Boolean).join('\n');
  }

  /* Scenarios are written from the syllabus rather than invented, so an early
     learner is not dropped into a conversation they cannot have. */
  var SCENARIOS = [
    { id: 'meet', minLesson: 1, label: 'Meeting someone', brief: 'You have just met. Ask their name, where they live, what they do.' },
    { id: 'day', minLesson: 3, label: 'Your day', brief: 'Ask what they do each day, when, and with whom.' },
    { id: 'order', minLesson: 5, label: 'Ordering something', brief: 'You work in a cafe. Take their order, ask how many, say the price.' },
    { id: 'plans', minLesson: 7, label: 'Making plans', brief: 'Work out something to do together — what, when, where.' },
    { id: 'past', minLesson: 10, label: 'What you did', brief: 'Ask about yesterday and last week. Keep it to what they can say.' },
    { id: 'free', minLesson: 1, label: 'Anything', brief: '' }
  ];

  function scenariosFor(upTo) {
    return SCENARIOS.filter(function (s) { return s.minLesson <= upTo; });
  }

  /* ── Second opinion on a practice answer ──────────────────────────────────
     The deterministic checker in js/practice.js already handles exact, case and
     accent differences. It calls this only for "close" and "different", where a
     learner may well have produced another good sentence and the course simply
     lists one. The model gets the reference answer, so this is a comparison —
     not a translation it has to invent. That distinction is what makes it
     usable at all on a small local model. */
  function verdictPrompt(opts) {
    return [
      'You are checking one sentence a ' + opts.languageName + ' learner wrote.',
      '',
      'Task they were given (in English): ' + clean(opts.prompt),
      'The course\'s answer: ' + clean(opts.answer),
      'What the learner wrote: ' + clean(opts.attempt),
      '',
      'Decide whether the learner\'s sentence is an acceptable way to say the same',
      'thing. Word order, an omitted optional pronoun, or a synonym can all be fine.',
      '',
      'Answer in exactly two lines:',
      'VERDICT: acceptable | not-acceptable',
      'WHY: one sentence, addressed to the learner, under 20 words. If it is not',
      'acceptable, name the single thing to fix. Do not rewrite the sentence for them.'
    ].join('\n');
  }

  function readVerdict(text) {
    var body = String(text || '');
    var verdict = /VERDICT:\s*acceptable/i.test(body) && !/VERDICT:\s*not-acceptable/i.test(body);
    var why = (body.match(/WHY:\s*([\s\S]*)/i) || [])[1] || '';
    return {
      acceptable: verdict,
      why: clean(why).replace(/^["']|["']$/g, '').slice(0, 200)
    };
  }

  /* ── Vocabulary drill ─────────────────────────────────────────────────────
     Built from the authored sentences rather than a generated word list, so the
     words are ones the course actually used, in the forms it used them. */
  function vocabulary(lessons, itemsByLesson, upTo) {
    var seen = Object.create(null);
    var out = [];

    lessons.forEach(function (lesson) {
      if (lesson.number > upTo) return;
      (itemsByLesson[lesson.id] || []).forEach(function (item) {
        var key = clean(item.answer).toLowerCase();
        if (!key || seen[key]) return;
        seen[key] = true;
        out.push(item);
      });
    });
    return out;
  }

  global.coach = {
    syllabus: syllabus,
    conversationPrompt: conversationPrompt,
    scenariosFor: scenariosFor,
    SCENARIOS: SCENARIOS,
    verdictPrompt: verdictPrompt,
    readVerdict: readVerdict,
    vocabulary: vocabulary
  };
})(window);
