/* =============================================================================
   practice — turns the exercises already written into the courses into
   checkable items, and checks an attempt against them.

   Pure: no DOM, no app state, no network. Runs in the browser and under Node
   (see tools/practice-report.js) so extraction can be measured against the real
   course files rather than assumed.

   Pedagogy: nothing here generates language. Every prompt and every reference
   answer was written by the course author. The checker's job is to describe the
   difference between what the learner produced and what the course says — never
   to invent a correction, and never to call a learner wrong on its own
   authority.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.practice = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── Extraction ───────────────────────────────────────────────────────── */

  var ANSWER_MARKER = /^\s*\*{2,3}\s*(?:Practice\s+)?Answers?\b[^\n]*?\*{2,3}\s*$/i;
  var TOP_ITEM = /^(\s*)(\d+)[.)]\s+(.*)$/;
  var SUB_ITEM = /^(\s+)(?:[a-z][.)]|[-*•])\s+(.*)$/i;
  var HEADING = /^#{1,6}\s/;
  var RULE = /^\s*(?:-{3,}|\*{3,})\s*$/;

  function clean(s) {
    return String(s).replace(/\s+/g, ' ').trim();
  }

  function strip(s) {
    return clean(String(s).replace(/^[*_`]+|[*_`]+$/g, '').replace(/`/g, ''));
  }

  /* A practice block is either flat (numbered items are the leaves) or one
     level deep (numbered groups whose sub-items are the leaves). Both shapes
     appear across the seven courses, and the answer key mirrors the prompt. */
  function parseList(lines) {
    var groups = [];
    var current = null;
    var blankSeen = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) { blankSeen = true; continue; }

      var top = TOP_ITEM.exec(line);
      if (top && top[1].length <= 3) {
        current = { label: clean(top[3]), leaves: [] };
        groups.push(current);
        blankSeen = false;
        continue;
      }

      var sub = SUB_ITEM.exec(line);
      if (sub && current) {
        current.leaves.push(clean(sub[2]));
        blankSeen = false;
        continue;
      }

      /* A flush-left paragraph after a blank line ends the list — it is the
         lesson's closing note, not a continuation of the last answer. Before
         the first item it is just preamble, so skip it instead. */
      if (blankSeen && !/^\s/.test(line)) {
        if (current) break;
        continue;
      }

      if (current) {
        var tail = line.trim();
        if (current.leaves.length) {
          current.leaves[current.leaves.length - 1] += ' ' + tail;
        } else {
          current.label += ' ' + tail;
        }
      }
    }

    var out = [];
    groups.forEach(function (g) {
      if (g.leaves.length) {
        g.leaves.forEach(function (leaf) { out.push({ group: g.label, text: leaf }); });
      } else if (g.label) {
        out.push({ group: null, text: g.label });
      }
    });
    return out;
  }

  /* The last list before the answer marker, plus the sentence introducing it. */
  function promptLines(before) {
    var lines = before.split('\n');
    var end = lines.length;
    while (end > 0 && !TOP_ITEM.test(lines[end - 1]) && !SUB_ITEM.test(lines[end - 1])) end--;
    if (!end) return { lines: [], instruction: '' };

    var start = end;
    while (start > 0) {
      var line = lines[start - 1];
      if (HEADING.test(line) || RULE.test(line)) break;
      if (!line.trim()) {
        var prev = lines[start - 2];
        if (prev === undefined || (!TOP_ITEM.test(prev) && !SUB_ITEM.test(prev) && !prev.trim())) break;
      }
      start--;
    }

    var instruction = '';
    for (var i = start - 1; i >= 0 && i > start - 8; i--) {
      var l = lines[i].trim();
      if (!l || RULE.test(l)) continue;
      if (HEADING.test(l)) break;
      if (/^[-*•]|^\d+[.)]/.test(l)) continue;
      instruction = strip(l);
      break;
    }
    return { lines: lines.slice(start, end), instruction: instruction };
  }

  function answerLines(after) {
    var lines = after.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      if (RULE.test(lines[i]) || HEADING.test(lines[i])) break;
      out.push(lines[i]);
    }
    return out;
  }

  /* ── Reading an answer ────────────────────────────────────────────────────
     Answers are written for a human reader, not a parser. Across the courses
     they appear as, among others:
       *Wir wohnen in Hamburg.*
       `mainkhush` - `Main khush hoon.`      (Devanagari, then romanisation)
       ...(*Watashi wa hon o yomimasu.*)     (kana/kanji, then romanisation)
       ... -> ...  (*nomimasu*)              (conjugation drill)
     We want the string the learner should produce, plus the romanisation when
     one is given: on a phone with no Indic or CJK keyboard, typing the
     romanisation has to count. */

  /* Latin letters, digits, spaces and punctuation only — i.e. no other script. */
  var ROMAN_ONLY = /^[ -ɏḀ-ỿ -⁯‘’“”\s]+$/;

  function isRoman(s) { return ROMAN_ONLY.test(s); }

  function readAnswer(raw) {
    /* Outer emphasis has to come off first: a wrapping "*...*" would otherwise
       hide the trailing "(romanisation)" from the pattern below. */
    var text = clean(raw).replace(/^[*_]+/, '').replace(/[*_]+$/, '');

    /* Conjugation drills — only what follows the arrow is the answer. */
    var arrow = text.split(/\s*(?:→|->|⇒)\s*/);
    if (arrow.length > 1) text = clean(arrow[arrow.length - 1]);

    /* Drop a leading gloss label such as "Negative:" or "Translations:". */
    text = text.replace(/^[A-Z][A-Za-z\/ ]{0,22}:\s+/, '');

    /* `script` - `romanisation` */
    var ticks = text.match(/`([^`]+)`/g);
    if (ticks && ticks.length >= 2) {
      var a = ticks[0].slice(1, -1), b = ticks[1].slice(1, -1);
      if (!isRoman(a) && isRoman(b)) return { answer: clean(a), roman: clean(b) };
    }

    /* trailing (romanisation) or (*romanisation*) */
    var paren = text.match(/^(.*?)\s*[(（]\s*\*?([^()（）*]+?)\*?\s*[)）]\s*$/);
    if (paren) {
      var head = clean(paren[1]), tail = clean(paren[2]);
      if (head && !isRoman(head) && isRoman(tail)) {
        return { answer: strip(head), roman: strip(tail) };
      }
      /* A parenthetical on a Latin-script answer is a gloss, not a reading. */
      if (head && isRoman(head) && /[a-z]/i.test(head)) text = head;
    }

    return { answer: strip(text), roman: null };
  }

  /* The parenthetical on a prompt is a hint the author supplied. */
  function readPrompt(raw) {
    var text = clean(raw);
    var hint = null;
    var m = text.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (m && m[2].length > 2) {
      text = clean(m[1]);
      /* Hints carry inline emphasis around pronunciation guides; the markers
         are noise once the hint is rendered as plain text. */
      hint = clean(strip(m[2]).replace(/\*/g, ''));
    }
    return { prompt: strip(text), hint: hint };
  }

  /* ── Public: every checkable item in one lesson ───────────────────────── */
  function extract(lesson) {
    if (!lesson || !lesson.content) return [];
    var lines = lesson.content.split('\n');
    var items = [];

    for (var i = 0; i < lines.length; i++) {
      if (!ANSWER_MARKER.test(lines[i])) continue;

      var p = promptLines(lines.slice(0, i).join('\n'));
      var prompts = parseList(p.lines);
      var answers = parseList(answerLines(lines.slice(i + 1).join('\n')));

      if (!prompts.length || prompts.length !== answers.length) continue;

      prompts.forEach(function (pr, idx) {
        var a = readAnswer(answers[idx].text);
        var q = readPrompt(pr.text);
        if (!a.answer || !q.prompt) return;
        if (a.answer.length > 160 || q.prompt.length > 160) return;
        items.push({
          id: lesson.id + '-p' + items.length,
          lessonId: lesson.id,
          lessonNumber: lesson.number,
          instruction: pr.group || p.instruction || '',
          prompt: q.prompt,
          hint: q.hint,
          answer: a.answer,
          roman: a.roman
        });
      });
    }
    return items;
  }

  /* ── Checking an attempt ──────────────────────────────────────────────────
     Deterministic and explainable. It reports *how* the attempt differs from
     the course's answer and never asserts more than it can prove:

       match      identical once punctuation and spacing are normalised
       case       same letters, different capitalisation (matters in German)
       accents    same letters once diacritics are folded (ü/ö/ä, á/é, ñ)
       order      same words, different sequence
       near       one word differs
       differs    anything else — both are shown, aligned, with no verdict

     "differs" deliberately does not say "wrong". The courses list one answer;
     a learner may well have produced another valid one. Saying so is honest,
     and it is the line an on-device model would later be asked to adjudicate. */

  var PUNCT = /[.,!?;:¿¡"'“”‘’()（）。、！？，；：]/g;

  function normalise(s) {
    return String(s)
      .replace(PUNCT, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function fold(s) {
    var t = String(s).toLowerCase();
    if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t;
  }

  function words(s) {
    return normalise(s).split(' ').filter(Boolean);
  }

  /* A parenthesised element in a reference answer is optional — Spanish
     "(Yo) cocino" is correct with or without the pronoun. */
  function variants(answer) {
    var out = [answer];
    if (/[(（]/.test(answer)) {
      /* Dropping "(Yo)" makes the next word sentence-initial, so it is
         capitalised in a correct answer. */
      out.push(capitalise(answer.replace(/[(（][^()（）]*[)）]/g, ' ')));
      out.push(answer.replace(/[(（]|[)）]/g, ''));
    }
    return out.map(clean).filter(Boolean);
  }

  function capitalise(s) {
    var t = clean(s);
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }

  function sameMultiset(a, b) {
    if (a.length !== b.length) return false;
    var pool = b.slice();
    return a.every(function (w) {
      var i = pool.indexOf(w);
      if (i < 0) return false;
      pool.splice(i, 1);
      return true;
    });
  }

  function compareOne(attempt, target) {
    var an = normalise(attempt), tn = normalise(target);
    if (!an) return null;

    if (an === tn) return { result: 'match' };
    if (an.toLowerCase() === tn.toLowerCase()) return { result: 'case' };
    if (fold(an) === fold(tn)) return { result: 'accents' };

    var aw = words(an).map(fold), tw = words(tn).map(fold);
    if (aw.join(' ') === tw.join(' ')) return { result: 'accents' };
    if (sameMultiset(aw, tw)) return { result: 'order' };

    if (aw.length === tw.length) {
      var diff = [];
      for (var i = 0; i < aw.length; i++) if (aw[i] !== tw[i]) diff.push(i);
      if (diff.length === 1) {
        return {
          result: 'near',
          at: diff[0],
          gave: words(an)[diff[0]],
          expected: words(tn)[diff[0]]
        };
      }
    }

    /* How much of the answer did they get? Used only to order candidates. */
    var hit = 0, pool = tw.slice();
    aw.forEach(function (w) {
      var i = pool.indexOf(w);
      if (i >= 0) { pool.splice(i, 1); hit++; }
    });
    return { result: 'differs', overlap: tw.length ? hit / tw.length : 0 };
  }

  var RANK = { match: 0, case: 1, accents: 2, order: 3, near: 4, differs: 5 };

  /* Checks against the answer, its optional-element variants, and the
     romanisation — typing "naanu kaafi kuDiyutteene" on a phone with no Kannada
     keyboard is a correct answer, not a failure. */
  function check(attempt, item) {
    if (!item) return null;
    if (!normalise(attempt)) return { result: 'empty' };

    var best = null;
    var targets = [];

    variants(item.answer).forEach(function (v) { targets.push({ text: v, via: 'answer' }); });
    if (item.roman) {
      variants(item.roman).forEach(function (v) { targets.push({ text: v, via: 'roman' }); });
    }
    (item.alts || []).forEach(function (v) { targets.push({ text: v, via: 'alt' }); });

    targets.forEach(function (t) {
      var got = compareOne(attempt, t.text);
      if (!got) return;
      got.via = t.via;
      got.target = t.text;
      if (!best ||
        RANK[got.result] < RANK[best.result] ||
        (got.result === 'differs' && best.result === 'differs' && got.overlap > best.overlap)) {
        best = got;
      }
    });

    if (!best) best = { result: 'differs', overlap: 0, via: 'answer', target: item.answer };

    /* Three states, not two. "close" is deliberately not a verdict: reordering
       can be perfectly good grammar (German fronts an adverbial and the verb
       stays second), and a one-word difference may be a synonym the course did
       not list. Those get shown side by side and left to the learner, which is
       also the boundary an on-device model would later be asked to judge. */
    best.status = RANK[best.result] <= RANK.accents ? 'correct'
      : (best.result === 'order' || best.result === 'near') ? 'close'
        : 'different';
    best.correct = best.status === 'correct';
    return best;
  }

  /* ── Session building ─────────────────────────────────────────────────────
     Language Transfer's recombination: practice for lesson N draws on
     everything up to N, weighted towards the newest material, so earlier
     structures keep being re-derived rather than left behind. */
  function session(itemsByLesson, upToNumber, size) {
    size = size || 8;
    var recent = [], older = [];

    Object.keys(itemsByLesson).forEach(function (id) {
      itemsByLesson[id].forEach(function (item) {
        if (item.lessonNumber > upToNumber) return;
        (item.lessonNumber >= upToNumber - 1 ? recent : older).push(item);
      });
    });

    /* Roughly two thirds from the last two lessons, the rest recycled. */
    var wantRecent = Math.min(recent.length, Math.ceil(size * 0.65));
    var picked = shuffle(recent).slice(0, wantRecent);
    picked = picked.concat(shuffle(older).slice(0, size - picked.length));
    if (picked.length < size) {
      picked = picked.concat(shuffle(recent).slice(wantRecent, wantRecent + size - picked.length));
    }
    return shuffle(picked);
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  return {
    extract: extract,
    check: check,
    session: session,
    normalise: normalise,
    _readAnswer: readAnswer,
    _readPrompt: readPrompt,
    _parseList: parseList,
    _variants: variants
  };
});
