// Главная: 3D-зин, который сам листается: обложка → развороты → задник → закрывается и по кругу.
// Страницы: готовые картинки из js/home-pages.js (1: обложка, 8: задник), поверх рисуется бумага и потёртости.
(function () {
  var scene = document.getElementById('scene');
  var floatEl = document.getElementById('float');
  var zine = document.getElementById('zine');
  var floor = document.getElementById('floor');
  var home = document.getElementById('home');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RATIO = 595 / 842;

  // Листы: лицевая и оборотная страница
  var LEAVES = [[1, 2], [3, 4], [5, 6], [7, 8]];
  var leaves = [], shades = [];
  LEAVES.forEach(function (pair) {
    var leaf = document.createElement('div'); leaf.className = 'leaf';
    var sh = [];
    pair.forEach(function (pg, side) {
      var f = document.createElement('div'); f.className = 'face ' + (side ? 'face--back' : 'face--front');
      var c = document.createElement('canvas'); c.dataset.pg = pg; f.appendChild(c);
      var s = document.createElement('i'); s.className = 'shade'; f.appendChild(s); sh.push(s);
      leaf.appendChild(f);
    });
    var R = rng(pair[0] * 31 + 7);
    leaf._j = { rz: (R() - .5) * 1.8, ty: (R() - .5), tx: (R() - .5) * .6, sc: 0.985 + R() * 0.015 };
    var fr = leaf.children[0], bk = leaf.children[1], cp = outline(pair[0] * 101 + 3, false);
    fr.style.clipPath = cp; bk.style.clipPath = cp.replace(/(-?[\d.]+)% /g, function (m, v) { return (100 - parseFloat(v)).toFixed(2) + '% '; });
    zine.insertBefore(leaf, zine.firstChild); leaves.push(leaf); shades.push(sh);   // обложка последней в DOM: сверху даже до первого кадра
  });

  // ---------- «как в жизни»: бумага, домашняя печать, потёртости ----------
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var PAPER = [241, 237, 228];
  // Поля принтера: у краёв листа A4 домашний принтер не печатает. Какие края страницы были краем листа:
  var MARGINS = { 1: ['b', 'r'], 2: ['b', 'l'], 3: ['b'], 4: ['b'], 5: ['b', 'r'], 6: ['b', 'l'], 7: ['b'], 8: ['b'] };

  var K0 = (PAPER[0] - 26) / 255, K1 = (PAPER[1] - 24) / 255, K2 = (PAPER[2] - 22) / 255, NZT = null;
  function noiseTable() {
    if (!NZT) { var R = rng(99); NZT = new Float32Array(65536); for (var i = 0; i < 65536; i++) NZT[i] = (R() - .5) * 9; }
    return NZT;
  }
  function weather(c, pg, img) {
    var R = rng(pg * 7919 + 13), w = c.width, h = c.height, k = w / 595, x = c.getContext('2d');
    // бумага, а на ней: страница, ужатая внутрь полей принтера (ничего не обрезается)
    x.fillStyle = 'rgb(' + PAPER.join(',') + ')'; x.fillRect(0, 0, w, h);
    var m = { l: 0, r: 0, t: 0, b: 0 };
    MARGINS[pg].forEach(function (e) { m[e] = (e === 'b' ? 0.026 : 0.036) * (0.85 + R() * 0.3); });
    var skew = (R() - .5) * 0.5;                    // лист подался чуть криво
    x.save();
    x.translate(w / 2, h / 2); x.rotate(skew * Math.PI / 180); x.translate(-w / 2, -h / 2);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(img, w * m.l, h * m.t, w * (1 - m.l - m.r), h * (1 - m.t - m.b));
    x.restore();
    // тонер: чёрное не чёрное, белое: цвет бумаги, лёгкий шум и чуть потускневшие цвета
    var im = x.getImageData(0, 0, w, h), d = im.data, NZ = noiseTable(), off = (R() * 4096) | 0;
    for (var i = 0, q = 0; i < d.length; i += 4, q++) {
      var r = d[i], g = d[i + 1], b = d[i + 2], l = (r * .3 + g * .59 + b * .11) * .14;
      var n = NZ[(q + off) & 65535];
      d[i] = 26 + (r * .86 + l) * K0 + n;
      d[i + 1] = 24 + (g * .86 + l) * K1 + n;
      d[i + 2] = 22 + (b * .86 + l) * K2 + n;
    }
    x.putImageData(im, 0, 0);
    // неравномерный свет и следы пальцев
    for (var j = 0; j < 4; j++) {
      var gx = R() * w, gy = R() * h, gr = (0.25 + R() * 0.5) * w;
      var gg = x.createRadialGradient(gx, gy, 0, gx, gy, gr);
      gg.addColorStop(0, 'rgba(110,92,64,' + (0.03 + R() * 0.05) + ')'); gg.addColorStop(1, 'rgba(110,92,64,0)');
      x.globalCompositeOperation = 'multiply'; x.fillStyle = gg; x.fillRect(0, 0, w, h);
    }
    // стёртый тонер у краёв и уголков (только светлее, бумага проступает)
    x.globalCompositeOperation = 'lighten';
    var nRub = Math.round(1400 * k);
    for (j = 0; j < nRub; j++) {
      var side = R(), dist = Math.pow(R(), 3) * 0.06 * w, px, py;
      if (side < .3) { px = R() * w; py = dist; } else if (side < .6) { px = R() * w; py = h - dist; } else { px = w - dist; py = R() * h; }
      x.fillStyle = 'rgba(' + PAPER.join(',') + ',' + (0.25 + R() * 0.6) + ')';
      x.beginPath(); x.ellipse(px, py, (0.4 + R() * 2.2) * k, (0.3 + R() * 1.2) * k, R() * 3.14, 0, 6.29); x.fill();
    }
    // царапины
    for (j = 0; j < 4 + R() * 4; j++) {
      var sx = R() * w, sy = R() * h, a = R() * 6.28, L = (30 + R() * 140) * k;
      x.strokeStyle = 'rgba(255,255,255,' + (0.10 + R() * 0.18) + ')'; x.lineWidth = (0.5 + R() * 0.8) * k;
      x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(sx + Math.cos(a + .3) * L / 2, sy + Math.sin(a + .3) * L / 2, sx + Math.cos(a) * L, sy + Math.sin(a) * L); x.stroke();
    }
    // заломы: светлая линия и тень рядом
    for (j = 0; j < 1 + R() * 2; j++) {
      var y0 = R() * h, y1 = y0 + (R() - .5) * h * .5, x0 = R() < .5 ? 0 : R() * w * .4, x1 = w * (0.6 + R() * 0.4);
      x.globalCompositeOperation = 'multiply'; x.strokeStyle = 'rgba(60,50,40,' + (0.10 + R() * 0.10) + ')'; x.lineWidth = 1.6 * k;
      x.beginPath(); x.moveTo(x0, y0 + 1.2 * k); x.lineTo(x1, y1 + 1.2 * k); x.stroke();
      x.globalCompositeOperation = 'lighten'; x.strokeStyle = 'rgba(255,255,255,' + (0.18 + R() * 0.15) + ')'; x.lineWidth = 1.2 * k;
      x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    }
    // пылинки и волоски
    x.globalCompositeOperation = 'multiply';
    for (j = 0; j < 26; j++) {
      x.fillStyle = 'rgba(70,60,50,' + (0.25 + R() * 0.4) + ')';
      x.beginPath(); x.arc(R() * w, R() * h, (0.3 + R() * 0.9) * k, 0, 6.29); x.fill();
    }
    for (j = 0; j < 2; j++) {
      var hx = R() * w, hy = R() * h, hl = (8 + R() * 18) * k;
      x.strokeStyle = 'rgba(70,60,50,.35)'; x.lineWidth = 0.6 * k;
      x.beginPath(); x.moveTo(hx, hy); x.bezierCurveTo(hx + hl * R(), hy - hl * R(), hx + hl * R(), hy + hl, hx + hl, hy + hl * (R() - .5)); x.stroke();
    }
    // край бумаги чуть темнее
    x.strokeStyle = 'rgba(90,76,58,.16)'; x.lineWidth = 3 * k; x.strokeRect(0, 0, w, h);
    x.globalCompositeOperation = 'source-over';
  }

  // Неровный край: срез ножницами и чуть замятые уголки (корешок ровный)
  function outline(seed, mirror) {
    var R = rng(seed), pts = [], N = 9, J = function (a) { return (R() * a).toFixed(2); };
    var P = function (xx, yy) { pts.push((mirror ? (100 - xx) : xx).toFixed(2) + '% ' + yy + '%'); };
    P(0, 0);
    for (var i = 1; i < N; i++) P(i * 100 / N, J(0.45));
    P(100 - J(0.9), J(0.7));                      // уголок
    for (i = 1; i < N + 3; i++) P(100 - J(0.5), (i * 100 / (N + 3)).toFixed(2));
    P(100 - J(1.1), 100 - J(0.8));                // уголок
    for (i = N - 1; i > 0; i--) P(i * 100 / N, 100 - J(0.45));
    P(0, 100);
    return 'polygon(' + pts.join(',') + ')';
  }

  // ---------- размеры ----------
  var pw = 0, ph = 0;
  function layout() {
    var r = scene.getBoundingClientRect();
    var narrow = window.innerWidth <= 760;
    ph = Math.min(r.height * (narrow ? 0.72 : 0.6), (r.width * (narrow ? 0.92 : 0.74)) / (2 * RATIO));
    pw = ph * RATIO;
    zine.style.width = 2 * pw + 'px'; zine.style.height = ph + 'px';
    zine.style.left = -pw + 'px'; zine.style.top = -ph / 2 + 'px';
    leaves.forEach(function (l) { l.style.width = pw + 'px'; l.style.height = ph + 'px'; });
    floor.style.height = ph * 0.16 + 'px';
  }

  // ---------- страницы ----------
  function paint() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.round(Math.min(1100, Math.max(480, pw * dpr))), h = Math.round(w / RATIO);
    var cs = Array.prototype.slice.call(zine.querySelectorAll('canvas'))
      .sort(function (a, b) { return a.dataset.pg - b.dataset.pg; });   // сначала обложка
    // по одной странице за кадр: чтобы главная не замирала при загрузке
    (function next(i) {
      if (i >= cs.length) return;
      if (i === 1) { zine.classList.add('is-ready'); scene.classList.add('is-ready'); t0 = performance.now(); }   // обложка готова: показываем и запускаем
      var c = cs[i], pg = Number(c.dataset.pg), img = new Image();
      c.width = w; c.height = h;
      img.onload = function () { weather(c, pg, img); requestAnimationFrame(function () { next(i + 1); }); };
      img.onerror = function () { next(i + 1); };
      img.src = window.ZINK_HOME[pg];
    })(0);
  }

  // ---------- сценарий листания ----------
  var H0 = 0.35, F = 1.25, H = 1.7, HEND = 1.3, CLOSE = 1.1, STAG = 0.16;
  var TC = H0 + 4 * F + 3 * H + HEND;
  var LOOP = TC + 3 * STAG + CLOSE + 0.3;
  function ease(x) { x = Math.max(0, Math.min(1, x)); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function flipAt(i, t) {
    var start = H0 + i * (F + H);
    if (t < TC) return ease((t - start) / F);
    var cs = TC + (3 - i) * STAG;
    return 1 - ease((t - cs) / CLOSE);
  }

  // ---------- мышь ----------
  var mx = 0, my = 0, tx = 0, ty = 0;
  home.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    tx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - 0.5) * 2));
    ty = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight - 0.5) * 2));
  });
  home.addEventListener('pointerleave', function () { tx = 0; ty = 0; });

  // ---------- кадр ----------
  var t0 = null, last = new Map();
  function set(el, prop, val) { var k = last.get(el) || {}; if (k[prop] !== val) { k[prop] = val; last.set(el, k); el.style[prop] = val; } }
  function frame(now) {
    // часы идут только с момента, когда зин показан: до этого он стоит закрытым и неподвижным
    var T = t0 === null ? 0 : (now - t0) / 1000, t = T % LOOP;
    var a = reduce ? [1, 0, 0, 0] : [0, 1, 2, 3].map(function (i) { return flipAt(i, t); });
    if (!reduce && t0 !== null) { mx += (tx - mx) * 0.06; my += (ty - my) * 0.06; }

    // листы: угол, толщина стопки, тень при перевороте
    var step = Math.max(1, pw * 0.004);
    a.forEach(function (v, i) {
      var dz = v < 0.5 ? (4 - i) * step : -(i + 1) * step;
      // страницы не лежат плашмя: верхние в стопке чуть приподняты, как у настоящего сложенного листа
      var liftR = 1.2 + (3 - i) * 1.3, liftL = 1.2 + i * 1.3;
      var ang = -(liftR + (180 - liftL - liftR) * v), J = leaves[i]._j;
      set(leaves[i], 'transform', 'rotateY(' + ang.toFixed(2) + 'deg) translateZ(' + dz.toFixed(2) + 'px) translate(' + (J.tx * ph * .01).toFixed(2) + 'px,' + (J.ty * ph * .014).toFixed(2) + 'px) rotateZ(' + J.rz.toFixed(2) + 'deg) scale(' + J.sc.toFixed(3) + ')');
      set(leaves[i], 'zIndex', String(v < 0.5 ? 10 - i : 10 + i));   // подстраховка для Safari: порядок стопки и без 3D-сортировки
      var s = (Math.sin(Math.PI * v) * 0.9).toFixed(3);
      set(shades[i][0], 'opacity', s); set(shades[i][1], 'opacity', s);
    });

    // закрытый зин стоит по центру, открытый: разворотом по центру, задник: снова по центру
    var shift = pw / 2 * (a[3] - (1 - a[0]));
    zine.style.transform = 'translateX(' + shift.toFixed(2) + 'px)';

    // парит и поворачивается за мышкой
    var fy = reduce ? 0 : Math.sin(T * 0.9) * ph * 0.018;
    var rx = 20 - my * 7 + (reduce ? 0 : Math.sin(T * 0.5) * 1.5);
    var ry = -10 + mx * 14 + (reduce ? 0 : Math.sin(T * 0.37) * 3);
    var rz = 2 + (reduce ? 0 : Math.sin(T * 0.6) * 1);
    floatEl.style.transform = 'translateY(' + fy.toFixed(2) + 'px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg)';

    // тень на полу: ширина по видимой части зина
    var open = Math.min(a[0], 1 - a[3]);
    var fw = pw * (1.15 + open) * (1 - fy / ph * 0.6);
    floor.style.width = fw.toFixed(1) + 'px';
    floor.style.transform = 'translate(' + (-fw / 2 + shift * 0.85 - mx * 24).toFixed(1) + 'px, ' + (ph * 0.5 + ph * 0.06).toFixed(1) + 'px)';
    floor.style.opacity = (0.85 - fy / ph * 4).toFixed(3);

    if (!reduce) requestAnimationFrame(frame);
  }

  layout();
  window.addEventListener('resize', layout);
  frame(performance.now());   // сразу ставим листы по местам, ещё до загрузки страниц
  paint();
})();
