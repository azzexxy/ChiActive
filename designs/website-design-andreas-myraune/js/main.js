/* ChiActive site script (Collection 01)
   Cart saved in localStorage, cart drawer, mobile menu, search, product page (photo rail, zoom,
   sizes, size guide), shop filters and the demo checkout. Used by the main store and by the
   concept homepages in concepts/. No libraries. */
(() => {
  const ROOT = document.documentElement.dataset.root || '';
  const PRODUCTS = window.CHIACTIVE_PRODUCTS || [];
  const byId = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = n => '$' + n.toFixed(2);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>';
  const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>';

  /* ---------- Cart store ---------- */
  const KEY = 'chiactive-cart-c01';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { cart = []; }
  cart = cart.filter(l => byId[l.id] && l.qty > 0);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* storage blocked */ } };
  const itemCount = () => cart.reduce((n, l) => n + l.qty, 0);
  const subtotal = () => cart.reduce((s, l) => s + byId[l.id].price * l.qty, 0);
  const lineImg = l => ROOT + byId[l.id].colors[0].img;
  const lineMeta = l => [byId[l.id].colors[0].name, l.size ? 'Size ' + l.size : null].filter(Boolean).join(' · ');

  /* Message shown above "Checkout" in the cart drawer, nudging toward a free-shipping goal.
     subtotal: cart total in dollars (number). itemCount: number of jackets in the cart.
     Return a short sentence, or '' to show nothing. */
  const FREE_SHIPPING_AT = 300;
  const SHIPPING_FEE = 12; // demo flat rate under the free-shipping limit
  function shippingNote(subtotal, itemCount) {
    if (!itemCount) return '';
    if (subtotal >= FREE_SHIPPING_AT) return 'Free shipping unlocked. The lake wind can wait.';
    const left = Math.ceil(FREE_SHIPPING_AT - subtotal);
    return `You're $${left} away from free shipping.`;
  }

  function addToCart(id, size, qty) {
    const line = cart.find(l => l.id === id && l.size === size);
    if (line) line.qty = Math.min(line.qty + qty, 10); else cart.push({ id, size, qty });
    save();
    render();
    $$('.cart-count').forEach(el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
  }
  function setQty(i, q) { if (q < 1) cart.splice(i, 1); else cart[i].qty = Math.min(q, 10); save(); render(); }

  /* ---------- Overlays ---------- */
  document.body.insertAdjacentHTML('beforeend', `
<div class="scrim" data-scrim></div>
<aside class="drawer" id="cart" role="dialog" aria-modal="true" aria-labelledby="cart-title" tabindex="-1">
  <div class="drawer-head"><h2 id="cart-title">Cart</h2><button class="x" type="button" data-close aria-label="Close cart">${ICON_X}</button></div>
  <div class="drawer-body" data-lines></div>
  <div class="drawer-foot" data-foot></div>
</aside>
<div class="search" id="search" role="dialog" aria-modal="true" aria-label="Search jackets">
  <div class="search-bar">${ICON_SEARCH}<input type="search" placeholder="Search jackets" aria-label="Search jackets" autocomplete="off"><button class="x" type="button" data-close aria-label="Close search">${ICON_X}</button></div>
  <div class="search-results" data-results></div>
</div>`);
  const scrim = $('[data-scrim]'), drawer = $('#cart'), search = $('#search');
  const searchInput = $('input', search), results = $('[data-results]');
  let lastFocus = null;
  function openPanel(panel, focusEl) {
    closeMenu();
    lastFocus = document.activeElement;
    panel.classList.add('open'); scrim.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => (focusEl || panel).focus(), 60);
  }
  function closePanels() {
    const wasOpen = drawer.classList.contains('open') || search.classList.contains('open');
    drawer.classList.remove('open'); search.classList.remove('open'); scrim.classList.remove('open');
    document.body.style.overflow = '';
    if (wasOpen && lastFocus && lastFocus.focus) lastFocus.focus();
  }
  const openCart = () => openPanel(drawer, $('[data-close]', drawer));
  const openSearch = () => { runSearch(searchInput.value); openPanel(search, searchInput); };
  $$('[data-open-cart]').forEach(b => b.addEventListener('click', openCart));
  $$('[data-open-search]').forEach(b => b.addEventListener('click', openSearch));
  $$('[data-close]').forEach(b => b.addEventListener('click', closePanels));
  scrim.addEventListener('click', closePanels);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePanels(); closeMenu(); }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  });

  function render() {
    const n = itemCount();
    $$('.cart-count').forEach(el => { el.textContent = n; });
    $$('[data-open-cart]').forEach(b => b.setAttribute('aria-label', `Open cart, ${n} ${n === 1 ? 'item' : 'items'}`));
    const lines = $('[data-lines]'), foot = $('[data-foot]');
    if (!cart.length) {
      lines.innerHTML = `<div class="empty"><p>Your cart is empty. The lake wind is not.</p><a class="btn" href="${ROOT}shop.html">Shop jackets</a></div>`;
      foot.innerHTML = '';
    } else {
      lines.innerHTML = cart.map((l, i) => {
        const p = byId[l.id];
        return `<div class="line"><img src="${lineImg(l)}" alt=""><div class="line-info">
  <div class="line-top"><a class="line-name" href="${ROOT}${p.url}">${esc(p.name)}</a><span class="price">${money(p.price * l.qty)}</span></div>
  <p class="line-meta">${esc(lineMeta(l))}</p>
  <div class="line-actions"><div class="stepper"><button type="button" data-dec="${i}" aria-label="Decrease quantity of ${esc(p.name)}">−</button><output>${l.qty}</output><button type="button" data-inc="${i}" aria-label="Increase quantity of ${esc(p.name)}">+</button></div><button class="remove" type="button" data-remove="${i}">Remove</button></div>
</div></div>`;
      }).join('');
      const note = shippingNote(subtotal(), n);
      foot.innerHTML = `${note ? `<p class="ship-note">${esc(note)}</p>` : ''}
<div class="row"><span>Subtotal</span><span>${money(subtotal())}</span></div>
<small>Demo store: no payment is taken.</small>
<a class="btn btn-block" href="${ROOT}checkout.html">Checkout</a>`;
    }
    renderSummary();
  }
  drawer.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.inc) setQty(+t.dataset.inc, cart[+t.dataset.inc].qty + 1);
    if (t.dataset.dec) setQty(+t.dataset.dec, cart[+t.dataset.dec].qty - 1);
    if (t.dataset.remove) setQty(+t.dataset.remove, 0);
  });

  /* ---------- Search ---------- */
  function runSearch(q) {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = PRODUCTS.filter(p => words.every(w => [p.name, p.category, p.colors[0].name].join(' ').toLowerCase().includes(w)));
    results.innerHTML = list.length
      ? list.map(p => `<a href="${ROOT}${p.url}"><img src="${ROOT}${p.colors[0].img}" alt="" loading="lazy"><span>${esc(p.name)}</span><span>${money(p.price)}</span></a>`).join('')
      : `<p class="search-empty">Nothing matches “${esc(q.trim())}”. Try “shell”, “down” or “red”.</p>`;
  }
  searchInput.addEventListener('input', () => runSearch(searchInput.value));

  /* ---------- Mobile menu ---------- */
  const menuBtn = $('.menu-btn'), menu = $('#menu');
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => {
      const open = menu.hidden;
      menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  /* ---------- Product page ---------- */
  const form = $('form[data-add]');
  if (form) {
    const p = byId[form.dataset.add];
    let size = null;
    const sizeError = $('[data-size-error]'), submit = $('button[type="submit"]', form);
    const bar = $('[data-buybar]'), barBtn = bar && $('[data-buybar-add]', bar);
    const syncBar = () => { if (barBtn) barBtn.textContent = size ? `Add to cart · ${size}` : 'Select size'; };
    $$('[data-size]').forEach(b => b.addEventListener('click', () => {
      size = b.dataset.size;
      $$('[data-size]').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
      sizeError.hidden = true;
      syncBar();
    }));
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!size) { sizeError.hidden = false; $('[data-size]').focus(); return; }
      addToCart(p.id, size, 1);
      submit.textContent = 'Added';
      setTimeout(() => { submit.textContent = 'Add to cart'; }, 1400);
      openCart();
    });
    $$('[data-open-guide]').forEach(b => b.addEventListener('click', () => {
      const d = $('#size-guide');
      d.open = true;
      d.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    /* Buy bar: shown while the main Add to cart button is scrolled out of view above. */
    if (bar && 'IntersectionObserver' in window) {
      const toggle = show => { bar.classList.toggle('show', show); bar.inert = !show; };
      toggle(false);
      new IntersectionObserver(([en]) => toggle(!en.isIntersecting && en.boundingClientRect.top < 0)).observe(submit);
      barBtn.addEventListener('click', () => {
        if (size) { form.requestSubmit(); return; }
        sizeError.hidden = false;
        $('.sizes', form).scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  /* Gallery: thumbnails, arrows, arrow keys and swipe crossfade between the photos. */
  const gallery = $('[data-gallery]');
  if (gallery) {
    const slides = $$('.g-stage img', gallery), thumbs = $$('[data-thumb]', gallery), count = $('[data-g-count]', gallery);
    const stage = $('.g-stage', gallery);
    let g = 0;
    const go = n => {
      g = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('on', k === g));
      thumbs.forEach((t, k) => t.setAttribute('aria-current', String(k === g)));
      count.textContent = `${g + 1} / ${slides.length}`;
    };
    thumbs.forEach((t, k) => t.addEventListener('click', () => go(k)));
    $$('[data-g-step]', gallery).forEach(b => b.addEventListener('click', () => go(g + Number(b.dataset.gStep))));
    gallery.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(g + 1); if (e.key === 'ArrowLeft') go(g - 1); });
    let x0 = null;
    stage.addEventListener('pointerdown', e => { x0 = e.clientX; });
    stage.addEventListener('pointerup', e => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) go(g + (e.clientX < x0 ? 1 : -1)); x0 = null; });
  }

  /* Anatomy: the numbered dots on the jacket and the feature list highlight each other. */
  const anatomy = $('[data-anatomy]');
  if (anatomy) {
    const dots = $$('[data-hs]', anatomy), feats = $$('[data-feat]', anatomy);
    const on = n => {
      dots.forEach((d, k) => d.classList.toggle('on', k === n));
      feats.forEach((f, k) => f.classList.toggle('on', k === n));
    };
    dots.forEach((d, k) => ['mouseenter', 'focus', 'click'].forEach(t => d.addEventListener(t, () => on(k))));
    feats.forEach((f, k) => ['mouseenter', 'focus', 'click'].forEach(t => f.addEventListener(t, () => on(k))));
    on(0);
  }

  /* ---------- Quick add on product cards ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-quick]');
    if (!b) return;
    addToCart(b.closest('[data-id]').dataset.id, b.dataset.quick, 1);
    openCart();
  });

  /* ---------- Shop filters ---------- */
  const grid = $('[data-filterable]');
  if (grid) {
    const chips = $$('[data-filter]'), countEl = $('[data-count]');
    const apply = f => {
      let n = 0;
      $$('.card', grid).forEach(c => { const on = f === 'all' || c.dataset.category === f; c.hidden = !on; if (on) n++; });
      chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.filter === f)));
      countEl.textContent = `${n} ${n === 1 ? 'jacket' : 'jackets'}`;
    };
    chips.forEach(c => c.addEventListener('click', () => { apply(c.dataset.filter); history.replaceState(null, '', c.dataset.filter === 'all' ? location.pathname : '#' + c.dataset.filter); }));
    const start = location.hash.slice(1);
    if (chips.some(c => c.dataset.filter === start)) apply(start);
    addEventListener('hashchange', () => { const h = location.hash.slice(1); if (chips.some(c => c.dataset.filter === h)) apply(h); });
  }

  /* ---------- Checkout ---------- */
  function renderSummary() {
    const box = $('[data-sum-lines]');
    if (!box) return;
    box.innerHTML = cart.length
      ? cart.map(l => { const p = byId[l.id]; return `<div class="sum-line"><img src="${lineImg(l)}" alt=""><div><div>${esc(p.name)}</div><div class="muted">${esc(lineMeta(l) + ' · Qty ' + l.qty)}</div></div><span class="price">${money(p.price * l.qty)}</span></div>`; }).join('')
      : `<p class="muted">Your cart is empty. <a class="link" href="${ROOT}shop.html">Shop jackets</a></p>`;
    const ship = !cart.length || subtotal() >= FREE_SHIPPING_AT ? 0 : SHIPPING_FEE;
    $('[data-sum-subtotal]').textContent = money(subtotal());
    $('[data-sum-shipping]').textContent = ship ? money(ship) : 'Free';
    $('[data-sum-total]').textContent = money(subtotal() + ship);
    const note = $('[data-sum-note]');
    if (note) note.textContent = shippingNote(subtotal(), itemCount());
    const submit = $('[data-checkout-form] button[type="submit"]');
    if (submit) submit.disabled = !cart.length;
  }
  const checkoutForm = $('[data-checkout-form]');
  checkoutForm?.addEventListener('submit', e => {
    e.preventDefault();
    if (!cart.length || !checkoutForm.reportValidity()) return;
    $('[data-order-no]').textContent = 'CA-' + Math.floor(100000 + Math.random() * 900000);
    cart = []; save(); render();
    $('[data-checkout]').hidden = true; $('[data-done]').hidden = false;
    window.scrollTo(0, 0);
  });

  render();
})();
