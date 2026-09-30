/* ChiActive design picker: upload other people's designs (.zip or folder),
   save them in this browser (IndexedDB), and list shared designs from designs/. */
(function () {
  var DB_NAME = 'chiactive-designs', DB_VERSION = 1;
  var JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini|\.git)(\/|$)/i;
  var MAX_BYTES = 400 * 1024 * 1024;
  var card = document.getElementById('upload-card');
  var inner = document.getElementById('up-inner');
  var grid = document.getElementById('community');
  var zipInput = document.getElementById('zip-input');
  var folderInput = document.getElementById('folder-input');
  var countChip = document.getElementById('community-count');
  var canServe = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && 'indexedDB' in window;
  var swReady = null;
  var pending = null;

  var UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtBytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  /* ---------- IndexedDB ---------- */
  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('designs')) db.createObjectStore('designs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function listDesigns() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var r = db.transaction('designs').objectStore('designs').getAll();
        r.onsuccess = function () { resolve((r.result || []).sort(function (a, b) { return b.createdAt - a.createdAt; })); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }
  function saveDesign(meta, files, onProgress) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(['designs', 'files'], 'readwrite');
        var fs = tx.objectStore('files'), done = 0;
        files.forEach(function (f) {
          var r = fs.put(f.blob, meta.id + '/' + f.path);
          r.onsuccess = function () { done++; if (onProgress && done % 10 === 0) onProgress(done / files.length); };
        });
        tx.objectStore('designs').put(meta);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Saving was cancelled.')); };
      });
    });
  }
  function removeDesign(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(['designs', 'files'], 'readwrite');
        tx.objectStore('designs').delete(id);
        tx.objectStore('files').delete(IDBKeyRange.bound(id + '/', id + '/￿'));
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  /* ---------- Reading uploads ---------- */
  function readZip(file) {
    if (!window.JSZip) return Promise.reject(new Error('The zip reader didn’t load. Refresh the page and try again.'));
    return JSZip.loadAsync(file).then(function (zip) {
      var entries = [];
      zip.forEach(function (path, entry) { if (!entry.dir) entries.push(entry); });
      var out = [], n = 0;
      return entries.reduce(function (p, entry) {
        return p.then(function () {
          return entry.async('blob').then(function (blob) {
            out.push({ path: entry.name, blob: blob });
            n++; if (n % 15 === 0) status('Unzipping ' + n + ' of ' + entries.length + ' files…', n / entries.length);
          });
        });
      }, Promise.resolve()).then(function () { return out; });
    });
  }
  function readEntry(entry, prefix) {
    return new Promise(function (resolve) {
      if (entry.isFile) {
        entry.file(function (f) { resolve([{ path: prefix + f.name, blob: f }]); }, function () { resolve([]); });
      } else if (entry.isDirectory) {
        var reader = entry.createReader(), all = [];
        (function next() {
          reader.readEntries(function (batch) {
            if (!batch.length) {
              Promise.all(all.map(function (e) { return readEntry(e, prefix + entry.name + '/'); })).then(function (lists) { resolve([].concat.apply([], lists)); });
            } else { all = all.concat([].slice.call(batch)); next(); }
          }, function () { resolve([]); });
        })();
      } else resolve([]);
    });
  }
  function clean(files) {
    return files.filter(function (f) { return f.path && !JUNK.test(f.path) && !/(^|\/)\._/.test(f.path); })
      .map(function (f) { return { path: f.path.replace(/^\/+/, '').replace(/\\/g, '/'), blob: f.blob }; });
  }
  function analyse(files, fallbackName) {
    files = clean(files);
    if (!files.length) throw new Error('That upload was empty.');
    // strip one shared top-level folder ("my-design/...")
    var tops = {}; files.forEach(function (f) { tops[f.path.split('/')[0]] = 1; });
    var topNames = Object.keys(tops), strip = '';
    var folderName = '';
    if (topNames.length === 1 && files.every(function (f) { return f.path.indexOf('/') > -1; })) { strip = topNames[0] + '/'; folderName = topNames[0]; }
    files = files.map(function (f) { return { path: f.path.slice(strip.length), blob: f.blob }; });
    var html = files.filter(function (f) { return /\.html?$/i.test(f.path); });
    if (!html.length) throw new Error('No web page found. A design needs at least one .html file (ideally index.html).');
    function depth(p) { return p.split('/').length; }
    var idx = html.filter(function (f) { return /(^|\/)index\.html?$/i.test(f.path); }).sort(function (a, b) { return depth(a.path) - depth(b.path); });
    var entry = (idx[0] || html.sort(function (a, b) { return depth(a.path) - depth(b.path) || a.path.localeCompare(b.path); })[0]).path;
    var size = files.reduce(function (s, f) { return s + (f.blob.size || 0); }, 0);
    if (size > MAX_BYTES) throw new Error('That design is ' + fmtBytes(size) + '. Keep uploads under ' + fmtBytes(MAX_BYTES) + ' (large videos are usually the reason).');
    return { files: files, entry: entry, size: size, fromFolder: !!folderName, name: (folderName || fallbackName || 'Uploaded design').replace(/\.zip$/i, '').replace(/[-_]+/g, ' ').trim() };
  }
  function titleOf(files, entry) {
    var f = files.filter(function (x) { return x.path === entry; })[0];
    if (!f) return Promise.resolve('');
    return f.blob.text().then(function (t) { var m = t.match(/<title[^>]*>([^<]*)<\/title>/i); return m ? m[1].trim() : ''; }).catch(function () { return ''; });
  }

  /* ---------- Upload card states ---------- */
  function idle(message) {
    pending = null;
    if (!canServe) {
      inner.innerHTML = '<span class="up-icon">' + UPLOAD_ICON + '</span><h3>Upload a design</h3>' +
        '<p>Uploads need the local preview server, because the browser has to show the uploaded pages for you.</p>' +
        '<p class="up-note">Double-click <code>start-server-mac.command</code> (or <code>start-server-windows.bat</code>) in the Website Design folder, then open <code>http://localhost:8000</code>.</p>';
      return;
    }
    inner.innerHTML = '<span class="up-icon">' + UPLOAD_ICON + '</span><h3>Upload a design</h3>' +
      '<p>Drop a <b>.zip</b> or a <b>folder</b> with someone&rsquo;s website here. It needs an <code>index.html</code> (or any .html page).</p>' +
      '<div class="up-actions"><button class="btn" type="button" data-pick="zip">Choose .zip</button><button class="btn btn-ghost" type="button" data-pick="folder">Choose folder</button></div>' +
      (message ? '<p class="' + (message.error ? 'up-error' : 'up-note') + '" role="status">' + esc(message.text) + '</p>' : '<p class="up-note">Saved in this browser only. To share designs with everyone, put them in the <code>designs/</code> folder.</p>');
  }
  function status(text, fraction) {
    inner.innerHTML = '<span class="up-icon">' + UPLOAD_ICON + '</span><h3>Working on it</h3><p role="status">' + esc(text) + '</p><div class="up-progress"><span style="width:' + Math.round((fraction || 0) * 100) + '%"></span></div>';
  }
  function confirmForm(info) {
    pending = info;
    inner.innerHTML = '<h3>Add this design?</h3>' +
      '<div class="up-form">' +
      '<div class="up-found">Found <b>' + info.files.length + ' files</b> (' + fmtBytes(info.size) + '). Starts at <b>' + esc(info.entry) + '</b>.</div>' +
      '<label>Design name<input id="up-name" type="text" maxlength="60" value="' + esc(info.name) + '" required></label>' +
      '<label>Made by (optional)<input id="up-by" type="text" maxlength="60" placeholder="Classmate&rsquo;s name"></label>' +
      '<div class="up-actions" style="justify-content:flex-start"><button class="btn" type="button" data-save>Add to the picker</button><button class="btn btn-ghost" type="button" data-cancel>Cancel</button></div>' +
      '</div>';
    var nm = document.getElementById('up-name'); nm.focus(); nm.select();
  }

  function handle(promiseOfFiles, name) {
    status('Reading the files…', 0.05);
    promiseOfFiles.then(function (files) {
      var info = analyse(files, name);
      return titleOf(info.files, info.entry).then(function (t) { if (t && !info.fromFolder && (!name || /\.zip$/i.test(name) || /uploaded design/i.test(info.name))) info.name = t; confirmForm(info); });
    }).catch(function (err) { idle({ error: true, text: err && err.message ? err.message : 'That upload couldn’t be read.' }); });
  }
  function handleZips(fileList) {
    var zips = [].slice.call(fileList).filter(function (f) { return /\.zip$/i.test(f.name) || /zip/.test(f.type); });
    if (!zips.length) return idle({ error: true, text: 'That wasn’t a .zip file. Choose a .zip, or use Choose folder.' });
    handle(readZip(zips[0]), zips[0].name);
  }
  function handleFolderInput(fileList) {
    var files = [].slice.call(fileList).map(function (f) { return { path: f.webkitRelativePath || f.name, blob: f }; });
    handle(Promise.resolve(files), '');
  }
  function handleDrop(dt) {
    var items = dt.items ? [].slice.call(dt.items) : [];
    var entries = items.map(function (it) { return it.webkitGetAsEntry && it.webkitGetAsEntry(); }).filter(Boolean);
    if (entries.length === 1 && entries[0].isFile && /\.zip$/i.test(entries[0].name)) return handleZips(dt.files);
    if (entries.length) {
      var name = entries.length === 1 && entries[0].isDirectory ? entries[0].name : '';
      return handle(Promise.all(entries.map(function (e) { return readEntry(e, ''); })).then(function (l) { return [].concat.apply([], l); }), name);
    }
    if (dt.files && dt.files.length) handleZips(dt.files);
  }

  function save() {
    if (!pending) return;
    var name = (document.getElementById('up-name').value || '').trim() || pending.name;
    var by = (document.getElementById('up-by').value || '').trim();
    var meta = { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, by: by, entry: pending.entry, size: pending.size, count: pending.files.length, createdAt: Date.now() };
    var files = pending.files;
    status('Saving ' + files.length + ' files…', 0.1);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    saveDesign(meta, files, function (f) { status('Saving ' + files.length + ' files…', 0.1 + f * 0.9); })
      .then(function () { idle({ text: '“' + name + '” was added. Scroll down to open it.' }); return render(meta.id); })
      .catch(function (err) { idle({ error: true, text: 'Couldn’t save it: ' + (err && err.message ? err.message : 'the browser ran out of storage.') }); });
  }

  /* ---------- Cards ---------- */
  function cardHtml(d, kind) {
    var open = kind === 'shared' ? 'designs/' + d.folder.split('/').map(encodeURIComponent).join('/') + '/' + d.entry.split('/').map(encodeURIComponent).join('/')
                                 : 'uploaded/' + d.id + '/' + d.entry.split('/').map(encodeURIComponent).join('/');
    var tag = kind === 'shared' ? '<span class="tag shared">Shared</span>' : '<span class="tag up">Uploaded</span>';
    var meta = kind === 'shared' ? 'From the <code>designs/</code> folder' : 'Saved in this browser &middot; ' + d.count + ' files &middot; ' + new Date(d.createdAt).toLocaleDateString();
    return '<article class="option community-card" data-kind="' + kind + '" data-id="' + esc(d.id || d.folder) + '">' +
      '<a class="cover" href="' + open + '" aria-label="Open ' + esc(d.name) + '"></a>' +
      '<div class="stage"><div class="browser"><div class="bar"><i></i><i></i><i></i><span>' + esc(kind === 'shared' ? 'designs / ' + d.folder : 'uploaded / ' + d.name) + '</span></div>' +
      '<div class="frame"><iframe src="' + open + '" title="Preview of ' + esc(d.name) + '" loading="lazy" tabindex="-1" sandbox="allow-same-origin"></iframe></div></div></div>' +
      '<div class="body"><div class="name-row"><h2 class="name">' + esc(d.name) + '</h2>' + tag + '</div>' +
      (d.by ? '<p class="style">By ' + esc(d.by) + '</p>' : '') +
      '<p class="meta-line">' + meta + '</p>' +
      '<div class="card-actions"><a class="btn" href="' + open + '">Open design <span>&rarr;</span></a>' +
      (kind === 'upload' ? '<button class="btn-remove" type="button" data-remove="' + esc(d.id) + '">Remove</button>' : '') + '</div></div></article>';
  }
  function scaleFrames() {
    grid.querySelectorAll('.frame').forEach(function (fr) { fr.style.setProperty('--s', (fr.clientWidth / 1200).toFixed(4)); });
  }
  var ro = 'ResizeObserver' in window ? new ResizeObserver(scaleFrames) : null;

  function sharedDesigns() {
    var found = {};
    function add(list) { (list || []).forEach(function (d) { if (d && d.folder && !found[d.folder]) found[d.folder] = { folder: d.folder, name: d.name || d.folder.replace(/[-_]+/g, ' '), by: d.by || '', entry: d.entry || 'index.html' }; }); }
    var manifest = fetch('designs/manifest.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).then(add).catch(function () {});
    // python's http.server lists folders; GitHub Pages doesn't, so ask the GitHub API there
    var listing = fetch('designs/', { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var names = [], re = /href="([^"?#\/]+)\/"/g, m;
      while ((m = re.exec(t))) names.push(decodeURIComponent(m[1]));
      add(names.map(function (n) { return { folder: n }; }));
    }).catch(function () {});
    var gh = Promise.resolve();
    if (/\.github\.io$/.test(location.hostname)) {
      var owner = location.hostname.split('.')[0], parts = location.pathname.split('/').filter(Boolean);
      var repo = parts[0] || owner + '.github.io';
      var dir = parts.slice(1).filter(function (p) { return !/\.html?$/.test(p); }).concat('designs').join('/');
      gh = fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + dir).then(function (r) { return r.ok ? r.json() : []; })
        .then(function (items) { add((items || []).filter(function (i) { return i.type === 'dir'; }).map(function (i) { return { folder: i.name }; })); }).catch(function () {});
    }
    return Promise.all([manifest, listing, gh]).then(function () {
      var list = Object.keys(found).map(function (k) { return found[k]; });
      // keep only folders that actually have their start page
      return Promise.all(list.map(function (d) {
        return fetch('designs/' + encodeURIComponent(d.folder) + '/' + d.entry, { method: 'HEAD', cache: 'no-store' }).then(function (r) { return r.ok ? d : null; }).catch(function () { return null; });
      })).then(function (l) { return l.filter(Boolean); });
    });
  }

  function render(highlightId) {
    var uploads = canServe ? (swReady || Promise.resolve()).then(listDesigns).catch(function () { return []; }) : Promise.resolve([]);
    return Promise.all([uploads, sharedDesigns()]).then(function (res) {
      grid.querySelectorAll('.community-card').forEach(function (c) { c.remove(); });
      var html = res[0].map(function (d) { return cardHtml(d, 'upload'); }).join('') + res[1].map(function (d) { return cardHtml(d, 'shared'); }).join('');
      card.insertAdjacentHTML('afterend', html);
      var n = res[0].length + res[1].length;
      countChip.textContent = n ? n + ' community design' + (n === 1 ? '' : 's') : '';
      grid.querySelectorAll('.frame').forEach(function (fr) { if (ro) ro.observe(fr); });
      scaleFrames();
      if (highlightId) { var el = grid.querySelector('[data-id="' + highlightId + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  }

  /* ---------- Events ---------- */
  card.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('data-pick') === 'zip') zipInput.click();
    if (b.getAttribute('data-pick') === 'folder') folderInput.click();
    if (b.hasAttribute('data-save')) save();
    if (b.hasAttribute('data-cancel')) idle();
  });
  card.addEventListener('keydown', function (e) { if (e.key === 'Enter' && pending && e.target.tagName === 'INPUT') { e.preventDefault(); save(); } });
  zipInput.addEventListener('change', function () { if (zipInput.files.length) handleZips(zipInput.files); zipInput.value = ''; });
  folderInput.addEventListener('change', function () { if (folderInput.files.length) handleFolderInput(folderInput.files); folderInput.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { card.addEventListener(ev, function (e) { if (!canServe) return; e.preventDefault(); card.classList.add('drag'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { card.addEventListener(ev, function (e) { if (ev === 'dragleave' && card.contains(e.relatedTarget)) return; card.classList.remove('drag'); }); });
  card.addEventListener('drop', function (e) { if (!canServe) return; e.preventDefault(); handleDrop(e.dataTransfer); });
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('[data-remove]'); if (!b) return;
    e.preventDefault();
    if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = 'Click again to remove'; setTimeout(function () { if (b.isConnected) { b.classList.remove('confirm'); b.textContent = 'Remove'; } }, 4000); return; }
    removeDesign(b.getAttribute('data-remove')).then(function () { render(); });
  });

  if (canServe) {
    swReady = navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }).catch(function () { canServe = false; idle(); });
  }
  idle();
  render();
})();
