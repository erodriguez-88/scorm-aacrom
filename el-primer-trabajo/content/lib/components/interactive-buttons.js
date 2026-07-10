/**
 * Componente: interactive-buttons
 *
 * Botones cliqueables que al hacer click revelan un contenido asociado.
 * Útil para mostrar definiciones, explicaciones o detalles bajo demanda.
 * Comparte similitud con flashcards pero el "front" es solo el botón
 * (no toda una tarjeta) y el "back" se muestra en un panel debajo.
 *
 * Estructura del data:
 *   {
 *     items: [
 *       {
 *         id: "btn-1",
 *         label: "Texto del botón",
 *         content: "<p>HTML que se revela</p>"
 *       }
 *     ]
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[interactive-buttons] AacromRuntime no disponible.');
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

  global.AacromRuntime.register('interactive-buttons', {
    render: function (block, container) {
      var data = block.data || {};
      var items = Array.isArray(data.items) ? data.items : [];

      if (items.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Bloque buttons sin items declarados</p>';
        return;
      }

      container.classList.add('aacrom-block-buttons');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-buttons';

      // Grid de botones
      var grid = document.createElement('div');
      grid.className = 'aacrom-buttons__grid';

      // Panel de contenido (debajo de los botones)
      var panel = document.createElement('div');
      panel.className = 'aacrom-buttons__panel';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-live', 'polite');
      panel.hidden = true;

      var visited = {};

      items.forEach(function (item, index) {
        var itemId = item.id || ('btn-' + index);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'aacrom-buttons__btn';
        btn.setAttribute('data-item-id', itemId);
        btn.setAttribute('aria-pressed', 'false');
        btn.textContent = item.label || ('Opción ' + (index + 1));

        btn.addEventListener('click', function () {
          // Desactivar otros
          var allBtns = grid.querySelectorAll('.aacrom-buttons__btn');
          allBtns.forEach(function (b) {
            b.setAttribute('aria-pressed', 'false');
            b.classList.remove('aacrom-buttons__btn--active');
          });
          // Activar éste
          btn.setAttribute('aria-pressed', 'true');
          btn.classList.add('aacrom-buttons__btn--active');
          visited[itemId] = true;
          if (Object.keys(visited).length > 0) {
            btn.classList.add('aacrom-buttons__btn--visited');
          }

          // Mostrar contenido
          panel.innerHTML = '';
          panel.hidden = false;
          var titleEl = document.createElement('h4');
          titleEl.className = 'aacrom-buttons__panel-title';
          titleEl.textContent = item.label || '';
          panel.appendChild(titleEl);

          var contentEl = document.createElement('div');
          contentEl.className = 'aacrom-buttons__panel-content';
          contentEl.innerHTML = sanitizeHtml(item.content || '');
          panel.appendChild(contentEl);
        });

        grid.appendChild(btn);
      });

      wrapper.appendChild(grid);
      wrapper.appendChild(panel);
      container.appendChild(wrapper);
    }
  });

})(window);
