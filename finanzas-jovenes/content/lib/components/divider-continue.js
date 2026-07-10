/**
 * Componente: divider-continue
 *
 * Bloque divisor con un botón "Continuar". Cuando el estudiante presiona
 * el botón, avanza automáticamente a la siguiente lección.
 *
 * Si no es la última lección: avanza a la siguiente.
 * Si es la última lección: marca el curso como completado.
 *
 * Estructura del data:
 *   {
 *     title: "Listo para continuar",       // opcional
 *     buttonText: "Continuar",             // opcional, default "Continuar"
 *     completeHint: "Avance al siguiente"  // opcional, texto auxiliar
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[divider-continue] AacromRuntime no disponible.');
    return;
  }

  global.AacromRuntime.register('divider-continue', {
    render: function (block, container) {
      var data = block.data || {};
      var title = typeof data.title === 'string' ? data.title : '';
      var buttonText = typeof data.buttonText === 'string' && data.buttonText
        ? data.buttonText
        : 'Continuar';
      var completeHint = typeof data.completeHint === 'string' ? data.completeHint : '';

      container.classList.add('aacrom-block-divider-continue');

      var inner = document.createElement('div');
      inner.className = 'aacrom-block-divider-continue__inner';

      if (title) {
        var titleEl = document.createElement('div');
        titleEl.className = 'aacrom-block-divider-continue__title';
        titleEl.textContent = title;
        inner.appendChild(titleEl);
      }

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aacrom-btn aacrom-btn--primary aacrom-block-divider-continue__btn';
      btn.textContent = buttonText;
      btn.setAttribute('aria-label', buttonText + ' a la siguiente lección');

      btn.addEventListener('click', function () {
        // Animar el botón antes de navegar
        btn.disabled = true;
        btn.classList.add('aacrom-block-divider-continue__btn--clicked');
        // Avanzar en el siguiente tick
        setTimeout(function () {
          if (global.AacromRuntime && typeof global.AacromRuntime.navigateNext === 'function') {
            global.AacromRuntime.navigateNext();
          }
        }, 150);
      });

      inner.appendChild(btn);

      if (completeHint) {
        var hint = document.createElement('div');
        hint.className = 'aacrom-block-divider-continue__hint';
        hint.textContent = completeHint;
        inner.appendChild(hint);
      }

      container.appendChild(inner);
    }
  });

})(window);
