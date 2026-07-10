/**
 * Componente: impact-statement
 *
 * Bloque visualmente prominente. Cubre las dos variantes observadas
 * en datos reales del SCORM LGCP:
 *
 *   - variant 'note': bloque de retroalimentación o nota destacada,
 *     más compacto, suele tener un heading corto + párrafo.
 *
 *   - variant 'b': bloque de gran impacto (banner) con encabezado
 *     muy grande y párrafo de soporte.
 *
 * Estructura del data:
 *   {
 *     variant: "note" | "b",
 *     heading: "<p>HTML del encabezado</p>",
 *     paragraph: "<p>HTML del cuerpo</p>"
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[impact-statement] AacromRuntime no disponible.');
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

  global.AacromRuntime.register('impact-statement', {
    render: function (block, container) {
      var data = block.data || {};
      var variant = (data.variant === 'b') ? 'b' : 'note';
      var heading = typeof data.heading === 'string' ? data.heading : '';
      var paragraph = typeof data.paragraph === 'string' ? data.paragraph : '';

      if (!heading && !paragraph) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'impact-statement vacío (sin heading ni paragraph)</p>';
        return;
      }

      container.classList.add('aacrom-block-impact');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-impact aacrom-impact--' + variant;
      wrapper.setAttribute('role', 'note');

      // Variant 'note': icono pequeño + heading + paragraph (compacto)
      if (variant === 'note') {
        var icon = document.createElement('span');
        icon.className = 'aacrom-impact__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '!';
        wrapper.appendChild(icon);

        var content = document.createElement('div');
        content.className = 'aacrom-impact__content';

        if (heading) {
          var headingEl = document.createElement('div');
          headingEl.className = 'aacrom-impact__heading';
          headingEl.innerHTML = sanitizeHtml(heading);
          content.appendChild(headingEl);
        }
        if (paragraph) {
          var paragraphEl = document.createElement('div');
          paragraphEl.className = 'aacrom-impact__paragraph';
          paragraphEl.innerHTML = sanitizeHtml(paragraph);
          content.appendChild(paragraphEl);
        }
        wrapper.appendChild(content);
      }
      // Variant 'b': bloque tipo banner con tipografía mucho más grande
      else {
        if (heading) {
          var bigHeading = document.createElement('div');
          bigHeading.className = 'aacrom-impact__big-heading';
          bigHeading.innerHTML = sanitizeHtml(heading);
          wrapper.appendChild(bigHeading);
        }
        if (paragraph) {
          var bigParagraph = document.createElement('div');
          bigParagraph.className = 'aacrom-impact__big-paragraph';
          bigParagraph.innerHTML = sanitizeHtml(paragraph);
          wrapper.appendChild(bigParagraph);
        }
      }

      container.appendChild(wrapper);
    }
  });

})(window);
