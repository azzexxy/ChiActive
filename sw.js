/* ChiActive design picker: serves designs uploaded in the browser.
   Uploaded files live in this browser's IndexedDB. Any request to
   uploaded/<id>/<path> is answered from there, so an uploaded site's
   relative links, styles, scripts and images all work. */
var DB_NAME = 'chiactive-designs', DB_VERSION = 1;
var TYPES = { html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', xml: 'application/xml', csv: 'text/csv; charset=utf-8', map: 'application/json' };

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

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
function get(db, store, key) {
  return new Promise(function (resolve, reject) {
    var r = db.transaction(store).objectStore(store).get(key);
    r.onsuccess = function () { resolve(r.result); };
    r.onerror = function () { reject(r.error); };
  });
}

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  var base = new URL('uploaded/', self.registration.scope).pathname;
  if (url.pathname.indexOf(base) !== 0) return;
  url.dest = event.request.destination;
  event.respondWith(serve(url.pathname.slice(base.length), url));
});

function page(status, title, body) {
  return new Response('<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + title + '</title>' +
    '<body style="font-family:system-ui,sans-serif;background:#16202C;color:#E6ECF2;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">' +
    '<div><h1 style="color:#F5E7BE">' + title + '</h1><p>' + body + '</p><p><a style="color:#41B6E6" href="' + new URL('index.html', self.registration.scope).pathname + '">Back to the design picker</a></p></div>',
    { status: status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function event_dest(url) { return url.dest || ''; }

async function serve(rest, url) {
  var parts = rest.split('/');
  var id = parts.shift();
  var path = parts.map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } }).join('/');
  var db = await openDb();
  var design = await get(db, 'designs', id);
  if (!design) return page(404, 'Design not found', 'This design isn&rsquo;t saved in this browser anymore. Upload it again from the design picker.');
  if (path === '') return Response.redirect(new URL(design.entry.split('/').map(encodeURIComponent).join('/'), url.href.replace(/\/?$/, '/')).href, 302);
  if (path.slice(-1) === '/') path += 'index.html';
  var file = await get(db, 'files', id + '/' + path);
  if (!file && !/\.[a-z0-9]+$/i.test(path)) {
    var idx = await get(db, 'files', id + '/' + path + '/index.html');
    if (idx) return Response.redirect(url.pathname + '/', 302);
    file = await get(db, 'files', id + '/' + path + '.html');
  }
  if (!file) return page(404, 'File not in this design', 'The design links to <code>' + path.replace(/</g, '&lt;') + '</code>, but that file wasn&rsquo;t in the upload.');
  var ext = (path.split('.').pop() || '').toLowerCase();
  var type = TYPES[ext] || file.type || 'application/octet-stream';
  var inFrame = event_dest(url) === 'iframe';
  if (type.indexOf('text/html') === 0 && !inFrame) {
    var html = await file.text();
    var picker = new URL('index.html', self.registration.scope).pathname;
    var pill = '<a href="' + picker + '" style="position:fixed;left:16px;bottom:16px;z-index:2147483647;display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;background:#E4022B;color:#fff;font:700 14px/1 system-ui,sans-serif;text-decoration:none;box-shadow:0 12px 28px -10px rgba(0,0,0,.5)">&#8592; Design picker</a>';
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, pill + '</body>') : html + pill;
    return new Response(html, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store' } });
  }
  return new Response(file, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store' } });
}
