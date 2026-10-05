/* ChiActive motion engine. No libraries; loaded on every page.
   - Smooth scroll: mouse-wheel input eases the page toward its target (a Lenis-style lerp).
     Touch, keyboard, the scrollbar and anchor links stay native; the engine just follows along.
   - Scenes: CX.scene(el, fn) calls fn(progress, el) on every frame while el is on screen.
     For a pinned section, progress runs 0 to 1 while its sticky stage is pinned. For anything
     else ({ pin: false }), it runs 0 to 1 while the element travels through the viewport.
   - Reveals: [data-split] text is split into words (or letters with data-split="chars") that rise
     in when they enter the screen; [data-reveal] elements unmask or rise in.
   - Header: hides while you scroll down and comes back when you scroll up (homepage).
   Motion is always on: the site is the scroll film, so it plays the same for every visitor. */
(() => {
  const html = document.documentElement;
  const reduce = false;                                    // motion is always on
  const touch = matchMedia('(hover: none)').matches;
  const smooth = !reduce && !touch;
  const CX = window.CX = { reduce, smooth, y: scrollY, velocity: 0, scene, scrollTo: to, measure: measureAll };
  html.classList.add(reduce ? 'cx-still' : 'cx-motion');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ---------- Smooth scroll ---------- */
  let target = scrollY, current = scrollY, max = 0;
  const measureMax = () => { max = Math.max(0, html.scrollHeight - innerHeight); };
  if (smooth) {
    addEventListener('wheel', e => {
      if (e.ctrlKey) return;                                       // pinch zoom
      if (document.body.style.overflow === 'hidden') return;       // cart, menu or search is open
      if (e.target.closest('.drawer, .menu, .search, [data-native-scroll]')) return;
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      target = clamp(target + d, 0, max);
    }, { passive: false });
    // Anything that scrolls the page without the wheel (keys, scrollbar, links) resets the target.
    addEventListener('scroll', () => { if (Math.abs(scrollY - current) > 2) target = current = scrollY; }, { passive: true });
  }
  function to(y, { immediate = false } = {}) {
    y = clamp(y, 0, max || html.scrollHeight);
    if (!smooth) return window.scrollTo({ top: y, behavior: immediate ? 'instant' : 'smooth' });
    target = y;
    if (immediate) { current = y; window.scrollTo(0, y); }
  }

  /* ---------- Scenes ---------- */
  const scenes = [];
  function scene(el, fn, opts = {}) {
    if (!el || reduce) return null;
    const s = { el, fn, pin: opts.pin !== false, always: !!opts.always, start: 0, span: 1, top: 0, bottom: 0, p: -1 };
    scenes.push(s);
    measure(s);
    return s;
  }
  function measure(s) {
    const r = s.el.getBoundingClientRect();
    s.top = r.top + scrollY;
    s.bottom = s.top + s.el.offsetHeight;
    if (s.pin) {
      const stage = s.el.querySelector('[data-stage]') || s.el.firstElementChild;
      const pinTop = parseFloat(getComputedStyle(stage).top) || 0;
      s.start = s.top - pinTop;
      s.span = Math.max(1, s.el.offsetHeight - stage.offsetHeight);
    } else {
      s.start = s.top - innerHeight;
      s.span = innerHeight + s.el.offsetHeight;
    }
  }
  function measureAll() { measureMax(); scenes.forEach(measure); }
  addEventListener('resize', measureAll);
  addEventListener('load', measureAll);
  if (document.fonts) document.fonts.ready.then(measureAll);
  if ('ResizeObserver' in window) new ResizeObserver(() => measureAll()).observe(document.body);

  /* ---------- The loop ---------- */
  const top = document.querySelector('.site-top');
  const autoHide = top && document.body.classList.contains('home-ed');
  let lastY = scrollY, hidden = false;
  function frame() {
    if (smooth && Math.abs(target - current) > 0.3) {
      current += (target - current) * 0.1;
      window.scrollTo(0, current);
    } else if (smooth) {
      current = target;
    }
    const y = scrollY, dy = y - lastY;
    lastY = y;
    CX.y = y;
    CX.velocity += (dy - CX.velocity) * 0.18;
    const vh = innerHeight;
    for (const s of scenes) {
      if (y + vh < s.top - vh * 0.25 || y > s.bottom + vh * 0.25) continue;   // off screen: skip
      const p = clamp((y - s.start) / s.span);
      if (p !== s.p || s.always) { s.p = p; s.fn(p, s); }
    }
    if (autoHide) {
      const hide = y > vh * 0.6 && CX.velocity > 0.6 && !document.body.style.overflow;
      const show = CX.velocity < -0.6 || y < vh * 0.3;
      if (hide && !hidden) { hidden = true; top.classList.add('is-hidden'); }
      else if (show && hidden) { hidden = false; top.classList.remove('is-hidden'); }
    }
    requestAnimationFrame(frame);
  }
  measureMax();
  if (!reduce) requestAnimationFrame(frame);

  /* ---------- Split text ---------- */
  // Wraps every word (or letter) in a mask + an inner span with --i set, keeping <br> and inline tags.
  function split(el, chars) {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const pieces = chars ? [...part] : [part];
            const word = document.createElement('span');
            word.className = 'sw';
            pieces.forEach(ch => {
              const m = document.createElement('span'); m.className = 'sm';
              const inner = document.createElement('span'); inner.className = 'si'; inner.style.setProperty('--i', i++);
              inner.textContent = ch; m.append(inner); word.append(m);
            });
            frag.append(word);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    el.querySelectorAll('.sw').forEach(w => w.setAttribute('aria-hidden', 'true'));
  }
  CX.split = split;
  document.querySelectorAll('[data-split]').forEach(el => split(el, el.dataset.split === 'chars'));

  /* ---------- Reveal on enter ---------- */
  const revealables = document.querySelectorAll('[data-split], [data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    revealables.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -12% 0px' });
    revealables.forEach(el => { if (!el.hasAttribute('data-manual')) io.observe(el); });
  }

  /* ---------- Magnetic buttons ---------- */
  if (!touch && !reduce) {
    document.querySelectorAll('[data-magnetic]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }
})();
