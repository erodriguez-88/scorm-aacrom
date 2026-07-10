/**
 * Aacrom SCORM 1.2 API Wrapper
 *
 * Encapsula la comunicación con el LMS via la API estándar SCORM 1.2.
 * Busca la API_Find ascendiendo en la jerarquía de ventanas (window.parent
 * o window.opener) hasta encontrar el objeto window.API.
 *
 * Si no se encuentra API (curso ejecutándose fuera de un LMS),
 * la wrapper opera en modo "sin LMS" y los métodos retornan valores neutros.
 *
 * Ámbito: SCORM 1.2 únicamente.
 */

(function (global) {
  'use strict';

  var API = null;          // referencia al objeto API del LMS (si existe)
  var apiFindAttempted = false;
  var initialized = false;
  var hasLMS = false;

  // -----------------------------------------------------------------
  // Búsqueda del objeto API en la jerarquía de ventanas
  // -----------------------------------------------------------------

  function getAPIFromWindow(win) {
    var attempts = 0;
    var maxAttempts = 500;
    while (win && !win.API && win.parent && win.parent !== win && attempts < maxAttempts) {
      attempts++;
      win = win.parent;
    }
    return win && win.API ? win.API : null;
  }

  function findAPI() {
    if (apiFindAttempted) return API;
    apiFindAttempted = true;

    var foundAPI = null;

    // Intentar en la ventana actual y sus padres
    if (window.parent && window.parent !== window) {
      foundAPI = getAPIFromWindow(window.parent);
    }

    // Intentar en window.opener (cuando el SCO se abre en popup)
    if (!foundAPI && window.opener) {
      try {
        foundAPI = getAPIFromWindow(window.opener);
      } catch (e) {
        // Cross-origin, ignorar
      }
    }

    // Intentar en la ventana actual
    if (!foundAPI && window.API) {
      foundAPI = window.API;
    }

    API = foundAPI;
    hasLMS = !!API;

    if (!hasLMS) {
      console.warn('[Aacrom SCORM] API del LMS no encontrada. Operando en modo standalone.');
    }

    return API;
  }

  // -----------------------------------------------------------------
  // Métodos públicos de la API
  // -----------------------------------------------------------------

  function init() {
    if (initialized) return true;
    findAPI();
    if (!hasLMS) {
      initialized = true;
      return false;
    }
    var result = API.LMSInitialize('');
    initialized = (result === 'true' || result === true);
    return initialized;
  }

  function finish() {
    if (!initialized) return false;
    if (!hasLMS) return false;
    commit();
    var result = API.LMSFinish('');
    initialized = false;
    return (result === 'true' || result === true);
  }

  function getValue(name) {
    if (!initialized) return '';
    if (!hasLMS) return '';
    var value = API.LMSGetValue(name);
    return value || '';
  }

  function setValue(name, value) {
    if (!initialized) return false;
    if (!hasLMS) return false;
    var result = API.LMSSetValue(name, String(value));
    return (result === 'true' || result === true);
  }

  function commit() {
    if (!initialized) return false;
    if (!hasLMS) return false;
    var result = API.LMSCommit('');
    return (result === 'true' || result === true);
  }

  function getLastError() {
    if (!hasLMS) return '0';
    return API.LMSGetLastError() || '0';
  }

  function getErrorString(errorCode) {
    if (!hasLMS) return '';
    return API.LMSGetErrorString(errorCode) || '';
  }

  // -----------------------------------------------------------------
  // Métodos de alto nivel
  // -----------------------------------------------------------------

  /**
   * Marca el curso como completado.
   */
  function setCompleted() {
    setValue('cmi.core.lesson_status', 'completed');
    commit();
  }

  /**
   * Marca el curso como aprobado o reprobado según el score.
   */
  function setPassed(passed) {
    setValue('cmi.core.lesson_status', passed ? 'passed' : 'failed');
    commit();
  }

  /**
   * Establece el score del estudiante (0-100).
   */
  function setScore(score, min, max) {
    if (typeof min === 'undefined') min = 0;
    if (typeof max === 'undefined') max = 100;
    setValue('cmi.core.score.raw', score);
    setValue('cmi.core.score.min', min);
    setValue('cmi.core.score.max', max);
    commit();
  }

  /**
   * Guarda datos de sesión (bookmark, progreso, respuestas).
   * Máximo 4096 caracteres en SCORM 1.2.
   */
  function setSuspendData(data) {
    var serialized = typeof data === 'string' ? data : JSON.stringify(data);
    if (serialized.length > 4096) {
      console.warn('[Aacrom SCORM] suspend_data excede 4096 caracteres, se trunca.');
      serialized = serialized.substring(0, 4096);
    }
    setValue('cmi.suspend_data', serialized);
    commit();
  }

  /**
   * Recupera datos de sesión guardados previamente.
   */
  function getSuspendData() {
    var raw = getValue('cmi.suspend_data');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return raw;
    }
  }

  /**
   * Obtiene el nombre del estudiante reportado por el LMS.
   */
  function getStudentName() {
    return getValue('cmi.core.student_name') || 'Estudiante';
  }

  /**
   * Obtiene el ID del estudiante.
   */
  function getStudentId() {
    return getValue('cmi.core.student_id') || '';
  }

  /**
   * Establece la ubicación actual del estudiante (bookmark).
   */
  function setLocation(location) {
    setValue('cmi.core.lesson_location', location);
    commit();
  }

  function getLocation() {
    return getValue('cmi.core.lesson_location');
  }

  /**
   * Indica si el curso ya fue completado en sesiones anteriores.
   */
  function isAlreadyCompleted() {
    var status = getValue('cmi.core.lesson_status');
    return status === 'completed' || status === 'passed';
  }

  // -----------------------------------------------------------------
  // Auto-finish al cerrar la ventana
  // -----------------------------------------------------------------

  function attachUnloadHandlers() {
    window.addEventListener('beforeunload', function () {
      if (initialized) {
        commit();
        finish();
      }
    });

    window.addEventListener('pagehide', function () {
      if (initialized) {
        commit();
        finish();
      }
    });
  }

  // -----------------------------------------------------------------
  // Exponer API pública
  // -----------------------------------------------------------------

  global.AacromSCORM = {
    init: init,
    finish: finish,
    commit: commit,
    getValue: getValue,
    setValue: setValue,
    getLastError: getLastError,
    getErrorString: getErrorString,

    // Alto nivel
    setCompleted: setCompleted,
    setPassed: setPassed,
    setScore: setScore,
    setSuspendData: setSuspendData,
    getSuspendData: getSuspendData,
    getStudentName: getStudentName,
    getStudentId: getStudentId,
    setLocation: setLocation,
    getLocation: getLocation,
    isAlreadyCompleted: isAlreadyCompleted,

    // Estado
    isInitialized: function () { return initialized; },
    hasLMS: function () { return hasLMS; },

    // Setup
    attachUnloadHandlers: attachUnloadHandlers
  };

})(window);
