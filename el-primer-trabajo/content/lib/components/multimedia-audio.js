/**
 * Componente: multimedia-audio
 *
 * Renderiza un reproductor de audio HTML5 con controles nativos
 * y caption opcional debajo.
 *
 * Estructura del data:
 *   {
 *     src: "assets/audio/locucion.mp3",   // requerido
 *     caption: "Texto descriptivo",        // opcional
 *     transcription: "Texto transcrito...", // opcional, accesibilidad
 *     autoplay: false,                      // opcional, default false
 *     loop: false                           // opcional, default false
 *   }
 *
 * Notas:
 * - autoplay generalmente está bloqueado por los navegadores. Se incluye
 *   por completitud pero no se debe depender de él.
 * - El audio respeta `preload="metadata"` para no descargar el archivo
 *   completo hasta que el estudiante presione play.
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[multimedia-audio] AacromRuntime no disponible.');
    return;
  }

  global.AacromRuntime.register('multimedia-audio', {
    render: function (block, container) {
      var data = block.data || {};
      var src = data.src;

      if (!src || typeof src !== 'string') {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Audio sin atributo src</p>';
        return;
      }

      var caption = typeof data.caption === 'string' ? data.caption : '';
      var transcription = typeof data.transcription === 'string' ? data.transcription : '';
      var autoplay = data.autoplay === true;
      var loop = data.loop === true;

      container.classList.add('aacrom-block-multimedia-audio');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-block-multimedia-audio__wrapper';

      // Audio element
      var audio = document.createElement('audio');
      audio.className = 'aacrom-block-multimedia-audio__player';
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = src;
      if (autoplay) audio.autoplay = true;
      if (loop) audio.loop = true;

      // Texto fallback dentro del audio
      audio.appendChild(document.createTextNode(
        'Su navegador no soporta el reproductor de audio.'
      ));

      // Manejo de error de carga (más robusto)
      var errorShown = false;
      function showError(reason) {
        if (errorShown) return;
        errorShown = true;
        audio.style.display = 'none';
        var err = document.createElement('div');
        err.className = 'aacrom-block-multimedia-audio__error';
        err.textContent = reason || ('Audio no disponible: ' + src);
        wrapper.insertBefore(err, audio);
      }

      audio.addEventListener('error', function () {
        showError();
      });

      // Detección adicional con timeout: si después de 3 segundos no hay
      // metadata cargada, marcar como error.
      setTimeout(function () {
        if (audio.networkState === audio.NETWORK_NO_SOURCE && !errorShown) {
          showError('Audio no disponible: no se pudo cargar el archivo');
        }
      }, 3000);

      wrapper.appendChild(audio);

      // Caption visible
      if (caption) {
        var capEl = document.createElement('div');
        capEl.className = 'aacrom-block-multimedia-audio__caption';
        capEl.textContent = caption;
        wrapper.appendChild(capEl);
      }

      // Transcripción colapsable (accesibilidad)
      if (transcription) {
        var details = document.createElement('details');
        details.className = 'aacrom-block-multimedia-audio__transcription';

        var summary = document.createElement('summary');
        summary.className = 'aacrom-block-multimedia-audio__transcription-toggle';
        summary.textContent = 'Ver transcripción';
        details.appendChild(summary);

        var transEl = document.createElement('div');
        transEl.className = 'aacrom-block-multimedia-audio__transcription-text';
        transEl.textContent = transcription;
        details.appendChild(transEl);

        wrapper.appendChild(details);
      }

      container.appendChild(wrapper);
    }
  });

})(window);
