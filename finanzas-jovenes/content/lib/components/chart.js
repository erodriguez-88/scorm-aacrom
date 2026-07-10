/**
 * Componente: chart
 *
 * Gráfico básico (barras horizontales, barras verticales, o pie).
 * Implementado en SVG puro sin librerías externas para mantener
 * la plantilla autocontenida y ligera.
 *
 * Estructura del data:
 *   {
 *     chartType: "bar-h" | "bar-v" | "pie",   // default bar-h
 *     title: "Título del gráfico (opcional)",
 *     description: "Descripción accesible (resumen de los datos)",
 *     showValues: true,                        // mostrar números en barras
 *     data: [
 *       { label: "Categoría A", value: 42, color: "#1F3864" },
 *       { label: "Categoría B", value: 28 }
 *     ]
 *   }
 */

(function (global) {
  'use strict';

  if (!global.AacromRuntime) {
    console.warn('[chart] AacromRuntime no disponible.');
    return;
  }

  // Paleta default (genera colores si no se especifican)
  var DEFAULT_PALETTE = [
    '#1F3864', '#2E5496', '#5B9BD5', '#A6CEE3',
    '#3E8E41', '#82BC4F', '#FFC000', '#ED7D31',
    '#C00000', '#7030A0'
  ];

  function safeNum(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  global.AacromRuntime.register('chart', {
    render: function (block, container) {
      var data = block.data || {};
      var chartType = ['bar-h', 'bar-v', 'pie'].indexOf(data.chartType) !== -1
        ? data.chartType
        : 'bar-h';
      var rows = Array.isArray(data.data) ? data.data : [];
      var title = typeof data.title === 'string' ? data.title : '';
      var description = typeof data.description === 'string' ? data.description : '';
      var showValues = data.showValues !== false;

      if (rows.length === 0) {
        container.classList.add('aacrom-block--error');
        container.innerHTML = '<p class="aacrom-block__error">' +
          'Gráfico sin datos</p>';
        return;
      }

      container.classList.add('aacrom-block-chart');

      var wrapper = document.createElement('div');
      wrapper.className = 'aacrom-chart aacrom-chart--' + chartType;
      wrapper.setAttribute('role', 'img');
      var ariaLabel = title || 'Gráfico';
      if (description) ariaLabel += '. ' + description;
      wrapper.setAttribute('aria-label', ariaLabel);

      // Título
      if (title) {
        var titleEl = document.createElement('div');
        titleEl.className = 'aacrom-chart__title';
        titleEl.textContent = title;
        wrapper.appendChild(titleEl);
      }

      // Render según tipo
      if (chartType === 'pie') {
        renderPie(wrapper, rows, showValues);
      } else if (chartType === 'bar-v') {
        renderBarV(wrapper, rows, showValues);
      } else {
        renderBarH(wrapper, rows, showValues);
      }

      // Tabla de datos (oculta visualmente, accesible para screen readers)
      var srTable = document.createElement('table');
      srTable.className = 'aacrom-chart__sr-table';
      var thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Categoría</th><th>Valor</th></tr>';
      srTable.appendChild(thead);
      var tbody = document.createElement('tbody');
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (r.label || '') + '</td>' +
                       '<td>' + safeNum(r.value) + '</td>';
        tbody.appendChild(tr);
      });
      srTable.appendChild(tbody);
      wrapper.appendChild(srTable);

      container.appendChild(wrapper);
    }
  });

  // ---- Bar horizontal ----
  function renderBarH(wrapper, rows, showValues) {
    var maxVal = Math.max.apply(null, rows.map(function (r) { return safeNum(r.value); }));
    if (maxVal === 0) maxVal = 1;

    var list = document.createElement('div');
    list.className = 'aacrom-chart__bars-h';
    list.setAttribute('aria-hidden', 'true');

    rows.forEach(function (r, i) {
      var val = safeNum(r.value);
      var pct = (val / maxVal) * 100;
      var color = r.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];

      var row = document.createElement('div');
      row.className = 'aacrom-chart__bar-h-row';

      var label = document.createElement('div');
      label.className = 'aacrom-chart__bar-h-label';
      label.textContent = r.label || '';
      row.appendChild(label);

      var track = document.createElement('div');
      track.className = 'aacrom-chart__bar-h-track';

      var bar = document.createElement('div');
      bar.className = 'aacrom-chart__bar-h-fill';
      bar.style.width = pct.toFixed(2) + '%';
      bar.style.background = color;
      track.appendChild(bar);

      row.appendChild(track);

      if (showValues) {
        var valEl = document.createElement('div');
        valEl.className = 'aacrom-chart__bar-h-value';
        valEl.textContent = val;
        row.appendChild(valEl);
      }

      list.appendChild(row);
    });

    wrapper.appendChild(list);
  }

  // ---- Bar vertical ----
  function renderBarV(wrapper, rows, showValues) {
    var maxVal = Math.max.apply(null, rows.map(function (r) { return safeNum(r.value); }));
    if (maxVal === 0) maxVal = 1;

    var area = document.createElement('div');
    area.className = 'aacrom-chart__bars-v';
    area.setAttribute('aria-hidden', 'true');

    rows.forEach(function (r, i) {
      var val = safeNum(r.value);
      var pct = (val / maxVal) * 100;
      var color = r.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];

      var col = document.createElement('div');
      col.className = 'aacrom-chart__bar-v-col';

      if (showValues) {
        var valEl = document.createElement('div');
        valEl.className = 'aacrom-chart__bar-v-value';
        valEl.textContent = val;
        col.appendChild(valEl);
      }

      var track = document.createElement('div');
      track.className = 'aacrom-chart__bar-v-track';

      var bar = document.createElement('div');
      bar.className = 'aacrom-chart__bar-v-fill';
      bar.style.height = pct.toFixed(2) + '%';
      bar.style.background = color;
      track.appendChild(bar);

      col.appendChild(track);

      var label = document.createElement('div');
      label.className = 'aacrom-chart__bar-v-label';
      label.textContent = r.label || '';
      col.appendChild(label);

      area.appendChild(col);
    });

    wrapper.appendChild(area);
  }

  // ---- Pie chart (SVG puro) ----
  function renderPie(wrapper, rows, showValues) {
    var total = rows.reduce(function (s, r) { return s + safeNum(r.value); }, 0);
    if (total === 0) {
      var empty = document.createElement('p');
      empty.className = 'aacrom-chart__empty';
      empty.textContent = 'No hay datos para graficar';
      wrapper.appendChild(empty);
      return;
    }

    var pieWrap = document.createElement('div');
    pieWrap.className = 'aacrom-chart__pie-wrap';

    var size = 240;
    var cx = size / 2;
    var cy = size / 2;
    var radius = (size / 2) - 4;
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'aacrom-chart__pie-svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);

    var startAngle = -Math.PI / 2;  // empezar arriba

    rows.forEach(function (r, i) {
      var val = safeNum(r.value);
      var pct = val / total;
      var color = r.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
      var endAngle = startAngle + (pct * 2 * Math.PI);

      // Si solo hay 1 segmento que cubre 100%, usar círculo
      if (rows.length === 1) {
        var circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', color);
        svg.appendChild(circle);
        startAngle = endAngle;
        return;
      }

      var x1 = cx + radius * Math.cos(startAngle);
      var y1 = cy + radius * Math.sin(startAngle);
      var x2 = cx + radius * Math.cos(endAngle);
      var y2 = cy + radius * Math.sin(endAngle);
      var largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

      var path = document.createElementNS(SVG_NS, 'path');
      var d = [
        'M', cx, cy,
        'L', x1.toFixed(3), y1.toFixed(3),
        'A', radius, radius, 0, largeArc, 1, x2.toFixed(3), y2.toFixed(3),
        'Z'
      ].join(' ');
      path.setAttribute('d', d);
      path.setAttribute('fill', color);
      path.setAttribute('stroke', '#FFFFFF');
      path.setAttribute('stroke-width', '2');
      svg.appendChild(path);

      startAngle = endAngle;
    });

    pieWrap.appendChild(svg);

    // Leyenda
    var legend = document.createElement('ul');
    legend.className = 'aacrom-chart__pie-legend';
    rows.forEach(function (r, i) {
      var val = safeNum(r.value);
      var pct = ((val / total) * 100).toFixed(1);
      var color = r.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];

      var li = document.createElement('li');
      li.className = 'aacrom-chart__pie-legend-item';

      var swatch = document.createElement('span');
      swatch.className = 'aacrom-chart__pie-legend-swatch';
      swatch.setAttribute('aria-hidden', 'true');
      swatch.style.background = color;
      li.appendChild(swatch);

      var labelEl = document.createElement('span');
      labelEl.className = 'aacrom-chart__pie-legend-label';
      labelEl.textContent = (r.label || '') +
        (showValues ? ' — ' + val + ' (' + pct + '%)' : '');
      li.appendChild(labelEl);

      legend.appendChild(li);
    });

    pieWrap.appendChild(legend);
    wrapper.appendChild(pieWrap);
  }

})(window);
