/* Homepage film: the scenes after the unzip intro. Every scene is driven by CX (js/motion.js):
   the scroll position goes in, transforms and opacity come out. Nothing here reads layout per
   frame except where noted, so the page stays smooth. */
(() => {
  const CX = window.CX;
  if (!CX || CX.reduce) return;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const out = t => 1 - Math.pow(1 - t, 3);
  const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Manifesto: the words light up one by one as the sentence passes the middle ---------- */
  const mf = document.querySelector('[data-scrub]');
  if (mf) {
    const words = mf.textContent.trim().split(/\s+/);
    mf.setAttribute('aria-label', mf.textContent.trim());
    mf.innerHTML = words.map(w => `<span class="mw" aria-hidden="true">${w}</span>`).join(' ');
    const spans = [...mf.querySelectorAll('.mw')];
    CX.scene(mf, p => {
      const k = seg(p, 0.22, 0.62) * spans.length;
      spans.forEach((s, i) => { s.style.opacity = 0.14 + 0.86 * clamp(k - i); });
    }, { pin: false });
  }

  /* ---------- Marquee: drifts on its own, speeds up and skews with scroll speed, follows direction ---------- */
  const mq = document.querySelector('.mq');
  if (mq) {
    const track = mq.querySelector('.mq-track'), group = mq.querySelector('.mq-group');
    let x = 0, dir = 1, w = 0;
    const size = () => { w = group.offsetWidth; };
    size(); addEventListener('resize', size);
    CX.scene(mq, () => {
      const v = CX.velocity;
      if (v > 0.3) dir = 1; else if (v < -0.3) dir = -1;
      x -= (0.7 + Math.abs(v) * 0.4) * dir;
      if (x <= -w) x += w; else if (x > 0) x -= w;
      track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0) skewX(${clamp(-v * 0.35, -14, 14).toFixed(2)}deg)`;
    }, { pin: false, always: true });
  }

  /* ---------- Seasons: a horizontal journey through four kinds of cold ---------- */
  const ss = document.querySelector('[data-seasons]');
  if (ss) {
    const track = ss.querySelector('.ss-track'), panels = [...ss.querySelectorAll('.ss-panel')], n = panels.length;
    const bars = [...ss.querySelectorAll('.ss-bars span')], num = ss.querySelector('[data-ss-n]');
    const parts = panels.map(el => ({
      el, media: el.querySelector('.ss-media'), frame: el.querySelector('.ss-frame'), month: el.querySelector('.ss-month'), info: el.querySelector('.ss-info'),
      temp: el.querySelector('[data-temp]'), cut: el.querySelector('.ss-hero-cut'),
      rain: el.querySelector('.ss-rain'),
    }));
    const night = parts.find(o => o.rain);
    const rain = night && makeRain(night.rain);
    CX.scene(ss, p => {
      const x = p * (n - 1);                                   // 0 .. n-1: which panel is centred
      track.style.transform = `translate3d(${(-x * 100).toFixed(3)}vw, 0, 0)`;
      parts.forEach((o, i) => {
        const lp = i - x;                                      // 0 centred, +1 waiting on the right, -1 gone left
        if (Math.abs(lp) > 1.05) return;
        o.media.style.transform = `translate3d(${(-lp * 22).toFixed(2)}vw, 0, 0)`;           // blurred backdrop lags: depth
        if (o.frame) o.frame.style.transform = `translate3d(${(lp * 9).toFixed(2)}vw, 0, 0) scale(${(1 - Math.abs(lp) * 0.08).toFixed(4)})`;   // the framed photo drifts in between
        o.month.style.transform = `translate3d(${(lp * 38).toFixed(2)}vw, 0, 0)`;            // month races ahead
        const k = out(seg(1 - Math.abs(lp), 0.25, 1));
        o.info.style.opacity = k; o.info.style.transform = `translate3d(0, ${((1 - k) * 40).toFixed(1)}px, 0)`;
        const t0 = +o.temp.dataset.from, t1 = +o.temp.dataset.temp;
        const t = Math.round(lerp(t0, t1, out(seg(1 - lp, 0.2, 1))));
        o.temp.textContent = (t < 0 ? '−' : '') + Math.abs(t);
        if (o.cut) o.cut.style.transform = `translate3d(${(lp * 30).toFixed(2)}vw, ${(Math.abs(lp) * 6).toFixed(2)}vh, 0) rotate(${(lp * 8).toFixed(2)}deg)`;
      });
      bars.forEach((b, i) => { b.style.transform = `scaleX(${clamp(x - i + 1).toFixed(3)})`; });
      num.textContent = String(Math.min(n, Math.round(x) + 1)).padStart(2, '0');
      if (rain) rain.active(Math.abs(n - 1 - x) < 1);
    });
  }

  /* Rain for the night panel: light streaks on a canvas, only drawn while the panel is on screen. */
  function makeRain(canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, drops = [], on = false, raf = 0;
    const size = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = canvas.width = Math.round(r.width * dpr); h = canvas.height = Math.round(r.height * dpr);
      drops = Array.from({ length: Math.round(w * h / 9000) }, () => ({ x: Math.random() * w * 1.2, y: Math.random() * h, l: 10 + Math.random() * 26, v: 9 + Math.random() * 12, a: 0.12 + Math.random() * 0.3 }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (const d of drops) {
        d.y += d.v; d.x -= d.v * 0.22;
        if (d.y > h + d.l) { d.y = -d.l; d.x = Math.random() * w * 1.2; }
        ctx.strokeStyle = `rgba(190, 210, 235, ${d.a})`;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * 0.22, d.y - d.l); ctx.stroke();
      }
      raf = on ? requestAnimationFrame(draw) : 0;
    };
    addEventListener('resize', () => { if (on) size(); });
    return { active(v) { if (v === on) return; on = v; if (on) { if (!w) size(); if (!raf) raf = requestAnimationFrame(draw); } } };
  }

  /* ---------- The star: zoom from the jacket into the patch, then into the red star until it fills the screen ----------
     Measured on the photos: the patch sits at 55.0% / 30.7% of the jacket image (6.9% wide), and the
     star's centre is at 49.7% / 48.2% of the patch with a radius of 23.5% of its width. */
  const st = document.querySelector('[data-star]');
  if (st) {
    const stage = st.querySelector('.st-stage'), cam = st.querySelector('.st-cam'), badge = st.querySelector('.st-badge');
    const bg = st.querySelector('.st-bg'), svg = st.querySelector('.st-svg'), star = st.querySelector('.st-star');
    const fig = st.querySelector('.st-fig'), look = st.querySelector('.st-look'), notes = st.querySelector('.st-notes');
    const fin = st.querySelector('.st-final'), finH = fin.querySelector('h2');
    const IMG = 1136 / 1408, PATCH = { x: 0.5502, y: 0.3068, w: 0.0687, h: 0.0554 }, STAR = { x: 0.4969, y: 0.4823, r: 0.2346 };
    let vw, vh, cw, ch, bx, by, P, S, ps, R;
    const layout = () => {
      vw = stage.clientWidth; vh = stage.clientHeight;
      ch = vh * 0.82; cw = ch * IMG;
      if (cw > vw * 0.86) { cw = vw * 0.86; ch = cw / IMG; }
      cam.style.width = cw + 'px'; cam.style.height = ch + 'px';
      bx = (vw - cw) / 2; by = (vh - ch) / 2 + vh * 0.03;
      ps = PATCH.w * cw;
      P = { x: (PATCH.x + PATCH.w / 2) * cw, y: (PATCH.y + PATCH.h / 2) * ch };
      S = { x: PATCH.x * cw + STAR.x * ps, y: PATCH.y * ch + STAR.y * ps };
      R = STAR.r * ps;
      svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    };
    layout(); addEventListener('resize', () => { layout(); CX.measure(); });
    CX.scene(st, p => {
      const C = { x: vw / 2, y: vh / 2 };
      const sA = (0.46 * Math.min(vw, vh)) / ps;                       // the patch fills ~half the screen
      const sB = (Math.hypot(vw, vh) / 2) / (0.48 * R) * 1.1;          // the star's inner corners pass the screen corners
      const zA = inOut(seg(p, 0.06, 0.42)), zB = inOut(seg(p, 0.5, 0.84));
      let s, tx, ty;
      if (zB <= 0) {
        s = Math.exp(Math.log(sA) * zA);                                // zoom with constant perceived speed
        const sx = lerp(bx + P.x, C.x, zA), sy = lerp(by + P.y, C.y, zA);   // the patch glides to the centre
        tx = sx - P.x * s; ty = sy - P.y * s;
      } else {
        s = sA * Math.exp(Math.log(sB / sA) * zB);
        const fx = lerp(P.x, S.x, zB), fy = lerp(P.y, S.y, zB);         // then the star becomes the focus
        tx = C.x - fx * s; ty = C.y - fy * s;
      }
      const sky = seg(zB, 0.08, 0.26);
      cam.style.visibility = sky >= 1 ? 'hidden' : 'visible';
      if (sky < 1) cam.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
      badge.style.opacity = seg(zA, 0.3, 0.62);
      bg.style.opacity = sky;
      // The vector star takes over from the badge, so it stays razor sharp at any size.
      const r = R * s, cx = tx + S.x * s, cy = ty + S.y * s;
      star.setAttribute('transform', `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${r.toFixed(3)})`);
      svg.style.opacity = seg(zB, 0.02, 0.13);
      const c = seg(zB, 0.3, 0.9);
      star.style.fill = `rgb(${Math.round(lerp(251, 228, c))}, ${Math.round(lerp(26, 2, c))}, ${Math.round(lerp(76, 43, c))})`;
      fin.style.pointerEvents = p > 0.86 ? 'auto' : 'none';
      fig.style.opacity = look.style.opacity = 1 - seg(p, 0.08, 0.18);
      notes.style.opacity = seg(p, 0.36, 0.44) * (1 - seg(p, 0.52, 0.58));
      fin.style.opacity = seg(p, 0.84, 0.88);
      finH.classList.toggle('is-in', p > 0.86);
    });
  }

  /* ---------- Gallery: three columns drifting at different speeds ---------- */
  const gl = document.querySelector('[data-gallery-cols] .gl-cols');
  if (gl) {
    const cols = [...gl.querySelectorAll('.gl-col')].map(c => ({ c, sp: +c.dataset.speed }));
    const small = matchMedia('(max-width: 800px)');
    CX.scene(gl, p => {
      const k = small.matches ? 70 : 170;
      cols.forEach(({ c, sp }) => { c.style.transform = `translate3d(0, ${((p - 0.5) * sp * k).toFixed(1)}px, 0)`; });
    }, { pin: false });
  }
})();
