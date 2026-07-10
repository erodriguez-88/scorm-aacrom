/**
 * Componente: interactive-process
 *
 * Proceso secuencial de pasos. El estudiante ve un paso a la vez
 * y avanza al siguiente. Útil para describir procedimientos en orden.
 *
 * Estructura del data:
 *   {
 *     steps: [
 *       {
 *         id: "step-1",
 *         title: "Nombre del paso",
 *         description: "<p>HTML del paso</p>",
 *         media: { type: "image", src, alt }   // opcional
 *       }
 *     ]
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[interactive-process] AacromRuntime no disponible.');
    return;
  }

  var ALLOWED_TAGS = ['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'MARK',
                      'A', 'UL', 'OL', 'LI', 'SPAN'];
  var ALLOWED_ATTRS = { 'A': ['href', 'target', 'rel', 'title'] };

  function sanitizeHtml(html) {
    var div = document.createElement('div');
    div.innerHTML = html || '';
    function clean(node) {
      var children = Array.prototype.slice.call(node.childNodes);
      children.forEach(function (child) {
        if (child.nodeType === 1) {
          var tag = child.tagName;
          if (ALLOWED_TAGS.indexOf(tag) === -1) {
            var parent = child.parentNode;
            while (child.firstChild) parent.insertBefore(child.firstChild, child);
            parent.removeChild(child);
          } else {
            var allowedAttrs = ALLOWED_ATTRS[tag] || [];
            var toRemove = [];
            for (var i = 0; i < child.attributes.length; i++) {
              if (allowedAttrs.indexOf(child.attributes[i].name) === -1) {
                toRemove.push(child.attributes[i].name);
              }
            }
            toRemove.forEach(function (a) { child.removeAttribute(a); });
            if (tag === 'A') {
              var href = child.getAttribute('href') || '';
              if (/^\s*(javascript|data|vbscript):/i.test(href)) child.removeAttribute('href');
              if (child.getAttribute('target') === '_blank') {
                child.setAttribute('rel', 'noopener noreferrer');
              }
            }
            clean(child);
          }
        } else if (child.nodeType === 8) {
          child.parentNode.removeChild(child);
        }
      });
    }
    clean(div);
    return div.innerHTML;
  }

  global.AacromRuntime.register('interactive-process', {
    render: function (block, container) {
      var data = block.data || {};
      var steps = Array.isArray(data.steps) ? data.steps : [];

      if (steps.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Proceso sin pasos declarados</p>';
        return;
      }

      container.classList.add('aacrom-block-process');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-process';

      var state = { current: 0 };

      // Indicador de progreso (numeritos en línea)
      var progress = document.createElement('div');
      progress.className = 'aacrom-process__progress';
      progress.setAttribute('role', 'tablist');
      progress.setAttribute('aria-label', 'Pasos del proceso');

      steps.forEach(function (step, index) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'aacrom-process__dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', 'Paso ' + (index + 1) + ': ' + (step.title || ''));
        dot.textContent = String(index + 1);
        if (index === 0) dot.classList.add('aacrom-process__dot--active');

        dot.addEventListener('click', function () {
          goToStep(index);
        });

        progress.appendChild(dot);

        // Línea conectora entre pasos
        if (index < steps.length - 1) {
          var line = document.createElement('div');
          line.className = 'aacrom-process__line';
          line.setAttribute('aria-hidden', 'true');
          progress.appendChild(line);
        }
      });

      // Container del paso actual
      var stepArea = document.createElement('div');
      stepArea.className = 'aacrom-process__step-area';
      stepArea.setAttribute('role', 'tabpanel');
      stepArea.setAttribute('aria-live', 'polite');

      // Botones de navegación
      var nav = document.createElement('div');
      nav.className = 'aacrom-process__nav';

      var prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'aacrom-process__nav-btn aacrom-process__nav-btn--prev';
      prevBtn.textContent = '← Anterior';

      var nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'aacrom-process__nav-btn aacrom-process__nav-btn--next';
      nextBtn.textContent = 'Siguiente →';

      nav.appendChild(prevBtn);
      nav.appendChild(nextBtn);

      function renderStep(idx) {
        var step = steps[idx];
        if (!step) return;

        stepArea.innerHTML = '';

        var stepNum = document.createElement('div');
        stepNum.className = 'aacrom-process__step-number';
        stepNum.textContent = 'Paso ' + (idx + 1) + ' de ' + steps.length;
        stepArea.appendChild(stepNum);

        var title = document.createElement('h3');
        title.className = 'aacrom-process__step-title';
        title.textContent = step.title || '';
        stepArea.appendChild(title);

        if (step.description) {
          var desc = document.createElement('div');
          desc.className = 'aacrom-process__step-description';
          desc.innerHTML = sanitizeHtml(step.description);
          stepArea.appendChild(desc);
        }

        if (step.media && step.media.type === 'image' && step.media.src) {
          var media = document.createElement('div');
          media.className = 'aacrom-process__step-media';
          var img = document.createElement('img');
          img.src = step.media.src;
          img.alt = step.media.alt || '';
          img.setAttribute('loading', 'lazy');
          media.appendChild(img);
          stepArea.appendChild(media);
        }

        // Actualizar dots
        var allDots = progress.querySelectorAll('.aacrom-process__dot');
        allDots.forEach(function (d, i) {
          d.classList.toggle('aacrom-process__dot--active', i === idx);
          d.classList.toggle('aacrom-process__dot--completed', i < idx);
          d.setAttribute('aria-selected', i === idx ? 'true' : 'false');
        });

        // Actualizar líneas
        var allLines = progress.querySelectorAll('.aacrom-process__line');
        allLines.forEach(function (l, i) {
          l.classList.toggle('aacrom-process__line--completed', i < idx);
        });

        prevBtn.disabled = idx === 0;
        nextBtn.disabled = idx === steps.length - 1;
      }

      function goToStep(idx) {
        if (idx < 0 || idx >= steps.length) return;
        state.current = idx;
        renderStep(idx);
      }

      prevBtn.addEventListener('click', function () { goToStep(state.current - 1); });
      nextBtn.addEventListener('click', function () { goToStep(state.current + 1); });

      wrapper.appendChild(progress);
      wrapper.appendChild(stepArea);
      wrapper.appendChild(nav);
      container.appendChild(wrapper);

      renderStep(0);
    }
  });

})(window);
