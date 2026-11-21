// ZINK — общее для редактора и печати: состояние зина, отрисовка страниц, карандаш, PDF
(function () {
  var DATA = window.ZINK_TPL1;
  var PAGE_W = 595, PAGE_H = 842;                 // страница в единицах макета (A7 на листе A4)
  var SPREADS = [[8, 1], [2, 3], [4, 5], [6, 7]];   // развороты: слева/справа
  var STORE = 'zink-tpl1-v1';

  var PAL = [
    { name: 'Синий', c: '#0026A9' }, { name: 'Жёлтый', c: '#F8F40A' }, { name: 'Зелёный', c: '#88A48A' },
    { name: 'Чёрный', c: '#000000' }, { name: 'Белый', c: '#FFFFFF' }, { name: 'Красный', c: '#D9443F' }
  ];
  var INKS = [{ name: 'Графит', c: '#46464A' }, { name: 'Синий', c: '#0026A9' }, { name: 'Белый', c: '#FFFFFF' }, { name: 'Красный', c: '#D9443F' }];

  // Шрифты шаблона: заголовок — узкий жирный гротеск, остальное — моноширинный
  var FONTS = {
    head: { family: "'PT Sans Narrow', 'Arial Narrow', sans-serif", weight: 700, size: 66, lh: 66 * 1.05, ls: 0.02, wrap: false },
    mono: { family: "'PT Mono', 'Courier New', monospace", weight: 400, size: 24, lh: 31, ls: 0, wrap: true }
  };

  function emptyState() { return { photos: {}, texts: {}, decor: {}, bgs: {}, strokes: {} }; }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE)); if (s && s.photos) return s; } catch (e) {}
    return emptyState();
  }
  function save(state) {
    try { localStorage.setItem(STORE, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  function reset() { try { localStorage.removeItem(STORE); } catch (e) {} }

  // Сколько мест заполнено своим
  function progress(state) {
    var total = 0, done = 0, left = {};
    Object.keys(DATA.pages).forEach(function (pg) {
      var P = DATA.pages[pg];
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

  var imgCache = {};
  function loadImg(src) {
    if (!imgCache[src]) imgCache[src] = new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
    return imgCache[src];
  }

  // Отрисовка одной страницы на canvas в координатах страницы (595×842)
  function drawPage(ctx, pg, state) {
    var P = DATA.pages[pg];
    var jobs = [];
    P.photos.forEach(function (ph) { var st = state.photos[ph.id] || {}; jobs.push(loadImg(st.src || ph.src)); });
    P.decor.forEach(function (d) { jobs.push(loadImg(d.mask)); });
    return Promise.all(jobs).then(function (imgs) {
      var n = 0;
      ctx.fillStyle = state.bgs[pg] || P.bg; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
      P.photos.forEach(function (ph) {
        var img = imgs[n++], st = state.photos[ph.id] || {}, b = photoBox(ph, st);
        ctx.save(); ctx.beginPath(); ctx.rect(ph.x, ph.y, ph.w, ph.h); ctx.clip();
        ctx.drawImage(img, ph.x + b.x, ph.y + b.y, b.bw, b.bh); ctx.restore();
      });
      P.decor.forEach(function (d) {
        var img = imgs[n++], st = state.decor[d.id] || {};
        if (st.hidden) return;
        var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        var x = c.getContext('2d'); x.fillStyle = st.color || d.color; x.fillRect(0, 0, c.width, c.height);
        x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
        ctx.drawImage(c, d.x, d.y, d.w, d.h);
      });
      P.texts.forEach(function (t) {
        var F = FONTS[t.style], val = state.texts[t.id] !== undefined ? state.texts[t.id] : t.text;
        ctx.save();
        ctx.font = F.weight + ' ' + F.size + 'px ' + F.family;
        if ('letterSpacing' in ctx) ctx.letterSpacing = (F.ls * F.size) + 'px';
        ctx.fillStyle = t.color; ctx.textBaseline = 'middle';
        var maxW = t.w - 12;
        lines(ctx, val, maxW, F.wrap).forEach(function (ln, i) {
          var w = ctx.measureText(ln).width;
          var x = t.x + 6 + (t.align === 'right' ? maxW - w : 0);
          ctx.fillText(ln, x, t.y + 4 + F.lh * i + F.lh / 2);
        });
        ctx.restore();
      });
    });
  }

  // Подпись от руки хранится по разворотам — рисуем свою половину на странице
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
    DATA: DATA, SPREADS: SPREADS, PAGE_W: PAGE_W, PAGE_H: PAGE_H, PAL: PAL, INKS: INKS, FONTS: FONTS,
    load: load, save: save, reset: reset, progress: progress, photoBox: photoBox,
    pencilSvg: pencilSvg, renderSheet: renderSheet, pdfFromJpeg: pdfFromJpeg, fontsReady: fontsReady
  };
})();
