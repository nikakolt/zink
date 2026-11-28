// Мои шаблоны: зины, сохранённые перед печатью. Список: в памяти браузера (лёгкий),
// сами правки и превью: в IndexedDB, где места намного больше, чем в localStorage.
window.ZINK_MY = (function () {
  var IDX = 'zink-my-index', DB = 'zink', ST = 'my';
  function index() { try { return JSON.parse(localStorage.getItem(IDX)) || []; } catch (e) { return []; } }
  function setIndex(a) { localStorage.setItem(IDX, JSON.stringify(a)); }
  var dbp = null;
  function db() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no idb'));
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST, { keyPath: 'id' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function req(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(ST, mode), r = fn(t.objectStore(ST));
        t.oncomplete = function () { res(r && r.result); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  // запасной вариант, если браузер не даёт IndexedDB (например, Safari при открытии файла с диска)
  function lsKey(id) { return 'zink-my-' + id; }
  function put(rec) {
    return req('readwrite', function (s) { return s.put(rec); })
      .catch(function () { localStorage.setItem(lsKey(rec.id), JSON.stringify(rec)); });
  }
  function get(id) {
    return req('readonly', function (s) { return s.get(id); })
      .then(function (r) { return r || JSON.parse(localStorage.getItem(lsKey(id)) || 'null'); })
      .catch(function () { return JSON.parse(localStorage.getItem(lsKey(id)) || 'null'); });
  }
  function del(id) {
    setIndex(index().filter(function (m) { return m.id !== id; }));
    try { localStorage.removeItem(lsKey(id)); } catch (e) {}
    return req('readwrite', function (s) { return s.delete(id); }).catch(function () {});
  }
  function add(meta, rec) {
    return put(rec).then(function () { var a = index(); a.unshift(meta); setIndex(a); return meta; });
  }
  return { index: index, get: get, add: add, del: del };
})();
