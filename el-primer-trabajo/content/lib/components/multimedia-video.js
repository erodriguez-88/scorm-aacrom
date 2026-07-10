/**
 * Componente: multimedia-video
 *
 * Renderiza un reproductor de video HTML5 con controles nativos.
 *
 * Estructura del data:
 *   {
 *     src: "assets/video/intro.mp4",        // requerido (mp4 recomendado)
 *     poster: "assets/images/intro-cover.jpg", // opcional, miniatura previa
 *     caption: "Texto descriptivo",          // opcional
 *     transcription: "Transcripción...",      // opcional, accesibilidad
 *     subtitles: "assets/video/intro.vtt",   // opcional, archivo WebVTT
 *     autoplay: false,                        // opcional, default false
 *     loop: false,                            // opcional, default false
 *     muted: false,                           // opcional, default false
 *     width: 1280,                            // opcional, hint de tamaño
 *     height: 720                             // opcional
 *   }
 *
 * Notas:
 * - Se prefiere MP4 (H.264) por compatibilidad universal.
 * - autoplay solo funciona si muted=true (regla de los navegadores).
 * - El subtitulado WebVTT (.vtt) sirve para accesibilidad.
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[multimedia-video] AacromRuntime no disponible.');
    return;
  }

  global.AacromRuntime.register('multimedia-video', {
    render: function (block, container) {
      var data = block.data || {};
      var src = data.src;

      if (!src || typeof src !== 'string') {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Video sin atributo src</p>';
        return;
      }

      var poster = typeof data.poster === 'string' ? data.poster : '';
      var caption = typeof data.caption === 'string' ? data.caption : '';
      var transcription = typeof data.transcription === 'string' ? data.transcription : '';
      var subtitles = typeof data.subtitles === 'string' ? data.subtitles : '';
      var autoplay = data.autoplay === true;
      var loop = data.loop === true;
      var muted = data.muted === true;

      container.classList.add('aacrom-block-multimedia-video');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-block-multimedia-video__wrapper';

      // Aspect ratio container (16:9 por default, o según width/height)
      var aspectBox = document.createElement('div');
      aspectBox.className = 'aacrom-block-multimedia-video__aspect';

      if (typeof data.width === 'number' && typeof data.height === 'number' && data.width > 0) {
        var ratio = (data.height / data.width) * 100;
        aspectBox.style.paddingBottom = ratio.toFixed(2) + '%';
      }

      // Video element
      var video = document.createElement('video');
      video.className = 'aacrom-block-multimedia-video__player';
      video.controls = true;
      video.preload = 'metadata';
      video.src = src;
      if (poster) video.poster = poster;
      if (autoplay) video.autoplay = true;
      if (loop) video.loop = true;
      if (muted || autoplay) video.muted = true;
      video.setAttribute('playsinline', '');

      // Subtítulos
      if (subtitles) {
        var track = document.createElement('track');
        track.kind = 'subtitles';
        track.src = subtitles;
        track.label = 'Español';
        track.srclang = 'es';
        track.setAttribute('default', '');
        video.appendChild(track);
      }

      // Texto fallback
      video.appendChild(document.createTextNode(
        'Su navegador no soporta el reproductor de video.'
      ));

      // Error de carga: detectar varios eventos para ser más robusto
      var errorShown = false;
      function showError(reason) {
        if (errorShown) return;
        errorShown = true;
        // Ocultar el video y mostrar mensaje
        aspectBox.style.display = 'none';
        var err = document.createElement('div');
        err.className = 'aacrom-block-multimedia-video__error';
        err.textContent = reason || ('Video no disponible: ' + src);
        wrapper.insertBefore(err, aspectBox);
      }

      video.addEventListener('error', function () {
        showError();
      });

      // Si después de 3 segundos el video no tiene metadata cargada,
      // probablemente la URL es inválida
      setTimeout(function () {
        if (!errorShown && video.readyState === 0 && !video.networkState) {
          showError('Video no disponible: ' + src);
        }
      }, 3000);

      aspectBox.appendChild(video);
      wrapper.appendChild(aspectBox);

      // Caption visible
      if (caption) {
        var capEl = document.createElement('div');
        capEl.className = 'aacrom-block-multimedia-video__caption';
        capEl.textContent = caption;
        wrapper.appendChild(capEl);
      }

      // Transcripción colapsable
      if (transcription) {
        var details = document.createElement('details');
        details.className = 'aacrom-block-multimedia-video__transcription';

        var summary = document.createElement('summary');
        summary.className = 'aacrom-block-multimedia-video__transcription-toggle';
        summary.textContent = 'Ver transcripción';
        details.appendChild(summary);

        var transEl = document.createElement('div');
        transEl.className = 'aacrom-block-multimedia-video__transcription-text';
        transEl.textContent = transcription;
        details.appendChild(transEl);

        wrapper.appendChild(details);
      }

      container.appendChild(wrapper);
    }
  });

})(window);
