/**
 * Componente: text-list
 *
 * Lista de items con viñetas (bullet) o numerada (ordered).
 * Cada item puede tener formato HTML básico (negritas, itálicas, links).
 *
 * Estructura del data:
 *   {
 *     listType: "bullet" | "ordered",   // default: bullet
 *     items: [
 *       "Texto plano del item",
 *       "<p>Texto con <strong>HTML</strong></p>"
 *     ]
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[text-list] AacromRuntime no disponible.');
    return;
  }

  var ALLOWED_TAGS = ['STRONG', 'B', 'EM', 'I', 'U', 'MARK', 'A', 'SPAN', 'BR'];
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

  global.AacromRuntime.register('text-list', {
    render: function (block, container) {
      var data = block.data || {};
      var items = Array.isArray(data.items) ? data.items : [];
      var listType = data.listType === 'ordered' ? 'ordered' : 'bullet';

      if (items.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Lista sin items declarados</p>';
        return;
      }

      container.classList.add('aacrom-block-text-list');

      var listEl = document.createElement(listType === 'ordered' ? 'ol' : 'ul');
      listEl.className = 'aacrom-list aacrom-list--' + listType;

      items.forEach(function (item) {
        var li = document.createElement('li');
        li.className = 'aacrom-list__item';
        // Sanitizar para evitar HTML peligroso
        li.innerHTML = sanitizeHtml(typeof item === 'string' ? item : '');
        listEl.appendChild(li);
      });

      container.appendChild(listEl);
    }
  });

})(window);
