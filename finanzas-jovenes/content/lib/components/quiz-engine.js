/**
 * Aacrom Quiz Engine
 *
 * Motor de evaluación que renderiza lecciones de tipo "quiz":
 *  - Maneja una secuencia de preguntas (multiple-choice, multiple-response).
 *  - Lleva el estado de respuestas del estudiante.
 *  - Calcula score al final.
 *  - Reporta score y completitud al LMS via AacromSCORM.
 *
 * Estructura de la lección quiz:
 *   {
 *     id: "lesson-final",
 *     type: "quiz",
 *     title: "Evaluación final",
 *     config: {
 *       passingScore: 80,           // 0-100, default 80
 *       showFeedback: true,         // mostrar feedback inmediato
 *       allowRetake: true,          // permitir reintento al fallar
 *       shuffleQuestions: false     // mezclar preguntas
 *     },
 *     questions: [
 *       {
 *         id: "q-001",
 *         type: "multiple-choice" | "multiple-response",
 *         question: "<p>HTML del enunciado</p>",
 *         answers: [
 *           { id: "a", text: "Opción A", correct: true|false }
 *         ],
 *         feedback: {
 *           correct: "Texto cuando responde bien",
 *           incorrect: "Texto cuando responde mal"
 *         }
 *       }
 *     ]
 *   }
 *
 * El motor se registra en el runtime con un type especial 'lesson:quiz'
 * para que el runtime lo invoque al detectar lección quiz.
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[quiz-engine] AacromRuntime no disponible.');
    return;
  }

  // Estado del quiz actual (uno solo activo a la vez)
  var quizState = null;

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeHtml(html) {
    // Sanitizado mínimo: permite formato básico, bloquea scripts y handlers
    var div = document.createElement('div');
    div.innerHTML = html || '';
    var scripts = div.querySelectorAll('script');
    scripts.forEach(function (s) { s.remove(); });
    var withHandlers = div.querySelectorAll('*');
    withHandlers.forEach(function (el) {
      var attrs = Array.prototype.slice.call(el.attributes);
      attrs.forEach(function (a) {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
        if (a.name === 'href' && /^\s*(javascript|data):/i.test(a.value)) {
          el.removeAttribute(a.name);
        }
      });
    });
    return div.innerHTML;
  }

  // -----------------------------------------------------------------
  // Inicio del quiz
  // -----------------------------------------------------------------

  function startQuiz(lesson, container) {
    var config = lesson.config || {};
    var questions = (lesson.questions || []).slice();

    if (questions.length === 0) {
      container.innerHTML = '<p class="aacrom-quiz__error">' +
        'Esta evaluación no tiene preguntas configuradas.</p>';
      return;
    }

    if (config.shuffleQuestions) {
      shuffle(questions);
    }

    quizState = {
      lessonId: lesson.id,
      questions: questions,
      currentIndex: 0,
      answers: {},        // { questionId: [answerIds] }
      results: {},        // { questionId: 'correct' | 'incorrect' }
      finished: false,
      passingScore: typeof config.passingScore === 'number' ? config.passingScore : 80,
      showFeedback: config.showFeedback !== false,
      allowRetake: config.allowRetake !== false
    };

    container.innerHTML = '';
    container.classList.add('aacrom-quiz');

    renderCurrentQuestion(container);
  }

  // -----------------------------------------------------------------
  // Renderizado de pregunta actual
  // -----------------------------------------------------------------

  function renderCurrentQuestion(container) {
    container.innerHTML = '';

    var q = quizState.questions[quizState.currentIndex];
    if (!q) {
      renderResults(container);
      return;
    }

    // Header del quiz: progreso "Pregunta X de N"
    var header = document.createElement('div');
    header.className = 'aacrom-quiz__header';
    header.innerHTML =
      '<div class="aacrom-quiz__progress">' +
        '<span class="aacrom-quiz__progress-current">' + (quizState.currentIndex + 1) + '</span>' +
        ' <span class="aacrom-quiz__progress-separator">de</span> ' +
        '<span class="aacrom-quiz__progress-total">' + quizState.questions.length + '</span>' +
      '</div>';
    container.appendChild(header);

    // Card de la pregunta
    var card = document.createElement('div');
    card.className = 'aacrom-quiz__card aacrom-quiz__card--' + (q.type || 'multiple-choice');
    card.setAttribute('data-question-id', q.id);

    // Enunciado
    var qBody = document.createElement('div');
    qBody.className = 'aacrom-quiz__question';
    qBody.innerHTML = safeHtml(q.question || '');
    card.appendChild(qBody);

    // Instrucción según tipo
    var hint = document.createElement('div');
    hint.className = 'aacrom-quiz__hint';
    hint.textContent = q.type === 'multiple-response'
      ? 'Seleccione todas las respuestas correctas.'
      : 'Seleccione la respuesta correcta.';
    card.appendChild(hint);

    // Lista de respuestas
    var answersList = document.createElement('div');
    answersList.className = 'aacrom-quiz__answers';

    var inputType = q.type === 'multiple-response' ? 'checkbox' : 'radio';
    var groupName = 'aacrom-q-' + q.id;

    (q.answers || []).forEach(function (ans, idx) {
      var label = document.createElement('label');
      label.className = 'aacrom-quiz__answer';
      label.setAttribute('data-answer-id', ans.id);

      var input = document.createElement('input');
      input.type = inputType;
      input.name = groupName;
      input.value = ans.id;
      input.className = 'aacrom-quiz__answer-input';

      var content = document.createElement('span');
      content.className = 'aacrom-quiz__answer-content';
      content.innerHTML = safeHtml(ans.text || '');

      label.appendChild(input);
      label.appendChild(content);
      answersList.appendChild(label);
    });

    card.appendChild(answersList);

    // Área de feedback (oculta hasta validar)
    var feedback = document.createElement('div');
    feedback.className = 'aacrom-quiz__feedback aacrom-quiz__feedback--hidden';
    card.appendChild(feedback);

    // Botón de validar
    var actions = document.createElement('div');
    actions.className = 'aacrom-quiz__actions';

    var submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'aacrom-btn aacrom-btn--primary aacrom-quiz__submit';
    submitBtn.textContent = 'Validar respuesta';
    submitBtn.disabled = true;

    actions.appendChild(submitBtn);
    card.appendChild(actions);

    container.appendChild(card);

    // Comportamiento: habilitar Validar cuando haya selección
    var inputs = card.querySelectorAll('.aacrom-quiz__answer-input');
    inputs.forEach(function (inp) {
      inp.addEventListener('change', function () {
        submitBtn.disabled = !hasSelection(card);
      });
    });

    // Click en validar
    submitBtn.addEventListener('click', function () {
      validateAnswer(card, q, container);
    });
  }

  function hasSelection(card) {
    var checked = card.querySelectorAll('.aacrom-quiz__answer-input:checked');
    return checked.length > 0;
  }

  function getSelectedAnswerIds(card) {
    var checked = card.querySelectorAll('.aacrom-quiz__answer-input:checked');
    return Array.prototype.map.call(checked, function (i) { return i.value; });
  }

  // -----------------------------------------------------------------
  // Validación
  // -----------------------------------------------------------------

  function validateAnswer(card, question, container) {
    var selectedIds = getSelectedAnswerIds(card);
    quizState.answers[question.id] = selectedIds;

    // Determinar si es correcta
    var correctIds = (question.answers || [])
      .filter(function (a) { return a.correct; })
      .map(function (a) { return a.id; });

    var isCorrect = arraysEqualUnordered(selectedIds, correctIds);
    quizState.results[question.id] = isCorrect ? 'correct' : 'incorrect';

    // Marcar visualmente las respuestas
    var answerEls = card.querySelectorAll('.aacrom-quiz__answer');
    answerEls.forEach(function (el) {
      var aid = el.getAttribute('data-answer-id');
      var input = el.querySelector('.aacrom-quiz__answer-input');
      var isCorrectAnswer = correctIds.indexOf(aid) !== -1;
      var wasSelected = selectedIds.indexOf(aid) !== -1;

      el.classList.add('aacrom-quiz__answer--reviewed');
      if (isCorrectAnswer) {
        el.classList.add('aacrom-quiz__answer--correct');
      }
      if (wasSelected && !isCorrectAnswer) {
        el.classList.add('aacrom-quiz__answer--wrong');
      }
      if (wasSelected && isCorrectAnswer) {
        el.classList.add('aacrom-quiz__answer--selected-correct');
      }

      // Deshabilitar inputs después de validar
      input.disabled = true;
    });

    // Mostrar feedback si está habilitado
    if (quizState.showFeedback) {
      var fb = card.querySelector('.aacrom-quiz__feedback');
      var fbText = isCorrect
        ? (question.feedback && question.feedback.correct) || '¡Correcto!'
        : (question.feedback && question.feedback.incorrect) || 'Respuesta incorrecta. Revise las opciones marcadas.';
      var fbClass = isCorrect
        ? 'aacrom-quiz__feedback--correct'
        : 'aacrom-quiz__feedback--incorrect';

      fb.classList.remove('aacrom-quiz__feedback--hidden');
      fb.classList.add(fbClass);
      fb.innerHTML =
        '<div class="aacrom-quiz__feedback-icon" aria-hidden="true">' +
          (isCorrect ? '✓' : '✗') +
        '</div>' +
        '<div class="aacrom-quiz__feedback-text">' + safeHtml(fbText) + '</div>';
    }

    // Cambiar el botón Validar por Continuar/Finalizar
    var actions = card.querySelector('.aacrom-quiz__actions');
    actions.innerHTML = '';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'aacrom-btn aacrom-btn--primary';

    var isLastQuestion = quizState.currentIndex === quizState.questions.length - 1;
    nextBtn.textContent = isLastQuestion ? 'Ver resultados' : 'Siguiente pregunta';

    nextBtn.addEventListener('click', function () {
      if (isLastQuestion) {
        renderResults(container);
      } else {
        quizState.currentIndex++;
        renderCurrentQuestion(container);
      }
    });

    actions.appendChild(nextBtn);
  }

  // -----------------------------------------------------------------
  // Resultados finales
  // -----------------------------------------------------------------

  function renderResults(container) {
    container.innerHTML = '';
    quizState.finished = true;

    var total = quizState.questions.length;
    var correct = 0;
    Object.keys(quizState.results).forEach(function (qid) {
      if (quizState.results[qid] === 'correct') correct++;
    });
    var score = Math.round((correct / total) * 100);
    var passed = score >= quizState.passingScore;

    // Reportar al LMS
    if (global.AacromSCORM && typeof global.AacromSCORM.setScore === 'function') {
      global.AacromSCORM.setScore(score, 0, 100);
      global.AacromSCORM.setPassed(passed);
    }

    var resultsCard = document.createElement('div');
    resultsCard.className = 'aacrom-quiz__results aacrom-quiz__results--' +
      (passed ? 'passed' : 'failed');

    var icon = document.createElement('div');
    icon.className = 'aacrom-quiz__results-icon';
    icon.textContent = passed ? '✓' : '✗';
    icon.setAttribute('aria-hidden', 'true');
    resultsCard.appendChild(icon);

    var title = document.createElement('h2');
    title.className = 'aacrom-quiz__results-title';
    title.textContent = passed ? '¡Evaluación aprobada!' : 'Evaluación no aprobada';
    resultsCard.appendChild(title);

    var scoreEl = document.createElement('div');
    scoreEl.className = 'aacrom-quiz__results-score';
    scoreEl.innerHTML =
      '<span class="aacrom-quiz__results-score-value">' + score + '%</span>' +
      '<span class="aacrom-quiz__results-score-detail">' +
        correct + ' de ' + total + ' respuestas correctas' +
      '</span>';
    resultsCard.appendChild(scoreEl);

    var info = document.createElement('div');
    info.className = 'aacrom-quiz__results-info';
    info.textContent = passed
      ? 'Score requerido para aprobar: ' + quizState.passingScore + '%. Puede continuar al siguiente módulo.'
      : 'Score requerido para aprobar: ' + quizState.passingScore + '%.';
    resultsCard.appendChild(info);

    // Botones de acción
    var actions = document.createElement('div');
    actions.className = 'aacrom-quiz__results-actions';

    if (!passed && quizState.allowRetake) {
      var retakeBtn = document.createElement('button');
      retakeBtn.type = 'button';
      retakeBtn.className = 'aacrom-btn aacrom-btn--primary';
      retakeBtn.textContent = 'Volver a intentar';
      retakeBtn.addEventListener('click', function () {
        // Reiniciar el quiz desde la primera pregunta
        var lesson = global.AacromRuntime.getState().course.lessons.find(function (l) {
          return l.id === quizState.lessonId;
        });
        if (lesson) startQuiz(lesson, container);
      });
      actions.appendChild(retakeBtn);
    }

    resultsCard.appendChild(actions);
    container.appendChild(resultsCard);
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------

  function arraysEqualUnordered(a, b) {
    if (a.length !== b.length) return false;
    var sortedA = a.slice().sort();
    var sortedB = b.slice().sort();
    for (var i = 0; i < sortedA.length; i++) {
      if (sortedA[i] !== sortedB[i]) return false;
    }
    return true;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
  }

  // -----------------------------------------------------------------
  // Exponer al runtime
  // -----------------------------------------------------------------
  // El runtime tiene una función renderQuizPlaceholder() para lecciones tipo quiz.
  // Sobreescribimos esa función para que use nuestro motor.

  global.AacromQuizEngine = {
    start: startQuiz,
    getState: function () { return quizState; }
  };

})(window);
