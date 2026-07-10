/**
 * Aacrom Runtime
 *
 * Motor principal de la plantilla SCORM Aacrom.
 * Responsabilidades:
 *  - Cargar y validar course.json contra el esquema v1.0
 *  - Inyectar el tema dinámico
 *  - Renderizar la estructura del curso (sidebar, header, lecciones)
 *  - Manejar navegación entre lecciones
 *  - Renderizar bloques mediante el sistema de componentes registrables
 *  - Tracking SCORM (bookmark, completitud, score)
 *  - Modo claro/oscuro con persistencia
 *
 * Sub-etapa 3.1: andamiaje base. Los componentes individuales se registran
 * en sub-etapas posteriores (3.2 en adelante).
 */

(function (global) {
  'use strict';

  // -----------------------------------------------------------------
  // Constantes
  // -----------------------------------------------------------------

  var SUPPORTED_VERSION = '1.0';
  var STORAGE_KEY_THEME = 'aacrom_theme_mode';
  var DEFAULT_THEME = {
    // Color principal del curso (botones, marcadores, acentos)
    primaryColor: '#1F3864',
    // Alias compatible con nombre Rise: accentColor === primaryColor
    accentColor: '#1F3864',
    // Contraste de texto sobre el accent: 'auto' o un hex específico
    accentContrast: 'auto',
    // Fondo del curso (light por defecto)
    backgroundColor: '#FFFFFF',
    textColor: '#202020',
    fontFamily: 'Lato',
    // Estilo de esquinas: 'rounded' o 'square'
    cornerStyle: 'rounded'
  };

  // Tipos de bloque válidos en el JSON v1.0
  var VALID_BLOCK_TYPES = [
    'text-heading', 'text-paragraph', 'text-statement', 'text-quote',
    'text-list', 'text-table',
    'multimedia-image', 'multimedia-gallery', 'multimedia-video',
    'multimedia-audio', 'multimedia-attachment', 'multimedia-embed',
    'interactive-accordion', 'interactive-tabs', 'interactive-labeled-graphic',
    'interactive-process', 'interactive-scenario', 'interactive-sorting',
    'interactive-flashcards', 'interactive-buttons', 'interactive-timeline',
    'chart',
    'divider-continue', 'divider-section',
    'knowledge-check',
    'impact-statement',
    'quiz-multiple-choice', 'quiz-multiple-response',
    'external-block'
  ];

  // -----------------------------------------------------------------
  // Estado interno
  // -----------------------------------------------------------------

  var state = {
    course: null,                // datos del course.json cargado
    currentLessonIndex: 0,
    completedBlocks: {},         // { blockId: true }
    completedLessons: {},        // { lessonId: true }
    themeMode: 'light',          // 'light' | 'dark'
    config: null
  };

  // Registro de componentes (cada componente se registra con register())
  var components = {};

  // -----------------------------------------------------------------
  // Logging
  // -----------------------------------------------------------------

  function log() {
    if (typeof console !== 'undefined' && console.log) {
      var args = ['[Aacrom Runtime]'].concat(Array.prototype.slice.call(arguments));
      console.log.apply(console, args);
    }
  }

  function warn() {
    if (typeof console !== 'undefined' && console.warn) {
      var args = ['[Aacrom Runtime]'].concat(Array.prototype.slice.call(arguments));
      console.warn.apply(console, args);
    }
  }

  function error() {
    if (typeof console !== 'undefined' && console.error) {
      var args = ['[Aacrom Runtime]'].concat(Array.prototype.slice.call(arguments));
      console.error.apply(console, args);
    }
  }

  // -----------------------------------------------------------------
  // Validador JSON
  // -----------------------------------------------------------------

  function validateCourseJson(data) {
    var errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('course.json no es un objeto válido');
      return errors;
    }

    // version
    if (data.version !== SUPPORTED_VERSION) {
      errors.push('version del formato debe ser "' + SUPPORTED_VERSION +
                  '", encontrado: "' + data.version + '"');
    }

    // metadata
    if (!data.metadata || typeof data.metadata !== 'object') {
      errors.push('metadata es requerido');
    } else {
      if (!data.metadata.id) errors.push('metadata.id es requerido');
      if (!data.metadata.title) errors.push('metadata.title es requerido');
      if (!data.metadata.language) errors.push('metadata.language es requerido');
    }

    // theme (opcional pero si existe debe ser objeto)
    if (data.theme && typeof data.theme !== 'object') {
      errors.push('theme debe ser un objeto');
    }

    // settings (opcional)
    if (data.settings && typeof data.settings !== 'object') {
      errors.push('settings debe ser un objeto');
    }

    // lessons
    if (!Array.isArray(data.lessons)) {
      errors.push('lessons debe ser un array');
    } else if (data.lessons.length === 0) {
      errors.push('lessons no puede estar vacío');
    } else {
      data.lessons.forEach(function (lesson, i) {
        var prefix = 'lessons[' + i + ']';
        if (!lesson.id) errors.push(prefix + '.id es requerido');
        if (!lesson.title) errors.push(prefix + '.title es requerido');
        if (lesson.type !== 'blocks' && lesson.type !== 'quiz') {
          errors.push(prefix + '.type debe ser "blocks" o "quiz"');
        }

        if (lesson.type === 'blocks') {
          if (!Array.isArray(lesson.blocks)) {
            errors.push(prefix + '.blocks debe ser un array');
          } else {
            lesson.blocks.forEach(function (block, j) {
              var bp = prefix + '.blocks[' + j + ']';
              if (!block.id) errors.push(bp + '.id es requerido');
              if (!block.type) errors.push(bp + '.type es requerido');
              else if (VALID_BLOCK_TYPES.indexOf(block.type) === -1) {
                errors.push(bp + '.type "' + block.type + '" no es un tipo válido');
              }
            });
          }
        } else if (lesson.type === 'quiz') {
          if (!Array.isArray(lesson.questions)) {
            errors.push(prefix + '.questions debe ser un array');
          }
        }
      });
    }

    return errors;
  }

  // -----------------------------------------------------------------
  // Carga del course.json
  // -----------------------------------------------------------------

  function loadCourseJson(url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'text';
      xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {  // status 0 para file://
          try {
            var data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (e) {
            reject(new Error('course.json no es JSON válido: ' + e.message));
          }
        } else {
          reject(new Error('Error al cargar course.json: HTTP ' + xhr.status));
        }
      };
      xhr.onerror = function () {
        reject(new Error('Error de red al cargar course.json'));
      };
      xhr.send();
    });
  }

  // -----------------------------------------------------------------
  // Inyección del tema
  // -----------------------------------------------------------------

  function injectTheme(theme) {
    var t = mergeObjects(DEFAULT_THEME, theme || {});

    // Si se usa accentColor pero no primaryColor (alias Rise), respetar accentColor
    if (theme && theme.accentColor && !theme.primaryColor) {
      t.primaryColor = theme.accentColor;
    }

    var styleEl = document.getElementById('aacrom-theme-overrides');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'aacrom-theme-overrides';
      document.head.appendChild(styleEl);
    }

    var css = ':root {\n';
    css += '  --color-theme: ' + t.primaryColor + ';\n';
    css += '  --color-accent: ' + t.primaryColor + ';\n';
    css += '  --color-background: ' + t.backgroundColor + ';\n';
    css += '  --color-text: ' + t.textColor + ';\n';
    css += '  --font-family-base: "' + t.fontFamily + '", "Helvetica Neue", Arial, sans-serif;\n';

    // Calcular contraste sobre el color de acento (W3C luminance relativa).
    // Si el usuario fija accentContrast con un hex, lo usamos; si pone 'auto'
    // (o nada), lo calculamos.
    var contrast;
    if (t.accentContrast && t.accentContrast !== 'auto' && /^#[0-9A-Fa-f]{3,8}$/.test(t.accentContrast)) {
      contrast = t.accentContrast;
    } else {
      contrast = getContrastColor(t.primaryColor);
    }
    css += '  --color-theme-contrast: ' + contrast + ';\n';

    // Estilo de esquinas
    if (t.cornerStyle === 'square') {
      css += '  --border-radius-sm: 0;\n';
      css += '  --border-radius-md: 0;\n';
      css += '  --border-radius-lg: 0;\n';
    }

    css += '}\n';

    // themeOverrides opcional (custom CSS vars)
    if (theme && theme.themeOverrides && typeof theme.themeOverrides === 'object') {
      css += ':root {\n';
      Object.keys(theme.themeOverrides).forEach(function (key) {
        css += '  ' + key + ': ' + theme.themeOverrides[key] + ';\n';
      });
      css += '}\n';
    }

    styleEl.textContent = css;
  }

  /**
   * Calcula el color de texto óptimo (blanco o negro) sobre un fondo dado.
   * Usa la fórmula W3C de luminancia relativa (WCAG 2.x).
   */
  function getContrastColor(hex) {
    if (!hex || typeof hex !== 'string') return '#FFFFFF';
    var clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map(function (c) { return c + c; }).join('');
    }
    if (clean.length !== 6) return '#FFFFFF';

    var r = parseInt(clean.substr(0, 2), 16) / 255;
    var g = parseInt(clean.substr(2, 2), 16) / 255;
    var b = parseInt(clean.substr(4, 2), 16) / 255;

    // Linearización sRGB → linear
    function linearize(c) {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var L = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);

    // Si la luminancia es mayor al umbral, fondo claro → texto negro
    return L > 0.4 ? '#000000' : '#FFFFFF';
  }

  // -----------------------------------------------------------------
  // Renderizado del UI base
  // -----------------------------------------------------------------

  function renderCourseTitle() {
    var titleEl = document.getElementById('aacrom-course-title');
    if (titleEl && state.course && state.course.metadata) {
      titleEl.textContent = state.course.metadata.title || 'Curso';
    }
  }

  function renderLessonList() {
    var listEl = document.getElementById('aacrom-lesson-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    state.course.lessons.forEach(function (lesson, index) {
      var li = document.createElement('li');
      li.className = 'aacrom-lesson-list__item';
      if (state.completedLessons[lesson.id]) {
        li.classList.add('aacrom-lesson-list__item--completed');
      }
      if (index === state.currentLessonIndex) {
        li.classList.add('aacrom-lesson-list__item--active');
      }

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aacrom-lesson-list__link';
      btn.setAttribute('aria-current', index === state.currentLessonIndex ? 'true' : 'false');

      var num = document.createElement('span');
      num.className = 'aacrom-lesson-list__number';
      num.textContent = String(index + 1);

      var title = document.createElement('span');
      title.className = 'aacrom-lesson-list__title';
      title.textContent = lesson.title;

      btn.appendChild(num);
      btn.appendChild(title);

      btn.addEventListener('click', function () {
        navigateToLesson(index);
        closeSidebarOnMobile();
      });

      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  function renderCurrentLesson() {
    var container = document.getElementById('aacrom-lesson-container');
    if (!container) return;

    var lesson = state.course.lessons[state.currentLessonIndex];
    if (!lesson) return;

    container.innerHTML = '';

    // Header de la lección
    var header = document.createElement('div');
    header.className = 'aacrom-lesson-header';
    var h1 = document.createElement('h1');
    h1.className = 'aacrom-lesson-header__title';
    h1.textContent = lesson.title;
    header.appendChild(h1);
    container.appendChild(header);

    // Contenido según tipo
    if (lesson.type === 'blocks') {
      renderBlocks(container, lesson.blocks || []);
    } else if (lesson.type === 'quiz') {
      renderQuizPlaceholder(container, lesson);
    }

    // Scroll al inicio. El contenedor que tiene scroll real es
    // .aacrom-content (overflow-y: auto), no el lesson-container.
    // También hacemos scroll del window por si el SCORM se carga sin
    // chrome propio y el scroll es del documento.
    var contentEl = document.getElementById('aacrom-content');
    if (contentEl) contentEl.scrollTop = 0;
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    // Actualizar foco accesible
    var main = document.getElementById('aacrom-content');
    if (main) main.focus();

    updateNavigationButtons();
    renderLessonList();
    updateProgress();
  }

  function renderBlocks(container, blocks) {
    blocks.forEach(function (block) {
      var blockEl = document.createElement('div');
      blockEl.className = 'aacrom-block aacrom-block--' + block.type;
      blockEl.id = 'aacrom-' + block.id;
      blockEl.setAttribute('data-block-type', block.type);
      blockEl.setAttribute('data-block-id', block.id);

      // Si hay un componente registrado para este tipo, usarlo
      if (components[block.type]) {
        try {
          var rendered = components[block.type].render(block, blockEl);
          if (rendered === false) {
            renderUnsupportedBlock(blockEl, block);
          }
        } catch (e) {
          error('Error renderizando bloque ' + block.type + ':', e);
          renderUnsupportedBlock(blockEl, block);
        }
      } else {
        renderUnsupportedBlock(blockEl, block);
      }

      container.appendChild(blockEl);
    });
  }

  function renderUnsupportedBlock(el, block) {
    // En sub-etapa 3.1 todavía no hay componentes implementados.
    // Mostramos un placeholder para que se vea la estructura.
    el.classList.add('aacrom-block--placeholder');
    el.innerHTML =
      '<div class="aacrom-block__placeholder">' +
        '<strong>[' + escapeHtml(block.type) + ']</strong>' +
        '<small>Componente pendiente de implementar (sub-etapa 3.2+)</small>' +
      '</div>';
  }

  function renderQuizPlaceholder(container, lesson) {
    // Si el motor de quiz está cargado, usarlo
    if (global.AacromQuizEngine && typeof global.AacromQuizEngine.start === 'function') {
      var quizContainer = document.createElement('div');
      quizContainer.className = 'aacrom-quiz-container';
      container.appendChild(quizContainer);
      global.AacromQuizEngine.start(lesson, quizContainer);
      return;
    }

    // Fallback: placeholder si el motor no está cargado
    var div = document.createElement('div');
    div.className = 'aacrom-block aacrom-block--quiz-placeholder';
    div.innerHTML =
      '<div class="aacrom-block__placeholder">' +
        '<strong>[Lección de tipo quiz]</strong>' +
        '<small>El motor de quiz no está cargado</small>' +
        '<small>' + (lesson.questions || []).length + ' pregunta(s) declarada(s)</small>' +
      '</div>';
    container.appendChild(div);
  }

  // -----------------------------------------------------------------
  // Navegación
  // -----------------------------------------------------------------

  function navigateToLesson(index) {
    if (index < 0 || index >= state.course.lessons.length) return;
    state.currentLessonIndex = index;
    renderCurrentLesson();
    saveProgress();
  }

  function navigateNext() {
    if (state.currentLessonIndex < state.course.lessons.length - 1) {
      // Marcar lección actual como completada al avanzar
      var current = state.course.lessons[state.currentLessonIndex];
      if (current) state.completedLessons[current.id] = true;
      navigateToLesson(state.currentLessonIndex + 1);
    } else {
      // Última lección: marcar curso como completado
      var last = state.course.lessons[state.currentLessonIndex];
      if (last) state.completedLessons[last.id] = true;
      saveProgress();
      markCourseAsCompleted();
    }
  }

  function navigatePrev() {
    if (state.currentLessonIndex > 0) {
      navigateToLesson(state.currentLessonIndex - 1);
    }
  }

  function updateNavigationButtons() {
    var prev = document.getElementById('aacrom-prev-lesson');
    var next = document.getElementById('aacrom-next-lesson');

    if (prev) {
      prev.disabled = state.currentLessonIndex === 0;
    }
    if (next) {
      var isLast = state.currentLessonIndex === state.course.lessons.length - 1;
      next.textContent = isLast ? 'Finalizar curso' : 'Siguiente →';
    }
  }

  // -----------------------------------------------------------------
  // Sidebar
  // -----------------------------------------------------------------

  function setupSidebar() {
    var toggle = document.getElementById('aacrom-sidebar-toggle');
    var sidebar = document.getElementById('aacrom-sidebar');
    if (!toggle || !sidebar) return;

    // Crear backdrop dinámicamente. Aparece detrás del sidebar cuando
    // se abre en mobile. Click en el backdrop cierra el sidebar.
    var backdrop = document.createElement('div');
    backdrop.className = 'aacrom-sidebar-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    document.body.appendChild(backdrop);

    function openSidebar() {
      sidebar.classList.add('aacrom-sidebar--open');
      toggle.setAttribute('aria-expanded', 'true');
      backdrop.hidden = false;
      // Permitir que el backdrop se anime con un tick de delay
      requestAnimationFrame(function () {
        backdrop.classList.add('aacrom-sidebar-backdrop--visible');
      });
    }

    function closeSidebar() {
      sidebar.classList.remove('aacrom-sidebar--open');
      toggle.setAttribute('aria-expanded', 'false');
      backdrop.classList.remove('aacrom-sidebar-backdrop--visible');
      // Esperar a que termine la animación antes de ocultar
      setTimeout(function () {
        backdrop.hidden = true;
      }, 250);
    }

    toggle.addEventListener('click', function () {
      var isOpen = sidebar.classList.contains('aacrom-sidebar--open');
      if (isOpen) closeSidebar();
      else openSidebar();
    });

    // Click en el backdrop cierra
    backdrop.addEventListener('click', closeSidebar);

    // Escape cierra
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('aacrom-sidebar--open')) {
        closeSidebar();
      }
    });
  }

  function closeSidebarOnMobile() {
    var sidebar = document.getElementById('aacrom-sidebar');
    var toggle = document.getElementById('aacrom-sidebar-toggle');
    if (window.innerWidth < 768 && sidebar) {
      sidebar.classList.remove('aacrom-sidebar--open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  }

  // -----------------------------------------------------------------
  // Modo claro / oscuro
  // -----------------------------------------------------------------

  function setupThemeToggle() {
    var btn = document.getElementById('aacrom-theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      toggleTheme();
    });
  }

  function toggleTheme() {
    state.themeMode = state.themeMode === 'light' ? 'dark' : 'light';
    applyThemeMode();
    saveProgress();
  }

  function applyThemeMode() {
    var app = document.getElementById('aacrom-app');
    if (app) app.setAttribute('data-theme', state.themeMode);
  }

  // -----------------------------------------------------------------
  // Progreso
  // -----------------------------------------------------------------

  function updateProgress() {
    var total = state.course.lessons.length;
    var completed = 0;
    state.course.lessons.forEach(function (lesson) {
      if (state.completedLessons[lesson.id]) completed++;
    });
    var pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    var bar = document.getElementById('aacrom-progress-bar');
    var label = document.getElementById('aacrom-progress-label');
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = pct + '% completado';
  }

  // -----------------------------------------------------------------
  // Persistencia y SCORM
  // -----------------------------------------------------------------

  function saveProgress() {
    if (!global.AacromSCORM || !global.AacromSCORM.hasLMS()) return;

    var data = {
      lesson: state.currentLessonIndex,
      completedLessons: state.completedLessons,
      completedBlocks: state.completedBlocks,
      themeMode: state.themeMode
    };

    global.AacromSCORM.setSuspendData(data);
    global.AacromSCORM.setLocation(String(state.currentLessonIndex));
  }

  function restoreProgress() {
    if (!global.AacromSCORM || !global.AacromSCORM.hasLMS()) return;

    var data = global.AacromSCORM.getSuspendData();
    if (!data || typeof data !== 'object') return;

    if (typeof data.lesson === 'number' &&
        data.lesson >= 0 &&
        data.lesson < state.course.lessons.length) {
      state.currentLessonIndex = data.lesson;
    }
    if (data.completedLessons) state.completedLessons = data.completedLessons;
    if (data.completedBlocks) state.completedBlocks = data.completedBlocks;
    if (data.themeMode === 'dark' || data.themeMode === 'light') {
      state.themeMode = data.themeMode;
    }

    log('Progreso restaurado:', data);
  }

  function markCourseAsCompleted() {
    if (!global.AacromSCORM) return;
    global.AacromSCORM.setCompleted();
    log('Curso marcado como completado en el LMS.');
  }

  // -----------------------------------------------------------------
  // Manejo de errores
  // -----------------------------------------------------------------

  function showError(message) {
    var errEl = document.getElementById('aacrom-error');
    var msgEl = document.getElementById('aacrom-error__message');
    if (errEl && msgEl) {
      msgEl.textContent = message;
      errEl.classList.remove('aacrom-error--hidden');
    }
    error(message);
  }

  // -----------------------------------------------------------------
  // Sistema de registro de componentes
  // -----------------------------------------------------------------

  /**
   * Registra un componente. Cada componente expone un objeto con:
   *  - render(blockData, containerEl): renderiza el bloque en el contenedor.
   *    Puede retornar false si no puede renderizar (fallback a placeholder).
   *  - destroy(blockData, containerEl): opcional, limpia listeners al cambiar de lección.
   */
  function register(type, component) {
    if (typeof type !== 'string' || !component || typeof component.render !== 'function') {
      warn('Intento de registrar componente inválido:', type);
      return;
    }
    if (VALID_BLOCK_TYPES.indexOf(type) === -1) {
      warn('Tipo de componente "' + type + '" no está en el catálogo aprobado.');
    }
    components[type] = component;
    log('Componente registrado:', type);
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------

  function mergeObjects(target, source) {
    var result = {};
    Object.keys(target).forEach(function (k) { result[k] = target[k]; });
    if (source) {
      Object.keys(source).forEach(function (k) {
        if (source[k] !== undefined && source[k] !== null) result[k] = source[k];
      });
    }
    return result;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -----------------------------------------------------------------
  // Inicialización
  // -----------------------------------------------------------------

  function init(config) {
    state.config = config || {};
    var courseUrl = state.config.courseUrl || 'course.json';

    log('Iniciando runtime con config:', state.config);

    loadCourseJson(courseUrl)
      .then(function (data) {
        // Validar
        var errors = validateCourseJson(data);
        if (errors.length > 0) {
          showError('course.json inválido: ' + errors.join('; '));
          return;
        }

        state.course = data;
        log('Curso cargado:', data.metadata.title);

        // Inyectar tema
        injectTheme(data.theme);

        // Restaurar progreso desde SCORM si existe
        restoreProgress();

        // Setup UI
        renderCourseTitle();
        setupSidebar();
        setupThemeToggle();
        applyThemeMode();

        // Botones de navegación
        var prev = document.getElementById('aacrom-prev-lesson');
        var next = document.getElementById('aacrom-next-lesson');
        if (prev) prev.addEventListener('click', navigatePrev);
        if (next) next.addEventListener('click', navigateNext);

        // Renderizar lección actual
        renderLessonList();
        renderCurrentLesson();

        // Avisar al driver que estamos listos
        var event = new Event('aacrom:ready');
        window.dispatchEvent(event);

        log('Runtime inicializado correctamente.');
      })
      .catch(function (err) {
        showError(err.message || 'Error desconocido al cargar el curso');
      });
  }

  // -----------------------------------------------------------------
  // API pública
  // -----------------------------------------------------------------

  global.AacromRuntime = {
    init: init,
    register: register,
    getState: function () { return state; },
    getComponents: function () { return components; },
    navigateToLesson: navigateToLesson,
    navigateNext: navigateNext,
    navigatePrev: navigatePrev,
    toggleTheme: toggleTheme
  };

})(window);
