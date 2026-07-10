/* AacromSCORM · Wrapper SCORM 1.2 estándar
 * Compatible con Moodle, Cornerstone, SAP SuccessFactors, Docebo, TalentLMS.
 * API expuesta: init, isInitialized, setScore, setStatus, setSuspendData,
 *               getSuspendData, commit, finish.
 */
(function() {
  'use strict';

  var API = null;
  var initialized = false;

  function findAPI(win) {
    var attempts = 0;
    while (win && !win.API && attempts < 500) {
      attempts++;
      if (win.parent === win) break;
      win = win.parent;
    }
    return win ? win.API : null;
  }

  function getAPI() {
    if (API !== null) return API;
    var theAPI = findAPI(window);
    if (!theAPI && window.opener) theAPI = findAPI(window.opener);
    API = theAPI;
    return API;
  }

  function logScorm(action, success, value) {
    var msg = '[AacromSCORM] ' + action + (success ? ' OK' : ' FAIL');
    if (value !== undefined) msg += ' · ' + value;
    if (window.console && window.console.log) console.log(msg);
  }

  window.AacromSCORM = {
    init: function() {
      var api = getAPI();
      if (!api) {
        logScorm('init', false, 'No SCORM API found (running outside LMS?)');
        return false;
      }
      var result = api.LMSInitialize('');
      initialized = (result === 'true' || result === true);
      if (initialized) {
        var status = api.LMSGetValue('cmi.core.lesson_status');
        if (status === 'not attempted' || status === '') {
          api.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        }
        api.LMSCommit('');
      }
      logScorm('init', initialized);
      return initialized;
    },

    isInitialized: function() {
      return initialized;
    },

    setScore: function(scorePercent, max, min) {
      var api = getAPI();
      if (!api || !initialized) return false;
      var raw = Math.max(0, Math.min(100, Math.round(scorePercent)));
      api.LMSSetValue('cmi.core.score.raw', String(raw));
      api.LMSSetValue('cmi.core.score.min', String(min !== undefined ? min : 0));
      api.LMSSetValue('cmi.core.score.max', String(max !== undefined ? max : 100));
      logScorm('setScore', true, raw + '/' + (max !== undefined ? max : 100));
      return true;
    },

    setStatus: function(status) {
      var api = getAPI();
      if (!api || !initialized) return false;
      var valid = ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'];
      if (valid.indexOf(status) === -1) {
        logScorm('setStatus', false, 'invalid status: ' + status);
        return false;
      }
      api.LMSSetValue('cmi.core.lesson_status', status);
      logScorm('setStatus', true, status);
      return true;
    },

    setSuspendData: function(data) {
      var api = getAPI();
      if (!api || !initialized) return false;
      var str = (typeof data === 'string') ? data : JSON.stringify(data);
      if (str.length > 4096) str = str.substring(0, 4096);
      api.LMSSetValue('cmi.suspend_data', str);
      logScorm('setSuspendData', true, str.length + ' chars');
      return true;
    },

    getSuspendData: function() {
      var api = getAPI();
      if (!api || !initialized) return null;
      var data = api.LMSGetValue('cmi.suspend_data');
      logScorm('getSuspendData', true, (data || '').length + ' chars');
      return data || null;
    },

    commit: function() {
      var api = getAPI();
      if (!api || !initialized) return false;
      var result = api.LMSCommit('');
      logScorm('commit', result === 'true' || result === true);
      return result === 'true' || result === true;
    },

    finish: function() {
      var api = getAPI();
      if (!api || !initialized) return false;
      api.LMSCommit('');
      var result = api.LMSFinish('');
      initialized = false;
      logScorm('finish', result === 'true' || result === true);
      return result === 'true' || result === true;
    }
  };

  // Auto-init al cargar
  if (document.readyState === 'complete') {
    window.AacromSCORM.init();
  } else {
    window.addEventListener('load', function() {
      window.AacromSCORM.init();
    });
  }

  // Auto-finish al cerrar
  window.addEventListener('beforeunload', function() {
    if (initialized) {
      window.AacromSCORM.finish();
    }
  });
})();
