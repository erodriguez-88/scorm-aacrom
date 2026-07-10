/**
 * Componente: interactive-accordion
 *
 * Lista de secciones expandibles. Cada sección tiene un título visible
 * y un contenido que se muestra/oculta al hacer click.
 *
 * Estructura del data:
 *   {
 *     allowMultiple: false,       // true = varias abiertas a la vez, false = solo una
 *     items: [
 *       {
 *         id: "item-1",
 *         title: "Título visible",
 *         content: "<p>HTML del contenido</p>"
 *       }
 *     ]
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[interactive-accordion] AacromRuntime no disponible.');
    return;
  }

  // Sanitizador básico
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

  global.AacromRuntime.register('interactive-accordion', {
    render: function (block, container) {
      var data = block.data || {};
      var items = Array.isArray(data.items) ? data.items : [];
      var allowMultiple = data.allowMultiple === true;

      if (items.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Acordeón sin secciones declaradas</p>';
        return;
      }

      container.classList.add('aacrom-block-accordion');

      var list = document.createElement('div');
      list.className = 'aacrom-accordion';
      list.setAttribute('role', 'group');
      list.setAttribute('data-allow-multiple', allowMultiple ? 'true' : 'false');

      items.forEach(function (item, index) {
        var itemId = item.id || ('accordion-item-' + index);
        var titleId = 'aacrom-' + itemId + '-title';
        var panelId = 'aacrom-' + itemId + '-panel';

        var section = document.createElement('div');
        section.className = 'aacrom-accordion__item';
        section.setAttribute('data-item-id', itemId);

        // Botón del título
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = titleId;
        btn.className = 'aacrom-accordion__title';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', panelId);

        var titleText = document.createElement('span');
        titleText.className = 'aacrom-accordion__title-text';
        titleText.textContent = item.title || '';
        btn.appendChild(titleText);

        var icon = document.createElement('span');
        icon.className = 'aacrom-accordion__icon';
        icon.setAttribute('aria-hidden', 'true');
        // El icono se dibuja con pseudo-elementos en CSS (cruz geométrica
        // que se transforma a "−" cuando aria-expanded="true").
        btn.appendChild(icon);

        // Panel de contenido
        var panel = document.createElement('div');
        panel.id = panelId;
        panel.className = 'aacrom-accordion__panel';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-labelledby', titleId);
        panel.setAttribute('aria-hidden', 'true');

        var inner = document.createElement('div');
        inner.className = 'aacrom-accordion__panel-inner';
        inner.innerHTML = sanitizeHtml(item.content || '');
        panel.appendChild(inner);

        // Click handler
        btn.addEventListener('click', function () {
          var isExpanded = btn.getAttribute('aria-expanded') === 'true';

          if (!allowMultiple && !isExpanded) {
            // Cerrar otros si solo uno puede estar abierto
            var allBtns = list.querySelectorAll('.aacrom-accordion__title');
            var allPanels = list.querySelectorAll('.aacrom-accordion__panel');
            allBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
            allPanels.forEach(function (p) { p.setAttribute('aria-hidden', 'true'); });
            // El icono cambia visualmente vía CSS según aria-expanded;
            // no hace falta modificar textContent.
          }

          var newExpanded = !isExpanded;
          btn.setAttribute('aria-expanded', newExpanded ? 'true' : 'false');
          panel.setAttribute('aria-hidden', newExpanded ? 'false' : 'true');
        });

        section.appendChild(btn);
        section.appendChild(panel);
        list.appendChild(section);
      });

      container.appendChild(list);
    }
  });

})(window);
