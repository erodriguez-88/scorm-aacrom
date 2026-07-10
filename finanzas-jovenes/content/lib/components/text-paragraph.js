/**
 * Componente: text-paragraph
 *
 * Renderiza uno o más párrafos. Acepta HTML básico ya sanitizado
 * para preservar formato del guion (negritas, cursivas, listas, enlaces).
 *
 * Estructura del data:
 *   {
 *     text: "<p>Texto en HTML básico...</p>"  // requerido
 *   }
 *
 * Tags HTML permitidos:
 *   p, br, strong, b, em, i, u, mark, sup, sub,
 *   a (con href, target, rel),
 *   ul, ol, li,
 *   span (con style limitado)
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[text-paragraph] AacromRuntime no disponible.');
    return;
  }

  // Tags permitidos. Cualquier otra etiqueta se elimina (su contenido se preserva).
  var ALLOWED_TAGS = [
    'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'MARK', 'SUP', 'SUB',
    'A', 'UL', 'OL', 'LI', 'SPAN'
  ];

  // Atributos permitidos por tag.
  var ALLOWED_ATTRS = {
    'A': ['href', 'target', 'rel', 'title'],
    'SPAN': ['class'],
    'P': ['class'],
    'UL': ['class'],
    'OL': ['class'],
    'LI': ['class']
  };

  /**
   * Sanitiza HTML eliminando tags y atributos no permitidos.
   * Trabaja sobre un DOM temporal para no usar regex sobre HTML.
   */
  function sanitizeHtml(html) {
    var template = document.createElement('div');
    template.innerHTML = html;

    function clean(node) {
      // Recorrer hijos en reversa porque podemos eliminar nodos
      var children = Array.prototype.slice.call(node.childNodes);
      children.forEach(function (child) {
        if (child.nodeType === 1) {
          // Element
          var tag = child.tagName;

          if (ALLOWED_TAGS.indexOf(tag) === -1) {
            // Tag no permitido: reemplazar por sus hijos
            var parent = child.parentNode;
            while (child.firstChild) {
              parent.insertBefore(child.firstChild, child);
            }
            parent.removeChild(child);
          } else {
            // Tag permitido: limpiar atributos
            var allowedAttrs = ALLOWED_ATTRS[tag] || [];
            var attrsToRemove = [];
            for (var i = 0; i < child.attributes.length; i++) {
              var attr = child.attributes[i];
              if (allowedAttrs.indexOf(attr.name) === -1) {
                attrsToRemove.push(attr.name);
              }
            }
            attrsToRemove.forEach(function (a) { child.removeAttribute(a); });

            // Sanitizar href para evitar javascript: y data:
            if (tag === 'A') {
              var href = child.getAttribute('href') || '';
              if (/^\s*(javascript|data|vbscript):/i.test(href)) {
                child.removeAttribute('href');
              }
              // Si es enlace externo, agregar rel=noopener para seguridad
              if (child.getAttribute('target') === '_blank') {
                child.setAttribute('rel', 'noopener noreferrer');
              }
            }

            // Recursión
            clean(child);
          }
        } else if (child.nodeType === 8) {
          // Comentario: eliminar
          child.parentNode.removeChild(child);
        }
        // Texto y otros: dejar como están
      });
    }

    clean(template);
    return template.innerHTML;
  }

  global.AacromRuntime.register('text-paragraph', {
    render: function (block, container) {
      var data = block.data || {};
      var text = typeof data.text === 'string' ? data.text : '';

      container.classList.add('aacrom-block-text-paragraph');

      var inner = document.createElement('div');
      inner.className = 'aacrom-block-text-paragraph__content';

      // Si el texto no contiene tags HTML, envolver en <p>
      if (!/<[a-z][^>]*>/i.test(text)) {
        var p = document.createElement('p');
        p.textContent = text;
        inner.appendChild(p);
      } else {
        inner.innerHTML = sanitizeHtml(text);
      }

      container.appendChild(inner);
    }
  });

})(window);
