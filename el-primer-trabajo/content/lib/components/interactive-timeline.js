/**
 * Componente: interactive-timeline
 *
 * Línea de tiempo con eventos secuenciales. A diferencia del proceso,
 * los items pueden tener fechas y se navegan con un eje horizontal
 * o vertical según el ancho disponible. Cada item puede tener media
 * opcional (audio típicamente, según datos del SCORM LGCP).
 *
 * Estructura del data:
 *   {
 *     items: [
 *       {
 *         id: "item-1",
 *         date: "2024",                          // string libre (puede ser vacío)
 *         title: "Título del evento",
 *         description: "<p>HTML</p>",
 *         media: {
 *           type: "audio",                       // o "image"
 *           src: "...",
 *           caption: "..."
 *         }
 *       }
 *     ]
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[interactive-timeline] AacromRuntime no disponible.');
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

  global.AacromRuntime.register('interactive-timeline', {
    render: function (block, container) {
      var data = block.data || {};
      var items = Array.isArray(data.items) ? data.items : [];

      if (items.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Línea de tiempo sin items declarados</p>';
        return;
      }

      container.classList.add('aacrom-block-timeline');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-timeline';

      var state = { current: 0 };

      // Eje horizontal con los hitos
      var axis = document.createElement('div');
      axis.className = 'aacrom-timeline__axis';
      axis.setAttribute('role', 'tablist');
      axis.setAttribute('aria-label', 'Eventos de la línea de tiempo');

      items.forEach(function (item, index) {
        var hit = document.createElement('button');
        hit.type = 'button';
        hit.className = 'aacrom-timeline__hit';
        hit.setAttribute('role', 'tab');
        hit.setAttribute('aria-label', 'Evento ' + (index + 1) +
          (item.date ? ' (' + item.date + ')' : '') +
          (item.title ? ': ' + item.title : ''));
        if (index === 0) hit.classList.add('aacrom-timeline__hit--active');

        var hitDot = document.createElement('span');
        hitDot.className = 'aacrom-timeline__hit-dot';
        hitDot.setAttribute('aria-hidden', 'true');
        hit.appendChild(hitDot);

        var hitDate = document.createElement('span');
        hitDate.className = 'aacrom-timeline__hit-date';
        hitDate.textContent = item.date || ('Hito ' + (index + 1));
        hit.appendChild(hitDate);

        hit.addEventListener('click', function () { goToItem(index); });
        axis.appendChild(hit);
      });

      // Área del item activo
      var detail = document.createElement('div');
      detail.className = 'aacrom-timeline__detail';
      detail.setAttribute('role', 'tabpanel');
      detail.setAttribute('aria-live', 'polite');

      // Navegación
      var nav = document.createElement('div');
      nav.className = 'aacrom-timeline__nav';

      var prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'aacrom-timeline__nav-btn aacrom-timeline__nav-btn--prev';
      prevBtn.textContent = '← Anterior';

      var nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'aacrom-timeline__nav-btn aacrom-timeline__nav-btn--next';
      nextBtn.textContent = 'Siguiente →';

      nav.appendChild(prevBtn);
      nav.appendChild(nextBtn);

      function renderItem(idx) {
        var item = items[idx];
        if (!item) return;

        detail.innerHTML = '';

        if (item.date) {
          var dateEl = document.createElement('div');
          dateEl.className = 'aacrom-timeline__detail-date';
          dateEl.textContent = item.date;
          detail.appendChild(dateEl);
        }

        if (item.title) {
          var titleEl = document.createElement('h3');
          titleEl.className = 'aacrom-timeline__detail-title';
          titleEl.textContent = item.title;
          detail.appendChild(titleEl);
        }

        if (item.description) {
          var desc = document.createElement('div');
          desc.className = 'aacrom-timeline__detail-description';
          desc.innerHTML = sanitizeHtml(item.description);
          detail.appendChild(desc);
        }

        if (item.media && item.media.src) {
          var media = document.createElement('div');
          media.className = 'aacrom-timeline__detail-media';
          if (item.media.type === 'audio') {
            var audio = document.createElement('audio');
            audio.controls = true;
            audio.preload = 'metadata';
            audio.src = item.media.src;
            media.appendChild(audio);
          } else if (item.media.type === 'image') {
            var img = document.createElement('img');
            img.src = item.media.src;
            img.alt = item.media.alt || '';
            img.setAttribute('loading', 'lazy');
            media.appendChild(img);
          }
          if (item.media.caption) {
            var cap = document.createElement('div');
            cap.className = 'aacrom-timeline__detail-caption';
            cap.textContent = item.media.caption;
            media.appendChild(cap);
          }
          detail.appendChild(media);
        }

        // Actualizar hits del eje
        var allHits = axis.querySelectorAll('.aacrom-timeline__hit');
        allHits.forEach(function (h, i) {
          h.classList.toggle('aacrom-timeline__hit--active', i === idx);
          h.classList.toggle('aacrom-timeline__hit--visited', i < idx);
          h.setAttribute('aria-selected', i === idx ? 'true' : 'false');
        });

        prevBtn.disabled = idx === 0;
        nextBtn.disabled = idx === items.length - 1;
      }

      function goToItem(idx) {
        if (idx < 0 || idx >= items.length) return;
        state.current = idx;
        renderItem(idx);
      }

      prevBtn.addEventListener('click', function () { goToItem(state.current - 1); });
      nextBtn.addEventListener('click', function () { goToItem(state.current + 1); });

      wrapper.appendChild(axis);
      wrapper.appendChild(detail);
      wrapper.appendChild(nav);
      container.appendChild(wrapper);

      renderItem(0);
    }
  });

})(window);
