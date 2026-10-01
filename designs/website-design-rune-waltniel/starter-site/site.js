/* =====================================================================
   ChiActive site script
   - Injects a consistent branded header + footer on every page
   - Mobile hamburger navigation
   - Shopping cart persisted in localStorage, with a slide-over drawer
   - Renders category grids and product detail pages from products.js
   Works over http://localhost:8000 AND when opened directly as a file.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     1. Work out the path back to the site root
     --------------------------------------------------------------- */
  var SELF = (document.currentScript && document.currentScript.src) || '';
  var BASE = '';
  try {
    var rootParts = new URL('.', SELF).pathname.split('/').filter(Boolean);
    var pageParts = new URL('.', location.href).pathname.split('/').filter(Boolean);
    var i = 0;
    while (i < rootParts.length && i < pageParts.length && rootParts[i] === pageParts[i]) { i++; }
    BASE = new Array(Math.max(0, pageParts.length - i) + 1).join('../');
  } catch (e) { BASE = ''; }

  function asset(p) { return p ? BASE + p : ''; }
  function link(p)  { return BASE + p; }

  /* ---------------------------------------------------------------
     2. Data helpers
     --------------------------------------------------------------- */
  var PRODUCTS   = window.CHIACTIVE_PRODUCTS   || [];
  var CATEGORIES = window.CHIACTIVE_CATEGORIES || [];
  var SEASONS    = window.CHIACTIVE_SEASONS    || {};
  var SEASON_KEY = window.CHIACTIVE_CURRENT_SEASON || '';
  var SEASON     = SEASONS[SEASON_KEY] || null;

  function money(n) { return '$' + Number(n).toFixed(2); }
  function product(sku) {
    for (var i = 0; i < PRODUCTS.length; i++) { if (PRODUCTS[i].sku === sku) { return PRODUCTS[i]; } }
    return null;
  }
  function byCategory(slug) {
    return PRODUCTS.filter(function (p) { return p.category === slug; });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function media(p, cls) {
    if (p.image) { return '<img class="' + cls + '" src="' + asset(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">'; }
    return '<div class="img-placeholder ' + cls + '">No image yet</div>';
  }

  /* ---------------------------------------------------------------
     3. Cart (localStorage)
     --------------------------------------------------------------- */
  var CART_KEY = 'chiactive_cart_v1';
  var cart = [];

  function loadCart() {
    try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { cart = []; }
    if (!Array.isArray(cart)) { cart = []; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
    paintCart();
  }
  function cartCount() {
    return cart.reduce(function (n, l) { return n + l.qty; }, 0);
  }
  function cartSubtotal() {
    return cart.reduce(function (n, l) { return n + (l.price * l.qty); }, 0);
  }
  function keyOf(l) { return l.sku + '::' + (l.size || ''); }

  function addToCart(sku, size, qty) {
    var p = product(sku);
    if (!p) { return; }
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var line = { sku: sku, size: size || '', qty: qty, price: effectivePrice(p), name: p.name, image: p.image };
    var k = keyOf(line);
    var found = null;
    for (var i = 0; i < cart.length; i++) { if (keyOf(cart[i]) === k) { found = cart[i]; break; } }
    if (found) { found.qty += qty; } else { cart.push(line); }
    saveCart();
    toast(p.name + ' added to cart');
    openCart();
  }
  function setQty(k, qty) {
    for (var i = 0; i < cart.length; i++) {
      if (keyOf(cart[i]) === k) {
        cart[i].qty = Math.max(0, parseInt(qty, 10) || 0);
        if (cart[i].qty === 0) { cart.splice(i, 1); }
        break;
      }
    }
    saveCart();
  }
  function removeLine(k) {
    cart = cart.filter(function (l) { return keyOf(l) !== k; });
    saveCart();
  }

  /* ---------------------------------------------------------------
     4. Header / footer
     --------------------------------------------------------------- */
  var NAV = [
    { href: 'shop.html',       label: 'Shop' },
    { href: 'jackets/index.html', label: 'Jackets' },
    { href: 'pants/index.html',   label: 'Pants' },
    { href: 'season.html',        label: SEASON ? SEASON.name + ' Picks' : 'Seasonal' },
    { href: 'blog/index.html',    label: 'Blog' },
    { href: 'about.html',         label: 'About' }
  ];

  function currentPath() {
    return location.pathname.replace(/\\/g, '/').replace(/^.*?starter-site\//, '');
  }

  var BANNER_KEY = 'chiactive_banner_' + (SEASON ? SEASON.key : 'none');

  /* The six-pointed Chicago-flag star from the ChiActive mark, reused
     as the site's accent motif. */
  var STAR_PATH = 'M12 2 14.9 7 20.7 7 17.8 12 20.7 17 14.9 17 12 22 9.1 17 3.3 17 6.2 12 3.3 7 9.1 7Z';

  function starIcon(cls) {
    return '<svg class="star' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="currentColor" d="' + STAR_PATH + '"/></svg>';
  }

  function buildSeasonBanner() {
    if (!SEASON) { return ''; }
    try { if (localStorage.getItem(BANNER_KEY) === '1') { return ''; } } catch (e) {}
    return '<div class="season-banner" data-season-banner>' +
      '<div class="container season-banner-inner">' +
        starIcon() +
        '<span class="season-banner-text"><strong>' + esc(SEASON.discountLabel) + '</strong> ' +
          '&mdash; ' + SEASON.discountPct + '% off every ' + esc(SEASON.name) + ' pick through ' + esc(SEASON.ends) + '.</span>' +
        '<a class="season-banner-link" href="' + link('season.html') + '">What you need for ' +
          esc(SEASON.name) + ' &rarr;</a>' +
        '<button class="season-banner-close" type="button" data-dismiss-banner ' +
          'aria-label="Dismiss announcement">&times;</button>' +
      '</div>' +
    '</div>';
  }

  function buildHeader() {
    var here = currentPath();
    var items = NAV.map(function (n) {
      var active = (here === n.href) || (n.href !== 'shop.html' && here.indexOf(n.href.replace('index.html', '')) === 0 && n.href.indexOf('index.html') > -1) ? ' class="is-active"' : '';
      return '<a href="' + link(n.href) + '"' + active + '>' + n.label + '</a>';
    }).join('');

    return '' +
      '<a class="skip-link" href="#main">Skip to content</a>' +
      '<header class="site-header">' +
        '<div class="container header-inner">' +
          '<a class="brand" href="' + link('index.html') + '">' +
            '<img class="brand-logo" src="' + asset('images/logo-v1.png') + '" alt="">' +
            '<span class="brand-name">ChiActive</span>' +
          '</a>' +
          '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Toggle navigation menu">' +
            '<span></span><span></span><span></span>' +
          '</button>' +
          '<nav class="site-nav" id="primary-nav" aria-label="Primary">' + items + '</nav>' +
          '<button class="cart-btn" type="button" data-open-cart aria-label="Open cart">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>' +
              '<path d="M2 3h3l2.4 12.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L21 7H6"/>' +
            '</svg>' +
            '<span class="cart-label">Cart</span>' +
            '<span class="cart-count" data-cart-count>0</span>' +
          '</button>' +
        '</div>' +
      '</header>' +
      buildSeasonBanner();
  }

  function buildFooter() {
    var cats = CATEGORIES.map(function (c) {
      return '<a href="' + link(c.slug + '/index.html') + '">' + esc(c.name) + '</a>';
    }).join('');
    return '' +
      '<footer class="site-footer">' +
        '<div class="container footer-grid">' +
          '<div class="footer-brand">' +
            '<img class="brand-logo" src="' + asset('images/logo-v1.png') + '" alt="ChiActive">' +
            '<p class="footer-tagline">Built for the four-season city.</p>' +
            '<p class="footer-note">The lake wind doesn&rsquo;t care about your plans. Your jacket should.</p>' +
          '</div>' +
          '<div class="footer-col"><h4>Shop</h4>' + cats + '</div>' +
          '<div class="footer-col"><h4>Explore</h4>' +
            '<a href="' + link('blog/index.html') + '">Blog</a>' +
            '<a href="' + link('about.html') + '">About</a>' +
            '<a href="' + link('shop.html') + '">All Products</a>' +
          '</div>' +
          '<div class="footer-col"><h4>Help</h4>' +
            '<a href="' + link('about.html') + '#contact">Contact</a>' +
            '<a href="' + link('about.html') + '#faq">FAQ</a>' +
            '<a href="' + link('about.html') + '#contact">Shipping &amp; Returns</a>' +
          '</div>' +
        '</div>' +
        '<div class="container footer-bottom">' +
          '<span>&copy; 2026 ChiActive. A student design project.</span>' +
          '<span>Chicago, IL &middot; Study. Commute. Explore.</span>' +
        '</div>' +
      '</footer>';
  }

  /* ---------------------------------------------------------------
     5. Cart drawer + toast
     --------------------------------------------------------------- */
  function buildDrawer() {
    return '' +
      '<div class="cart-overlay" data-close-cart hidden></div>' +
      '<aside class="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping cart" hidden>' +
        '<header class="cart-drawer-head">' +
          '<h2>Your Cart</h2>' +
          '<button class="cart-close" type="button" data-close-cart aria-label="Close cart">&times;</button>' +
        '</header>' +
        '<div class="cart-items" data-cart-items></div>' +
        '<div class="cart-drawer-foot">' +
          '<div class="cart-subtotal"><span>Subtotal</span><strong data-cart-subtotal>' + money(0) + '</strong></div>' +
          '<p class="cart-ship-note" data-cart-ship></p>' +
          '<button class="btn btn-primary btn-block" type="button" data-checkout>Checkout</button>' +
          '<button class="btn btn-ghost btn-block" type="button" data-close-cart>Continue shopping</button>' +
        '</div>' +
      '</aside>' +
      '<div class="toast" data-toast role="status" aria-live="polite" hidden></div>';
  }

  function renderItems() {
    var box = document.querySelector('[data-cart-items]');
    if (!box) { return; }
    if (!cart.length) {
      box.innerHTML = '<div class="cart-empty">' +
        '<p>Your cart is empty.</p>' +
        '<a class="btn btn-primary" href="' + link('shop.html') + '">Start shopping</a></div>';
      return;
    }
    box.innerHTML = cart.map(function (l) {
      var k = esc(keyOf(l));
      var thumb = l.image
        ? '<img src="' + asset(l.image) + '" alt="">'
        : '<div class="img-placeholder"></div>';
      return '<div class="cart-line">' +
        '<div class="cart-line-media">' + thumb + '</div>' +
        '<div class="cart-line-body">' +
          '<p class="cart-line-name">' + esc(l.name) + '</p>' +
          (l.size ? '<p class="cart-line-meta">Size: ' + esc(l.size) + '</p>' : '') +
          '<p class="cart-line-meta">' + money(l.price) + '</p>' +
          '<div class="qty-row">' +
            '<button type="button" data-dec="' + k + '" aria-label="Decrease quantity">&minus;</button>' +
            '<input type="text" inputmode="numeric" value="' + l.qty + '" data-qty="' + k + '" aria-label="Quantity">' +
            '<button type="button" data-inc="' + k + '" aria-label="Increase quantity">+</button>' +
            '<button class="cart-remove" type="button" data-remove="' + k + '">Remove</button>' +
          '</div>' +
        '</div>' +
        '<div class="cart-line-total">' + money(l.price * l.qty) + '</div>' +
      '</div>';
    }).join('');
  }

  function paintCart() {
    var n = cartCount();
    Array.prototype.forEach.call(document.querySelectorAll('[data-cart-count]'), function (el) {
      el.textContent = n;
      el.classList.toggle('is-empty', n === 0);
    });
    var sub = document.querySelector('[data-cart-subtotal]');
    if (sub) { sub.textContent = money(cartSubtotal()); }
    var ship = document.querySelector('[data-cart-ship]');
    if (ship) {
      var left = 75 - cartSubtotal();
      ship.textContent = (cart.length && left > 0)
        ? 'Add ' + money(left) + ' more for free shipping.'
        : (cart.length ? 'You&rsquo;ve unlocked free shipping.' : '');
    }
    renderItems();
  }

  function openCart() {
    var d = document.querySelector('.cart-drawer');
    var o = document.querySelector('.cart-overlay');
    if (!d) { return; }
    d.hidden = false; o.hidden = false;
    requestAnimationFrame(function () { d.classList.add('is-open'); o.classList.add('is-open'); });
    document.body.classList.add('no-scroll');
  }
  function closeCart() {
    var d = document.querySelector('.cart-drawer');
    var o = document.querySelector('.cart-overlay');
    if (!d) { return; }
    d.classList.remove('is-open'); o.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    setTimeout(function () { d.hidden = true; o.hidden = true; }, 220);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.querySelector('[data-toast]');
    if (!t) { return; }
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(function () { t.classList.add('is-open'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove('is-open');
      setTimeout(function () { t.hidden = true; }, 250);
    }, 2200);
  }

  /* ---------------------------------------------------------------
     6. Grid + product rendering
     --------------------------------------------------------------- */
  function card(p) {
    var price = priceBlock(p);
    var tags = (p.tags || []).slice(0, 2).map(function (t) {
      return '<span class="tag">' + esc(t) + '</span>';
    }).join('');
    return '<article class="product-card">' +
      badgeFor(p) +
      '<a class="product-card-media" href="' + link(p.url) + '">' + media(p, '') + '</a>' +
      '<div class="product-card-body">' +
        '<h3><a href="' + link(p.url) + '">' + esc(p.name) + '</a></h3>' +
        price +
        (tags ? '<div class="tags">' + tags + '</div>' : '') +
        '<button class="btn btn-primary btn-sm btn-block" type="button" data-add-to-cart="' + esc(p.sku) + '">Add to Cart</button>' +
      '</div>' +
    '</article>';
  }

  function grid(list, cols) {
    if (!list.length) { return '<p class="page-intro">No products in this collection yet.</p>'; }
    return '<div class="product-grid' + (cols ? ' cols-' + cols : '') + '">' + list.map(card).join('') + '</div>';
  }

  /* One category tile, used on both the homepage and the shop page so the
     wording and the fallback treatment can never drift apart. */
  function categoryTile(c) {
    var list = byCategory(c.slug);
    var first = list[0];
    var n = list.length;
    var photo = first && first.image;
    return '<a class="tile' + (photo ? ' tile-photo' : ' tile-plain') + '" ' +
        'href="' + link(c.slug + '/index.html') + '"' +
        (photo ? ' style="background-image:url(' + asset(first.image) + ')"' : '') + '>' +
      (photo ? '' : '<span class="tile-watermark" aria-hidden="true"></span>') +
      '<span class="tile-body">' +
        '<span class="tile-name">' + esc(c.name) + '</span>' +
        '<span class="tile-count">' + n + (n === 1 ? ' item' : ' items') + '</span>' +
      '</span>' +
    '</a>';
  }

  function renderProductDetail(root) {
    var sku = root.getAttribute('data-product-sku') || root.getAttribute('data-sku');
    var p = product(sku);
    if (!p) { root.innerHTML = '<h1>Product not found</h1><p><a href="' + link('shop.html') + '">Back to shop</a></p>'; return; }

    var cat = CATEGORIES.filter(function (c) { return c.slug === p.category; })[0];
    var catName = cat ? cat.name : p.category;
    var gallery = (p.gallery && p.gallery.length ? p.gallery : (p.image ? [p.image] : []));
    var mainImg = gallery.length
      ? '<img id="gallery-main" class="gallery-main" src="' + asset(gallery[0]) + '" alt="' + esc(p.name) + '">'
      : '<div class="img-placeholder gallery-main">No image yet</div>';
    var thumbs = gallery.length > 1 ? '<div class="thumbs">' + gallery.map(function (g, idx) {
      return '<button type="button" class="thumb' + (idx === 0 ? ' is-active' : '') + '" data-thumb="' + asset(g) + '">' +
        '<img src="' + asset(g) + '" alt=""></button>';
    }).join('') + '</div>' : '';

    var swatches = (p.swatches && p.swatches.length) ? '<fieldset class="variant"><legend>Color</legend><div class="swatches">' +
      p.swatches.map(function (s, idx) {
        return '<button type="button" class="swatch' + (idx === 0 ? ' is-active' : '') + '" data-thumb="' + asset(s.image) + '" title="' + esc(s.name) + '">' +
          '<img src="' + asset(s.image) + '" alt="' + esc(s.name) + '"><span>' + esc(s.name) + '</span></button>';
      }).join('') + '</div></fieldset>' : '';

    var sizes = (p.sizes && p.sizes.length) ? '<fieldset class="variant"><legend>Size</legend><div class="pills">' +
      p.sizes.map(function (s, idx) {
        return '<button type="button" class="pill' + (idx === 0 ? ' is-active' : '') + '" data-size-pill="' + esc(s) + '">' + esc(s) + '</button>';
      }).join('') + '</div></fieldset>' : '';

    var specRows = Object.keys(p.specs || {}).map(function (k) {
      return '<tr><th scope="row">' + esc(k) + '</th><td>' + esc(p.specs[k]) + '</td></tr>';
    }).join('');

    var related = PRODUCTS.filter(function (x) { return x.category === p.category && x.sku !== p.sku; });
    if (related.length < 3) {
      related = related.concat(PRODUCTS.filter(function (x) { return x.category !== p.category && x.featured; }));
    }
    related = related.slice(0, 4);

    root.innerHTML = '' +
      '<p class="breadcrumb"><a href="' + link('index.html') + '">Home</a> / ' +
        '<a href="' + link(p.category + '/index.html') + '">' + esc(catName) + '</a> / ' + esc(p.name) + '</p>' +
      '<div class="product-detail">' +
        '<div class="gallery">' + mainImg + thumbs + '</div>' +
        '<div class="buybox">' +
          '<h1>' + esc(p.name) + '</h1>' +
          '<p class="price price-lg">' +
            (strikePrice(p) ? '<span class="price-old">' + money(strikePrice(p)) + '</span>' : '') +
            money(effectivePrice(p)) +
          '</p>' +
          (seasonApplies(p)
            ? '<p class="season-save">' + esc(SEASON.discountLabel) + ': ' + SEASON.discountPct +
              '% off the usual ' + money(p.price) + '</p>'
            : '') +
          '<p class="buybox-blurb">' + esc(p.blurb) + '</p>' +
          (p.tags ? '<div class="tags">' + p.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
          '<form class="buy-form" data-buy-form data-sku="' + esc(p.sku) + '">' +
            swatches + sizes +
            '<label for="qty">Quantity</label>' +
            '<input id="qty" name="qty" type="number" value="1" min="1" max="99">' +
            '<input type="hidden" name="size" value="' + esc(p.sizes && p.sizes[0] || '') + '">' +
            '<button class="btn btn-primary btn-block" type="submit">Add to Cart</button>' +
          '</form>' +
          '<ul class="buy-perks">' +
            '<li>Free shipping over $75</li>' +
            '<li>30-day returns, no questions asked</li>' +
            '<li>Student discount at checkout</li>' +
          '</ul>' +
          '<p class="product-meta">Category: <a href="' + link(p.category + '/index.html') + '">' + esc(catName) + '</a><br>' +
            'Tags: ' + esc((p.tags || []).join(', ')) + '<br>Brand: ChiActive</p>' +
        '</div>' +
      '</div>' +
      '<section class="tab-section"><h2>Description</h2><p>' + esc(p.description) + '</p></section>' +
      '<section class="tab-section"><h2>Additional information</h2>' +
        '<table class="specs"><tbody>' + specRows + '</tbody></table></section>' +
      '<section class="tab-section"><h2>Reviews (0)</h2><p>There are no reviews yet. Be the first to write one.</p></section>' +
      (related.length ? '<section class="related"><h2>Related products</h2>' + grid(related, 4) + '</section>' : '');
  }

  /* ---------------------------------------------------------------
     6b. Seasonal merchandising
     --------------------------------------------------------------- */
  /* A product is a "seasonal pick" if the season references it anywhere:
     in the essentials grid, the temperature guide, or the outfit. */
  function seasonApplies(p) {
    if (!SEASON) { return false; }
    var skus = [];
    if (SEASON.essentials) { SEASON.essentials.forEach(function (e) { skus.push(e.sku); }); }
    if (SEASON.conditions) { SEASON.conditions.forEach(function (c) { skus.push(c.sku); }); }
    if (SEASON.look && SEASON.look.skus) { skus = skus.concat(SEASON.look.skus); }
    return skus.indexOf(p.sku) !== -1;
  }

  /* Charm pricing: every price ends in .99. The discount is taken first,
     then rounded up to the next .99, so the customer never pays more than
     the advertised percentage off. */
  function effectivePrice(p) {
    if (!seasonApplies(p)) { return p.price; }
    var raw = p.price * (1 - (SEASON.discountPct || 0) / 100);
    return Math.ceil(raw) - 0.01;
  }

  /* What the price is compared against. For a seasonal pick that is the
     product's normal price, so the percentage we advertise is truthful. */
  function strikePrice(p) {
    if (seasonApplies(p)) { return p.price; }
    return p.oldPrice || null;
  }

  function badgeFor(p) {
    if (seasonApplies(p)) {
      return '<span class="badge-sale badge-season">' + esc(SEASON.name) + ' Sale</span>';
    }
    if (p.oldPrice) { return '<span class="badge-sale">Sale</span>'; }
    return '';
  }

  function priceBlock(p) {
    var strike = strikePrice(p);
    return '<p class="price">' +
      (strike ? '<span class="price-old">' + money(strike) + '</span>' : '') +
      money(effectivePrice(p)) +
      (seasonApplies(p) ? '<span class="badge-season">-' + SEASON.discountPct + '%</span>' : '') +
    '</p>';
  }

  function essentialCard(e) {
    var p = product(e.sku);
    if (!p) { return ''; }
    return '<article class="essential-card">' +
      '<p class="eyebrow">' + esc(e.slot) + '</p>' +
      '<a class="essential-media" href="' + link(p.url) + '">' + media(p, '') + '</a>' +
      '<h3><a href="' + link(p.url) + '">' + esc(p.name) + '</a></h3>' +
      '<p class="essential-why">' + esc(e.why) + '</p>' +
      priceBlock(p) +
      '<button class="btn btn-primary btn-sm btn-block" type="button" data-add-to-cart="' + esc(p.sku) + '">Add to Cart</button>' +
    '</article>';
  }

  /* Temperature-band guide: how to dress as the season turns. */
  function conditionsBlock() {
    if (!SEASON || !SEASON.conditions || !SEASON.conditions.length) { return ''; }
    return '<div class="conditions">' + SEASON.conditions.map(function (c) {
      var p = product(c.sku);
      return '<article class="condition">' +
        '<p class="condition-temp">' + esc(c.temp) + '</p>' +
        '<p class="condition-label">' + esc(c.label) + '</p>' +
        '<p class="condition-wear">' + esc(c.wear) + '</p>' +
        '<p class="condition-detail">' + esc(c.detail) + '</p>' +
        (p ? '<a href="' + link(p.url) + '">' + esc(c.cta || ('Shop the ' + p.name)) + '</a>' : '') +
      '</article>';
    }).join('') + '</div>';
  }

  /* The slot label a product fills this season, e.g. "The rain shell". */
  function slotFor(sku) {
    if (!SEASON || !SEASON.essentials) { return ''; }
    for (var i = 0; i < SEASON.essentials.length; i++) {
      if (SEASON.essentials[i].sku === sku) { return SEASON.essentials[i].slot; }
    }
    return '';
  }

  /* "Shop the Look": a photo of someone in the gear, with the exact pieces
     they are wearing listed beside it and a total for the outfit. */
  function renderLook() {
    if (!SEASON || !SEASON.look) { return ''; }
    var look = SEASON.look;
    var items = (look.skus || []).map(product).filter(Boolean);
    if (!items.length) { return ''; }

    var total = items.reduce(function (n, p) { return n + effectivePrice(p); }, 0);
    var full  = items.reduce(function (n, p) { return n + p.price; }, 0);

    return '<div class="look">' +
      '<div class="look-media">' +
        '<img src="' + asset(look.image) + '" alt="Someone wearing ' + esc(items[0].name) + '">' +
        '<p class="look-caption">' + esc(look.caption) + '</p>' +
      '</div>' +
      '<div class="look-body">' +
        '<p class="eyebrow">' + esc(SEASON.name) + ' outfit</p>' +
        '<h2>' + esc(look.title) + '</h2>' +
        '<p class="look-copy">' + esc(look.copy) + '</p>' +
        '<ul class="look-items">' +
          items.map(function (p) {
            return '<li class="look-item">' +
              '<a class="look-thumb" href="' + link(p.url) + '"><img src="' + asset(p.image) + '" alt=""></a>' +
              '<div class="look-item-body">' +
                '<a class="look-item-name" href="' + link(p.url) + '">' + esc(p.name) + '</a>' +
                '<p class="look-item-slot">' + esc(slotFor(p.sku)) + '</p>' +
                priceBlock(p) +
              '</div>' +
              '<button class="btn btn-sm" type="button" data-add-to-cart="' + esc(p.sku) + '">Add</button>' +
            '</li>';
          }).join('') +
        '</ul>' +
        '<p class="look-total"><span>Total look</span><strong>' +
          (full > total ? '<s>' + money(full) + '</s> ' : '') + money(total) + '</strong></p>' +
        '<button class="btn btn-primary btn-block" type="button" data-add-look="' +
          esc(items.map(function (p) { return p.sku; }).join(',')) + '">Add the whole look to cart</button>' +
      '</div>' +
    '</div>';
  }

  function renderSeasonCompact(root) {
    if (!SEASON) { root.innerHTML = ''; return; }
    root.innerHTML =
      '<div class="section-head">' +
        '<h2>What You Need for ' + esc(SEASON.name) + '</h2>' +
        '<a href="' + link('season.html') + '">Full ' + esc(SEASON.name) + ' guide &rarr;</a>' +
      '</div>' +
      '<p class="page-intro">' + esc(SEASON.tagline) + ' Every pick below is <strong>' +
        SEASON.discountPct + '% off</strong> during the ' + esc(SEASON.discountLabel) +
        ', through ' + esc(SEASON.ends) + '.</p>' +
      '<p class="subhead">Dress for the temperature</p>' +
      conditionsBlock() +
      '<p class="subhead">The ' + esc(SEASON.name) + ' essentials</p>' +
      '<div class="essentials">' + SEASON.essentials.map(essentialCard).join('') + '</div>';
  }

  function renderSeasonGuide(root) {
    if (!SEASON) {
      root.innerHTML = '<h1>No active season</h1><p>Add an entry to season.js to enable seasonal merchandising.</p>';
      return;
    }
    root.innerHTML =
      '<p class="breadcrumb"><a href="' + link('index.html') + '">Home</a> / ' + esc(SEASON.name) + ' Picks</p>' +
      '<section class="season-photo-hero"' +
        (SEASON.heroImage ? ' style="background-image:url(' + asset(SEASON.heroImage) + ')"' : '') + '>' +
        '<div class="season-photo-inner">' +
          '<p class="eyebrow">' + esc(SEASON.months) + '</p>' +
          '<h1>What You Need for ' + esc(SEASON.name) + '</h1>' +
          '<p class="season-lead">' + esc(SEASON.tagline) + '</p>' +
          '<p class="season-badge-line"><span class="badge-lg">' + esc(SEASON.discountLabel) +
            ' &middot; ' + SEASON.discountPct + '% off seasonal picks</span></p>' +
        '</div>' +
      '</section>' +
      (SEASON.look ? '<section class="section">' + renderLook() + '</section>' : '') +
      '<section class="section">' +
        '<div class="section-head"><h2>Dress for the temperature</h2></div>' +
        '<p class="page-intro">Chicago autumn is not one temperature. It is a 60-degree afternoon ' +
          'and a 35-degree morning in the same week. Match your layers to the day.</p>' +
        conditionsBlock() +
      '</section>' +
      '<section class="rain-band">' +
        '<div class="rain-media">' +
          '<img src="' + asset(SEASON.rainImage) + '" alt="' + esc(SEASON.rainTitle) + '">' +
        '</div>' +
        '<div class="rain-body">' +
          '<p class="eyebrow">Rain days</p>' +
          '<h2>' + esc(SEASON.rainTitle) + '</h2>' +
          '<p>' + esc(SEASON.rainCopy) + '</p>' +
          '<a class="btn btn-ghost" href="' + link('shop.html') + '">Shop rain-ready layers</a>' +
        '</div>' +
      '</section>' +
      '<div class="season-columns">' +
        '<section>' +
          '<h2>Your ' + esc(SEASON.name) + ' packing list</h2>' +
          '<p class="page-intro">Work through it before the first cold snap. Your ticks are saved on this device.</p>' +
          '<ul class="checklist" data-checklist>' +
            SEASON.packing.map(function (item, i) {
              return '<li><label><input type="checkbox" data-check="' + i + '"><span>' + esc(item) + '</span></label></li>';
            }).join('') +
          '</ul>' +
          '<p class="checklist-progress" data-check-progress></p>' +
        '</section>' +
        '<section>' +
          '<h2>The essentials</h2>' +
          '<p class="page-intro">Six pieces that cover the whole season, layer by layer.</p>' +
          '<div class="essentials essentials-2">' + SEASON.essentials.map(essentialCard).join('') + '</div>' +
        '</section>' +
      '</div>' +
      '<section class="cta-band">' +
        '<h2>' + esc(SEASON.name) + ' sorted.</h2>' +
        '<p>Every seasonal pick is ' + SEASON.discountPct + '% off through ' + esc(SEASON.ends) +
          '. After that, winter comes for you.</p>' +
        '<a class="btn btn-primary btn-lg" href="' + link('shop.html') + '">Shop all products</a>' +
      '</section>';
  }

  /* Packing-list checkboxes, persisted per season. */
  function checklistKey() { return 'chiactive_checklist_' + (SEASON ? SEASON.key : 'none'); }

  function checklistState() {
    try { return JSON.parse(localStorage.getItem(checklistKey())) || {}; }
    catch (e) { return {}; }
  }

  function updateChecklistProgress() {
    var boxes = document.querySelectorAll('[data-check]');
    if (!boxes.length) { return; }
    var done = 0;
    Array.prototype.forEach.call(boxes, function (b) { if (b.checked) { done++; } });
    var out = document.querySelector('[data-check-progress]');
    if (out) {
      out.textContent = done === 0 ? 'Nothing ticked off yet.'
        : (done === boxes.length ? 'All set. You are ready for ' + SEASON.name + '.'
        : done + ' of ' + boxes.length + ' sorted.');
    }
  }

  function restoreChecklist() {
    var state = checklistState();
    var boxes = document.querySelectorAll('[data-check]');
    Array.prototype.forEach.call(boxes, function (b) {
      b.checked = !!state[b.getAttribute('data-check')];
    });
    updateChecklistProgress();
  }

  /* ---------------------------------------------------------------
     7. Wiring
     --------------------------------------------------------------- */
  function mount() {
    // Header + footer
    var h = document.getElementById('site-header');
    if (h) { h.innerHTML = buildHeader(); }
    var f = document.getElementById('site-footer');
    if (f) { f.innerHTML = buildFooter(); }

    // Cart drawer
    var shell = document.createElement('div');
    shell.innerHTML = buildDrawer();
    while (shell.firstChild) { document.body.appendChild(shell.firstChild); }

    // Category pages
    var catRoot = document.querySelector('[data-category]');
    if (catRoot) {
      var slug = catRoot.getAttribute('data-category');
      var c = CATEGORIES.filter(function (x) { return x.slug === slug; })[0];
      var list = byCategory(slug);
      var intro = c ? c.blurb : '';
      var chips = CATEGORIES.map(function (x) {
        return '<a class="chip' + (x.slug === slug ? ' is-active' : '') + '" href="' + link(x.slug + '/index.html') + '">' + esc(x.name) + '</a>';
      }).join('');
      catRoot.innerHTML = '<p class="breadcrumb"><a href="' + link('index.html') + '">Home</a> / ' + esc(c ? c.name : slug) + '</p>' +
        '<h1>' + esc(c ? c.name : slug) + '</h1>' +
        '<p class="page-intro">' + esc(intro) + '</p>' +
        '<nav class="chips">' + chips + '</nav>' +
        grid(list, 4);
    }

    // Shop landing
    var shopAll = document.querySelector('[data-shop-all]');
    if (shopAll) {
      shopAll.innerHTML = CATEGORIES.map(categoryTile).join('');
    }

    // Homepage featured + category tiles
    var feat = document.querySelector('[data-featured]');
    if (feat) {
      feat.innerHTML = grid(PRODUCTS.filter(function (p) { return p.featured; }).slice(0, 4), 4);
    }
    var homeTiles = document.querySelector('[data-home-tiles]');
    if (homeTiles) {
      homeTiles.innerHTML = CATEGORIES.map(categoryTile).join('');
    }

    // Product detail
    var pd = document.querySelector('[data-product-sku]');
    if (pd) { renderProductDetail(pd); }

    // Seasonal merchandising
    var sc = document.querySelector('[data-season-compact]');
    if (sc) { renderSeasonCompact(sc); }
    var sl = document.querySelector('[data-season-look]');
    if (sl) { sl.innerHTML = renderLook(); }
    var sg = document.querySelector('[data-season-guide]');
    if (sg) { renderSeasonGuide(sg); }
    restoreChecklist();

    // Blog listing
    var bl = document.querySelector('[data-post-list]');
    if (bl && window.CHIACTIVE_POSTS) {
      bl.innerHTML = window.CHIACTIVE_POSTS.map(function (post) {
        return '<article class="post-card">' +
          '<p class="post-meta">' + esc(post.date) + ' &middot; ' + esc(post.author) + ' &middot; ' + esc(post.category) + '</p>' +
          '<h2><a href="' + link(post.url) + '">' + esc(post.title) + '</a></h2>' +
          '<p>' + esc(post.excerpt) + '</p>' +
          '<a class="read-more" href="' + link(post.url) + '">Read article &rarr;</a>' +
        '</article>';
      }).join('');
    }

    // ---- Events (delegated) ----
    document.addEventListener('click', function (e) {
      var t = e.target;

      var toggle = t.closest && t.closest('.nav-toggle');
      if (toggle) {
        var nav = document.getElementById('primary-nav');
        var open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        return;
      }

      var navLink = t.closest && t.closest('#primary-nav a');
      if (navLink) {
        var n2 = document.getElementById('primary-nav');
        if (n2) { n2.classList.remove('is-open'); }
        var tg = document.querySelector('.nav-toggle');
        if (tg) { tg.setAttribute('aria-expanded', 'false'); }
      }

      if (t.closest && t.closest('[data-open-cart]')) { e.preventDefault(); openCart(); return; }
      if (t.closest && t.closest('[data-close-cart]')) { closeCart(); return; }

      var dismiss = t.closest && t.closest('[data-dismiss-banner]');
      if (dismiss) {
        try { localStorage.setItem(BANNER_KEY, '1'); } catch (e) {}
        var banner = document.querySelector('[data-season-banner]');
        if (banner && banner.parentNode) { banner.parentNode.removeChild(banner); }
        return;
      }

      var addLook = t.closest && t.closest('[data-add-look]');
      if (addLook) {
        e.preventDefault();
        var lookSkus = addLook.getAttribute('data-add-look').split(',');
        var added = 0;
        lookSkus.forEach(function (sku) {
          var p = product(sku);
          if (!p) { return; }
          var k = sku + '::';
          for (var i = 0; i < cart.length; i++) {
            if (keyOf(cart[i]) === k) { cart[i].qty += 1; added++; return; }
          }
          cart.push({ sku: sku, size: '', qty: 1, price: effectivePrice(p), name: p.name, image: p.image });
          added++;
        });
        saveCart();
        toast(added + ' pieces added to your cart');
        openCart();
        return;
      }

      var add = t.closest && t.closest('[data-add-to-cart]');
      if (add) {
        e.preventDefault();
        var sku = add.getAttribute('data-add-to-cart');
        var scope = add.closest('form') || document;
        var sizeEl = scope.querySelector('[data-buy-form] [name="size"], form [name="size"]');
        var qtyEl = scope.querySelector('form [name="qty"]');
        addToCart(sku, sizeEl ? sizeEl.value : '', qtyEl ? qtyEl.value : 1);
        return;
      }

      var thumb = t.closest && t.closest('[data-thumb]');
      if (thumb) {
        var src = thumb.getAttribute('data-thumb');
        var main = document.getElementById('gallery-main');
        if (main) { main.src = src; }
        var wrap = thumb.closest('.thumbs') || thumb.closest('.swatches');
        if (wrap) {
          Array.prototype.forEach.call(wrap.querySelectorAll('.is-active'), function (el) { el.classList.remove('is-active'); });
        }
        thumb.classList.add('is-active');
        return;
      }

      var pill = t.closest && t.closest('[data-size-pill]');
      if (pill) {
        var box = pill.closest('.pills');
        Array.prototype.forEach.call(box.querySelectorAll('.pill'), function (el) { el.classList.remove('is-active'); });
        pill.classList.add('is-active');
        var form = pill.closest('form');
        if (form) { form.querySelector('[name="size"]').value = pill.getAttribute('data-size-pill'); }
        return;
      }

      var inc = t.closest && t.closest('[data-inc]');
      if (inc) {
        var ka = inc.getAttribute('data-inc');
        for (var i = 0; i < cart.length; i++) { if (keyOf(cart[i]) === ka) { setQty(ka, cart[i].qty + 1); break; } }
        return;
      }
      var dec = t.closest && t.closest('[data-dec]');
      if (dec) {
        var kb = dec.getAttribute('data-dec');
        for (var j = 0; j < cart.length; j++) { if (keyOf(cart[j]) === kb) { setQty(kb, cart[j].qty - 1); break; } }
        return;
      }
      var rm = t.closest && t.closest('[data-remove]');
      if (rm) { removeLine(rm.getAttribute('data-remove')); return; }

      if (t.closest && t.closest('[data-checkout]')) {
        if (!cart.length) { toast('Your cart is empty'); return; }
        toast('Demo checkout — this is a design mockup, no orders are placed.');
        return;
      }
    });

    document.addEventListener('change', function (e) {
      var q = e.target.closest && e.target.closest('[data-qty]');
      if (q) { setQty(q.getAttribute('data-qty'), q.value); }

      var chk = e.target.closest && e.target.closest('[data-check]');
      if (chk) {
        var state = checklistState();
        state[chk.getAttribute('data-check')] = chk.checked;
        try { localStorage.setItem(checklistKey(), JSON.stringify(state)); } catch (err) {}
        updateChecklistProgress();
      }
    });

    document.addEventListener('submit', function (e) {
      var news = e.target.closest && e.target.closest('[data-newsletter]');
      if (news) {
        e.preventDefault();
        var field = news.querySelector('input[type="email"]');
        var val = field ? field.value.trim() : '';
        if (!val || val.indexOf('@') === -1) {
          toast('Enter an email address to sign up');
          if (field) { field.focus(); }
          return;
        }
        if (field) { field.value = ''; }
        toast('Thanks — you are on the list (demo only)');
        return;
      }

      var form = e.target.closest && e.target.closest('[data-buy-form]');
      if (!form) { return; }
      e.preventDefault();
      addToCart(form.getAttribute('data-sku'), form.querySelector('[name="size"]').value, form.querySelector('[name="qty"]').value);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeCart(); }
    });

    loadCart();
    paintCart();
  }

  loadCart();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
