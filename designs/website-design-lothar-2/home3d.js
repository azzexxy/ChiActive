/* ChiActive homepage hero: a low-poly Chicago on Lake Michigan, a Chicago-flag star
   you can spin, and weather that follows the season (html[data-season]). */
(function () {
  var canvas = document.getElementById('hero3d');
  if (!canvas) return;
  var root = document.documentElement;
  function fallback() { root.classList.add('no-3d'); }
  if (!window.THREE) return fallback();
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { return fallback(); }
  if (!renderer.getContext()) return fallback();

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));


  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
  var camBase = new THREE.Vector3(0, 4.5, 46), look = new THREE.Vector3(0, 13, 0);

  /* ---------- Seasons ---------- */
  var SEASONS = {
    winter: { top: '#0E1726', bot: '#3E5F7E', fog: '#2A3F57', lake: '#244766', bld: '#22304A', glow: .85,  hemiS: '#9FC4E8', hemiG: '#16202E', hemiI: .65, sun: '#DCE9FF', sunI: .55, orb: '#EEF4FF', orbY: 46, orbS: 9, wind: 7,  kind: 'snow' },
    spring: { top: '#1D3249', bot: '#7FB0C9', fog: '#557F99', lake: '#2F7398', bld: '#2B3B52', glow: .55,  hemiS: '#CFE6F2', hemiG: '#24303D', hemiI: .8,  sun: '#FFFFFF', sunI: .6,  orb: '#E8F2F8', orbY: 40, orbS: 12, wind: 3,  kind: 'rain' },
    summer: { top: '#1B3150', bot: '#F2B872', fog: '#B88B66', lake: '#2E93C7', bld: '#2F3F53', glow: .2,   hemiS: '#FFE3B8', hemiG: '#3A3240', hemiI: .9,  sun: '#FFD59A', sunI: 1.1, orb: '#FFC977', orbY: 12, orbS: 22, wind: .8, kind: 'motes' },
    fall:   { top: '#211F3B', bot: '#D9784A', fog: '#7D5146', lake: '#2E5677', bld: '#29293F', glow: .65,  hemiS: '#FFD2B0', hemiG: '#2A2030', hemiI: .75, sun: '#FFB27A', sunI: .9,  orb: '#FF9E5E', orbY: 16, orbS: 18, wind: 4,  kind: 'leaves' }
  };
  var col = function (h) { return new THREE.Color(h); };
  var cur = {}, target = SEASONS.winter;
  ['top', 'bot', 'fog', 'lake', 'bld', 'hemiS', 'hemiG', 'sun', 'orb'].forEach(function (k) { cur[k] = col(target[k]); });
  ['glow', 'hemiI', 'sunI', 'orbY', 'orbS', 'wind'].forEach(function (k) { cur[k] = target[k]; });

  /* ---------- Sky dome ---------- */
  var skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: cur.top.clone() }, bot: { value: cur.bot.clone() } },
    vertexShader: 'varying float h; void main(){ vec4 w = modelMatrix * vec4(position,1.0); h = normalize(w.xyz).y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float h; void main(){ float t = smoothstep(-0.02, 0.45, h); gl_FragColor = vec4(mix(bot, top, t), 1.0); }'
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), skyMat));
  scene.fog = new THREE.Fog(cur.fog.clone(), 60, 230);

  /* ---------- Lights ---------- */
  var hemi = new THREE.HemisphereLight(cur.hemiS, cur.hemiG, cur.hemiI); scene.add(hemi);
  var sun = new THREE.DirectionalLight(cur.sun, cur.sunI); sun.position.set(-30, 40, 30); scene.add(sun);

  /* ---------- Sun / moon glow ---------- */
  function radialTex(stops) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,255,255,1)'], [.22, 'rgba(255,255,255,1)'], [.3, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]), color: cur.orb, fog: false, depthWrite: false, transparent: true }));
  orb.position.set(-4, cur.orbY, -150); orb.scale.set(cur.orbS * 2, cur.orbS * 2, 1); scene.add(orb);

  /* ---------- Window texture for the skyline ---------- */
  var wc = document.createElement('canvas'); wc.width = 64; wc.height = 128;
  var wg = wc.getContext('2d'); wg.fillStyle = '#000'; wg.fillRect(0, 0, 64, 128);
  for (var wy = 4; wy < 128; wy += 8) for (var wx = 4; wx < 64; wx += 8) {
    if (Math.random() < .28) { wg.fillStyle = Math.random() < .8 ? '#FFD98A' : '#BFE6FF'; wg.fillRect(wx, wy, 4, 5); }
  }
  var winTex = new THREE.CanvasTexture(wc); winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping; winTex.magFilter = THREE.NearestFilter;

  /* ---------- Skyline ---------- */
  var city = new THREE.Group(); scene.add(city);
  var bldMats = [];
  function bldMat(w, h) {
    var t = winTex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, w / 3.2), Math.max(1, h / 6.4));
    t.offset.set(Math.random(), Math.random());
    var m = new THREE.MeshStandardMaterial({ color: cur.bld.clone(), roughness: .85, metalness: .1, flatShading: true, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: cur.glow });
    bldMats.push(m); return m;
  }
  function box(x, z, w, d, h, y0) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldMat(w, h));
    m.position.set(x, (y0 || 0) + h / 2, z); city.add(m); return m;
  }
  function antenna(x, z, y, h) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, h, 6), new THREE.MeshStandardMaterial({ color: '#8A97A8', roughness: .5 }));
    m.position.set(x, y + h / 2, z); city.add(m);
    var tip = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 8), new THREE.MeshBasicMaterial({ color: '#E4022B' }));
    tip.position.set(x, y + h, z); city.add(tip); tips.push(tip);
  }
  var tips = [];
  // generic towers
  var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  for (var i = 0; i < 90; i++) {
    var x = (rnd() - .5) * 130, z = -30 - rnd() * 26;
    var core = Math.exp(-Math.pow(x / 24, 2));
    var h = 2 + rnd() * 4 + core * (5 + rnd() * 12);
    box(x, z, 2 + rnd() * 3, 2 + rnd() * 3, h);
  }
  // Willis-style stepped tower
  box(-9, -32, 4.2, 4.2, 20); box(-9.6, -32.6, 3, 3, 24); box(-8.4, -31.4, 2.4, 2.4, 28);
  antenna(-9.2, -32.2, 28, 5); antenna(-8, -31, 28, 5);
  // Hancock-style tapered tower
  var hk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.7, 23, 4), bldMat(5, 23)); hk.rotation.y = Math.PI / 4; hk.position.set(12, 11.5, -31); city.add(hk);
  antenna(11.4, -31, 23, 5); antenna(12.6, -31, 23, 4);
  // Stepped riverfront tower
  box(3, -33, 3.6, 3.6, 15); box(3, -33, 2.8, 2.8, 4, 15); box(3, -33, 2, 2, 4, 19); antenna(3, -33, 23, 4);
  // ground / shore
  var shore = new THREE.Mesh(new THREE.BoxGeometry(260, 1, 40), new THREE.MeshStandardMaterial({ color: '#1C2738', roughness: 1 }));
  shore.position.set(0, -0.5, -42); scene.add(shore);
  var beach = new THREE.Mesh(new THREE.BoxGeometry(260, .6, 3), new THREE.MeshStandardMaterial({ color: '#E9D9A8', roughness: 1 }));
  beach.position.set(0, -.2, -22.5); scene.add(beach);

  /* ---------- Lake (low-poly waves) ---------- */
  var lakeGeo = new THREE.PlaneGeometry(320, 90, 64, 22); lakeGeo.rotateX(-Math.PI / 2);
  var lakeMat = new THREE.MeshStandardMaterial({ color: cur.lake.clone(), roughness: .35, metalness: .2, flatShading: true });
  var lake = new THREE.Mesh(lakeGeo, lakeMat); lake.position.set(0, -.4, 23); scene.add(lake);
  var lp = lakeGeo.attributes.position, lakeBase = new Float32Array(lp.array);

  /* ---------- The star ---------- */
  var shape = new THREE.Shape(), R = 3.4, r = R * .42;
  for (var k = 0; k < 12; k++) {
    var a = Math.PI / 2 + k * Math.PI / 6, rad = k % 2 ? r : R;
    if (k === 0) shape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else shape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  shape.closePath();
  var starGeo = new THREE.ExtrudeGeometry(shape, { depth: .9, bevelEnabled: true, bevelThickness: .45, bevelSize: .32, bevelSegments: 4, curveSegments: 1 });
  starGeo.center();
  var star = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({ color: '#E4022B', roughness: .38, metalness: .12, emissive: '#3a0008', emissiveIntensity: .25 }));
  var starHolder = new THREE.Group(); starHolder.add(star); scene.add(starHolder);
  var starLight = new THREE.PointLight('#FFFFFF', .35, 30); starHolder.add(starLight); starLight.position.set(0, 0, 4);
  // halo ring
  var halo = new THREE.Mesh(new THREE.TorusGeometry(4.6, .07, 8, 80), new THREE.MeshBasicMaterial({ color: '#41b6e6', transparent: true, opacity: .7 }));
  starHolder.add(halo);

  /* ---------- Weather particles ---------- */
  var N = window.innerWidth < 700 ? 900 : 1800;
  var pGeo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), seedA = new Float32Array(N);
  var BX = 70, BY0 = -1, BY1 = 38, BZ0 = -20, BZ1 = 34;
  for (var p = 0; p < N; p++) {
    pos[p * 3] = (Math.random() - .5) * BX * 2; pos[p * 3 + 1] = BY0 + Math.random() * (BY1 - BY0); pos[p * 3 + 2] = BZ0 + Math.random() * (BZ1 - BZ0);
    seedA[p] = Math.random() * 100;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var texDot = radialTex([[0, 'rgba(255,255,255,1)'], [.45, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]);
  var rc = document.createElement('canvas'); rc.width = 16; rc.height = 64; var rg = rc.getContext('2d');
  var lg = rg.createLinearGradient(0, 0, 0, 64); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(255,255,255,.9)'); rg.fillStyle = lg; rg.fillRect(7, 0, 2, 64);
  var texRain = new THREE.CanvasTexture(rc);
  var lc = document.createElement('canvas'); lc.width = lc.height = 64; var lgx = lc.getContext('2d');
  lgx.fillStyle = '#fff'; lgx.beginPath(); lgx.moveTo(32, 4); lgx.quadraticCurveTo(60, 30, 32, 60); lgx.quadraticCurveTo(4, 30, 32, 4); lgx.fill();
  var texLeaf = new THREE.CanvasTexture(lc);
  var KIND = {
    snow:   { map: texDot,  color: '#FFFFFF', size: .45, fall: 2.2,  sway: 1.2, op: .95 },
    rain:   { map: texRain, color: '#CFE8F7', size: 1.1, fall: 26,   sway: .05, op: .6 },
    motes:  { map: texDot,  color: '#FFE2A8', size: .32, fall: -.5,  sway: .9,  op: .8 },
    leaves: { map: texLeaf, color: '#FF8A3D', size: .75, fall: 2.6,  sway: 2.4, op: .95 }
  };
  var pMat = new THREE.PointsMaterial({ map: texDot, color: '#ffffff', size: .45, transparent: true, opacity: .95, depthWrite: false, sizeAttenuation: true });
  var points = new THREE.Points(pGeo, pMat); scene.add(points);
  var kind = KIND.snow, pFade = 1, pendingKind = null;

  /* ---------- Season switching ---------- */
  var lerpT = 1;
  var from = {};
  function setSeason(name) {
    var s = SEASONS[name]; if (!s || s === target) return;
    ['top', 'bot', 'fog', 'lake', 'bld', 'hemiS', 'hemiG', 'sun', 'orb'].forEach(function (k) { from[k] = cur[k].clone(); });
    ['glow', 'hemiI', 'sunI', 'orbY', 'orbS', 'wind'].forEach(function (k) { from[k] = cur[k]; });
    target = s; lerpT = 0; pendingKind = KIND[s.kind];
    spinV += 9; // the star celebrates
  }
  function applyLerp(t) {
    ['top', 'bot', 'fog', 'lake', 'bld', 'hemiS', 'hemiG', 'sun', 'orb'].forEach(function (k) { cur[k].copy(from[k]).lerp(col(target[k]), t); });
    ['glow', 'hemiI', 'sunI', 'orbY', 'orbS', 'wind'].forEach(function (k) { cur[k] = from[k] + (target[k] - from[k]) * t; });
    skyMat.uniforms.top.value.copy(cur.top); skyMat.uniforms.bot.value.copy(cur.bot);
    scene.fog.color.copy(cur.fog); lakeMat.color.copy(cur.lake);
    bldMats.forEach(function (m) { m.color.copy(cur.bld); m.emissiveIntensity = cur.glow; });
    hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity = cur.hemiI;
    sun.color.copy(cur.sun); sun.intensity = cur.sunI;
    orb.material.color.copy(cur.orb); orb.position.y = cur.orbY; orb.scale.set(cur.orbS * 2, cur.orbS * 2, 1);
  }
  new MutationObserver(function () { setSeason(root.getAttribute('data-season')); }).observe(root, { attributes: true, attributeFilter: ['data-season'] });

  /* ---------- Star interaction: drag to spin, tap for next season ---------- */
  var spinV = 0, tiltX = 0, tiltV = 0, dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, downT = 0;
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hitStar(e) {
    var b = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(star).length > 0 || ray.intersectObject(halo).length > 0;
  }
  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; lastX = downX = e.clientX; lastY = downY = e.clientY; downT = performance.now();
    canvas.classList.add('grabbing');
    try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) { canvas.style.cursor = hitStar(e) ? 'pointer' : ''; return; }
    var dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    spinV = dx * .9; tiltV = dy * .4;
  });
  function up(e) {
    if (!dragging) return; dragging = false; canvas.classList.remove('grabbing');
    var moved = Math.hypot(e.clientX - downX, e.clientY - downY), quick = performance.now() - downT < 350;
    if (moved < 6 && quick && hitStar(e)) nextSeason();
  }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  function nextSeason() {
    var order = ['winter', 'spring', 'summer', 'fall'], now = root.getAttribute('data-season') || 'winter';
    var btn = document.querySelector('[data-season-set="' + order[(order.indexOf(now) + 1) % 4] + '"]');
    if (btn) btn.click();
  }
  var mouse = { x: 0, y: 0 }, camOff = new THREE.Vector2();
  window.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') { mouse.x = e.clientX / window.innerWidth - .5; mouse.y = e.clientY / window.innerHeight - .5; } }, { passive: true });

  /* ---------- Layout ---------- */
  var mobile = false;
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    mobile = w < 900;
    camera.fov = mobile ? 58 : 42; camera.updateProjectionMatrix();
    placeStar();
  }
  function placeStar() {
    var spot = document.querySelector(mobile ? '[data-spot="m"]' : '[data-spot="d"]');
    var b = canvas.getBoundingClientRect(), x = .3, y = .2;
    if (spot) { var sb = spot.getBoundingClientRect(); x = ((sb.left - b.left) / b.width) * 2 - 1; y = -((sb.top - b.top) / b.height) * 2 + 1; }
    camera.position.copy(camBase); if (mobile) camera.position.z += 14; camera.lookAt(look); camera.updateMatrixWorld();
    var v = new THREE.Vector3(x, y, .5).unproject(camera).sub(camera.position).normalize();
    starHolder.position.copy(camera.position).add(v.multiplyScalar(mobile ? 34 : 30));
    starHolder.scale.setScalar(mobile ? 1 : 1.15);
  }
  window.addEventListener('resize', resize); resize(); setTimeout(resize, 400);

  /* ---------- Loop ---------- */
  var visible = true, clock = new THREE.Clock(), t = 0, speed = reduce ? .15 : 1;
  new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) clock.getDelta(); }, { threshold: 0 }).observe(canvas);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) clock.getDelta(); });

  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    var dt = Math.min(clock.getDelta(), .05) * speed; t += dt;

    if (lerpT < 1) { lerpT = Math.min(1, lerpT + dt / 1.4 * (reduce ? 6 : 1)); applyLerp(lerpT * lerpT * (3 - 2 * lerpT)); }
    if (pendingKind) { pFade -= dt * 3; if (pFade <= 0) { kind = pendingKind; pendingKind = null; pMat.map = kind.map; pMat.color.set(kind.color); pMat.size = kind.size; pMat.needsUpdate = true; } }
    else if (pFade < 1) pFade = Math.min(1, pFade + dt * 1.5);
    pMat.opacity = kind.op * Math.max(0, pFade);

    // star physics
    if (!dragging) { spinV *= Math.pow(.92, dt * 60); tiltV *= Math.pow(.9, dt * 60); if (!reduce) spinV += (0.5 - spinV) * .01; }
    star.rotation.y += spinV * dt * .06 * 60 / 60 * 6;
    tiltX += tiltV * dt * .1; tiltX *= Math.pow(.94, dt * 60); star.rotation.x = Math.max(-.7, Math.min(.7, tiltX));
    star.position.y = Math.sin(t * 1.3) * .35;
    halo.rotation.x = Math.PI / 2 + Math.sin(t * .7) * .3; halo.rotation.y = t * .4;
    tips.forEach(function (m, i) { m.material.color.setHSL(0, 1, (Math.sin(t * 3 + i) > .2) ? .45 : .2); });

    // lake waves
    var arr = lp.array;
    for (var v = 0; v < arr.length; v += 3) {
      var bx = lakeBase[v], bz = lakeBase[v + 2];
      arr[v + 1] = Math.sin(bx * .18 + t * 1.1) * .35 + Math.cos(bz * .3 + t * 1.6 + bx * .05) * .3 * (1 + cur.wind * .05);
    }
    lp.needsUpdate = true; lakeGeo.computeVertexNormals();

    // particles
    var pa = pGeo.attributes.position.array, wind = cur.wind;
    for (var q = 0; q < N; q++) {
      var i3 = q * 3, s = seedA[q];
      pa[i3] += (wind + Math.sin(t * kind.sway + s) * kind.sway) * dt;
      pa[i3 + 1] -= kind.fall * (0.7 + (s % 1) * .6) * dt;
      pa[i3 + 2] += Math.cos(t * .8 + s) * kind.sway * .4 * dt;
      if (pa[i3 + 1] < BY0) { pa[i3 + 1] = BY1; pa[i3] = (Math.random() - .5) * BX * 2; }
      if (pa[i3 + 1] > BY1) { pa[i3 + 1] = BY0; }
      if (pa[i3] > BX) pa[i3] -= BX * 2; else if (pa[i3] < -BX) pa[i3] += BX * 2;
    }
    pGeo.attributes.position.needsUpdate = true;

    // camera parallax
    camOff.x += (mouse.x * 6 - camOff.x) * .04; camOff.y += (mouse.y * 3 - camOff.y) * .04;
    var scrollK = Math.min(1, window.scrollY / 900);
    camera.position.set(camBase.x + camOff.x, camBase.y - camOff.y + scrollK * 6, camBase.z - scrollK * 8);
    if (mobile) camera.position.z += 14;
    camera.lookAt(look.x + camOff.x * .3, look.y, look.z);

    renderer.render(scene, camera);
  }
  ['top', 'bot', 'fog', 'lake', 'bld', 'hemiS', 'hemiG', 'sun', 'orb'].forEach(function (k) { from[k] = cur[k].clone(); });
  ['glow', 'hemiI', 'sunI', 'orbY', 'orbS', 'wind'].forEach(function (k) { from[k] = cur[k]; });
  target = SEASONS[root.getAttribute('data-season')] || SEASONS.winter; lerpT = 1; applyLerp(1); spinV = 0; kind = KIND[target.kind]; pendingKind = null;
  pMat.map = kind.map; pMat.color.set(kind.color); pMat.size = kind.size;
  frame();
})();
