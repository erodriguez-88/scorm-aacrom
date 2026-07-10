/**
 * Componente: multimedia-image
 *
 * Renderiza una imagen con caption opcional. Lazy load por defecto.
 *
 * Estructura del data:
 *   {
 *     src: "assets/images/imagen.jpg",     // requerido
 *     alt: "Descripción accesible",        // recomendado para accesibilidad
 *     caption: "Pie de imagen visible",    // opcional
 *     width: 1200,                         // opcional, en píxeles
 *     height: 800,                         // opcional, en píxeles
 *     alignment: "left" | "center" | "right",  // opcional, default "center"
 *     size: "small" | "medium" | "large" | "full"  // opcional, default "full"
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[multimedia-image] AacromRuntime no disponible.');
    return;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  global.AacromRuntime.register('multimedia-image', {
    render: function (block, container) {
      var data = block.data || {};
      var src = data.src;

      if (!src || typeof src !== 'string') {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Imagen sin atributo src</p>';
        return;
      }

      var alt = typeof data.alt === 'string' ? data.alt : '';
      var caption = typeof data.caption === 'string' ? data.caption : '';
      var alignment = data.alignment;
      if (alignment !== 'left' && alignment !== 'right') {
        alignment = 'center';
      }
      var size = data.size;
      if (['small', 'medium', 'large', 'full'].indexOf(size) === -1) {
        size = 'full';
      }

      container.classList.add('aacrom-block-multimedia-image');
      container.classList.add('aacrom-block-multimedia-image--align-' + alignment);
      container.classList.add('aacrom-block-multimedia-image--size-' + size);

      // Figure semánticamente correcto si hay caption
      var fig = document.createElement('figure');
      fig.className = 'aacrom-block-multimedia-image__figure';

      var img = document.createElement('img');
      img.className = 'aacrom-block-multimedia-image__img';
      img.src = src;
      img.alt = alt;
      img.setAttribute('loading', 'lazy');

      if (typeof data.width === 'number') img.width = data.width;
      if (typeof data.height === 'number') img.height = data.height;

      // Manejo de error de carga
      img.addEventListener('error', function () {
        img.style.display = 'none';
        var err = document.createElement('div');
        err.className = 'aacrom-block-multimedia-image__error';
        err.textContent = 'Imagen no disponible: ' + src;
        fig.insertBefore(err, fig.firstChild);
      });

      fig.appendChild(img);

      if (caption) {
        var capEl = document.createElement('figcaption');
        capEl.className = 'aacrom-block-multimedia-image__caption';
        capEl.textContent = caption;
        fig.appendChild(capEl);
      }

      container.appendChild(fig);
    }
  });

})(window);
