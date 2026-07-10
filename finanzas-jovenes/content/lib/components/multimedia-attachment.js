/**
 * Componente: multimedia-attachment
 *
 * Archivo descargable (PDF, DOCX, XLSX, ZIP, etc). Muestra un icono según
 * el tipo, nombre del archivo, descripción opcional y botón de descarga.
 *
 * Estructura del data:
 *   {
 *     filename: "manual_usuario.pdf",
 *     url: "assets/files/manual_usuario.pdf",
 *     description: "Manual completo de usuario, 24 páginas",
 *     fileType: "pdf",                 // pdf, docx, xlsx, zip, generic
 *     size: "2.4 MB"                    // opcional
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[multimedia-attachment] AacromRuntime no disponible.');
    return;
  }

  // Mapa tipo → icono y color
  var TYPE_ICONS = {
    'pdf': { icon: '📄', label: 'PDF' },
    'docx': { icon: '📝', label: 'Word' },
    'doc': { icon: '📝', label: 'Word' },
    'xlsx': { icon: '📊', label: 'Excel' },
    'xls': { icon: '📊', label: 'Excel' },
    'pptx': { icon: '📽️', label: 'PowerPoint' },
    'ppt': { icon: '📽️', label: 'PowerPoint' },
    'zip': { icon: '🗜️', label: 'ZIP' },
    'rar': { icon: '🗜️', label: 'RAR' },
    'png': { icon: '🖼️', label: 'Imagen' },
    'jpg': { icon: '🖼️', label: 'Imagen' },
    'jpeg': { icon: '🖼️', label: 'Imagen' },
    'mp4': { icon: '🎬', label: 'Video' },
    'mp3': { icon: '🎵', label: 'Audio' },
    'generic': { icon: '📎', label: 'Archivo' }
  };

  function detectType(filename, declared) {
    if (declared && TYPE_ICONS[declared.toLowerCase()]) {
      return declared.toLowerCase();
    }
    if (filename) {
      var ext = filename.split('.').pop().toLowerCase();
      if (TYPE_ICONS[ext]) return ext;
    }
    return 'generic';
  }

  global.AacromRuntime.register('multimedia-attachment', {
    render: function (block, container) {
      var data = block.data || {};
      var filename = typeof data.filename === 'string' ? data.filename : '';
      var url = typeof data.url === 'string' ? data.url : '';
      var description = typeof data.description === 'string' ? data.description : '';
      var size = typeof data.size === 'string' ? data.size : '';
      var fileType = detectType(filename, data.fileType);

      if (!filename || !url) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Adjunto sin filename o url</p>';
        return;
      }

      // Validar URL (no permitir javascript: ni data: ejecutables)
      if (/^\s*(javascript|vbscript):/i.test(url)) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'URL no permitida en adjunto</p>';
        return;
      }

      container.classList.add('aacrom-block-attachment');

      var typeInfo = TYPE_ICONS[fileType];

      var card = document.createElement('div');
      card.className = 'aacrom-attachment';

      // Icono
      var iconDiv = document.createElement('div');
      iconDiv.className = 'aacrom-attachment__icon aacrom-attachment__icon--' + fileType;
      iconDiv.setAttribute('aria-hidden', 'true');
      iconDiv.textContent = typeInfo.icon;
      card.appendChild(iconDiv);

      // Info
      var info = document.createElement('div');
      info.className = 'aacrom-attachment__info';

      var nameEl = document.createElement('div');
      nameEl.className = 'aacrom-attachment__name';
      nameEl.textContent = filename;
      info.appendChild(nameEl);

      var meta = document.createElement('div');
      meta.className = 'aacrom-attachment__meta';
      var typeSpan = document.createElement('span');
      typeSpan.className = 'aacrom-attachment__type';
      typeSpan.textContent = typeInfo.label;
      meta.appendChild(typeSpan);
      if (size) {
        var sizeSpan = document.createElement('span');
        sizeSpan.className = 'aacrom-attachment__size';
        sizeSpan.textContent = ' · ' + size;
        meta.appendChild(sizeSpan);
      }
      info.appendChild(meta);

      if (description) {
        var descEl = document.createElement('p');
        descEl.className = 'aacrom-attachment__description';
        descEl.textContent = description;
        info.appendChild(descEl);
      }

      card.appendChild(info);

      // Botón de descarga
      var link = document.createElement('a');
      link.className = 'aacrom-attachment__download';
      link.href = url;
      link.setAttribute('download', filename);
      link.textContent = '↓ Descargar';
      link.setAttribute('aria-label', 'Descargar ' + filename);
      card.appendChild(link);

      container.appendChild(card);
    }
  });

})(window);
