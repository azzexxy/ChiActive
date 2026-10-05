/* ChiActive design gallery: lists every design in the class gallery (newest first).
   Uploading and editing happen in ChiActive Studio on the upload server, where students
   sign up and log in (site-config.js has its address). */
(function () {
  var CFG = window.CHIACTIVE || {};
  var API = (CFG.uploadApi || '').replace(/\/+$/, '');
  var REPO = CFG.repo || '', BRANCH = CFG.branch || 'main';
  var PAGES = (CFG.pages || '').replace(/\/?$/, '/');
  var card = document.getElementById('upload-card');
  var inner = document.getElementById('up-inner');
  var grid = document.getElementById('community');
  var list = document.getElementById('design-list');
  var countChip = document.getElementById('community-count');
  if (!list) return;
  var onPages = PAGES && location.href.indexOf(PAGES) === 0;
  var STUDIO = API ? API + '/studio' : '';
  // admin tools: turned on for this tab when you come here from the admin page or Studio as admin (?admin=1).
  // They only add bins that open the admin page, where deleting still needs the admin password.
  var ADMIN_TOOLS = false;
  try {
    var qs = location.search;
    if (/[?&]admin=1\b/.test(qs)) sessionStorage.setItem('ca-admin-tools', '1');
    if (/[?&]admin=0\b/.test(qs)) sessionStorage.removeItem('ca-admin-tools');
    if (/[?&]admin=[01]\b/.test(qs)) history.replaceState(null, '', location.pathname + location.hash);
    ADMIN_TOOLS = !!API && sessionStorage.getItem('ca-admin-tools') === '1';
  } catch (e) {}
  if (ADMIN_TOOLS) document.documentElement.classList.add('admin-tools');
  var BIN = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function designName(student) { return 'Website design - ' + student; }
  function prettyFolder(f) {
    var m = f.match(/^website-design-(.+?)(?:-(\d+))?$/);
    if (m) return designName(m[1].replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); })) + (m[2] ? ' (' + m[2] + ')' : '');
    return f.replace(/[-_]+/g, ' ');
  }
  function encPath(p) { return p.split('/').map(encodeURIComponent).join('/'); }
  function viewUrl(d) { return 'view.html?d=' + encodeURIComponent(d.folder) + '&e=' + encodeURIComponent(d.entry || 'index.html') + (d.by ? '&by=' + encodeURIComponent(d.by) : ''); }
  function b64utf8(b64) { var bin = atob(String(b64).replace(/\s/g, '')); var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }

  /* ---------- upload box: sends students to ChiActive Studio ---------- */
  var UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>';
  if (inner) inner.innerHTML = '<span class="up-icon">' + UPLOAD_ICON + '</span><h3>Upload or edit your design</h3>' +
    (STUDIO ? '<p>Create a free account in <b>ChiActive Studio</b>, upload your site as a <b>.zip</b> or a <b>folder</b>, then change any title, text or button right on the page.</p>' +
      '<div class="up-actions"><a class="btn" href="' + esc(STUDIO) + '">Sign up or log in <span>&rarr;</span></a></div>' +
      '<p class="up-note">Your design appears here as “Website design - your name”. Only you can edit it.</p>'
      : '<p>Uploads aren’t set up for this copy of the gallery.</p>');

  function sharedDesigns() {
    var found = {};
    function add(list, over) {
      (list || []).forEach(function (d) {
        if (!d || !d.folder) return;
        var cur = found[d.folder];
        if (cur && !over) return;
        found[d.folder] = { folder: d.folder, name: d.name || (cur && cur.name) || prettyFolder(d.folder), by: d.by || (cur && cur.by) || '', entry: d.entry || (cur && cur.entry) || 'index.html', uploadedAt: d.uploadedAt || (cur && cur.uploadedAt) || '', editedAt: d.editedAt || (cur && cur.editedAt) || '' , winner: !!(d.winner || (!over && cur && cur.winner)) };
      });
    }
    function fallback() {   // upload server asleep: read the list from GitHub and the published site
      var jobs = [];
      if (REPO) {
        var api = 'https://api.github.com/repos/' + REPO + '/contents/designs';
        jobs.push(fetch(api + '/manifest.json?ref=' + BRANCH).then(function (r) { return r.ok ? r.json() : null; }).then(function (f) { if (f && f.content) add(JSON.parse(b64utf8(f.content)), true); }).catch(function () {}));
      }
      jobs.push(fetch('designs/manifest.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (l) { add(l); }).catch(function () {}));
      if (!onPages) jobs.push(fetch('designs/', { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
        var re = /href="([^"?#\/]+)\/"/g, m, names = []; while ((m = re.exec(t))) names.push(decodeURIComponent(m[1])); add(names.map(function (n) { return { folder: n }; }));
      }).catch(function () {}));
      try { add(JSON.parse(sessionStorage.getItem('chiactive-publishing') || '[]')); } catch (e) {}
      return Promise.all(jobs);
    }
    var first = API ? new Promise(function (resolve) {
      var ctl2 = 'AbortController' in window ? new AbortController() : null; setTimeout(function () { if (ctl2) ctl2.abort(); }, 4000);
      fetch(API + '/api/designs', { cache: 'no-store', signal: ctl2 ? ctl2.signal : undefined }).then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok && j.designs) { add(j.designs, true); resolve(true); } else resolve(false); }).catch(function () { resolve(false); });
    }) : Promise.resolve(false);
    var jobs = [first.then(function (ok) { if (!ok) return fallback(); })];
    return Promise.all(jobs).then(function () {
      var list = Object.keys(found).map(function (k) { return found[k]; });
      return Promise.all(list.map(function (d) {
        var rel = 'designs/' + encPath(d.folder) + '/' + encPath(d.entry);
        var tries = onPages ? [rel] : [rel].concat(PAGES ? [PAGES + rel] : []);
        return tries.reduce(function (p, u) {
          return p.then(function (ok) { return ok || fetch(u, { method: 'HEAD', cache: 'no-store' }).then(function (r) { return r.ok ? u : null; }).catch(function () { return null; }); });
        }, Promise.resolve(null)).then(function (u) {
          d.url = u; d.fresh = false;
          if (!u && API) { d.url = API + '/d/' + encPath(d.folder) + '/' + encPath(d.entry); d.fresh = true; }  // served instantly by the upload server while GitHub Pages rebuilds
          d.publishing = !d.url; return d;
        });
      }));
    }).then(function (list) {
      try { var p = JSON.parse(sessionStorage.getItem('chiactive-publishing') || '[]').filter(function (x) { return !list.some(function (d) { return d.folder === x.folder && d.url && !d.fresh; }); }); sessionStorage.setItem('chiactive-publishing', JSON.stringify(p)); } catch (e) {}
      return list.sort(function (a, b) { return String(b.uploadedAt).localeCompare(String(a.uploadedAt)) || a.name.localeCompare(b.name); });
    });
  }

  /* ---------- cards ---------- */
  function when(d) { var t = d.uploadedAt; return t ? new Date(t).toLocaleDateString() : ''; }
  function bust(u, d) { var v = d.editedAt || d.uploadedAt; return v && u && u.indexOf('/d/') < 0 ? u + (u.indexOf('?') > -1 ? '&' : '?') + 'v=' + encodeURIComponent(v) : u; }
  function cardHtml(d) {
    var view = viewUrl(d);  // opens inside the demo bar
    var tag = d.winner ? '<span class="tag win">🏆 Winner</span>' : d.publishing ? '<span class="tag pub">Publishing</span>' : d.fresh ? '<span class="tag up">Just added</span>' : '<span class="tag shared">Class gallery</span>';
    var meta = [d.by ? 'By ' + esc(d.by) : '', when(d) ? 'Added ' + when(d) : '', d.editedAt ? 'Edited ' + new Date(d.editedAt).toLocaleDateString() : ''].filter(Boolean).join(' &middot; ');
    var stage = d.publishing
      ? '<div class="frame frame-wait"><div><b>Publishing&hellip;</b><span>New uploads go live in about a minute.</span><button class="btn btn-ghost" type="button" data-refresh>Check again</button></div></div>'
      : '<div class="frame"><iframe src="' + esc(bust(d.url, d)) + '" title="Preview of ' + esc(d.name) + '" loading="lazy" tabindex="-1" sandbox="allow-same-origin"></iframe></div>';
    return '<article class="option community-card' + (d.winner ? ' is-winner' : '') + '" data-id="' + esc(d.folder) + '">' +
      (ADMIN_TOOLS ? '<a class="card-del" href="' + esc(API + '/admin?delete=' + encodeURIComponent(d.folder)) + '" title="Delete this design (admin)" aria-label="Delete ' + esc(d.name) + ' (admin)">' + BIN + '</a>' : '') +
      (d.publishing ? '' : '<a class="cover" href="' + esc(view) + '" aria-label="Open ' + esc(d.name) + '"></a>') +
      '<div class="stage"><div class="browser"><div class="bar"><i></i><i></i><i></i><span>' + esc('designs / ' + d.folder) + '</span></div>' + stage + '</div></div>' +
      '<div class="body"><div class="name-row"><h2 class="name">' + esc(d.name) + '</h2>' + tag + '</div>' +
      (meta ? '<p class="meta-line">' + meta + '</p>' : '') +
      '<div class="card-actions">' + (d.publishing ? '' : '<a class="btn" href="' + esc(view) + '">Open design <span>&rarr;</span></a>' +
        (API ? '<a class="btn btn-ghost btn-dl" href="' + esc(API + '/api/download?folder=' + encodeURIComponent(d.folder)) + '" download title="Download every file of this design as a .zip" aria-label="Download ' + esc(d.name) + ' as a .zip">&#11015; Download .zip</a>' : '')) + '</div></div></article>';
  }
  function scaleFrames() { list.querySelectorAll('.frame').forEach(function (fr) { fr.style.setProperty('--s', (fr.clientWidth / 1200).toFixed(4)); }); }
  var ro = 'ResizeObserver' in window ? new ResizeObserver(scaleFrames) : null;
  function render() {
    return sharedDesigns().then(function (designs) {
      list.querySelectorAll('.community-card').forEach(function (c) { c.remove(); });
      list.insertAdjacentHTML('afterbegin', designs.map(cardHtml).join(''));
      if (countChip) countChip.textContent = designs.length ? designs.length + ' design' + (designs.length === 1 ? '' : 's') : 'No designs yet. Be the first!';
      list.querySelectorAll('.frame').forEach(function (fr) { if (ro) ro.observe(fr); }); scaleFrames();
    });
  }
  list.addEventListener('click', function (e) { if (e.target.closest('[data-refresh]')) { e.preventDefault(); render(); } });
  render();
})();
