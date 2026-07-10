/*!
 * AacromSCORM — wrapper SCORM 1.2 para cursos Aacrom
 */
(function (global) {
  'use strict';
  var api = null, initialized = false;

  function findAPI(win) {
    var attempts = 0;
    while (win && attempts < 500) {
      if (win.API) return win.API;
      if (win === win.parent) break;
      win = win.parent; attempts++;
    }
    return null;
  }

  function locateAPI() {
    var found = findAPI(window);
    if (!found && window.parent && window.parent !== window) found = findAPI(window.parent);
    if (!found && window.top && window.top !== window) found = findAPI(window.top);
    if (!found && window.opener) found = findAPI(window.opener);
    return found;
  }

  function init() {
    if (initialized) return true;
    api = locateAPI();
    if (!api) { console.warn('[AacromSCORM] No LMS API found'); return false; }
    var rc = api.LMSInitialize('');
    initialized = (rc === 'true' || rc === true);
    if (initialized) {
      try { api.LMSSetValue('cmi.core.lesson_status', 'incomplete'); api.LMSCommit(''); } catch (e) {}
    }
    return initialized;
  }

  function safeSet(key, value) {
    if (!initialized || !api) return false;
    try { var rc = api.LMSSetValue(key, String(value)); return rc === 'true' || rc === true; } catch (e) { return false; }
  }
  function safeGet(key) {
    if (!initialized || !api) return '';
    try { return api.LMSGetValue(key); } catch (e) { return ''; }
  }
  function setScore(raw, min, max) {
    safeSet('cmi.core.score.raw', raw);
    safeSet('cmi.core.score.min', min == null ? 0 : min);
    safeSet('cmi.core.score.max', max == null ? 100 : max);
  }
  function setStatus(status) { safeSet('cmi.core.lesson_status', status); }
  function setSuspendData(data) {
    var str = typeof data === 'string' ? data : JSON.stringify(data);
    if (str.length > 4096) str = str.substring(0, 4096);
    safeSet('cmi.suspend_data', str);
  }
  function getSuspendData() {
    var raw = safeGet('cmi.suspend_data');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function commit() {
    if (!initialized || !api) return false;
    try { var rc = api.LMSCommit(''); return rc === 'true' || rc === true; } catch (e) { return false; }
  }
  function finish() {
    if (!initialized || !api) return false;
    try { api.LMSCommit(''); var rc = api.LMSFinish(''); initialized = false; return rc === 'true' || rc === true; } catch (e) { return false; }
  }
  function isInitialized() { return initialized; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.addEventListener('beforeunload', function () { if (initialized) finish(); });
  window.addEventListener('pagehide', function () { if (initialized) finish(); });

  global.AacromSCORM = {
    isInitialized: isInitialized, setScore: setScore, setStatus: setStatus,
    setSuspendData: setSuspendData, getSuspendData: getSuspendData, commit: commit, finish: finish
  };
})(window);
