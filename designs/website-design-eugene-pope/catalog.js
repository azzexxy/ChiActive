/* ==========================================================================
   ChiActive — Catalog data + rendering
   Single source of truth for products, colorways, categories, and seasons.
   Load on any page with:  <script src="catalog.js" data-base=""></script>
   (use data-base="../" from inside a subfolder)
   ========================================================================== */
(function () {
  'use strict';

  var script = document.currentScript;
  var BASE = (script && script.getAttribute('data-base')) || '';

  /* ---------- Colorways ---------- */
  var C = {
    black:    { name: 'Black',        hex: '#1E293B' },
    slate:    { name: 'Deep Slate',   hex: '#2F3F53' },
    gray:     { name: 'Storm Gray',   hex: '#6B7280' },
    forest:   { name: 'Forest Green', hex: '#35503C' },
    brown:    { name: 'Dark Brown',   hex: '#4A3728' },
    sand:     { name: 'Warm Sand',    hex: '#F5E7BE' },
    cream:    { name: 'Oat Cream',    hex: '#EDE4D3' },
    red:      { name: 'Chicago Red',  hex: '#E4022B' },
    cyan:     { name: 'Sky Cyan',     hex: '#41B6E6' },
    olive:    { name: 'Field Olive',  hex: '#5B6142' },
    charcoal: { name: 'Charcoal',     hex: '#3A3F45' }
  };

  var SEASON_ORDER = ['Fall', 'Winter', 'Spring', 'Summer'];
  var SEASONS = {
    Fall:   { icon: '🍂', blurb: 'Crisp campus mornings, golden-hour trails, and the first real chill off the lake.' },
    Winter: { icon: '❄️', blurb: 'Beat the lake wind. Gear built for the coldest walk to an 8 a.m. lecture.' },
    Spring: { icon: '🌱', blurb: 'Rain-ready layers for thaw season, muddy trails, and everything in between.' },
    Summer: { icon: '☀️', blurb: 'Light, breathable essentials for lakefront days and long city miles.' }
  };

  var CATEGORY_ORDER = ['Jackets', 'Layers', 'Pants', 'Footwear', 'Accessories', 'Gear & Bags'];

  /* ---------- Products (5 colorways each) ---------- */
  var PRODUCTS = [
    {
      id: 'chiactive-trail-cargo-pants',
      name: 'ChiActive Trail Cargo Pants',
      category: 'Pants',
      seasons: ['Fall', 'Spring', 'Summer'],
      price: 25.00, oldPrice: null,
      page: 'pants/chiactive-trail-cargo-pants.html',
      image: 'images/d8fe858e-eb62-4d03-a595-571e5113690c.png',
      variants: {
        'Black': 'images/d8fe858e-eb62-4d03-a595-571e5113690c.png',
        'Storm Gray': 'images/gray.png',
        'Forest Green': 'images/forest-green.png',
        'Dark Brown': 'images/dark-brown.png'
      },
      colors: [C.black, C.gray, C.forest, C.brown, C.charcoal],
      blurb: 'Lightweight, water-resistant, and pocketed for life on the go.',
      tags: ['Water-Resistant', 'Relaxed Fit']
    },
    {
      id: 'chiactive-fleece',
      name: 'ChiActive Fleece',
      category: 'Layers',
      seasons: ['Fall', 'Winter'],
      price: 45.00, oldPrice: null,
      page: null,
      image: null,
      variants: {},
      colors: [C.cream, C.forest, C.black, C.slate, C.sand],
      blurb: 'The throw-on layer you grab when the temperature drops.',
      tags: ['Brushed Fleece', 'Everyday']
    },
    {
      id: 'chiactive-snow-boots',
      name: 'ChiActive Snow Boots',
      category: 'Footwear',
      seasons: ['Winter'],
      price: 94.99, oldPrice: 159.99,
      page: null,
      image: 'images/Screenshot-2026-09-16-at-8.33.54-AM.png',
      variants: {},
      colors: [C.black, C.brown, C.gray, C.cream, C.forest],
      blurb: 'Grip and warmth for icy sidewalks and slushy crosswalks.',
      tags: ['Insulated', 'Waterproof']
    },
    {
      id: 'chiactive-trail-sneaker',
      name: 'ChiActive Trail Sneaker',
      category: 'Footwear',
      seasons: ['Spring', 'Summer'],
      price: 89.00, oldPrice: 110.00,
      page: null,
      image: null,
      variants: {},
      colors: [C.gray, C.black, C.cyan, C.olive, C.cream],
      blurb: 'A campus-to-trail sneaker for city streets and gravel paths.',
      tags: ['GORE-TEX', 'All-Day']
    },
    {
      id: 'chiactive-urban-campus-backpack',
      name: 'ChiActive Urban Campus Backpack',
      category: 'Gear & Bags',
      seasons: ['Fall', 'Spring', 'Summer'],
      price: 59.99, oldPrice: null,
      page: 'blog/chiactive-urban-campus-backpack.html',
      image: 'images/WhatsApp-Image-2026-09-20-at-11.32.42-PM-819x1024.jpeg',
      variants: {},
      colors: [C.black, C.slate, C.gray, C.forest, C.sand],
      blurb: 'Padded 15.6" laptop sleeve and a 25L main compartment.',
      tags: ['Water-Resistant', '25L']
    },
    {
      id: 'green-winter-jacket',
      name: 'Green Winter Jacket',
      category: 'Jackets',
      seasons: ['Fall', 'Winter'],
      price: 64.00, oldPrice: 89.00,
      page: null,
      image: 'images/young-hipster-man-hiking-mountains-winter-vacation-traveling-scaled.jpg',
      variants: {},
      colors: [C.forest, C.black, C.slate, C.gray, C.cream],
      blurb: 'Wind-resistant shell with a warm, packable fill.',
      tags: ['Wind-Resistant', 'Insulated']
    },
    {
      id: 'chi-town-puffer-winter-jacket',
      name: 'Chi Town Puffer Winter Jacket',
      category: 'Jackets',
      seasons: ['Winter'],
      price: 185.00, oldPrice: 200.00,
      page: null,
      image: 'images/Screenshot-2026-09-16-at-8.30.52-AM.png',
      variants: {},
      colors: [C.black, C.slate, C.red, C.gray, C.sand],
      blurb: 'The heavy hitter for single-digit February mornings.',
      tags: ['Waterproof', 'Insulated']
    },
    {
      id: 'always-effortless-jacket-women',
      name: 'Always Effortless Jacket (Women)',
      category: 'Jackets',
      seasons: ['Fall', 'Spring'],
      price: 118.40, oldPrice: 148.00,
      page: null,
      image: 'images/Skarmavbild-2026-09-16-kl.-08.30.03.png',
      variants: {},
      colors: [C.black, C.cream, C.forest, C.gray, C.sand],
      blurb: 'A light, packable layer that goes with everything.',
      tags: ['Packable', 'Lightweight']
    },
    {
      id: 'zw-collection-short-high-collar-trench-coat',
      name: 'ZW Collection Short High-Collar Trench Coat',
      category: 'Jackets',
      seasons: ['Fall', 'Spring'],
      price: 110.00, oldPrice: 129.00,
      page: null,
      image: 'images/Screenshot-2026-09-16-at-08.26.32.png',
      variants: {},
      colors: [C.sand, C.black, C.slate, C.brown, C.olive],
      blurb: 'Rain-ready trench with a high collar for gusty commutes.',
      tags: ['Water-Repellent', 'High Collar']
    },
    {
      id: 'chiactive-faux-fur-aviator-hat',
      name: 'ChiActive Faux-Fur Aviator Hat',
      category: 'Accessories',
      seasons: ['Winter'],
      price: 52.00, oldPrice: null,
      page: null,
      image: 'images/chi-active-aviator-hat-2.png',
      variants: {},
      colors: [C.brown, C.black, C.gray, C.cream, C.forest],
      blurb: 'Faux-fur warmth for waiting on the platform in January.',
      tags: ['Faux Fur', 'Lined']
    },
    {
      id: 'chiactive-rechargeable-hand-warmer',
      name: 'ChiActive Rechargeable Hand Warmer',
      category: 'Accessories',
      seasons: ['Fall', 'Winter'],
      price: 24.99, oldPrice: null,
      page: null,
      image: null,
      variants: {},
      colors: [C.black, C.slate, C.red, C.cyan, C.gray],
      blurb: 'USB-rechargeable heat for frozen fingers on the walk home.',
      tags: ['Rechargeable', 'Pocket-Size']
    }
  ];

  /* ---------- Helpers ---------- */
  function money(n) { return '$' + Number(n).toFixed(2); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function asset(path) {
    if (!path) { return ''; }
    if (/^(https?:)?\/\//.test(path) || path.charAt(0) === '/') { return path; }
    return BASE + path;
  }
  function url(path) { return path ? BASE + path : '#'; }
  function get(id) {
    for (var i = 0; i < PRODUCTS.length; i++) { if (PRODUCTS[i].id === id) { return PRODUCTS[i]; } }
    return null;
  }
  function productLink(p) {
    return p.page ? url(p.page) : url('product.html?id=' + p.id);
  }

  /* ---------- Swatches ---------- */
  function swatchHTML(color, active) {
    return '<button type="button" class="swatch" data-color="' + esc(color.name) + '"' +
      ' title="' + esc(color.name) + '" aria-label="' + esc(color.name) + '"' +
      ' aria-pressed="' + (active ? 'true' : 'false') + '"' +
      ' style="--sw:' + esc(color.hex) + '"></button>';
  }

  function wireSwatches(row, product, onChange) {
    row.classList.add('card-colors');
    row.innerHTML = product.colors.map(function (c, i) { return swatchHTML(c, i === 0); }).join('');
    row.addEventListener('click', function (e) {
      var b = e.target.closest('.swatch');
      if (!b) { return; }
      var all = row.querySelectorAll('.swatch');
      for (var i = 0; i < all.length; i++) { all[i].setAttribute('aria-pressed', 'false'); }
      b.setAttribute('aria-pressed', 'true');
      if (onChange) { onChange(b.getAttribute('data-color')); }
    });
    return product.colors.length ? product.colors[0].name : '';
  }

  function brandMark() {
    return '<img class="brand-mark" src="' + esc(asset('images/logo-v1.png')) + '" alt="ChiActive" aria-hidden="true">';
  }

  /* ---------- Card markup ---------- */
  function cardHTML(p) {
    var badge = p.oldPrice ? '<span class="badge-sale">Sale</span>' : '';
    var media = p.image
      ? '<img src="' + esc(asset(p.image)) + '" alt="' + esc(p.name) + '" loading="lazy">'
      : '<div class="img-placeholder">Photo coming soon</div>';
    var price = p.oldPrice
      ? '<p class="price"><span class="price-old">' + money(p.oldPrice) + '</span>' + money(p.price) + '</p>'
      : '<p class="price">' + money(p.price) + '</p>';
    return '<article class="product-card" data-product="' + esc(p.id) + '">' +
      badge +
      '<a href="' + esc(productLink(p)) + '">' + media + brandMark() +
        '<h3>' + esc(p.name) + '</h3>' + price +
      '</a>' +
      '<div class="card-colors" data-colors="' + esc(p.id) + '"></div>' +
      '<button type="button" class="btn-add" data-add-to-cart' +
        ' data-id="' + esc(p.id) + '"' +
        ' data-name="' + esc(p.name) + '"' +
        ' data-price="' + p.price + '"' +
        ' data-image="' + esc(p.image || '') + '"' +
        ' data-color="' + esc(p.colors[0].name) + '">Add to cart</button>' +
    '</article>';
  }

  /* ---------- Decorate existing (hand-written) cards ---------- */
  function decorateCards(root) {
    var cards = (root || document).querySelectorAll('.product-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.getAttribute('data-decorated')) { continue; }
      var btn = card.querySelector('[data-add-to-cart]');
      if (!btn) { continue; }
      var p = get(btn.getAttribute('data-id'));
      if (!p) { continue; }
      // Brand stamp on the product image
      var anchor = card.querySelector('a');
      if (anchor && !anchor.querySelector('.brand-mark')) {
        var mark = document.createElement('img');
        mark.className = 'brand-mark';
        mark.src = asset('images/logo-v1.png');
        mark.alt = 'ChiActive';
        mark.setAttribute('aria-hidden', 'true');
        if (anchor.firstElementChild) { anchor.firstElementChild.insertAdjacentElement('afterend', mark); }
        else { anchor.appendChild(mark); }
      }
      var row = card.querySelector('.card-colors');
      if (!row) {
        row = document.createElement('div');
        btn.parentNode.insertBefore(row, btn);
      }
      wireSwatches(row, p, function (color) { btn.setAttribute('data-color', color); });
      btn.setAttribute('data-color', p.colors[0].name);
      var link = card.querySelector('a[href="#"]');
      if (link && !p.page) { link.setAttribute('href', productLink(p)); }
      card.setAttribute('data-decorated', '1');
    }
  }

  /* ---------- Seasonal catalog (shop page) ---------- */
  function renderSeasonal(root) {
    if (!root) { return; }
    var out = [];
    SEASON_ORDER.forEach(function (season) {
      var items = PRODUCTS.filter(function (p) { return p.seasons.indexOf(season) !== -1; });
      if (!items.length) { return; }
      var cats = CATEGORY_ORDER.filter(function (cat) {
        return items.some(function (p) { return p.category === cat; });
      });

      var index = items.map(function (p) {
        return '<li><a href="' + esc(productLink(p)) + '">' + esc(p.name) + '</a></li>';
      }).join('');

      var sections = cats.map(function (cat) {
        var inCat = items.filter(function (p) { return p.category === cat; });
        return '<div class="category-section" id="' + esc(season.toLowerCase() + '-' + cat.toLowerCase().replace(/[^a-z]+/g, '-')) + '">' +
          '<h3 class="category-title">' + esc(cat) + ' <span class="category-count">' + inCat.length + '</span></h3>' +
          '<div class="product-grid">' + inCat.map(cardHTML).join('') + '</div>' +
        '</div>';
      }).join('');

      out.push('<section class="season-block" id="' + esc(season.toLowerCase()) + '">' +
        '<header class="season-head">' +
          '<span class="season-icon" aria-hidden="true">' + SEASONS[season].icon + '</span>' +
          '<div>' +
            '<p class="eyebrow">' + esc(season) + ' Collection</p>' +
            '<h2>' + esc(season) + ' gear</h2>' +
            '<p class="season-blurb">' + esc(SEASONS[season].blurb) + '</p>' +
          '</div>' +
        '</header>' +
        '<div class="season-index-wrap">' +
          '<h3 class="season-index-title">In this season</h3>' +
          '<ul class="season-index">' + index + '</ul>' +
        '</div>' +
        sections +
      '</section>');
    });
    root.innerHTML = out.join('');
  }

  /* ---------- Generic product detail page ---------- */
  function renderProductPage(root) {
    if (!root) { return; }
    var id = new URLSearchParams(window.location.search).get('id');
    var p = id ? get(id) : null;
    if (!p) {
      root.innerHTML = '<p class="page-intro">Product not found. <a href="' + esc(url('shop.html')) + '">Back to shop</a>.</p>';
      return;
    }
    var variantNames = p.variants ? Object.keys(p.variants) : [];
    var mainSrc = variantNames.length ? p.variants[variantNames[0]] : p.image;
    var gallery =
      (mainSrc
        ? '<img class="gallery-main" src="' + esc(asset(mainSrc)) + '" alt="' + esc(p.name) + '">'
        : '<div class="img-placeholder gallery-main">Photo coming soon</div>') +
      brandMark() +
      (variantNames.length > 1
        ? '<div class="thumbs">' + variantNames.map(function (n) {
            return '<img class="thumb" data-variant="' + esc(n) + '" src="' + esc(asset(p.variants[n])) + '" alt="' + esc(p.name + ' — ' + n) + '">';
          }).join('') + '</div>'
        : '');

    var price = p.oldPrice
      ? '<p class="price"><span class="price-old">' + money(p.oldPrice) + '</span>' + money(p.price) + '</p>'
      : '<p class="price">' + money(p.price) + '</p>';

    var tags = (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    var seasonChips = p.seasons.map(function (s) { return '<a class="tag tag-season" href="' + esc(url('shop.html#' + s.toLowerCase())) + '">' + esc(s) + '</a>'; }).join('');

    root.innerHTML =
      '<p class="breadcrumb"><a href="' + esc(url('index.html')) + '">Home</a> / <a href="' + esc(url('shop.html')) + '">Shop</a> / ' + esc(p.category) + ' / ' + esc(p.name) + '</p>' +
      '<div class="product-detail">' +
        '<div class="gallery">' + gallery + '</div>' +
        '<div class="buybox">' +
          '<h1 style="margin-top:0;">' + esc(p.name) + '</h1>' + price +
          '<p>' + esc(p.blurb) + '</p>' +
          '<p class="tags-row">' + tags + seasonChips + '</p>' +
          '<label>Color <span class="buybox-color-name" data-color-name>' + esc(p.colors[0].name) + '</span></label>' +
          '<div class="color-picker" data-color-picker="' + esc(p.id) + '"></div>' +
          '<label for="size">Size</label>' +
          '<select id="size" name="size"><option>Choose an option</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select>' +
          '<label for="qty">Quantity</label>' +
          '<input id="qty" name="qty" type="number" value="1" min="1">' +
          '<button class="btn" type="button" data-add-to-cart' +
            ' data-id="' + esc(p.id) + '" data-name="' + esc(p.name) + '" data-price="' + p.price + '"' +
            ' data-image="' + esc(p.image || '') + '"' +
            ' data-color="' + esc(p.colors[0].name) + '">Add to cart</button>' +
          '<p class="product-meta">Category: <a href="' + esc(url('shop.html')) + '">' + esc(p.category) + '</a><br>Brands: ChiActive</p>' +
        '</div>' +
      '</div>';

    // Title + document title
    document.title = p.name + ' | ChiActive';

    // Gallery thumbnails swap the main image
    var thumbs = root.querySelectorAll('.gallery .thumb');
    for (var t = 0; t < thumbs.length; t++) {
      thumbs[t].addEventListener('click', function () {
        var main = root.querySelector('.gallery-main');
        if (main) { main.setAttribute('src', this.getAttribute('src')); }
      });
    }
  }

  /* ---------- Color pickers (product pages) ---------- */
  function wireOnePicker(el) {
    if (!el || el.getAttribute('data-wired')) { return; }
    var p = get(el.getAttribute('data-color-picker'));
    if (!p) { return; }
    var box = el.closest('.buybox') || el.parentNode;
    var label = box.querySelector('[data-color-name]');
    var btn = box.querySelector('[data-add-to-cart]') || document.querySelector('[data-add-to-cart]');
    var main = box.querySelector('.gallery-main') || document.querySelector('.gallery-main, .gallery > img');
    wireSwatches(el, p, function (color) {
      if (btn) { btn.setAttribute('data-color', color); }
      if (label) { label.textContent = color; }
      if (main && p.variants && p.variants[color]) { main.setAttribute('src', asset(p.variants[color])); }
    });
    el.setAttribute('data-wired', '1');
  }
  function wirePickers(root) {
    var pickers = (root || document).querySelectorAll('[data-color-picker]');
    for (var i = 0; i < pickers.length; i++) { wireOnePicker(pickers[i]); }
  }

  /* ---------- Init ---------- */
  function init() {
    renderProductPage(document.querySelector('[data-product-page]'));
    var seasonal = document.querySelector('[data-seasonal-catalog]');
    if (seasonal) { renderSeasonal(seasonal); }
    decorateCards(document);
    wirePickers(document);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  window.ChiCatalog = { products: PRODUCTS, get: get, seasons: SEASONS, cardHTML: cardHTML, renderSeasonal: renderSeasonal, decorate: decorateCards, productLink: productLink, asset: asset };
})();
