/**
 * Componente: multimedia-embed
 *
 * Embebido de contenido externo: YouTube, Vimeo, presentaciones, etc.
 * A diferencia de external-block (paquete autocontenido), este es un
 * iframe a un servicio externo que requiere conexión a internet.
 *
 * Por seguridad, solo se permiten dominios en la whitelist. Si el
 * dominio no está en la lista, el componente muestra un placeholder
 * con el enlace para abrir en nueva pestaña.
 *
 * Estructura del data:
 *   {
 *     url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
 *     title: "Título descriptivo (requerido para accesibilidad)",
 *     aspectRatio: "16:9" | "4:3" | "1:1",   // default 16:9
 *     caption: "Pie opcional"
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[multimedia-embed] AacromRuntime no disponible.');
    return;
  }

  // Whitelist de dominios permitidos para embebido directo.
  // Otros dominios mostrarán un placeholder en lugar del iframe.
  var ALLOWED_DOMAINS = [
    'youtube.com', 'youtube-nocookie.com', 'www.youtube.com',
    'player.vimeo.com', 'vimeo.com',
    'docs.google.com',
    'view.officeapps.live.com',
    'genial.ly', 'view.genial.ly',
    'h5p.org', 'h5p.com',
    'soundcloud.com', 'w.soundcloud.com'
  ];

  function getDomain(url) {
    try {
      var u = new URL(url);
      return u.hostname.toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function isAllowed(url) {
    if (!/^https:\/\//i.test(url)) return false;
    var domain = getDomain(url);
    return ALLOWED_DOMAINS.some(function (allowed) {
      return domain === allowed || domain.endsWith('.' + allowed);
    });
  }

  global.AacromRuntime.register('multimedia-embed', {
    render: function (block, container) {
      var data = block.data || {};
      var url = typeof data.url === 'string' ? data.url : '';
      var title = typeof data.title === 'string' ? data.title : '';
      var aspectRatio = data.aspectRatio || '16:9';
      var caption = typeof data.caption === 'string' ? data.caption : '';

      if (!url) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Embed sin URL</p>';
        return;
      }

      if (!title) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Embed sin título (requerido para accesibilidad)</p>';
        return;
      }

      container.classList.add('aacrom-block-embed');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-embed';

      // Detectar si estamos en file:// (preview HTML standalone).
      // YouTube, Vimeo y otros proveedores bloquean iframes desde file://
      // por política de seguridad. En SCORM real (HTTP/HTTPS dentro de
      // Moodle) sí funcionan.
      var isFileProtocol = window.location.protocol === 'file:';

      if (isAllowed(url) && !isFileProtocol) {
        // Iframe directo (servidor real)
        var aspectClass = 'aacrom-embed__container--' +
          aspectRatio.replace(':', '-');
        var ratioWrap = document.createElement('div');
        ratioWrap.className = 'aacrom-embed__container ' + aspectClass;

        var iframe = document.createElement('iframe');
        iframe.className = 'aacrom-embed__iframe';
        iframe.src = url;
        iframe.title = title;
        iframe.setAttribute('loading', 'lazy');
        iframe.setAttribute('allow',
          'accelerometer; autoplay; clipboard-write; encrypted-media; ' +
          'gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
        iframe.setAttribute('allowfullscreen', 'true');
        ratioWrap.appendChild(iframe);
        wrapper.appendChild(ratioWrap);
      } else if (isAllowed(url) && isFileProtocol) {
        // Whitelist OK pero archivo local: el iframe se cargaría pero
        // no mostraría contenido. Mostrar aviso amigable.
        var fileNotice = document.createElement('div');
        fileNotice.className = 'aacrom-embed__file-notice';

        var fIcon = document.createElement('div');
        fIcon.className = 'aacrom-embed__file-notice-icon';
        fIcon.setAttribute('aria-hidden', 'true');
        fIcon.textContent = '🎥';
        fileNotice.appendChild(fIcon);

        var fTitle = document.createElement('h4');
        fTitle.className = 'aacrom-embed__file-notice-title';
        fTitle.textContent = title;
        fileNotice.appendChild(fTitle);

        var fMsg = document.createElement('p');
        fMsg.className = 'aacrom-embed__file-notice-msg';
        fMsg.textContent = 'Este video se reproducirá correctamente cuando ' +
          'el SCORM esté subido a Moodle. Los navegadores bloquean los ' +
          'iframes externos al abrir archivos locales por seguridad.';
        fileNotice.appendChild(fMsg);

        var fDomain = document.createElement('p');
        fDomain.className = 'aacrom-embed__file-notice-domain';
        fDomain.textContent = 'Origen: ' + getDomain(url);
        fileNotice.appendChild(fDomain);

        var fLink = document.createElement('a');
        fLink.className = 'aacrom-embed__file-notice-link';
        fLink.href = url;
        fLink.target = '_blank';
        fLink.rel = 'noopener noreferrer';
        fLink.textContent = 'Ver el contenido en su sitio original ↗';
        fileNotice.appendChild(fLink);

        wrapper.appendChild(fileNotice);
      } else {
        // Dominio no whitelisted: placeholder con link
        var placeholder = document.createElement('div');
        placeholder.className = 'aacrom-embed__placeholder';

        var icon = document.createElement('div');
        icon.className = 'aacrom-embed__placeholder-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '🔗';
        placeholder.appendChild(icon);

        var titleEl = document.createElement('h4');
        titleEl.className = 'aacrom-embed__placeholder-title';
        titleEl.textContent = title;
        placeholder.appendChild(titleEl);

        var msg = document.createElement('p');
        msg.className = 'aacrom-embed__placeholder-msg';
        msg.textContent = 'Este contenido externo se abre en una nueva pestaña.';
        placeholder.appendChild(msg);

        var domainSpan = document.createElement('p');
        domainSpan.className = 'aacrom-embed__placeholder-domain';
        domainSpan.textContent = getDomain(url) || 'enlace externo';
        placeholder.appendChild(domainSpan);

        var openLink = document.createElement('a');
        openLink.className = 'aacrom-embed__placeholder-link';
        openLink.href = url;
        openLink.target = '_blank';
        openLink.rel = 'noopener noreferrer';
        openLink.textContent = 'Abrir en nueva pestaña ↗';
        placeholder.appendChild(openLink);

        wrapper.appendChild(placeholder);
      }

      if (caption) {
        var capEl = document.createElement('p');
        capEl.className = 'aacrom-embed__caption';
        capEl.textContent = caption;
        wrapper.appendChild(capEl);
      }

      container.appendChild(wrapper);
    }
  });

})(window);
