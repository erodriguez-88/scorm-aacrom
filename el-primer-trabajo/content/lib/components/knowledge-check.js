/**
 * Componente: knowledge-check
 *
 * Pregunta de verificación inline dentro del flujo del curso. A diferencia
 * del quiz-engine (que maneja una lección completa de quiz con secuencia
 * de preguntas y score), este componente es UNA pregunta dentro de una
 * lección normal. No reporta al LMS, solo da feedback inmediato al estudiante.
 *
 * Estructura del data:
 *   {
 *     type: "multiple-choice" | "multiple-response",
 *     question: "<p>HTML del enunciado</p>",
 *     answers: [
 *       { id: "a", text: "Opción A", correct: true|false }
 *     ],
 *     feedback: {
 *       correct: "Texto cuando responde bien",
 *       incorrect: "Texto cuando responde mal"
 *     },
 *     allowRetake: true     // si puede reintentar
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[knowledge-check] AacromRuntime no disponible.');
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

  global.AacromRuntime.register('knowledge-check', {
    render: function (block, container) {
      var data = block.data || {};
      var qType = data.type === 'multiple-response' ? 'multiple-response' : 'multiple-choice';
      var question = typeof data.question === 'string' ? data.question : '';
      var answers = Array.isArray(data.answers) ? data.answers : [];
      var feedback = (data.feedback && typeof data.feedback === 'object') ? data.feedback : {};
      var allowRetake = data.allowRetake !== false;

      if (!question || answers.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Knowledge check sin pregunta o sin respuestas</p>';
        return;
      }

      container.classList.add('aacrom-block-knowledge-check');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-knowledge-check';
      wrapper.setAttribute('data-question-type', qType);

      var state = {
        selected: [],
        answered: false
      };

      // Pregunta
      var qEl = document.createElement('div');
      qEl.className = 'aacrom-knowledge-check__question';
      qEl.innerHTML = sanitizeHtml(question);
      wrapper.appendChild(qEl);

      // Hint según tipo
      var hint = document.createElement('p');
      hint.className = 'aacrom-knowledge-check__hint';
      hint.textContent = qType === 'multiple-response'
        ? 'Seleccione todas las opciones correctas.'
        : 'Seleccione una opción.';
      wrapper.appendChild(hint);

      // Lista de respuestas
      var answersList = document.createElement('div');
      answersList.className = 'aacrom-knowledge-check__answers';
      answersList.setAttribute('role', qType === 'multiple-response' ? 'group' : 'radiogroup');

      var inputName = 'kc-' + (block.id || 'inline') + '-' + Math.random().toString(36).slice(2, 8);

      answers.forEach(function (answer, index) {
        var aId = answer.id || ('ans-' + index);
        var inputId = 'kc-input-' + aId + '-' + Math.random().toString(36).slice(2, 6);

        var label = document.createElement('label');
        label.className = 'aacrom-knowledge-check__answer';
        label.setAttribute('for', inputId);

        var input = document.createElement('input');
        input.type = qType === 'multiple-response' ? 'checkbox' : 'radio';
        input.id = inputId;
        input.name = inputName;
        input.value = aId;
        input.className = 'aacrom-knowledge-check__answer-input';

        var text = document.createElement('span');
        text.className = 'aacrom-knowledge-check__answer-text';
        text.textContent = answer.text || '';

        label.appendChild(input);
        label.appendChild(text);
        answersList.appendChild(label);

        input.addEventListener('change', function () {
          if (state.answered) return;
          if (qType === 'multiple-response') {
            if (input.checked) {
              if (state.selected.indexOf(aId) === -1) state.selected.push(aId);
            } else {
              state.selected = state.selected.filter(function (s) { return s !== aId; });
            }
          } else {
            state.selected = [aId];
          }
          submitBtn.disabled = state.selected.length === 0;
        });
      });

      wrapper.appendChild(answersList);

      // Botón de envío
      var submitBtn = document.createElement('button');
      submitBtn.type = 'button';
      submitBtn.className = 'aacrom-knowledge-check__submit';
      submitBtn.textContent = 'Comprobar respuesta';
      submitBtn.disabled = true;
      wrapper.appendChild(submitBtn);

      // Área de feedback
      var feedbackEl = document.createElement('div');
      feedbackEl.className = 'aacrom-knowledge-check__feedback';
      feedbackEl.setAttribute('role', 'status');
      feedbackEl.setAttribute('aria-live', 'polite');
      feedbackEl.hidden = true;
      wrapper.appendChild(feedbackEl);

      // Botón de reintentar (oculto inicialmente)
      var retakeBtn = document.createElement('button');
      retakeBtn.type = 'button';
      retakeBtn.className = 'aacrom-knowledge-check__retake';
      retakeBtn.textContent = 'Intentar de nuevo';
      retakeBtn.hidden = true;
      wrapper.appendChild(retakeBtn);

      submitBtn.addEventListener('click', function () {
        evaluate();
      });

      retakeBtn.addEventListener('click', function () {
        reset();
      });

      function evaluate() {
        if (state.answered) return;
        state.answered = true;

        // Determinar si es correcto
        var correctIds = answers.filter(function (a) { return a.correct; })
                                .map(function (a) { return a.id; });
        var isCorrect = false;

        if (qType === 'multiple-choice') {
          isCorrect = state.selected.length === 1 &&
                      correctIds.indexOf(state.selected[0]) !== -1;
        } else {
          // multiple-response: deben ser exactamente las correctas
          isCorrect = state.selected.length === correctIds.length &&
                      state.selected.every(function (s) { return correctIds.indexOf(s) !== -1; });
        }

        // Mostrar feedback en cada respuesta
        var labels = answersList.querySelectorAll('.aacrom-knowledge-check__answer');
        labels.forEach(function (l, idx) {
          var ans = answers[idx];
          l.classList.add('aacrom-knowledge-check__answer--disabled');
          var input = l.querySelector('input');
          input.disabled = true;
          var isUserSelected = state.selected.indexOf(ans.id) !== -1;
          var isAnswerCorrect = ans.correct === true;

          if (isAnswerCorrect && isUserSelected) {
            l.classList.add('aacrom-knowledge-check__answer--correct');
          } else if (!isAnswerCorrect && isUserSelected) {
            l.classList.add('aacrom-knowledge-check__answer--wrong');
          } else if (isAnswerCorrect) {
            l.classList.add('aacrom-knowledge-check__answer--missed');
          }
        });

        // Mostrar feedback general
        feedbackEl.hidden = false;
        feedbackEl.classList.remove('aacrom-knowledge-check__feedback--correct',
                                    'aacrom-knowledge-check__feedback--incorrect');
        feedbackEl.classList.add(isCorrect
          ? 'aacrom-knowledge-check__feedback--correct'
          : 'aacrom-knowledge-check__feedback--incorrect');

        var feedbackText = isCorrect
          ? (feedback.correct || '¡Correcto!')
          : (feedback.incorrect || 'Respuesta incorrecta. Revise el contenido.');

        feedbackEl.innerHTML = '';
        var fbHeading = document.createElement('strong');
        fbHeading.textContent = isCorrect ? '✓ Correcto' : '✗ Incorrecto';
        feedbackEl.appendChild(fbHeading);
        var fbBody = document.createElement('p');
        fbBody.textContent = feedbackText;
        feedbackEl.appendChild(fbBody);

        submitBtn.hidden = true;
        if (allowRetake && !isCorrect) {
          retakeBtn.hidden = false;
        }
      }

      function reset() {
        state.selected = [];
        state.answered = false;
        feedbackEl.hidden = true;
        retakeBtn.hidden = true;
        submitBtn.hidden = false;
        submitBtn.disabled = true;
        var labels = answersList.querySelectorAll('.aacrom-knowledge-check__answer');
        labels.forEach(function (l) {
          l.classList.remove(
            'aacrom-knowledge-check__answer--disabled',
            'aacrom-knowledge-check__answer--correct',
            'aacrom-knowledge-check__answer--wrong',
            'aacrom-knowledge-check__answer--missed'
          );
          var input = l.querySelector('input');
          input.disabled = false;
          input.checked = false;
        });
      }

      container.appendChild(wrapper);
    }
  });

})(window);
