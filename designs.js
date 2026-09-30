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
  var MAX_BYTES = 1024 * 1024 * 1024;     // GitHub Pages publishes sites up to 1 GB
  var MAX_FILE = 100 * 1024 * 1024;       // GitHub refuses single files over 100 MB
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
  var swReady = null, pending = null, healthP = null, server = { state: API ? 'checking' : 'off' };

  var UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtBytes(n) { return n >= 1073741824 ? (n / 1073741824).toFixed(2) + ' GB' : n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function report(stage, message, extra) { if (window.chiTrack) window.chiTrack('client-error', Object.assign({ stage: stage, message: String(message).slice(0, 380) }, extra || {})); }
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
    var big = files.filter(function (f) { return (f.blob.size || 0) > MAX_FILE; });
    if (big.length) throw new Error(big.slice(0, 3).map(function (f) { return '“' + f.path + '” is ' + fmtBytes(f.blob.size); }).join(', ') + (big.length > 3 ? ' and ' + (big.length - 3) + ' more' : '') + '. GitHub doesn’t accept single files over 100 MB, so ' + (big.length === 1 ? 'that file' : 'those files') + ' can’t be published. Compress ' + (big.length === 1 ? 'it' : 'them') + ' (videos shrink a lot with HandBrake) or leave ' + (big.length === 1 ? 'it' : 'them') + ' out, then upload again.');
    if (size > MAX_BYTES) throw new Error('That design is ' + fmtBytes(size) + '. GitHub Pages can only publish sites up to 1 GB, so the gallery takes designs up to 1 GB. Compress large videos and images, then try again.');
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
     .catch(function (err) { var m = err && err.message ? err.message : 'That upload couldn’t be read.'; idle({ error: true, html: esc(m) }); report('read', m); });
  }
  function handleZips(list) {
    var zips = [].slice.call(list).filter(function (f) { return /\.zip$/i.test(f.name) || /zip/.test(f.type); });
    if (!zips.length) { report('read', 'Picked a file that isn’t a .zip: ' + (list[0] && list[0].name)); return idle({ error: true, html: 'That wasn’t a .zip file. Choose a .zip, or use Choose folder.' }); }
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
    if (server.state === 'checking' && healthP) {
      pending = null;
      status('Waking up the upload server… this can take up to a minute the first time.', 0.02);
      return healthP.then(function () { pending = info; if (server.state === 'ready') return uploadRemote(student, info); saveInBrowser(student, info); });
    }
    if (server.state === 'ready') return uploadRemote(student, info);
    saveInBrowser(student, info);
  }
  function saveInBrowser(student, info) {
    var meta = { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: designName(student), by: student, entry: info.entry, size: info.size, count: info.files.length, createdAt: Date.now() };
    status('Saving ' + info.files.length + ' files…', 0.3);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    report('server-down', 'The upload server wasn’t reachable, so the design was saved in this browser only.', { student: student, files: info.files.length, size: info.size });
    saveLocal(meta, info.files).then(function () { idle({ html: '“' + esc(meta.name) + '” was saved <b>in this browser only</b>, because the upload server didn’t answer. Try again later to share it with the class.' }); render(meta.id); })
      .catch(function (e) { idle({ error: true, html: 'Couldn’t save it: ' + esc(e && e.message ? e.message : 'the browser ran out of storage.') }); });
  }
  /* ---------- uploading to the class gallery (in 8 MB pieces, each retried on its own) ---------- */
  function httpError(status, res, what) {
    if (res && res.error) return res.error;
    if (status === 0) return navigator.onLine === false ? 'You went offline while ' + what + '. Reconnect to the internet and try again.' : 'Lost the connection to the upload server while ' + what + '. Check your Wi-Fi; if it keeps happening, the server may be restarting, so wait a minute and try again.';
    if (status === 413) return 'The upload server refused a piece of the upload because it was too big. Refresh the page (Cmd+Shift+R or Ctrl+F5) and try again.';
    if (status === 429) return 'Too many uploads from your network right now. Try again later.';
    if (status === 502 || status === 503 || status === 504) return 'The upload server is restarting or overloaded (error ' + status + ') while ' + what + '. Wait a minute and try again.';
    return 'The upload server answered with error ' + status + ' while ' + what + '. Try again.';
  }
  function request(method, url, body, onProgress) {
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url);
      if (body != null) xhr.setRequestHeader('Content-Type', 'text/plain');   // a "simple" request: no extra preflight per piece
      if (onProgress && xhr.upload) xhr.upload.onprogress = function (e) { onProgress(e.loaded); };
      xhr.timeout = 5 * 60 * 1000;
      xhr.onload = function () { var j = null; try { j = JSON.parse(xhr.responseText); } catch (e) {} resolve({ status: xhr.status, json: j }); };
      xhr.onerror = function () { resolve({ status: 0, json: null }); };
      xhr.ontimeout = function () { resolve({ status: 0, json: null, timeout: true }); };
      xhr.send(body == null ? null : body);
    });
  }
  function failUpload(msg, ref, stage, info, student, serverLogged) {
    idle({ error: true, html: esc(msg) + (ref ? '<br><span class="up-ref">Error code: ' + esc(ref) + '</span>' : '') });
    if (!serverLogged) report(stage, msg, { ref: ref, student: student, files: info && info.files.length, size: info && info.size });
  }
  function uploadRemote(student, info) {
    var visitor = window.chiVisitor ? window.chiVisitor() : '';
    status('Checking your design with the upload server…', 0.02);
    request('POST', API + '/api/upload/start', JSON.stringify({ student: student, visitor: visitor, files: info.files.map(function (f) { return { path: f.path, size: f.blob.size || 0 }; }) })).then(function (r) {
      if (r.status !== 200 || !r.json || !r.json.ok) return failUpload(httpError(r.status, r.json, 'checking your design'), r.json && r.json.ref, 'start', info, student, !!(r.json && r.json.ref));
      var s = r.json, size = s.chunk || 8388608;
      var queues = s.files.map(function (orig, k) {
        var blob = info.files[orig].blob, q = [];
        for (var o = 0; o < blob.size; o += size) q.push({ k: k, o: o, blob: blob.slice(o, Math.min(o + size, blob.size)), name: info.files[orig].path });
        return q;
      }).filter(function (q) { return q.length; });
      var total = 0; queues.forEach(function (q) { q.forEach(function (p) { total += p.blob.size; }); });
      var sent = 0, inflight = {}, failed = null, qi = 0;
      function progress() { var now = sent; for (var key in inflight) now += inflight[key]; status('Uploading ' + fmtBytes(now) + ' of ' + fmtBytes(total || 1) + '…', 0.03 + 0.77 * (total ? now / total : 1)); }
      function sendPart(p, attempt) {
        var key = p.k + ':' + p.o;
        return request('POST', API + '/api/upload/chunk?id=' + encodeURIComponent(s.id) + '&k=' + p.k + '&o=' + p.o, p.blob, function (n) { inflight[key] = n; progress(); }).then(function (r) {
          delete inflight[key];
          if (r.status === 200) { sent += p.blob.size; progress(); return; }
          var retry = r.status === 0 || r.status >= 500 || r.status === 429 || (r.json && (r.json.code === 'aborted' || r.json.code === 'gap'));
          if (retry && attempt < 6 && !(r.json && r.json.code === 'expired')) { status('Connection hiccup, retrying “' + p.name + '”…', 0.03 + 0.77 * (total ? sent / total : 1)); return sleep(Math.min(1000 * Math.pow(2, attempt), 20000)).then(function () { return sendPart(p, attempt + 1); }); }
          throw { msg: httpError(r.status, r.json, 'sending “' + p.name + '” (' + Math.round(100 * sent / (total || 1)) + '% uploaded)'), ref: (r.json && r.json.ref) || s.id };
        });
      }
      function worker() {
        if (failed || qi >= queues.length) return Promise.resolve();
        var q = queues[qi++];
        return q.reduce(function (pr, p) { return pr.then(function () { if (!failed) return sendPart(p, 0); }); }, Promise.resolve()).then(worker);
      }
      progress();
      Promise.all([worker(), worker(), worker()]).then(finish, function (e) { if (failed) return; failed = e; failUpload(e.msg, e.ref, 'send', info, student); });
      function finish() {
        if (failed) return;
        status('Everything arrived. Saving it to the class gallery…', 0.82);
        request('POST', API + '/api/upload/finish', JSON.stringify({ id: s.id })).then(function (r) {
          if ((r.status !== 202 && r.status !== 200) || !r.json || !r.json.ok) return failUpload(httpError(r.status, r.json, 'finishing the upload'), s.id, 'finish', info, student);
          follow(r.json, 0);
        });
      }
      function follow(st, misses) {
        var link = viewUrl({ folder: st.folder, entry: st.entry, by: student }, 'shared');
        if (st.status === 'done') {
          try { var p = JSON.parse(sessionStorage.getItem('chiactive-publishing') || '[]'); p.push({ folder: st.folder, name: st.name, by: student, entry: st.entry, uploadedAt: new Date().toISOString() }); sessionStorage.setItem('chiactive-publishing', JSON.stringify(p)); } catch (e) {}
          idle({ html: '“' + esc(st.name) + '” was saved' + (s.skipped && s.skipped.length ? ' (skipped ' + s.skipped.length + ' file' + (s.skipped.length === 1 ? '' : 's') + ' a website can’t use, like ' + esc(s.skipped[0]) + ')' : '') + '. It&rsquo;s live for everyone: <a href="' + esc(link) + '">open it</a>.' });
          return render(st.folder);
        }
        if (st.status === 'failed') return failUpload(st.error || 'Saving to GitHub failed.', st.ref, 'save', info, student, true);
        var pct = st.steps ? st.done / st.steps : 0;
        inner.innerHTML = '<span class="up-icon">' + UPLOAD_ICON + '</span><h3>Saving to the gallery</h3>' +
          '<p role="status">' + (st.stage === 'commit' || st.steps <= 1 ? 'Publishing it…' : 'Saving images and media to GitHub: ' + st.done + ' of ' + (st.steps - 1)) + '</p>' +
          (st.note ? '<p class="up-note">' + esc(st.note) + '</p>' : '') +
          '<div class="up-progress"><span style="width:' + Math.round((0.82 + 0.18 * pct) * 100) + '%"></span></div>' +
          '<p class="up-note">You can already open it: <a href="' + esc(link) + '">' + esc(st.name) + '</a></p>';
        setTimeout(function () {
          request('GET', API + '/api/upload/status?id=' + encodeURIComponent(s.id)).then(function (r) {
            if (r.status === 200 && r.json && r.json.ok) return follow(r.json, 0);
            if (r.status === 404) return failUpload(httpError(r.status, r.json, 'saving'), s.id, 'save', info, student);
            if (misses < 20) return follow(st, misses + 1);
            failUpload('Lost contact with the upload server while it was saving your design. Refresh the gallery in a minute; if your design isn’t there, upload it again.', s.id, 'save', info, student);
          });
        }, misses ? 3000 : 1500);
      }
    });
  }

  /* ---------- finding shared designs ---------- */
  function b64utf8(b64) { var bin = atob(String(b64).replace(/\s/g, '')); var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
  function sharedDesigns() {
    var found = {};
    function add(list, over) {
      (list || []).forEach(function (d) {
        if (!d || !d.folder) return;
        var cur = found[d.folder];
        if (cur && !over) return;
        found[d.folder] = { folder: d.folder, name: d.name || (cur && cur.name) || prettyFolder(d.folder), by: d.by || (cur && cur.by) || '', entry: d.entry || (cur && cur.entry) || 'index.html', uploadedAt: d.uploadedAt || (cur && cur.uploadedAt) || '' };
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
      if (countChip) countChip.textContent = n ? n + ' design' + (n === 1 ? '' : 's') : 'No designs yet. Be the first!';
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
    healthP = fetch(API + '/api/health', { signal: ctl ? ctl.signal : undefined }).then(function (r) { return r.json(); })
      .then(function (h) { server.state = h && h.ok && h.ready ? 'ready' : 'down'; })
      .catch(function () { server.state = 'down'; })
      .then(function () { clearTimeout(timer); if (!pending) idle(); });
  }
  idle();
  render();
})();
