/* ChiActive storefront — cart, navigation and page interactions.
   Demo store: the cart is saved in this browser only (localStorage). No payments are processed. */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.remove('no-js');
  var ROOT = doc.getAttribute('data-root') || '';
  var KEY = 'chiactive-cart-v1';
  var FREE_SHIP = 75;
  var money = function (n) { return '$' + n.toFixed(2); };
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ---------- Storage ---------- */
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* storage unavailable — cart lives for this page only */ } }
  var cart = load();

  /* ---------- Icons used in JS ---------- */
  var ICON_BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

  /* ---------- Cart model ---------- */
  function lineKey(item) { return item.id + '|' + (item.size || '') + '|' + (item.color || ''); }
  function count() { return cart.reduce(function (n, i) { return n + i.qty; }, 0); }
  function subtotal() { return cart.reduce(function (n, i) { return n + i.qty * i.price; }, 0); }

  function addItem(item, qty) {
    qty = Math.max(1, Math.min(99, parseInt(qty, 10) || 1));
    var k = lineKey(item);
    var found = cart.filter(function (i) { return lineKey(i) === k; })[0];
    if (found) found.qty = Math.min(99, found.qty + qty);
    else cart.push({ id: item.id, name: item.name, price: +item.price, img: item.img || '', url: item.url || '', size: item.size || '', color: item.color || '', qty: qty });
    save(); render(true);
    showToast(item, qty);
  }
  function setQty(k, qty) {
    cart = cart.filter(function (i) {
      if (lineKey(i) !== k) return true;
      i.qty = qty; return qty > 0;
    });
    save(); render();
  }

  /* ---------- Drawer ---------- */
  var drawer = $('#cart-drawer');
  var overlay = $('#overlay');
  var lastFocus = null;

  function openCart() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.classList.add('open'); overlay.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    hideToast();
    setTimeout(function () { var c = $('.drawer-close', drawer); if (c) c.focus(); }, 60);
  }
  function closeCart() {
    if (!drawer) return;
    drawer.classList.remove('open'); overlay.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function render(bump) {
    var n = count();
    $$('.cart-count').forEach(function (el) {
      el.textContent = n; el.setAttribute('data-count', n);
      if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
    $$('.cart-btn').forEach(function (b) { b.setAttribute('aria-label', 'Open cart, ' + n + ' item' + (n === 1 ? '' : 's')); });
    if (!drawer) return;

    var list = $('.cart-items', drawer);
    var foot = $('.drawer-foot', drawer);
    var meter = $('.ship-meter', drawer);
    var sub = subtotal();

    if (!cart.length) {
      list.innerHTML = '<li class="cart-empty">' + ICON_BAG +
        '<h3>Your bag is empty</h3><p>The lake wind is not waiting. Let’s get you geared up.</p>' +
        '<a class="btn btn-cyan" href="' + ROOT + 'shop.html">Shop all gear</a></li>';
      foot.hidden = true; meter.hidden = true;
      return;
    }
    foot.hidden = false; meter.hidden = false;

    list.innerHTML = cart.map(function (i) {
      var k = lineKey(i);
      var variant = [i.color, i.size && ('Size ' + i.size)].filter(Boolean).join(' · ');
      var img = i.img ? '<img src="' + ROOT + i.img + '" alt="">' : '<span class="ci-ph"></span>';
      var name = i.url ? '<a href="' + ROOT + i.url + '">' + i.name + '</a>' : i.name;
      return '<li class="cart-item" data-key="' + k + '">' + img +
        '<div><h3>' + name + '</h3><p class="variant">' + (variant || 'One size') + ' · ' + money(i.price) + '</p>' +
        '<div class="stepper sm" role="group" aria-label="Quantity for ' + i.name + '">' +
        '<button type="button" data-step="-1" aria-label="Decrease quantity">−</button>' +
        '<output aria-live="polite">' + i.qty + '</output>' +
        '<button type="button" data-step="1" aria-label="Increase quantity">+</button></div></div>' +
        '<div><div class="line-price">' + money(i.qty * i.price) + '</div>' +
        '<button type="button" class="remove" data-remove>Remove</button></div></li>';
    }).join('');

    $('.js-subtotal', drawer).textContent = money(sub);
    var ship = sub >= FREE_SHIP ? 0 : 6.95;
    $('.js-shipping', drawer).textContent = ship ? money(ship) : 'Free';
    $('.js-total', drawer).textContent = money(sub + ship);

    var left = FREE_SHIP - sub;
    meter.classList.toggle('done', left <= 0);
    $('.js-ship-msg', drawer).innerHTML = left > 0
      ? 'You’re <strong>' + money(left) + '</strong> away from free shipping.'
      : '<strong>Free shipping unlocked.</strong> Nice work.';
    $('.bar span', meter).style.width = Math.min(100, (sub / FREE_SHIP) * 100) + '%';
  }

  if (drawer) {
    drawer.addEventListener('click', function (e) {
      var li = e.target.closest('.cart-item');
      if (li) {
        var k = li.getAttribute('data-key');
        var item = cart.filter(function (i) { return lineKey(i) === k; })[0];
        if (!item) return;
        var step = e.target.closest('[data-step]');
        if (step) setQty(k, item.qty + parseInt(step.getAttribute('data-step'), 10));
        if (e.target.closest('[data-remove]')) setQty(k, 0);
      }
      if (e.target.closest('.js-checkout')) {
        cart = []; save(); render();
        $('.cart-items', drawer).innerHTML = '<li class="checkout-done"><div class="check">' + ICON_CHECK + '</div>' +
          '<h3>You’re all set!</h3><p>This is a demo store, so no payment was taken and nothing will ship. ' +
          'In the real store, this is where checkout would happen.</p>' +
          '<button type="button" class="btn btn-ghost drawer-close">Keep browsing</button></li>';
        $('.ship-meter', drawer).hidden = true; $('.drawer-foot', drawer).hidden = true;
      }
      if (e.target.closest('.drawer-close')) closeCart();
    });
  }
  if (overlay) overlay.addEventListener('click', function () { closeCart(); closeNav(); });
  $$('.cart-btn').forEach(function (b) { b.addEventListener('click', openCart); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeCart(); closeNav(); closePops(); }
    if (e.key === 'Tab' && drawer && drawer.classList.contains('open')) {
      var f = $$('a[href], button:not([disabled]), input, select', drawer).filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  // Keep tabs/windows in sync
  window.addEventListener('storage', function (e) { if (e.key === KEY) { cart = load(); render(); } });

  /* ---------- Toast ---------- */
  var toast = $('#toast'), toastTimer;
  function showToast(item, qty) {
    if (!toast) return;
    var img = $('img', toast);
    if (item.img) { img.src = ROOT + item.img; img.hidden = false; } else img.hidden = true;
    $('.js-toast-text', toast).textContent = (qty > 1 ? qty + ' × ' : '') + item.name + (item.size ? ' (' + item.size + ')' : '');
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 3800);
  }
  function hideToast() { if (toast) toast.classList.remove('show'); }
  if (toast) $('button', toast).addEventListener('click', openCart);

  /* ---------- Product cards: quick add ---------- */
  function itemFrom(el) {
    return { id: el.getAttribute('data-id'), name: el.getAttribute('data-name'), price: parseFloat(el.getAttribute('data-price')),
      img: el.getAttribute('data-img'), url: el.getAttribute('data-url') };
  }
  function closePops() { $$('.size-pop.open').forEach(function (p) { p.classList.remove('open'); }); }

  document.addEventListener('click', function (e) {
    var qa = e.target.closest('.quick-add');
    if (qa) {
      e.preventDefault();
      var sizes = qa.getAttribute('data-sizes');
      if (!sizes) { addItem(itemFrom(qa), 1); return; }
      var pop = qa.closest('.product-card').querySelector('.size-pop');
      var wasOpen = pop.classList.contains('open');
      closePops();
      if (!wasOpen) { pop.classList.add('open'); var b = $('.sizes button', pop); if (b) b.focus(); }
      return;
    }
    var sizeBtn = e.target.closest('.size-pop .sizes button');
    if (sizeBtn) {
      var card = sizeBtn.closest('.product-card');
      var it = itemFrom($('.quick-add', card));
      it.size = sizeBtn.textContent.trim();
      it.color = $('.quick-add', card).getAttribute('data-color') || '';
      addItem(it, 1); closePops(); return;
    }
    if (e.target.closest('.close-pop')) { closePops(); return; }
    if (!e.target.closest('.size-pop')) closePops();
  });

  /* ---------- Product detail page ---------- */
  var pdp = $('#pdp-form');
  if (pdp) {
    var mainImg = $('.gallery-main img');
    var thumbs = $$('.thumbs button');
    function showImage(src, alt) {
      if (!mainImg || !src) return;
      mainImg.style.opacity = 0;
      setTimeout(function () { mainImg.src = src; if (alt) mainImg.alt = alt; mainImg.style.opacity = 1; }, 140);
      thumbs.forEach(function (t) { t.setAttribute('aria-pressed', t.getAttribute('data-src') === src ? 'true' : 'false'); });
    }
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () {
        showImage(t.getAttribute('data-src'), t.getAttribute('data-alt'));
        var c = t.getAttribute('data-color');
        if (c) { var r = $('input[name="color"][value="' + c + '"]', pdp); if (r) { r.checked = true; updateColorLabel(); } }
      });
    });
    function updateColorLabel() {
      var c = $('input[name="color"]:checked', pdp), lab = $('.js-color-name', pdp);
      if (c && lab) lab.textContent = c.value;
    }
    $$('input[name="color"]', pdp).forEach(function (r) {
      r.addEventListener('change', function () { updateColorLabel(); showImage(r.getAttribute('data-src'), r.getAttribute('data-alt')); });
    });
    $$('input[name="size"]', pdp).forEach(function (r) {
      r.addEventListener('change', function () { $('.size-error', pdp).classList.remove('show'); var l = $('.js-size-name', pdp); if (l) l.textContent = r.value; });
    });
    var qty = $('input[name="qty"]', pdp);
    $$('[data-qty]', pdp).forEach(function (b) {
      b.addEventListener('click', function () {
        qty.value = Math.max(1, Math.min(99, (parseInt(qty.value, 10) || 1) + parseInt(b.getAttribute('data-qty'), 10)));
      });
    });
    pdp.addEventListener('submit', function (e) {
      e.preventDefault();
      var it = itemFrom(pdp);
      var sizeInputs = $$('input[name="size"]', pdp);
      if (sizeInputs.length) {
        var s = $('input[name="size"]:checked', pdp);
        if (!s) { $('.size-error', pdp).classList.add('show'); sizeInputs[0].focus(); return; }
        it.size = s.value;
      }
      var c = $('input[name="color"]:checked', pdp);
      if (c) { it.color = c.value; if (c.getAttribute('data-thumb')) it.img = c.getAttribute('data-thumb'); }
      addItem(it, qty ? qty.value : 1);
    });
  }

  // Simple "add" buttons (e.g. blog shop-the-post)
  $$('[data-add-simple]').forEach(function (b) {
    b.addEventListener('click', function () { addItem(itemFrom(b), 1); });
  });

  /* ---------- Season switcher ---------- */
  var tabs = $$('.season-tab');
  tabs.forEach(function (tab, idx) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (e) {
      var d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var next = tabs[(idx + d + tabs.length) % tabs.length]; selectTab(next); next.focus();
    });
  });
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  // Open the season that matches today's date
  if (tabs.length) {
    var m = new Date().getMonth(); // 0-11
    var season = (m === 11 || m <= 1) ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'fall';
    var t = $('.season-tab[data-season="' + season + '"]'); if (t) selectTab(t);
  }

  /* ---------- Shop filters & sorting ---------- */
  var grid = $('#shop-grid');
  if (grid) {
    var cards = $$('.product-card', grid);
    var filter = 'all', sort = 'featured';
    var params = new URLSearchParams(location.search);
    if (params.get('cat')) filter = params.get('cat');
    function apply() {
      var shown = 0;
      cards.forEach(function (c) {
        var ok = filter === 'all' || c.getAttribute('data-cat') === filter || (filter === 'sale' && c.hasAttribute('data-sale'));
        c.hidden = !ok; if (ok) shown++;
      });
      var sorted = cards.slice().sort(function (a, b) {
        if (sort === 'low') return a.getAttribute('data-price') - b.getAttribute('data-price');
        if (sort === 'high') return b.getAttribute('data-price') - a.getAttribute('data-price');
        return a.getAttribute('data-order') - b.getAttribute('data-order');
      });
      sorted.forEach(function (c) { grid.appendChild(c); });
      $$('.chip').forEach(function (ch) { ch.setAttribute('aria-pressed', ch.getAttribute('data-filter') === filter ? 'true' : 'false'); });
      var rc = $('.result-count'); if (rc) rc.textContent = shown + ' product' + (shown === 1 ? '' : 's');
      var em = $('.empty-state'); if (em) em.hidden = shown > 0;
    }
    $$('.chip').forEach(function (ch) {
      ch.addEventListener('click', function () {
        filter = ch.getAttribute('data-filter'); apply();
        var u = new URL(location.href);
        if (filter === 'all') u.searchParams.delete('cat'); else u.searchParams.set('cat', filter);
        try { history.replaceState(null, '', u); } catch (e) { /* file:// */ }
      });
    });
    var sel = $('#sort'); if (sel) sel.addEventListener('change', function () { sort = sel.value; apply(); });
    apply();
  }

  /* ---------- Mobile nav ---------- */
  var nav = $('.site-nav'), toggle = $('.menu-toggle');
  function closeNav() {
    if (!nav || !nav.classList.contains('open')) return;
    nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false');
    $('.js-menu-open', toggle).hidden = false; $('.js-menu-close', toggle).hidden = true;
    document.body.classList.remove('no-scroll');
  }
  if (toggle) toggle.addEventListener('click', function () {
    var open = !nav.classList.contains('open');
    if (!open) { closeNav(); return; }
    nav.classList.add('open'); toggle.setAttribute('aria-expanded', 'true');
    $('.js-menu-open', toggle).hidden = true; $('.js-menu-close', toggle).hidden = false;
    document.body.classList.add('no-scroll');
  });

  /* ---------- Demo forms ---------- */
  $$('form[data-demo]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = $('.form-note', f);
      if (note) { note.textContent = f.getAttribute('data-demo'); note.classList.add('ok'); }
      f.reset();
    });
  });

  /* ---------- Reveal on scroll ---------- */
  var rev = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    rev.forEach(function (r) { io.observe(r); });
  } else rev.forEach(function (r) { r.classList.add('in'); });

  /* ---------- Footer year ---------- */
  $$('.js-year').forEach(function (y) { y.textContent = new Date().getFullYear(); });

  render();
})();
