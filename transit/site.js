/* ChiActive — small, dependency-free interactions */
(function () {
  document.documentElement.classList.remove('no-js');
  try { var tn = document.documentElement.getAttribute('data-theme-name'); if (tn) localStorage.setItem('chiactive-design', tn); } catch (e) {}

  /* ---------- Safe storage (works even when storage is blocked) ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- Bag: stored items, slide-out drawer, toast ---------- */
  var BAG_KEY = 'chiactive-bag', FREE_SHIP = 50, CODE = 'STUDENT15';
  var bag = store.get(BAG_KEY, []);
  if (!Array.isArray(bag)) bag = [];
  var promo = store.get('chiactive-promo', false);
  var countEls = document.querySelectorAll('[data-cart-count]');
  function money(n) { return '$' + n.toFixed(2); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function save() { store.set(BAG_KEY, bag); store.set('chiactive-promo', promo); }
  function totalQty() { return bag.reduce(function (s, i) { return s + i.qty; }, 0); }
  function subtotal() { return bag.reduce(function (s, i) { return s + i.qty * i.price; }, 0); }
  function renderCount() { var n = totalQty(); countEls.forEach(function (el) { el.textContent = n; }); }

  var toast = document.createElement('div');
  toast.className = 'toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  var toastTimer;
  function showToast(html) {
    toast.innerHTML = '<span class="star-i" aria-hidden="true"></span><div>' + html + '</div>';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3600);
  }

  // Drawer markup (built once, shared by every page)
  var overlay = document.createElement('div');
  overlay.className = 'bag-overlay';
  var drawer = document.createElement('aside');
  drawer.className = 'bag-drawer'; drawer.id = 'bag-drawer';
  drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-labelledby', 'bag-title');
  drawer.setAttribute('tabindex', '-1'); drawer.hidden = true; overlay.hidden = true;
  drawer.innerHTML =
    '<div class="bag-head"><h2 id="bag-title">Your bag <span class="bag-n" data-bag-n></span></h2>' +
    '<button class="bag-close" type="button" data-close-bag aria-label="Close bag">&times;</button></div>' +
    '<div class="bag-ship" data-bag-ship></div>' +
    '<div class="bag-body" data-bag-body></div>' +
    '<div class="bag-foot" data-bag-foot></div>';
  document.body.appendChild(overlay); document.body.appendChild(drawer);
  var lastFocus = null;

  function renderBag() {
    renderCount();
    var n = totalQty(), sub = subtotal();
    drawer.querySelector('[data-bag-n]').textContent = n ? '(' + n + ')' : '';
    var ship = drawer.querySelector('[data-bag-ship]');
    if (!n) { ship.innerHTML = ''; }
    else {
      var left = FREE_SHIP - sub, pct = Math.min(100, sub / FREE_SHIP * 100);
      ship.innerHTML = '<p>' + (left > 0 ? 'Add <b>' + money(left) + '</b> more for free shipping' : '<b>You unlocked free shipping.</b>') + '</p>' +
        '<div class="bag-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '" aria-label="Progress to free shipping"><span style="width:' + pct + '%"></span></div>';
    }
    var body = drawer.querySelector('[data-bag-body]');
    if (!n) {
      body.innerHTML = '<div class="bag-empty"><span class="star-i" aria-hidden="true"></span><h3>Your bag is empty</h3><p>The lake wind is waiting. Start with our $25 Trail Cargo Pants.</p><button class="btn" type="button" data-close-bag>Keep shopping</button></div>';
    } else {
      body.innerHTML = '<ul class="bag-items">' + bag.map(function (it, i) {
        var img = it.img ? '<img src="' + esc(it.img) + '" alt="" onerror="this.remove()">' : '';
        return '<li class="bag-item"><div class="bag-thumb">' + img + '</div>' +
          '<div class="bag-info"><strong>' + esc(it.name) + '</strong>' + (it.opt ? '<span class="bag-opt">' + esc(it.opt) + '</span>' : '') +
          '<div class="bag-qty"><button type="button" data-q="-1" data-i="' + i + '" aria-label="Decrease quantity of ' + esc(it.name) + '">&minus;</button><span aria-live="polite">' + it.qty + '</span><button type="button" data-q="1" data-i="' + i + '" aria-label="Increase quantity of ' + esc(it.name) + '">+</button></div></div>' +
          '<div class="bag-right"><span class="bag-price">' + money(it.qty * it.price) + '</span><button class="bag-remove" type="button" data-rm="' + i + '">Remove</button></div></li>';
      }).join('') + '</ul>';
    }
    var foot = drawer.querySelector('[data-bag-foot]');
    if (!n) { foot.innerHTML = ''; return; }
    var disc = promo ? sub * 0.15 : 0, shipCost = sub >= FREE_SHIP ? 0 : 6.95, total = sub - disc + shipCost;
    foot.innerHTML =
      '<form class="bag-promo" data-promo>' +
        (promo ? '<p class="bag-promo-ok">Code <b>' + CODE + '</b> applied: 15% off <button type="button" class="bag-remove" data-unpromo>Remove</button></p>'
               : '<label class="sr-only" for="promo-code">Discount code</label><input class="input" id="promo-code" placeholder="Student code (try STUDENT15)" autocomplete="off"><button class="btn btn-ghost no-arrow" type="submit">Apply</button><p class="bag-promo-msg" data-promo-msg role="status"></p>') +
      '</form>' +
      '<dl class="bag-sum"><div><dt>Subtotal</dt><dd>' + money(sub) + '</dd></div>' +
        (promo ? '<div class="bag-save"><dt>Student discount</dt><dd>&minus;' + money(disc) + '</dd></div>' : '') +
        '<div><dt>Shipping</dt><dd>' + (shipCost ? money(shipCost) : 'Free') + '</dd></div>' +
        '<div class="bag-total"><dt>Total</dt><dd>' + money(total) + '</dd></div></dl>' +
      '<button class="btn btn-block" type="button" data-checkout>Checkout &middot; ' + money(total) + '</button>' +
      '<p class="bag-note" data-checkout-note hidden>This is a design preview, so checkout isn&rsquo;t connected yet. On the live site this button goes to payment.</p>';
  }

  function openBag() {
    lastFocus = document.activeElement;
    renderBag();
    overlay.hidden = false; drawer.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add('open'); drawer.classList.add('open'); });
    document.documentElement.classList.add('bag-lock');
    document.querySelectorAll('[data-open-bag]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
    drawer.focus();
  }
  function closeBag() {
    overlay.classList.remove('open'); drawer.classList.remove('open');
    document.documentElement.classList.remove('bag-lock');
    document.querySelectorAll('[data-open-bag]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    setTimeout(function () { if (!drawer.classList.contains('open')) { drawer.hidden = true; overlay.hidden = true; } }, 350);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  overlay.addEventListener('click', closeBag);
  document.addEventListener('keydown', function (e) {
    if (drawer.hidden) return;
    if (e.key === 'Escape') closeBag();
    if (e.key === 'Tab') { // keep focus inside the drawer
      var f = drawer.querySelectorAll('button, input, a[href]'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === drawer)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  drawer.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-close-bag')) return closeBag();
    if (t.hasAttribute('data-q')) { var it = bag[+t.getAttribute('data-i')]; it.qty = Math.max(1, Math.min(10, it.qty + (+t.getAttribute('data-q')))); save(); renderBag(); drawer.querySelector('[data-i="' + t.getAttribute('data-i') + '"][data-q="' + t.getAttribute('data-q') + '"]').focus(); return; }
    if (t.hasAttribute('data-rm')) { bag.splice(+t.getAttribute('data-rm'), 1); save(); renderBag(); drawer.focus(); return; }
    if (t.hasAttribute('data-unpromo')) { promo = false; save(); renderBag(); return; }
    if (t.hasAttribute('data-checkout')) { drawer.querySelector('[data-checkout-note]').hidden = false; return; }
  });
  drawer.addEventListener('submit', function (e) {
    if (!e.target.matches('[data-promo]')) return;
    e.preventDefault();
    var v = (drawer.querySelector('#promo-code').value || '').trim().toUpperCase();
    if (v === CODE) { promo = true; save(); renderBag(); }
    else drawer.querySelector('[data-promo-msg]').textContent = v ? 'That code isn’t valid. Student code is STUDENT15.' : 'Enter a code first.';
  });

  function addToCart(name, qty, price, img, opt) {
    qty = qty || 1; price = +price || 0;
    if (img) { try { img = new URL(img, location.href).href; } catch (e) {} }
    var key = name + '|' + (opt || '');
    var found = bag.filter(function (i) { return i.key === key; })[0];
    if (found) found.qty = Math.min(10, found.qty + qty);
    else bag.push({ key: key, name: name, opt: opt || '', price: price, img: img || '', qty: qty });
    save(); renderCount();
    countEls.forEach(function (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
    showToast('<strong>' + esc(name) + '</strong> added to your bag. <button type="button" class="toast-link" data-open-bag>View bag</button>');
  }
  document.addEventListener('click', function (e) {
    var open = e.target.closest('[data-open-bag]');
    if (open) { e.preventDefault(); toast.classList.remove('show'); openBag(); return; }
    var btn = e.target.closest('[data-add]');
    if (!btn || btn.hasAttribute('data-pdp-add')) return;
    e.preventDefault();
    addToCart(btn.getAttribute('data-add'), 1, btn.getAttribute('data-price'), btn.getAttribute('data-img'));
  });
  renderCount();


  /* ---------- Original product page markup: gallery thumbs + Add to cart ---------- */
  var legacyForm = document.querySelector('.product-detail .buybox form');
  if (legacyForm) {
    var gMain = document.querySelector('.product-detail .gallery > img');
    var gThumbs = document.querySelectorAll('.product-detail .gallery .thumbs img');
    gThumbs.forEach(function (t, i) {
      if (i === 0) t.classList.add('active');
      t.setAttribute('tabindex', '0'); t.setAttribute('role', 'button');
      function pickT() { gMain.src = t.src; gMain.alt = document.querySelector('.buybox h1').textContent + ' in ' + t.alt; gThumbs.forEach(function (x) { x.classList.toggle('active', x === t); }); }
      t.addEventListener('click', pickT);
      t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickT(); } });
    });
    var sizeSel = legacyForm.querySelector('select'), qtyIn = legacyForm.querySelector('input[type=number]');
    var warn = document.createElement('p'); warn.className = 'size-warn'; warn.setAttribute('role', 'alert');
    sizeSel.insertAdjacentElement('afterend', warn);
    sizeSel.addEventListener('change', function () { warn.textContent = ''; });
    legacyForm.querySelector('button').addEventListener('click', function (e) {
      e.preventDefault();
      if (sizeSel.selectedIndex === 0) { warn.textContent = 'Pick a size first.'; sizeSel.focus(); return; }
      var name = document.querySelector('.buybox h1').textContent.trim();
      var price = parseFloat((document.querySelector('.buybox .price').textContent.match(/[\d.]+/g) || ['0']).pop());
      var active = document.querySelector('.gallery .thumbs img.active');
      addToCart(name, Math.max(1, +qtyIn.value || 1), price, gMain.src, (active ? active.alt + ' · ' : '') + sizeSel.value);
    });
  }


  /* ---------- Filter pills (category and blog pages) ---------- */
  document.querySelectorAll('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = btn.getAttribute('data-filter');
      btn.parentNode.querySelectorAll('[data-filter]').forEach(function (b) { b.classList.toggle('active', b === btn); b.setAttribute('aria-pressed', b === btn); });
      var items = document.querySelectorAll('.product-grid .product-card, [data-filterable] .post-card');
      var shown = 0;
      items.forEach(function (it) {
        var ok = f === 'all' ||
          (f === 'under150' && +it.dataset.price < 150) ||
          (f === 'women' && /women/i.test(it.textContent)) ||
          (it.dataset.cat && it.dataset.cat === f);
        if (ok) { it.removeAttribute('data-hidden-by-filter'); shown++; } else it.setAttribute('data-hidden-by-filter', '');
      });
      var count = document.querySelector('.toolbar .count');
      if (count && count.dataset.base === undefined) count.dataset.base = count.innerHTML;
      if (count) count.innerHTML = f === 'all' ? count.dataset.base : shown + ' of ' + items.length + ' products';
    });
  });


  /* ---------- Shop dropdown ---------- */
  document.querySelectorAll('.nav-drop').forEach(function (drop) {
    var btn = drop.querySelector('.nav-drop-btn');
    function set(open) { drop.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(!drop.classList.contains('open')); });
    document.addEventListener('click', function (e) { if (!drop.contains(e.target)) set(false); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Escape') { set(false); btn.focus(); } });
    drop.addEventListener('focusout', function (e) { if (!drop.contains(e.relatedTarget) && window.matchMedia('(min-width: 861px)').matches) set(false); });
  });

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      toggle.textContent = open ? 'Close' : 'Menu';
    });
  }

  /* ---------- Scroll reveal ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else { reveals.forEach(function (el) { el.classList.add('in'); }); }

  /* ---------- Broken remote images -> branded placeholder ---------- */
  document.querySelectorAll('img[data-fallback]').forEach(function (img) {
    function fail() {
      img.style.display = 'none';
      if (img.parentNode && !img.parentNode.querySelector('.ph')) {
        var ph = document.createElement('div'); ph.className = 'ph'; ph.innerHTML = '<span>' + (img.alt || 'ChiActive') + '</span>';
        img.parentNode.appendChild(ph);
      }
    }
    if (img.complete && img.naturalWidth === 0 && img.src) fail(); else img.addEventListener('error', fail);
  });

  /* ---------- Email forms (demo only) ---------- */
  document.querySelectorAll('form[data-signup]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = f.querySelector('.form-success');
      if (ok) ok.classList.add('show');
      f.querySelector('input[type=email]').value = '';
    });
  });

  /* ---------- Layer Finder ---------- */
  var finder = document.querySelector('[data-finder]');
  if (finder) {
    var root = finder.getAttribute('data-root') || '';
    function pic(n) { return root + '../images/web/' + n + '.webp'; }
    var P = {
      puffer:  { n: 'Chi Town Puffer Winter Jacket', t: 'Jackets', p: 185.00, img: pic('Screenshot-2026-09-16-at-8.30.52-AM'), url: 'jackets/chi-town-puffer-winter-jacket.html' },
      green:   { n: 'Green Winter Jacket', t: 'Jackets', p: 64.00, img: pic('young-hipster-man-hiking-mountains-winter-vacation-traveling-scaled'), url: 'jackets/green-winter-jacket.html' },
      easy:    { n: 'Always Effortless Jacket', t: 'Jackets', p: 118.40, img: pic('Skarmavbild-2026-09-16-kl.-08.30.03'), url: 'jackets/always-effortless-jacket-women.html' },
      trench:  { n: 'Short High-Collar Trench', t: 'Jackets', p: 110.00, img: pic('Screenshot-2026-09-16-at-08.26.32'), url: 'jackets/zw-collection-short-high-collar-trench-coat.html' },
      boots:   { n: 'ChiActive Snow Boots', t: 'Shoes', p: 94.99, img: pic('Screenshot-2026-09-16-at-8.33.54-AM'), url: 'shoes/snow-boots.html' },
      hat:     { n: 'Faux-Fur Aviator Hat', t: 'Accessories', p: 52.00, img: pic('chi-active-aviator-hat-2'), url: 'accessories/chiactive-faux-fur-aviator-hat.html' },
      warmer:  { n: 'Rechargeable Hand Warmer', t: 'Accessories', p: 24.99, img: '', url: 'accessories/chiactive-rechargeable-hand-warmer.html' },
      cargo:   { n: 'Trail Cargo Pants', t: 'Pants', p: 25.00, img: pic('d8fe858e-eb62-4d03-a595-571e5113690c'), url: 'pants/chiactive-trail-cargo-pants.html' },
      pack:    { n: 'Urban Campus Backpack', t: 'Gear', p: 59.99, img: pic('WhatsApp-Image-2026-09-20-at-11.32.42-PM-819x1024'), url: 'gear/chiactive-urban-campus-backpack.html' }
    };
    var MODES = [
      { max: 10,  mode: 'Full Chiberia mode', note: 'Frostbite weather. Cover every inch between you and the Red Line platform.', kit: ['puffer', 'hat', 'boots', 'warmer'] },
      { max: 32,  mode: 'Snow-day commute', note: 'Slush on the sidewalks, wind off the lake. Layer up and cover your ears.', kit: ['green', 'hat', 'boots', 'cargo'] },
      { max: 50,  mode: 'Layer-up weather', note: 'Cold mornings, milder afternoons. Pick layers you can peel off by lunch.', kit: ['easy', 'cargo', 'pack'] },
      { max: 68,  mode: 'Light-jacket season', note: 'Classic Chicago spring and fall. One smart layer, easy on the wallet.', kit: ['trench', 'cargo', 'pack'] },
      { max: 200, mode: 'Lakefront season', note: 'Sun is out. Hit the trail, the beach or the quad with room for everything.', kit: ['cargo', 'pack'] }
    ];
    var range = finder.querySelector('#temp');
    var readout = finder.querySelector('[data-temp]');
    var feels = finder.querySelector('[data-feels]');
    var modeEl = finder.querySelector('[data-mode]');
    var noteEl = finder.querySelector('[data-note]');
    var kitEl = finder.querySelector('[data-kit]');
    var totalEl = finder.querySelector('[data-total]');
    var winds = finder.querySelectorAll('input[name=wind]');

    function windChill(t, v) { // NWS formula (°F, mph)
      if (t > 50 || v < 3) return t;
      return Math.round(35.74 + 0.6215 * t - 35.75 * Math.pow(v, 0.16) + 0.4275 * t * Math.pow(v, 0.16));
    }
    function update() {
      var t = parseInt(range.value, 10);
      var w = parseInt(finder.querySelector('input[name=wind]:checked').value, 10);
      var fl = windChill(t, w);
      readout.textContent = t + '°F';
      range.setAttribute('aria-valuetext', t + ' degrees Fahrenheit');
      feels.textContent = fl !== t ? 'Feels like ' + fl + '°F with the lake wind' : (w >= 3 ? 'Wind chill doesn’t kick in above 50°F' : 'Calm day. Enjoy it, it won’t last.');
      var m = MODES.filter(function (x) { return fl <= x.max; })[0];
      modeEl.textContent = m.mode; noteEl.textContent = m.note;
      var total = 0;
      kitEl.innerHTML = m.kit.map(function (k) {
        var p = P[k]; total += p.p;
        var img = p.img ? '<img src="' + p.img + '" alt="" loading="lazy" onerror="this.remove()">' : '';
        return '<li><div class="thumb">' + img + '</div><a class="name" href="' + root + p.url + '?v=7">' + p.n + '<small>' + p.t + '</small></a><span class="p">$' + p.p.toFixed(2) + '</span></li>';
      }).join('');
      totalEl.textContent = '$' + total.toFixed(2);
      if (document.querySelector('[data-season-set]')) {
        var season = t <= 32 ? 'winter' : t <= 50 ? 'spring' : t <= 68 ? 'fall' : 'summer';
        if (window.__seasonLock) { season = window.__seasonLock; window.__seasonLock = null; }
        document.documentElement.setAttribute('data-season', season);
        document.querySelectorAll('[data-season-set]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-season-set') === season); });
      }
    }
    document.querySelectorAll('[data-season-set]').forEach(function (b) {
      b.addEventListener('click', function () { range.value = b.getAttribute('data-temp'); window.__seasonLock = b.getAttribute('data-season-set'); update(); });
    });
    range.addEventListener('input', update);
    winds.forEach(function (r) { r.addEventListener('change', update); });
    update();
  }

  /* ---------- Product page: gallery, colors, sizes, qty (works for every product) ---------- */
  var pdp = document.querySelector('[data-pdp]');
  if (pdp) {
    var pName = pdp.getAttribute('data-name') || document.querySelector('.buybox h1').textContent.trim();
    var pPrice = +pdp.getAttribute('data-price') || 0;
    var main = pdp.querySelector('.gallery-main img');
    var colorName = pdp.querySelector('[data-color-name]');
    var thumbs = pdp.querySelectorAll('.thumb-btn');
    var dots = pdp.querySelectorAll('.color-dot');
    function pick(i) {
      var t = thumbs[i]; if (!t || !main) return;
      main.style.opacity = 0;
      setTimeout(function () { main.src = t.getAttribute('data-src'); main.alt = pName + ' in ' + t.getAttribute('data-color'); main.style.opacity = 1; }, 150);
      thumbs.forEach(function (b, j) { b.setAttribute('aria-pressed', j === i); });
      dots.forEach(function (b, j) { b.setAttribute('aria-pressed', j === i); });
      if (colorName) colorName.textContent = t.getAttribute('data-color');
    }
    thumbs.forEach(function (b, i) { b.addEventListener('click', function () { pick(i); }); });
    dots.forEach(function (b, i) { b.addEventListener('click', function () { pick(i); }); });

    var sizeBtns = pdp.querySelectorAll('.size-btn');
    var size = null, hint = pdp.querySelector('.size-hint'), sizeName = pdp.querySelector('[data-size-name]');
    sizeBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        sizeBtns.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true'); size = b.textContent.trim();
        if (sizeName) sizeName.textContent = size; if (hint) hint.textContent = '';
      });
    });
    var q = pdp.querySelector('.qty input');
    pdp.querySelector('[data-qty-minus]').addEventListener('click', function () { q.value = Math.max(1, (+q.value || 1) - 1); });
    pdp.querySelector('[data-qty-plus]').addEventListener('click', function () { q.value = Math.min(10, (+q.value || 1) + 1); });

    function pdpAdd(e) {
      e.preventDefault();
      if (sizeBtns.length && !size) {
        if (hint) hint.textContent = 'Pick a size first.';
        sizeBtns[0].focus();
        pdp.querySelector('.size-row').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      var opt = [colorName ? colorName.textContent : '', size || ''].filter(Boolean).join(' \u00b7 ');
      addToCart(pName, Math.max(1, +q.value || 1), pPrice, main ? main.src : '', opt);
    }
    document.querySelectorAll('[data-pdp-add]').forEach(function (b) { b.addEventListener('click', pdpAdd); });

    // Sticky mobile buy bar once the main button scrolls away
    var sticky = document.querySelector('.sticky-buy'), mainBtn = pdp.querySelector('.add-row');
    if (sticky && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { sticky.classList.toggle('show', !en[0].isIntersecting && en[0].boundingClientRect.top < 0); }).observe(mainBtn);
    }
  }

  /* ---------- Category sorting ---------- */
  var sortSel = document.querySelector('[data-sort]');
  if (sortSel) {
    var grid = document.querySelector('[data-sortable]');
    sortSel.addEventListener('change', function () {
      var cards = Array.prototype.slice.call(grid.children);
      var v = sortSel.value;
      cards.sort(function (a, b) {
        var pa = +a.dataset.price, pb = +b.dataset.price, sa = +a.dataset.save, sb = +b.dataset.save;
        if (v === 'low') return pa - pb;
        if (v === 'high') return pb - pa;
        if (v === 'save') return sb - sa;
        return (+a.dataset.i) - (+b.dataset.i);
      });
      cards.forEach(function (c) { grid.appendChild(c); });
    });
  }
  /* ---------- Lake Michigan contour lines ---------- */
  function rand(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  document.querySelectorAll('.contours').forEach(function (el, idx) {
    var R = rand(7 + idx * 131), W = 1000, H = 600;
    var cx = W * (0.55 + R() * 0.4), cy = H * (0.3 + R() * 0.5);
    var ph = [R() * 6, R() * 6, R() * 6], out = '';
    for (var k = 1; k <= 16; k++) {
      var base = k * 46, d = '';
      for (var i = 0; i <= 96; i++) {
        var a = i / 96 * Math.PI * 2;
        var r = base * (1 + 0.16 * Math.sin(3 * a + ph[0] + k * 0.15) + 0.09 * Math.sin(5 * a + ph[1]) + 0.05 * Math.sin(9 * a + ph[2] + k * 0.3));
        d += (i ? 'L' : 'M') + (cx + r * Math.cos(a) * 1.35).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
      }
      out += '<path d="' + d + 'Z"/>';
    }
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + out + '</svg>';
  });

  /* ---------- Product rail arrows ---------- */
  document.querySelectorAll('[data-rail]').forEach(function (wrap) {
    var rail = wrap.querySelector('.rail');
    wrap.querySelectorAll('[data-dir]').forEach(function (b) {
      b.addEventListener('click', function () { rail.scrollBy({ left: rail.clientWidth * 0.8 * (+b.getAttribute('data-dir')), behavior: 'smooth' }); });
    });
  });

  /* ---------- Category index: image peek follows the cursor ---------- */
  var peek = document.querySelector('.peek');
  if (peek && window.matchMedia('(hover: hover) and (min-width: 881px)').matches) {
    var pimg = peek.querySelector('img');
    document.querySelectorAll('.index-row a[data-img]').forEach(function (a) {
      a.addEventListener('mouseenter', function () { pimg.style.display = ''; pimg.src = a.getAttribute('data-img'); peek.classList.add('show'); });
      a.addEventListener('mouseleave', function () { peek.classList.remove('show'); });
      a.addEventListener('mousemove', function (e) { peek.style.left = (e.clientX + 150) + 'px'; peek.style.top = e.clientY + 'px'; });
    });
    pimg.addEventListener('error', function () { pimg.style.display = 'none'; });
  }
})();
