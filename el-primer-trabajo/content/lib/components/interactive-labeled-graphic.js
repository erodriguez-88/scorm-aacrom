/**
 * Componente: interactive-labeled-graphic
 *
 * Imagen interactiva con marcadores numerados que abren un panel lateral
 * al hacer click/tap, mostrando título + descripción + media opcional.
 *
 * Es el componente más usado en cursos Aacrom (104 apariciones entre los
 * 2 cursos analizados de panadería y cumplimiento).
 *
 * Estructura del data:
 *   {
 *     image: {
 *       src: "assets/images/cocina.jpg",  // requerido
 *       alt: "Vista de la cocina",
 *       width: 1200,
 *       height: 800
 *     },
 *     markers: [
 *       {
 *         id: "marker-1",
 *         x: 0.34,                    // 0-1, posición relativa horizontal
 *         y: 0.56,                    // 0-1, posición relativa vertical
 *         title: "Mesón principal",
 *         description: "<p>HTML básico...</p>",
 *         media: {                    // opcional
 *           type: "image" | "audio" | "video",
 *           src: "assets/...",
 *           caption: "..."
 *         }
 *       }
 *     ]
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[interactive-labeled-graphic] AacromRuntime no disponible.');
    return;
  }

  // Sanitizador básico para HTML en descripciones de marcadores
  var ALLOWED_TAGS = ['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'MARK',
                      'A', 'UL', 'OL', 'LI', 'SPAN'];
  var ALLOWED_ATTRS = {
    'A': ['href', 'target', 'rel', 'title']
  };

  function sanitizeHtml(html) {
    var div = document.createElement('div');
    div.innerHTML = html;

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
            var attrsToRemove = [];
            for (var i = 0; i < child.attributes.length; i++) {
              var attr = child.attributes[i];
              if (allowedAttrs.indexOf(attr.name) === -1) attrsToRemove.push(attr.name);
            }
            attrsToRemove.forEach(function (a) { child.removeAttribute(a); });
            if (tag === 'A') {
              var href = child.getAttribute('href') || '';
              if (/^\s*(javascript|data|vbscript):/i.test(href)) {
                child.removeAttribute('href');
              }
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

  function escapeText(str) {
    if (typeof str !== 'string') return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  global.AacromRuntime.register('interactive-labeled-graphic', {
    render: function (block, container) {
      var data = block.data || {};
      var imageData = data.image || {};
      var markers = Array.isArray(data.markers) ? data.markers : [];

      if (!imageData.src) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Imagen etiquetada sin imagen base</p>';
        return;
      }

      container.classList.add('aacrom-block-labeled-graphic');

      // -----------------------------------------------------------
      // Estructura: contenedor con imagen + capa de marcadores
      // -----------------------------------------------------------
      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-labeled-graphic';

      // Imagen base con aspect ratio basado en width/height
      var imageWrap = document.createElement('div');
      imageWrap.className = 'aacrom-labeled-graphic__image-wrap';

      if (typeof imageData.width === 'number' && typeof imageData.height === 'number'
          && imageData.width > 0) {
        var ratio = (imageData.height / imageData.width) * 100;
        imageWrap.style.paddingBottom = ratio.toFixed(2) + '%';
      } else {
        // default 4:3 si no hay dimensiones
        imageWrap.style.paddingBottom = '75%';
      }

      var img = document.createElement('img');
      img.className = 'aacrom-labeled-graphic__image';
      img.src = imageData.src;
      img.alt = typeof imageData.alt === 'string' ? imageData.alt : '';
      img.setAttribute('loading', 'lazy');
      imageWrap.appendChild(img);

      img.addEventListener('error', function () {
        var err = document.createElement('div');
        err.className = 'aacrom-labeled-graphic__error';
        err.textContent = 'Imagen no disponible: ' + imageData.src;
        imageWrap.appendChild(err);
      });

      // Capa de marcadores
      var markersLayer = document.createElement('div');
      markersLayer.className = 'aacrom-labeled-graphic__markers';
      markersLayer.setAttribute('role', 'group');
      markersLayer.setAttribute('aria-label', 'Puntos interactivos sobre la imagen');

      markers.forEach(function (marker, index) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'aacrom-labeled-graphic__marker';
        btn.setAttribute('data-marker-id', marker.id || ('marker-' + index));
        btn.setAttribute('data-marker-index', String(index));

        // Posición: clamp x/y a [0, 1]
        var x = Math.max(0, Math.min(1, parseFloat(marker.x) || 0));
        var y = Math.max(0, Math.min(1, parseFloat(marker.y) || 0));
        btn.style.left = (x * 100) + '%';
        btn.style.top = (y * 100) + '%';

        btn.setAttribute('aria-label',
          'Punto ' + (index + 1) + ': ' + (marker.title || 'Sin título'));

        // Contenido visible: número del marcador
        var number = document.createElement('span');
        number.className = 'aacrom-labeled-graphic__marker-number';
        number.textContent = String(index + 1);
        number.setAttribute('aria-hidden', 'true');
        btn.appendChild(number);

        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          openPanel(marker, index, btn, wrapper);
        });

        markersLayer.appendChild(btn);
      });

      imageWrap.appendChild(markersLayer);
      wrapper.appendChild(imageWrap);

      // Panel lateral (oculto inicialmente)
      var panel = document.createElement('div');
      panel.className = 'aacrom-labeled-graphic__panel';
      panel.setAttribute('aria-hidden', 'true');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      wrapper.appendChild(panel);

      container.appendChild(wrapper);

      // Cerrar panel al hacer click fuera de él (en la imagen sin marcador)
      imageWrap.addEventListener('click', function (e) {
        // Si el click no fue en un marcador ni dentro del panel, cerrar
        if (!e.target.closest('.aacrom-labeled-graphic__marker')) {
          closePanel(panel);
        }
      });

      // Tecla Esc cierra el panel
      wrapper.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePanel(panel);
      });
    }
  });

  // -----------------------------------------------------------------
  // Apertura del panel — posicionamiento dinámico según marcador
  // -----------------------------------------------------------------
  function openPanel(marker, index, button, wrapper) {
    var panel = wrapper.querySelector('.aacrom-labeled-graphic__panel');
    if (!panel) return;

    // Marcador activo
    var allMarkers = wrapper.querySelectorAll('.aacrom-labeled-graphic__marker');
    allMarkers.forEach(function (m) {
      m.classList.remove('aacrom-labeled-graphic__marker--active');
    });
    button.classList.add('aacrom-labeled-graphic__marker--active');

    // Limpiar contenido + clases de posición previas
    panel.innerHTML = '';
    panel.classList.remove(
      'aacrom-labeled-graphic__panel--right',
      'aacrom-labeled-graphic__panel--left',
      'aacrom-labeled-graphic__panel--top',
      'aacrom-labeled-graphic__panel--bottom'
    );

    // Header del panel
    var header = document.createElement('div');
    header.className = 'aacrom-labeled-graphic__panel-header';

    var num = document.createElement('span');
    num.className = 'aacrom-labeled-graphic__panel-number';
    num.textContent = String(index + 1);
    num.setAttribute('aria-hidden', 'true');
    header.appendChild(num);

    var title = document.createElement('h3');
    title.className = 'aacrom-labeled-graphic__panel-title';
    title.textContent = marker.title || '';
    header.appendChild(title);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'aacrom-labeled-graphic__panel-close';
    closeBtn.setAttribute('aria-label', 'Cerrar panel');
    closeBtn.innerHTML = '<span aria-hidden="true">×</span>';
    closeBtn.addEventListener('click', function () {
      closePanel(panel);
    });
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Cuerpo del panel
    var body = document.createElement('div');
    body.className = 'aacrom-labeled-graphic__panel-body';

    if (marker.description) {
      var desc = document.createElement('div');
      desc.className = 'aacrom-labeled-graphic__panel-description';
      desc.innerHTML = sanitizeHtml(marker.description);
      body.appendChild(desc);
    }

    if (marker.media && typeof marker.media === 'object') {
      var media = marker.media;
      var mediaWrap = document.createElement('div');
      mediaWrap.className = 'aacrom-labeled-graphic__panel-media';

      if (media.type === 'image' && media.src) {
        var mImg = document.createElement('img');
        mImg.src = media.src;
        mImg.alt = media.alt || '';
        mImg.className = 'aacrom-labeled-graphic__panel-media-image';
        mImg.setAttribute('loading', 'lazy');
        mediaWrap.appendChild(mImg);
      } else if (media.type === 'audio' && media.src) {
        var mAudio = document.createElement('audio');
        mAudio.controls = true;
        mAudio.preload = 'metadata';
        mAudio.src = media.src;
        mAudio.className = 'aacrom-labeled-graphic__panel-media-audio';
        mediaWrap.appendChild(mAudio);
      } else if (media.type === 'video' && media.src) {
        var mVideo = document.createElement('video');
        mVideo.controls = true;
        mVideo.preload = 'metadata';
        mVideo.src = media.src;
        mVideo.setAttribute('playsinline', '');
        mVideo.className = 'aacrom-labeled-graphic__panel-media-video';
        mediaWrap.appendChild(mVideo);
      }

      if (media.caption) {
        var mCap = document.createElement('div');
        mCap.className = 'aacrom-labeled-graphic__panel-media-caption';
        mCap.textContent = media.caption;
        mediaWrap.appendChild(mCap);
      }

      body.appendChild(mediaWrap);
    }

    panel.appendChild(body);

    // Detectar si estamos en mobile (panel ocupa pantalla completa)
    var isMobile = window.innerWidth < 600;

    if (isMobile) {
      // En móvil, el panel ya tiene CSS específico para ocupar toda la pantalla
      panel.classList.add('aacrom-labeled-graphic__panel--mobile');
    } else {
      // En desktop, calcular posición flotante cerca del marcador
      panel.classList.add('aacrom-labeled-graphic__panel--floating');
      positionFloatingPanel(panel, button, wrapper);
    }

    // Mostrar
    panel.classList.add('aacrom-labeled-graphic__panel--open');
    panel.setAttribute('aria-hidden', 'false');

    closeBtn.focus();
  }

  /**
   * Calcula la mejor posición para el panel flotante según la ubicación
   * del marcador y el espacio disponible. Estrategia:
   *  1. Intentar a la derecha del marcador (si hay espacio).
   *  2. Sino, intentar a la izquierda.
   *  3. Sino, intentar abajo.
   *  4. Sino, arriba.
   */
  function positionFloatingPanel(panel, button, wrapper) {
    // Reset de estilos inline previos para medir limpiamente
    panel.style.left = '';
    panel.style.right = '';
    panel.style.top = '';
    panel.style.bottom = '';
    panel.style.maxHeight = '';

    // Hacer visible para poder medir, pero invisible al usuario
    panel.style.visibility = 'hidden';
    panel.style.display = 'flex';

    var wrapperRect = wrapper.getBoundingClientRect();
    var btnRect = button.getBoundingClientRect();

    // Calcular altura disponible considerando el viewport (no solo el wrapper).
    // Esto permite que el panel sea más alto que la imagen cuando el contenido lo amerita.
    var viewportH = window.innerHeight || document.documentElement.clientHeight;
    var MARGIN = 8;
    var TOP_BUFFER = 16; // distancia mínima al borde superior del viewport

    // Calcular el límite superior disponible: nunca por encima de la zona visible
    // del wrapper (top del wrapper relativo al viewport)
    var wrapperTopInViewport = wrapperRect.top;
    var minTopAbsolute = Math.max(TOP_BUFFER - wrapperTopInViewport, 0);
    // Calcular el límite inferior: hasta donde el panel puede llegar
    var maxBottomInViewport = viewportH - TOP_BUFFER;
    var maxAvailableHeightInViewport = maxBottomInViewport - Math.max(wrapperTopInViewport, TOP_BUFFER);

    // Aplicar max-height al panel para que respete el viewport
    panel.style.maxHeight = Math.max(maxAvailableHeightInViewport, 200) + 'px';

    // Ahora medir el panel ya restringido en altura
    var panelRect = panel.getBoundingClientRect();
    var panelW = panelRect.width;
    var panelH = panelRect.height;
    var wrapperW = wrapperRect.width;
    var wrapperH = wrapperRect.height;

    // Coordenadas del marcador relativas al wrapper
    var btnLeftRel = btnRect.left - wrapperRect.left;
    var btnTopRel = btnRect.top - wrapperRect.top;
    var btnCenterX = btnLeftRel + (btnRect.width / 2);
    var btnCenterY = btnTopRel + (btnRect.height / 2);

    var GAP = 12; // espacio entre marcador y panel

    // Espacio disponible en cada lado del marcador (dentro del wrapper)
    var spaceRight = wrapperW - (btnLeftRel + btnRect.width);
    var spaceLeft = btnLeftRel;
    var spaceBelow = wrapperH - (btnTopRel + btnRect.height);
    // spaceAbove se calcula contra el viewport, no solo el wrapper, para
    // que el panel pueda salirse por arriba si hay espacio en el viewport.

    var posX, posY, side;

    // Decidir lado horizontal: intentar derecha, sino izquierda
    if (spaceRight >= panelW + GAP + MARGIN) {
      posX = btnLeftRel + btnRect.width + GAP;
      side = 'right';
    } else if (spaceLeft >= panelW + GAP + MARGIN) {
      posX = btnLeftRel - panelW - GAP;
      side = 'left';
    } else {
      // No hay espacio horizontal, posicionar arriba o abajo del marcador
      posX = btnCenterX - (panelW / 2);
      posX = Math.max(MARGIN, Math.min(posX, wrapperW - panelW - MARGIN));

      if (spaceBelow >= panelH + GAP + MARGIN) {
        posY = btnTopRel + btnRect.height + GAP;
        side = 'bottom';
      } else {
        posY = btnTopRel - panelH - GAP;
        side = 'top';
      }
    }

    // Si el lado es izquierda o derecha, calcular el Y centrado al marcador
    if (side === 'right' || side === 'left') {
      posY = btnCenterY - (panelH / 2);

      // Restricción 1: no cortar por arriba del wrapper visible en el viewport
      // (es decir, posY relativo al wrapper no puede ser tan negativo que el
      // top del panel quede arriba de la zona segura del viewport)
      var minPosY = minTopAbsolute;

      // Restricción 2: no salirse demasiado por abajo del wrapper (queda
      // libre flotar por debajo de la imagen, pero limitado por el viewport)
      var maxPosY = (viewportH - TOP_BUFFER - wrapperRect.top) - panelH;

      // Si el panel cabe en el espacio disponible, lo centramos al marcador.
      // Si no, lo recortamos a los límites.
      posY = Math.max(minPosY, Math.min(posY, maxPosY));
    } else if (side === 'top') {
      // Restricción para top: no cortar por arriba del wrapper visible
      var minPosYTop = minTopAbsolute;
      if (posY < minPosYTop) {
        // No hay espacio arriba; cambiar a abajo si es posible
        var maxPosYTop = (viewportH - TOP_BUFFER - wrapperRect.top) - panelH;
        var alternativeBelowY = btnTopRel + btnRect.height + GAP;
        if (alternativeBelowY <= maxPosYTop) {
          posY = alternativeBelowY;
          side = 'bottom';
        } else {
          posY = minPosYTop;
        }
      }
    } else if (side === 'bottom') {
      // Restricción para bottom: no salirse por debajo del viewport
      var maxPosYBottom = (viewportH - TOP_BUFFER - wrapperRect.top) - panelH;
      if (posY > maxPosYBottom) posY = maxPosYBottom;
    }

    // Aplicar
    panel.style.left = posX + 'px';
    panel.style.top = posY + 'px';
    panel.classList.add('aacrom-labeled-graphic__panel--' + side);

    // Restaurar visibilidad
    panel.style.visibility = '';
    panel.style.display = '';
  }

  function closePanel(panel) {
    if (!panel) return;
    panel.classList.remove('aacrom-labeled-graphic__panel--open');
    panel.setAttribute('aria-hidden', 'true');

    // Quitar marcador activo
    var wrapper = panel.parentNode;
    if (wrapper) {
      var actives = wrapper.querySelectorAll('.aacrom-labeled-graphic__marker--active');
      actives.forEach(function (m) {
        m.classList.remove('aacrom-labeled-graphic__marker--active');
      });
    }
  }

})(window);
