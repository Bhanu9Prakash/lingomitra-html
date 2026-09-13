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
  var STORE_SECOND = 'lm.second-opinion';

  /* The settings form is a draft of the saved tutor config: edits only take
     effect once the connection test has actually reached a model. With nothing
     saved it opens on the first local preset, so the recommended path — a model
     on your own machine — is the one already filled in. */
  function formFrom(config) {
    if (!config.provider) {
      var seed = window.tutor.PRESETS[0];
      return {
        preset: seed.id, provider: seed.provider, baseUrl: seed.baseUrl,
        model: seed.model, key: seed.key
      };
    }
    return {
      preset: config.preset || '',
      provider: config.provider || '',
      baseUrl: config.baseUrl || '',
      model: config.model || '',
      key: config.key || ''
    };
  }

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
  var practiceCache = Object.create(null);

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
        online: navigator.onLine !== false,

        /* Practice */
        practiceSet: [],
        practiceIndex: 0,
        practiceResults: [],
        practiceScope: 'lesson',
        practiceDone: false,
        attempt: '',
        verdict: null,
        listening: false,
        heard: '',
        speakingNow: false,
        voice: { ok: false, reason: 'unknown' },
        canListen: false,
        cloudSpeech: true,

        /* Conversation */
        talkTurns: [],
        talkInput: '',
        talkBusy: false,
        talkError: '',
        scenario: '',
        tutorState: window.tutor.status(),
        form: formFrom(window.tutor.config()),
        tutorTest: { state: '', title: '', body: '' },
        tutorPresets: window.tutor.PRESETS,
        secondOpinion: store.get(STORE_SECOND, true) !== false,
        second: { state: '', acceptable: false, why: '', from: '' },

        progress: store.get(STORE_PROGRESS, {}),
        itemsByLesson: {}
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

      /* ── Practice ────────────────────────────────────────────────────── */
      lessonItems: function () {
        return (this.itemsByLesson[this.lessonId] || []);
      },
      /* Practice is available on any lesson once earlier material exists —
         recombining what you already met is the point, not a fallback. */
      practicePool: function () {
        var upTo = this.currentLesson ? this.currentLesson.number : 0;
        var n = 0;
        var byLesson = this.itemsByLesson;
        Object.keys(byLesson).forEach(function (id) {
          byLesson[id].forEach(function (item) { if (item.lessonNumber <= upTo) n++; });
        });
        return n;
      },
      currentItem: function () {
        return this.practiceSet[this.practiceIndex] || null;
      },
      practiceProgress: function () {
        if (!this.practiceSet.length) return 0;
        var done = this.practiceDone ? this.practiceSet.length : this.practiceIndex;
        return Math.round((done / this.practiceSet.length) * 100);
      },
      practiceReview: function () {
        return this.practiceResults.filter(function (r) { return r.status !== 'correct'; });
      },
      speechTag: function () {
        return this.language ? window.speech.tagFor(this.language.code) : 'en';
      },

      /* ── Conversation ────────────────────────────────────────────────
         The ceiling is the lesson you are on, or the furthest you have opened
         when you arrive at the conversation from somewhere else. */
      talkUpTo: function () {
        return this.currentLesson ? (this.currentLesson.number || 1) : this.furthestLesson();
      },
      talkScenarios: function () {
        return window.coach.scenariosFor(this.talkUpTo);
      },
      anthropicModels: function () {
        return window.tutor.PROVIDERS.anthropic.models;
      },
      /* A second opinion only makes sense where the checker withheld judgement,
         and only where the model can be trusted to have the language at all —
         Kannada is asked of no model here. */
      canAskSecond: function () {
        return this.secondOpinion &&
          this.tutorState.ready &&
          !!this.verdict &&
          this.verdict.status !== 'correct' &&
          this.verdict.result !== 'revealed' &&
          !!this.attempt.trim() &&
          this.language && this.language.code !== 'kannada';
      },
      verdictHeadline: function () {
        if (!this.verdict) return '';
        return {
          match: 'That\u2019s it.',
          case: 'Right \u2014 mind the capitals.',
          accents: 'Right \u2014 mind the accents.',
          order: 'Same words, different order.',
          near: 'One word apart.',
          differs: 'The course puts it this way.',
          revealed: 'The course puts it this way.'
        }[this.verdict.result] || 'The course puts it this way.';
      },
      verdictNote: function () {
        if (!this.verdict) return '';
        if (this.verdict.via === 'roman') {
          return 'Counted from the romanisation \u2014 typing the script is the next step, not a requirement.';
        }
        switch (this.verdict.result) {
          case 'case':
            return this.language && this.language.code === 'german'
              ? 'In German capitals carry meaning: every noun takes one, and Sie (formal \u201cyou\u201d) is capitalised to separate it from sie (\u201cthey\u201d).'
              : 'The words are right; only the capitals differ.';
          case 'accents':
            return 'The words are right; the marks above the letters differ.';
          case 'order':
            return 'You used exactly the right words. Compare the order \u2014 in some sentences both are fine.';
          case 'near':
            return 'Everything matches but one word. Compare them and work out why.';
          case 'differs':
            return 'This is the answer the course gives. If yours says the same thing another way, it may also be right.';
          default:
            return '';
        }
      },
      attemptMarkup: function () {
        if (!this.verdict || !this.currentItem) return '';
        return this.diffMarkup(this.attempt, this.verdict.target || this.currentItem.answer);
      },
      /* Offline and this course was never opened is a different problem from a
         failed request, and it has a different answer. */
      offlineMiss: function () {
        return this.error && !this.online;
      },
      errorTitle: function () {
        return this.offlineMiss ? 'Not downloaded yet' : 'That course didn\u2019t load';
      },
      errorBody: function () {
        return this.offlineMiss
          ? 'You are offline, and this course has not been opened on this device before. Any course you have already read stays available.'
          : 'The lesson file could not be fetched. Check your connection and try again \u2014 nothing you have read has been lost.';
      },

      voiceNote: function () {
        if (this.voice.ok || !this.language) return '';
        if (this.voice.reason === 'unsupported') return 'This browser cannot read sentences aloud.';
        return 'This device has no ' + this.language.name + ' voice installed, so there is nothing to play.';
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
      window.addEventListener('online', this.onConnectivity);
      window.addEventListener('offline', this.onConnectivity);
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
      window.removeEventListener('online', this.onConnectivity);
      window.removeEventListener('offline', this.onConnectivity);
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

        /* Settings sit outside a course: they are reachable from anywhere and
           keep whatever language is already loaded behind them. */
        if (parts[0] === 'settings') {
          this.closeOverlays();
          this.stopListening();
          this.view = 'settings';
          this.form = formFrom(window.tutor.config());
          this.tutorState = window.tutor.status();
          return;
        }

        var lang = parts[0] ? findLanguage(parts[0]) : null;

        if (!lang) {
          this.view = 'home';
          this.language = null;
          this.resetLesson();
          return;
        }

        var tail = parts[parts.length - 1];
        var mode = (tail === 'practice' || tail === 'talk') ? tail : '';
        var practising = mode === 'practice';
        var talking = mode === 'talk';
        if (mode) parts = parts.slice(0, -1);

        var wantId = parts[1]
          ? (parts[1] === 'intro' ? lang.code + '-intro' : lang.code + '-lesson-' + parts[1])
          : null;

        if (this.language && this.language.code === lang.code && this.lessons.length) {
          if (wantId && wantId !== this.lessonId) this.showLesson(wantId);
          this.view = mode || 'lesson';
          if (practising && !this.practiceSet.length) this.resumePracticeRoute();
          if (talking) this.enterTalk();
          if (!mode) this.stopListening();
          return;
        }

        this.language = lang;
        this.view = mode || 'lesson';
        this.pendingMode = mode;
        this.loadCourse(lang, wantId);
      },

      /* A /talk URL opened cold still needs the voice probe and a fresh read of
         whichever model the learner set up. */
      enterTalk: function () {
        this.tutorState = window.tutor.status();
        this.talkError = '';
        /* A conversation is pinned to the ceiling it started under. Coming back
           from a later lesson would leave the header promising lessons 1..N
           while the model is still working from the old digest, so start over
           rather than quietly disagreeing with the screen. */
        if (this.talkTurns.length && this._talkCeiling !== this.talkUpTo) {
          this.talkTurns = [];
          this.scenario = '';
        }
        this.probeVoice();
        this.scrollTalk();
      },

      /* showLesson() sets the view to 'lesson'; if the URL asked for practice or
         a conversation, put that back once the course is in hand. */
      resumeMode: function () {
        var mode = this.pendingMode;
        this.pendingMode = '';
        if (mode === 'practice') { this.view = 'practice'; this.resumePracticeRoute(); }
        else if (mode === 'talk') { this.view = 'talk'; this.enterTalk(); }
      },

      /* A /practice URL opened cold (a share, a refresh, a back button) needs a
         session built for it rather than an empty screen. */
      resumePracticeRoute: function () {
        if (!this.language || !this.lessons.length) return;
        var upTo = this.currentLesson ? this.currentLesson.number : this.furthestLesson();
        var set = window.practice.session(this.itemsByLesson, upTo, 8);
        if (!set.length) { this.navigate(this.routeFor(this.language.code, this.lessonId), true); return; }
        this.practiceSet = set;
        this.practiceIndex = 0;
        this.practiceResults = [];
        this.practiceDone = false;
        this.resetAttempt();
        this.probeVoice();
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
        this.stopListening();
        window.speech.cancel();
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
        this.stopListening();
        window.speech.cancel();
        this.closeOverlays();
        this.navigate(this.routeFor(this.language.code, id));
      },

      retry: function () {
        if (this.language) this.loadCourse(this.language, this.lessonId);
      },

      /* ── Course loading ──────────────────────────────────────────────── */
      resetLesson: function () {
        this.stopListening();
        window.speech.cancel();
        this.practiceSet = [];
        this.practiceResults = [];
        this.practiceIndex = 0;
        this.practiceDone = false;
        this.verdict = null;
        this.attempt = '';
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
          this.itemsByLesson = this.buildItems(lang, this.lessons);
          this.showLesson(wantId || this.lessons[0].id);
          this.resumeMode();
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
            self.itemsByLesson = self.buildItems(lang, lessons);
            /* Clear `loading` first: showLesson wires up the section observer and
               the table affordances, which need the article in the DOM. */
            self.loading = false;
            self.showLesson(wantId || lessons[0].id);
            self.resumeMode();
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
        this.probeVoice();
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

      /* ── Practice ─────────────────────────────────────────────────────
         Every prompt and answer here was written by the course author. Nothing
         is generated, so nothing can be hallucinated. */
      buildItems: function (lang, lessons) {
        if (practiceCache[lang.code]) return practiceCache[lang.code];
        var byLesson = {};
        lessons.forEach(function (lesson) {
          var got = window.practice.extract(lesson);
          if (got.length) byLesson[lesson.id] = got;
        });
        practiceCache[lang.code] = byLesson;
        return byLesson;
      },

      startPractice: function (scope) {
        if (!this.language || !this.lessons.length) return;
        this.practiceScope = scope || 'lesson';

        var upTo = this.currentLesson ? this.currentLesson.number : this.furthestLesson();
        var set = window.practice.session(this.itemsByLesson, upTo, 8);
        if (!set.length) return;

        this.practiceSet = set;
        this.practiceIndex = 0;
        this.practiceResults = [];
        this.practiceDone = false;
        this.resetAttempt();
        this.probeVoice();

        this.returnTo = location.hash;
        this.navigate(this.routeFor(this.language.code, this.lessonId) + '/practice');
      },

      exitPractice: function () {
        this.stopListening();
        window.speech.cancel();
        var back = this.returnTo || this.routeFor(this.language.code, this.lessonId);
        this.returnTo = '';
        this.navigate(back);
      },

      /* ── Conversation ────────────────────────────────────────────────
         The model is a conversation partner, never a teacher: js/coach.js
         builds a system prompt from the lessons already covered and this only
         moves turns in and out of it. */
      openTalk: function () {
        if (!this.language) return;
        this.closeOverlays();
        window.speech.cancel();
        this.returnTo = location.hash;
        this.navigate(this.routeFor(this.language.code, this.lessonId) + '/talk');
      },

      exitTalk: function () {
        this.abortTalk();
        this.stopListening();
        window.speech.cancel();
        var back = this.returnTo || this.routeFor(this.language.code, this.lessonId);
        this.returnTo = '';
        this.navigate(back);
      },

      beginTalk: function (scenario) {
        if (!this.tutorState.ready || !this.language || !this.lessons.length) return;
        this.scenario = scenario.id;
        this.talkError = '';
        this.talkTurns = [];

        /* Built once and held for the session: the ceiling should not move
           under the learner halfway through a conversation. */
        this._talkCeiling = this.talkUpTo;
        this._talkSystem = window.coach.conversationPrompt({
          lessons: this.lessons,
          itemsByLesson: this.itemsByLesson,
          upTo: this.talkUpTo,
          languageName: this.language.name,
          scenario: scenario.brief
        });

        this.streamTurn([{ role: 'user', content: 'Start the conversation.' }]);
      },

      sendTurn: function () {
        var said = this.talkInput.trim();
        if (!said || this.talkBusy) return;
        this.stopListening();
        window.speech.cancel();
        this.talkInput = '';
        this.talkError = '';
        this.talkTurns.push({ role: 'user', text: said });
        this.streamTurn(this.talkHistory());
        this.scrollTalk();
      },

      /* What the model said, gloss included — it is the model's own turn and
         trimming it would make the history disagree with the screen. */
      talkHistory: function () {
        return this.talkTurns
          .filter(function (t) { return t.text; })
          .map(function (t) {
            return { role: t.role === 'user' ? 'user' : 'assistant', content: t.text };
          });
      },

      streamTurn: function (messages) {
        var self = this;
        var turn = { role: 'assistant', text: '' };
        this.talkTurns.push(turn);
        this.talkBusy = true;

        this.abortTalk();
        this._talkAbort = typeof AbortController === 'function' ? new AbortController() : null;

        window.tutor.chat({
          system: this._talkSystem,
          messages: messages,
          maxTokens: 300,
          signal: this._talkAbort ? this._talkAbort.signal : undefined,
          onDelta: function () { self.scrollTalk(); }
        }).then(function (text) {
          turn.text = String(text || '').trim();
          self.talkBusy = false;
          self._talkAbort = null;
          if (!turn.text) {
            self.talkTurns.pop();
            self.talkError = 'It returned nothing. Try again, or pick a different model.';
            return;
          }
          self.scrollTalk();
          /* Hearing it is half the point of a conversation. */
          if (self.voice.ok) self.hear(self.said(turn.text));
        }).catch(function (err) {
          self.talkBusy = false;
          self._talkAbort = null;
          if (err && err.name === 'AbortError') { self.talkTurns.pop(); return; }
          if (!turn.text) self.talkTurns.pop();
          self.talkError = (err && err.message) || 'Something went wrong reaching the model.';
        });
      },

      abortTalk: function () {
        if (this._talkAbort) { try { this._talkAbort.abort(); } catch (e) { /* ignore */ } }
        this._talkAbort = null;
      },

      /* The prompt asks for the target language first and an English gloss in
         brackets. Split them so the bracket does not compete with the sentence
         the learner is meant to read. */
      said: function (text) {
        var full = String(text || '').trim();
        var stripped = full.replace(/\s*[[(][^\])]*[\])]\s*$/, '').trim();
        return stripped || full;
      },

      gloss: function (text) {
        var full = String(text || '').trim();
        if (this.said(text) === full) return '';
        var m = full.match(/[[(]([^\])]*)[\])]\s*$/);
        return m ? m[1].trim() : '';
      },

      scrollTalk: function () {
        var self = this;
        this.$nextTick(function () {
          var el = self.$refs.talkScroll;
          if (el) el.scrollTop = el.scrollHeight;
        });
      },

      toggleTalkListen: function () {
        if (this.listening) { this.stopListening(); return; }
        if (!this.canListen || !this.language) return;

        var self = this;
        window.speech.cancel();
        this.heard = '';
        this.listening = true;

        this._stopListen = window.speech.listen(this.language.code, {
          oninterim: function (text) { self.heard = text; },
          onfinal: function (text) { self.talkInput = text; self.heard = text; },
          onend: function (gotResult) {
            self.listening = false;
            self._stopListen = null;
            /* Speaking a sentence is the whole gesture: send it rather than
               making the learner reach for a second button. */
            if (gotResult) self.$nextTick(function () { self.sendTurn(); });
          },
          onerror: function () { self.listening = false; }
        });
      },

      /* ── Second opinion ──────────────────────────────────────────────
         Asked only when the deterministic checker withheld judgement. The model
         is given both sentences, so it compares rather than translates. */
      askSecond: function () {
        if (!this.canAskSecond || this.second.state === 'busy') return;
        var self = this;
        var item = this.currentItem;
        var attempt = this.attempt;
        this.second = { state: 'busy', acceptable: false, why: '', from: '' };

        window.tutor.chat({
          system: 'You judge one sentence. Answer in the two lines asked for and nothing else.',
          messages: [{
            role: 'user',
            content: window.coach.verdictPrompt({
              languageName: this.language.name,
              prompt: item.prompt,
              answer: item.answer,
              attempt: attempt
            })
          }],
          maxTokens: 160
        }).then(function (text) {
          var read = window.coach.readVerdict(text);
          self.second = {
            state: 'done',
            acceptable: read.acceptable,
            why: read.why || (read.acceptable
              ? 'It says the same thing.'
              : 'Compare it with the course\u2019s sentence.'),
            from: window.tutor.isLocal() ? 'From the model on this machine' : 'From ' + window.tutor.model()
          };
        }).catch(function (err) {
          self.second = {
            state: 'done',
            acceptable: false,
            why: (err && err.message) || 'The model could not be reached.',
            from: 'No answer'
          };
        });
      },

      /* ── Tutor settings ──────────────────────────────────────────────── */
      openSettings: function () {
        this.closeOverlays();
        this.abortTalk();
        this.stopListening();
        window.speech.cancel();
        if (!this.settingsFrom) this.settingsFrom = location.hash;
        this.navigate('#/settings');
      },

      doneSettings: function () {
        var back = this.settingsFrom || '#/';
        this.settingsFrom = '';
        this.tutorTest = { state: '', title: '', body: '' };
        this.tutorState = window.tutor.status();
        this.navigate(back === '#/settings' ? '#/' : back);
      },

      applyPreset: function (preset) {
        this.form.preset = preset.id;
        this.form.provider = preset.provider;
        if (preset.provider === 'anthropic') {
          this.form.baseUrl = '';
          this.form.model = this.form.model && this.form.model.indexOf('claude') === 0
            ? this.form.model
            : window.tutor.PROVIDERS.anthropic.defaultModel;
          this.form.key = /^sk-ant/.test(this.form.key) ? this.form.key : '';
        } else {
          this.form.baseUrl = preset.baseUrl;
          this.form.model = preset.model;
          this.form.key = preset.key;
        }
        this.tutorTest = { state: '', title: '', body: '' };
      },

      testTutor: function () {
        var self = this;
        if (!this.form.provider) {
          this.tutorTest = { state: 'bad', title: 'Pick a partner first', body: 'Choose one of the options above.' };
          return;
        }
        window.tutor.save(this.form);
        this.tutorState = window.tutor.status();

        if (!this.tutorState.ready) {
          this.tutorTest = {
            state: 'bad',
            title: this.tutorState.reason === 'no-key' ? 'That one needs a key' : 'Something is missing',
            body: this.tutorState.reason === 'no-key'
              ? 'Claude is a hosted model, so it needs your API key.'
              : 'Fill in the endpoint your runtime serves.'
          };
          return;
        }

        this.tutorTest = { state: 'busy', title: 'Trying it', body: 'One short message, to check it answers.' };
        window.tutor.test().then(function () {
          self.tutorState = window.tutor.status();
          self.tutorTest = {
            state: 'ok',
            title: 'It answered',
            body: window.tutor.isLocal()
              ? 'Running on this machine \u2014 nothing you say leaves the device.'
              : 'Ready. Requests go straight from this page to the provider.'
          };
        }).catch(function (err) {
          self.tutorTest = {
            state: 'bad',
            title: 'No answer',
            body: (err && err.message) || 'Could not reach it. If the model is local, check it is running.'
          };
        });
      },

      forgetTutor: function () {
        window.tutor.forget();
        this.form = formFrom(window.tutor.config());
        this.tutorState = window.tutor.status();
        this.talkTurns = [];
        this.second = { state: '', acceptable: false, why: '', from: '' };
        this.tutorTest = { state: 'ok', title: 'Forgotten', body: 'The key and endpoint are gone from this browser.' };
      },

      saveSecondOpinion: function () {
        store.set(STORE_SECOND, this.secondOpinion);
      },

      resetAttempt: function () {
        this.attempt = '';
        this.verdict = null;
        this.heard = '';
        this.second = { state: '', acceptable: false, why: '', from: '' };
        var self = this;
        this.$nextTick(function () {
          if (self.$refs.answerInput) self.$refs.answerInput.focus();
        });
      },

      checkAttempt: function () {
        if (!this.currentItem || this.verdict) return;
        if (!this.attempt.trim()) return;
        this.stopListening();
        this.verdict = window.practice.check(this.attempt, this.currentItem);
        this.recordResult();
      },

      revealItem: function () {
        if (!this.currentItem || this.verdict) return;
        this.stopListening();
        this.verdict = {
          result: 'revealed',
          status: 'different',
          correct: false,
          target: this.currentItem.answer,
          via: 'answer'
        };
        this.recordResult();
      },

      recordResult: function () {
        var self = this;
        this.practiceResults.push({ item: this.currentItem, status: this.verdict.status });
        this.$nextTick(function () {
          if (self.$refs.nextBtn) self.$refs.nextBtn.focus();
          /* Hearing the answer right after producing it is the point of the
             exercise, so play it without being asked. */
          if (self.voice.ok && self.currentItem) self.hear(self.currentItem.answer);
        });
      },

      nextItem: function () {
        window.speech.cancel();
        if (this.practiceIndex + 1 >= this.practiceSet.length) {
          this.practiceDone = true;
          return;
        }
        this.practiceIndex++;
        this.resetAttempt();
      },

      furthestLesson: function () {
        var entry = this.language && this.progress[this.language.code];
        return (entry && entry.number) || 1;
      },

      /* ── Speech ──────────────────────────────────────────────────────── */
      probeVoice: function () {
        var self = this;
        this.canListen = window.speech.canListen();
        this.cloudSpeech = window.speech.listenIsCloud();
        if (!this.language) return;
        window.speech.probeVoice(this.language.code, function (result) {
          self.voice = result;
        });
      },

      hear: function (text) {
        var self = this;
        if (!this.voice.ok || !text) return;
        this.speakingNow = true;
        window.speech.speak(text, this.language.code, {
          onend: function () { self.speakingNow = false; },
          onerror: function () { self.speakingNow = false; }
        });
      },

      toggleListen: function () {
        if (this.listening) { this.stopListening(); return; }
        if (!this.canListen || !this.language) return;

        var self = this;
        window.speech.cancel();
        this.heard = '';
        this.listening = true;

        this._stopListen = window.speech.listen(this.language.code, {
          oninterim: function (text) { self.heard = text; },
          onfinal: function (text) {
            self.attempt = text;
            self.heard = text;
          },
          onend: function (gotResult) {
            self.listening = false;
            self._stopListen = null;
            if (gotResult) self.$nextTick(function () { self.checkAttempt(); });
          },
          onerror: function () { self.listening = false; }
        });
      },

      stopListening: function () {
        if (this._stopListen) { this._stopListen(); this._stopListen = null; }
        this.listening = false;
      },

      /* Word-level diff, used only to point at what differs. It never rewrites
         the learner's sentence. */
      diffMarkup: function (attempt, target) {
        var norm = window.practice.normalise;
        var a = norm(attempt).split(' ').filter(Boolean);
        var t = norm(target).split(' ').filter(Boolean);
        var pool = t.map(function (w) { return w.toLowerCase(); });

        return a.map(function (word) {
          var i = pool.indexOf(word.toLowerCase());
          if (i >= 0) { pool.splice(i, 1); return escapeHtml(word); }
          return '<mark>' + escapeHtml(word) + '</mark>';
        }).join(' ');
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

      onConnectivity: function () {
        this.online = navigator.onLine !== false;
        /* Coming back online, a course that failed for that reason is worth
           another go without making the reader ask for it. */
        if (this.online && this.error && this.language) this.retry();
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
          if (this.listening) { this.stopListening(); return; }
          if (this.view === 'practice') { e.preventDefault(); this.exitPractice(); return; }
          if (this.view === 'talk') { e.preventDefault(); this.exitTalk(); return; }
          if (this.view === 'settings') { e.preventDefault(); this.doneSettings(); return; }
        }

        if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

        /* In practice, the arrow keys belong to the text field, not the course. */
        if (this.view === 'practice') return;

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

  /* On a first visit the course is fetched before the worker takes control, so
     it lands in the browser's HTTP cache but not in ours — and "open a course
     once and it stays readable offline" would quietly mean "twice". Re-request
     it the moment control arrives: the worker sees it and stores it, while the
     browser serves it from its own cache rather than downloading again. */
  function warmCourse() {
    var code = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
    if (findLanguage(code)) fetch('./courses/' + code + '-lesson.md').catch(function () { });
  }

  if (navigator.serviceWorker) {
    window.addEventListener('load', function () {
      /* Relative, so the app also works when it is served from a subdirectory
         rather than a domain root. The default scope is the worker's own
         directory, which is exactly the app root either way. */
      navigator.serviceWorker.register('service-worker.js')
        .then(function () {
          if (navigator.serviceWorker.controller) return;
          navigator.serviceWorker.addEventListener('controllerchange', warmCourse, { once: true });
        })
        .catch(function (err) { console.warn('Service worker registration failed:', err); });
    });
  }
})();
