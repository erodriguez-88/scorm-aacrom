/* SCORM 1.2 wrapper (pipwerks-style) for Aacrom courses */
(function (window) {
  "use strict";
  var api = null, isFound = false;

  function findAPI(win) {
    var i = 0;
    while (win.API == null && win.parent != null && win.parent != win && i < 500) {
      i++; win = win.parent;
    }
    return win.API;
  }

  function getAPI() {
    if (api) return api;
    try {
      api = findAPI(window);
      if (!api && window.opener) api = findAPI(window.opener);
    } catch (e) {}
    isFound = !!api;
    return api;
  }

  var SCORM = {
    init: function () {
      var a = getAPI();
      if (!a) return false;
      return a.LMSInitialize("") === "true";
    },
    get: function (key) {
      var a = getAPI(); if (!a) return "";
      return a.LMSGetValue(key) || "";
    },
    set: function (key, val) {
      var a = getAPI(); if (!a) return false;
      return a.LMSSetValue(key, String(val)) === "true";
    },
    commit: function () {
      var a = getAPI(); if (!a) return false;
      return a.LMSCommit("") === "true";
    },
    finish: function () {
      var a = getAPI(); if (!a) return false;
      var ok = a.LMSFinish("") === "true";
      api = null; isFound = false;
      return ok;
    },
    isAvailable: function () { return !!getAPI(); }
  };

  window.SCORM = SCORM;
})(window);
