/**
 * Componente: divider-section
 *
 * Separador estructural con título. A diferencia de divider-continue
 * (que es solo una línea + botón "Continuar"), este componente sirve
 * para dividir el contenido en secciones lógicas con un encabezado
 * visual distintivo. No interrumpe el flujo, solo lo organiza.
 *
 * Estructura del data:
 *   {
 *     title: "Sección 1: Introducción",
 *     subtitle: "Texto secundario opcional",
 *     style: "default" | "numbered" | "minimal"
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[divider-section] AacromRuntime no disponible.');
    return;
  }

  global.AacromRuntime.register('divider-section', {
    render: function (block, container) {
      var data = block.data || {};
      var title = typeof data.title === 'string' ? data.title : '';
      var subtitle = typeof data.subtitle === 'string' ? data.subtitle : '';
      var style = ['default', 'numbered', 'minimal'].indexOf(data.style) !== -1
        ? data.style
        : 'default';

      if (!title) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'divider-section sin título</p>';
        return;
      }

      container.classList.add('aacrom-block-divider-section');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-divider-section aacrom-divider-section--' + style;
      wrapper.setAttribute('role', 'separator');
      wrapper.setAttribute('aria-label', 'Inicio de sección: ' + title);

      var lineTop = document.createElement('div');
      lineTop.className = 'aacrom-divider-section__line';
      lineTop.setAttribute('aria-hidden', 'true');
      wrapper.appendChild(lineTop);

      var content = document.createElement('div');
      content.className = 'aacrom-divider-section__content';

      var titleEl = document.createElement('h2');
      titleEl.className = 'aacrom-divider-section__title';
      titleEl.textContent = title;
      content.appendChild(titleEl);

      if (subtitle) {
        var subtitleEl = document.createElement('p');
        subtitleEl.className = 'aacrom-divider-section__subtitle';
        subtitleEl.textContent = subtitle;
        content.appendChild(subtitleEl);
      }

      wrapper.appendChild(content);

      var lineBottom = document.createElement('div');
      lineBottom.className = 'aacrom-divider-section__line';
      lineBottom.setAttribute('aria-hidden', 'true');
      wrapper.appendChild(lineBottom);

      container.appendChild(wrapper);
    }
  });

})(window);
