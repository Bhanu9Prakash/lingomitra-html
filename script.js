/* =============================================================================
   LingoMitra — application logic.
   Presentation lives in styles.css + index.html; markdown handling lives in
   js/content.js; every animation goes through js/motion-fx.js. This file only
   holds state, routing, storage and the wiring between them.
   ========================================================================== */

(function () {
  'use strict';

  var LANGUAGES = [
    { name: 'German', code: 'german', flagCode: 'de', speakers: 132 },
    { name: 'Spanish', code: 'spanish', flagCode: 'es', speakers: 534 },
    { name: 'French', code: 'french', flagCode: 'fr', speakers: 280 },
    { name: 'Hindi', code: 'hindi', flagCode: 'hi', speakers: 615 },
    { name: 'Chinese', code: 'chinese', flagCode: 'zh', speakers: 1120 },
    { name: 'Japanese', code: 'japanese', flagCode: 'jp', speakers: 128 },
    { name: 'Kannada', code: 'kannada', flagCode: 'kn', speakers: 56 }
  ];

  var STORE_THEME = 'lm.theme';
  var STORE_PROGRESS = 'lm.progress';

  /* localStorage can throw in private modes — never let that break the app. */
  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    raw: function (key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    setRaw: function (key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    }
  };

  var courseCache = Object.create(null);

  function findLanguage(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i];
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Highlight the matched run in a palette result. */
  function mark(text, query) {
    var safe = escapeHtml(text);
    if (!query) return safe;
    var i = text.toLowerCase().indexOf(query.toLowerCase());
    if (i < 0) return safe;
    return escapeHtml(text.slice(0, i)) +
      '<mark>' + escapeHtml(text.slice(i, i + query.length)) + '</mark>' +
      escapeHtml(text.slice(i + query.length));
  }

  window.content.configureMarked();

  var app = Vue.createApp({
    data: function () {
      return {
        languages: LANGUAGES,
        view: 'home',

        dark: document.documentElement.classList.contains('theme-dark'),
        year: new Date().getFullYear(),
        metaKeyLabel: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl ',

        language: null,
        pendingName: '',
        lessons: [],
        lessonId: '',
        html: '',
        sections: [],
        readingMinutes: 1,

        loading: false,
        error: false,
        errorDetail: '',
        comingSoon: false,

        langMenuOpen: false,
        sheetOpen: false,
        islandOpen: false,
        paletteOpen: false,
        query: '',
        paletteIndex: 0,

        readProgress: 0,
        activeSection: '',
        showTop: false,

        progress: store.get(STORE_PROGRESS, {})
      };
    },

    computed: {
      currentLesson: function () {
        for (var i = 0; i < this.lessons.length; i++) {
          if (this.lessons[i].id === this.lessonId) return this.lessons[i];
        }
        return null;
      },
      lessonIndex: function () {
        for (var i = 0; i < this.lessons.length; i++) {
          if (this.lessons[i].id === this.lessonId) return i;
        }
        return -1;
      },
      prevLesson: function () {
        return this.lessonIndex > 0 ? this.lessons[this.lessonIndex - 1] : null;
      },
      nextLesson: function () {
        return this.lessonIndex >= 0 && this.lessonIndex < this.lessons.length - 1
          ? this.lessons[this.lessonIndex + 1] : null;
      },
      lessonEyebrow: function () {
        if (!this.currentLesson) return '';
        if (!this.currentLesson.number) return 'Introduction';
        return 'Lesson ' + this.currentLesson.number + ' of ' + this.lessons.length;
      },
      doneCount: function () {
        var done = this.doneList(this.language && this.language.code);
        var ids = {};
        this.lessons.forEach(function (l) { ids[l.id] = true; });
        return done.filter(function (id) { return ids[id]; }).length;
      },
      /* Resume: the most recently opened lesson across every language. */
      resume: function () {
        var best = null;
        for (var code in this.progress) {
          var entry = this.progress[code];
          if (!entry || !entry.last || !entry.at) continue;
          if (!best || entry.at > best.at) best = entry;
        }
        if (!best) return null;
        var lang = findLanguage(best.code);
        if (!lang) return null;
        if (this.view === 'lesson' && this.language && this.language.code === lang.code) return null;
        return {
          lang: lang,
          id: best.last,
          title: best.title || 'Continue where you left off',
          number: best.number || 1
        };
      },

      /* ── Command palette results ────────────────────────────────────── */
      paletteResults: function () {
        var q = this.query.trim().toLowerCase();
        var out = [];
        var self = this;

        this.lessons.forEach(function (lesson) {
          if (q && lesson.title.toLowerCase().indexOf(q) < 0) return;
          out.push({
            key: 'l:' + lesson.id,
            group: self.language ? self.language.name + ' lessons' : 'Lessons',
            icon: '#i-book',
            label: mark(lesson.title, self.query.trim()),
            hint: lesson.number ? String(lesson.number) : 'Intro',
            action: function () { self.goToLesson(lesson.id); }
          });
        });

        LANGUAGES.forEach(function (lang) {
          if (self.language && self.language.code === lang.code) return;
          if (q && lang.name.toLowerCase().indexOf(q) < 0) return;
          out.push({
            key: 'g:' + lang.code,
            group: 'Switch language',
            icon: '#i-cap',
            flag: lang.flagCode,
            label: mark(lang.name, self.query.trim()),
            action: function () { self.selectLanguage(lang); }
          });
        });

        if (!q || 'all languages'.indexOf(q) >= 0 || 'home'.indexOf(q) >= 0) {
          out.push({
            key: 'a:home',
            group: 'Go to',
            icon: '#i-grid',
            label: 'All languages',
            action: function () { self.goHome(); }
          });
        }

        out.forEach(function (item, i) { item.index = i; });
        return out;
      },

      paletteGroups: function () {
        var groups = [];
        var byName = {};
        this.paletteResults.forEach(function (item) {
          if (!byName[item.group]) {
            byName[item.group] = { name: item.group, items: [] };
            groups.push(byName[item.group]);
          }
          byName[item.group].items.push(item);
        });
        return groups;
      }
    },

    watch: {
      langMenuOpen: function (open) {
        var self = this;
        if (open) this.$nextTick(function () { fx.menuIn(self.$refs.langMenu); });
      },
      sheetOpen: function (open) {
        var self = this;
        document.body.classList.toggle('is-locked', open || this.paletteOpen);
        if (open) this.$nextTick(function () { fx.sheetIn(self.$refs.sheet); });
      },
      paletteOpen: function (open) {
        document.body.classList.toggle('is-locked', open || this.sheetOpen);
      },
      nextLesson: function (lesson) {
        var self = this;
        this.$nextTick(function () {
          if (self.$refs.pagerNext) {
            fx.swapText(self.$refs.pagerNext,
              lesson ? lesson.title : 'You finished ' + (self.language ? self.language.name : ''));
          }
        });
      }
    },

    created: function () {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onResize, { passive: true });
      window.addEventListener('hashchange', this.readRoute);
      window.addEventListener('keydown', this.onKey, true);
      document.addEventListener('click', this.onDocClick);
    },

    mounted: function () {
      var self = this;
      fx.scrollBar(this.$refs.progressBar);
      this.readRoute();
      this.$nextTick(function () { self.enterHome(); });
    },

    beforeUnmount: function () {
      window.removeEventListener('scroll', this.onScroll);
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('hashchange', this.readRoute);
      window.removeEventListener('keydown', this.onKey, true);
      document.removeEventListener('click', this.onDocClick);
      this.disconnectSections();
    },

    methods: {
      /* ── Theme ───────────────────────────────────────────────────────── */
      toggleTheme: function () {
        this.dark = !this.dark;
        var root = document.documentElement;
        root.classList.toggle('theme-dark', this.dark);
        root.classList.toggle('theme-light', !this.dark);
        store.setRaw(STORE_THEME, this.dark ? 'dark' : 'light');

        /* Keep the browser chrome in step with the explicit choice, not the
           system preference the meta tag would otherwise follow. */
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', this.dark ? '#050315' : '#fbfbfe');
      },

      /* ── Routing: #/<language>/<lesson-number|intro> ─────────────────── */
      readRoute: function () {
        var parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
        var lang = parts[0] ? findLanguage(parts[0]) : null;

        if (!lang) {
          this.view = 'home';
          this.language = null;
          this.resetLesson();
          return;
        }

        var wantId = parts[1]
          ? (parts[1] === 'intro' ? lang.code + '-intro' : lang.code + '-lesson-' + parts[1])
          : null;

        if (this.language && this.language.code === lang.code && this.lessons.length) {
          if (wantId && wantId !== this.lessonId) this.showLesson(wantId);
          this.view = 'lesson';
          return;
        }

        this.language = lang;
        this.view = 'lesson';
        this.loadCourse(lang, wantId);
      },

      routeFor: function (langCode, lessonId) {
        if (!langCode) return '#/';
        if (!lessonId) return '#/' + langCode;
        var tail = lessonId.indexOf('-lesson-') >= 0 ? lessonId.split('-lesson-')[1] : 'intro';
        return '#/' + langCode + '/' + tail;
      },

      navigate: function (hash, replace) {
        if (location.hash === hash) { this.readRoute(); return; }
        if (replace) history.replaceState(null, '', hash);
        else location.hash = hash;
        if (replace) this.readRoute();
      },

      goHome: function () {
        this.closeOverlays();
        this.navigate('#/');
        window.scrollTo({ top: 0, behavior: 'auto' });
      },

      selectLanguage: function (lang) {
        this.closeOverlays();
        var saved = this.progress[lang.code];
        this.navigate(this.routeFor(lang.code, saved && saved.last));
      },

      openResume: function () {
        if (!this.resume) return;
        this.navigate(this.routeFor(this.resume.lang.code, this.resume.id));
      },

      goToLesson: function (id) {
        this.closeOverlays();
        this.navigate(this.routeFor(this.language.code, id));
      },

      retry: function () {
        if (this.language) this.loadCourse(this.language, this.lessonId);
      },

      /* ── Course loading ──────────────────────────────────────────────── */
      resetLesson: function () {
        this.lessons = [];
        this.lessonId = '';
        this.html = '';
        this.sections = [];
        this.error = false;
        this.errorDetail = '';
        this.comingSoon = false;
        this.readProgress = 0;
        this.disconnectSections();
      },

      loadCourse: function (lang, wantId) {
        var self = this;

        if (courseCache[lang.code]) {
          this.lessons = courseCache[lang.code];
          this.showLesson(wantId || this.lessons[0].id);
          return;
        }

        this.resetLesson();
        this.loading = true;
        this.pendingName = lang.name;

        fetch('./courses/' + lang.code + '-lesson.md')
          .then(function (res) {
            if (res.status === 404) return null;
            if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
            return res.text();
          })
          .then(function (markdown) {
            if (markdown == null) { self.comingSoon = true; self.loading = false; return; }
            var lessons = window.content.splitLessons(markdown, lang.code);
            if (!lessons.length) { self.comingSoon = true; self.loading = false; return; }
            courseCache[lang.code] = lessons;
            self.lessons = lessons;
            /* Clear `loading` first: showLesson wires up the section observer and
               the table affordances, which need the article in the DOM. */
            self.loading = false;
            self.showLesson(wantId || lessons[0].id);
          })
          .catch(function (err) {
            self.error = true;
            self.errorDetail = err && err.message ? err.message : String(err);
            self.loading = false;
          });
      },

      showLesson: function (id) {
        var self = this;
        var lesson = null;
        for (var i = 0; i < this.lessons.length; i++) {
          if (this.lessons[i].id === id) { lesson = this.lessons[i]; break; }
        }
        if (!lesson) lesson = this.lessons[0];
        if (!lesson) return;

        this.lessonId = lesson.id;

        try {
          var rendered = window.content.renderLesson(lesson);
          this.html = rendered.html;
          this.sections = rendered.sections;
          this.readingMinutes = rendered.minutes;
          this.error = false;
        } catch (err) {
          this.error = true;
          this.errorDetail = err.message;
          return;
        }

        this.rememberPlace(lesson);
        this.activeSection = this.sections.length ? this.sections[0].id : '';
        this.readProgress = 0;

        this.$nextTick(function () {
          window.scrollTo({ top: 0, behavior: 'auto' });
          self.observeSections();
          self.markScrollableTables();
          self.scrollRailIntoView();
          fx.fadeUp(document.querySelector('.lesson-head'), { y: 8 });
          if (self.$refs.pagerNext) {
            fx.swapText(self.$refs.pagerNext,
              self.nextLesson ? self.nextLesson.title : 'You finished ' + self.language.name);
          }
          self.onScroll();
        });
      },

      /* ── Progress ────────────────────────────────────────────────────── */
      doneList: function (code) {
        var entry = code && this.progress[code];
        return (entry && entry.done) || [];
      },
      isDone: function (id) {
        return this.language ? this.doneList(this.language.code).indexOf(id) >= 0 : false;
      },
      progressFor: function (code) {
        var entry = this.progress[code];
        var total = (courseCache[code] && courseCache[code].length) ||
          (entry && entry.total) || 0;
        if (!total) return 0;
        return Math.min(100, Math.round((this.doneList(code).length / total) * 100));
      },
      toggleDone: function (id) {
        if (!this.language) return;
        var code = this.language.code;
        var entry = this.progress[code] || { code: code, done: [] };
        var done = (entry.done || []).slice();
        var i = done.indexOf(id);
        if (i >= 0) done.splice(i, 1); else done.push(id);
        entry.done = done;
        entry.total = this.lessons.length;
        this.progress = Object.assign({}, this.progress, (function (o) { o[code] = entry; return o; })({}));
        store.set(STORE_PROGRESS, this.progress);
      },
      rememberPlace: function (lesson) {
        var code = this.language.code;
        var entry = this.progress[code] || { code: code, done: [] };
        entry.code = code;
        entry.last = lesson.id;
        entry.title = lesson.title;
        entry.number = lesson.number || 1;
        entry.total = this.lessons.length;
        entry.at = Date.now();
        this.progress = Object.assign({}, this.progress, (function (o) { o[code] = entry; return o; })({}));
        store.set(STORE_PROGRESS, this.progress);
      },

      /* ── Reading progress + section tracking ─────────────────────────── */
      onScroll: function () {
        this.showTop = window.scrollY > 600;

        var article = this.$refs.prose;
        if (!article) { this.readProgress = 0; return; }
        var rect = article.getBoundingClientRect();
        var total = rect.height - window.innerHeight + 160;
        if (total <= 0) { this.readProgress = 100; return; }
        var passed = -rect.top + 80;
        this.readProgress = Math.min(100, Math.max(0, Math.round((passed / total) * 100)));
      },

      onResize: function () {
        this.markScrollableTables();
      },

      observeSections: function () {
        var self = this;
        this.disconnectSections();
        if (!('IntersectionObserver' in window) || !this.$refs.prose) return;

        var headings = this.$refs.prose.querySelectorAll('h2, h3');
        if (!headings.length) return;

        this._sectionObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) self.activeSection = entry.target.id;
          });
        }, { rootMargin: '-72px 0px -68% 0px', threshold: 0 });

        Array.prototype.forEach.call(headings, function (h) {
          self._sectionObserver.observe(h);
        });
      },

      /* Watermelon UI · scroll-fade: flag tables that are wider than the column
         so the fade only shows when there is genuinely more to see. */
      markScrollableTables: function () {
        if (!this.$refs.prose) return;
        Array.prototype.forEach.call(
          this.$refs.prose.querySelectorAll('.table-wrap'),
          function (wrap) {
            var scroller = wrap.querySelector('.table-scroll');
            if (!scroller) return;
            var sync = function () {
              var overflows = scroller.scrollWidth - scroller.clientWidth > 2;
              wrap.dataset.overflow = overflows ? 'true' : 'false';
              wrap.dataset.end =
                scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 2
                  ? 'true' : 'false';
            };
            scroller.addEventListener('scroll', sync, { passive: true });
            sync();
          }
        );
      },

      disconnectSections: function () {
        if (this._sectionObserver) {
          this._sectionObserver.disconnect();
          this._sectionObserver = null;
        }
      },

      scrollRailIntoView: function () {
        var rail = this.$refs.railList;
        if (!rail) return;
        var active = rail.querySelector('[aria-current="true"]');
        if (active) fx.scrollIntoViewSoft(active, rail);
      },

      jumpTo: function (id) {
        this.islandOpen = false;
        var el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: fx.reduced() ? 'auto' : 'smooth', block: 'start' });
        this.activeSection = id;
      },

      /* ── Overlays ────────────────────────────────────────────────────── */
      toggleIsland: function () {
        var self = this;
        var el = this.$refs.island;
        var from = el ? el.getBoundingClientRect() : null;
        this.islandOpen = !this.islandOpen;
        this.$nextTick(function () {
          if (from) fx.islandResize(el, self.$refs.islandPanel, from, self.islandOpen);
          if (self.islandOpen) self.scrollActiveTopicIntoView();
        });
      },

      scrollActiveTopicIntoView: function () {
        var panel = this.$refs.islandPanel;
        if (!panel) return;
        var active = panel.querySelector('[aria-current="true"]');
        if (active) active.scrollIntoView({ block: 'nearest' });
      },

      openPalette: function () {
        var self = this;
        this.query = '';
        this.paletteIndex = 0;
        this.paletteOpen = true;
        this.$nextTick(function () {
          if (self.$refs.paletteInput) self.$refs.paletteInput.focus();
          fx.morphIn(self.$refs.palette, document.querySelector('.cmd-trigger'));
        });
      },

      closePalette: function () {
        this.paletteOpen = false;
        this.query = '';
      },

      closeOverlays: function () {
        this.paletteOpen = false;
        this.sheetOpen = false;
        this.islandOpen = false;
        this.langMenuOpen = false;
      },

      movePalette: function (delta) {
        var n = this.paletteResults.length;
        if (!n) return;
        this.paletteIndex = (this.paletteIndex + delta + n) % n;
        var self = this;
        this.$nextTick(function () {
          var el = self.$refs.paletteBody &&
            self.$refs.paletteBody.querySelector('[data-index="' + self.paletteIndex + '"]');
          if (el) el.scrollIntoView({ block: 'nearest' });
        });
      },

      runPalette: function (item) {
        var chosen = item || this.paletteResults[this.paletteIndex];
        if (!chosen) return;
        this.closePalette();
        chosen.action();
      },

      /* ── Global input ────────────────────────────────────────────────── */
      onKey: function (e) {
        var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);

        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          this.paletteOpen ? this.closePalette() : this.openPalette();
          return;
        }

        if (e.key === 'Escape') {
          if (this.paletteOpen) { e.preventDefault(); this.closePalette(); return; }
          if (this.sheetOpen) { this.sheetOpen = false; return; }
          if (this.islandOpen) { this.toggleIsland(); return; }
          if (this.langMenuOpen) { this.langMenuOpen = false; return; }
        }

        if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

        if (this.view === 'lesson' && !this.paletteOpen) {
          if (e.key === 'ArrowLeft' && this.prevLesson) {
            e.preventDefault(); this.goToLesson(this.prevLesson.id);
          } else if (e.key === 'ArrowRight' && this.nextLesson) {
            e.preventDefault(); this.goToLesson(this.nextLesson.id);
          } else if (e.key === '/') {
            e.preventDefault(); this.openPalette();
          }
        }
      },

      onDocClick: function (e) {
        if (this.langMenuOpen && this.$refs.langSwitch && !this.$refs.langSwitch.contains(e.target)) {
          this.langMenuOpen = false;
        }
      },

      /* ── Entrances (Motion Primitives · in-view) ─────────────────────── */
      enterHome: function () {
        if (this.view !== 'home') return;
        var self = this;
        this.$nextTick(function () {
          fx.textEffect(self.$refs.heroTitle, { stagger: 0.045, delay: 0.06 });
          if (self.$refs.langGrid) {
            fx.revealGroup(self.$refs.langGrid.children, { stagger: 0.032, immediate: true, delay: 0.12 });
          }
        });
      },

      scrollTop: function () {
        window.scrollTo({ top: 0, behavior: fx.reduced() ? 'auto' : 'smooth' });
      }
    }
  });

  app.mount('#app');

  /* ── Service worker ─────────────────────────────────────────────────── */
  if (navigator.serviceWorker) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        .catch(function (err) { console.warn('Service worker registration failed:', err); });
    });
  }
})();
