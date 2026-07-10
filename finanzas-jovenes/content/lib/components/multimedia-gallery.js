/**
 * Componente: multimedia-gallery
 *
 * Galería de imágenes en grid. Click en una imagen abre un lightbox
 * (vista ampliada con navegación entre imágenes).
 *
 * Estructura del data:
 *   {
 *     layout: "grid" | "row",        // default grid (2-3 columnas)
 *     items: [
 *       {
 *         id: "g-1",
 *         src: "url o data uri",
 *         alt: "Descripción accesible",
 *         caption: "Pie de imagen opcional"
 *       }
 *     ]
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[multimedia-gallery] AacromRuntime no disponible.');
    return;
  }

  global.AacromRuntime.register('multimedia-gallery', {
    render: function (block, container) {
      var data = block.data || {};
      var items = Array.isArray(data.items) ? data.items : [];
      var layout = data.layout === 'row' ? 'row' : 'grid';

      if (items.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Galería sin imágenes</p>';
        return;
      }

      container.classList.add('aacrom-block-gallery');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-gallery aacrom-gallery--' + layout;

      // Grid de thumbnails
      items.forEach(function (item, index) {
        if (!item || !item.src) return;
        var fig = document.createElement('figure');
        fig.className = 'aacrom-gallery__item';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'aacrom-gallery__thumb-btn';
        btn.setAttribute('aria-label', 'Ampliar imagen ' + (index + 1) +
          (item.caption ? ': ' + item.caption : ''));

        var img = document.createElement('img');
        img.className = 'aacrom-gallery__thumb';
        img.src = item.src;
        img.alt = item.alt || '';
        img.setAttribute('loading', 'lazy');
        btn.appendChild(img);

        fig.appendChild(btn);

        if (item.caption) {
          var cap = document.createElement('figcaption');
          cap.className = 'aacrom-gallery__caption';
          cap.textContent = item.caption;
          fig.appendChild(cap);
        }

        btn.addEventListener('click', function () {
          openLightbox(index);
        });

        wrapper.appendChild(fig);
      });

      // Lightbox
      var lightbox = document.createElement('div');
      lightbox.className = 'aacrom-gallery__lightbox';
      lightbox.setAttribute('role', 'dialog');
      lightbox.setAttribute('aria-modal', 'true');
      lightbox.setAttribute('aria-label', 'Vista ampliada de imagen');
      lightbox.hidden = true;

      var lbInner = document.createElement('div');
      lbInner.className = 'aacrom-gallery__lightbox-inner';

      var lbImg = document.createElement('img');
      lbImg.className = 'aacrom-gallery__lightbox-img';
      lbImg.alt = '';

      var lbCap = document.createElement('div');
      lbCap.className = 'aacrom-gallery__lightbox-caption';

      var lbCounter = document.createElement('div');
      lbCounter.className = 'aacrom-gallery__lightbox-counter';

      var SVG_NS = 'http://www.w3.org/2000/svg';

      function makeIcon(svgPath) {
        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        var path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', svgPath);
        path.setAttribute('fill', 'currentColor');
        svg.appendChild(path);
        return svg;
      }

      var lbClose = document.createElement('button');
      lbClose.type = 'button';
      lbClose.className = 'aacrom-gallery__lightbox-close';
      lbClose.setAttribute('aria-label', 'Cerrar vista ampliada');
      // X centrada geométricamente (SVG path 24x24)
      lbClose.appendChild(makeIcon(
        'M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.42 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29 10.59 10.58l6.3-6.29z'
      ));

      var lbPrev = document.createElement('button');
      lbPrev.type = 'button';
      lbPrev.className = 'aacrom-gallery__lightbox-nav aacrom-gallery__lightbox-nav--prev';
      lbPrev.setAttribute('aria-label', 'Imagen anterior');
      // Chevron izquierdo
      lbPrev.appendChild(makeIcon(
        'M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z'
      ));

      var lbNext = document.createElement('button');
      lbNext.type = 'button';
      lbNext.className = 'aacrom-gallery__lightbox-nav aacrom-gallery__lightbox-nav--next';
      lbNext.setAttribute('aria-label', 'Imagen siguiente');
      // Chevron derecho
      lbNext.appendChild(makeIcon(
        'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z'
      ));

      lbInner.appendChild(lbClose);
      lbInner.appendChild(lbImg);
      lbInner.appendChild(lbPrev);
      lbInner.appendChild(lbNext);
      lbInner.appendChild(lbCap);
      lbInner.appendChild(lbCounter);
      lightbox.appendChild(lbInner);
      wrapper.appendChild(lightbox);

      var currentIdx = 0;

      function openLightbox(idx) {
        currentIdx = idx;
        renderLightbox();
        lightbox.hidden = false;
        lbClose.focus();
        document.addEventListener('keydown', onKeydown);
      }

      function closeLightbox() {
        lightbox.hidden = true;
        document.removeEventListener('keydown', onKeydown);
      }

      function renderLightbox() {
        var item = items[currentIdx];
        lbImg.src = item.src;
        lbImg.alt = item.alt || '';
        lbCap.textContent = item.caption || '';
        lbCap.style.display = item.caption ? 'block' : 'none';
        lbCounter.textContent = (currentIdx + 1) + ' / ' + items.length;
        lbPrev.disabled = currentIdx === 0;
        lbNext.disabled = currentIdx === items.length - 1;
      }

      function onKeydown(e) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft' && currentIdx > 0) {
          currentIdx--;
          renderLightbox();
        }
        else if (e.key === 'ArrowRight' && currentIdx < items.length - 1) {
          currentIdx++;
          renderLightbox();
        }
      }

      lbClose.addEventListener('click', closeLightbox);
      lbPrev.addEventListener('click', function () {
        if (currentIdx > 0) { currentIdx--; renderLightbox(); }
      });
      lbNext.addEventListener('click', function () {
        if (currentIdx < items.length - 1) { currentIdx++; renderLightbox(); }
      });
      // Click en backdrop cierra
      lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) closeLightbox();
      });

      container.appendChild(wrapper);
    }
  });

})(window);
