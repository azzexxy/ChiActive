/* ==========================================================================
   ChiActive — Demonstration Shopping Cart
   Client-side cart persisted in localStorage. No dependencies, no network.
   Drop this on any page with:  <script src="cart.js" data-base=""></script>
   (use data-base="../" from pages inside a subfolder)
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'chiactive_cart_v1';
  var script = document.currentScript;
  var BASE = (script && script.getAttribute('data-base')) || '';

  /* ---------- State ---------- */
  function read() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) {}
    render();
  }

  function lineKey(id, size, color) { return id + '::' + (size || '') + '::' + (color || ''); }

  function add(product, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var items = read();
    var key = lineKey(product.id, product.size, product.color);
    var found = null;
    for (var i = 0; i < items.length; i++) {
      if (lineKey(items[i].id, items[i].size, items[i].color) === key) { found = items[i]; break; }
    }
    if (found) {
      found.qty += qty;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        image: product.image || '',
        size: product.size || '',
        color: product.color || '',
        qty: qty
      });
    }
    write(items);
    open();
  }

  function setQty(key, qty) {
    var items = read();
    qty = parseInt(qty, 10) || 0;
    for (var i = 0; i < items.length; i++) {
      if (lineKey(items[i].id, items[i].size, items[i].color) === key) {
        if (qty <= 0) { items.splice(i, 1); } else { items[i].qty = qty; }
        break;
      }
    }
    write(items);
  }

  function remove(key) {
    var items = read();
    items = items.filter(function (it) { return lineKey(it.id, it.size, it.color) !== key; });
    write(items);
  }

  function count() {
    return read().reduce(function (n, it) { return n + it.qty; }, 0);
  }
  function subtotal() {
    return read().reduce(function (n, it) { return n + it.qty * it.price; }, 0);
  }

  /* ---------- Helpers ---------- */
  function money(n) {
    return '$' + Number(n).toFixed(2);
  }
  function img(src) {
    if (!src) { return ''; }
    if (/^(https?:)?\/\//.test(src) || src.charAt(0) === '/') { return src; }
    return BASE + src;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /* ---------- Drawer markup ---------- */
  function buildDrawer() {
    if (document.querySelector('.cart-drawer')) { return; }

    var overlay = document.createElement('div');
    overlay.className = 'cart-overlay';
    overlay.setAttribute('data-cart-close', '');

    var drawer = document.createElement('aside');
    drawer.className = 'cart-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'Shopping cart');
    drawer.innerHTML =
      '<div class="cart-drawer-head">' +
        '<h2 class="cart-drawer-title">Your cart</h2>' +
        '<button type="button" class="cart-close" data-cart-close aria-label="Close cart">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="cart-items" aria-live="polite"></div>' +
      '<div class="cart-drawer-foot">' +
        '<div class="cart-subtotal"><span>Subtotal</span><strong data-cart-subtotal>$0.00</strong></div>' +
        '<p class="cart-note">Free campus pickup &middot; taxes calculated at checkout.</p>' +
        '<button type="button" class="btn btn-primary cart-checkout">Checkout</button>' +
        '<p class="cart-msg" role="status"></p>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    drawer.addEventListener('click', function (e) {
      var t = e.target.closest('[data-cart-action]');
      if (!t) { return; }
      var key = t.getAttribute('data-key');
      var action = t.getAttribute('data-cart-action');
      if (action === 'remove') { remove(key); }
      if (action === 'dec' || action === 'inc') {
        var items = read();
        for (var i = 0; i < items.length; i++) {
          if (lineKey(items[i].id, items[i].size, items[i].color) === key) {
            setQty(key, items[i].qty + (action === 'inc' ? 1 : -1));
            break;
          }
        }
      }
    });

    drawer.querySelector('.cart-checkout').addEventListener('click', function () {
      var msg = drawer.querySelector('.cart-msg');
      if (!read().length) { msg.textContent = 'Your cart is empty — add some gear first.'; return; }
      msg.textContent = 'Demo checkout complete. Thanks for going ChiActive!';
    });

    // Open / close
    document.addEventListener('click', function (e) {
      var opener = e.target.closest('.cart-link, [data-cart-open]');
      if (opener) { e.preventDefault(); open(); return; }
      if (e.target.closest('[data-cart-close]')) { e.preventDefault(); close(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); }
    });
  }

  /* Upgrade legacy "Cart (0)" header links to a live badge + drawer trigger */
  function upgradeLegacyCartLinks() {
    var links = document.querySelectorAll('a[href="#"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.classList.contains('cart-link')) { continue; }
      if (!/cart/i.test(a.textContent)) { continue; }
      a.classList.add('cart-link');
      a.setAttribute('aria-label', 'Open cart');
      if (!a.querySelector('.cart-count')) {
        a.innerHTML = 'Cart <span class="cart-count">0</span>';
      }
    }
  }

  function open() {
    buildDrawer();    document.querySelector('.cart-drawer').classList.add('is-open');
    document.querySelector('.cart-overlay').classList.add('is-open');
    document.body.classList.add('cart-open');
  }
  function close() {
    var d = document.querySelector('.cart-drawer');
    var o = document.querySelector('.cart-overlay');
    if (d) { d.classList.remove('is-open'); }
    if (o) { o.classList.remove('is-open'); }
    document.body.classList.remove('cart-open');
  }

  /* ---------- Render ---------- */
  function render() {
    buildDrawer();
    var items = read();

    // Counter badges
    var n = count();
    var badges = document.querySelectorAll('.cart-count');
    for (var i = 0; i < badges.length; i++) { badges[i].textContent = n; }

    // Item list
    var list = document.querySelector('.cart-items');
    if (!list) { return; }
    if (!items.length) {
      list.innerHTML = '<div class="cart-empty"><p>Your cart is empty.</p><p class="cart-empty-sub">Gear up for the four-season city.</p></div>';
    } else {
      list.innerHTML = items.map(function (it) {
        var key = esc(lineKey(it.id, it.size, it.color));
        return '<div class="cart-item">' +
          '<div class="cart-item-media">' +
            (it.image
              ? '<img src="' + esc(img(it.image)) + '" alt="' + esc(it.name) + '">'
              : '<span class="cart-item-noimg">No image</span>') +
          '</div>' +
          '<div class="cart-item-body">' +
            '<p class="cart-item-name">' + esc(it.name) + '</p>' +
            (it.size || it.color
              ? '<p class="cart-item-meta">' +
                  (it.size ? 'Size: ' + esc(it.size) : '') +
                  (it.size && it.color ? ' &middot; ' : '') +
                  (it.color ? 'Color: ' + esc(it.color) : '') +
                '</p>'
              : '') +
            '<p class="cart-item-price">' + money(it.price) + '</p>' +
            '<div class="cart-item-controls">' +
              '<button type="button" class="qty-btn" data-cart-action="dec" data-key="' + key + '" aria-label="Decrease quantity">&minus;</button>' +
              '<span class="qty-val">' + it.qty + '</span>' +
              '<button type="button" class="qty-btn" data-cart-action="inc" data-key="' + key + '" aria-label="Increase quantity">+</button>' +
              '<button type="button" class="cart-remove" data-cart-action="remove" data-key="' + key + '">Remove</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    var st = document.querySelector('[data-cart-subtotal]');
    if (st) { st.textContent = money(subtotal()); }
  }

  /* ---------- Add-to-cart buttons (delegated) ---------- */
  function handleAdd(btn) {
    var product = {
      id: btn.getAttribute('data-id') || slug(btn.getAttribute('data-name') || 'item'),
      name: btn.getAttribute('data-name') || 'ChiActive item',
      price: btn.getAttribute('data-price') || '0',
      image: btn.getAttribute('data-image') || '',
      size: btn.getAttribute('data-size') || '',
      color: btn.getAttribute('data-color') || ''
    };
    // If the catalog has a photo for this colorway, use it as the cart thumbnail
    if (window.ChiCatalog && product.color) {
      var p = window.ChiCatalog.get(product.id);
      if (p && p.variants && p.variants[product.color]) { product.image = p.variants[product.color]; }
    }
    // Pick up a size/quantity from the nearest form, if present
    var scope = btn.closest('.buybox, .product-card, form') || document;
    var sizeEl = scope.querySelector('select[name="size"], select#size');
    if (sizeEl && sizeEl.value && !/choose/i.test(sizeEl.value)) { product.size = sizeEl.value; }
    var qtyEl = scope.querySelector('input[name="qty"], input#qty');
    var qty = qtyEl ? qtyEl.value : 1;
    add(product, qty);

    var original = btn.innerHTML;
    btn.classList.add('is-added');
    btn.innerHTML = 'Added ✓';
    setTimeout(function () { btn.classList.remove('is-added'); btn.innerHTML = original; }, 1200);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add-to-cart]');
    if (btn) { e.preventDefault(); handleAdd(btn); }
  });

  /* ---------- Init ---------- */
  function init() {
    buildDrawer();
    upgradeLegacyCartLinks();
    render();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // Keep multiple tabs in sync
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) { render(); }
  });

  // Public API
  window.ChiCart = { add: add, remove: remove, setQty: setQty, open: open, close: close, count: count, subtotal: subtotal, render: render };
})();
