/**
 * scorm_api.js — Wrapper SCORM 1.2 para cursos Aacrom
 * Implementa la interfaz window.AacromSCORM que consume el player del curso.
 *
 * Seguimientos reportados a Moodle (SCORM 1.2):
 *   - cmi.core.lesson_status  (not attempted / incomplete / completed / passed / failed)
 *   - cmi.core.score.raw / .min / .max   (puntaje del quiz 0-100)
 *   - cmi.core.session_time   (tiempo de la sesión)
 *   - cmi.suspend_data        (progreso para reanudar: pantallas vistas + posición)
 *   - cmi.core.exit           (suspend para permitir reanudar)
 *
 * El player llama a:
 *   AacromSCORM.isInitialized()
 *   AacromSCORM.setScore(raw, max, min)
 *   AacromSCORM.setStatus(status)
 *   AacromSCORM.commit()
 *   AacromSCORM.getSuspendData() / setSuspendData(obj)   (extensiones para reanudar)
 */
(function (global) {
  'use strict';

  var API = null;          // referencia al objeto API del LMS (SCORM 1.2)
  var initialized = false;
  var startTime = Date.now();
  var finishCalled = false;

  // ----------------------------------------------------------
  // Descubrimiento del API SCORM 1.2 (busca window.API en padres/openers)
  // ----------------------------------------------------------
  function findAPI(win) {
    var tries = 0;
    while (win.API == null && win.parent != null && win.parent !== win) {
      tries++;
      if (tries > 500) return null;
      win = win.parent;
    }
    return win.API;
  }

  function getAPI() {
    var api = null;
    if (typeof window !== 'undefined') {
      api = findAPI(window);
      if (api == null && window.opener != null && typeof window.opener !== 'undefined') {
        api = findAPI(window.opener);
      }
    }
    return api;
  }

  // ----------------------------------------------------------
  // Inicialización
  // ----------------------------------------------------------
  function initialize() {
    if (initialized) return true;
    API = getAPI();
    if (API == null) {
      console.warn('[SCORM] No se encontró el API del LMS. El curso funciona pero no reporta seguimiento.');
      return false;
    }
    var ok = API.LMSInitialize('');
    if (ok === 'true' || ok === true) {
      initialized = true;

      // Si es la primera vez, marcar incomplete
      var status = API.LMSGetValue('cmi.core.lesson_status');
      if (!status || status === 'not attempted' || status === 'not_attempted' || status === '') {
        API.LMSSetValue('cmi.core.lesson_status', 'incomplete');
      }
      // Permitir reanudar: salida tipo suspend
      API.LMSSetValue('cmi.core.exit', 'suspend');
      API.LMSCommit('');
      console.log('[SCORM] Inicializado correctamente.');
      return true;
    }
    console.warn('[SCORM] LMSInitialize falló.');
    return false;
  }

  // ----------------------------------------------------------
  // Reporte de puntaje (quiz)
  // ----------------------------------------------------------
  function setScore(raw, max, min) {
    if (!initialized || !API) return;
    try {
      API.LMSSetValue('cmi.core.score.raw', String(Math.round(raw)));
      API.LMSSetValue('cmi.core.score.min', String(min != null ? min : 0));
      API.LMSSetValue('cmi.core.score.max', String(max != null ? max : 100));
    } catch (e) { console.warn('[SCORM] setScore error:', e); }
  }

  // ----------------------------------------------------------
  // Reporte de estado
  //   incomplete | completed | passed | failed
  // ----------------------------------------------------------
  function setStatus(status) {
    if (!initialized || !API) return;
    try {
      API.LMSSetValue('cmi.core.lesson_status', status);
    } catch (e) { console.warn('[SCORM] setStatus error:', e); }
  }

  // ----------------------------------------------------------
  // suspend_data: guardar/leer progreso para reanudar
  // ----------------------------------------------------------
  function setSuspendData(obj) {
    if (!initialized || !API) return;
    try {
      var str = JSON.stringify(obj);
      // SCORM 1.2 limita suspend_data a 4096 caracteres
      if (str.length > 4000) str = str.substring(0, 4000);
      API.LMSSetValue('cmi.suspend_data', str);
    } catch (e) { console.warn('[SCORM] setSuspendData error:', e); }
  }

  function getSuspendData() {
    if (!initialized || !API) return null;
    try {
      var str = API.LMSGetValue('cmi.suspend_data');
      if (!str) return null;
      return JSON.parse(str);
    } catch (e) { return null; }
  }

  // ----------------------------------------------------------
  // session_time (formato SCORM 1.2: HHHH:MM:SS.SS)
  // ----------------------------------------------------------
  function setSessionTime() {
    if (!initialized || !API) return;
    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    var h = Math.floor(elapsed / 3600);
    var m = Math.floor((elapsed % 3600) / 60);
    var s = elapsed % 60;
    var fmt = (h < 10 ? '0' + h : h) + ':' +
              (m < 10 ? '0' + m : m) + ':' +
              (s < 10 ? '0' + s : s);
    try { API.LMSSetValue('cmi.core.session_time', fmt); } catch (e) {}
  }

  // ----------------------------------------------------------
  // Commit y Finish
  // ----------------------------------------------------------
  function commit() {
    if (!initialized || !API) return;
    setSessionTime();
    try { API.LMSCommit(''); } catch (e) { console.warn('[SCORM] commit error:', e); }
  }

  function finish() {
    if (!initialized || !API || finishCalled) return;
    finishCalled = true;
    setSessionTime();
    try {
      API.LMSCommit('');
      API.LMSFinish('');
      console.log('[SCORM] Sesión finalizada.');
    } catch (e) { console.warn('[SCORM] finish error:', e); }
  }

  // Cerrar sesión SCORM cuando el estudiante sale
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', finish);
    window.addEventListener('unload', finish);
    window.addEventListener('pagehide', finish);
  }

  // ----------------------------------------------------------
  // Interfaz pública que consume el player
  // ----------------------------------------------------------
  global.AacromSCORM = {
    isInitialized: function () { return initialized; },
    setScore: setScore,
    setStatus: setStatus,
    commit: commit,
    finish: finish,
    setSuspendData: setSuspendData,
    getSuspendData: getSuspendData
  };

  // Inicializar al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})(window);
