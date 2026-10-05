/* ChiActive site-wide 3D feel: pointer tilt with a light glare on cards, tiles,
   product galleries and anything marked data-tilt. Off for touch and reduced motion. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var SEL = '[data-tilt], .product-card, .tile, .post-card, .gallery-main, .product-detail .gallery > img, .aside-card';
  document.querySelectorAll(SEL).forEach(function (el) {
    if (el.closest('.ring')) return;
    el.classList.add('fx-tilt');
    var max = el.matches('.gallery-main, .gallery > img') ? 6 : (el.matches('.idcard') ? 14 : 9);
    var raf = null, tx = 0, ty = 0, cx = 0, cy = 0, inside = false;
    function step() {
      cx += (tx - cx) * .18; cy += (ty - cy) * .18;
      if (!el.classList.contains('flipped')) el.style.transform = 'perspective(900px) rotateX(' + (-cy * max).toFixed(2) + 'deg) rotateY(' + (cx * max).toFixed(2) + 'deg)' + (inside ? ' translateZ(10px)' : '');
      el.style.setProperty('--gx', (50 + cx * 50) + '%'); el.style.setProperty('--gy', (50 + cy * 50) + '%');
      el.style.setProperty('--shine', (cx * 80) + '%');
      raf = (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002) ? requestAnimationFrame(step) : null;
      if (!raf && !inside) el.style.transform = '';
    }
    el.addEventListener('pointermove', function (e) {
      var b = el.getBoundingClientRect();
      tx = (e.clientX - b.left) / b.width - .5; ty = (e.clientY - b.top) / b.height - .5; tx *= 2; ty *= 2;
      inside = true; el.classList.add('fx-on'); if (!raf) raf = requestAnimationFrame(step);
    });
    el.addEventListener('pointerleave', function () { tx = ty = 0; inside = false; el.classList.remove('fx-on'); if (!raf) raf = requestAnimationFrame(step); });
  });
})();
