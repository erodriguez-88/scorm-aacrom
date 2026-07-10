/**
 * Componente: text-heading
 *
 * Renderiza un encabezado (h1, h2, h3) con texto plano.
 *
 * Estructura del data:
 *   {
 *     level: 1 | 2 | 3,           // opcional, default 2
 *     text: "Texto del encabezado", // requerido
 *     alignment: "left" | "center" | "right"  // opcional, default "left"
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[text-heading] AacromRuntime no disponible, no se registrará el componente.');
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

  global.AacromRuntime.register('text-heading', {
    render: function (block, container) {
      var data = block.data || {};
      var level = data.level;

      // Validar level
      if (level !== 1 && level !== 2 && level !== 3) {
        level = 2;
      }

      var text = typeof data.text === 'string' ? data.text : '';
      var alignment = data.alignment;
      if (alignment !== 'center' && alignment !== 'right') {
        alignment = 'left';
      }

      // Construir el HTML
      var heading = document.createElement('h' + level);
      heading.className =
        'aacrom-block-text-heading__title ' +
        'aacrom-block-text-heading__title--level-' + level + ' ' +
        'aacrom-block-text-heading__title--align-' + alignment;
      heading.textContent = text;

      container.classList.add('aacrom-block-text-heading');
      container.appendChild(heading);
    }
  });

})(window);
