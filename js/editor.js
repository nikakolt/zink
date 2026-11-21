// Редактор: заполнение готовых мест шаблона своими фото и текстом
(function () {
  var Z = window.ZINK, D = Z.DATA;
  var LABELS = ['8 · 1 обложка', '2 · 3', '4 · 5', '6 · 7'];
  var TITLES = { photo: 'Фото', text: 'Текст', decor: 'Деталь', page: 'Страница' };
  var state = Z.load();
  var ui = { sp: 0, sel: null, pen: false, ink: 0 };
  var $ = function (id) { return document.getElementById(id); };
  var fit = 1;

  function pageName(pg) { pg = Number(pg); return pg === 1 ? 'обложка' : (pg === 8 ? 'задник' : 'стр. ' + pg); }
  function isSel(kind, id) { return ui.sel && ui.sel.kind === kind && String(ui.sel.id) === String(id); }
  function filledPhoto(id) { return !!(state.photos[id] && state.photos[id].user); }
  function filledText(t) { return state.texts[t.id] !== undefined && state.texts[t.id] !== t.text; }
  function persist() { var ok = Z.save(state); $('saveWarn').hidden = ok; }
  function item() {
    if (!ui.sel) return null;
    var P = D.pages[ui.sel.page], k = ui.sel.kind;
    if (k === 'photo') return P.photos.find(function (x) { return x.id === ui.sel.id; });
    if (k === 'text') return P.texts.find(function (x) { return x.id === ui.sel.id; });
    if (k === 'decor') return P.decor.find(function (x) { return x.id === ui.sel.id; });
    return P;
  }
  function select(kind, id, page) { ui.sel = kind ? { kind: kind, id: id, page: page } : null; render(); }

  // ---------- разворот ----------
  function el(tag, cls, css) { var e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; }
  function fontCss(F) { return 'font-family:' + F.family + ';font-weight:' + F.weight + ';font-size:' + F.size + 'px;line-height:' + F.lh + 'px;letter-spacing:' + F.ls + 'em;'; }

  function renderSpread() {
    var root = $('layers'); root.innerHTML = '';
    Z.SPREADS[ui.sp].forEach(function (pg, side) {
      var P = D.pages[pg], ox = side * Z.PAGE_W;
      var bg = el('div', 'lay' + (isSel('page', pg) ? ' on' : ''), 'left:' + ox + 'px;top:0;width:' + Z.PAGE_W + 'px;height:' + Z.PAGE_H + 'px;z-index:1;cursor:pointer;background:' + (state.bgs[pg] || P.bg));
      bg.setAttribute('aria-label', 'Страница ' + pg + ', фон');
      bg.addEventListener('pointerdown', function () { if (!ui.pen) select('page', pg, pg); });
      root.appendChild(bg);

      P.photos.forEach(function (ph) {
        var st = state.photos[ph.id] || {}, b = Z.photoBox(ph, st), on = isSel('photo', ph.id);
        var box = el('div', 'lay hit' + (on ? ' on' : (filledPhoto(ph.id) ? '' : ' todo')),
          'left:' + (ox + ph.x) + 'px;top:' + ph.y + 'px;width:' + ph.w + 'px;height:' + ph.h + 'px;z-index:10;overflow:hidden;touch-action:' + (on ? 'none' : 'auto') + ';cursor:' + (on ? 'grab' : 'pointer'));
        box.setAttribute('role', 'button'); box.setAttribute('aria-label', 'Фото, ' + pageName(pg));
        var img = el('div', '', 'width:100%;height:100%;background:url(' + (st.src || ph.src) + ') no-repeat;background-size:' + b.bw.toFixed(1) + 'px ' + b.bh.toFixed(1) + 'px;background-position:' + b.x.toFixed(1) + 'px ' + b.y.toFixed(1) + 'px');
        box.appendChild(img);
        box.addEventListener('pointerdown', function (e) {
          if (ui.pen) return; e.stopPropagation();
          if (!on) { select('photo', ph.id, pg); return; }
          startDrag(e, ph, b);
        });
        root.appendChild(box);
      });

      P.decor.forEach(function (d) {
        var st = state.decor[d.id] || {}, on = isSel('decor', d.id);
        var m = el('div', 'lay hit' + (on ? ' on' : ''),
          'left:' + (ox + d.x) + 'px;top:' + d.y + 'px;width:' + d.w + 'px;height:' + d.h + 'px;z-index:20;background-color:' + (st.color || d.color) +
          ';-webkit-mask:url(' + d.mask + ') 0 0/100% 100% no-repeat;mask:url(' + d.mask + ') 0 0/100% 100% no-repeat;opacity:' + (st.hidden ? (on ? 0.15 : 0) : 1));
        m.setAttribute('role', 'button'); m.setAttribute('aria-label', 'Деталь, ' + pageName(pg));
        m.addEventListener('pointerdown', function (e) { if (ui.pen) return; e.stopPropagation(); select('decor', d.id, pg); });
        root.appendChild(m);
      });

      P.texts.forEach(function (t) {
        var F = Z.FONTS[t.style], on = isSel('text', t.id);
        var val = state.texts[t.id] !== undefined ? state.texts[t.id] : t.text;
        var tx = el('div', 'lay hit' + (on ? ' on' : (filledText(t) ? '' : ' todo')),
          'left:' + (ox + t.x) + 'px;top:' + t.y + 'px;width:' + t.w + 'px;z-index:30;padding:4px 6px;overflow-wrap:anywhere;text-align:' + t.align + ';color:' + t.color + ';white-space:' + (F.wrap ? 'pre-wrap' : 'pre') + ';' + fontCss(F));
        tx.textContent = val;
        tx.setAttribute('role', 'button'); tx.setAttribute('aria-label', 'Текст, ' + pageName(pg));
        tx.addEventListener('pointerdown', function (e) { if (ui.pen) return; e.stopPropagation(); select('text', t.id, pg); });
        root.appendChild(tx);
      });
    });
    renderStrokes();
  }

  // Перетаскивание кадра внутри рамки
  function startDrag(e, ph, b) {
    var r = e.currentTarget.getBoundingClientRect();
    var d = { x: e.clientX, y: e.clientY, ox: b.ox, oy: b.oy, f: ph.w / r.width };
    function mv(ev) {
      var cur = state.photos[ph.id] || {};
      state.photos[ph.id] = Object.assign({}, cur, { ox: d.ox + (ev.clientX - d.x) * d.f, oy: d.oy + (ev.clientY - d.y) * d.f });
      renderSpread();
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); persist(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  // ---------- карандаш ----------
  var live = null;
  function strokesKey() { return 's' + ui.sp; }
  function renderStrokes() {
    var list = (state.strokes[strokesKey()] || []).concat(live ? [live] : []);
    $('strokes').innerHTML = list.map(Z.pencilSvg).join('');
  }
  function penPos(e) { var r = $('pen').getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1190, (e.clientY - r.top) / r.height * 842]; }
  $('pen').addEventListener('pointerdown', function (e) {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {}
    live = { pts: [penPos(e)], c: Z.INKS[ui.ink].c }; renderStrokes();
  });
  $('pen').addEventListener('pointermove', function (e) {
    if (!live) return; var p = penPos(e), l = live.pts[live.pts.length - 1];
    if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) < 3) return; live.pts.push(p); renderStrokes();
  });
  function endStroke() {
    if (!live) return;
    if (live.pts.length === 1) live.pts.push([live.pts[0][0] + 0.5, live.pts[0][1] + 0.5]);
    var k = strokesKey(); state.strokes[k] = (state.strokes[k] || []).concat([live]); live = null; renderStrokes(); persist(); renderThumbsAndProgress();
  }
  $('pen').addEventListener('pointerup', endStroke);
  $('pen').addEventListener('pointercancel', endStroke);
  $('penBtn').addEventListener('click', function () { ui.pen = !ui.pen; ui.sel = null; render(); });
  $('undo').addEventListener('click', function () { var k = strokesKey(); state.strokes[k] = (state.strokes[k] || []).slice(0, -1); persist(); renderStrokes(); });

  // ---------- миниатюры и прогресс ----------
  function renderThumbsAndProgress() {
    var pr = Z.progress(state);
    $('progressText').textContent = 'Заполнено ' + pr.done + ' из ' + pr.total;
    $('progressBar').style.width = (pr.total ? pr.done / pr.total * 100 : 0) + '%';
    var box = $('thumbs'); box.innerHTML = '';
    Z.SPREADS.forEach(function (p, i) {
      var n = (pr.left[p[0]] || 0) + (pr.left[p[1]] || 0);
      var b = el('button', 'thumb'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', i === ui.sp ? 'true' : 'false');
      b.innerHTML = '<img src="' + D.spreads[i] + '" alt="">' +
        '<span class="thumb__meta mono"><span>' + LABELS[i] + '</span><span style="color:' + (n ? '#8A8A86' : '#1E6B2E') + '">' + (n ? 'ещё ' + n : '✓') + '</span></span>';
      b.addEventListener('click', function () { ui.sp = i; ui.sel = null; render(); });
      box.appendChild(b);
    });
  }

  // ---------- панель ----------
  function swatch(list, current, onPick, label) {
    return list.map(function (c) {
      var b = el('button', 'sw', 'background:' + c.c + ';border:1px solid ' + (c.c === '#FFFFFF' ? '#BDBDB8' : c.c));
      b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', c.name); b.setAttribute('aria-checked', current === c.c ? 'true' : 'false');
      b.addEventListener('click', function () { onPick(c.c); });
      return b;
    });
  }
  function fill(id, nodes) { var e = $(id); e.innerHTML = ''; nodes.forEach(function (n) { e.appendChild(n); }); }

  function renderPanel() {
    var sel = ui.sel, it = item();
    $('kicker').hidden = !sel; $('kicker').textContent = sel ? pageName(sel.page) : '';
    $('panelTitle').textContent = sel ? TITLES[sel.kind] : 'Что заполнить';
    ['pNone', 'pPhoto', 'pText', 'pDecor', 'pPage'].forEach(function (id) { $(id).hidden = true; });
    if (!sel) {
      $('pNone').hidden = false;
      var ul = $('todo'); ul.innerHTML = '';
      Z.SPREADS[ui.sp].forEach(function (pg) {
        D.pages[pg].photos.forEach(function (ph) { addTodo(ul, 'Фото · ' + pageName(pg), filledPhoto(ph.id), function () { select('photo', ph.id, pg); }); });
        D.pages[pg].texts.forEach(function (t) { addTodo(ul, 'Текст · ' + pageName(pg), filledText(t), function () { select('text', t.id, pg); }); });
      });
    } else if (sel.kind === 'photo') {
      $('pPhoto').hidden = false;
      var k = Math.round(((state.photos[sel.id] || {}).k || 1) * 100);
      $('zoom').value = k; $('zoomVal').textContent = k + '%';
    } else if (sel.kind === 'text') {
      $('pText').hidden = false;
      var ta = $('txt'); if (document.activeElement !== ta) ta.value = state.texts[sel.id] !== undefined ? state.texts[sel.id] : it.text;
    } else if (sel.kind === 'decor') {
      $('pDecor').hidden = false;
      var cur = state.decor[sel.id] || {};
      fill('decorSw', swatch(Z.PAL, cur.color || it.color, function (c) { state.decor[sel.id] = Object.assign({}, cur, { color: c }); persist(); render(); }));
      $('hideDecor').textContent = cur.hidden ? 'Показать деталь' : 'Скрыть деталь';
    } else {
      $('pPage').hidden = false;
      fill('bgSw', swatch(Z.PAL, state.bgs[sel.id] || it.bg, function (c) { state.bgs[sel.id] = c; persist(); render(); }));
    }
    $('penBtn').textContent = ui.pen ? 'Карандаш в руке — нажми, чтобы убрать' : 'Взять карандаш';
    $('penBtn').setAttribute('aria-pressed', ui.pen ? 'true' : 'false');
    $('pen').classList.toggle('is-on', ui.pen);
    fill('inkSw', swatch(Z.INKS, Z.INKS[ui.ink].c, function (c) { ui.ink = Z.INKS.findIndex(function (x) { return x.c === c; }); ui.pen = true; render(); }));
  }
  function addTodo(ul, name, ok, pick) {
    var li = el('li'), b = el('button'); b.type = 'button';
    b.innerHTML = '<span>' + name + '</span><span class="mono" style="color:' + (ok ? '#1E6B2E' : '#8A8A86') + '">' + (ok ? '✓ своё' : 'шаблон') + '</span>';
    b.addEventListener('click', pick); li.appendChild(b); ul.appendChild(li);
  }

  // Загрузка своего фото: уменьшаем до 1600 px, чтобы оно поместилось в память браузера
  $('upload').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f || !ui.sel) return;
    var id = ui.sel.id, rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        state.photos[id] = { src: c.toDataURL('image/jpeg', 0.86), iw: c.width, ih: c.height, k: 1, ox: 0, oy: 0, user: true };
        persist(); render();
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f); e.target.value = '';
  });
  $('zoom').addEventListener('input', function (e) {
    if (!ui.sel) return; var cur = state.photos[ui.sel.id] || {};
    state.photos[ui.sel.id] = Object.assign({}, cur, { k: Number(e.target.value) / 100 });
    $('zoomVal').textContent = e.target.value + '%'; renderSpread();
  });
  $('zoom').addEventListener('change', persist);
  $('txt').addEventListener('input', function (e) { if (!ui.sel) return; state.texts[ui.sel.id] = e.target.value; persist(); renderSpread(); renderThumbsAndProgress(); });
  $('hideDecor').addEventListener('click', function () { if (!ui.sel) return; var cur = state.decor[ui.sel.id] || {}; state.decor[ui.sel.id] = Object.assign({}, cur, { hidden: !cur.hidden }); persist(); render(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-reset]'), function (b) {
    b.addEventListener('click', function () {
      if (!ui.sel) return;
      if (ui.sel.kind === 'photo') delete state.photos[ui.sel.id];
      if (ui.sel.kind === 'text') { delete state.texts[ui.sel.id]; $('txt').value = item().text; }
      persist(); render();
    });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ui.sel) select(null); });

  // ---------- масштаб разворота под окно ----------
  function layout() {
    var st = $('stage'), cs = getComputedStyle(st);
    var w = st.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var h = window.matchMedia('(max-width: 760px)').matches ? Infinity : st.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    fit = Math.max(0.2, Math.min(1, w / 1190, h / 842));
    $('fit').style.width = (1190 * fit) + 'px'; $('fit').style.height = (842 * fit) + 'px';
    $('spread').style.transform = 'scale(' + fit + ')';
  }
  if (window.ResizeObserver) new ResizeObserver(layout).observe($('stage')); else window.addEventListener('resize', layout);

  function render() { renderThumbsAndProgress(); renderSpread(); renderPanel(); }
  layout(); render();
  if (document.fonts) document.fonts.ready.then(renderSpread);
})();
