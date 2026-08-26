/* =============================================================================
   speech — text-to-speech and voice input, both from the browser's own Web
   Speech API. No download, no model, nothing to install.

   Two honest caveats the UI surfaces rather than hides:

   1. Voices are supplied by the operating system, so coverage varies. Kannada,
      for instance, has voices on macOS/iOS and Android but none on Windows.
      probeVoice() reports what this device actually has and the UI says so
      plainly instead of offering a button that does nothing.

   2. SpeechRecognition in Chrome is *not* on-device — audio goes to a Google
      service. That is worth saying out loud in a product whose selling point is
      that it works offline, so listen() exposes `isCloud` and the UI labels it.
   ========================================================================== */

(function (global) {
  'use strict';

  /* BCP-47 tags for the seven courses, most-specific first. */
  var TAGS = {
    german: ['de-DE', 'de-AT', 'de-CH', 'de'],
    spanish: ['es-ES', 'es-MX', 'es-US', 'es-419', 'es'],
    french: ['fr-FR', 'fr-CA', 'fr-BE', 'fr'],
    hindi: ['hi-IN', 'hi'],
    chinese: ['zh-CN', 'cmn-Hans-CN', 'zh-Hans', 'zh'],
    japanese: ['ja-JP', 'ja'],
    kannada: ['kn-IN', 'kn']
  };

  var synth = global.speechSynthesis || null;
  var Recognition = global.SpeechRecognition || global.webkitSpeechRecognition || null;

  var voices = [];
  var voicesReady = false;
  var waiting = [];

  function loadVoices() {
    if (!synth) return;
    var list = synth.getVoices();
    if (!list || !list.length) return;
    voices = list;
    voicesReady = true;
    waiting.splice(0).forEach(function (fn) { fn(); });
  }

  if (synth) {
    loadVoices();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', loadVoices);
    }
    /* Some engines populate the list late and never fire the event. */
    var tries = 0;
    var poll = setInterval(function () {
      if (voicesReady || ++tries > 20) { clearInterval(poll); waiting.splice(0).forEach(function (fn) { fn(); }); }
      else loadVoices();
    }, 150);
  }

  function whenReady(fn) {
    if (!synth || voicesReady) fn();
    else waiting.push(fn);
  }

  function pickVoice(langCode) {
    var tags = TAGS[langCode] || [langCode];
    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i].toLowerCase();
      /* Exact tag first, then any voice for the same base language. */
      var exact = voices.filter(function (v) { return (v.lang || '').toLowerCase().replace('_', '-') === tag; });
      if (exact.length) return preferLocal(exact);
      var base = tag.split('-')[0];
      var loose = voices.filter(function (v) {
        return (v.lang || '').toLowerCase().replace('_', '-').split('-')[0] === base;
      });
      if (loose.length) return preferLocal(loose);
    }
    return null;
  }

  /* A voice that runs on the device is faster and works offline. */
  function preferLocal(list) {
    var local = list.filter(function (v) { return v.localService; });
    return (local[0] || list[0]);
  }

  /* What can this device actually do for this language? */
  function probeVoice(langCode, cb) {
    whenReady(function () {
      if (!synth) return cb({ ok: false, reason: 'unsupported' });
      var voice = pickVoice(langCode);
      if (!voice) return cb({ ok: false, reason: 'no-voice', tag: (TAGS[langCode] || [])[0] });
      cb({ ok: true, voice: voice, name: voice.name, lang: voice.lang });
    });
  }

  var current = null;

  function speak(text, langCode, opts) {
    opts = opts || {};
    if (!synth || !text) { if (opts.onend) opts.onend(); return function () { }; }

    cancel();

    var utter = new global.SpeechSynthesisUtterance(String(text));
    var voice = pickVoice(langCode);
    if (voice) { utter.voice = voice; utter.lang = voice.lang; }
    else utter.lang = (TAGS[langCode] || [langCode])[0];

    /* Slightly under normal pace: this is a model to imitate, not a broadcast. */
    utter.rate = opts.rate == null ? 0.9 : opts.rate;
    utter.pitch = 1;

    utter.onend = function () { current = null; if (opts.onend) opts.onend(); };
    utter.onerror = function (e) {
      current = null;
      if (opts.onerror) opts.onerror(e);
      else if (opts.onend) opts.onend();
    };

    current = utter;
    synth.speak(utter);
    return cancel;
  }

  function cancel() {
    if (synth && (synth.speaking || synth.pending)) synth.cancel();
    current = null;
  }

  function speaking() {
    return !!(synth && synth.speaking);
  }

  /* ── Voice input ──────────────────────────────────────────────────────── */

  function canListen() {
    return !!Recognition && global.isSecureContext !== false;
  }

  /* Chrome's implementation is server-backed. Say so where the user can see it. */
  function listenIsCloud() {
    return true;
  }

  function listen(langCode, handlers) {
    handlers = handlers || {};
    if (!Recognition) {
      if (handlers.onerror) handlers.onerror({ error: 'unsupported' });
      return function () { };
    }

    var rec = new Recognition();
    rec.lang = (TAGS[langCode] || [langCode])[0];
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    var finished = false;

    rec.onresult = function (event) {
      var interim = '', final = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += chunk; else interim += chunk;
      }
      if (final && handlers.onfinal) { finished = true; handlers.onfinal(final.trim()); }
      else if (interim && handlers.oninterim) handlers.oninterim(interim.trim());
    };

    rec.onerror = function (e) { if (handlers.onerror) handlers.onerror(e); };
    rec.onend = function () { if (handlers.onend) handlers.onend(finished); };

    try { rec.start(); } catch (e) {
      if (handlers.onerror) handlers.onerror({ error: 'start-failed' });
    }

    return function stop() {
      try { rec.stop(); } catch (e) { /* already stopped */ }
    };
  }

  global.speech = {
    probeVoice: probeVoice,
    speak: speak,
    cancel: cancel,
    speaking: speaking,
    canSpeak: function () { return !!synth; },
    canListen: canListen,
    listenIsCloud: listenIsCloud,
    listen: listen,
    tagFor: function (code) { return (TAGS[code] || [code])[0]; }
  };
})(window);
