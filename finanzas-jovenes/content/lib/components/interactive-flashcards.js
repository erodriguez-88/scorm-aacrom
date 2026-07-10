/**
 * Componente: interactive-flashcards
 *
 * Variant 'stack' (la que aparece en datos reales del SCORM LGCP):
 * Mazo de tarjetas. Cada tarjeta tiene front (imagen + texto opcional)
 * y back (texto + audio opcional). El estudiante voltea la tarjeta para
 * ver el reverso, y navega al siguiente con un botón.
 *
 * Estructura del data:
 *   {
 *     variant: "stack",
 *     items: [
 *       {
 *         id: "card-1",
 *         front: {
 *           type: "fullimage",                  // o "text"
 *           image: { src, alt },
 *           text: "<p>HTML opcional</p>"
 *         },
 *         back: {
 *           text: "<p>HTML del reverso</p>",
 *           audio: { src, caption }             // opcional
 *         }
 *       }
 *     ]
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[interactive-flashcards] AacromRuntime no disponible.');
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

  global.AacromRuntime.register('interactive-flashcards', {
    render: function (block, container) {
      var data = block.data || {};
      var items = Array.isArray(data.items) ? data.items : [];

      if (items.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Flashcards sin items declarados</p>';
        return;
      }

      container.classList.add('aacrom-block-flashcards');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-flashcards aacrom-flashcards--stack';

      var state = {
        current: 0,
        flipped: {}
      };

      // Contador (1 / N)
      var counter = document.createElement('div');
      counter.className = 'aacrom-flashcards__counter';
      counter.setAttribute('aria-live', 'polite');

      // Container de la tarjeta actual
      var cardArea = document.createElement('div');
      cardArea.className = 'aacrom-flashcards__card-area';

      // Botones de navegación
      var nav = document.createElement('div');
      nav.className = 'aacrom-flashcards__nav';

      var prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'aacrom-flashcards__nav-btn aacrom-flashcards__nav-btn--prev';
      prevBtn.textContent = '← Anterior';
      prevBtn.setAttribute('aria-label', 'Tarjeta anterior');

      var nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'aacrom-flashcards__nav-btn aacrom-flashcards__nav-btn--next';
      nextBtn.textContent = 'Siguiente →';
      nextBtn.setAttribute('aria-label', 'Tarjeta siguiente');

      nav.appendChild(prevBtn);
      nav.appendChild(nextBtn);

      function renderCard(idx) {
        cardArea.innerHTML = '';
        var item = items[idx];
        if (!item) return;

        var card = document.createElement('div');
        card.className = 'aacrom-flashcards__card';
        var isFlipped = state.flipped[idx] === true;
        if (isFlipped) card.classList.add('aacrom-flashcards__card--flipped');

        // Frontal
        var front = document.createElement('div');
        front.className = 'aacrom-flashcards__face aacrom-flashcards__face--front';
        var frontData = item.front || {};

        if (frontData.type === 'fullimage' && frontData.image && frontData.image.src) {
          var img = document.createElement('img');
          img.className = 'aacrom-flashcards__face-image';
          img.src = frontData.image.src;
          img.alt = frontData.image.alt || '';
          img.setAttribute('loading', 'lazy');
          front.appendChild(img);
        }

        if (frontData.text) {
          var frontText = document.createElement('div');
          frontText.className = 'aacrom-flashcards__face-text';
          frontText.innerHTML = sanitizeHtml(frontData.text);
          front.appendChild(frontText);
        }

        var frontHint = document.createElement('div');
        frontHint.className = 'aacrom-flashcards__hint';
        frontHint.textContent = 'Click para voltear';
        front.appendChild(frontHint);

        // Reverso
        var back = document.createElement('div');
        back.className = 'aacrom-flashcards__face aacrom-flashcards__face--back';
        var backData = item.back || {};

        if (backData.text) {
          var backText = document.createElement('div');
          backText.className = 'aacrom-flashcards__face-text';
          backText.innerHTML = sanitizeHtml(backData.text);
          back.appendChild(backText);
        }

        if (backData.audio && backData.audio.src) {
          var audioWrap = document.createElement('div');
          audioWrap.className = 'aacrom-flashcards__audio';
          var audioEl = document.createElement('audio');
          audioEl.controls = true;
          audioEl.preload = 'metadata';
          audioEl.src = backData.audio.src;
          audioWrap.appendChild(audioEl);
          if (backData.audio.caption) {
            var audioCap = document.createElement('div');
            audioCap.className = 'aacrom-flashcards__audio-caption';
            audioCap.textContent = backData.audio.caption;
            audioWrap.appendChild(audioCap);
          }
          back.appendChild(audioWrap);
        }

        card.appendChild(front);
        card.appendChild(back);

        // Click para voltear
        card.addEventListener('click', function (e) {
          // Si el click es sobre el control de audio, no voltear
          if (e.target.tagName === 'AUDIO' || e.target.closest('audio')) return;
          state.flipped[idx] = !isFlipped;
          renderCard(idx);
        });

        // Permitir teclado
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-pressed', isFlipped ? 'true' : 'false');
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            state.flipped[idx] = !isFlipped;
            renderCard(idx);
          }
        });

        cardArea.appendChild(card);

        // Actualizar contador y botones
        counter.textContent = (idx + 1) + ' / ' + items.length;
        prevBtn.disabled = idx === 0;
        nextBtn.disabled = idx === items.length - 1;
      }

      prevBtn.addEventListener('click', function () {
        if (state.current > 0) {
          state.current--;
          renderCard(state.current);
        }
      });

      nextBtn.addEventListener('click', function () {
        if (state.current < items.length - 1) {
          state.current++;
          renderCard(state.current);
        }
      });

      wrapper.appendChild(counter);
      wrapper.appendChild(cardArea);
      wrapper.appendChild(nav);
      container.appendChild(wrapper);

      renderCard(0);
    }
  });

})(window);
