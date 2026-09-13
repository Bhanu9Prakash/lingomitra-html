/* =============================================================================
   tutor — transport for the conversation tier. Provider-agnostic, streaming,
   and deliberately dumb: it moves messages, it does not decide anything about
   teaching. The pedagogy lives in js/coach.js.

   Why raw fetch rather than the official SDK: this app has no build step, which
   is what lets it deploy to any static host and work offline. @anthropic-ai/sdk
   is CommonJS-first, 14 MB across 189 ESM files with its own npm dependencies —
   using it would mean adding a bundler, a much larger change than the feature.
   The wire format below follows the documented REST API, and the browser header
   is the one the official SDK itself sends.

   Keys live in this browser only. They are never sent anywhere except the
   provider the learner chose, and the UI says so before asking for one.
   ========================================================================== */

(function (global) {
  'use strict';

  var STORE = 'lm.tutor';

  /* Anthropic's own SDK refuses to run in a browser unless you opt in, because
     a key in a page is a key the page's user can read. That is fine here — it
     is the learner's own key, in their own browser — but it is why the UI is
     explicit about whose key it is. */
  var ANTHROPIC_VERSION = '2023-06-01';

  var PROVIDERS = {
    anthropic: {
      label: 'Claude',
      keyLabel: 'Anthropic API key',
      keyHint: 'Starts with sk-ant-. From console.anthropic.com.',
      needsKey: true,
      endpoint: 'https://api.anthropic.com/v1/messages',
      models: [
        { id: 'claude-opus-5', label: 'Opus 5 — most capable' },
        { id: 'claude-sonnet-5', label: 'Sonnet 5 — balanced' },
        { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — fastest, cheapest' }
      ],
      defaultModel: 'claude-opus-5'
    },
    openai: {
      label: 'OpenAI-compatible',
      keyLabel: 'API key',
      keyHint: 'Works with OpenAI, OpenRouter, Groq — and with Ollama or LM Studio running on this machine.',
      needsKey: false,
      baseUrl: 'https://api.openai.com/v1',
      models: [],
      defaultModel: 'gpt-4o-mini'
    }
  };

  /* Presets for the local runtimes, which is how "a local LLM" actually works
     well today: the model runs on the learner's own machine, with no multi-
     gigabyte download inside the browser and no key. */
  var PRESETS = [
    { id: 'ollama', label: 'Ollama (local)', provider: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', key: 'ollama' },
    { id: 'lmstudio', label: 'LM Studio (local)', provider: 'openai', baseUrl: 'http://localhost:1234/v1', model: 'local-model', key: 'lm-studio' },
    { id: 'openai', label: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', key: '' },
    { id: 'openrouter', label: 'OpenRouter', provider: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct', key: '' }
  ];

  var config = read();

  function read() {
    try {
      var raw = localStorage.getItem(STORE);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed || { preset: '', provider: '', key: '', model: '', baseUrl: '' };
    } catch (e) {
      return { preset: '', provider: '', key: '', model: '', baseUrl: '' };
    }
  }

  function save(next) {
    config = Object.assign({}, config, next || {});
    try { localStorage.setItem(STORE, JSON.stringify(config)); } catch (e) { /* private mode */ }
    return config;
  }

  function forget() {
    config = { preset: '', provider: '', key: '', model: '', baseUrl: '' };
    try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
  }

  function status() {
    var p = PROVIDERS[config.provider];
    if (!p) return { ready: false, reason: 'unconfigured' };
    if (p.needsKey && !config.key) return { ready: false, reason: 'no-key' };
    if (config.provider === 'openai' && !baseUrl()) return { ready: false, reason: 'no-endpoint' };
    return { ready: true, provider: config.provider, model: model(), local: isLocal() };
  }

  function baseUrl() {
    return (config.baseUrl || PROVIDERS.openai.baseUrl || '').replace(/\/+$/, '');
  }

  function model() {
    return config.model || (PROVIDERS[config.provider] || {}).defaultModel || '';
  }

  /* A model served from this machine never leaves it. Worth saying in the UI. */
  function isLocal() {
    if (config.provider !== 'openai') return false;
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(baseUrl());
  }

  /* ── Streaming ────────────────────────────────────────────────────────────
     Both providers speak Server-Sent Events but disagree on the envelope, so
     one reader handles the transport and each provider supplies a line parser. */
  function streamRequest(url, init, parseLine, onDelta) {
    return fetch(url, init).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (body) {
          throw describeError(res.status, body);
        });
      }
      if (!res.body) throw new Error('This browser cannot stream responses.');

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var text = '';

      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done) return text;
          buffer += decoder.decode(chunk.value, { stream: true });

          var lines = buffer.split('\n');
          buffer = lines.pop();

          lines.forEach(function (line) {
            var piece = parseLine(line.trim());
            if (piece) { text += piece; if (onDelta) onDelta(piece, text); }
          });
          return pump();
        });
      }
      return pump();
    });
  }

  function describeError(code, body) {
    var detail = '';
    try {
      var parsed = JSON.parse(body);
      detail = (parsed.error && (parsed.error.message || parsed.error.type)) || '';
    } catch (e) { detail = (body || '').slice(0, 200); }

    var message = {
      401: 'That key was rejected. Check it and try again.',
      403: 'That key is not allowed to use this model.',
      404: 'The endpoint or model was not found.',
      429: 'Rate limited by the provider. Wait a moment and try again.'
    }[code] || ('The provider returned ' + code + '.');

    var err = new Error(detail ? message + ' (' + detail + ')' : message);
    err.status = code;
    return err;
  }

  /* ── Anthropic ────────────────────────────────────────────────────────── */
  function anthropicChat(opts) {
    var body = {
      model: model(),
      /* Tutor turns are one or two sentences by design; a large ceiling here
         would only invite the model to lecture. */
      max_tokens: opts.maxTokens || 1024,
      stream: true,
      system: opts.system,
      messages: opts.messages,
      /* Conversation is latency-sensitive, and this is not a reasoning task.
         Thinking is on by default on the newer models; left on it would spend a
         turn's whole budget deliberating over a two-sentence reply. Disabling
         it is only accepted at effort 'high' or lower, which is where we are. */
      output_config: { effort: 'low' },
      thinking: { type: 'disabled' }
    };

    return streamRequest(PROVIDERS.anthropic.endpoint, {
      method: 'POST',
      signal: opts.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.key,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    }, anthropicLine, opts.onDelta);
  }

  function anthropicLine(line) {
    if (line.indexOf('data:') !== 0) return '';
    var payload = line.slice(5).trim();
    if (!payload) return '';
    try {
      var event = JSON.parse(payload);
      if (event.type === 'content_block_delta' && event.delta && event.delta.type === 'text_delta') {
        return event.delta.text || '';
      }
      if (event.type === 'error') {
        throw new Error((event.error && event.error.message) || 'The provider reported an error.');
      }
    } catch (e) {
      if (e instanceof SyntaxError) return '';
      throw e;
    }
    return '';
  }

  /* ── OpenAI-compatible (OpenAI, OpenRouter, Groq, Ollama, LM Studio) ──── */
  function openaiChat(opts) {
    var messages = opts.system
      ? [{ role: 'system', content: opts.system }].concat(opts.messages)
      : opts.messages;

    var headers = { 'Content-Type': 'application/json' };
    if (config.key) headers.Authorization = 'Bearer ' + config.key;

    return streamRequest(baseUrl() + '/chat/completions', {
      method: 'POST',
      signal: opts.signal,
      headers: headers,
      body: JSON.stringify({
        model: model(),
        messages: messages,
        stream: true,
        max_tokens: opts.maxTokens || 1024
      })
    }, openaiLine, opts.onDelta);
  }

  function openaiLine(line) {
    if (line.indexOf('data:') !== 0) return '';
    var payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return '';
    try {
      var event = JSON.parse(payload);
      var choice = event.choices && event.choices[0];
      return (choice && choice.delta && choice.delta.content) || '';
    } catch (e) {
      return '';
    }
  }

  /* ── Public ───────────────────────────────────────────────────────────── */
  function chat(opts) {
    var state = status();
    if (!state.ready) return Promise.reject(new Error('The tutor is not set up yet.'));
    opts = opts || {};
    if (config.provider === 'anthropic') return anthropicChat(opts);
    return openaiChat(opts);
  }

  /* One cheap round trip, so the learner finds out the key is wrong in
     settings rather than mid-conversation. */
  function test() {
    return chat({
      system: 'Reply with the single word: ready',
      messages: [{ role: 'user', content: 'ready?' }],
      maxTokens: 16
    }).then(function (text) {
      return { ok: true, sample: (text || '').trim().slice(0, 40) };
    });
  }

  global.tutor = {
    PROVIDERS: PROVIDERS,
    PRESETS: PRESETS,
    config: function () { return Object.assign({}, config); },
    save: save,
    forget: forget,
    status: status,
    model: model,
    isLocal: isLocal,
    chat: chat,
    test: test
  };
})(window);
