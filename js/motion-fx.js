/* =============================================================================
   motion-fx — the app's only animation layer.
   Built on Motion (motion.dev, vendored as vendor/motion.min.js).
   Each helper is a vanilla implementation of a named approved primitive:
     · textEffect   → Motion Primitives · text-effect  (preset "fade-in-blur")
     · revealGroup  → Motion Primitives · in-view + animated-group
     · scrollBar    → Motion Primitives · scroll-progress
     · island       → Watermelon UI     · scroll-island   (spring bounce .2/.7s)
     · morphIn/Out  → Watermelon UI     · command-search  (shared-element morph)
     · sheetIn/Out  → Watermelon UI     · sheet
     · menuIn       → Kokonut UI        · profile-dropdown
     · swapText     → Watermelon UI     · step-pager (AnimatedText char stagger)
   Nothing here animates for decoration alone: every call communicates a state
   change or a spatial relationship.
   ========================================================================== */

(function (global) {
  'use strict';

  var M = global.Motion;
  var reduceQuery = global.matchMedia
    ? global.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false, addEventListener: function () { } };

  function reduced() { return reduceQuery.matches; }
  function has() { return !!(M && M.animate); }

  /* Springs lifted verbatim from the source components. */
  var SPRING_ISLAND = { type: 'spring', bounce: 0.2, duration: 0.7 };
  var SPRING_POP = { type: 'spring', stiffness: 280, damping: 25, mass: 0.8 };

  /* ── Motion Primitives · text-effect ─────────────────────────────────────
     Splits to words and reveals them with the "fade-in-blur" preset variants:
     hidden { opacity 0, y 20, blur 12px } → visible { opacity 1, y 0, blur 0 } */
  function textEffect(el, opts) {
    if (!el || el.dataset.teDone) return;
    el.dataset.teDone = '1';
    opts = opts || {};

    var text = el.textContent.trim();
    var words = text.split(/(\s+)/);
    el.textContent = '';

    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.appendChild(sr);

    var segs = [];
    words.forEach(function (w) {
      var s = document.createElement('span');
      s.className = 'te-seg';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = w;
      el.appendChild(s);
      segs.push(s);
    });

    if (reduced() || !has()) {
      el.removeAttribute('data-pending');
      return;
    }

    M.animate(
      segs,
      { opacity: [0, 1], y: [20, 0], filter: ['blur(12px)', 'blur(0px)'] },
      {
        duration: 0.5,
        delay: M.stagger(opts.stagger || 0.05, { startDelay: opts.delay || 0.05 }),
        ease: [0.16, 1, 0.3, 1]
      }
    );
    el.removeAttribute('data-pending');
  }

  /* ── Motion Primitives · in-view + animated-group ────────────────────────
     Staggered entrance, fired once when the group scrolls into view. */
  function revealGroup(items, opts) {
    items = Array.prototype.slice.call(items || []);
    if (!items.length) return;
    opts = opts || {};

    if (reduced() || !has()) return;

    items.forEach(function (el) { el.style.opacity = '0'; });

    var run = function () {
      M.animate(
        items,
        { opacity: [0, 1], y: [12, 0] },
        {
          duration: 0.42,
          delay: M.stagger(opts.stagger || 0.035, { startDelay: opts.delay || 0 }),
          ease: [0.16, 1, 0.3, 1]
        }
      );
    };

    if (opts.immediate || !M.inView) { run(); return; }
    M.inView(items[0], function () { run(); }, { margin: '0px 0px -12% 0px' });
  }

  /* Simple enter for a single panel. */
  function fadeUp(el, opts) {
    if (!el || reduced() || !has()) return;
    opts = opts || {};
    M.animate(el, { opacity: [0, 1], y: [opts.y == null ? 10 : opts.y, 0] },
      { duration: 0.34, ease: [0.16, 1, 0.3, 1], delay: opts.delay || 0 });
  }

  /* ── Motion Primitives · scroll-progress ─────────────────────────────────
     scaleX bound to document scroll, smoothed by a spring. */
  function scrollBar(el) {
    if (!el || !has() || !M.scroll) return;
    if (reduced()) { el.style.display = 'none'; return; }
    M.scroll(M.animate(el, { scaleX: [0, 1] }, { ease: 'linear' }));
  }

  /* ── Watermelon UI · scroll-island ───────────────────────────────────────
     Collapsed ⇄ expanded. FLIP: measure the box before the DOM changes, let
     CSS lay out the new size, then animate the difference away on a spring so
     the island reads as one object growing — not two panels swapping. */
  function islandResize(el, panel, from, open) {
    if (!el || reduced() || !has()) return;

    var to = el.getBoundingClientRect();
    if (Math.abs(to.height - from.height) < 1 && Math.abs(to.width - from.width) < 1) return;

    M.animate(
      el,
      { width: [from.width + 'px', to.width + 'px'], height: [from.height + 'px', to.height + 'px'] },
      SPRING_ISLAND
    ).then(function () {
      el.style.width = '';
      el.style.height = '';
    });

    if (panel && open) {
      M.animate(panel, { opacity: [0, 1] }, { duration: 0.22, ease: 'easeOut' });
    }
  }

  /* ── Watermelon UI · command-search ──────────────────────────────────────
     The panel grows out of the control that opened it — a shared-element move
     rather than a modal that appears from nowhere. */
  function morphIn(panel, trigger) {
    if (!panel || reduced() || !has()) return;

    var to = panel.getBoundingClientRect();
    var from = trigger && trigger.getBoundingClientRect();

    if (!from || !from.width) {
      M.animate(panel, { opacity: [0, 1], scale: [0.97, 1], y: [-8, 0] }, SPRING_POP);
      return;
    }

    var dx = (from.left + from.width / 2) - (to.left + to.width / 2);
    var dy = (from.top + from.height / 2) - (to.top + to.height / 2);

    M.animate(
      panel,
      {
        opacity: [0, 1],
        x: [dx, 0],
        y: [dy, 0],
        scaleX: [Math.max(from.width / to.width, 0.35), 1],
        scaleY: [Math.max(from.height / to.height, 0.06), 1]
      },
      SPRING_POP
    );
  }

  /* ── Watermelon UI · sheet ───────────────────────────────────────────── */
  function sheetIn(el) {
    if (!el || reduced() || !has()) return;
    M.animate(el, { y: ['100%', '0%'] }, { type: 'spring', bounce: 0.12, duration: 0.5 });
  }

  /* ── Kokonut UI · profile-dropdown ──────────────────────────────────── */
  function menuIn(el) {
    if (!el || reduced() || !has()) return;
    M.animate(el, { opacity: [0, 1], scale: [0.95, 1], y: [-6, 0] },
      { duration: 0.16, ease: [0.16, 1, 0.3, 1] });
  }

  /* ── Watermelon UI · step-pager (AnimatedText) ───────────────────────────
     Characters of the destination title swap on a spring so a lesson change
     reads as movement between two places. */
  function swapText(el, text) {
    if (!el) return;
    if (reduced() || !has()) { el.textContent = text; return; }

    el.textContent = '';
    var chars = String(text).split('');
    var spans = chars.map(function (c) {
      var s = document.createElement('span');
      s.textContent = c;
      s.style.display = 'inline-block';
      if (c === ' ') s.style.whiteSpace = 'pre';
      el.appendChild(s);
      return s;
    });

    M.animate(
      spans,
      { opacity: [0, 1], y: [10, 0], filter: ['blur(2px)', 'blur(0px)'] },
      {
        type: 'spring', stiffness: 240, damping: 16, mass: 1.2,
        delay: M.stagger(0.014)
      }
    );
  }

  /* Scroll a container so an element sits comfortably in view, without the
     jump-to-computed-offset guesswork the old build used. */
  function scrollIntoViewSoft(el, container) {
    if (!el) return;
    el.scrollIntoView({
      behavior: reduced() ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest'
    });
    void container;
  }

  global.fx = {
    reduced: reduced,
    textEffect: textEffect,
    revealGroup: revealGroup,
    fadeUp: fadeUp,
    scrollBar: scrollBar,
    islandResize: islandResize,
    morphIn: morphIn,
    sheetIn: sheetIn,
    menuIn: menuIn,
    swapText: swapText,
    scrollIntoViewSoft: scrollIntoViewSoft
  };
})(window);
