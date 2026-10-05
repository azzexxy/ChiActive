/* Unzip intro (homepage). Three shots, all driven by the scroll position:
     1. The jacket   - the Lakeshore Shell stands in front of the CHIACTIVE wordmark. Scrolling pushes
                       the camera into the zip at the collar. (If images/ai/unzip/ holds an AI-made
                       video as frames, those frames play here instead.)
     2. Macro unzip  - the screen is now the jacket's fabric, drawn live in a WebGL shader: blue
                       ripstop, navy zip tape, metal teeth that interlock, and the ChiActive patch.
                       The pull slides down; above it the two sides part in a soft V and cast a
                       shadow into the opening, where Collection 01 is waiting.
     3. The way in   - both sides slide off the screen and the collection is there.
   Dragging the zip pull just scrolls the page, so scroll and drag can never disagree. */
(() => {
  const zip = document.querySelector('[data-zip]');
  if (!zip) return;
  const q = s => zip.querySelector(s);
  const pin = q('.zip-pin'), photo = q('.zip-photo'), canvas = q('.zip-gl'), badgeImg = q('.zip-badge'), frames = q('[data-zip-frames]');
  const pull = q('.zip-pull'), hint = q('.zip-hint'), cue = q('.zip-cue'), word = q('.zip-word');
  const inside = q('.zip-inside'), head = q('.zi-head'), all = q('.zi-all'), items = [...zip.querySelectorAll('.zi-item')];
  const reduce = false;                                    // motion is always on (same as js/motion.js)
  const gl = !reduce && canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) { zip.classList.add('zip-still'); return; }

  /* Measured on the cut-out (images/ai/cutouts/lakeshore-shell-hd.webp, 931 x 1312). */
  const AR = 931 / 1312;
  const COLLAR = 0.135;                                    // where the zip starts, share of the height
  const PATCH = { x: 0.5502, y: 0.3068, w: 0.0687 };       // the chest patch
  const MACRO = 1.8;                                       // in the macro shot the jacket is 1.8 screens wide
  const PULL_H = 0.035;                                    // the pull is 3.5% of the jacket's height

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const even = t => t * t * (3 - 2 * t);
  const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const out = t => 1 - Math.pow(1 - t, 3);

  /* ---------- The macro shader: one full-screen triangle, everything computed per pixel ---------- */
  const VS = 'attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }';
  const FS = `
    precision highp float;
    uniform vec2 uRes; uniform float uDpr, uAlpha;
    uniform float uCx, uYs, uK, uB, uExtra, uT, uP, uTape, uFall;
    uniform vec4 uPatch; uniform sampler2D uBadge; uniform float uHasBadge;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    // Half the opening at height y: zero at the pull, a rounded V above it (a hyperbola).
    float gapAt(float y) { float d = max(uYs - y, 0.0) / uB; return uK * uB * (sqrt(1.0 + d * d) - 1.0); }
    // How much of that the fabric follows, by distance from the zip: all of it at the zip, none far away.
    float follow(float s) { return 1.0 - smoothstep(0.0, uFall, s); }
    // Which point of each half's fabric lands on screen x (the inverse of the bend, by iteration).
    float matL(float x, float g) { float m = x + g + uExtra; for (int i = 0; i < 8; i++) m = x + g * follow(uCx - m) + uExtra; return m; }
    float matR(float x, float g) { float m = x - g - uExtra; for (int i = 0; i < 8; i++) m = x - g * follow(m - uCx) - uExtra; return m; }

    vec3 fabric(vec2 m, float bend) {
      vec3 c = vec3(0.262, 0.668, 0.905);
      float w = noise(m / 260.0) * 0.6 + noise(m / 95.0) * 0.4;           // soft wrinkles
      c *= 0.84 + 0.24 * w;
      vec2 r = abs(fract(m / 9.0) - 0.5);                                   // ripstop grid
      c *= 1.0 + 0.06 * (1.0 - smoothstep(0.0, 0.08, min(r.x, r.y)));
      c *= 0.985 + 0.03 * hash(floor(m));                                   // weave grain
      c *= 1.0 - 0.06 * (m.y / uRes.y);                                     // light from above
      return c * (1.0 - bend);
    }
    float placket(float s) { return 1.0 - 0.22 * exp(-(s - uT * 0.5 - uTape) / 14.0); }   // fabric dips beside the zip
    vec3 tape(vec2 m) {
      float weave = 0.5 + 0.5 * sin((m.x + m.y) * 1.9);
      return vec3(0.105, 0.15, 0.225) * (0.9 + 0.12 * weave);
    }
    // One tooth: a rounded block. q.x runs from the tape (0) to the tip (uT), q.y along the zip.
    vec4 tooth(vec2 q, float len) {
      vec2 c = vec2(uT * 0.5, len * 0.5), h = vec2(uT * 0.5, len * 0.5 - uP * 0.05);
      float r = uP * 0.16;
      vec2 d = abs(q - c) - h + r;
      float sdf = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
      float a = clamp(0.5 - sdf, 0.0, 1.0);
      float across = clamp(q.y / len, 0.0, 1.0);
      float shade = 0.28 + 0.72 * pow(sin(3.14159 * across), 0.65);          // round in section
      shade *= 0.75 + 0.25 * smoothstep(uT, 0.0, q.x);                       // tips a touch darker
      float spec = pow(max(0.0, 1.0 - abs(across - 0.32) * 5.0), 3.0) * 0.6;  // a hot highlight
      vec3 col = mix(vec3(0.17, 0.19, 0.22), vec3(0.80, 0.83, 0.87), shade) + spec;
      col *= 1.0 - 0.35 * smoothstep(-2.5, 0.0, sdf);                        // dark rim
      return vec4(col * a, a);
    }

    void main() {
      vec2 px = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;    // CSS pixels, y down
      float x = px.x, y = px.y;
      float g = gapAt(y);
      float slot = fract(y / uP);
      float bendK = g / max(uFall, 1.0) * 1.6;

      // Left half
      float mL = matL(x, g), sL = uCx - mL;
      vec4 L = vec4(0.0);
      float bendL = bendK * follow(sL) * (1.0 - follow(sL)) * 4.0 * 0.5;
      if (sL > uT * 0.5 + uTape) L = vec4(fabric(vec2(mL, y), bendL) * placket(sL), 1.0);
      else if (sL > uT * 0.5) L = vec4(tape(vec2(mL, y)), 1.0);
      if (sL > uT * 0.5 + uTape - 1.0 && sL < uT * 0.5 + uTape + 1.5) L.rgb *= 0.78;  // stitched edge
      if (sL <= uT * 0.5 && sL > -uT * 0.5 - 1.0 && slot < 0.5) L = tooth(vec2(uT * 0.5 - sL, slot * uP), uP * 0.5);

      // Right half (its teeth sit in the other half of each slot, so closed teeth interlock)
      float mR = matR(x, g), sR = mR - uCx;
      vec4 R = vec4(0.0);
      float bendR = bendK * follow(sR) * (1.0 - follow(sR)) * 4.0 * 0.5;
      if (sR > uT * 0.5 + uTape) {
        vec3 c = fabric(vec2(mR, y), bendR) * placket(sR);
        vec2 pu = (vec2(mR, y) - uPatch.xy) / uPatch.zw;                    // the patch rides on this half
        if (uHasBadge > 0.5 && pu.x > 0.0 && pu.x < 1.0 && pu.y > 0.0 && pu.y < 1.0) {
          vec4 b = texture2D(uBadge, pu);
          float sh = texture2D(uBadge, pu - vec2(0.0, 0.035)).a;                // stitched patch casts a small shadow
          c = (c * (1.0 - 0.35 * sh * (1.0 - b.a))) * (1.0 - b.a) + b.rgb;
        }
        R = vec4(c, 1.0);
      } else if (sR > uT * 0.5) R = vec4(tape(vec2(mR, y)), 1.0);
      if (sR > uT * 0.5 + uTape - 1.0 && sR < uT * 0.5 + uTape + 1.5) R.rgb *= 0.78;
      if (sR <= uT * 0.5 && sR > -uT * 0.5 - 1.0 && slot >= 0.5) R = tooth(vec2(uT * 0.5 - sR, (slot - 0.5) * uP), uP * 0.5);

      vec4 c = L + R * (1.0 - L.a);
      // The opening: a soft shadow from both edges falls onto what is inside.
      float eL = uCx - uT * 0.5 - g - uExtra, eR = uCx + uT * 0.5 + g + uExtra;
      float dist = min(x - eL, eR - x);
      float sh = 0.55 * exp(-max(dist, 0.0) / 26.0) * step(0.5, g + uExtra);
      c += vec4(0.0, 0.0, 0.0, sh) * (1.0 - c.a);
      gl_FragColor = c * uAlpha;
    }`;
  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  let prog, U = {};
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) { console.warn('Unzip intro fell back:', err); zip.classList.add('zip-still'); return; }
  gl.useProgram(prog);
  for (let i = 0, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const name = gl.getActiveUniform(prog, i).name; U[name] = gl.getUniformLocation(prog, name);
  }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let hasBadge = 0;
  const loadBadge = () => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, badgeImg);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]
      .forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    hasBadge = 1; requestAnimationFrame(() => render(cur));   // next frame: the loop below is set up by then
  };
  if (badgeImg.complete && badgeImg.naturalWidth) loadBadge(); else badgeImg.addEventListener('load', loadBadge, { once: true });

  /* ---------- Optional: AI video frames for shot 1 (images/ai/unzip/0001.webp ...) ---------- */
  let seq = null;
  if (frames) {
    const n = +frames.dataset.zipFrames, base = frames.dataset.src;
    const ctx = frames.getContext('2d');
    seq = { ctx, imgs: Array.from({ length: n }, (_, i) => { const im = new Image(); im.decoding = 'async'; im.src = `${base}${String(i + 1).padStart(4, '0')}.webp`; return im; }), last: -1 };
  }

  /* ---------- Layout ---------- */
  let vw = 0, vh = 0, dpr = 1, base = null, Wj = 0, Hj = 0, T = 0;
  const size = () => {
    vw = pin.clientWidth; vh = pin.clientHeight; dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const h = Math.min(vh * 0.9, (vw * 0.94) / AR), w = h * AR;         // the jacket, standing in the frame
    base = { x: (vw - w) / 2, y: vh - h - vh * 0.03, w, h };
    photo.style.width = w + 'px'; photo.style.height = h + 'px';
    Wj = vw * MACRO; Hj = Wj / AR;                                       // the jacket's size in the macro shot
    T = clamp(vw * 0.034, 22, 46);                                       // tooth length: big, it's a macro shot
    if (seq) { seq.ctx.canvas.width = Math.round(vw * dpr); seq.ctx.canvas.height = Math.round(vh * dpr); seq.last = -1; }
  };

  /* ---------- Scroll ---------- */
  let start = 0, span = 1;
  const measure = () => {
    start = zip.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(pin).top) || 0);
    span = Math.max(1, zip.offsetHeight - pin.offsetHeight);
  };
  const target = () => clamp((scrollY - start) / span);
  const SHOT1 = [0.03, 0.22], HANDOFF = [0.19, 0.24], UNZIP = [0.22, 0.7], OPEN = [0.7, 0.88];

  function render(p) {
    if (!vw) return;
    const collarY = vh * 0.2;                                            // where the camera lands at the collar
    /* Shot 1: push in from the jacket to the collar of the zip (exponential zoom = steady feel). */
    const z = inOut(seg(p, ...SHOT1));
    const sEnd = Wj / base.w, s = Math.exp(Math.log(sEnd) * z);
    const fx = 0.5 * base.w, fy = COLLAR * base.h;                       // focus: the top of the zip
    const sx = lerp(base.x + fx, vw / 2, z), sy = lerp(base.y + fy, collarY, z);
    const tx = sx - fx * s, ty = sy - fy * s;
    photo.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
    const hand = seg(p, ...HANDOFF);
    photo.style.opacity = 1 - hand;
    word.style.opacity = 1 - seg(p, 0.06, 0.16);
    if (seq) {
      const k = Math.round(seg(p, ...SHOT1) * (seq.imgs.length - 1));
      const im = seq.imgs[k];
      if (k !== seq.last && im.complete && im.naturalWidth) {
        const c = seq.ctx.canvas, r = Math.max(c.width / im.naturalWidth, c.height / im.naturalHeight);
        seq.ctx.drawImage(im, (c.width - im.naturalWidth * r) / 2, (c.height - im.naturalHeight * r) / 2, im.naturalWidth * r, im.naturalHeight * r);
        seq.last = k;
      }
      frames.style.opacity = (p > 0.005 ? 1 : 0) * (1 - hand);
    }

    /* Shot 2 and 3: the macro zip, then both sides slide away. */
    const u = even(seg(p, ...UNZIP)), d = inOut(seg(p, ...OPEN));
    const Ys = lerp(collarY, vh * 1.25, u);
    const grow = lerp(0.45, 1, out(seg(p, 0.2, 0.32)));                // teeth grow from the photo's scale
    const t = T * grow;
    canvas.style.opacity = hand;
    if (hand > 0) {
      gl.uniform2f(U.uRes, vw, vh); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uAlpha, 1);
      gl.uniform1f(U.uCx, vw / 2); gl.uniform1f(U.uYs, Ys);
      gl.uniform1f(U.uK, 0.34); gl.uniform1f(U.uB, Math.max(40, t * 3));
      gl.uniform1f(U.uExtra, d * vw * 0.62);
      gl.uniform1f(U.uT, t); gl.uniform1f(U.uP, t * 0.78); gl.uniform1f(U.uTape, t * 0.55);
      gl.uniform1f(U.uFall, vw * 0.42);
      const pw = PATCH.w * Wj;
      gl.uniform4f(U.uPatch, vw / 2 + (PATCH.x - 0.5) * Wj, collarY + (PATCH.y - COLLAR) * Hj, pw, pw);
      gl.uniform1f(U.uHasBadge, hasBadge); gl.uniform1i(U.uBadge, 0);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* The pull: rides the collar in shot 1 (scaled with the jacket), then the zip in shot 2. */
    const jh = lerp(base.h * s, Hj, hand);                              // jacket height on screen
    const pullX = lerp(tx + fx * s, vw / 2, hand), pullY = lerp(ty + fy * s, Ys, hand);
    const ps = lerp((jh * PULL_H) / 140, clamp(vh / 640, 0.8, 1.3), hand);   // true to the photo, then a proper macro size
    pull.style.transform = `translate3d(${pullX.toFixed(1)}px, ${pullY.toFixed(1)}px, 0) scale(${ps.toFixed(4)})`;
    pull.style.opacity = 1 - seg(p, 0.6, 0.7);
    pull.setAttribute('aria-valuenow', Math.round(u * 100));
    hint.style.opacity = 1 - seg(p, 0, 0.03);
    hint.style.transform = `translate3d(${(pullX + 26).toFixed(1)}px, ${(pullY + 4).toFixed(1)}px, 0)`;
    cue.style.opacity = 1 - seg(p, 0, 0.04);

    /* Inside: Collection 01 waits behind the fabric and settles as the sides part. */
    inside.style.opacity = hand >= 1 ? 1 : 0;
    inside.style.transform = `scale(${(1.08 - 0.08 * Math.max(u * 0.6, d)).toFixed(4)})`;
    const h2 = out(seg(p, 0.5, 0.78));
    head.style.opacity = 0.35 + 0.65 * h2; head.style.transform = `translate3d(0, ${((1 - h2) * 24).toFixed(1)}px, 0)`;
    items.forEach((el, i) => {
      const k = out(seg(p, 0.42 + i * 0.03, 0.8 + i * 0.02));
      el.style.opacity = 0.3 + 0.7 * k; el.style.transform = `translate3d(0, ${((1 - k) * 50).toFixed(1)}px, 0)`;
    });
    all.style.opacity = out(seg(p, 0.84, 0.97));
    zip.classList.toggle('zip-in', p > 0.84);
  }

  /* ---------- One rAF loop: ease the drawn progress toward the scroll progress ---------- */
  let cur = 0, raf = 0;
  const tick = () => {
    const t = target();
    cur += (t - cur) * (window.CX && CX.smooth ? 0.4 : 0.2);
    if (Math.abs(t - cur) < 0.0004) cur = t;
    render(cur);
    raf = cur === t ? 0 : requestAnimationFrame(tick);
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', () => { size(); measure(); render(cur); });
  addEventListener('load', () => { measure(); wake(); });
  size(); measure(); cur = target(); render(cur);
  zip.classList.add('zip-gl-on');

  /* ---------- The pull: drag it down (or use the keyboard) ---------- */
  const scrollToProgress = (p, smooth) => (window.CX
    ? CX.scrollTo(start + p * span, { immediate: !smooth })
    : window.scrollTo({ top: start + p * span, behavior: smooth ? 'smooth' : 'instant' }));
  let drag = null;
  pull.addEventListener('pointerdown', e => {
    measure();
    drag = { y: e.clientY, p: target() };
    pull.setPointerCapture(e.pointerId); zip.classList.add('zip-drag'); e.preventDefault();
  });
  pull.addEventListener('pointermove', e => {
    if (!drag) return;
    // Pulling the full height of the screen takes you from the collar to the end of the unzip.
    scrollToProgress(clamp(drag.p + (e.clientY - drag.y) / vh * UNZIP[1]), false);
  });
  const release = () => {
    if (!drag) return;
    drag = null; zip.classList.remove('zip-drag');
    if (target() > 0.45) scrollToProgress(1, true);
  };
  pull.addEventListener('pointerup', release);
  pull.addEventListener('pointercancel', release);
  pull.addEventListener('keydown', e => {
    const p = target();
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { scrollToProgress(Math.min(1, p + 0.05), true); e.preventDefault(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { scrollToProgress(Math.max(0, p - 0.05), true); e.preventDefault(); }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'End') { scrollToProgress(1, true); e.preventDefault(); }
  });
})();
