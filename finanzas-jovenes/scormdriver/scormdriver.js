/**
 * Aacrom SCORM Driver
 *
 * Orquesta la comunicación entre el wrapper SCORM y el iframe del contenido.
 * Inicializa la sesión SCORM, expone la API SCORM al iframe, y maneja
 * el ciclo de vida (loader, finish al cerrar).
 */

(function (global) {
  'use strict';

  var contentReady = false;
  var loaderEl = null;
  var frameEl = null;

  // -----------------------------------------------------------------
  // Inicio del SCO
  // -----------------------------------------------------------------

  function start() {
    loaderEl = document.getElementById('aacrom-loader');
    frameEl = document.getElementById('aacrom-frame');

    // Inicializar conexión con LMS
    var initialized = global.AacromSCORM.init();

    if (initialized) {
      console.log('[Aacrom Driver] SCORM inicializado correctamente.');
    } else {
      console.warn('[Aacrom Driver] SCORM no disponible, modo standalone.');
    }

    // Adjuntar handlers de cierre
    global.AacromSCORM.attachUnloadHandlers();
  }

  // -----------------------------------------------------------------
  // Cuando el iframe del contenido termina de cargar
  // -----------------------------------------------------------------

  function handleContentLoaded() {
    // Exponer la API SCORM al iframe (mismo origen, puede acceder)
    try {
      var contentWindow = frameEl.contentWindow;
      if (contentWindow) {
        contentWindow.AacromSCORM = global.AacromSCORM;
      }
    } catch (e) {
      console.error('[Aacrom Driver] No se pudo exponer API al iframe:', e);
    }

    // Ocultar loader cuando el contenido esté listo
    // El contenido puede emitir un evento 'aacrom:ready' cuando termine de inicializar
    waitForContentReady();
  }

  function waitForContentReady() {
    var contentWindow = frameEl.contentWindow;

    if (!contentWindow) {
      hideLoader();
      return;
    }

    // Estrategia 1: escuchar evento 'aacrom:ready' del contenido
    contentWindow.addEventListener('aacrom:ready', function () {
      contentReady = true;
      hideLoader();
    });

    // Estrategia 2: timeout de seguridad (3 segundos)
    setTimeout(function () {
      if (!contentReady) {
        console.warn('[Aacrom Driver] Timeout esperando contenido. Ocultando loader.');
        hideLoader();
      }
    }, 3000);
  }

  function hideLoader() {
    if (loaderEl) {
      loaderEl.classList.add('aacrom-loader-hidden');
    }
  }

  // -----------------------------------------------------------------
  // API pública del driver
  // -----------------------------------------------------------------

  global.AacromDriver = {
    start: start,
    handleContentLoaded: handleContentLoaded,
    hideLoader: hideLoader
  };

})(window);
