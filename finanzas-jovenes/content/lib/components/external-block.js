/**
 * Componente: external-block
 *
 * Incrusta un paquete autocontenido (típicamente Storyline 360 exportado
 * a HTML5, o cualquier webapp) dentro del curso vía iframe.
 *
 * Esta es la implementación de la Opción C del proyecto: permite extender
 * la plantilla más allá de los componentes nativos cuando la pedagogía
 * lo requiere.
 *
 * Estructura del data:
 *   {
 *     title: "Simulación de atención al cliente",
 *     description: "Tome decisiones según el caso presentado",
 *     source: "external/storyline-simulacion-atencion/index.html",
 *     originType: "storyline" | "webapp" | "embed" | "other",
 *     height: 600,                      // píxeles
 *     minHeight: 400,
 *     responsive: true,                 // permite resize automático
 *     reportProgress: true,             // si espera señal del paquete externo
 *     completion: {
 *       mode: "auto" | "manual" | "trigger",  // default "manual"
 *       expectedSignal: "completed"
 *     }
 *   }
 *
 * Comunicación con el paquete externo (postMessage):
 *   El paquete externo puede enviar mensajes con:
 *     window.parent.postMessage({
 *       source: 'aacrom-external-block',
 *       blockId: '...',
 *       event: 'loaded' | 'started' | 'progress' | 'completed' | 'failed' | 'resize',
 *       data: {...}
 *     }, '*');
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[external-block] AacromRuntime no disponible.');
    return;
  }

  // Registro de bloques activos para enrutamiento de mensajes
  var activeBlocks = {};

  // Listener global de postMessage (una sola vez)
  if (!global.__aacromExternalBlockListenerAttached) {
    global.__aacromExternalBlockListenerAttached = true;
    window.addEventListener('message', function (event) {
      var msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.source !== 'aacrom-external-block') return;
      if (!msg.blockId) return;

      var handler = activeBlocks[msg.blockId];
      if (handler && typeof handler.onMessage === 'function') {
        handler.onMessage(msg);
      }
    });
  }

  global.AacromRuntime.register('external-block', {
    render: function (block, container) {
      var data = block.data || {};
      var blockId = block.id || ('external-' + Math.random().toString(36).slice(2));
      var source = data.source;

      if (!source || typeof source !== 'string') {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Bloque externo sin atributo source</p>';
        return;
      }

      var title = typeof data.title === 'string' ? data.title : 'Contenido externo';
      var description = typeof data.description === 'string' ? data.description : '';
      var originType = data.originType || 'other';
      var height = typeof data.height === 'number' ? data.height : 600;
      var minHeight = typeof data.minHeight === 'number' ? data.minHeight : 300;
      var responsive = data.responsive !== false;
      var completion = data.completion || {};
      var completionMode = completion.mode;
      if (['auto', 'manual', 'trigger'].indexOf(completionMode) === -1) {
        completionMode = 'manual'; // default
      }

      container.classList.add('aacrom-block-external');

      // -------------------------------------------------------
      // Header del bloque
      // -------------------------------------------------------
      var header = document.createElement('div');
      header.className = 'aacrom-block-external__header';

      var titleEl = document.createElement('h3');
      titleEl.className = 'aacrom-block-external__title';
      titleEl.textContent = title;
      header.appendChild(titleEl);

      if (description) {
        var descEl = document.createElement('p');
        descEl.className = 'aacrom-block-external__description';
        descEl.textContent = description;
        header.appendChild(descEl);
      }

      container.appendChild(header);

      // -------------------------------------------------------
      // iframe del paquete externo
      // -------------------------------------------------------
      var frameWrap = document.createElement('div');
      frameWrap.className = 'aacrom-block-external__frame-wrap';

      // Loader visible mientras carga
      var loader = document.createElement('div');
      loader.className = 'aacrom-block-external__loader';
      loader.innerHTML =
        '<div class="aacrom-block-external__spinner" aria-hidden="true"></div>' +
        '<div class="aacrom-block-external__loader-text">Cargando contenido externo…</div>';
      frameWrap.appendChild(loader);

      var iframe = document.createElement('iframe');
      iframe.className = 'aacrom-block-external__iframe';
      iframe.title = title;
      iframe.style.minHeight = minHeight + 'px';
      iframe.style.height = height + 'px';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('allow', 'autoplay; fullscreen');

      // Pasar el blockId al paquete externo via URL parameter
      // (el paquete puede leerlo con new URLSearchParams(window.location.search))
      var separator = source.indexOf('?') === -1 ? '?' : '&';
      iframe.src = source + separator + 'aacromBlockId=' + encodeURIComponent(blockId);

      iframe.addEventListener('load', function () {
        loader.classList.add('aacrom-block-external__loader--hidden');

        // Avisar al paquete externo (post-load) con su blockId por si no leyó el query
        try {
          iframe.contentWindow.postMessage({
            source: 'aacrom-external-block-init',
            blockId: blockId
          }, '*');
        } catch (e) {
          // Cross-origin iframes no permiten esto, no es crítico
        }
      });

      iframe.addEventListener('error', function () {
        loader.classList.add('aacrom-block-external__loader--hidden');
        showLoadError('No se pudo cargar el contenido externo');
      });

      // Timeout de carga (10 segundos)
      var loadTimeout = setTimeout(function () {
        if (!loader.classList.contains('aacrom-block-external__loader--hidden')) {
          // Si después de 10s sigue cargando, ocultar el loader igual
          // (el iframe a veces no dispara load aunque tenga contenido visible)
          loader.classList.add('aacrom-block-external__loader--hidden');
        }
      }, 10000);

      frameWrap.appendChild(iframe);
      container.appendChild(frameWrap);

      function showLoadError(msg) {
        clearTimeout(loadTimeout);
        var err = document.createElement('div');
        err.className = 'aacrom-block-external__error';
        err.textContent = msg;
        frameWrap.appendChild(err);
      }

      // -------------------------------------------------------
      // Estado de completitud
      // -------------------------------------------------------
      var completedFlag = false;

      var statusEl = document.createElement('div');
      statusEl.className = 'aacrom-block-external__status';
      statusEl.setAttribute('role', 'status');
      statusEl.setAttribute('aria-live', 'polite');
      container.appendChild(statusEl);

      function markCompleted(reason) {
        if (completedFlag) return;
        completedFlag = true;
        statusEl.classList.add('aacrom-block-external__status--completed');
        statusEl.textContent = '✓ Actividad completada';

        // Disparar evento al runtime
        var evt = new CustomEvent('aacrom:external-block:completed', {
          detail: { blockId: blockId, reason: reason }
        });
        window.dispatchEvent(evt);

        // Si el bloque tiene botón de continuar manual, deshabilitarlo
        if (manualBtn) {
          manualBtn.disabled = true;
          manualBtn.textContent = 'Completado';
        }
      }

      // -------------------------------------------------------
      // Modo de completitud
      // -------------------------------------------------------
      var manualBtn = null;

      if (completionMode === 'auto') {
        // Marcar completado al cargar el iframe
        iframe.addEventListener('load', function () {
          // Pequeño delay para que el contenido se vea antes de marcar
          setTimeout(function () { markCompleted('auto'); }, 500);
        });
      } else if (completionMode === 'manual') {
        // Botón "Continuar" debajo del iframe
        var btnWrap = document.createElement('div');
        btnWrap.className = 'aacrom-block-external__actions';

        manualBtn = document.createElement('button');
        manualBtn.type = 'button';
        manualBtn.className = 'aacrom-btn aacrom-btn--primary aacrom-block-external__continue';
        manualBtn.textContent = 'He completado esta actividad';
        manualBtn.addEventListener('click', function () {
          markCompleted('manual');
        });

        btnWrap.appendChild(manualBtn);
        container.appendChild(btnWrap);
      } else if (completionMode === 'trigger') {
        // Esperar evento del paquete externo
        var hint = document.createElement('div');
        hint.className = 'aacrom-block-external__trigger-hint';
        hint.textContent = 'Esta actividad se marca como completada cuando finalice la simulación.';
        container.appendChild(hint);
      }

      // -------------------------------------------------------
      // Manejo de mensajes postMessage del iframe
      // -------------------------------------------------------
      activeBlocks[blockId] = {
        onMessage: function (msg) {
          var event = msg.event;

          switch (event) {
            case 'loaded':
              // Confirma carga, ocultar loader si todavía está
              loader.classList.add('aacrom-block-external__loader--hidden');
              break;

            case 'started':
              // El estudiante empezó la actividad
              break;

            case 'progress':
              // Progreso parcial (no usado todavía, futuro)
              break;

            case 'completed':
              // Solo procesa si está en modo trigger o auto
              if (completionMode === 'trigger' || completionMode === 'auto') {
                markCompleted('trigger');
              }
              break;

            case 'failed':
              // Algunos paquetes pueden reportar fallo
              statusEl.classList.add('aacrom-block-external__status--failed');
              statusEl.textContent = 'La actividad reporta que no se completó correctamente.';
              break;

            case 'resize':
              // Cambiar altura del iframe si es responsive
              if (responsive && msg.data && typeof msg.data.height === 'number') {
                var newH = Math.max(minHeight, msg.data.height);
                iframe.style.height = newH + 'px';
              }
              break;
          }
        }
      };
    }
  });

})(window);
