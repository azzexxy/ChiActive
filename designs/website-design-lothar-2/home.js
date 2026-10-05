/* ChiActive homepage interactions: season pick, 3D product ring, lake wind text,
   CTA L map and the student ID card. site.js still owns the bag and the finder. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var IMG = 'images/web/';
  var PRODUCTS = [
    { n: 'Chi Town Puffer Winter Jacket', t: 'Jackets', p: 185, o: 200, img: 'Screenshot-2026-09-16-at-8.30.52-AM.webp', url: 'jackets/chi-town-puffer-winter-jacket.html' },
    { n: 'Green Winter Jacket', t: 'Jackets', p: 64, o: 89, img: 'young-hipster-man-hiking-mountains-winter-vacation-traveling-scaled.webp', url: 'jackets/green-winter-jacket.html' },
    { n: 'ChiActive Snow Boots', t: 'Shoes', p: 94.99, o: 159.99, img: 'Screenshot-2026-09-16-at-8.33.54-AM.webp', url: 'shoes/snow-boots.html' },
    { n: 'ChiActive Trail Cargo Pants', t: 'Pants', p: 25, img: 'd8fe858e-eb62-4d03-a595-571e5113690c.webp', url: 'pants/chiactive-trail-cargo-pants.html', isNew: true },
    { n: 'ChiActive Faux-Fur Aviator Hat', t: 'Accessories', p: 52, img: 'chi-active-aviator-hat-2.webp', url: 'accessories/chiactive-faux-fur-aviator-hat.html' },
    { n: 'ZW Collection Short High-Collar Trench Coat', t: 'Jackets', p: 110, o: 129, img: 'Screenshot-2026-09-16-at-08.26.32.webp', url: 'jackets/zw-collection-short-high-collar-trench-coat.html' },
    { n: 'ChiActive Urban Campus Backpack', t: 'Gear', p: 59.99, img: 'WhatsApp-Image-2026-09-20-at-11.32.42-PM-819x1024.webp', url: 'gear/chiactive-urban-campus-backpack.html' },
    { n: 'Always Effortless Jacket women', t: 'Jackets', p: 118.4, o: 148, img: 'Skarmavbild-2026-09-16-kl.-08.30.03.webp', url: 'jackets/always-effortless-jacket-women.html' }
  ];
  function money(n) { return '$' + n.toFixed(2); }
  function src(n) { var m = window.__CHI_IMG; return (m && m[n]) || IMG + n; }
  function byName(n) { return PRODUCTS.filter(function (p) { return p.n === n; })[0]; }

  /* ---------- Season copy + pick card ---------- */
  var SEASON = {
    winter: { copy: 'Puffers, snow boots and hats for the walk from the Red Line.', pick: 'Chi Town Puffer Winter Jacket' },
    spring: { copy: 'Light jackets that handle the rain and the random snow day.', pick: 'ZW Collection Short High-Collar Trench Coat' },
    summer: { copy: 'Trail cargos and packs for the lakefront, the dunes and beyond.', pick: 'ChiActive Trail Cargo Pants' },
    fall:   { copy: 'Layers you can peel off by noon. Game days, study days, trail days.', pick: 'Green Winter Jacket' }
  };
  var copyEl = document.querySelector('[data-season-copy]'), pick = document.querySelector('.pick');
  var lastSeason = null;
  function onSeason() {
    var s = root.getAttribute('data-season') || 'winter';
    if (s === lastSeason) return; var first = lastSeason === null; lastSeason = s;
    var d = SEASON[s], p = byName(d.pick);
    function fill() {
      copyEl.textContent = d.copy;
      pick.querySelector('[data-pick-season]').textContent = s.charAt(0).toUpperCase() + s.slice(1);
      var img = pick.querySelector('[data-pick-img]'); img.src = src(p.img); img.alt = p.n;
      var a = pick.querySelector('[data-pick-link]'); a.textContent = p.n; a.href = p.url + '?v=8';
      pick.querySelector('[data-pick-old]').textContent = p.o ? money(p.o) : '';
      pick.querySelector('[data-pick-price]').textContent = money(p.p);
      var b = pick.querySelector('[data-pick-add]'); b.setAttribute('data-add', p.n); b.setAttribute('data-price', p.p); b.setAttribute('data-img', src(p.img));
    }
    if (first || reduce) return fill();
    copyEl.classList.add('swap'); pick.classList.add('swap');
    setTimeout(function () { fill(); copyEl.classList.remove('swap'); pick.classList.remove('swap'); }, 260);
  }
  if (copyEl && pick) {
    new MutationObserver(onSeason).observe(root, { attributes: true, attributeFilter: ['data-season'] });
    onSeason();
  }

  /* ---------- 3D product ring ---------- */
  var stage = document.querySelector('[data-ring]');
  if (stage) {
    var track = stage.querySelector('[data-ring-track]'), nowEl = document.querySelector('[data-ring-now]');
    var n = PRODUCTS.length, step = 360 / n, angle = 0, targetA = 0, cards = [];
    track.innerHTML = PRODUCTS.map(function (p, i) {
      var badge = p.o ? '<span class="rc-badge">-' + Math.round((1 - p.p / p.o) * 100) + '%</span>' : (p.isNew ? '<span class="rc-badge new">New</span>' : '');
      return '<article class="ring-card" data-i="' + i + '">' +
        '<div class="media">' + badge + '<img src="' + src(p.img) + '" alt="' + p.n + '" loading="lazy" draggable="false"></div>' +
        '<p class="rc-meta">' + p.t + '</p>' +
        '<h3><a href="' + p.url + '?v=8" tabindex="-1">' + p.n + '</a></h3>' +
        '<div class="rc-row"><span class="rc-price"><b>' + money(p.p) + '</b>' + (p.o ? '<s>' + money(p.o) + '</s>' : '') + '</span>' +
        '<button class="rc-add" type="button" tabindex="-1" data-add="' + p.n + '" data-price="' + p.p + '" data-img="' + src(p.img) + '">+ Add</button></div></article>';
    }).join('');
    stage.insertAdjacentHTML('beforeend', '<div class="ring-floor" aria-hidden="true"></div>');
    cards = [].slice.call(track.children);
    function radius() { return parseFloat(getComputedStyle(stage).getPropertyValue('--r')) || 380; }
    var R = radius();
    function place() { R = radius(); cards.forEach(function (c, i) { c.style.transform = 'rotateY(' + (i * step) + 'deg) translateZ(' + R + 'px)'; }); }
    place(); window.addEventListener('resize', place);
    function frontIndex() { return ((Math.round(-targetA / step) % n) + n) % n; }
    function markFront() {
      var f = frontIndex();
      cards.forEach(function (c, i) {
        var on = i === f; c.classList.toggle('front', on);
        c.querySelectorAll('a, button').forEach(function (el) { el.tabIndex = on ? 0 : -1; });
        c.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      var p = PRODUCTS[f]; nowEl.textContent = (f + 1) + ' of ' + n + ': ' + p.n + ', ' + money(p.p);
    }
    var raf = null;
    function animate() {
      angle += (targetA - angle) * (reduce ? 1 : .12);
      track.style.transform = 'translateZ(' + (-R) + 'px) rotateY(' + angle + 'deg)';
      if (Math.abs(targetA - angle) > .05) raf = requestAnimationFrame(animate); else { angle = targetA; track.style.transform = 'translateZ(' + (-R) + 'px) rotateY(' + angle + 'deg)'; raf = null; }
    }
    function go(d) { targetA = Math.round(targetA / step) * step - d * step; markFront(); if (!raf) animate(); }
    document.querySelector('[data-ring-prev]').addEventListener('click', function () { go(-1); });
    document.querySelector('[data-ring-next]').addEventListener('click', function () { go(1); });
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    // drag
    var dragging = false, sx = 0, sa = 0, moved = 0;
    stage.addEventListener('dragstart', function (e) { e.preventDefault(); });
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      dragging = true; sx = e.clientX; sa = targetA; moved = 0; stage.classList.add('grabbing');
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return; var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      targetA = sa + dx * .35; if (!raf) animate();
    });
    window.addEventListener('pointerup', function () {
      if (!dragging) return; dragging = false; stage.classList.remove('grabbing');
      targetA = Math.round(targetA / step) * step; markFront(); if (!raf) animate();
    });
    stage.addEventListener('click', function (e) {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); return; }
      var c = e.target.closest('.ring-card'); if (!c || c.classList.contains('front')) return;
      e.preventDefault();
      var i = +c.getAttribute('data-i'), f = frontIndex(), d = ((i - f) % n + n) % n; if (d > n / 2) d -= n;
      go(d);
    }, true);
    markFront(); animate();
  }

  /* ---------- Lake wind: letters blown by the cursor ---------- */
  var gust = document.querySelector('[data-gust]');
  if (gust && !reduce && window.matchMedia('(hover: hover)').matches) {
    var label = gust.textContent; gust.setAttribute('aria-label', label);
    gust.innerHTML = label.split(' ').map(function (w) {
      return '<span class="w" aria-hidden="true">' + w.split('').map(function (ch) { return '<span class="ch">' + ch + '</span>'; }).join('') + '</span>';
    }).join(' ');
    var chars = [].slice.call(gust.querySelectorAll('.ch')).map(function (el) { return { el: el, x: 0, y: 0, r: 0, vx: 0, vy: 0, cx: 0, cy: 0 }; });
    function measure() { chars.forEach(function (c) { var b = c.el.getBoundingClientRect(); c.cx = b.left + b.width / 2 + window.scrollX - c.x; c.cy = b.top + b.height / 2 + window.scrollY - c.y; }); }
    var mx = -9999, my = -9999, pvx = 0, lastMx = 0, active = false, gr = null;
    function loop() {
      var still = true;
      chars.forEach(function (c) {
        var dx = c.cx - mx, dy = c.cy - my, d = Math.hypot(dx, dy), rad = 130;
        if (d < rad) { var f = (1 - d / rad) * 2.4; c.vx += (dx / (d || 1)) * f + pvx * .04 * (1 - d / rad); c.vy += (dy / (d || 1)) * f; }
        c.vx += -c.x * .06; c.vy += -c.y * .06; c.vx *= .82; c.vy *= .82;
        c.x += c.vx; c.y += c.vy; c.r = c.x * .6;
        if (Math.abs(c.x) > .1 || Math.abs(c.y) > .1) still = false;
        c.el.style.transform = 'translate(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px) rotate(' + c.r.toFixed(1) + 'deg)';
      });
      pvx *= .9;
      gr = (!still || active) ? requestAnimationFrame(loop) : null;
    }
    var sec = gust.closest('.gust');
    sec.addEventListener('pointerenter', function () { measure(); active = true; if (!gr) loop(); });
    sec.addEventListener('pointermove', function (e) { mx = e.pageX; my = e.pageY; pvx = e.pageX - lastMx; lastMx = e.pageX; });
    sec.addEventListener('pointerleave', function () { active = false; mx = my = -9999; });
    window.addEventListener('resize', function () { chars.forEach(function (c) { c.x = c.y = 0; c.el.style.transform = ''; }); });
  }

  /* ---------- CTA L map ---------- */
  var svg = document.querySelector('[data-lmap]');
  if (svg) {
    var LINES = [
      { name: 'Jackets', line: 'Red Line', c: '#C60C30', sub: '4 styles, all on sale, from $64', href: 'jackets/index.html', img: 'young-hipster-man-hiking-mountains-winter-vacation-traveling-scaled.webp' },
      { name: 'Pants', line: 'Blue Line', c: '#00A1DE', sub: 'Trail cargos for $25', href: 'pants/index.html', img: 'd8fe858e-eb62-4d03-a595-571e5113690c.webp' },
      { name: 'Shoes', line: 'Brown Line', c: '#62361B', sub: 'Snow boots, 41% off', href: 'shoes/index.html', img: 'Screenshot-2026-09-16-at-8.33.54-AM.webp' },
      { name: 'Accessories', line: 'Green Line', c: '#009B3A', sub: 'Hats, warmers, small wins', href: 'accessories/index.html', img: 'chi-active-aviator-hat-2.webp' },
      { name: 'Gear', line: 'Orange Line', c: '#F9461C', sub: 'Campus backpack, $59.99', href: 'gear/index.html', img: 'WhatsApp-Image-2026-09-20-at-11.32.42-PM-819x1024.webp' },
      { name: 'Sale', line: 'Purple Line', c: '#522398', sub: '5 markdowns, up to 41% off', href: 'sale.html', img: 'Screenshot-2026-09-16-at-8.30.52-AM.webp' }
    ];
    var NS = 'http://www.w3.org/2000/svg', g = svg.querySelector('[data-lines]'), train = svg.querySelector('[data-train]');
    var loop = document.querySelector('[data-loop]'), lImg = loop.querySelector('[data-loop-img]');
    var lLine = loop.querySelector('[data-loop-line]'), lName = loop.querySelector('[data-loop-name]'), lSub = loop.querySelector('[data-loop-sub]');
    var paths = [], trainRaf = null;
    LINES.forEach(function (L, i) {
      var y0 = 40 + i * 84, yL = 150 + i * 44;
      var d = 'M30 ' + y0 + ' H560 C650 ' + y0 + ' 650 ' + yL + ' 740 ' + yL + ' H780';
      var a = document.createElementNS(NS, 'a'); a.setAttribute('href', L.href + '?v=8'); a.setAttribute('aria-label', L.line + ': ' + L.name + '. ' + L.sub);
      var hit = document.createElementNS(NS, 'path'); hit.setAttribute('d', d); hit.setAttribute('class', 'hit');
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'line'); p.setAttribute('stroke', L.c);
      var st = document.createElementNS(NS, 'circle'); st.setAttribute('cx', 120); st.setAttribute('cy', y0); st.setAttribute('r', 13); st.setAttribute('class', 'stn');
      var tx = document.createElementNS(NS, 'text'); tx.setAttribute('x', 150); tx.setAttribute('y', y0 - 18); tx.setAttribute('class', 'lbl'); tx.textContent = L.name;
      var sb = document.createElementNS(NS, 'text'); sb.setAttribute('x', 150 + L.name.length * 16 + 16); sb.setAttribute('y', y0 - 19); sb.setAttribute('class', 'sub'); sb.textContent = L.line + ', ' + L.sub;
      a.appendChild(p); a.appendChild(hit); a.appendChild(st); a.appendChild(tx); a.appendChild(sb); g.appendChild(a);
      paths.push(p);
      function on() {
        svg.classList.add('dim'); paths.forEach(function (x) { x.classList.toggle('on', x === p); });
        lImg.src = src(L.img); lLine.textContent = L.line; lName.textContent = L.name; lSub.textContent = L.sub; loop.href = L.href + '?v=8';
        runTrain(p);
      }
      a.addEventListener('pointerenter', on); a.addEventListener('focus', on);
      a.addEventListener('pointerleave', off); a.addEventListener('blur', off);
    });
    function off() { svg.classList.remove('dim'); paths.forEach(function (x) { x.classList.remove('on'); }); if (trainRaf) cancelAnimationFrame(trainRaf); }
    function runTrain(p) {
      if (trainRaf) cancelAnimationFrame(trainRaf);
      var len = p.getTotalLength(), t0 = performance.now(), dur = reduce ? 1 : 1400;
      (function tick(now) {
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), pt = p.getPointAtLength(e * len);
        train.setAttribute('transform', 'translate(' + pt.x + ' ' + pt.y + ')');
        if (k < 1) trainRaf = requestAnimationFrame(tick);
      })(t0);
    }
    var list = document.querySelector('[data-lmap-list]');
    list.innerHTML = LINES.map(function (L) {
      return '<li><a href="' + L.href + '?v=8" style="--c:' + L.c + '"><img src="' + src(L.img) + '" alt="" loading="lazy"><span><b>' + L.name + '</b><small>' + L.line + ', ' + L.sub + '</small></span></a></li>';
    }).join('');
  }

  /* ---------- Student ID card ---------- */
  var form = document.querySelector('[data-club]');
  if (form) {
    var input = form.querySelector('input'), msg = form.querySelector('[data-club-msg]'), card = document.querySelector('[data-idcard]');
    var nameEl = card.querySelector('[data-id-name]'), schoolEl = card.querySelector('[data-id-school]');
    function title(s) { return s.replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
    input.addEventListener('input', function () {
      var v = input.value.trim(), at = v.indexOf('@');
      var local = at > -1 ? v.slice(0, at) : v, dom = at > -1 ? v.slice(at + 1) : '';
      nameEl.textContent = title(local) || 'Your name';
      var school = dom.split('.')[0];
      schoolEl.textContent = school ? (school.length <= 8 ? school.toUpperCase() : title(school)) : 'Your school';
      if (card.classList.contains('flipped')) { card.classList.remove('flipped'); }
      msg.className = 'club2-msg'; msg.textContent = 'Works with any .edu address. Unsubscribe anytime.';
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { msg.className = 'club2-msg err'; msg.textContent = 'Enter your full school email, like you@school.edu.'; input.focus(); return; }
      if (!/\.edu$/.test(v)) { msg.className = 'club2-msg err'; msg.textContent = 'Use your school email. It needs to end in .edu.'; input.focus(); return; }
      card.style.transform = ''; card.classList.add('flipped');
      msg.className = 'club2-msg ok'; msg.textContent = 'Card unlocked. Your code is on the back, and we sent it to your inbox too.';
    });
    var copyBtn = card.querySelector('[data-copy-code]');
    copyBtn.addEventListener('click', function () {
      var done = function () { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy code'; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText('STUDENT15').then(done, function () { copyBtn.textContent = 'STUDENT15'; });
      else copyBtn.textContent = 'STUDENT15';
    });
  }
})();
