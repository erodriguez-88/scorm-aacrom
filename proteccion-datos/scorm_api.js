/* ============================================
   AacromSCORM · Wrapper SCORM 1.2
   Aacrom Cursos · estándar v1.0
   ============================================ */
(function() {
  var API = null;
  var initialized = false;
  var finished = false;

  function findAPI(win) {
    var attempts = 0;
    while (win.API == null && win.parent && win.parent != win && attempts < 50) {
      attempts++;
      win = win.parent;
    }
    return win.API;
  }

  function getAPI() {
    if (API !== null) return API;
    try { API = findAPI(window); } catch (e) {}
    if (API === null && window.opener) {
      try { API = findAPI(window.opener); } catch (e) {}
    }
    return API;
  }

  window.AacromSCORM = {
    initialize: function() {
      if (initialized) return true;
      var api = getAPI();
      if (!api) { return false; }
      var result = api.LMSInitialize("");
      if (result === "true" || result === true) {
        initialized = true;
        try { api.LMSSetValue("cmi.core.lesson_status", "incomplete"); api.LMSCommit(""); } catch(e){}
        return true;
      }
      return false;
    },

    isInitialized: function() { return initialized; },

    setSuspendData: function(data) {
      if (!initialized || finished) return false;
      var api = getAPI();
      if (!api) return false;
      var s = (typeof data === 'string') ? data : JSON.stringify(data);
      // SCORM 1.2 limit: 4096 chars for suspend_data
      if (s.length > 4000) s = s.substring(0, 4000);
      api.LMSSetValue("cmi.suspend_data", s);
      api.LMSCommit("");
      return true;
    },

    getSuspendData: function() {
      if (!initialized) return null;
      var api = getAPI();
      if (!api) return null;
      var v = api.LMSGetValue("cmi.suspend_data");
      return v || null;
    },

    setScore: function(raw, max, min) {
      if (!initialized || finished) return false;
      var api = getAPI();
      if (!api) return false;
      api.LMSSetValue("cmi.core.score.raw", String(raw));
      api.LMSSetValue("cmi.core.score.max", String(max == null ? 100 : max));
      api.LMSSetValue("cmi.core.score.min", String(min == null ? 0 : min));
      api.LMSCommit("");
      return true;
    },

    setStatus: function(status) {
      if (!initialized || finished) return false;
      var api = getAPI();
      if (!api) return false;
      // Valid SCORM 1.2 statuses: passed, completed, failed, incomplete, browsed, not attempted
      api.LMSSetValue("cmi.core.lesson_status", status);
      api.LMSCommit("");
      return true;
    },

    commit: function() {
      if (!initialized) return false;
      var api = getAPI();
      if (!api) return false;
      api.LMSCommit("");
      return true;
    },

    finish: function() {
      if (finished || !initialized) return false;
      var api = getAPI();
      if (!api) return false;
      api.LMSCommit("");
      api.LMSFinish("");
      finished = true;
      return true;
    }
  };

  // Auto-initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.AacromSCORM.initialize(); });
  } else {
    window.AacromSCORM.initialize();
  }

  // Auto-finish on unload
  window.addEventListener('beforeunload', function() {
    if (initialized && !finished) {
      try { window.AacromSCORM.finish(); } catch (e) {}
    }
  });
})();
