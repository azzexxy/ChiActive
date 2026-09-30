/* North Branch site script: menu, cart (saved in this browser), shop filters,
   product options, forms, group-hike RSVPs. */
(function () {
  'use strict';
  var root = (document.querySelector('link[href$="css/style.css"]') || {}).getAttribute ? document.querySelector('link[href$="css/style.css"]').getAttribute('href').replace('css/style.css', '') : '';
  var CART = 'nb-cart', RSVP = 'nb-rsvp', PROMO = 'nb-promo';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return [].slice.call((el || document).querySelectorAll(s)); };
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function money(n) { return '$' + n.toFixed(2); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg) { var t = $('[data-toast]'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 2600); }

  /* menu */
  var toggle = $('.menu-toggle'), nav = $('#site-nav');
  if (toggle && nav) toggle.addEventListener('click', function () { var open = nav.classList.toggle('is-open'); toggle.setAttribute('aria-expanded', String(open)); toggle.textContent = open ? 'Close' : 'Menu'; });
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* cart */
  function cart() { return load(CART, []); }
  function count() { return cart().reduce(function (n, i) { return n + i.qty; }, 0); }
  function subtotal() { return cart().reduce(function (n, i) { return n + i.qty * i.price; }, 0); }
  function renderCount() { $$('[data-cart-count]').forEach(function (el) { el.textContent = count(); }); }
  function add(item, qty) {
    var c = cart(), key = item.id + '|' + (item.color || '') + '|' + (item.size || '');
    var hit = c.filter(function (i) { return i.key === key; })[0];
    if (hit) hit.qty = Math.min(9, hit.qty + qty); else c.push({ key: key, id: item.id, name: item.name, price: item.price, img: item.img, color: item.color || '', size: item.size || '', qty: qty });
    save(CART, c); renderCount(); renderDrawer(); renderCartPage();
  }
  function setQty(key, qty) { var c = cart().map(function (i) { if (i.key === key) i.qty = qty; return i; }).filter(function (i) { return i.qty > 0; }); save(CART, c); renderCount(); renderDrawer(); renderCartPage(); }
  function shipNote(sub) { return sub === 0 ? '' : sub >= 60 ? 'You get free shipping.' : 'Add ' + money(60 - sub) + ' more for free shipping.'; }
  function renderDrawer() {
    var box = $('[data-drawer-items]'); if (!box) return;
    var c = cart();
    box.innerHTML = c.length ? c.map(function (i) {
      return '<div class="drawer-item"><img src="' + root + esc(i.img) + '" alt=""><div><p><b>' + esc(i.name) + '</b></p><p>' + [i.color, i.size].filter(Boolean).map(esc).join(' · ') + '</p><p>' + i.qty + ' × ' + money(i.price) + '</p></div>' +
        '<button class="link-btn" type="button" data-remove="' + esc(i.key) + '">Remove</button></div>';
    }).join('') : '<p class="empty-state">Your cart is empty.</p>';
    var sub = subtotal();
    $('[data-drawer-total]').textContent = money(sub);
    $('[data-ship-note]').textContent = shipNote(sub);
  }
  var drawer = $('#cart-drawer');
  function openCart() { if (!drawer) return; renderDrawer(); drawer.hidden = false; var b = $('[data-close-cart]'); if (b) b.focus(); }
  function closeCart() { if (drawer) drawer.hidden = true; }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-cart]')) return openCart();
    if (e.target.closest('[data-close-cart]') || e.target === drawer) return closeCart();
    var rm = e.target.closest('[data-remove]'); if (rm) return setQty(rm.getAttribute('data-remove'), 0);
    var btn = e.target.closest('[data-add]');
    if (btn) {
      var item = { id: btn.dataset.id, name: btn.dataset.name, price: +btn.dataset.price, img: btn.dataset.img };
      var qty = 1;
      if (btn.hasAttribute('data-product-page')) {
        var size = $('.size.is-active'), color = $('.swatch.is-active');
        if (!size) { var m = $('[data-size-msg]'); m.textContent = 'Pick a size first.'; m.className = 'form-msg bad'; $('.size').focus(); return; }
        $('[data-size-msg]').textContent = '';
        item.size = size.dataset.size; item.color = color ? color.dataset.color : '';
        qty = Math.max(1, Math.min(9, +$('[data-qty-input]').value || 1));
      }
      add(item, qty); toast(item.name + ' added to your cart'); btn.textContent = 'Added ✓'; setTimeout(function () { btn.textContent = 'Add to cart'; }, 1400);
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCart(); });

  /* shop filters */
  var grid = $('[data-product-grid]');
  if (grid) {
    var cards = $$('.product-card', grid), order = cards.slice(), state = { cat: 'all', q: '', sort: 'featured' };
    function apply() {
      var list = order.slice();
      if (state.sort !== 'featured') list.sort(function (a, b) { return (state.sort === 'low' ? 1 : -1) * (a.dataset.price - b.dataset.price); });
      var shown = 0;
      list.forEach(function (c) {
        var ok = (state.cat === 'all' || c.dataset.cat === state.cat) && (!state.q || c.dataset.name.indexOf(state.q) > -1);
        c.hidden = !ok; if (ok) shown++; grid.appendChild(c);
      });
      $('[data-result-count]').textContent = shown + ' product' + (shown === 1 ? '' : 's');
      $('[data-empty]').hidden = shown > 0;
      $$('[data-filter]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.filter === state.cat); });
    }
    $$('[data-filter]').forEach(function (b) { b.addEventListener('click', function () { state.cat = b.dataset.filter; history.replaceState(null, '', state.cat === 'all' ? location.pathname : '#' + state.cat); apply(); }); });
    $('#search').addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); apply(); });
    $('#sort').addEventListener('change', function () { state.sort = this.value; apply(); });
    var h = location.hash.slice(1); if (h && $('[data-filter="' + h + '"]')) state.cat = h;
    apply();
  }

  /* product page */
  var main = $('[data-gallery-main]');
  if (main) {
    $$('[data-thumb]').forEach(function (t) { t.addEventListener('click', function () { main.src = t.dataset.thumb; $$('[data-thumb]').forEach(function (x) { x.classList.toggle('is-active', x === t); }); }); });
    $$('.swatch').forEach(function (s) { s.addEventListener('click', function () {
      $$('.swatch').forEach(function (x) { x.classList.toggle('is-active', x === s); });
      $('[data-color-label]').textContent = s.dataset.color; main.src = s.dataset.img;
      $$('[data-thumb]').forEach(function (x) { x.classList.toggle('is-active', x.dataset.thumb === s.dataset.img); });
    }); });
    $$('.size').forEach(function (s) { s.addEventListener('click', function () { $$('.size').forEach(function (x) { x.classList.toggle('is-active', x === s); }); $('[data-size-msg]').textContent = ''; }); });
    $$('[data-qty]').forEach(function (b) { b.addEventListener('click', function () { var i = $('[data-qty-input]'); i.value = Math.max(1, Math.min(9, (+i.value || 1) + +b.dataset.qty)); }); });
  }

  /* forms */
  function validate(form) {
    var ok = true;
    $$('input[required], select[required], textarea[required]', form).forEach(function (f) {
      var bad = !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value)) || (f.minLength > 0 && f.value.trim().length < f.minLength);
      f.classList.toggle('is-invalid', bad); if (bad && ok) { f.focus(); ok = false; }
    });
    return ok;
  }
  function msg(form, text, good) { var m = $('[data-msg]', form); if (m) { m.textContent = text; m.className = 'form-msg ' + (good ? 'ok' : 'bad'); } }
  $$('form[data-form="newsletter"], form[data-form="contact"]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) return msg(form, form.dataset.form === 'newsletter' ? 'Enter a valid email address.' : 'Please fill in every field (message: at least 10 characters).', false);
      msg(form, form.dataset.form === 'newsletter' ? 'You’re subscribed. Watch your inbox for the next trail report.' : 'Thanks! We’ll reply within one school day.', true);
      form.reset();
    });
  });

  /* events: RSVP */
  var modal = $('[data-rsvp-modal]'), current = null;
  function markGoing() { var going = load(RSVP, []); $$('[data-event]').forEach(function (row) { var i = +row.dataset.event, on = going.indexOf(i) > -1; row.classList.toggle('is-going', on); var b = $('[data-rsvp]', row); if (b) b.textContent = on ? 'You’re going ✓' : 'Save my spot'; }); }
  if (modal) {
    markGoing();
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rsvp]'); if (!b) return;
      current = +b.dataset.rsvp;
      if (load(RSVP, []).indexOf(current) > -1) { save(RSVP, load(RSVP, []).filter(function (x) { return x !== current; })); markGoing(); var s = $('[data-event="' + current + '"] [data-spots]'); s.textContent = +s.textContent + 1; return toast('Your spot was released.'); }
      $('[data-rsvp-title]').textContent = b.dataset.title; msg($('[data-form="rsvp"]'), '', true);
      if (modal.showModal) modal.showModal(); else modal.setAttribute('open', '');
    });
    $('[data-close-modal]').addEventListener('click', function () { modal.close ? modal.close() : modal.removeAttribute('open'); });
    $('[data-form="rsvp"]').addEventListener('submit', function (e) {
      e.preventDefault(); var form = e.target;
      if (!validate(form)) return msg(form, 'Add your name and a valid email.', false);
      var g = load(RSVP, []); if (g.indexOf(current) < 0) g.push(current); save(RSVP, g); markGoing();
      var s = $('[data-event="' + current + '"] [data-spots]'); s.textContent = Math.max(0, +s.textContent - 1);
      form.reset(); modal.close ? modal.close() : modal.removeAttribute('open'); toast('You’re on the list. See you on the trail!');
    });
  }

  /* cart page */
  function renderCartPage() {
    var lines = $('[data-cart-lines]'); if (!lines) return;
    var c = cart(), sub = subtotal(), code = load(PROMO, '');
    lines.innerHTML = c.map(function (i) {
      return '<div class="cart-line"><img src="' + root + esc(i.img) + '" alt=""><div><h3>' + esc(i.name) + '</h3><p>' + [i.color, i.size].filter(Boolean).map(esc).join(' · ') + '</p><p>' + money(i.price) + ' each</p></div>' +
        '<div class="line-actions"><div class="qty"><button type="button" data-line="' + esc(i.key) + '" data-d="-1" aria-label="One less">−</button><input value="' + i.qty + '" aria-label="Quantity" readonly><button type="button" data-line="' + esc(i.key) + '" data-d="1" aria-label="One more">+</button></div>' +
        '<button class="link-btn" type="button" data-remove="' + esc(i.key) + '">Remove</button></div></div>';
    }).join('');
    $('[data-cart-empty]').hidden = c.length > 0;
    var discount = code === 'NORTH10' ? sub * 0.1 : 0, shipping = sub === 0 || sub - discount >= 60 ? 0 : 5.95;
    $('[data-sub]').textContent = money(sub); $('[data-discount]').textContent = '−' + money(discount);
    $('[data-shipping]').textContent = shipping ? money(shipping) : 'Free'; $('[data-total]').textContent = money(sub - discount + shipping);
    if (code) $('#promo').value = code;
  }
  if ($('[data-cart-lines]')) {
    renderCartPage();
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-line]'); if (!b) return; var i = cart().filter(function (x) { return x.key === b.dataset.line; })[0]; if (i) setQty(i.key, Math.max(0, Math.min(9, i.qty + +b.dataset.d))); });
    $('[data-form="promo"]').addEventListener('submit', function (e) {
      e.preventDefault(); var code = $('#promo').value.trim().toUpperCase(), m = $('[data-promo-msg]');
      if (code === 'NORTH10') { save(PROMO, code); m.textContent = 'NORTH10 applied: 10% off.'; m.className = 'form-msg ok'; }
      else { save(PROMO, ''); m.textContent = code ? 'That code isn’t valid.' : 'Enter a code.'; m.className = 'form-msg bad'; }
      renderCartPage();
    });
    $('[data-checkout]').addEventListener('click', function () { if (!cart().length) return toast('Your cart is empty.'); save(CART, []); save(PROMO, ''); renderCount(); renderCartPage(); toast('Order placed! (This is a demo, no payment was taken.)'); });
  }
  renderCount();
})();
