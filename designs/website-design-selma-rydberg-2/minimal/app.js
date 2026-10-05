/* ============================================================
   ChiActive — Minimal edition
   Tiny demo cart + mobile nav. No dependencies, no build step.
   Demo only: "checkout" is a mock. Cart persists to localStorage
   under its own key so it never mixes with the main starter site.
   ============================================================ */

(function () {
  'use strict';

  var KEY = 'chiactive_minimal_cart_v1';
  var FREE_SHIPPING = 75;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function money(n) { return '$' + Number(n).toFixed(2); }

  /* ---------------------------------------------------------- state */
  var cart = load();

  function load() {
    try {
      var parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* memory only */ }
  }
  function count() { return cart.reduce(function (s, i) { return s + i.qty; }, 0); }
  function subtotal() { return cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0); }

  function addItem(p) {
    var line = p.id + '::' + (p.variant || 'os');
    var found = null;
    cart.forEach(function (i) { if (i.line === line) found = i; });
    if (found) { found.qty += p.qty; }
    else {
      cart.push({
        line: line, id: p.id, name: p.name, price: p.price,
        image: p.image, variant: p.variant || '', qty: p.qty
      });
    }
    save(); render(); toast('<strong>' + esc(p.name) + '</strong> added to cart');
  }
  function setQty(line, qty) {
    cart.forEach(function (i) { if (i.line === line) i.qty = Math.max(0, qty); });
    cart = cart.filter(function (i) { return i.qty > 0; });
    save(); render();
  }
  function removeLine(line) {
    cart = cart.filter(function (i) { return i.line !== line; });
    save(); render();
  }

  /* --------------------------------------------------------- render */
  var el = {};

  function cache() {
    el.drawer = $('#cartDrawer');
    el.backdrop = $('#cartBackdrop');
    el.items = $('#cartItems');
    el.foot = $('#cartFoot');
    el.total = $('#cartTotal');
    el.note = $('#cartNote');
    el.counts = $$('[data-cart-count]');
    el.toast = $('#toast');
  }

  function render() {
    var n = count();
    el.counts.forEach(function (c) {
      c.textContent = n;
      c.setAttribute('data-empty', n === 0 ? 'true' : 'false');
    });

    if (!el.items) return;

    if (cart.length === 0) {
      el.items.innerHTML =
        '<li class="cart-empty">Your cart is empty.<br>Everything here is built for the four-season city.</li>';
      if (el.foot) el.foot.hidden = true;
      return;
    }

    el.items.innerHTML = cart.map(function (i) {
      return '' +
        '<li class="cart-row">' +
          '<img src="' + imgPath(i.image) + '" alt="' + esc(i.name) + '">' +
          '<div style="flex:1">' +
            '<p class="cart-row__name">' + esc(i.name) + '</p>' +
            (i.variant ? '<p class="cart-row__variant">Size: ' + esc(i.variant) + '</p>' : '') +
            '<div class="cart-row__tools">' +
              '<span class="qty">' +
                '<button type="button" data-qty="-1" data-line="' + esc(i.line) + '" aria-label="Decrease">&minus;</button>' +
                '<span>' + i.qty + '</span>' +
                '<button type="button" data-qty="1" data-line="' + esc(i.line) + '" aria-label="Increase">+</button>' +
              '</span>' +
              '<span class="cart-row__price">' + money(i.price * i.qty) + '</span>' +
            '</div>' +
            '<button type="button" class="link-remove" data-remove="' + esc(i.line) + '">Remove</button>' +
          '</div>' +
        '</li>';
    }).join('');

    if (el.foot) {
      el.foot.hidden = false;
      var total = subtotal();
      if (el.total) el.total.textContent = money(total);
      if (el.note) {
        var left = FREE_SHIPPING - total;
        el.note.textContent = left > 0
          ? money(left) + ' away from free shipping.'
          : 'Free shipping unlocked.';
      }
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function imgPath(src) {
    if (!src) return '';
    if (/^(https?:|\/|data:)/.test(src)) return src;
    var root = document.body.getAttribute('data-root') || '';
    return root + src.replace(/^\.\.\//, '');
  }

  /* ---------------------------------------------------------- drawer */
  var lastFocus = null;

  function openDrawer() {
    if (!el.drawer) return;
    lastFocus = document.activeElement;
    el.drawer.classList.add('is-open');
    el.drawer.setAttribute('aria-hidden', 'false');
    if (el.backdrop) el.backdrop.classList.add('is-open');
    document.body.classList.add('no-scroll');
    var c = $('.drawer__close', el.drawer);
    if (c) c.focus();
  }
  function closeDrawer() {
    if (!el.drawer) return;
    el.drawer.classList.remove('is-open');
    el.drawer.setAttribute('aria-hidden', 'true');
    if (el.backdrop) el.backdrop.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function toast(html) {
    if (!el.toast) return;
    el.toast.innerHTML = html;
    el.toast.classList.add('is-visible');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.toast.classList.remove('is-visible'); }, 2600);
  }

  /* ------------------------------------------------------------- wire */
  function wire() {
    $$('[data-cart-open]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); openDrawer(); });
    });
    if (el.backdrop) el.backdrop.addEventListener('click', closeDrawer);
    var close = $('#cartClose');
    if (close) close.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

    // mobile nav
    var toggle = $('#navToggle'), nav = $('#siteNav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    // add to cart
    $$('[data-add]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var variant = btn.getAttribute('data-variant') || '';
        var vField = btn.getAttribute('data-variant-field');
        if (vField) {
          var f = $(vField);
          if (f && !f.value) {
            f.focus();
            toast('<strong>Pick a size</strong> first');
            return;
          }
          if (f) variant = f.value;
        }
        var qty = 1;
        var qField = btn.getAttribute('data-qty-field');
        if (qField) {
          var q = $(qField);
          if (q) qty = Math.max(1, parseInt(q.value, 10) || 1);
        }
        addItem({
          id: btn.getAttribute('data-id'),
          name: btn.getAttribute('data-name'),
          price: parseFloat(btn.getAttribute('data-price')) || 0,
          image: btn.getAttribute('data-image'),
          variant: variant,
          qty: qty
        });
        if (btn.getAttribute('data-open-drawer') === 'true') openDrawer();
      });
    });

    // drawer line actions
    if (el.items) {
      el.items.addEventListener('click', function (e) {
        var t = e.target;
        var q = t.closest && t.closest('[data-qty]');
        if (q) {
          var line = q.getAttribute('data-line');
          var cur = 0;
          cart.forEach(function (i) { if (i.line === line) cur = i.qty; });
          setQty(line, cur + parseInt(q.getAttribute('data-qty'), 10));
          return;
        }
        var r = t.closest && t.closest('[data-remove]');
        if (r) removeLine(r.getAttribute('data-remove'));
      });
    }

    // gallery
    var main = $('#galleryMain');
    $$('.thumbs img').forEach(function (t) {
      t.addEventListener('click', function () {
        $$('.thumbs img').forEach(function (o) { o.classList.remove('is-active'); });
        t.classList.add('is-active');
        if (main) { main.src = t.getAttribute('data-full') || t.src; main.alt = t.alt; }
      });
    });

    // mock checkout
    var checkout = $('#cartCheckout');
    if (checkout) {
      checkout.addEventListener('click', function () {
        if (!cart.length) return;
        toast('<strong>Demo only.</strong> Checkout isn\u2019t connected to a real store.');
      });
    }
  }

  function init() { cache(); wire(); render(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { cart = load(); render(); }
  });
})();
