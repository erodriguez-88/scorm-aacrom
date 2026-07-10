/**
 * Componente: interactive-scenario (multi-step, modelo Rise)
 *
 * Escenario didáctico con personaje fijo y SECUENCIA de pasos.
 * Cada paso puede ser:
 *   - dialog: pregunta + opciones de respuesta. Cada opción tiene
 *     feedback y nextStepId que indica adónde ir.
 *   - info: solo texto/contexto narrativo con botón "Continuar".
 *   - end: cierre del escenario.
 *
 * Soporta tanto escenarios LINEALES (todas las opciones llevan al
 * mismo nextStepId) como RAMIFICADOS (opciones llevan a steps distintos).
 *
 * COMPATIBILIDAD: si el data tiene la forma vieja (sin steps), se
 * convierte automáticamente.
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[interactive-scenario] AacromRuntime no disponible.');
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

  /**
   * Si el data tiene formato legacy (situation+question+options sin steps),
   * lo convierte al formato multi-step (1 dialog + 1 end).
   */
  function normalizeData(data) {
    if (Array.isArray(data.steps) && data.steps.length > 0) {
      return data;
    }
    return {
      character: data.character,
      background: data.background,
      startStepId: 'legacy-step',
      steps: [{
        id: 'legacy-step',
        type: 'dialog',
        situation: data.situation,
        question: data.question,
        options: (data.options || []).map(function (o) {
          return {
            text: o.text,
            quality: o.quality,
            feedback: o.feedback,
            nextStepId: 'legacy-end'
          };
        })
      }, {
        id: 'legacy-end',
        type: 'end',
        content: ''
      }]
    };
  }

  global.AacromRuntime.register('interactive-scenario', {
    render: function (block, container) {
      var data = normalizeData(block.data || {});
      var character = (data.character && typeof data.character === 'object') ? data.character : {};
      var steps = Array.isArray(data.steps) ? data.steps : [];
      var startStepId = data.startStepId || (steps[0] && steps[0].id);

      if (steps.length === 0 || !startStepId) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Escenario sin pasos declarados</p>';
        return;
      }

      var stepsById = {};
      steps.forEach(function (s) { if (s.id) stepsById[s.id] = s; });

      if (!stepsById[startStepId]) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'startStepId "' + startStepId + '" no existe</p>';
        return;
      }

      container.classList.add('aacrom-block-scenario');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-scenario';

      // Header con personaje (persiste en todos los pasos)
      if (character.name || character.avatar) {
        var header = document.createElement('div');
        header.className = 'aacrom-scenario__character';

        if (character.avatar && character.avatar.src) {
          var img = document.createElement('img');
          img.className = 'aacrom-scenario__avatar';
          img.src = character.avatar.src;
          img.alt = character.avatar.alt || '';
          img.setAttribute('loading', 'lazy');
          header.appendChild(img);
        } else {
          var initialsDiv = document.createElement('div');
          initialsDiv.className = 'aacrom-scenario__avatar-initials';
          initialsDiv.setAttribute('aria-hidden', 'true');
          var initials = (character.name || '?')
            .split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
          initialsDiv.textContent = initials;
          header.appendChild(initialsDiv);
        }

        var info = document.createElement('div');
        info.className = 'aacrom-scenario__character-info';
        if (character.name) {
          var nameEl = document.createElement('div');
          nameEl.className = 'aacrom-scenario__character-name';
          nameEl.textContent = character.name;
          info.appendChild(nameEl);
        }
        if (character.role) {
          var roleEl = document.createElement('div');
          roleEl.className = 'aacrom-scenario__character-role';
          roleEl.textContent = character.role;
          info.appendChild(roleEl);
        }
        header.appendChild(info);
        wrapper.appendChild(header);
      }

      // Indicador de progreso
      var visitedSteps = [];
      var progressEl = document.createElement('div');
      progressEl.className = 'aacrom-scenario__progress';
      progressEl.setAttribute('aria-live', 'polite');
      wrapper.appendChild(progressEl);

      // Área del paso actual
      var stepArea = document.createElement('div');
      stepArea.className = 'aacrom-scenario__step-area';
      wrapper.appendChild(stepArea);

      // Botón reiniciar
      var restartBtn = document.createElement('button');
      restartBtn.type = 'button';
      restartBtn.className = 'aacrom-scenario__restart';
      restartBtn.textContent = '↻ Reiniciar escenario';
      restartBtn.hidden = true;
      wrapper.appendChild(restartBtn);

      restartBtn.addEventListener('click', function () {
        visitedSteps = [];
        restartBtn.hidden = true;
        goToStep(startStepId);
      });

      function updateProgress() {
        progressEl.textContent = 'Paso ' + visitedSteps.length;
      }

      function goToStep(stepId) {
        var step = stepsById[stepId];
        if (!step) {
          stepArea.innerHTML = '<p class="aacrom-block__error">' +
            'Paso "' + stepId + '" no encontrado</p>';
          return;
        }

        if (visitedSteps.indexOf(stepId) === -1) {
          visitedSteps.push(stepId);
        }
        updateProgress();

        stepArea.innerHTML = '';

        if (step.type === 'dialog') {
          renderDialog(step);
        } else if (step.type === 'info') {
          renderInfo(step);
        } else if (step.type === 'end') {
          renderEnd(step);
        } else {
          stepArea.innerHTML = '<p class="aacrom-block__error">' +
            'Tipo desconocido: ' + step.type + '</p>';
        }
      }

      function renderDialog(step) {
        if (step.situation) {
          var sit = document.createElement('div');
          sit.className = 'aacrom-scenario__situation';
          sit.innerHTML = sanitizeHtml(step.situation);
          stepArea.appendChild(sit);
        }

        if (step.question) {
          var q = document.createElement('p');
          q.className = 'aacrom-scenario__question';
          q.textContent = step.question;
          stepArea.appendChild(q);
        }

        var options = Array.isArray(step.options) ? step.options : [];
        if (options.length === 0) {
          var err = document.createElement('p');
          err.className = 'aacrom-block__error';
          err.textContent = 'Diálogo sin opciones';
          stepArea.appendChild(err);
          return;
        }

        var optsList = document.createElement('div');
        optsList.className = 'aacrom-scenario__options';

        var feedbackEl = document.createElement('div');
        feedbackEl.className = 'aacrom-scenario__feedback';
        feedbackEl.setAttribute('role', 'status');
        feedbackEl.setAttribute('aria-live', 'polite');
        feedbackEl.hidden = true;

        var continueBtn = document.createElement('button');
        continueBtn.type = 'button';
        continueBtn.className = 'aacrom-scenario__continue';
        continueBtn.textContent = 'Continuar →';
        continueBtn.hidden = true;

        var retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'aacrom-scenario__retry';
        retryBtn.textContent = 'Probar otra opción';
        retryBtn.hidden = true;

        var selectedNextStepId = null;

        options.forEach(function (opt) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'aacrom-scenario__option';
          btn.setAttribute('data-quality', opt.quality || 'regular');
          btn.textContent = opt.text || '';

          btn.addEventListener('click', function () {
            var allBtns = optsList.querySelectorAll('.aacrom-scenario__option');
            allBtns.forEach(function (b) {
              b.disabled = true;
              b.classList.add('aacrom-scenario__option--inactive');
            });
            btn.classList.remove('aacrom-scenario__option--inactive');
            btn.classList.add('aacrom-scenario__option--selected');

            var quality = opt.quality || 'regular';
            btn.classList.add('aacrom-scenario__option--' + quality);

            feedbackEl.hidden = false;
            feedbackEl.className = 'aacrom-scenario__feedback aacrom-scenario__feedback--' + quality;

            var label = document.createElement('strong');
            label.className = 'aacrom-scenario__feedback-label';
            label.textContent = quality === 'good' ? '✓ Buena decisión'
              : (quality === 'bad' ? '✗ No fue la mejor opción' : '~ Decisión aceptable');

            var content = document.createElement('div');
            content.className = 'aacrom-scenario__feedback-content';
            content.innerHTML = sanitizeHtml(opt.feedback || '');

            feedbackEl.innerHTML = '';
            feedbackEl.appendChild(label);
            feedbackEl.appendChild(content);

            selectedNextStepId = opt.nextStepId;

            if (selectedNextStepId && stepsById[selectedNextStepId]) {
              continueBtn.hidden = false;
            } else {
              retryBtn.hidden = false;
            }
          });

          optsList.appendChild(btn);
        });

        continueBtn.addEventListener('click', function () {
          if (selectedNextStepId) goToStep(selectedNextStepId);
        });

        retryBtn.addEventListener('click', function () {
          var idx = visitedSteps.lastIndexOf(step.id);
          if (idx !== -1) visitedSteps.splice(idx, 1);
          goToStep(step.id);
        });

        stepArea.appendChild(optsList);
        stepArea.appendChild(feedbackEl);
        stepArea.appendChild(continueBtn);
        stepArea.appendChild(retryBtn);
      }

      function renderInfo(step) {
        var info = document.createElement('div');
        info.className = 'aacrom-scenario__info-content';
        info.innerHTML = sanitizeHtml(step.content || '');
        stepArea.appendChild(info);

        var continueBtn = document.createElement('button');
        continueBtn.type = 'button';
        continueBtn.className = 'aacrom-scenario__continue';
        continueBtn.textContent = 'Continuar →';
        continueBtn.addEventListener('click', function () {
          if (step.nextStepId && stepsById[step.nextStepId]) {
            goToStep(step.nextStepId);
          }
        });
        stepArea.appendChild(continueBtn);
      }

      function renderEnd(step) {
        var endEl = document.createElement('div');
        endEl.className = 'aacrom-scenario__end';

        var marker = document.createElement('div');
        marker.className = 'aacrom-scenario__end-marker';
        marker.textContent = '✓ Escenario completado';
        endEl.appendChild(marker);

        if (step.content) {
          var content = document.createElement('div');
          content.className = 'aacrom-scenario__end-content';
          content.innerHTML = sanitizeHtml(step.content);
          endEl.appendChild(content);
        }

        stepArea.appendChild(endEl);
        restartBtn.hidden = false;
      }

      container.appendChild(wrapper);

      goToStep(startStepId);
    }
  });

})(window);
