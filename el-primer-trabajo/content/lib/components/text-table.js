/**
 * Componente: text-table
 *
 * Tabla con cabecera y filas de datos. Cada celda puede contener
 * HTML simple (negritas, itálicas, etc.).
 *
 * Estructura del data:
 *   {
 *     caption: "Título opcional de la tabla",
 *     headers: ["Columna 1", "Columna 2", "Columna 3"],
 *     rows: [
 *       ["fila 1 col 1", "fila 1 col 2", "fila 1 col 3"],
 *       ["fila 2 col 1", "fila 2 col 2", "fila 2 col 3"]
 *     ]
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[text-table] AacromRuntime no disponible.');
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

  global.AacromRuntime.register('text-table', {
    render: function (block, container) {
      var data = block.data || {};
      var headers = Array.isArray(data.headers) ? data.headers : [];
      var rows = Array.isArray(data.rows) ? data.rows : [];
      var caption = typeof data.caption === 'string' ? data.caption : '';

      if (headers.length === 0 && rows.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Tabla sin headers ni filas declaradas</p>';
        return;
      }

      container.classList.add('aacrom-block-text-table');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-table-wrapper';

      var table = document.createElement('table');
      table.className = 'aacrom-table';

      if (caption) {
        var captionEl = document.createElement('caption');
        captionEl.className = 'aacrom-table__caption';
        captionEl.textContent = caption;
        table.appendChild(captionEl);
      }

      // Header
      if (headers.length > 0) {
        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        headerRow.className = 'aacrom-table__header-row';
        headers.forEach(function (h) {
          var th = document.createElement('th');
          th.className = 'aacrom-table__header-cell';
          th.scope = 'col';
          th.innerHTML = sanitizeHtml(typeof h === 'string' ? h : '');
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
      }

      // Body
      var tbody = document.createElement('tbody');
      rows.forEach(function (row, rowIdx) {
        if (!Array.isArray(row)) return;
        var tr = document.createElement('tr');
        tr.className = 'aacrom-table__row';
        if (rowIdx % 2 === 1) tr.classList.add('aacrom-table__row--alt');
        row.forEach(function (cell) {
          var td = document.createElement('td');
          td.className = 'aacrom-table__cell';
          td.innerHTML = sanitizeHtml(typeof cell === 'string' ? cell : '');
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      wrapper.appendChild(table);
      container.appendChild(wrapper);
    }
  });

})(window);
