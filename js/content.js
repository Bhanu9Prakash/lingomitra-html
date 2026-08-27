/* =============================================================================
   content — markdown → lesson model. Pure: no DOM mutation of the live page,
   no app state, no styling decisions beyond emitting the class names the
   design system already defines. Keeping this separate is what let the entire
   visual layer be replaced without touching parsing.
   ========================================================================== */

(function (global) {
  'use strict';

  var WPM = 210;

  /* Labels that marked renders as `<p><em><strong>…</strong></em></p>` and that
     should become a collapsed answer key rather than spoilers in the flow. */
  var ANSWER_RE = /^(practice\s+)?answers?\b/i;

  function configureMarked() {
    if (typeof global.marked === 'undefined') return false;
    global.marked.setOptions({
      renderer: new global.marked.Renderer(),
      gfm: true,
      breaks: true,
      pedantic: false,
      smartLists: true,
      smartypants: false,
      xhtml: false
    });
    return true;
  }

  function slug(text, taken) {
    var base = String(text)
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 48) || 'section';
    var id = base;
    var n = 2;
    while (taken[id]) { id = base + '-' + n++; }
    taken[id] = true;
    return id;
  }

  /* Drop "Lesson 4:" / "Introduction:" prefixes — the number is already shown
     as its own element, so repeating it in the title is noise. */
  function cleanTitle(title) {
    if (!title) return '';
    return String(title)
      .replace(/^(Lesson\s+\d+\s*[:.\-–]?|Intro(?:duction)?\s*[:.\-–]?|\d+\s*[:.\-–])\s*/i, '')
      .trim();
  }

  /* ── Split a course file into lessons on H2 boundaries ────────────────── */
  function splitLessons(markdown, langCode) {
    var lessons = [];
    if (!markdown) return lessons;

    var sections = markdown.split(/(?=^##\s)/gm);
    var n = 1;

    sections.forEach(function (raw, index) {
      var section = raw.trim();
      if (!section) return;

      if (section.indexOf('## ') === 0) {
        var title = section.split('\n')[0].slice(3).trim();
        lessons.push({
          id: langCode + '-lesson-' + n,
          number: n,
          title: cleanTitle(title) || ('Lesson ' + n),
          content: section
        });
        n++;
      } else if (index === 0) {
        var m = section.match(/^#\s+(.*)/);
        lessons.push({
          id: langCode + '-intro',
          number: 0,
          title: cleanTitle(m ? m[1] : '') || 'Introduction',
          content: section
        });
      }
    });

    return lessons;
  }

  /* The lesson's own `##` title is rendered by the page header, so the `###`
     sections inside it would leave an H1 → H3 gap. Shift every heading up one
     level: sections become H2, sub-sections H3. */
  function promoteHeadings(root, doc) {
    ['h3', 'h4', 'h5'].forEach(function (tag) {
      var to = 'h' + (Number(tag.slice(1)) - 1);
      Array.prototype.forEach.call(root.querySelectorAll(tag), function (old) {
        var next = doc.createElement(to);
        while (old.firstChild) next.appendChild(old.firstChild);
        old.replaceWith(next);
      });
    });
  }

  /* ── Callouts: `> **Label** body` → an Alert (Watermelon UI · alert) ──── */
  function upgradeCallouts(root, doc) {
    Array.prototype.forEach.call(root.querySelectorAll('blockquote'), function (bq) {
      var first = bq.firstElementChild;
      if (!first || first.tagName !== 'P') return;

      var strong = first.firstElementChild;
      if (!strong || (strong.tagName !== 'STRONG' && strong.tagName !== 'EM')) return;
      if (strong.tagName === 'EM') strong = strong.firstElementChild;
      if (!strong || strong.tagName !== 'STRONG') return;

      var label = strong.textContent.replace(/[:\s]+$/, '').trim();
      if (!label) return;

      var wrap = doc.createElement('div');
      wrap.className = 'thinking';
      wrap.innerHTML =
        '<svg width="18" height="18" aria-hidden="true"><use href="#i-bulb"/></svg>' +
        '<p class="thinking__title"></p><div class="thinking__body"></div>';
      wrap.querySelector('.thinking__title').textContent = label;

      var body = wrap.querySelector('.thinking__body');
      strong.remove();
      /* `breaks: true` turns the newline after the label into a <br>. */
      while (first.firstChild && first.firstChild.nodeName === 'BR') first.firstChild.remove();
      /* Trim the separator left behind by "**Label:** rest of sentence". */
      if (first.firstChild && first.firstChild.nodeType === 3) {
        first.firstChild.nodeValue = first.firstChild.nodeValue.replace(/^[\s:–—-]+/, '');
      }
      if (!first.textContent.trim() && !first.querySelector('img,code')) first.remove();

      while (bq.firstChild) body.appendChild(bq.firstChild);
      bq.replaceWith(wrap);
    });
  }

  /* Answers are written as a numbered list, or as italic lines. A plain
     paragraph after them is the lesson's closing note, not an answer. */
  function isAnswerBlock(node) {
    if (!node) return false;
    if (node.tagName === 'OL' || node.tagName === 'UL') return true;
    if (node.tagName !== 'P') return false;
    var em = node.querySelector('em');
    return !!em && em.textContent.trim().length >= node.textContent.trim().length - 4;
  }

  /* ── Answer keys → Motion Primitives · disclosure, collapsed ──────────── */
  function collapseAnswers(root, doc) {
    var markers = Array.prototype.filter.call(root.children, function (el) {
      if (el.tagName !== 'P') return false;
      var em = el.firstElementChild;
      if (!em || em.tagName !== 'EM') return false;
      var strong = em.firstElementChild;
      if (!strong || strong.tagName !== 'STRONG') return false;
      return ANSWER_RE.test(strong.textContent.trim()) &&
        el.textContent.trim() === em.textContent.trim();
    });

    markers.forEach(function (marker) {
      var label = marker.textContent.replace(/[:\s]+$/, '').trim() || 'Answers';

      var details = doc.createElement('details');
      details.className = 'answers';
      details.innerHTML =
        '<summary><svg width="15" height="15" aria-hidden="true"><use href="#i-check-circle"/></svg>' +
        '<span class="answers__show"></span><span class="answers__hide"></span>' +
        '<svg class="chev" width="15" height="15" aria-hidden="true">' +
        '<use href="#i-chevron-down"/></svg></summary><div class="answers__body"></div>';
      details.querySelector('.answers__show').textContent = 'Show ' + label.toLowerCase();
      details.querySelector('.answers__hide').textContent = 'Hide ' + label.toLowerCase();

      var body = details.querySelector('.answers__body');

      /* The `---` immediately above the marker is now redundant: the
         disclosure is its own boundary. */
      var lead = marker.previousElementSibling;
      if (lead && lead.tagName === 'HR') lead.remove();

      marker.replaceWith(details);

      var node = details.nextElementSibling;
      while (node && isAnswerBlock(node)) {
        var next = node.nextElementSibling;
        body.appendChild(node);
        node = next;
      }
      /* The `---` that closed the answer run is redundant too. */
      if (node && node.tagName === 'HR') node.remove();

      if (!body.children.length) details.replaceWith(marker);
    });
  }

  /* ── Tables get a scroll container (Watermelon UI · table) ────────────── */
  function wrapTables(root, doc) {
    Array.prototype.forEach.call(root.querySelectorAll('table'), function (table) {
      if (table.closest('.table-wrap')) return;
      var wrap = doc.createElement('div');
      wrap.className = 'table-wrap';
      var scroll = doc.createElement('div');
      scroll.className = 'table-scroll scroll-y';
      table.replaceWith(wrap);
      wrap.appendChild(scroll);
      scroll.appendChild(table);
    });
  }

  /* ── Headings become linkable and feed the section index ─────────────── */
  function indexHeadings(root, doc) {
    var taken = {};
    var sections = [];

    Array.prototype.forEach.call(root.querySelectorAll('h2, h3'), function (h) {
      var text = h.textContent.trim();
      if (!text) return;
      var id = slug(text, taken);
      h.id = id;

      var a = doc.createElement('a');
      a.className = 'anchor';
      a.href = '#' + id;
      a.textContent = '#';
      a.setAttribute('aria-label', 'Link to ' + text);
      h.appendChild(a);

      sections.push({ id: id, text: text, depth: h.tagName === 'H2' ? 2 : 3 });
    });

    return sections;
  }

  function hardenLinks(root) {
    Array.prototype.forEach.call(root.querySelectorAll('a[href^="http"]'), function (a) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
  }

  /* ── Render one lesson ───────────────────────────────────────────────── */
  function renderLesson(lesson) {
    if (!lesson) return null;
    if (typeof global.marked === 'undefined') {
      throw new Error('Markdown renderer unavailable');
    }

    /* The title is already displayed by the page header. */
    var body = String(lesson.content)
      .replace(/^#{1,2}\s+.*$/m, '')
      .trim();

    var doc = document;
    var root = doc.createElement('div');
    root.innerHTML = global.marked.parse(body);

    promoteHeadings(root, doc);

    collapseAnswers(root, doc);
    upgradeCallouts(root, doc);
    wrapTables(root, doc);
    hardenLinks(root);
    /* A course file separates lessons with `---`; the trailing rule would sit
       right on top of the pager's own divider. */
    while (root.lastElementChild && root.lastElementChild.tagName === 'HR') {
      root.lastElementChild.remove();
    }

    var sections = indexHeadings(root, doc);

    var words = root.textContent.trim().split(/\s+/).length;

    return {
      html: root.innerHTML,
      sections: sections,
      minutes: Math.max(1, Math.round(words / WPM))
    };
  }

  global.content = {
    configureMarked: configureMarked,
    splitLessons: splitLessons,
    renderLesson: renderLesson,
    cleanTitle: cleanTitle
  };
})(window);
