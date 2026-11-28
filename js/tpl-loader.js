// Какой зин открыт: основной шаблон (?t=1, ?t=2), свой из страниц (?t=c) или сохранённый (?m=id).
// ?new=1: открыть начисто: так основные шаблоны не тянут за собой прошлые правки.
(function () {
  var q = location.search, get = function (k) { var m = q.match(new RegExp('[?&]' + k + '=([\\w-]+)')); return m ? m[1] : null; };
  var t = get('t'), mid = get('m'), isNew = get('new') === '1', cur = null;
  try { cur = JSON.parse(localStorage.getItem('zink-cur')); } catch (e) {}
  if (mid) {
    var meta = null;
    try { meta = (JSON.parse(localStorage.getItem('zink-my-index')) || []).filter(function (x) { return x.id === mid; })[0]; } catch (e) {}
    if (meta) cur = { t: meta.t, key: 'm:' + mid, m: mid, comp: meta.comp || null, name: meta.name };
  } else if (t) cur = { t: t, key: 't' + t };
  if (!cur || !/^(1|2|c)$/.test(cur.t)) cur = { t: '1', key: 't1' };
  try {
    localStorage.setItem('zink-cur', JSON.stringify(cur));
    ['zink-tpl', 'zink-tpl1-v1', 'zink-tpl2-v1', 'zink-tplc-v1'].forEach(function (k) { localStorage.removeItem(k); });   // старые сохранения
    if (isNew) localStorage.removeItem('zink-draft-v2');
  } catch (e) {}
  if (isNew) { window.ZINK_FROM = cur.m || null; try { history.replaceState(null, '', location.pathname); } catch (e) {} }
  window.ZINK_T = cur.t; window.ZINK_KEY = cur.key; window.ZINK_CUR = cur;
  if (cur.comp) window.ZINK_COMP = cur.comp;
  var files = cur.t === 'c' ? ['tpl1-data', 'tpl2-data', 'tpl-custom'] : ['tpl' + cur.t + '-data'];
  files.forEach(function (f) { document.write('<script src="js/' + f + '.js"><\/script>'); });
})();
