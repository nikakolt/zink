// Редактор: заполнение готовых мест шаблона своими фото и текстом
(function () {
  var Z = window.ZINK, D = Z.DATA;
  var LABELS = ['8 · 1 обложка', '2 · 3', '4 · 5', '6 · 7'];
  var TITLES = { photo: 'Фото', text: 'Текст', decor: 'Деталь', page: 'Страница', free: 'Своё' };
  var state = Z.load();
  var CUR = Z.CUR || {}, OWN = Z.T === 'c' && !CUR.m;   // OWN: свой зин из сборки (а не сохранённый)
  document.getElementById('tplName').textContent = CUR.name ? CUR.name : (D.name || ('шаблон ' + Z.T)).toLowerCase();
  if (OWN) {   // свой зин: шаг «01» ведёт обратно в сборку
    var st1 = document.querySelector('.steps a[href="templates.html"]'); if (st1) st1.href = 'builder.html';
  }
  state.textColors = state.textColors || {};
  state.free = state.free || {};
  // Свои элементы страницы: очищена ли она от шаблона и что на неё добавлено
  function freeOf(pg) { return state.free[pg] || (state.free[pg] = { cleared: false, items: [] }); }
  function isClear(pg) { return !!(state.free[pg] && state.free[pg].cleared); }
  function uid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  var ui = { sp: 0, page: 1, sel: null, pen: false, erase: false, ink: Z.INKS[0].c, editing: null };
  function defPage(sp) { return sp === 0 ? 1 : Z.SPREADS[sp][0]; }   // первый разворот: обложка, остальные: левая страница
  var $ = function (id) { return document.getElementById(id); };
  var fit = 1;

  function pageName(pg) { pg = Number(pg); return pg === 1 ? 'обложка' : (pg === 8 ? 'задник' : 'стр. ' + pg); }
  function isSel(kind, id) { return ui.sel && ui.sel.kind === kind && String(ui.sel.id) === String(id); }
  function filledPhoto(id) { return !!(state.photos[id] && state.photos[id].user); }
  function filledText(t) { return state.texts[t.id] !== undefined && state.texts[t.id] !== t.text; }
  function persist() { var ok = Z.save(state); $('saveWarn').hidden = ok; queueThumb(ui.sp); }

  // Живые миниатюры: перерисовываем разворот после правок (с небольшой задержкой)
  var thumbSrc = [], thumbDirty = {}, thumbTimer = null;
  function queueThumb(i) {
    thumbDirty[i] = true; clearTimeout(thumbTimer);
    thumbTimer = setTimeout(drawThumbs, 250);
  }
  function drawThumbs() {
    var list = Object.keys(thumbDirty).map(Number); thumbDirty = {};
    list.reduce(function (p, i) {
      return p.then(function () {
        var c = document.createElement('canvas'); c.width = 560; c.height = Math.round(560 * Z.PAGE_H / (Z.PAGE_W * 2));
        return Z.renderSpread(c, i, state).then(function () {
          try { thumbSrc[i] = c.toDataURL('image/jpeg', 0.85); } catch (e) { return; }
          var img = document.querySelector('.thumb[data-i="' + i + '"] img'); if (img) img.src = thumbSrc[i];
        });
      });
    }, Promise.resolve());
  }
  function item() {
    if (!ui.sel) return null;
    var P = D.pages[ui.sel.page], k = ui.sel.kind;
    if (k === 'photo') return P.photos.find(function (x) { return x.id === ui.sel.id; });
    if (k === 'text') return P.texts.find(function (x) { return x.id === ui.sel.id; });
    if (k === 'decor') return P.decor.find(function (x) { return x.id === ui.sel.id; });
    if (k === 'free') return freeOf(ui.sel.page).items.find(function (x) { return x.id === ui.sel.id; });
    return P;
  }
  function select(kind, id, page) {
    if (ui.editing && !(kind === 'free' && id === ui.editing)) ui.editing = null;
    ui.sel = kind ? { kind: kind, id: id, page: page } : null;
    if (page) ui.page = Number(page);
    if (kind === 'page') $('accBg').open = true;   // клик по фону страницы: сразу к цветам фона
    render();
  }

  // ---------- разворот ----------
  function el(tag, cls, css) { var e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; }
  function fontCss(F) { return 'font-family:' + F.family + ';font-weight:' + F.weight + ';font-size:' + F.size + 'px;line-height:' + F.lh + 'px;letter-spacing:' + F.ls + 'em;'; }

  function renderSpread() {
    var root = $('layers'); root.innerHTML = '';
    Z.SPREADS[ui.sp].forEach(function (pg, side) {
      var P0 = D.pages[pg], ox = side * Z.PAGE_W, clear = isClear(pg);
      var P = clear ? { bg: '#FFFFFF', photos: [], decor: [], texts: [] } : P0;
      var bg = el('div', 'lay' + (isSel('page', pg) ? ' on' : ''), 'left:' + ox + 'px;top:0;width:' + Z.PAGE_W + 'px;height:' + Z.PAGE_H + 'px;z-index:1;cursor:pointer;background:' + (state.bgs[pg] || (P.bgImg ? 'url(' + P.bgImg + ') 0 0/100% 100% no-repeat ' + P.bg : P.bg)));
      bg.setAttribute('aria-label', 'Страница ' + pg + ', фон');
      bg.addEventListener('pointerdown', function () { if (!ui.pen) select('page', pg, pg); });
      root.appendChild(bg);

      P.photos.forEach(function (ph) {
        var st = state.photos[ph.id] || {}, b = Z.photoBox(ph, st), on = isSel('photo', ph.id);
        var box = el('div', 'lay hit' + (on ? ' on' : (filledPhoto(ph.id) ? '' : ' todo')),
          'left:' + (ox + ph.x) + 'px;top:' + ph.y + 'px;width:' + ph.w + 'px;height:' + ph.h + 'px;z-index:10;overflow:hidden;touch-action:' + (on ? 'none' : 'auto') + ';cursor:' + (on ? 'grab' : 'pointer') + (ph.rot ? ';transform:rotate(' + ph.rot + 'deg)' : ''));
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
        if (st.hidden) return;   // скрытая деталь убирается полностью и не мешает нажимать на фото под ней
        var m = el('div', 'lay hit' + (on ? ' on' : ''),
          'left:' + (ox + d.x) + 'px;top:' + d.y + 'px;width:' + d.w + 'px;height:' + d.h + 'px;z-index:20;background-color:' + (st.color || d.color) +
          ';-webkit-mask:url(' + d.mask + ') 0 0/100% 100% no-repeat;mask:url(' + d.mask + ') 0 0/100% 100% no-repeat');
        m.setAttribute('role', 'button'); m.setAttribute('aria-label', 'Деталь, ' + pageName(pg));
        m.addEventListener('pointerdown', function (e) { if (ui.pen) return; e.stopPropagation(); select('decor', d.id, pg); });
        root.appendChild(m);
      });

      P.texts.forEach(function (t) {
        var F = Z.FONTS[t.style], on = isSel('text', t.id);
        var val = state.texts[t.id] !== undefined ? state.texts[t.id] : t.text;
        var tx = el('div', 'lay hit' + (on ? ' on' : (filledText(t) ? '' : ' todo')),
          'left:' + (ox + t.x) + 'px;top:' + t.y + 'px;width:' + t.w + 'px;z-index:30;padding:4px 6px;text-align:' + t.align + ';color:' + (state.textColors[t.id] || t.color) + ';white-space:pre;' + fontCss(F) + (t.rot ? 'transform-origin:0 0;transform:rotate(' + t.rot + 'deg);' : ''));
        // Те же строки и кегль, что уйдут в PDF
        var fit = Z.fitText(t, val);
        tx.style.fontSize = fit.size + 'px'; tx.style.lineHeight = fit.lh + 'px';
        tx.textContent = fit.lines.join('\n');
        tx.setAttribute('role', 'button'); tx.setAttribute('aria-label', 'Текст, ' + pageName(pg));
        tx.addEventListener('pointerdown', function (e) { if (ui.pen) return; e.stopPropagation(); select('text', t.id, pg); });
        root.appendChild(tx);
      });

      // безопасная зона у края листа: ближе печать без полей может срезать
      Z.SHEET_EDGES[pg].forEach(function (e) {
        var S = Z.SAFE, css = e === 'b' ? 'left:' + ox + 'px;top:' + (Z.PAGE_H - S) + 'px;width:' + Z.PAGE_W + 'px;height:0;border-top-width:1.5px'
          : e === 'l' ? 'left:' + (ox + S) + 'px;top:0;width:0;height:' + Z.PAGE_H + 'px;border-left-width:1.5px'
          : 'left:' + (ox + Z.PAGE_W - S) + 'px;top:0;width:0;height:' + Z.PAGE_H + 'px;border-left-width:1.5px';
        root.appendChild(el('div', 'lay safe', css));
        if (e === 'b') { var lb = el('div', 'lay safe__label', 'left:' + (ox + 10) + 'px;top:' + (Z.PAGE_H - S + 6) + 'px'); lb.textContent = 'край листа · 5 мм'; root.appendChild(lb); }
      });

      // свои тексты и фото: поверх шаблона. Что за краем страницы: не печатается (как содержимое фрейма в Фигме)
      var clip = el('div', 'lay', 'left:' + ox + 'px;top:0;width:' + Z.PAGE_W + 'px;height:' + Z.PAGE_H + 'px;z-index:40;overflow:hidden;pointer-events:none');
      freeOf(pg).items.forEach(function (it) {
        if (ui.editing === it.id) return;   // редактируемый текст рисуется в рамке сверху
        var box = el('div', 'lay hit free', 'left:' + it.x + 'px;top:' + it.y + 'px;width:' + it.w + 'px;pointer-events:auto;cursor:default;touch-action:none');
        if (it.type === 'img') {
          box.style.height = it.h + 'px';
          box.style.background = 'url(' + it.src + ') 0 0/100% 100% no-repeat';
          box.setAttribute('aria-label', 'Своё фото, ' + pageName(pg));
        } else {
          var L = Z.freeLayout(it);
          box.style.cssText += ';height:' + L.h + 'px;white-space:pre;font-family:' + L.F.family + ';font-weight:' + L.F.weight + ';font-size:' + L.size + 'px;line-height:' + L.lh + 'px;color:' + it.color + ';text-align:' + it.align;
          box.textContent = L.lines.join('\n');
          box.setAttribute('aria-label', 'Свой текст, ' + pageName(pg));
        }
        box.setAttribute('role', 'button');
        box.addEventListener('pointerdown', function (e) {
          if (ui.pen) return; e.stopPropagation(); e.preventDefault();
          if (!isSel('free', it.id)) select('free', it.id, pg);
          startMove(e, it, pg);
        });
        box.addEventListener('dblclick', function () { if (it.type === 'text') startEdit(it, pg); });
        clip.appendChild(box);
      });
      root.appendChild(clip);

      // рамка выделения поверх всего и без обрезки: видно, где элемент целиком, даже если он ушёл за край
      freeOf(pg).items.forEach(function (it) {
        if (!isSel('free', it.id)) return;
        var hgt = it.type === 'img' ? it.h : Z.freeLayout(it).h;
        var fr = el('div', 'lay frame', 'left:' + (ox + it.x) + 'px;top:' + it.y + 'px;width:' + it.w + 'px;height:' + hgt + 'px;z-index:58');
        if (ui.editing === it.id) {
          fr.classList.add('is-edit');
          var ed = el('div', 'edit', 'font-family:' + Z.FREE_FONTS[it.font].family + ';font-weight:' + Z.FREE_FONTS[it.font].weight + ';font-size:' + it.size + 'px;line-height:' + (it.size * 1.2) + 'px;color:' + it.color + ';text-align:' + it.align);
          ed.contentEditable = 'plaintext-only'; if (ed.contentEditable !== 'plaintext-only') ed.contentEditable = 'true';
          ed.textContent = it.text; ed.spellcheck = false;
          ed.addEventListener('input', function () { it.text = ed.innerText.replace(/\n$/, ''); $('ftxt').value = it.text; persist(); fr.style.height = ed.offsetHeight + 'px'; overflowHint(it); });
          ed.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); stopEdit(); } e.stopPropagation(); });
          ed.addEventListener('blur', function () { setTimeout(function () { if (ui.editing === it.id) stopEdit(); }, 0); });
          ed.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
          fr.style.height = 'auto'; fr.appendChild(ed);
          setTimeout(function () { ed.focus(); var r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); var sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); }, 0);
        } else {
          fr.addEventListener('pointerdown', function (e) { if (ui.pen) return; e.stopPropagation(); e.preventDefault(); startMove(e, it, pg); });
          fr.addEventListener('dblclick', function () { if (it.type === 'text') startEdit(it, pg); });
          (it.type === 'img' ? ['nw', 'ne', 'sw', 'se'] : ['nw', 'ne', 'sw', 'se', 'w', 'e']).forEach(function (hd) {
            var h = el('div', 'hdl hdl--' + hd); h.setAttribute('aria-hidden', 'true');
            h.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); startResize(e, it, hd); });
            fr.appendChild(h);
          });
          var badge = el('div', 'badge'); badge.textContent = Math.round(it.w) + ' × ' + Math.round(hgt);
          fr.appendChild(badge);
        }
        root.appendChild(fr);
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

  // Свой элемент: как в Фигме: тянуть, чтобы двигать (с притяжением к центру и краям страницы),
  // ручки по углам: размер (текст масштабируется вместе с кеглем), по бокам: ширина текста
  var SNAP = 6;
  function guides(list) {
    Array.prototype.forEach.call(document.querySelectorAll('.guide'), function (g) { g.remove(); });
    list.forEach(function (g) { $('layers').appendChild(el('div', 'lay guide', g)); });
  }
  function startMove(e, it, pg) {
    var d = { x: e.clientX, y: e.clientY, ix: it.x, iy: it.y }, moved = false, ox = Z.SPREADS[ui.sp].indexOf(Number(pg)) * Z.PAGE_W;
    function mv(ev) {
      var dx = (ev.clientX - d.x) / fit, dy = (ev.clientY - d.y) / fit;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return; moved = true;
      var w = it.w, h = it.type === 'img' ? it.h : Z.freeLayout(it).h, x = d.ix + dx, y = d.iy + dy, g = [];
      if (!ev.altKey) {
        var tol = SNAP / fit, cx = Z.PAGE_W / 2, cy = Z.PAGE_H / 2;
        if (Math.abs(x + w / 2 - cx) < tol) { x = cx - w / 2; g.push('left:' + (ox + cx) + 'px;top:0;width:1px;height:' + Z.PAGE_H + 'px'); }
        else if (Math.abs(x - Z.SAFE) < tol) { x = Z.SAFE; g.push('left:' + (ox + Z.SAFE) + 'px;top:0;width:1px;height:' + Z.PAGE_H + 'px'); }
        else if (Math.abs(x + w - (Z.PAGE_W - Z.SAFE)) < tol) { x = Z.PAGE_W - Z.SAFE - w; g.push('left:' + (ox + Z.PAGE_W - Z.SAFE) + 'px;top:0;width:1px;height:' + Z.PAGE_H + 'px'); }
        if (Math.abs(y + h / 2 - cy) < tol) { y = cy - h / 2; g.push('left:' + ox + 'px;top:' + cy + 'px;width:' + Z.PAGE_W + 'px;height:1px'); }
        else if (Math.abs(y + h - (Z.PAGE_H - Z.SAFE)) < tol) { y = Z.PAGE_H - Z.SAFE - h; g.push('left:' + ox + 'px;top:' + (Z.PAGE_H - Z.SAFE) + 'px;width:' + Z.PAGE_W + 'px;height:1px'); }
      }
      it.x = Math.round(x); it.y = Math.round(y);
      renderSpread(); guides(g); overflowHint(it);
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); guides([]); if (moved) { persist(); renderPanel(); } }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function startResize(e, it, hd) {
    var h0 = it.type === 'img' ? it.h : Z.freeLayout(it).h;
    var d = { x: e.clientX, y: e.clientY, x0: it.x, y0: it.y, w0: it.w, h0: h0, s0: it.size };
    var west = hd.indexOf('w') >= 0, north = hd.indexOf('n') >= 0, corner = hd.length === 2;
    function mv(ev) {
      var dx = (ev.clientX - d.x) / fit, dy = (ev.clientY - d.y) / fit;
      if (corner) {
        // пропорционально, противоположный угол стоит на месте
        var kx = (d.w0 + (west ? -dx : dx)) / d.w0, ky = (d.h0 + (north ? -dy : dy)) / d.h0;
        var k = Math.max(0.05, Math.abs(kx - 1) > Math.abs(ky - 1) ? kx : ky);
        it.w = Math.max(20, Math.round(d.w0 * k));
        if (it.type === 'img') it.h = Math.round(d.h0 * it.w / d.w0);
        else it.size = Math.max(6, Math.round(d.s0 * k * 10) / 10);
        var nh = it.type === 'img' ? it.h : Z.freeLayout(it).h;
        it.x = Math.round(west ? d.x0 + d.w0 - it.w : d.x0);
        it.y = Math.round(north ? d.y0 + d.h0 - nh : d.y0);
      } else {
        // бок: только ширина текста, высота подстраивается сама
        var w = Math.max(30, Math.round(d.w0 + (west ? -dx : dx)));
        it.w = w; if (west) it.x = Math.round(d.x0 + d.w0 - w);
      }
      renderSpread(); overflowHint(it);
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); persist(); renderPanel(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function startEdit(it, pg) { ui.sel = { kind: 'free', id: it.id, page: pg }; ui.editing = it.id; renderSpread(); renderPanel(); }
  function stopEdit() { ui.editing = null; persist(); renderSpread(); renderPanel(); }
  // Честная подсказка: что за краем страницы, в печать не попадёт
  function overflowHint(it) {
    var h = it.type === 'img' ? it.h : Z.freeLayout(it).h;
    var out = it.x < -1 || it.y < -1 || it.x + it.w > Z.PAGE_W + 1 || it.y + h > Z.PAGE_H + 1;
    var n = $(it.type === 'img' ? 'iOut' : 'fOut'); if (n) n.hidden = !out;
  }
  function readImage(file, done) {
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        done(c.toDataURL('image/jpeg', 0.86), c.width, c.height);
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function darkBg(pg) {
    var c = state.bgs[pg] || (isClear(pg) ? '#FFFFFF' : D.pages[pg].bg);
    var m = /^#?([0-9a-f]{6})$/i.exec(c); if (!m) return false;
    var n = parseInt(m[1], 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) < 110;
  }
  function addText(pg) {
    var it = { id: uid(), type: 'text', x: 60, y: 380, w: 475, text: 'твой текст', size: 40, font: 'sans', align: 'left', color: darkBg(pg) ? '#FFFFFF' : '#000000' };
    freeOf(pg).items.push(it); persist(); select('free', it.id, pg);
    startEdit(it, pg);   // сразу печатать прямо на странице
    setTimeout(function () { var ed = document.querySelector('.edit'); if (ed) { var r = document.createRange(); r.selectNodeContents(ed); var sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); } }, 10);
  }
  var addTo = null;
  $('addImg').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0], pg = addTo; e.target.value = ''; if (!f || !pg) return;
    readImage(f, function (src, iw, ih) {
      var w = 300, h = Math.round(w * ih / iw); if (h > 640) { h = 640; w = Math.round(h * iw / ih); }
      var it = { id: uid(), type: 'img', x: Math.round((Z.PAGE_W - w) / 2), y: Math.round((Z.PAGE_H - h) / 2), w: w, h: h, src: src };
      freeOf(pg).items.push(it); persist(); select('free', it.id, pg);
    });
  });

  // ---------- карандаш ----------
  var live = null;
  function strokesKey() { return 's' + ui.sp; }
  function renderStrokes() {
    var list = (state.strokes[strokesKey()] || []).concat(live ? [live] : []);
    $('strokes').innerHTML = list.map(Z.pencilSvg).join('');
  }
  function penPos(e) { var r = $('pen').getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 1190, (e.clientY - r.top) / r.height * 842]; }
  // История для «отменить»: и нарисованное, и стёртое
  var hist = {};
  function remember() { var k = strokesKey(); (hist[k] = hist[k] || []).push((state.strokes[k] || []).slice()); if (hist[k].length > 50) hist[k].shift(); }

  // Ластик: проводишь по линии: она исчезает целиком, любая, не только последняя
  var erasing = false, erasedAny = false;
  function distSeg(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1]; return Math.sqrt(x * x + y * y);
  }
  function eraseAt(p) {
    var k = strokesKey(), list = state.strokes[k] || [], R = 12;
    var keep = list.filter(function (st) {
      for (var i = 0; i < st.pts.length; i++) if (distSeg(p, st.pts[i], st.pts[Math.min(i + 1, st.pts.length - 1)]) < R) return false;
      return true;
    });
    if (keep.length !== list.length) {
      if (!erasedAny) { remember(); erasedAny = true; }   // одна запись в истории на всё движение ластиком
      state.strokes[k] = keep; renderStrokes();
    }
  }
  function moveCursor(e) {
    var c = $('eraserDot'); if (!ui.erase) { c.hidden = true; return; }
    var r = $('pen').getBoundingClientRect(), s = r.width / 1190;
    c.hidden = false; c.style.width = c.style.height = '24px';   // слой внутри масштабированного разворота: координаты в его единицах
    c.style.left = ((e.clientX - r.left) / s) + 'px'; c.style.top = ((e.clientY - r.top) / s) + 'px';
  }

  $('pen').addEventListener('pointerdown', function (e) {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {}
    if (ui.erase) { erasing = true; erasedAny = false; eraseAt(penPos(e)); return; }
    live = { pts: [penPos(e)], c: ui.ink }; renderStrokes();
  });
  $('pen').addEventListener('pointermove', function (e) {
    moveCursor(e);
    if (ui.erase) { if (erasing) eraseAt(penPos(e)); return; }
    if (!live) return; var p = penPos(e), l = live.pts[live.pts.length - 1];
    if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) < 3) return; live.pts.push(p); renderStrokes();
  });
  $('pen').addEventListener('pointerleave', function () { $('eraserDot').hidden = true; });
  function endStroke() {
    if (erasing) { erasing = false; if (erasedAny) { persist(); renderThumbsAndProgress(); } return; }
    if (!live) return;
    if (live.pts.length === 1) live.pts.push([live.pts[0][0] + 0.5, live.pts[0][1] + 0.5]);
    remember();
    var k = strokesKey(); state.strokes[k] = (state.strokes[k] || []).concat([live]); live = null; renderStrokes(); persist(); renderThumbsAndProgress();
  }
  $('pen').addEventListener('pointerup', endStroke);
  $('pen').addEventListener('pointercancel', endStroke);
  $('penBtn').addEventListener('click', function () { ui.pen = !(ui.pen && !ui.erase); ui.erase = false; ui.sel = null; render(); });
  $('eraseBtn').addEventListener('click', function () { ui.erase = !ui.erase; ui.pen = ui.erase; ui.sel = null; render(); });
  $('undo').addEventListener('click', function () {
    var k = strokesKey(), h = hist[k];
    if (h && h.length) state.strokes[k] = h.pop();                       // шаг назад: вернёт и стёртое
    else state.strokes[k] = (state.strokes[k] || []).slice(0, -1);       // истории нет (после перезагрузки): убрать последнюю линию
    persist(); renderStrokes(); renderThumbsAndProgress();
  });

  // ---------- миниатюры и прогресс ----------
  function renderThumbsAndProgress() {
    var pr = Z.progress(state);
    $('progressText').textContent = 'Заполнено ' + pr.done + ' из ' + pr.total;
    $('progressBar').style.width = (pr.total ? pr.done / pr.total * 100 : 0) + '%';
    var box = $('thumbs'); box.innerHTML = '';
    Z.SPREADS.forEach(function (p, i) {
      var n = (pr.left[p[0]] || 0) + (pr.left[p[1]] || 0);
      var b = el('button', 'thumb'); b.type = 'button'; b.dataset.i = i; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', i === ui.sp ? 'true' : 'false');
      b.innerHTML = '<img src="' + (thumbSrc[i] || D.spreads[i]) + '" alt="">' +
        '<span class="thumb__meta mono"><span>' + LABELS[i] + '</span><span style="color:' + (n ? '#8A8A86' : '#1E6B2E') + '">' + (n ? 'ещё ' + n : '✓') + '</span></span>';
      b.addEventListener('click', function () { ui.sp = i; ui.sel = null; ui.page = defPage(i); render(); });
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
  // Свой цвет: палитра браузера в квадратике с радугой
  function anyColor(current, onLive, onDone, list) {
    var l = el('label', 'sw sw--any'); l.title = 'Свой цвет';
    var inp = document.createElement('input'); inp.type = 'color'; inp.setAttribute('aria-label', 'Свой цвет');
    inp.value = /^#[0-9a-f]{6}$/i.test(current) ? current : '#ffffff';
    var inPal = (list || Z.PAL).some(function (c) { return c.c.toLowerCase() === String(current).toLowerCase(); });
    if (current && !inPal) { l.setAttribute('aria-checked', 'true'); l.style.background = current; }   // свой цвет выбран: квадратик им и закрашен
    inp.addEventListener('input', function () { l.style.background = inp.value; onLive(inp.value); });
    inp.addEventListener('change', function () { onDone(inp.value); });
    l.appendChild(inp); return l;
  }
  function setBg(pg, c, done) {
    state.bgs[pg] = c;
    if (done) { persist(); render(); } else { renderSpread(); queueThumb(ui.sp); }
  }
  function setTextColor(id, c, done) {
    state.textColors[id] = c;
    if (done) { persist(); render(); } else { renderSpread(); queueThumb(ui.sp); }
  }
  function bgNodes(pg) {
    var cur = state.bgs[pg] || (isClear(pg) ? '#FFFFFF' : D.pages[pg].bg);
    return swatch(Z.PAL, cur, function (c) { setBg(pg, c, true); })
      .concat([anyColor(cur, function (c) { setBg(pg, c, false); }, function (c) { setBg(pg, c, true); })]);
  }
  function fill(id, nodes) { var e = $(id); e.innerHTML = ''; nodes.forEach(function (n) { e.appendChild(n); }); }

  function renderPanel() {
    var sel = ui.sel, it = item(), pg = ui.page, clear = isClear(pg);

    // ---- верх: страница разворота и очистка
    fill('pageTabs', Z.SPREADS[ui.sp].map(function (p) {
      var b = el('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = pageName(p);
      b.setAttribute('aria-selected', p === pg ? 'true' : 'false');
      b.addEventListener('click', function () { ui.page = p; if (ui.sel && ui.sel.page !== p) ui.sel = null; render(); });
      return b;
    }));
    $('clearBtn').textContent = clear ? 'Вернуть шаблон на страницу' : 'Очистить страницу от шаблона';
    $('swapPage').hidden = !OWN; if (OWN) $('swapPage').href = 'builder.html?slot=' + pg;

    // ---- выбранный элемент
    var card = sel && sel.kind !== 'page' && it;
    $('selCard').hidden = !card;
    ['pPhoto', 'pText', 'pDecor', 'pFreeText', 'pFreeImg'].forEach(function (id) { $(id).hidden = true; });
    if (card) {
      $('kicker').textContent = pageName(sel.page);
      $('panelTitle').textContent = sel.kind === 'free' ? (it.type === 'img' ? 'Своё фото' : 'Свой текст') : TITLES[sel.kind];
      if (sel.kind === 'photo') {
        $('pPhoto').hidden = false;
        var k = Math.round(((state.photos[sel.id] || {}).k || 1) * 100);
        $('zoom').value = k; $('zoomVal').textContent = k + '%';
      } else if (sel.kind === 'text') {
        $('pText').hidden = false;
        var tc = state.textColors[sel.id] || it.color;
        fill('txtSw', swatch(Z.PAL, tc, function (c) { setTextColor(sel.id, c, true); })
          .concat([anyColor(tc, function (c) { setTextColor(sel.id, c, false); }, function (c) { setTextColor(sel.id, c, true); })]));
        var ta = $('txt'); if (document.activeElement !== ta) ta.value = state.texts[sel.id] !== undefined ? state.texts[sel.id] : it.text;
        textFitHint(it);
      } else if (sel.kind === 'free' && it.type === 'text') {
        $('pFreeText').hidden = false;
        var fa = $('ftxt'); if (document.activeElement !== fa) fa.value = it.text;
        $('fSize').value = Math.min(140, it.size); $('fSizeVal').textContent = Math.round(it.size) + ' px';
        overflowHint(it);
        fill('fFont', Object.keys(Z.FREE_FONTS).map(function (k) {
          var F = Z.FREE_FONTS[k], b = el('button', 'seg__b', 'font-family:' + F.family + ';font-weight:' + F.weight);
          b.type = 'button'; b.textContent = F.name; b.setAttribute('aria-pressed', it.font === k ? 'true' : 'false');
          b.addEventListener('click', function () { it.font = k; persist(); render(); }); return b;
        }));
        fill('fAlign', [['left', 'слева'], ['center', 'центр'], ['right', 'справа']].map(function (a) {
          var b = el('button', 'seg__b'); b.type = 'button'; b.textContent = a[1]; b.setAttribute('aria-pressed', it.align === a[0] ? 'true' : 'false');
          b.addEventListener('click', function () { it.align = a[0]; persist(); render(); }); return b;
        }));
        fill('fColor', swatch(Z.PAL, it.color, function (c) { it.color = c; persist(); render(); })
          .concat([anyColor(it.color, function (c) { it.color = c; renderSpread(); queueThumb(ui.sp); }, function (c) { it.color = c; persist(); render(); })]));
      } else if (sel.kind === 'free') {
        $('pFreeImg').hidden = false; overflowHint(it);
      } else if (sel.kind === 'decor') {
        $('pDecor').hidden = false;
        var cur = state.decor[sel.id] || {};
        fill('decorSw', swatch(Z.PAL, cur.color || it.color, function (c) { state.decor[sel.id] = Object.assign({}, cur, { color: c }); persist(); render(); }));
      }
    }

    // ---- что заполнить (по выбранной странице)
    var ul = $('todo'); ul.innerHTML = '';
    if (!clear) {
      D.pages[pg].photos.forEach(function (ph) { addTodo(ul, 'Фото', filledPhoto(ph.id), function () { select('photo', ph.id, pg); }); });
      D.pages[pg].texts.forEach(function (t) { addTodo(ul, 'Текст', filledText(t), function () { select('text', t.id, pg); }); });
    }
    $('todoClear').hidden = !clear; $('todoHint').hidden = clear;
    var nHid = 0;
    if (!clear) D.pages[pg].decor.forEach(function (d) { if ((state.decor[d.id] || {}).hidden) nHid++; });
    $('showDecor').hidden = !nHid; $('showDecor').textContent = 'Вернуть скрытые детали (' + nHid + ')';

    // ---- фон
    fill('bgSw', bgNodes(pg));

    // ---- карандаш: полная палитра
    var drawing = ui.pen && !ui.erase;
    $('penBtn').textContent = drawing ? 'Рисую' : 'Рисовать';
    $('penBtn').setAttribute('aria-pressed', drawing ? 'true' : 'false');
    $('eraseBtn').textContent = ui.erase ? 'Стираю' : 'Ластик';
    $('eraseBtn').setAttribute('aria-pressed', ui.erase ? 'true' : 'false');
    $('pen').classList.toggle('is-on', ui.pen);
    $('pen').classList.toggle('is-erase', ui.erase);
    $('eraseHint').hidden = !ui.erase; $('penHint').hidden = !drawing;
    var inks = [], seen = {};
    Z.INKS.concat(Z.PAL).forEach(function (c) { var k = c.c.toUpperCase(); if (!seen[k]) { seen[k] = 1; inks.push(c); } });
    function pickInk(c, done) { ui.ink = c; ui.pen = true; ui.erase = false; ui.sel = null; ui.editing = null; if (done) render(); else { $('pen').classList.add('is-on'); } }
    fill('inkSw', swatch(inks, ui.erase ? null : ui.ink, function (c) { pickInk(c, true); })
      .concat([anyColor(ui.erase ? null : ui.ink, function (c) { pickInk(c, false); }, function (c) { pickInk(c, true); }, inks)]));
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
    $('zoomVal').textContent = e.target.value + '%'; renderSpread(); queueThumb(ui.sp);
  });
  $('zoom').addEventListener('change', persist);
  // Подсказка, если текст в месте шаблона пришлось уменьшить или обрезать
  function textFitHint(t) {
    var val = state.texts[t.id] !== undefined ? state.texts[t.id] : t.text, f = Z.fitText(t, val);
    $('txtFit').hidden = !(f.small || f.cut);
    $('txtFit').textContent = f.cut ? 'Текст не помещается в это место, конец обрезан. Сократи его или очисти страницу и добавь свой текст.' : 'Текст длиннее, чем в шаблоне, поэтому он стал мельче, чтобы поместиться.';
  }
  $('txt').addEventListener('input', function (e) { if (!ui.sel) return; state.texts[ui.sel.id] = e.target.value; persist(); renderSpread(); renderThumbsAndProgress(); var it = item(); if (it) textFitHint(it); });
  $('hideDecor').addEventListener('click', function () { if (!ui.sel) return; var cur = state.decor[ui.sel.id] || {}; state.decor[ui.sel.id] = Object.assign({}, cur, { hidden: true }); ui.sel = null; persist(); render(); });
  $('showDecor').addEventListener('click', function () {
    Z.SPREADS[ui.sp].forEach(function (pg) { D.pages[pg].decor.forEach(function (d) { if (state.decor[d.id]) delete state.decor[d.id].hidden; }); });
    persist(); render();
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-reset]'), function (b) {
    b.addEventListener('click', function () {
      if (!ui.sel) return;
      if (ui.sel.kind === 'photo') delete state.photos[ui.sel.id];
      if (ui.sel.kind === 'text') { delete state.texts[ui.sel.id]; delete state.textColors[ui.sel.id]; $('txt').value = item().text; }
      persist(); render();
    });
  });
  // ---------- верх панели и «добавить» ----------
  $('clearBtn').addEventListener('click', function () {
    var F = freeOf(ui.page); F.cleared = !F.cleared;
    if (ui.sel && ui.sel.page === ui.page && ui.sel.kind !== 'free' && ui.sel.kind !== 'page') ui.sel = null;
    if (F.cleared) $('accAdd').open = true;
    persist(); render();
  });
  $('selClose').addEventListener('click', function () { select(null); });
  $('addTextBtn').addEventListener('click', function () { addText(ui.page); });
  $('addImgBtn').addEventListener('click', function () { addTo = ui.page; $('addImg').click(); });

  // ---------- свои элементы: панель ----------
  function curFree() { return ui.sel && ui.sel.kind === 'free' ? item() : null; }
  $('ftxt').addEventListener('input', function (e) { var it = curFree(); if (!it) return; it.text = e.target.value; persist(); renderSpread(); overflowHint(it); });
  $('fSize').addEventListener('input', function (e) { var it = curFree(); if (!it) return; it.size = Number(e.target.value); $('fSizeVal').textContent = it.size + ' px'; renderSpread(); queueThumb(ui.sp); overflowHint(it); });
  $('fSize').addEventListener('change', persist);
  $('fReplace').addEventListener('change', function (e) {
    var it = curFree(), f = e.target.files && e.target.files[0]; e.target.value = ''; if (!it || !f) return;
    readImage(f, function (src, iw, ih) { it.src = src; it.h = Math.round(it.w * ih / iw); persist(); render(); });
  });
  function delFree() {
    var it = curFree(); if (!it) return;
    var F = freeOf(ui.sel.page); F.items = F.items.filter(function (x) { return x !== it; }); ui.sel = null; persist(); render();
  }
  function layer(dir) {
    var it = curFree(); if (!it) return;
    var a = freeOf(ui.sel.page).items, i = a.indexOf(it), j = i + dir; if (j < 0 || j >= a.length) return;
    a[i] = a[j]; a[j] = it; persist(); render();
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-del]'), function (b) { b.addEventListener('click', delFree); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-up]'), function (b) { b.addEventListener('click', function () { layer(1); }); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-down]'), function (b) { b.addEventListener('click', function () { layer(-1); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ui.sel) select(null);
    var typing = /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
    var it = curFree(); if (!it || typing || ui.editing) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delFree(); return; }
    if (e.key === 'Enter' && it.type === 'text') { e.preventDefault(); startEdit(it, ui.sel.page); return; }
    var step = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) { e.preventDefault(); it.x += mv[0]; it.y += mv[1]; persist(); renderSpread(); overflowHint(it); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'в')) {   // дублировать
      e.preventDefault(); var c = JSON.parse(JSON.stringify(it)); c.id = uid(); c.x += 16; c.y += 16;
      freeOf(ui.sel.page).items.push(c); persist(); select('free', c.id, ui.sel.page);
    }
  });

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
  // Открыли сохранённый шаблон начисто: берём его правки как стартовые
  if (window.ZINK_FROM && window.ZINK_MY) {
    ZINK_MY.get(window.ZINK_FROM).then(function (rec) {
      if (!rec || !rec.state) return;
      state = JSON.parse(JSON.stringify(rec.state));
      ['photos', 'texts', 'decor', 'bgs', 'strokes', 'textColors', 'free'].forEach(function (k) { state[k] = state[k] || {}; });
      Z.save(state); render(); [0, 1, 2, 3].forEach(queueThumb);
    });
  }

  // ---------- «Сохранить зин в шаблоны» перед печатью ----------
  var modal = $('saveModal'), nameIn = $('saveName'), okBtn = $('saveOk');
  function openSave(e) {
    e.preventDefault();
    nameIn.value = CUR.name || ''; okBtn.disabled = !nameIn.value.trim();
    modal.hidden = false; setTimeout(function () { nameIn.focus(); nameIn.select(); }, 0);
  }
  function closeSave() { modal.hidden = true; }
  $('toPrint').addEventListener('click', openSave);
  nameIn.addEventListener('input', function () { okBtn.disabled = !nameIn.value.trim(); });
  $('saveClose').addEventListener('click', closeSave);
  $('saveSkip').addEventListener('click', function () { location.href = 'print.html'; });
  modal.addEventListener('pointerdown', function (e) { if (e.target === modal) closeSave(); });
  modal.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeSave(); } });
  $('saveForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = nameIn.value.trim(); if (!name) return;
    okBtn.disabled = true; okBtn.textContent = 'Сохраняю…';
    var c = document.createElement('canvas'); c.width = 700; c.height = Math.round(700 * Z.PAGE_H / (Z.PAGE_W * 2));
    Z.renderSpread(c, 0, state).then(function () {
      var id = 'm' + Date.now().toString(36);
      var meta = { id: id, name: name, t: Z.T, comp: Z.T === 'c' ? (D.comp || null) : null, created: Date.now() };
      return ZINK_MY.add(meta, { id: id, state: JSON.parse(JSON.stringify(state)), thumb: c.toDataURL('image/jpeg', 0.84) });
    }).then(function () { location.href = 'print.html'; }, function () {
      okBtn.disabled = false; okBtn.textContent = 'Сохранить и к печати';
      $('saveNote').hidden = false;
    });
  });

  layout(); render();
  [0, 1, 2, 3].forEach(queueThumb);
  if (document.fonts) document.fonts.ready.then(renderSpread);
})();
