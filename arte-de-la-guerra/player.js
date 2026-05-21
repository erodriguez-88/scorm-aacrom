/**
 * Aacrom Course Player
 * Curso: P-A.1 · El arte de la guerra aplicado a los negocios
 */

(function () {
  'use strict';

  let course = null;
  let allScreens = [];
  let currentIndex = 0;
  let completedScreens = new Set();
  let furthestReached = 0;
  let quizState = {};
  let scenarioState = { exploredOptions: new Set(), convergentShown: false };
  
  // Navlock: en SCORM (Moodle) avance bloqueado a una pantalla a la vez,
  // solo se puede saltar a pantallas ya visitadas. En vista previa libre.
  // window.__AACROM_FREE_NAV__ se setea a true en vista previa standalone.
  const FREE_NAV = (typeof window !== 'undefined' && window.__AACROM_FREE_NAV__ === true);
  
  function canNavigateTo(targetIdx) {
    if (FREE_NAV) return true;
    if (targetIdx <= furthestReached) return true;
    if (targetIdx === furthestReached + 1) return true; // permite avanzar 1
    return false;
  }

  // ==========================================================
  // INIT
  // ==========================================================
  async function init() {
    try {
      const resp = await fetch('course.json');
      course = await resp.json();
      buildScreenList();
      buildSidebar();
      loadProgress();
      renderScreen();
      bindNav();
    } catch (e) {
      document.getElementById('screen-container').innerHTML = '<p style="padding:40px;color:#B02A2A">Error cargando el curso: ' + e.message + '</p>';
    }
  }

  function buildScreenList() {
    allScreens = [];
    course.modules.forEach((mod, mi) => {
      mod.screens.forEach((scr, si) => {
        allScreens.push({ ...scr, moduleIndex: mi, screenIndex: si });
      });
    });
    document.getElementById('course-title').textContent = course.title;
  }

  function buildSidebar() {
    const nav = document.getElementById('module-nav');
    nav.innerHTML = '';
    course.modules.forEach((mod, idx) => {
      const item = document.createElement('div');
      item.className = 'module-item';
      item.dataset.moduleIndex = idx;
      item.innerHTML = `
        <div class="icon">≡</div>
        <div class="title">${mod.title}</div>
        <div class="check"></div>
      `;
      item.addEventListener('click', () => jumpToModule(idx));
      nav.appendChild(item);
    });
  }

  function jumpToModule(moduleIndex) {
    const first = allScreens.findIndex(s => s.moduleIndex === moduleIndex);
    if (first < 0) return;
    if (!canNavigateTo(first)) {
      // Módulo bloqueado: mostrar feedback breve, no navegar
      flashLockedMessage();
      return;
    }
    currentIndex = first;
    renderScreen();
    document.getElementById('sidebar').classList.remove('open');
  }

  function flashLockedMessage() {
    let toast = document.getElementById('navlock-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'navlock-toast';
      toast.textContent = '🔒 Complete las pantallas anteriores para avanzar';
      document.body.appendChild(toast);
    }
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(sessionStorage.getItem('aacrom_progress_pa1') || '{}');
      if (saved.completed) completedScreens = new Set(saved.completed);
      if (typeof saved.current === 'number') currentIndex = Math.min(saved.current, allScreens.length - 1);
      if (typeof saved.furthest === 'number') furthestReached = Math.min(saved.furthest, allScreens.length - 1);
      if (currentIndex > furthestReached) furthestReached = currentIndex;
    } catch (e) {}
  }

  function saveProgress() {
    try {
      sessionStorage.setItem('aacrom_progress_pa1', JSON.stringify({
        completed: Array.from(completedScreens),
        current: currentIndex,
        furthest: furthestReached
      }));
    } catch (e) {}
  }

  // ==========================================================
  // SIDEBAR UPDATE
  // ==========================================================
  function updateSidebar() {
    const items = document.querySelectorAll('.module-item');
    const currentModule = allScreens[currentIndex].moduleIndex;

    items.forEach((item, idx) => {
      item.classList.remove('active', 'current', 'completed', 'locked');
      const modScreens = allScreens.filter(s => s.moduleIndex === idx);
      const modCompleted = modScreens.every(s => completedScreens.has(s.id));
      const modFirstScreenIdx = allScreens.findIndex(s => s.moduleIndex === idx);

      if (idx === currentModule) item.classList.add('active', 'current');
      if (modCompleted) item.classList.add('completed');
      // Marca módulos a los que no se puede navegar (solo en SCORM real)
      if (!FREE_NAV && !canNavigateTo(modFirstScreenIdx) && idx !== currentModule) {
        item.classList.add('locked');
      }
    });

    const totalScreens = allScreens.length;
    const completed = completedScreens.size;
    const pct = Math.round((completed / totalScreens) * 100);
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-text').textContent = pct + '% COMPLETADO';
    
    // Refrescar estado del botón "Continuar" (puede que se haya completado una actividad)
    updateFooterNav();
  }

  // ==========================================================
  // RENDER SCREEN
  // ==========================================================
  function renderScreen() {
    const screen = allScreens[currentIndex];
    document.getElementById('screen-counter').textContent = (currentIndex + 1) + ' de ' + allScreens.length;

    // Actualizar furthestReached (la pantalla más avanzada visitada hasta ahora)
    if (currentIndex > furthestReached) furthestReached = currentIndex;
    
    // En SCORM real, las pantallas de tipo lectura se marcan completadas al visitar.
    // Las interactivas (kc, quiz, sorting, decision_matrix, decision_scenario, hotspots)
    // requieren completar la interacción para marcarse.
    const interactiveTypes = ['knowledge_check', 'quiz', 'sorting', 'decision_matrix', 'decision_scenario', 'hotspots'];
    if (!interactiveTypes.includes(screen.type)) {
      completedScreens.add(screen.id);
    }
    saveProgress();

    // Detener cualquier audio en reproducción antes de cambiar de pantalla
    stopAllAudios();

    const container = document.getElementById('screen-container');
    container.scrollTop = 0;

    let html = '';
    switch (screen.type) {
      case 'course_cover':       html = renderCourseCover(screen); break;
      case 'statement_list':     html = renderStatementList(screen); break;
      case 'module_intro':       html = renderModuleIntro(screen); break;
      case 'paragraph_audio':    html = renderParagraphAudio(screen); break;
      case 'hotspots':           html = renderHotspots(screen); break;
      case 'tabs':               html = renderTabs(screen); break;
      case 'case_study':         html = renderCaseStudy(screen); break;
      case 'module_outro':       html = renderModuleOutro(screen); break;
      case 'knowledge_check':    html = renderKnowledgeCheck(screen); break;
      case 'accordion':          html = renderAccordion(screen); break;
      case 'statement_paragraph':html = renderStatementParagraph(screen); break;
      case 'sorting':            html = renderSorting(screen); break;
      case 'decision_matrix':    html = renderDecisionMatrix(screen); break;
      case 'decision_scenario':  html = renderDecisionScenario(screen); break;
      case 'quiz':               html = renderQuiz(screen); break;
      default:                   html = `<div style="padding:40px;">Tipo no implementado: ${screen.type}</div>`;
    }

    container.innerHTML = html;

    if (screen.type === 'hotspots')          attachHotspotEvents(screen);
    else if (screen.type === 'tabs')          attachTabEvents(screen);
    else if (screen.type === 'accordion')     attachAccordionEvents(screen);
    else if (screen.type === 'knowledge_check')attachKCEvents(screen);
    else if (screen.type === 'sorting')       attachSortingEvents(screen);
    else if (screen.type === 'decision_matrix')attachMatrixEvents(screen);
    else if (screen.type === 'decision_scenario')attachScenarioEvents(screen);
    else if (screen.type === 'quiz')          attachQuizEvents(screen);

    if (!isInteractiveScreen(screen)) completedScreens.add(screen.id);
    updateSidebar();
    updateFooterNav();
    saveProgress();
    autoplayFirstAudio(screen);
  }

  // ==========================================================
  // AUTOPLAY
  // ==========================================================
  // Registro global de audios programáticos (creados con new Audio())
  // para garantizar que stopAllAudios los detenga al cambiar de pantalla.
  // REGLA: nunca pueden sonar dos audios al mismo tiempo.
  window.__aacromAudios = window.__aacromAudios || [];
  
  function registerAudio(audioInstance) {
    if (!audioInstance) return audioInstance;
    if (window.__aacromAudios.indexOf(audioInstance) === -1) {
      window.__aacromAudios.push(audioInstance);
    }
    return audioInstance;
  }

  function stopAllAudios() {
    // 1. Detener todos los audios del DOM (elementos <audio>)
    document.querySelectorAll('audio').forEach(a => {
      try { a.pause(); a.currentTime = 0; } catch (e) {}
    });
    // 2. Detener todos los audios programáticos registrados
    if (window.__aacromAudios) {
      window.__aacromAudios.forEach(a => {
        try { a.pause(); a.currentTime = 0; } catch (e) {}
      });
      // Limpiar el array (las referencias quedan vivas en sus closures locales,
      // pero las pausamos y reseteamos)
      window.__aacromAudios = [];
    }
  }

  function autoplayFirstAudio(screen) {
    // En Decision Scenario, el autoplay y encadenado se maneja en attachScenarioEvents
    if (screen.type === 'decision_scenario') return;
    // REGLA: detener cualquier audio activo antes de reproducir uno nuevo
    stopAllAudios();
    const firstAudio = document.querySelector('#screen-container audio');
    if (firstAudio) {
      // El navegador puede bloquear el autoplay si no hubo interacción previa.
      // El catch evita errores; el usuario puede darle play manualmente.
      const p = firstAudio.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  function isInteractiveScreen(screen) {
    return ['knowledge_check', 'sorting', 'quiz', 'decision_scenario'].includes(screen.type);
  }

  // ==========================================================
  // RENDERERS
  // ==========================================================
  function audioHTML(audioFile) {
    if (!audioFile) return '';
    return `
      <div class="instructions-box">
        <div class="badge-icon"></div>
        <div class="text"><strong>Instrucciones:</strong> presione el botón "▶" y escuche atentamente el audio.</div>
      </div>
      <audio controls preload="metadata"><source src="assets/audio/${audioFile}" type="audio/mpeg">Su navegador no soporta audio.</audio>
    `;
  }

  function headerHTML(screen, opts) {
    // opts puede ser: false (sin imagen), true (con imagen modo simple),
    // o un objeto { hero: true, eyebrow: 'TEXT' } para hero cinemático
    if (opts && typeof opts === 'object' && opts.hero && screen.image) {
      const eyebrow = opts.eyebrow ? `<span class="hero-eyebrow">${opts.eyebrow}</span>` : '';
      return `
        <div class="screen-header hero">
          <div class="hero-image" style="background-image: url('assets/images/${screen.image}')"></div>
          <div class="hero-content">
            ${eyebrow}
            <h1>${screen.title}</h1>
          </div>
        </div>
      `;
    }
    return `
      <div class="screen-header">
        <h1>${screen.title}</h1>
        <div class="header-line"></div>
      </div>
    `;
  }

  function renderCourseCover(s) {
    return `
      ${headerHTML(s, { hero: true, eyebrow: 'CURSO AACROM · P-A.1' })}
      <div class="screen-body">
        <h2 class="subtitle-blue">Bienvenida</h2>
        ${audioHTML(s.audio)}
        ${s.body.map(p => `<p>${p}</p>`).join('')}
      </div>
    `;
  }

  function renderStatementList(s) {
    const hasImage = !!s.image;
    const header = hasImage 
      ? headerHTML(s, { hero: true, eyebrow: s.eyebrow || '' })
      : headerHTML(s, false);
    return `
      ${header}
      <div class="screen-body">
        ${s.statement ? `<div class="statement">${s.statement}</div>` : ''}
        ${s.audio ? audioHTML(s.audio) : ''}
        ${s.intro ? `<p style="font-weight:600;color:var(--aacrom-primary);margin-top:30px">${s.intro}</p>` : ''}
        <ul class="aacrom-list">${s.items.map(i => `<li><span>${i}</span></li>`).join('')}</ul>
      </div>
    `;
  }

  function renderModuleIntro(s) {
    const moduleNum = (s.moduleIndex !== undefined) ? (s.moduleIndex) : '';
    const eyebrow = moduleNum !== '' ? `MÓDULO ${moduleNum}` : 'MÓDULO';
    // moduleIndex es 0-based en allScreens, pero P3 (M1) tiene moduleIndex=1 porque el aspectos introductorios es módulo 0
    // En realidad mejor extraerlo del título o usar otra fuente. Vamos a inferir del título "Conocer al enemigo..." → M1
    let moduleLabel = 'MÓDULO';
    if (s.title.includes('enemigo')) moduleLabel = 'MÓDULO 1';
    else if (s.title.includes('terreno')) moduleLabel = 'MÓDULO 2';
    else if (s.title.includes('Maniobr') || s.title.includes('timing')) moduleLabel = 'MÓDULO 3';
    else if (s.title.includes('Ejecuci') || s.title.includes('decisi')) moduleLabel = 'MÓDULO 4';
    return `
      ${headerHTML(s, { hero: true, eyebrow: moduleLabel })}
      <div class="screen-body">
        ${audioHTML(s.audio)}
        <div class="statement">${s.statement}<span class="statement-citation">${s.citation}</span></div>
      </div>
    `;
  }

  function renderParagraphAudio(s) {
    return `
      ${headerHTML(s, false)}
      <div class="screen-body">
        ${audioHTML(s.audio)}
        ${s.image ? `<div class="context-image-wrapper"><img src="assets/images/${s.image}" class="context-image" alt=""></div>` : ''}
        <p>${s.body}</p>
      </div>
    `;
  }

  function renderStatementParagraph(s) {
    return `
      ${headerHTML(s, false)}
      <div class="screen-body">
        <div class="statement">${s.statement}</div>
        ${s.audio ? audioHTML(s.audio) : ''}
        ${s.image ? `<div class="context-image-wrapper"><img src="assets/images/${s.image}" class="context-image" alt=""></div>` : ''}
        ${s.subheading ? `<h3 style="font-family:var(--font-display);text-align:center;color:var(--aacrom-primary);margin:32px 0 18px;font-size:24px;font-weight:600;letter-spacing:-0.01em">${s.subheading}</h3>` : ''}
        <p>${s.body}</p>
      </div>
    `;
  }

  function renderCaseStudy(s) {
    return `
      ${headerHTML(s, false)}
      <div class="screen-body">
        ${audioHTML(s.audio)}
        <div class="case-card-wrapper">
          <div class="bg-image" style="background-image: url('assets/images/${s.image}')"></div>
          <div class="card-content">
            ${s.subtitle ? `<div class="card-subtitle">${s.subtitle}</div>` : ''}
            <p>${s.body}</p>
          </div>
        </div>
      </div>
    `;
  }

  function renderModuleOutro(s) {
    const hasImage = !!s.image;
    let moduleLabel = 'EN ESTE MÓDULO';
    if (s.title.includes('1') || s.title.toLowerCase().includes('enemigo')) moduleLabel = 'CIERRE MÓDULO 1';
    else if (s.title.includes('2') || s.title.toLowerCase().includes('terreno')) moduleLabel = 'CIERRE MÓDULO 2';
    else if (s.title.includes('3') || s.title.toLowerCase().includes('maniobr')) moduleLabel = 'CIERRE MÓDULO 3';
    else if (s.title.includes('4') || s.title.toLowerCase().includes('decisi') || s.title.toLowerCase().includes('ejecuci')) moduleLabel = 'CIERRE MÓDULO 4';
    const header = hasImage 
      ? headerHTML(s, { hero: true, eyebrow: moduleLabel })
      : headerHTML(s, false);
    return `
      ${header}
      <div class="screen-body">
        ${s.audio ? audioHTML(s.audio) : ''}
        <ul class="aacrom-list">${s.items.map(i => `<li><span>${i}</span></li>`).join('')}</ul>
      </div>
    `;
  }

  function renderHotspots(s) {
    return `
      ${headerHTML(s, false)}
      <div class="screen-body">
        <p class="center">${s.intro}</p>
        <div class="hotspots-container">
          ${s.image ? `<img src="assets/images/${s.image}" class="hotspots-image" alt="">` : ''}
          <div class="hotspots-list">
            ${s.hotspots.map((h, i) => `<button class="hotspot-btn" data-idx="${i}">${h.label}</button>`).join('')}
          </div>
          <div class="hotspot-content" id="hotspot-content"></div>
        </div>
      </div>
    `;
  }

  function renderTabs(s) {
    const hasImage = !!s.image;
    const eyebrow = (s.eyebrow !== undefined) ? s.eyebrow : '';
    const header = hasImage 
      ? headerHTML(s, { hero: true, eyebrow: eyebrow })
      : headerHTML(s, false);
    return `
      ${header}
      <div class="screen-body">
        ${s.statement ? `<div class="statement">${s.statement}</div>` : ''}
        ${s.audio ? audioHTML(s.audio) : ''}
        ${s.intro ? `<p class="center">${s.intro}</p>` : ''}
        <div class="tabs-container">
          <div class="tabs-nav">
            ${s.tabs.map((t, i) => `<button class="tab-btn ${i === 0 ? 'active' : ''}" data-idx="${i}">${t.title}</button>`).join('')}
          </div>
          ${s.tabs.map((t, i) => `<div class="tab-panel ${i === 0 ? 'active' : ''}" data-idx="${i}">${t.content}</div>`).join('')}
        </div>
        ${s.conclusion ? `<div class="tabs-conclusion">${s.conclusion}</div>` : ''}
      </div>
    `;
  }

  function renderAccordion(s) {
    const hasImage = !!s.image;
    const header = hasImage 
      ? headerHTML(s, { hero: true, eyebrow: 'EL TERRENO COMPETITIVO' })
      : headerHTML(s, false);
    return `
      ${header}
      <div class="screen-body">
        ${s.audio ? audioHTML(s.audio) : ''}
        <p class="center">${s.intro}</p>
        <div class="accordion">
          ${s.items.map((it, i) => `
            <div class="accordion-item" data-idx="${i}">
              <div class="accordion-header">
                <span>${it.title}</span>
                <span class="toggle">+</span>
              </div>
              <div class="accordion-content"><div class="accordion-content-inner">${it.content}</div></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderDecisionMatrix(s) {
    const ordered = ['tl', 'tr', 'bl', 'br'];
    const qByPos = {};
    s.quadrants.forEach(q => qByPos[q.position] = q);
    return `
      ${headerHTML(s, false)}
      <div class="screen-body">
        <p class="center">${s.intro}</p>
        <div class="matrix-container">
          <div class="matrix-grid">
            ${ordered.map((pos, i) => {
              const q = qByPos[pos];
              return `<div class="matrix-quadrant" data-pos="${pos}" style="background:${q.color}">${q.label}</div>`;
            }).join('')}
          </div>
          <div class="matrix-label-x">${s.xAxis}</div>
          <div class="matrix-label-y">${s.yAxis}</div>
        </div>
        <div class="matrix-content" id="matrix-content"></div>
      </div>
    `;
  }

  function renderDecisionScenario(s) {
    const hasHero = !!s.image;
    const header = hasHero
      ? headerHTML(s, { hero: true, eyebrow: s.eyebrow || 'DECISIÓN' })
      : headerHTML(s, false);
    // Galería de escenas opcional (3 imágenes en miniatura con caption)
    const scenesHTML = (s.scenes && s.scenes.length > 0) ? `
      <div class="scenes-gallery">
        ${s.scenes.map(sc => `
          <figure class="scene-item">
            <img src="assets/images/${sc.image}" alt="">
            <figcaption>${sc.caption}</figcaption>
          </figure>
        `).join('')}
      </div>
    ` : '';
    return `
      ${header}
      <div class="screen-body screen-questions-bg">
        <div class="scenario-container">
          <div class="scenario-intro-card">
            <p style="font-size:17px;margin-bottom:14px">${s.intro_text}</p>
            <audio controls preload="metadata" id="scenario-intro-audio" style="max-width:100%"><source src="assets/audio/${s.intro_audio}" type="audio/mpeg"></audio>
          </div>

          ${scenesHTML}

          <div class="dialogue-container" id="dialogue">
            ${s.dialogue.map((d, i) => {
              const isAndres = d.character === 'Andrés Mora';
              const isNarrator = d.character === 'Narrador';
              const cls = isAndres ? 'andres' : (isNarrator ? 'narrator' : '');
              const initial = isNarrator ? '"' : d.character.charAt(0);
              return `
                <div class="dialogue-line" data-idx="${i}" title="Click para volver a escuchar">
                  <div class="dialogue-avatar ${cls}">${initial}</div>
                  <div class="dialogue-body">
                    <div class="dialogue-character">${d.character}${d.role ? `<span class="role" style="font-weight:400;color:var(--aacrom-text-muted);font-size:11px;margin-left:8px;text-transform:none">${d.role}</span>` : ''}</div>
                    <div class="dialogue-text">${d.text}</div>
                    <audio preload="metadata"><source src="assets/audio/${d.audio}" type="audio/mpeg"></audio>
                  </div>
                </div>
              `;
            }).join('')}
            <div class="dialogue-controls">
              <button class="dialogue-control-btn" id="dialogue-restart">↻ Volver a escuchar la escena</button>
            </div>
          </div>

          <div class="scenario-question">¿Qué recomienda al comité?</div>
          <div class="scenario-options" id="scenario-options">
            ${s.options.map(o => `
              <button class="scenario-option-btn" data-id="${o.id}">
                <div><span class="option-id">${o.id}</span><span class="option-label">${o.label}</span></div>
                <div class="option-sub">${o.subtitle}</div>
              </button>
            `).join('')}
          </div>

          <div class="scenario-result" id="scenario-result" style="display:none"></div>

          <div class="scenario-convergent" id="scenario-convergent">
            <h4>${s.convergent_title}</h4>
            <p>${s.convergent_text}</p>
            <audio controls preload="metadata" style="margin-top:16px;max-width:100%;filter:invert(0.85) hue-rotate(180deg)"><source src="assets/audio/${s.convergent_audio}" type="audio/mpeg"></audio>
          </div>
        </div>
      </div>
    `;
  }

  function renderKnowledgeCheck(s) {
    return `
      ${headerHTML(s, false)}
      <div class="screen-body screen-questions-bg">
        ${s.questions.map((q, i) => `
          <div class="question-card" data-qidx="${i}">
            <div class="question-counter">PREGUNTA ${i + 1} DE ${s.questions.length}</div>
            <div class="question-stem">${q.stem}</div>
            <div class="options-container">
              ${q.options.map((opt, j) => `
                <div class="option-row" data-opt="${j}">
                  <input type="${q.type === 'multiple' ? 'checkbox' : 'radio'}" name="q${i}" id="q${i}o${j}" value="${j}">
                  <label for="q${i}o${j}">${opt}</label>
                </div>
              `).join('')}
            </div>
            <button class="quiz-submit" data-qidx="${i}">Verificar respuesta</button>
            <div class="feedback-box"><div class="feedback-title"></div><p></p></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderSorting(s) {
    const shuffled = [...s.items].map((it, i) => ({ ...it, originalIdx: i })).sort(() => Math.random() - 0.5);
    return `
      ${headerHTML(s, false)}
      <div class="screen-body screen-questions-bg">
        ${s.audio ? audioHTML(s.audio) : ''}
        <p style="font-weight:600;color:var(--aacrom-primary)">${s.instruction}</p>
        <div class="sorting-container">
          <div class="sorting-items-pool" id="sorting-pool" data-zone="pool">
            ${shuffled.map((it, i) => `
              <div class="sortable-item" draggable="true" data-original="${it.originalIdx}" data-category="${it.category}">${it.text}</div>
            `).join('')}
          </div>
          <div class="sorting-categories">
            ${s.categories.map((cat, i) => `
              <div class="sorting-category" data-zone="${i}">
                <div class="sorting-category-title">${cat}</div>
                <div class="sorting-drop-zone"></div>
              </div>
            `).join('')}
          </div>
          <button class="quiz-submit" id="sorting-check">Verificar</button>
          <div class="feedback-box" id="sorting-feedback"><div class="feedback-title"></div><p></p></div>
          <div class="sorting-explanations" id="sorting-explanations"></div>
        </div>
      </div>
    `;
  }

  function renderQuiz(s) {
    return `
      ${headerHTML(s, false)}
      <div class="screen-body screen-questions-bg">
        <p style="text-align:center;color:var(--aacrom-text-muted);font-size:16px;margin-bottom:30px">${s.intro}</p>

        ${s.questions.map((q, i) => {
          if (q.type === 'matching') {
            const rights = [...q.pairs].map(p => p.right).sort(() => Math.random() - 0.5);
            return `
              <div class="question-card" data-qidx="${i}" data-qtype="matching">
                <div class="question-counter">PREGUNTA ${i + 1} DE ${s.questions.length}</div>
                <div class="question-stem">${q.stem}</div>
                <div class="matching-grid">
                  ${q.pairs.map((pair, pi) => `
                    <div class="matching-row" data-left="${pi}">
                      <div class="matching-cell left">${pair.left}</div>
                      <div class="matching-arrow">→</div>
                      <select class="matching-cell" data-pair="${pi}" style="border:2px solid var(--aacrom-border);background:white;font-family:inherit;font-size:15px;padding:14px 12px;border-radius:10px;cursor:pointer">
                        <option value="">— Seleccione —</option>
                        ${rights.map((r, ri) => `<option value="${r}">${r}</option>`).join('')}
                      </select>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }
          return `
            <div class="question-card" data-qidx="${i}" data-qtype="${q.type}">
              <div class="question-counter">PREGUNTA ${i + 1} DE ${s.questions.length}</div>
              <div class="question-stem">${q.stem}</div>
              <div class="options-container">
                ${q.options.map((opt, j) => `
                  <div class="option-row" data-opt="${j}">
                    <input type="${q.type === 'multiple' ? 'checkbox' : 'radio'}" name="quiz_q${i}" id="quiz_q${i}o${j}" value="${j}">
                    <label for="quiz_q${i}o${j}">${opt}</label>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}

        <button class="quiz-submit" id="quiz-submit">Enviar evaluación</button>
        <div id="quiz-result"></div>
      </div>
    `;
  }

  // ==========================================================
  // EVENT HANDLERS
  // ==========================================================
  function attachHotspotEvents(screen) {
    const btns = document.querySelectorAll('.hotspot-btn');
    const content = document.getElementById('hotspot-content');
    let viewed = new Set();
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active', 'viewed');
        viewed.add(idx);
        content.innerHTML = `<strong style="color:var(--aacrom-primary);display:block;margin-bottom:8px">${screen.hotspots[idx].label}</strong>${screen.hotspots[idx].content}`;
        content.classList.add('show');
        if (viewed.size === screen.hotspots.length) {
          completedScreens.add(screen.id);
          updateSidebar(); saveProgress();
        }
      });
    });
  }

  function attachTabEvents(screen) {
    const btns = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.tab-panel');
    let viewed = new Set([0]);
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        btns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        panels[idx].classList.add('active');
        viewed.add(idx);
        if (viewed.size === btns.length) {
          completedScreens.add(screen.id);
          updateSidebar(); saveProgress();
        }
      });
    });
  }

  function attachAccordionEvents(screen) {
    const items = document.querySelectorAll('.accordion-item');
    let opened = new Set();
    items.forEach(item => {
      const header = item.querySelector('.accordion-header');
      header.addEventListener('click', () => {
        item.classList.toggle('open');
        opened.add(parseInt(item.dataset.idx));
        if (opened.size === items.length) {
          completedScreens.add(screen.id);
          updateSidebar(); saveProgress();
        }
      });
    });
  }

  function attachMatrixEvents(screen) {
    const quads = document.querySelectorAll('.matrix-quadrant');
    const content = document.getElementById('matrix-content');
    let viewed = new Set();
    let currentAudio = null;

    quads.forEach(q => {
      q.addEventListener('click', () => {
        const pos = q.dataset.pos;
        const data = screen.quadrants.find(x => x.position === pos);
        quads.forEach(x => x.classList.remove('active'));
        q.classList.add('active', 'visited');
        viewed.add(pos);

        content.innerHTML = `<strong style="color:${data.color}">${data.label}</strong>${data.content}`;
        content.classList.add('show');

        // REGLA: nunca pueden sonar dos audios al mismo tiempo.
        // Detener cualquier otro audio activo (incluyendo este si ya estaba sonando)
        stopAllAudios();
        if (data.audio) {
          currentAudio = registerAudio(new Audio('assets/audio/' + data.audio));
          const p = currentAudio.play();
          if (p && p.catch) p.catch(() => {});
        }

        if (viewed.size === 4) {
          completedScreens.add(screen.id);
          updateSidebar(); saveProgress();
        }
      });
    });
  }

  function attachKCEvents(screen) {
    document.querySelectorAll('.question-card').forEach(card => {
      const qidx = parseInt(card.dataset.qidx);
      const q = screen.questions[qidx];
      const submitBtn = card.querySelector('.quiz-submit');
      const feedback = card.querySelector('.feedback-box');

      // Toggle selected style
      card.querySelectorAll('.option-row').forEach(row => {
        row.addEventListener('click', () => {
          if (q.type === 'single') {
            card.querySelectorAll('.option-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            row.querySelector('input').checked = true;
          } else {
            const input = row.querySelector('input');
            input.checked = !input.checked;
            row.classList.toggle('selected', input.checked);
          }
        });
      });

      submitBtn.addEventListener('click', () => {
        const inputs = card.querySelectorAll('input');
        const selected = Array.from(inputs).map((inp, i) => inp.checked ? i : null).filter(x => x !== null);
        if (selected.length === 0) {
          feedback.classList.remove('correct', 'incorrect');
          feedback.classList.add('show');
          feedback.querySelector('.feedback-title').textContent = 'Seleccione una respuesta';
          feedback.querySelector('p').textContent = '';
          return;
        }
        let correct = false;
        if (q.type === 'multiple') {
          const correctSet = new Set(q.correct);
          const selSet = new Set(selected);
          correct = correctSet.size === selSet.size && Array.from(correctSet).every(x => selSet.has(x));
        } else {
          correct = selected[0] === q.correct;
        }
        // marca visual
        card.querySelectorAll('.option-row').forEach((row, i) => {
          row.classList.remove('correct', 'incorrect');
          const correctIdx = q.type === 'multiple' ? q.correct : [q.correct];
          if (correctIdx.includes(i)) row.classList.add('correct');
          else if (selected.includes(i)) row.classList.add('incorrect');
        });
        feedback.classList.add('show');
        feedback.classList.toggle('correct', correct);
        feedback.classList.toggle('incorrect', !correct);
        feedback.querySelector('.feedback-title').textContent = correct ? '¡Correcto!' : 'Revisemos esto:';
        feedback.querySelector('p').textContent = q.feedback;
        submitBtn.disabled = true;
        inputs.forEach(i => i.disabled = true);

        // marca completado si todas las preguntas respondidas
        const allAnswered = Array.from(document.querySelectorAll('.question-card .quiz-submit')).every(b => b.disabled);
        if (allAnswered) {
          completedScreens.add(screen.id);
          updateSidebar(); saveProgress();
        }
      });
    });
  }

  function attachSortingEvents(screen) {
    let dragged = null;
    document.querySelectorAll('.sortable-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        dragged = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        dragged = null;
      });
    });

    document.querySelectorAll('.sorting-category, #sorting-pool').forEach(zone => {
      const dropZone = zone.querySelector('.sorting-drop-zone') || zone;
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (dragged) {
          (zone.querySelector('.sorting-drop-zone') || zone).appendChild(dragged);
        }
      });
    });

    document.getElementById('sorting-check').addEventListener('click', () => {
      const items = document.querySelectorAll('.sortable-item');
      let allCorrect = true;
      items.forEach(item => {
        const parent = item.closest('.sorting-category');
        if (!parent) { allCorrect = false; return; }
        const zone = parseInt(parent.dataset.zone);
        const cat = parseInt(item.dataset.category);
        item.classList.remove('correct-placed', 'wrong-placed');
        if (zone === cat) item.classList.add('correct-placed');
        else { item.classList.add('wrong-placed'); allCorrect = false; }
      });
      const fb = document.getElementById('sorting-feedback');
      fb.classList.add('show');
      fb.classList.toggle('correct', allCorrect);
      fb.classList.toggle('incorrect', !allCorrect);
      fb.querySelector('.feedback-title').textContent = allCorrect ? '¡Excelente! Todas correctas.' : 'Algunas no están bien ubicadas. Revise las explicaciones de cada categoría.';
      fb.querySelector('p').textContent = screen.feedback;

      // Mostrar explicaciones por categoría (mejora v3)
      if (screen.category_explanations) {
        const explDiv = document.getElementById('sorting-explanations');
        explDiv.innerHTML = '<h3 style="font-size:18px;color:var(--aacrom-primary);margin:30px 0 16px;text-align:center">Por qué cada situación pertenece a su categoría</h3>' +
          screen.category_explanations.map(ex => `
            <div class="sorting-explanation-row">
              <div class="cat-label">${ex.category_name}</div>
              <div class="cat-explanation"><em style="color:var(--aacrom-text-muted);font-size:13px">"${ex.correct_item}"</em><br><br>${ex.explanation}</div>
            </div>
          `).join('');
      }

      completedScreens.add(screen.id);
      updateSidebar(); saveProgress();
    });
  }

  function attachScenarioEvents(screen) {
    // ----- Encadenamiento automático de audios de la escena -----
    const introAudio = document.querySelector('.scenario-intro-card audio');
    const dialogueLines = document.querySelectorAll('.dialogue-line');
    const dialogueAudios = Array.from(dialogueLines).map(l => l.querySelector('audio'));

    // Marca visual de la línea activa
    dialogueAudios.forEach((aud, idx) => {
      if (!aud) return;
      aud.addEventListener('play', () => {
        dialogueLines.forEach(l => l.classList.remove('active'));
        if (dialogueLines[idx]) {
          dialogueLines[idx].classList.add('active');
          dialogueLines[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      aud.addEventListener('ended', () => {
        if (dialogueLines[idx]) {
          dialogueLines[idx].classList.add('played');
          dialogueLines[idx].classList.remove('active');
        }
        const next = dialogueAudios[idx + 1];
        if (next) setTimeout(() => { const p = next.play(); if (p && p.catch) p.catch(() => {}); }, 600);
      });
    });

    // Click en cada línea = repetir esa línea
    dialogueLines.forEach((line, idx) => {
      line.addEventListener('click', (e) => {
        // No interceptar si el click fue en algún botón anidado
        if (e.target.closest('button')) return;
        // Detener cualquier audio sonando
        if (introAudio) { try { introAudio.pause(); introAudio.currentTime = 0; } catch (e) {} }
        dialogueAudios.forEach(a => { if (a) { try { a.pause(); } catch (e) {} } });
        dialogueLines.forEach(l => l.classList.remove('active'));
        // Reproducir esta línea
        const audio = dialogueAudios[idx];
        if (audio) { audio.currentTime = 0; const p = audio.play(); if (p && p.catch) p.catch(() => {}); }
      });
    });

    // Botón "Volver a escuchar la escena": reinicia todo desde la entrada
    const restartBtn = document.getElementById('dialogue-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        // Detener cualquier audio
        if (introAudio) { try { introAudio.pause(); introAudio.currentTime = 0; } catch (e) {} }
        dialogueAudios.forEach(a => { if (a) { try { a.pause(); a.currentTime = 0; } catch (e) {} } });
        dialogueLines.forEach(l => { l.classList.remove('active', 'played'); });
        // Reproducir desde la entrada
        if (introAudio) { const p = introAudio.play(); if (p && p.catch) p.catch(() => {}); }
      });
    }

    // Encadenar entrada → primera línea
    if (introAudio && dialogueAudios.length > 0) {
      introAudio.addEventListener('ended', () => {
        setTimeout(() => { const p = dialogueAudios[0].play(); if (p && p.catch) p.catch(() => {}); }, 800);
      });
      // Autoplay de entrada
      const p = introAudio.play(); if (p && p.catch) p.catch(() => {});
    }

    // ----- Opciones del escenario -----
    document.querySelectorAll('#scenario-options .scenario-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Detener cualquier audio del diálogo si está sonando
        if (introAudio) { try { introAudio.pause(); } catch (e) {} }
        dialogueAudios.forEach(a => { if (a) { try { a.pause(); } catch (e) {} } });

        const id = btn.dataset.id;
        const option = screen.options.find(o => o.id === id);
        scenarioState.exploredOptions.add(id);

        const result = document.getElementById('scenario-result');
        result.style.display = 'block';
        result.classList.remove('correct', 'incorrect');
        result.classList.add(option.correct ? 'correct' : 'incorrect');
        result.innerHTML = `
          <div class="scenario-result-badge">${option.correct ? 'DECISIÓN ACERTADA' : 'REVISEMOS'}</div>
          <h4>${option.result}</h4>
          <p>${option.outcome}</p>
          <audio controls preload="metadata" id="consequence-audio" style="margin-top:16px;max-width:100%"><source src="assets/audio/${option.audio}" type="audio/mpeg"></audio>
          <div class="scenario-actions">
            <button class="nav-btn" id="scenario-retry">Volver a decidir</button>
            ${option.correct || scenarioState.exploredOptions.size >= 2 ? '<button class="nav-btn primary" id="scenario-continue">Ver lo que pasó en la realidad</button>' : ''}
          </div>
        `;

        const consAudio = document.getElementById('consequence-audio');
        if (consAudio) { const p = consAudio.play(); if (p && p.catch) p.catch(() => {}); }

        document.getElementById('scenario-result').scrollIntoView({ behavior: 'smooth', block: 'start' });

        const retry = document.getElementById('scenario-retry');
        if (retry) retry.addEventListener('click', () => {
          if (consAudio) { try { consAudio.pause(); } catch (e) {} }
          result.style.display = 'none';
          document.getElementById('scenario-options').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        const cont = document.getElementById('scenario-continue');
        if (cont) cont.addEventListener('click', () => {
          if (consAudio) { try { consAudio.pause(); } catch (e) {} }
          const convergent = document.getElementById('scenario-convergent');
          convergent.classList.add('show');
          scenarioState.convergentShown = true;
          completedScreens.add(screen.id);
          updateSidebar(); saveProgress();
          convergent.scrollIntoView({ behavior: 'smooth' });
          const convAudio = convergent.querySelector('audio');
          if (convAudio) setTimeout(() => { const p = convAudio.play(); if (p && p.catch) p.catch(() => {}); }, 600);
        });
      });
    });
  }

  function attachQuizEvents(screen) {
    document.querySelectorAll('.question-card').forEach(card => {
      const qidx = parseInt(card.dataset.qidx);
      const q = screen.questions[qidx];
      if (q.type !== 'matching') {
        card.querySelectorAll('.option-row').forEach(row => {
          row.addEventListener('click', () => {
            if (q.type === 'single') {
              card.querySelectorAll('.option-row').forEach(r => r.classList.remove('selected'));
              row.classList.add('selected');
              row.querySelector('input').checked = true;
            } else {
              const input = row.querySelector('input');
              input.checked = !input.checked;
              row.classList.toggle('selected', input.checked);
            }
          });
        });
      }
    });

    document.getElementById('quiz-submit').addEventListener('click', () => {
      let correctCount = 0;
      const total = screen.questions.length;
      const results = [];

      screen.questions.forEach((q, qi) => {
        const card = document.querySelector(`.question-card[data-qidx="${qi}"]`);
        let isCorrect = false;
        if (q.type === 'matching') {
          const selects = card.querySelectorAll('select');
          let allRight = true;
          selects.forEach((sel, pi) => {
            const expected = q.pairs[pi].right;
            if (sel.value === expected) {
              sel.style.borderColor = 'var(--aacrom-success)';
              sel.style.background = '#E8F5EC';
            } else {
              sel.style.borderColor = 'var(--aacrom-danger)';
              sel.style.background = '#FBEAEA';
              allRight = false;
            }
            sel.disabled = true;
          });
          isCorrect = allRight;
        } else {
          const inputs = card.querySelectorAll('input');
          const selected = Array.from(inputs).map((inp, i) => inp.checked ? i : null).filter(x => x !== null);
          if (q.type === 'multiple') {
            const correctSet = new Set(q.correct);
            const selSet = new Set(selected);
            isCorrect = correctSet.size === selSet.size && Array.from(correctSet).every(x => selSet.has(x));
            inputs.forEach((inp, i) => inp.disabled = true);
            card.querySelectorAll('.option-row').forEach((row, i) => {
              if (q.correct.includes(i)) row.classList.add('correct');
              else if (selected.includes(i)) row.classList.add('incorrect');
            });
          } else {
            isCorrect = selected[0] === q.correct;
            inputs.forEach(inp => inp.disabled = true);
            card.querySelectorAll('.option-row').forEach((row, i) => {
              if (i === q.correct) row.classList.add('correct');
              else if (selected.includes(i)) row.classList.add('incorrect');
            });
          }
        }
        if (isCorrect) correctCount++;
        results.push(isCorrect);
      });

      const pct = Math.round((correctCount / total) * 100);
      const passed = pct >= screen.passingScore;

      const resultDiv = document.getElementById('quiz-result');
      resultDiv.innerHTML = `
        <div class="quiz-result-summary">
          <div class="score">${correctCount}<span class="total">/${total}</span></div>
          <div class="label">RESPUESTAS CORRECTAS · ${pct}%</div>
          <div class="badge ${passed ? 'passed' : 'failed'}">${passed ? 'APROBADO' : 'NO APROBADO'}</div>
          <p>${passed
            ? 'Ha terminado el curso. Los principios del Arte de la guerra son más útiles para los negocios cuando no se memorizan: se aplican. La próxima vez que enfrente una decisión competitiva real, repase las cuatro preguntas: ¿qué tan bien conozco al competidor y a mí mismo? ¿En qué terreno estoy parado? ¿Cómo y cuándo conviene moverme? ¿Estoy listo para decidir?'
            : 'Le sugerimos revisar los módulos donde se equivocó y volver a intentar la evaluación. La aprobación se obtiene con ' + screen.passingScore + '% o más.'}</p>
        </div>
      `;

      document.getElementById('quiz-submit').disabled = true;
      completedScreens.add(screen.id);
      updateSidebar(); saveProgress();
      reportToSCORM(correctCount, total, passed);
      resultDiv.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ==========================================================
  // SCORM REPORTING
  // ==========================================================
  function reportToSCORM(score, total, passed) {
    try {
      const api = window.AacromSCORM;
      if (api && api.isInitialized && api.isInitialized()) {
        api.setScore(Math.round((score / total) * 100), 100, 0);
        api.setStatus(passed ? 'passed' : 'failed');
        api.commit();
      }
    } catch (e) { console.warn('SCORM report failed:', e); }
  }

  // ==========================================================
  // NAV
  // ==========================================================
  function bindNav() {
    document.getElementById('btn-prev').addEventListener('click', () => {
      if (currentIndex > 0) { currentIndex--; renderScreen(); }
    });
    document.getElementById('btn-next').addEventListener('click', () => {
      if (currentIndex < allScreens.length - 1) { currentIndex++; renderScreen(); }
      else markCourseComplete();
    });
    document.getElementById('menu-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
    // Dark mode toggle
    const darkBtn = document.getElementById('dark-toggle');
    if (darkBtn) {
      const saved = localStorage.getItem('aacrom-darkmode') === '1';
      if (saved) { document.body.classList.add('dark-mode'); darkBtn.innerHTML = '☀ Claro'; }
      darkBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        darkBtn.innerHTML = isDark ? '☀ Claro' : '☾ Oscuro';
        try { localStorage.setItem('aacrom-darkmode', isDark ? '1' : '0'); } catch (e) {}
      });
    }
  }

  function updateFooterNav() {
    document.getElementById('btn-prev').disabled = (currentIndex === 0);
    const isLast = currentIndex === allScreens.length - 1;
    const btnNext = document.getElementById('btn-next');
    btnNext.textContent = isLast ? 'Finalizar curso ✓' : 'Continuar →';
    
    // En SCORM: bloquear avance si la pantalla actual es interactiva y no se ha completado
    if (!FREE_NAV) {
      const screen = allScreens[currentIndex];
      const interactiveTypes = ['knowledge_check', 'quiz', 'sorting', 'decision_matrix', 'decision_scenario', 'hotspots'];
      const isInteractive = interactiveTypes.includes(screen.type);
      const isCompleted = completedScreens.has(screen.id);
      // Si es interactiva y no la completó, bloquear avance
      if (isInteractive && !isCompleted) {
        btnNext.disabled = true;
        btnNext.title = 'Complete la actividad antes de avanzar';
      } else {
        btnNext.disabled = false;
        btnNext.title = '';
      }
    }
  }

  function markCourseComplete() {
    try {
      const api = window.AacromSCORM;
      if (api && api.isInitialized && api.isInitialized()) {
        const allDone = completedScreens.size === allScreens.length;
        if (allDone) api.setStatus('completed');
        api.commit();
      }
    } catch (e) {}
  }

  // ==========================================================
  // START
  // ==========================================================
  document.addEventListener('DOMContentLoaded', init);
})();
