/* ChiActive design gallery
   - Upload a design as a .zip (unzipped automatically) or a folder, with your student name.
   - With an upload server configured (site-config.js), uploads are saved to the GitHub repo
     as "Website design - <student name>" so everyone sees them.
   - Without one, uploads are saved in this browser only (IndexedDB + sw.js).
   - Lists every shared design from the repo's designs/ folder. */
(function () {
  var CFG = window.CHIACTIVE || {};
  var API = (CFG.uploadApi || '').replace(/\/+$/, '');
  var REPO = CFG.repo || '', BRANCH = CFG.branch || 'main';
  var PAGES = (CFG.pages || '').replace(/\/?$/, '/');
  var DB_NAME = 'chiactive-designs', DB_VERSION = 1;
  var JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini|\.git|node_modules)(\/|$)/i;
  var MAX_BYTES = 60 * 1024 * 1024;
  var card = document.getElementById('upload-card');
  var inner = document.getElementById('up-inner');
  var grid = document.getElementById('community');
  var list = document.getElementById('design-list');  // where design cards go (under the upload box)
  var zipInput = document.getElementById('zip-input');
  var folderInput = document.getElementById('folder-input');
  var countChip = document.getElementById('community-count');
  if (!card || !grid) return;
  var canLocal = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && 'indexedDB' in window;
  var onPages = PAGES && location.href.indexOf(PAGES) === 0;
  var swReady = null, pending = null, server = { state: API ? 'checking' : 'off' };

  var UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtBytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function designName(student) { return 'Website design - ' + student; }
  function cleanStudent(s) { return String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60); }
  function prettyFolder(f) {
    var m = f.match(/^website-design-(.+?)(?:-(\d+))?$/);
    if (m) return designName(m[1].replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); })) + (m[2] ? ' (' + m[2] + ')' : '');
    return f.replace(/[-_]+/g, ' ');
  }
  function encPath(p) { return p.split('/').map(encodeURIComponent).join('/'); }
  function viewUrl(d, kind) {
    var q = kind === 'local' ? 'local=' + encodeURIComponent(d.id) : 'd=' + encodeURIComponent(d.folder);
    return 'view.html?' + q + '&e=' + encodeURIComponent(d.entry || 'index.html') + (d.by ? '&by=' + encodeURIComponent(d.by) : '');
  }

  /* ---------- this-browser storage (fallback) ---------- */
  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () { var db = req.result; if (!db.objectStoreNames.contains('designs')) db.createObjectStore('designs', { keyPath: 'id' }); if (!db.objectStoreNames.contains('files')) db.createObjectStore('files'); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function listLocal() {
    if (!canLocal) return Promise.resolve([]);
    return (swReady || Promise.resolve()).then(openDb).then(function (db) {
      return new Promise(function (resolve) { var r = db.transaction('designs').objectStore('designs').getAll(); r.onsuccess = function () { resolve(r.result || []); }; r.onerror = function () { resolve([]); }; });
    }).catch(function () { return []; });
  }
  function saveLocal(meta, files) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(['designs', 'files'], 'readwrite'), fs = tx.objectStore('files');
        files.forEach(function (f) { fs.put(f.blob, meta.id + '/' + f.path); });
        tx.objectStore('designs').put(meta);
        tx.oncomplete = resolve; tx.onerror = function () { reject(tx.error); }; tx.onabort = function () { reject(tx.error || new Error('Saving was cancelled.')); };
      });
    });
  }
  function removeLocal(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(['designs', 'files'], 'readwrite');
        tx.objectStore('designs').delete(id);
        tx.objectStore('files').delete(IDBKeyRange.bound(id + '/', id + '/￿'));
        tx.oncomplete = resolve; tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  /* ---------- reading uploads (zips are unzipped right here) ---------- */
  function readZip(file) {
    if (!window.JSZip) return Promise.reject(new Error('The zip reader didn’t load. Refresh the page and try again.'));
    return JSZip.loadAsync(file).then(function (zip) {
      var entries = []; zip.forEach(function (p, e) { if (!e.dir) entries.push(e); });
      var out = [], n = 0;
      return entries.reduce(function (p, e) {
        return p.then(function () { return e.async('blob').then(function (b) { out.push({ path: e.name, blob: b }); n++; if (n % 15 === 0) status('Unzipping: ' + n + ' of ' + entries.length + ' files', n / entries.length); }); });
      }, Promise.resolve()).then(function () { return out; });
    }).catch(function (e) { throw new Error(e && /zip|central|signature/i.test(e.message) ? 'That .zip couldn’t be opened. Try zipping the folder again.' : (e.message || 'That .zip couldn’t be read.')); });
  }
  function readEntry(entry, prefix) {
    return new Promise(function (resolve) {
      if (entry.isFile) entry.file(function (f) { resolve([{ path: prefix + f.name, blob: f }]); }, function () { resolve([]); });
      else if (entry.isDirectory) {
        var reader = entry.createReader(), all = [];
        (function next() { reader.readEntries(function (batch) { if (!batch.length) Promise.all(all.map(function (e) { return readEntry(e, prefix + entry.name + '/'); })).then(function (l) { resolve([].concat.apply([], l)); }); else { all = all.concat([].slice.call(batch)); next(); } }, function () { resolve([]); }); })();
      } else resolve([]);
    });
  }
  function analyse(files) {
    files = files.filter(function (f) { return f.path && !JUNK.test(f.path) && !/(^|\/)\._/.test(f.path); })
      .map(function (f) { return { path: f.path.replace(/\\/g, '/').replace(/^\/+/, ''), blob: f.blob }; });
    if (!files.length) throw new Error('That upload was empty.');
    var tops = {}; files.forEach(function (f) { tops[f.path.split('/')[0]] = 1; });
    var t = Object.keys(tops);
    if (t.length === 1 && files.every(function (f) { return f.path.indexOf('/') > -1; })) files = files.map(function (f) { return { path: f.path.slice(t[0].length + 1), blob: f.blob }; });
    var html = files.filter(function (f) { return /\.html?$/i.test(f.path); });
    if (!html.length) throw new Error('No web page found. A design needs at least one .html file, ideally index.html.');
    var depth = function (p) { return p.split('/').length; };
    var idx = html.filter(function (f) { return /(^|\/)index\.html?$/i.test(f.path); }).sort(function (a, b) { return depth(a.path) - depth(b.path); });
    var entry = (idx[0] || html.sort(function (a, b) { return depth(a.path) - depth(b.path) || a.path.localeCompare(b.path); })[0]).path;
    var size = files.reduce(function (s, f) { return s + (f.blob.size || 0); }, 0);
    if (size > MAX_BYTES) throw new Error('That design is ' + fmtBytes(size) + '. Keep it under 60 MB (big videos are usually the reason).');
    return { files: files, entry: entry, size: size };
  }

  /* ---------- upload card ---------- */
  function where() {
    if (server.state === 'ready') return 'It goes into the class gallery, so <b>everyone</b> can see it.';
    if (server.state === 'checking') return 'Connecting to the upload server&hellip; (it can take up to a minute to wake up)';
    if (server.state === 'down') return 'The upload server isn&rsquo;t answering right now, so uploads are saved <b>in this browser only</b>.';
    return 'Uploads are saved <b>in this browser only</b>.';
  }
  function idle(message) {
    pending = null;
    if (server.state !== 'ready' && !canLocal) {
      inner.innerHTML = '<span class="up-icon">' + UPLOAD_ICON + '</span><h3>Upload your design</h3>' +
        '<p>' + (server.state === 'checking' ? 'Connecting to the upload server&hellip;' : 'Uploads need the local preview server or the online site.') + '</p>' +
        '<p class="up-note">Run <code>start-server-mac.command</code> and open <code>http://localhost:8000</code>' + (PAGES ? ', or use <a href="' + PAGES + 'upload.html">the online gallery</a>' : '') + '.</p>';
      return;
    }
    inner.innerHTML = '<span class="up-icon">' + UPLOAD_ICON + '</span><h3>Upload your design</h3>' +
      '<p>Drop a <b>.zip</b> or a <b>folder</b> here. Zips are unzipped automatically. It needs an <code>index.html</code> (or any .html page).</p>' +
      '<div class="up-actions"><button class="btn" type="button" data-pick="zip">Choose .zip</button><button class="btn btn-ghost" type="button" data-pick="folder">Choose folder</button></div>' +
      (message ? '<p class="' + (message.error ? 'up-error' : 'up-ok') + '" role="status">' + message.html + '</p>' : '') +
      '<p class="up-note">' + where() + '</p>';
  }
  function status(text, fraction) {
    inner.innerHTML = '<span class="up-icon">' + UPLOAD_ICON + '</span><h3>Working on it</h3><p role="status">' + esc(text) + '</p><div class="up-progress"><span style="width:' + Math.round((fraction || 0) * 100) + '%"></span></div>';
  }
  function confirmForm(info) {
    pending = info;
    var remember = ''; try { remember = localStorage.getItem('chiactive-student') || ''; } catch (e) {}
    inner.innerHTML = '<h3>Almost there</h3><div class="up-form">' +
      '<div class="up-found">Found <b>' + info.files.length + ' files</b> (' + fmtBytes(info.size) + '). Starts at <b>' + esc(info.entry) + '</b>.</div>' +
      '<label><span>Student name <span class="req">required</span></span><input id="up-student" type="text" maxlength="60" placeholder="Student name" autocomplete="name" value="' + esc(remember) + '" required></label>' +
      '<p class="up-preview-name">Saved as: <b id="up-final">' + esc(designName(remember || 'Student name')) + '</b></p>' +
      '<p class="up-error" id="up-err" role="alert" hidden></p>' +
      '<div class="up-actions" style="justify-content:flex-start"><button class="btn" type="button" data-save>' + (server.state === 'ready' ? 'Upload to the gallery' : 'Save in this browser') + '</button><button class="btn btn-ghost" type="button" data-cancel>Cancel</button></div>' +
      '<p class="up-note">' + where() + '</p></div>';
    var inp = document.getElementById('up-student');
    inp.addEventListener('input', function () { document.getElementById('up-err').hidden = true; document.getElementById('up-final').textContent = designName(cleanStudent(inp.value) || 'Student name'); });
    inp.focus();
  }
  function handle(p) {
    status('Reading the files…', 0.05);
    p.then(function (files) { confirmForm(analyse(files)); })
     .catch(function (err) { idle({ error: true, html: esc(err && err.message ? err.message : 'That upload couldn’t be read.') }); });
  }
  function handleZips(list) {
    var zips = [].slice.call(list).filter(function (f) { return /\.zip$/i.test(f.name) || /zip/.test(f.type); });
    if (!zips.length) return idle({ error: true, html: 'That wasn’t a .zip file. Choose a .zip, or use Choose folder.' });
    handle(readZip(zips[0]));
  }
  function handleDrop(dt) {
    var entries = (dt.items ? [].slice.call(dt.items) : []).map(function (it) { return it.webkitGetAsEntry && it.webkitGetAsEntry(); }).filter(Boolean);
    if (entries.length === 1 && entries[0].isFile && /\.zip$/i.test(entries[0].name)) return handleZips(dt.files);
    if (entries.length) return handle(Promise.all(entries.map(function (e) { return readEntry(e, ''); })).then(function (l) { return [].concat.apply([], l); }));
    if (dt.files && dt.files.length) handleZips(dt.files);
  }

  function save() {
    if (!pending) return;
    var student = cleanStudent(document.getElementById('up-student').value);
    var err = document.getElementById('up-err');
    if (student.length < 2) { err.hidden = false; err.textContent = 'Enter your student name. It becomes the design name.'; document.getElementById('up-student').focus(); return; }
    try { localStorage.setItem('chiactive-student', student); } catch (e) {}
    var info = pending;
    if (server.state === 'ready') return uploadRemote(student, info);
    var meta = { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: designName(student), by: student, entry: info.entry, size: info.size, count: info.files.length, createdAt: Date.now() };
    status('Saving ' + info.files.length + ' files…', 0.3);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    saveLocal(meta, info.files).then(function () { idle({ html: '“' + esc(meta.name) + '” was saved in this browser.' }); render(meta.id); })
      .catch(function (e) { idle({ error: true, html: 'Couldn’t save it: ' + esc(e && e.message ? e.message : 'the browser ran out of storage.') }); });
  }
  function uploadRemote(student, info) {
    var fd = new FormData();
    fd.append('student', student);
    fd.append('paths', JSON.stringify(info.files.map(function (f) { return f.path; })));
    info.files.forEach(function (f) { fd.append('files', f.blob, f.path.split('/').pop()); });
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/api/upload');
    xhr.upload.onprogress = function (e) { if (e.lengthComputable) status('Uploading ' + fmtBytes(e.loaded) + ' of ' + fmtBytes(e.total), 0.05 + 0.8 * e.loaded / e.total); };
    xhr.upload.onload = function () { status('Saving it to the class gallery…', 0.9); };
    xhr.onload = function () {
      var res = null; try { res = JSON.parse(xhr.responseText); } catch (e) {}
      if (xhr.status === 200 && res && res.ok) {
        var link = viewUrl({ folder: res.folder, entry: res.entry, by: student }, 'shared');
        try { var p = JSON.parse(sessionStorage.getItem('chiactive-publishing') || '[]'); p.push({ folder: res.folder, name: res.name, by: student, entry: res.entry, uploadedAt: new Date().toISOString() }); sessionStorage.setItem('chiactive-publishing', JSON.stringify(p)); } catch (e) {}
        idle({ html: '“' + esc(res.name) + '” was uploaded' + (res.skipped && res.skipped.length ? ' (skipped ' + res.skipped.length + ' unsupported file' + (res.skipped.length === 1 ? '' : 's') + ')' : '') + '. It&rsquo;s live for everyone right now: <a href="' + esc(link) + '">open it</a>.' });
        render(res.folder);
      } else {
        idle({ error: true, html: esc(res && res.error ? res.error : 'The upload didn’t go through (error ' + xhr.status + '). Try again.') });
      }
    };
    xhr.onerror = function () { idle({ error: true, html: 'Couldn’t reach the upload server. Check your internet connection and try again.' }); };
    xhr.send(fd);
  }

  /* ---------- finding shared designs ---------- */
  function b64utf8(b64) { var bin = atob(String(b64).replace(/\s/g, '')); var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
  function sharedDesigns() {
    var found = {};
    function add(list) {
      (list || []).forEach(function (d) {
        if (!d || !d.folder) return;
        var cur = found[d.folder] || { folder: d.folder };
        found[d.folder] = { folder: d.folder, name: d.name || cur.name || prettyFolder(d.folder), by: d.by || cur.by || '', entry: d.entry || cur.entry || 'index.html', uploadedAt: d.uploadedAt || cur.uploadedAt || '' };
      });
    }
    var jobs = [];
    if (REPO) {
      var api = 'https://api.github.com/repos/' + REPO + '/contents/designs';
      jobs.push(fetch(api + '?ref=' + BRANCH).then(function (r) { return r.ok ? r.json() : []; }).then(function (items) { add((items || []).filter(function (i) { return i.type === 'dir'; }).map(function (i) { return { folder: i.name }; })); }).catch(function () {}));
      jobs.push(fetch(api + '/manifest.json?ref=' + BRANCH).then(function (r) { return r.ok ? r.json() : null; }).then(function (f) { if (f && f.content) add(JSON.parse(b64utf8(f.content))); }).catch(function () {}));
    }
    if (API) {  // freshest list, straight from the upload server (skipped if it's asleep)
      var ctl2 = 'AbortController' in window ? new AbortController() : null; setTimeout(function () { if (ctl2) ctl2.abort(); }, 4000);
      jobs.push(fetch(API + '/api/designs', { cache: 'no-store', signal: ctl2 ? ctl2.signal : undefined }).then(function (r) { return r.json(); }).then(function (j) { if (j && j.designs) add(j.designs); }).catch(function () {}));
    }
    jobs.push(fetch('designs/manifest.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).then(add).catch(function () {}));
    if (!onPages) jobs.push(fetch('designs/', { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var re = /href="([^"?#\/]+)\/"/g, m, names = []; while ((m = re.exec(t))) names.push(decodeURIComponent(m[1])); add(names.map(function (n) { return { folder: n }; }));
    }).catch(function () {}));
    try { add(JSON.parse(sessionStorage.getItem('chiactive-publishing') || '[]')); } catch (e) {}
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
  function when(d) { var t = d.uploadedAt || d.createdAt; return t ? new Date(t).toLocaleDateString() : ''; }
  function cardHtml(d, kind) {
    var open = kind === 'local' ? 'uploaded/' + d.id + '/' + encPath(d.entry) : d.url;
    var view = viewUrl(d, kind);  // opens inside the demo bar
    var tag = kind === 'local' ? '<span class="tag up">This browser</span>' : (d.publishing ? '<span class="tag pub">Publishing</span>' : d.fresh ? '<span class="tag up">Just added</span>' : '<span class="tag shared">Class gallery</span>');
    var meta = [d.by ? 'By ' + esc(d.by) : '', when(d) ? 'Added ' + when(d) : '', kind === 'local' ? d.count + ' files, saved in this browser only' : ''].filter(Boolean).join(' &middot; ');
    var stage = d.publishing
      ? '<div class="frame frame-wait"><div><b>Publishing&hellip;</b><span>New uploads go live in about a minute.</span><button class="btn btn-ghost" type="button" data-refresh>Check again</button></div></div>'
      : '<div class="frame"><iframe src="' + esc(open) + '" title="Preview of ' + esc(d.name) + '" loading="lazy" tabindex="-1" sandbox="allow-same-origin"></iframe></div>';
    return '<article class="option community-card" data-kind="' + kind + '" data-id="' + esc(d.id || d.folder) + '">' +
      (d.publishing ? '' : '<a class="cover" href="' + esc(view) + '" aria-label="Open ' + esc(d.name) + '"></a>') +
      '<div class="stage"><div class="browser"><div class="bar"><i></i><i></i><i></i><span>' + esc(kind === 'local' ? 'this browser / ' + d.name : 'designs / ' + d.folder) + '</span></div>' + stage + '</div></div>' +
      '<div class="body"><div class="name-row"><h2 class="name">' + esc(d.name) + '</h2>' + tag + '</div>' +
      (meta ? '<p class="meta-line">' + meta + '</p>' : '') +
      '<div class="card-actions">' + (d.publishing ? '' : '<a class="btn" href="' + esc(view) + '">Open design <span>&rarr;</span></a>') +
      (kind === 'local' ? '<button class="btn-remove" type="button" data-remove="' + esc(d.id) + '">Remove</button>' : '') + '</div></div></article>';
  }
  function scaleFrames() { (list || grid).querySelectorAll('.frame').forEach(function (fr) { fr.style.setProperty('--s', (fr.clientWidth / 1200).toFixed(4)); }); }
  var ro = 'ResizeObserver' in window ? new ResizeObserver(scaleFrames) : null;
  function render(highlight) {
    return Promise.all([sharedDesigns(), listLocal()]).then(function (res) {
      document.querySelectorAll('.community-card').forEach(function (c) { c.remove(); });
      var local = res[1].sort(function (a, b) { return b.createdAt - a.createdAt; });
      var cardsHtml = res[0].map(function (d) { return cardHtml(d, 'shared'); }).join('') + local.map(function (d) { return cardHtml(d, 'local'); }).join('');
      if (list) list.insertAdjacentHTML('afterbegin', cardsHtml);  // newest uploads right under the upload box
      else card.insertAdjacentHTML('afterend', cardsHtml);
      var n = res[0].length + local.length;
      if (countChip) countChip.textContent = n ? n + ' design' + (n === 1 ? '' : 's') + ' uploaded' : 'No uploads yet. Be the first!';
      (list || grid).querySelectorAll('.frame').forEach(function (fr) { if (ro) ro.observe(fr); }); scaleFrames();
      if (highlight) { var el = (list || grid).querySelector('[data-id="' + highlight + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  }

  /* ---------- events ---------- */
  card.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('data-pick') === 'zip') zipInput.click();
    if (b.getAttribute('data-pick') === 'folder') folderInput.click();
    if (b.hasAttribute('data-save')) save();
    if (b.hasAttribute('data-cancel')) idle();
  });
  card.addEventListener('keydown', function (e) { if (e.key === 'Enter' && pending && e.target.tagName === 'INPUT') { e.preventDefault(); save(); } });
  zipInput.addEventListener('change', function () { if (zipInput.files.length) handleZips(zipInput.files); zipInput.value = ''; });
  folderInput.addEventListener('change', function () { if (folderInput.files.length) handle(Promise.resolve([].slice.call(folderInput.files).map(function (f) { return { path: f.webkitRelativePath || f.name, blob: f }; }))); folderInput.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { card.addEventListener(ev, function (e) { e.preventDefault(); card.classList.add('drag'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { card.addEventListener(ev, function (e) { if (ev === 'dragleave' && card.contains(e.relatedTarget)) return; card.classList.remove('drag'); }); });
  card.addEventListener('drop', function (e) { e.preventDefault(); handleDrop(e.dataTransfer); });
  (list || grid).addEventListener('click', function (e) {
    if (e.target.closest('[data-refresh]')) { e.preventDefault(); render(); return; }
    var b = e.target.closest('[data-remove]'); if (!b) return;
    e.preventDefault();
    if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = 'Click again to remove'; setTimeout(function () { if (b.isConnected) { b.classList.remove('confirm'); b.textContent = 'Remove'; } }, 4000); return; }
    removeLocal(b.getAttribute('data-remove')).then(function () { render(); });
  });

  if (canLocal) swReady = navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }).catch(function () { canLocal = false; });
  if (API) {
    var ctl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 70000);  // free servers can take ~50s to wake up
    fetch(API + '/api/health', { signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.json(); })
      .then(function (h) { server.state = h && h.ok && h.ready ? 'ready' : 'down'; })
      .catch(function () { server.state = 'down'; })
      .then(function () { clearTimeout(timer); if (!pending) idle(); });
  }
  idle();
  render();
})();
