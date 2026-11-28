// ZINK · общее для редактора и печати: состояние зина, отрисовка страниц, карандаш, PDF
(function () {
  var T = window.ZINK_T || '1';
  var DATA = window['ZINK_TPL' + T] || window.ZINK_TPL1;
  var PAGE_W = 595, PAGE_H = 842;                 // страница в единицах макета (A7 на листе A4)
  var SPREADS = [[8, 1], [2, 3], [4, 5], [6, 7]];   // развороты: слева/справа
  // Какие края страницы: это край листа A4 (верхний ряд на листе перевёрнут). Здесь печать без полей может срезать
  var SHEET_EDGES = { 1: ['b', 'r'], 2: ['b', 'l'], 3: ['b'], 4: ['b'], 5: ['b', 'r'], 6: ['b', 'l'], 7: ['b'], 8: ['b'] };
  var SAFE = 40;   // 5 мм в единицах страницы (страница 74,25 мм = 595)
  var KEY = window.ZINK_KEY || ('t' + T), DRAFT = 'zink-draft-v2';   // черновик открытого зина: один на всех, с ключом шаблона

  var PAL = [
    { name: 'Синий', c: '#0026A9' }, { name: 'Жёлтый', c: '#F8F40A' }, { name: 'Зелёный', c: '#88A48A' },
    { name: 'Чёрный', c: '#000000' }, { name: 'Белый', c: '#FFFFFF' }, { name: 'Красный', c: '#D9443F' }
  ];
  var INKS = [{ name: 'Графит', c: '#46464A' }, { name: 'Синий', c: '#0026A9' }, { name: 'Белый', c: '#FFFFFF' }, { name: 'Красный', c: '#D9443F' }];

  // Шрифты шаблона: заголовок: узкий жирный гротеск, остальное: моноширинный
  var FONTS = {
    head: { family: "'PT Sans Narrow', 'Arial Narrow', sans-serif", weight: 700, size: 66, lh: 66 * 1.05, ls: 0.02, wrap: false },
    mono: { family: "'PT Mono', 'Courier New', monospace", weight: 400, size: 24, lh: 31, ls: 0, wrap: true }
  };
  // У шаблона могут быть свои шрифты и палитра
  if (DATA.fonts) Object.keys(DATA.fonts).forEach(function (k) { FONTS[k] = DATA.fonts[k]; });
  if (DATA.pal) PAL = DATA.pal;

  function emptyState() { return { photos: {}, texts: {}, decor: {}, bgs: {}, strokes: {}, textColors: {}, free: {} }; }
  function load() {
    try { var d = JSON.parse(localStorage.getItem(DRAFT)); if (d && d.key === KEY && d.state && d.state.photos) return d.state; } catch (e) {}
    return emptyState();
  }
  function save(state) {
    try { localStorage.setItem(DRAFT, JSON.stringify({ key: KEY, state: state })); return true; } catch (e) { return false; }
  }
  function reset() { try { localStorage.removeItem(DRAFT); } catch (e) {} }

  // Сколько мест заполнено своим
  function progress(state) {
    var total = 0, done = 0, left = {};
    Object.keys(DATA.pages).forEach(function (pg) {
      var P = DATA.pages[pg];
      if (((state.free || {})[pg] || {}).cleared) return;   // очищенная страница: места шаблона не считаем
      P.photos.forEach(function (ph) { total++; if (state.photos[ph.id] && state.photos[ph.id].user) done++; else left[pg] = (left[pg] || 0) + 1; });
      P.texts.forEach(function (t) { total++; if (state.texts[t.id] !== undefined && state.texts[t.id] !== t.text) done++; else left[pg] = (left[pg] || 0) + 1; });
    });
    return { total: total, done: done, left: left };
  }

  // Геометрия фото внутри рамки: «cover» + масштаб + сдвиг, сдвиг не даёт открыть пустые края
  function photoBox(ph, st) {
    st = st || {};
    var iw = st.iw || ph.w, ih = st.ih || ph.h, k = st.k || 1;
    var cs = Math.max(ph.w / iw, ph.h / ih) * k;
    var bw = iw * cs, bh = ih * cs, mx = (bw - ph.w) / 2, my = (bh - ph.h) / 2;
    var ox = Math.max(-mx, Math.min(mx, st.ox || 0)), oy = Math.max(-my, Math.min(my, st.oy || 0));
    return { bw: bw, bh: bh, x: (ph.w - bw) / 2 + ox, y: (ph.h - bh) / 2 + oy, ox: ox, oy: oy };
  }

  // Карандаш: несколько тонких полупрозрачных проходов с дрожанием и разрывами
  function jitter(pts, k, amp) {
    return pts.map(function (q, i) {
      return [q[0] + Math.sin(i * 1.7 + k * 3.1) * amp + Math.sin(i * 0.37 + k) * amp * 0.6,
              q[1] + Math.cos(i * 1.3 + k * 2.3) * amp + Math.cos(i * 0.41 + k) * amp * 0.6];
    });
  }
  var PENCIL = [
    { k: 0, amp: 0, w: 3, o: 0.14, dash: null },
    { k: 1, amp: 0.8, w: 1.5, o: 0.68, dash: [5, 1.6, 1.5, 2.2, 0.8, 3] },
    { k: 2, amp: 1.2, w: 1.2, o: 0.52, dash: [2.5, 2.6, 1, 1.8, 3, 1.2] },
    { k: 3, amp: 0.6, w: 0.9, o: 0.45, dash: [0.8, 3.2, 2.5, 2] },
    { k: 4, amp: 1.6, w: 2.2, o: 0.2, dash: [1, 3, 0.6, 4] }
  ];
  function pathD(pts) { return 'M' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' L'); }
  function pencilSvg(stroke) {
    return PENCIL.map(function (p) {
      var pts = p.amp ? jitter(stroke.pts, p.k, p.amp) : stroke.pts;
      return '<path d="' + pathD(pts) + '" fill="none" stroke="' + stroke.c + '" stroke-width="' + p.w + '" stroke-opacity="' + p.o + '"' +
        (p.dash ? ' stroke-dasharray="' + p.dash.join(' ') + '"' : '') + ' stroke-linecap="round" stroke-linejoin="round"/>';
    }).join('');
  }
  function pencilCanvas(ctx, stroke) {
    PENCIL.forEach(function (p) {
      var pts = p.amp ? jitter(stroke.pts, p.k, p.amp) : stroke.pts;
      ctx.save();
      ctx.globalAlpha = p.o; ctx.strokeStyle = stroke.c; ctx.lineWidth = p.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.setLineDash(p.dash || []);
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke(); ctx.restore();
    });
  }

  // Перенос строк как в редакторе (pre-wrap для моноширинного, без переноса для заголовка)
  function lines(ctx, text, maxW, wrap) {
    var out = [];
    String(text).split('\n').forEach(function (para) {
      if (!wrap) { out.push(para); return; }
      var words = para.split(' '), cur = '';
      words.forEach(function (w) {
        var t = cur ? cur + ' ' + w : w;
        if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { out.push(cur); cur = w; }
      });
      out.push(cur);
    });
    return out;
  }

  // Подгонка текста: свой текст занимает не больше строк, чем текст шаблона в этом месте.
  // Если не помещается: кегль плавно уменьшается (до 60%), слова не рвутся посередине.
  var fitCtx = null, fitCache = {};
  function setFont(ctx, F, size) {
    ctx.font = F.weight + ' ' + size + 'px ' + F.family;
    if ('letterSpacing' in ctx) ctx.letterSpacing = (F.ls * size) + 'px';
  }
  function fitText(t, val) {
    var key = t.id + '\u0001' + val;
    if (fitCache[key]) return fitCache[key];
    var F = FONTS[t.style], maxW = t.w - 12;
    if (!fitCtx) fitCtx = document.createElement('canvas').getContext('2d');
    var ctx = fitCtx;
    setFont(ctx, F, F.size);
    var budget = Math.max(1, lines(ctx, t.text, maxW, F.wrap).length);
    var res = null;
    for (var s = 1; s >= 0.4 - 1e-9; s -= 0.02) {
      var size = F.size * s;
      setFont(ctx, F, size);
      var ls = lines(ctx, val, maxW, F.wrap);
      var wide = ls.some(function (ln) { return ctx.measureText(ln).width > maxW + 0.5; });
      // сколько строк влезает по высоте при этом кегле (мелкий кегль: больше строк в том же месте)
      var cap = Math.max(budget, Math.floor(budget / s + 1e-6));
      res = { size: size, lh: F.lh * s, lines: ls, small: s < 0.999 };
      if (ls.length <= cap && !wide) break;
    }
    // Совсем не влезает: лишнее обрезается, чтобы текст не уезжал за своё место
    var capEnd = Math.max(budget, Math.floor(budget / (res.size / F.size) + 1e-6));
    if (res.lines.length > capEnd) {
      res.lines = res.lines.slice(0, capEnd);
      res.lines[capEnd - 1] = res.lines[capEnd - 1].replace(/\s*\S*$/, '') + '…';
      res.cut = true;
    }
    if (!document.fonts || document.fonts.status === 'loaded') fitCache[key] = res;   // пока шрифты грузятся: не запоминаем
    return res;
  }

  // Свои тексты на странице: три шрифта на выбор
  var FREE_FONTS = {
    sans: { family: "Helvetica, 'Helvetica Neue', Arial, sans-serif", weight: 400, name: 'Гротеск' },
    mono: { family: "'PT Mono', 'Courier New', monospace", weight: 400, name: 'Машинка' },
    narrow: { family: "'PT Sans Narrow', 'Arial Narrow', sans-serif", weight: 700, name: 'Узкий' }
  };
  function freeLayout(it) {
    if (!fitCtx) fitCtx = document.createElement('canvas').getContext('2d');
    var F = FREE_FONTS[it.font] || FREE_FONTS.sans, ctx = fitCtx;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    // Как в Фигме: ширина задана, высота растёт по тексту, кегль не меняется сам
    var size = it.size;
    ctx.font = F.weight + ' ' + size + 'px ' + F.family;
    var ls = lines(ctx, it.text === '' ? ' ' : it.text, it.w, true), lh = size * 1.2;
    return { lines: ls, lh: lh, h: Math.max(1, ls.length) * lh, F: F, size: size };
  }
  function drawFree(ctx, it, img) {
    if (it.type === 'img') { if (img) ctx.drawImage(img, it.x, it.y, it.w, it.h); return; }
    var L = freeLayout(it);
    ctx.save();
    ctx.font = L.F.weight + ' ' + L.size + 'px ' + L.F.family;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillStyle = it.color; ctx.textBaseline = 'alphabetic';
    L.lines.forEach(function (ln, i) {
      var w = ctx.measureText(ln).width;
      var x = it.x + (it.align === 'right' ? it.w - w : it.align === 'center' ? (it.w - w) / 2 : 0);
      ctx.fillText(ln, x, it.y + i * L.lh + L.lh / 2 + 0.347 * L.size);
    });
    ctx.restore();
  }

  var imgCache = {};
  function loadImg(src) {
    if (!imgCache[src]) imgCache[src] = new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
    return imgCache[src];
  }

  // Отрисовка одной страницы на canvas в координатах страницы (595×842)
  function drawPage(ctx, pg, state) {
    var P = DATA.pages[pg];
    // Очищенная страница: от шаблона остаётся только фон-цвет, дальше: свои тексты и фото
    var FR = (state.free || {})[pg] || {}, clear = !!FR.cleared, items = FR.items || [];
    var photos = clear ? [] : P.photos, decor = clear ? [] : P.decor, texts = clear ? [] : P.texts;
    var jobs = [];
    photos.forEach(function (ph) { var st = state.photos[ph.id] || {}; jobs.push(loadImg(st.src || ph.src)); });
    decor.forEach(function (d) { jobs.push(loadImg(d.mask)); });
    var useBgImg = !clear && P.bgImg && !state.bgs[pg], bgAt = jobs.length;
    if (useBgImg) jobs.push(loadImg(P.bgImg));
    var freeAt = jobs.length;
    items.forEach(function (it) { jobs.push(it.type === 'img' ? loadImg(it.src) : Promise.resolve(null)); });
    return Promise.all(jobs).then(function (imgs) {
      var n = 0;
      ctx.fillStyle = state.bgs[pg] || (clear ? '#FFFFFF' : P.bg); ctx.fillRect(0, 0, PAGE_W, PAGE_H);
      if (useBgImg) ctx.drawImage(imgs[bgAt], 0, 0, PAGE_W, PAGE_H);   // фон-бумага шаблона
      photos.forEach(function (ph) {
        var img = imgs[n++], st = state.photos[ph.id] || {}, b = photoBox(ph, st);
        ctx.save();
        if (ph.rot) { var cx = ph.x + ph.w / 2, cy = ph.y + ph.h / 2; ctx.translate(cx, cy); ctx.rotate(ph.rot * Math.PI / 180); ctx.translate(-cx, -cy); }
        ctx.beginPath(); ctx.rect(ph.x, ph.y, ph.w, ph.h); ctx.clip();
        ctx.drawImage(img, ph.x + b.x, ph.y + b.y, b.bw, b.bh); ctx.restore();
      });
      decor.forEach(function (d) {
        var img = imgs[n++], st = state.decor[d.id] || {};
        if (st.hidden) return;
        var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        var x = c.getContext('2d'); x.fillStyle = st.color || d.color; x.fillRect(0, 0, c.width, c.height);
        x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
        ctx.drawImage(c, d.x, d.y, d.w, d.h);
      });
      texts.forEach(function (t) {
        var F = FONTS[t.style], val = state.texts[t.id] !== undefined ? state.texts[t.id] : t.text;
        ctx.save();
        if (t.rot) { ctx.translate(t.x, t.y); ctx.rotate(t.rot * Math.PI / 180); ctx.translate(-t.x, -t.y); }
        var fit = fitText(t, val), sc = fit.size / F.size;
        setFont(ctx, F, fit.size);
        ctx.fillStyle = (state.textColors || {})[t.id] || t.color; ctx.textBaseline = F.bl ? 'alphabetic' : 'middle';
        var maxW = t.w - 12;
        fit.lines.forEach(function (ln, i) {
          var w = ctx.measureText(ln).width;
          var x = t.x + 6 + (t.align === 'right' ? maxW - w : t.align === 'center' ? (maxW - w) / 2 : 0);
          var y = F.bl ? t.y + 4 + fit.lh * i + F.bl * sc : t.y + 4 + fit.lh * i + fit.lh / 2;
          ctx.fillText(ln, x, y);
        });
        ctx.restore();
      });
      items.forEach(function (it, k) { drawFree(ctx, it, imgs[freeAt + k]); });   // свои элементы: поверх шаблона
    });
  }

  // Подпись от руки хранится по разворотам: рисуем свою половину на странице
  function drawStrokesOnPage(ctx, pg, state) {
    SPREADS.forEach(function (sp, i) {
      var side = sp.indexOf(Number(pg)); if (side < 0) return;
      (state.strokes['s' + i] || []).forEach(function (st) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, PAGE_W, PAGE_H); ctx.clip(); ctx.translate(-side * PAGE_W, 0);
        pencilCanvas(ctx, st); ctx.restore();
      });
    });
  }

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([document.fonts.load("700 66px 'PT Sans Narrow'"), document.fonts.load("400 24px 'PT Mono'")]).catch(function () {});
  }

  // Лист A4 (альбомный): верхний ряд 5-4-3-2 перевёрнут, нижний 6-7-8-1, линии сгибов и надреза
  function renderSheet(canvas, state, opts) {
    opts = opts || {};
    var k = canvas.width / (PAGE_W * 4);
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    var order = [[5, 0, 0, true], [4, 1, 0, true], [3, 2, 0, true], [2, 3, 0, true], [6, 0, 1, false], [7, 1, 1, false], [8, 2, 1, false], [1, 3, 1, false]];
    return fontsReady().then(function () {
      return order.reduce(function (p, o) {
        return p.then(function () {
          ctx.save();
          ctx.scale(k, k);
          ctx.translate(o[1] * PAGE_W, o[2] * PAGE_H);
          if (o[3]) { ctx.translate(PAGE_W, PAGE_H); ctx.rotate(Math.PI); }
          return drawPage(ctx, o[0], state).then(function () { drawStrokesOnPage(ctx, o[0], state); ctx.restore(); });
        });
      }, Promise.resolve());
    }).then(function () {
      if (!opts.guides) return;
      ctx.save(); ctx.scale(k, k);
      ctx.strokeStyle = 'rgba(120,116,110,.8)'; ctx.lineWidth = 2; ctx.setLineDash([14, 11]);
      [1, 2, 3].forEach(function (i) { ctx.beginPath(); ctx.moveTo(i * PAGE_W, 0); ctx.lineTo(i * PAGE_W, PAGE_H * 2); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(0, PAGE_H); ctx.lineTo(PAGE_W, PAGE_H); ctx.moveTo(3 * PAGE_W, PAGE_H); ctx.lineTo(4 * PAGE_W, PAGE_H); ctx.stroke();
      ctx.setLineDash([]); ctx.strokeStyle = '#D9443F'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(PAGE_W, PAGE_H); ctx.lineTo(3 * PAGE_W, PAGE_H); ctx.stroke();
      ctx.restore();
    });
  }

  // Один разворот (две страницы рядом): для живых миниатюр в редакторе
  function renderSpread(canvas, i, state) {
    var k = canvas.width / (PAGE_W * 2);
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    return fontsReady().then(function () {
      return SPREADS[i].reduce(function (p, pg, side) {
        return p.then(function () {
          ctx.save(); ctx.scale(k, k); ctx.translate(side * PAGE_W, 0);
          return drawPage(ctx, pg, state).then(function () { drawStrokesOnPage(ctx, pg, state); ctx.restore(); });
        });
      }, Promise.resolve());
    });
  }

  // Одна страница целиком: для 3D-зина на главной
  function renderPage(canvas, pg, state) {
    var k = canvas.width / PAGE_W, ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    return fontsReady().then(function () {
      ctx.save(); ctx.scale(k, k);
      return drawPage(ctx, pg, state).then(function () { drawStrokesOnPage(ctx, pg, state); ctx.restore(); });
    });
  }

  // Минимальный PDF: одна страница A4 альбомная с JPEG на весь лист
  function pdfFromJpeg(dataUrl, wPx, hPx) {
    var bin = atob(dataUrl.split(',')[1]);
    var img = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) img[i] = bin.charCodeAt(i);
    var W = 841.89, H = 595.28;
    var enc = function (s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
    var content = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q';
    var parts = [], offsets = [], size = 0;
    function push(x) { var b = typeof x === 'string' ? enc(x) : x; parts.push(b); size += b.length; }
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    function obj(n, body) { offsets[n] = size; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); }
    obj(1, function () { push('<< /Type /Catalog /Pages 2 0 R >>'); });
    obj(2, function () { push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'); });
    obj(3, function () { push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'); });
    obj(4, function () { push('<< /Type /XObject /Subtype /Image /Width ' + wPx + ' /Height ' + hPx + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.length + ' >>\nstream\n'); push(img); push('\nendstream'); });
    obj(5, function () { push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'); });
    var xref = size;
    var x = 'xref\n0 6\n0000000000 65535 f \n';
    for (var n = 1; n <= 5; n++) x += ('0000000000' + offsets[n]).slice(-10) + ' 00000 n \n';
    push(x + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }

  window.ZINK = {
    DATA: DATA, T: T, SHEET_EDGES: SHEET_EDGES, SAFE: SAFE, CUR: window.ZINK_CUR || { t: T, key: KEY }, emptyState: emptyState, SPREADS: SPREADS, PAGE_W: PAGE_W, PAGE_H: PAGE_H, PAL: PAL, INKS: INKS, FONTS: FONTS,
    load: load, save: save, reset: reset, progress: progress, photoBox: photoBox,
    pencilSvg: pencilSvg, renderSheet: renderSheet, renderSpread: renderSpread, renderPage: renderPage, freeLayout: freeLayout, FREE_FONTS: FREE_FONTS, fitText: fitText, pdfFromJpeg: pdfFromJpeg, fontsReady: fontsReady
  };
})();
