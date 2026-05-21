/*!
 * Aacrom SCORM 1.2 API Wrapper
 * Algoritmo de búsqueda de API estándar ADL SCORM 1.2 + compat scorm-again v3.
 *
 * Expone: window.AacromSCORM
 */
(function (global) {
  'use strict';

  var API = null;
  var apiFindAttempted = false;
  var initialized = false;
  var hasLMS = false;
  var startTime = null;

  // Busca window.API subiendo por parent en la ventana dada
  function scanWindow(win) {
    var found = null;
    var attempts = 0;
    var current = win;
    while (current && attempts < 500) {
      try {
        if (current.API) { found = current.API; break; }
      } catch (e) { /* cross-origin */ }
      try {
        if (current.parent && current.parent !== current) {
          current = current.parent;
          attempts++;
        } else { break; }
      } catch (e) { break; }
    }
    return found;
  }

  // Algoritmo ADL canónico
  function findAPI() {
    if (apiFindAttempted) return API;
    apiFindAttempted = true;

    var found = null;

    // 1. Subir desde window.parent
    try {
      if (window.parent && window.parent !== window) {
        found = scanWindow(window.parent);
      }
    } catch (e) {}

    // 2. window.opener (popup)
    if (!found && window.opener) {
      try { found = scanWindow(window.opener); } catch (e) {}
    }

    // 3. La propia window
    if (!found) {
      try { if (window.API) found = window.API; } catch (e) {}
    }

    // 4. window.top (algunos LMS como scorm-again)
    if (!found) {
      try {
        if (window.top && window.top !== window && window.top.API) {
          found = window.top.API;
        }
      } catch (e) {}
    }

    API = found;
    hasLMS = !!API;

    if (hasLMS) {
      console.info('[Aacrom SCORM] API LMS localizada.');
    } else {
      console.warn('[Aacrom SCORM] API LMS no encontrada. Modo standalone.');
    }
    return API;
  }

  function callAPI(method, args) {
    if (!API) return '';
    try {
      var fn = API[method];
      if (typeof fn !== 'function') return '';
      return fn.apply(API, args || []);
    } catch (e) {
      console.error('[Aacrom SCORM] Error en ' + method + ':', e);
      return '';
    }
  }

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  }

  function formatSessionTime(seconds) {
    var t = Math.max(0, Math.floor(seconds));
    return pad(Math.floor(t / 3600), 4) + ':' + pad(Math.floor((t % 3600) / 60), 2) + ':' + pad(t % 60, 2);
  }

  var AacromSCORM = {
    initialize: function () {
      if (initialized) return true;
      findAPI();
      if (!hasLMS) return false;
      var result = callAPI('LMSInitialize', ['']);
      initialized = (result === 'true' || result === true);
      if (initialized) {
        startTime = Date.now();
        var status = callAPI('LMSGetValue', ['cmi.core.lesson_status']);
        if (status === 'not attempted' || status === '' || !status) {
          callAPI('LMSSetValue', ['cmi.core.lesson_status', 'incomplete']);
          callAPI('LMSCommit', ['']);
        }
      } else {
        console.warn('[Aacrom SCORM] LMSInitialize devolvió:', result, '| Error:', this.getLastError());
      }
      return initialized;
    },
    terminate: function () {
      if (!initialized) return false;
      if (startTime !== null) {
        var sec = (Date.now() - startTime) / 1000;
        callAPI('LMSSetValue', ['cmi.core.session_time', formatSessionTime(sec)]);
      }
      callAPI('LMSCommit', ['']);
      var result = callAPI('LMSFinish', ['']);
      initialized = false;
      return (result === 'true' || result === true);
    },
    commit: function () {
      if (!initialized) return false;
      var result = callAPI('LMSCommit', ['']);
      return (result === 'true' || result === true);
    },
    getValue: function (element) {
      if (!initialized) return '';
      return callAPI('LMSGetValue', [element]);
    },
    setValue: function (element, value) {
      if (!initialized) return false;
      var result = callAPI('LMSSetValue', [element, String(value)]);
      return (result === 'true' || result === true);
    },
    setStatus: function (status) {
      if (!initialized) return false;
      this.setValue('cmi.core.lesson_status', status);
      this.commit();
      return true;
    },
    setScore: function (score, min, max) {
      if (!initialized) return false;
      this.setValue('cmi.core.score.raw', Math.round(score));
      if (typeof min !== 'undefined') this.setValue('cmi.core.score.min', min);
      if (typeof max !== 'undefined') this.setValue('cmi.core.score.max', max);
      this.commit();
      return true;
    },
    setSessionTime: function (seconds) {
      if (!initialized) return false;
      this.setValue('cmi.core.session_time', formatSessionTime(seconds));
      this.commit();
      return true;
    },
    isInitialized: function () { return initialized; },
    hasLMS: function () { return hasLMS; },
    getLastError: function () {
      if (!API) return '0';
      try {
        var code = callAPI('LMSGetLastError', []);
        var msg = callAPI('LMSGetErrorString', [code]);
        var diag = callAPI('LMSGetDiagnostic', [code]);
        return code + ' | ' + msg + ' | ' + diag;
      } catch (e) { return 'error_querying_lms'; }
    }
  };

  function handleUnload() {
    if (initialized) {
      try { AacromSCORM.terminate(); } catch (e) {}
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('unload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
  }

  global.AacromSCORM = AacromSCORM;
})(typeof window !== 'undefined' ? window : this);
