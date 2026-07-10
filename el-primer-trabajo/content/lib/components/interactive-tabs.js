/**
 * Componente: interactive-tabs
 *
 * Pestañas horizontales con contenido distinto en cada una.
 * Solo una pestaña activa a la vez.
 *
 * Estructura del data:
 *   {
 *     tabs: [
 *       {
 *         id: "tab-1",
 *         title: "Etiqueta visible",
 *         content: "<p>HTML del contenido</p>"
 *       }
 *     ]
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[interactive-tabs] AacromRuntime no disponible.');
    return;
  }

  var ALLOWED_TAGS = ['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'MARK',
                      'A', 'UL', 'OL', 'LI', 'SPAN', 'IMG'];
  var ALLOWED_ATTRS = {
    'A': ['href', 'target', 'rel', 'title'],
    'IMG': ['src', 'alt', 'loading']
  };

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

  global.AacromRuntime.register('interactive-tabs', {
    render: function (block, container) {
      var data = block.data || {};
      var tabs = Array.isArray(data.tabs) ? data.tabs : [];

      if (tabs.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Pestañas sin items declarados</p>';
        return;
      }

      container.classList.add('aacrom-block-tabs');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-tabs';

      // Lista de tabs (botones)
      var tablist = document.createElement('div');
      tablist.className = 'aacrom-tabs__list';
      tablist.setAttribute('role', 'tablist');

      // Container de paneles
      var panels = document.createElement('div');
      panels.className = 'aacrom-tabs__panels';

      tabs.forEach(function (tab, index) {
        var tabId = tab.id || ('tab-' + index);
        var btnId = 'aacrom-' + tabId + '-btn';
        var panelId = 'aacrom-' + tabId + '-panel';
        var isFirst = index === 0;

        // Botón del tab
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = btnId;
        btn.className = 'aacrom-tabs__tab';
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', isFirst ? 'true' : 'false');
        btn.setAttribute('aria-controls', panelId);
        btn.setAttribute('tabindex', isFirst ? '0' : '-1');
        btn.textContent = tab.title || '';
        if (isFirst) btn.classList.add('aacrom-tabs__tab--active');

        // Panel
        var panel = document.createElement('div');
        panel.id = panelId;
        panel.className = 'aacrom-tabs__panel';
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', btnId);
        panel.setAttribute('tabindex', '0');
        if (!isFirst) panel.setAttribute('hidden', '');

        var inner = document.createElement('div');
        inner.className = 'aacrom-tabs__panel-inner';
        inner.innerHTML = sanitizeHtml(tab.content || '');
        panel.appendChild(inner);

        // Click handler
        btn.addEventListener('click', function () {
          activateTab(index);
        });

        // Teclas: flechas izquierda/derecha
        btn.addEventListener('keydown', function (e) {
          var newIndex = -1;
          if (e.key === 'ArrowRight') newIndex = (index + 1) % tabs.length;
          else if (e.key === 'ArrowLeft') newIndex = (index - 1 + tabs.length) % tabs.length;
          else if (e.key === 'Home') newIndex = 0;
          else if (e.key === 'End') newIndex = tabs.length - 1;

          if (newIndex !== -1) {
            e.preventDefault();
            activateTab(newIndex);
            tablist.querySelectorAll('.aacrom-tabs__tab')[newIndex].focus();
          }
        });

        tablist.appendChild(btn);
        panels.appendChild(panel);
      });

      function activateTab(idx) {
        var allBtns = tablist.querySelectorAll('.aacrom-tabs__tab');
        var allPanels = panels.querySelectorAll('.aacrom-tabs__panel');
        allBtns.forEach(function (b, i) {
          var active = i === idx;
          b.setAttribute('aria-selected', active ? 'true' : 'false');
          b.setAttribute('tabindex', active ? '0' : '-1');
          b.classList.toggle('aacrom-tabs__tab--active', active);
        });
        allPanels.forEach(function (p, i) {
          if (i === idx) p.removeAttribute('hidden');
          else p.setAttribute('hidden', '');
        });
      }

      wrapper.appendChild(tablist);
      wrapper.appendChild(panels);
      container.appendChild(wrapper);
    }
  });

})(window);
