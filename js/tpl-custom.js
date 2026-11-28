// Свой зин: 8 страниц, собранных из страниц готовых шаблонов.
// Состав хранится в браузере как [{t: 2, pg: 1}, …]: по месту на каждую страницу (1: обложка, 8: задник).
// Здесь из него собирается обычный шаблон, поэтому редактор, печать и PDF работают с ним как с любым другим.
(function () {
  var SRC = { 1: window.ZINK_TPL1, 2: window.ZINK_TPL2 };
  var KEY = 'zink-custom-pages';
  var DEF = [1, 2, 3, 4, 5, 6, 7, 8].map(function (pg) { return { t: 2, pg: pg }; });

  function readComp() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(c) && c.length === 8 && c.every(function (x) { return x && SRC[x.t] && SRC[x.t].pages[x.pg]; })) return c;
    } catch (e) {}
    return DEF;
  }
  var comp = window.ZINK_COMP || readComp();   // у сохранённого зина свой состав страниц

  // Цвета первого шаблона живут в zine.js, второго: в его данных; для своего зина берём оба набора без повторов
  var PAL1 = [{ name: 'Синий', c: '#0026A9' }, { name: 'Жёлтый', c: '#F8F40A' }, { name: 'Зелёный', c: '#88A48A' },
    { name: 'Чёрный', c: '#000000' }, { name: 'Белый', c: '#FFFFFF' }, { name: 'Красный', c: '#D9443F' }];
  var pal = [], seenC = {};
  PAL1.concat((SRC[2] && SRC[2].pal) || []).forEach(function (p) { var k = p.c.toUpperCase(); if (!seenC[k]) { seenC[k] = 1; pal.push(p); } });

  var fonts = {}, pages = {}, used = {};
  comp.forEach(function (ref, i) {
    var S = SRC[ref.t], P = S.pages[ref.pg];
    // id мест не зависят от позиции: правки сохраняются при перестановке страниц
    var n = used[ref.t + '-' + ref.pg] = (used[ref.t + '-' + ref.pg] || 0) + 1;
    var pre = 't' + ref.t + 'p' + ref.pg + (n > 1 ? 'x' + n : '') + '-';
    function style(st) {
      if (!S.fonts || !S.fonts[st]) return st;          // шрифты первого шаблона уже есть в zine.js
      var name = 't' + ref.t + '-' + st; fonts[name] = S.fonts[st]; return name;
    }
    function copy(list, extra) { return (list || []).map(function (o) { var c = {}; for (var k in o) c[k] = o[k]; c.id = pre + o.id; if (extra) extra(c, o); return c; }); }
    pages[i + 1] = {
      bg: P.bg, bgImg: P.bgImg,
      photos: copy(P.photos), decor: copy(P.decor),
      texts: copy(P.texts, function (c, o) { c.style = style(o.style); }),
      src: { t: ref.t, pg: ref.pg }
    };
  });

  var blank = 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='10' height='7'><rect width='10' height='7' fill='#FFFFFF'/></svg>");
  window.ZINK_TPLc = { id: 'c', name: 'Свой зин', fonts: fonts, pal: pal.slice(0, 10), pages: pages, spreads: [blank, blank, blank, blank], comp: comp };
})();
