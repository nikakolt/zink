// Главная: книжка подстраивается под окно и слегка наклоняется за мышкой
(function () {
  var book = document.getElementById('book');
  var shadow = document.getElementById('shadow');
  var light = document.getElementById('light');
  var home = document.getElementById('home');
  var mx = 0, my = 0, last = 0;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function scale() {
    return Math.max(0.4, Math.min(1.06, (window.innerHeight - 130) / 720, (window.innerWidth - 80) / 1100));
  }
  function render() {
    var rx = 6 - my * 7, ry = mx * 10, rz = mx * 0.8;
    book.style.transform = 'scale(' + scale().toFixed(3) + ') rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg)';
    shadow.style.transform = 'translate(' + (-mx * 28).toFixed(1) + 'px, ' + (my * 10).toFixed(1) + 'px) scaleX(' + (1 - Math.abs(mx) * 0.06).toFixed(3) + ')';
    light.style.background = 'radial-gradient(ellipse 60% 70% at ' + (50 + mx * 30).toFixed(1) + '% ' + (30 + my * 25).toFixed(1) + '%, rgba(255,255,255,.12), rgba(255,255,255,0) 70%)';
  }
  home.addEventListener('pointermove', function (e) {
    if (reduce || e.pointerType === 'touch') return;
    var now = Date.now(); if (now - last < 40) return; last = now;
    mx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - 0.5) * 2));
    my = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight - 0.5) * 2));
    render();
  });
  home.addEventListener('pointerleave', function () { mx = 0; my = 0; render(); });
  window.addEventListener('resize', render);
  render();
})();
