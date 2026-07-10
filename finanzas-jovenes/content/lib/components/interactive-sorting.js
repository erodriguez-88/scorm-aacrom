/**
 * Componente: interactive-sorting
 *
 * Actividad de clasificación: el estudiante asigna items a categorías.
 * Cada item tiene una categoría correcta. Se muestra feedback al final.
 *
 * Implementación accesible: en lugar de drag-and-drop puro (que tiene
 * problemas en mobile y screen readers), usamos selects/dropdowns
 * que permiten cualquier dispositivo de entrada.
 *
 * Estructura del data:
 *   {
 *     instructions: "<p>Instrucciones HTML opcionales</p>",
 *     categories: [
 *       { id: "cat-a", label: "Categoría A" },
 *       { id: "cat-b", label: "Categoría B" }
 *     ],
 *     items: [
 *       { id: "i1", text: "Item 1", correctCategory: "cat-a" },
 *       { id: "i2", text: "Item 2", correctCategory: "cat-b" }
 *     ],
 *     feedback: {
 *       allCorrect: "Texto cuando todo está bien",
 *       hasErrors: "Texto cuando hay errores"
 *     }
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[interactive-sorting] AacromRuntime no disponible.');
    return;
  }

  var ALLOWED_TAGS = ['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'A', 'SPAN', 'UL', 'OL', 'LI'];
  var ALLOWED_ATTRS = { 'A': ['href', 'target', 'rel'] };

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

  global.AacromRuntime.register('interactive-sorting', {
    render: function (block, container) {
      var data = block.data || {};
      var categories = Array.isArray(data.categories) ? data.categories : [];
      var items = Array.isArray(data.items) ? data.items : [];
      var instructions = typeof data.instructions === 'string' ? data.instructions : '';
      var feedback = (data.feedback && typeof data.feedback === 'object') ? data.feedback : {};

      if (categories.length === 0 || items.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Sorting sin categorías o sin items</p>';
        return;
      }

      container.classList.add('aacrom-block-sorting');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-sorting';

      // Instrucciones
      if (instructions) {
        var instr = document.createElement('div');
        instr.className = 'aacrom-sorting__instructions';
        instr.innerHTML = sanitizeHtml(instructions);
        wrapper.appendChild(instr);
      }

      var hint = document.createElement('p');
      hint.className = 'aacrom-sorting__hint';
      hint.textContent = 'Asigne cada item a la categoría correcta usando el selector.';
      wrapper.appendChild(hint);

      // Lista de items con selector
      var itemsList = document.createElement('div');
      itemsList.className = 'aacrom-sorting__items';

      var state = {};  // { itemId: selectedCategoryId }
      var answered = false;

      items.forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'aacrom-sorting__item';
        row.setAttribute('data-item-id', item.id);

        var label = document.createElement('label');
        label.className = 'aacrom-sorting__item-label';
        var labelId = 'aacrom-sort-' + item.id + '-label';
        label.id = labelId;
        label.textContent = item.text || '';
        var selectId = 'aacrom-sort-' + item.id + '-select';
        label.setAttribute('for', selectId);

        var select = document.createElement('select');
        select.id = selectId;
        select.className = 'aacrom-sorting__item-select';
        select.setAttribute('aria-labelledby', labelId);

        var defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '— Seleccione —';
        select.appendChild(defaultOpt);

        categories.forEach(function (cat) {
          var opt = document.createElement('option');
          opt.value = cat.id;
          opt.textContent = cat.label;
          select.appendChild(opt);
        });

        select.addEventListener('change', function () {
          if (answered) return;
          state[item.id] = select.value;
          submitBtn.disabled = !allItemsAnswered();
        });

        row.appendChild(label);
        row.appendChild(select);
        itemsList.appendChild(row);
      });

      wrapper.appendChild(itemsList);

      // Botón de envío
      var submitBtn = document.createElement('button');
      submitBtn.type = 'button';
      submitBtn.className = 'aacrom-sorting__submit';
      submitBtn.textContent = 'Comprobar respuestas';
      submitBtn.disabled = true;
      wrapper.appendChild(submitBtn);

      // Feedback
      var feedbackEl = document.createElement('div');
      feedbackEl.className = 'aacrom-sorting__feedback';
      feedbackEl.setAttribute('role', 'status');
      feedbackEl.setAttribute('aria-live', 'polite');
      feedbackEl.hidden = true;
      wrapper.appendChild(feedbackEl);

      // Retake
      var retakeBtn = document.createElement('button');
      retakeBtn.type = 'button';
      retakeBtn.className = 'aacrom-sorting__retake';
      retakeBtn.textContent = 'Intentar de nuevo';
      retakeBtn.hidden = true;
      wrapper.appendChild(retakeBtn);

      function allItemsAnswered() {
        return items.every(function (it) {
          return state[it.id] && state[it.id] !== '';
        });
      }

      submitBtn.addEventListener('click', function () {
        if (answered) return;
        answered = true;

        var correctCount = 0;
        items.forEach(function (item) {
          var row = itemsList.querySelector('[data-item-id="' + item.id + '"]');
          var sel = row.querySelector('select');
          var isCorrect = state[item.id] === item.correctCategory;
          if (isCorrect) correctCount++;
          row.classList.add(isCorrect
            ? 'aacrom-sorting__item--correct'
            : 'aacrom-sorting__item--wrong');
          sel.disabled = true;
          // Si es incorrecto, mostrar la categoría correcta
          if (!isCorrect) {
            var correctCat = categories.filter(function (c) {
              return c.id === item.correctCategory;
            })[0];
            if (correctCat) {
              var hint2 = document.createElement('span');
              hint2.className = 'aacrom-sorting__correct-hint';
              hint2.textContent = '→ Correcto: ' + correctCat.label;
              row.appendChild(hint2);
            }
          }
        });

        var allCorrect = correctCount === items.length;
        feedbackEl.hidden = false;
        feedbackEl.classList.remove('aacrom-sorting__feedback--correct',
                                    'aacrom-sorting__feedback--incorrect');
        feedbackEl.classList.add(allCorrect
          ? 'aacrom-sorting__feedback--correct'
          : 'aacrom-sorting__feedback--incorrect');
        feedbackEl.innerHTML = '';
        var head = document.createElement('strong');
        head.textContent = allCorrect ? '✓ Excelente' : '✗ Hay aciertos parciales';
        feedbackEl.appendChild(head);
        var msg = document.createElement('p');
        msg.textContent = allCorrect
          ? (feedback.allCorrect || 'Todas las respuestas son correctas.')
          : ((feedback.hasErrors || 'Acertó ') +
             (feedback.hasErrors ? '' : correctCount + ' de ' + items.length + '. Revise los hints.'));
        feedbackEl.appendChild(msg);

        submitBtn.hidden = true;
        if (!allCorrect) retakeBtn.hidden = false;
      });

      retakeBtn.addEventListener('click', function () {
        answered = false;
        state = {};
        feedbackEl.hidden = true;
        retakeBtn.hidden = true;
        submitBtn.hidden = false;
        submitBtn.disabled = true;
        var rows = itemsList.querySelectorAll('.aacrom-sorting__item');
        rows.forEach(function (r) {
          r.classList.remove('aacrom-sorting__item--correct',
                             'aacrom-sorting__item--wrong');
          r.querySelector('select').disabled = false;
          r.querySelector('select').value = '';
          var hint2 = r.querySelector('.aacrom-sorting__correct-hint');
          if (hint2) hint2.remove();
        });
      });

      container.appendChild(wrapper);
    }
  });

})(window);
