/* ChiActive — client-side demo cart + mobile navigation
   Persists to localStorage under chiactive_cart_v1.
   All "checkout" behaviour is a mock — this is a design activity, not a live store. */

(function () {
  'use strict';

  var STORAGE_KEY = 'chiactive_cart_v1';
  var FREE_SHIPPING = 75;

  /* ---------------------------------------------------------------- helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function money(n) {
    return '$' + Number(n).toFixed(2);
  }

  function basePath() {
    // Pages in subfolders (e.g. /pants/) declare <body data-root="../">.
    var root = document.body.getAttribute('data-root') || '';
    return root;
  }

  function resolveImage(src) {
    if (!src) return '';
    if (/^(https?:|\/|data:)/.test(src)) return src;
    return basePath() + src.replace(/^\.\.\//, '');
  }

  /* ------------------------------------------------------------- cart state */
  var cart = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (err) {
      /* storage unavailable (private mode) — cart stays in memory */
    }
  }

  function itemCount() {
    return cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function subtotal() {
    return cart.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
  }

  function lineId(item) {
    return item.id + '::' + (item.variant || 'one-size');
  }

  function addItem(product) {
    var id = product.id + '::' + (product.variant || 'one-size');
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].lineId === id) { existing = cart[i]; break; }
    }
    if (existing) {
      existing.qty += product.qty;
    } else {
      cart.push({
        lineId: id,
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        variant: product.variant || '',
        qty: product.qty
      });
    }
    save();
    render();
    announce(product.name);
  }

  function setQty(lineIdValue, nextQty) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].lineId === lineIdValue) {
        cart[i].qty = Math.max(0, nextQty);
        if (cart[i].qty === 0) cart.splice(i, 1);
        break;
      }
    }
    save();
    render();
  }

  function removeLine(lineIdValue) {
    cart = cart.filter(function (item) { return item.lineId !== lineIdValue; });
    save();
    render();
  }

  /* ---------------------------------------------------------------- render */
  var els = {};

  function cacheEls() {
    els.drawer = $('#cartDrawer');
    els.backdrop = $('#cartBackdrop');
    els.items = $('#cartItems');
    els.foot = $('#cartFoot');
    els.subtotal = $('#cartSubtotal');
    els.shippingNote = $('#cartShippingNote');
    els.counts = $$('[data-cart-count]');
    els.toast = $('#toast');
    els.triggers = $$('[data-cart-open]');
  }

  function render() {
    var count = itemCount();

    els.counts.forEach(function (el) {
      el.textContent = count;
      el.setAttribute('data-empty', count === 0 ? 'true' : 'false');
      el.setAttribute('aria-label', count + (count === 1 ? ' item' : ' items') + ' in cart');
    });

    if (!els.items) return;

    if (cart.length === 0) {
      els.items.innerHTML =
        '<li class="cart-empty">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
        '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6"/>' +
        '<circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>' +
        '<p>Your cart is empty. Time to gear up for the four-season city.</p>' +
        '<a class="btn btn-primary btn-sm" href="' + basePath() + 'shop.html">Start shopping</a>' +
        '</li>';
      if (els.foot) els.foot.hidden = true;
      return;
    }

    els.items.innerHTML = cart.map(function (item) {
      return '' +
        '<li class="cart-item">' +
          '<img src="' + resolveImage(item.image) + '" alt="' + escapeAttr(item.name) + '">' +
          '<div>' +
            '<p class="cart-item__name">' + escapeHtml(item.name) + '</p>' +
            (item.variant ? '<p class="cart-item__variant">Size: ' + escapeHtml(item.variant) + '</p>' : '') +
            '<div class="cart-item__row">' +
              '<span class="qty-control">' +
                '<button type="button" data-cart-qty="-1" data-line="' + escapeAttr(item.lineId) + '" aria-label="Decrease quantity">&minus;</button>' +
                '<span>' + item.qty + '</span>' +
                '<button type="button" data-cart-qty="1" data-line="' + escapeAttr(item.lineId) + '" aria-label="Increase quantity">+</button>' +
              '</span>' +
              '<span class="cart-item__price">' + money(item.price * item.qty) + '</span>' +
            '</div>' +
            '<button type="button" class="cart-item__remove" data-cart-remove="' + escapeAttr(item.lineId) + '">Remove</button>' +
          '</div>' +
        '</li>';
    }).join('');

    if (els.foot) {
      els.foot.hidden = false;
      var total = subtotal();
      if (els.subtotal) els.subtotal.textContent = money(total);
      if (els.shippingNote) {
        var left = FREE_SHIPPING - total;
        els.shippingNote.textContent = left > 0
          ? money(left) + ' away from free shipping.'
          : 'You unlocked free shipping. Nice work.';
      }
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeAttr(str) { return escapeHtml(str); }

  /* ---------------------------------------------------------- drawer + nav */
  var lastFocused = null;

  function openDrawer() {
    if (!els.drawer) return;
    lastFocused = document.activeElement;
    els.drawer.classList.add('is-open');
    els.drawer.setAttribute('aria-hidden', 'false');
    if (els.backdrop) els.backdrop.classList.add('is-open');
    document.body.classList.add('no-scroll');
    var close = $('.cart-close', els.drawer);
    if (close) close.focus();
  }

  function closeDrawer() {
    if (!els.drawer) return;
    els.drawer.classList.remove('is-open');
    els.drawer.setAttribute('aria-hidden', 'true');
    if (els.backdrop) els.backdrop.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function announce(name) {
    if (!els.toast) return;
    els.toast.innerHTML = '<strong>' + escapeHtml(name) + '</strong> added to cart';
    els.toast.classList.add('is-visible');
    clearTimeout(announce.timer);
    announce.timer = setTimeout(function () {
      els.toast.classList.remove('is-visible');
    }, 2600);
  }

  function initNav() {
    var toggle = $('#navToggle');
    var nav = $('#siteNav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('a', nav).forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* -------------------------------------------------------------- add-to-cart */
  function wire() {
    // Header cart buttons
    els.triggers.forEach(function (btn) { btn.addEventListener('click', function (e) { e.preventDefault(); openDrawer(); }); });
    if (els.backdrop) els.backdrop.addEventListener('click', closeDrawer);
    var close = $('#cartClose');
    if (close) close.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    // Product card / related product buttons
    $$('[data-add-to-cart]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var variant = btn.getAttribute('data-variant') || '';
        var variantField = btn.getAttribute('data-variant-field');
        if (variantField) {
          var field = $(variantField);
          if (field && !field.value) {
            field.focus();
            field.style.borderColor = 'var(--c-red)';
            if (els.toast) {
              els.toast.innerHTML = '<strong>Pick a size</strong> before adding to cart';
              els.toast.classList.add('is-visible');
              setTimeout(function () { els.toast.classList.remove('is-visible'); }, 2600);
            }
            return;
          }
          if (field) variant = field.value;
        }
        var qtyField = btn.getAttribute('data-qty-field');
        var qty = 1;
        if (qtyField) {
          var q = $(qtyField);
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

    // Drawer line items (event delegation)
    if (els.items) {
      els.items.addEventListener('click', function (e) {
        var qtyBtn = e.target.closest ? e.target.closest('[data-cart-qty]') : null;
        if (qtyBtn) {
          var line = qtyBtn.getAttribute('data-line');
          var delta = parseInt(qtyBtn.getAttribute('data-cart-qty'), 10);
          var current = 0;
          cart.forEach(function (item) { if (item.lineId === line) current = item.qty; });
          setQty(line, current + delta);
          return;
        }
        var removeBtn = e.target.closest ? e.target.closest('[data-cart-remove]') : null;
        if (removeBtn) {
          removeLine(removeBtn.getAttribute('data-cart-remove'));
        }
      });
    }

    // Product page gallery thumbnails
    var main = $('#galleryMain');
    $$('.gallery .thumbs img').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        $$('.gallery .thumbs img').forEach(function (t) { t.classList.remove('is-active'); });
        thumb.classList.add('is-active');
        if (main) {
          main.src = thumb.getAttribute('data-full') || thumb.src;
          main.alt = thumb.alt || main.alt;
        }
      });
    });

    // Mock checkout
    var checkout = $('#cartCheckout');
    if (checkout) {
      checkout.addEventListener('click', function () {
        if (cart.length === 0) return;
        if (els.toast) {
          els.toast.innerHTML = '<strong>Demo only.</strong> Checkout is not connected to a real store.';
          els.toast.classList.add('is-visible');
          setTimeout(function () { els.toast.classList.remove('is-visible'); }, 3200);
        }
      });
    }
  }

  /* ------------------------------------------------------------------ boot */
  function init() {
    cacheEls();
    initNav();
    wire();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Keep the badge in sync across open tabs.
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) {
      cart = load();
      render();
    }
  });
})();
