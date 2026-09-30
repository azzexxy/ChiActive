/* ChiActive upload server
 * Students upload a design (.zip or a folder of files) plus their student name.
 * The server unzips it, checks it, and commits it to the GitHub repo as
 *   designs/website-design-<student-name>/...
 * and adds it to designs/manifest.json, so it shows up for everyone.
 *
 * Environment variables (set these in Render, never in the code):
 *   GITHUB_TOKEN     fine-grained token with "Contents: read and write" on the repo   (required)
 *   GITHUB_REPO      owner/repo, default "azzexxy/ChiActive"
 *   GITHUB_BRANCH    default "main"
 *   DESIGNS_DIR      folder in the repo, default "designs"
 *   ALLOWED_ORIGINS  comma-separated sites allowed to upload (default: the GitHub Pages site + localhost)
 *   PAGES_URL        public site, default "https://azzexxy.github.io/ChiActive/"
 */
'use strict';
const http = require('http');
const Busboy = require('busboy');
const JSZip = require('jszip');

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPO || 'azzexxy/ChiActive';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const DIR = (process.env.DESIGNS_DIR || 'designs').replace(/^\/+|\/+$/g, '');
const API = (process.env.GITHUB_API || 'https://api.github.com').replace(/\/+$/, '');
const PAGES_URL = (process.env.PAGES_URL || 'https://azzexxy.github.io/ChiActive/').replace(/\/?$/, '/');
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://azzexxy.github.io,http://localhost:8000,http://127.0.0.1:8000').split(',').map(s => s.trim()).filter(Boolean);

const MAX_TOTAL = 60 * 1024 * 1024;   // 60 MB unpacked
const MAX_FILE = 25 * 1024 * 1024;    // 25 MB per file
const MAX_FILES = 600;
const ALLOWED_EXT = new Set(['html', 'htm', 'css', 'js', 'mjs', 'json', 'map', 'txt', 'md', 'xml', 'csv',
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'pdf']);
const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini|\.git|node_modules)(\/|$)|(^|\/)\._/i;

/* ---------- small helpers ---------- */
function send(res, status, body, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}
function allowedOrigin(req) {
  const o = req.headers.origin;
  return o && ORIGINS.includes(o) ? o : null;
}
function cleanName(s) { return String(s || '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60); }
function slugify(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}
function safePath(p) {
  p = String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!p || JUNK.test(p)) return null;
  const parts = p.split('/');
  if (parts.some(x => !x || x === '.' || x === '..' || x.startsWith('.'))) return null;
  const ext = (p.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return null;
  return parts.join('/');
}

/* rate limit: 10 uploads per hour per IP */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  if (list.length >= 10) return true;
  list.push(now); hits.set(ip, list); return false;
}

/* ---------- read the upload ---------- */
function readUpload(req) {
  return new Promise((resolve, reject) => {
    let bb;
    try { bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_TOTAL, files: MAX_FILES + 5, fields: 20 } }); }
    catch (e) { return reject(new Error('Send the upload as a form (multipart/form-data).')); }
    const fields = {}, files = [];
    let total = 0, failed = null;
    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('file', (field, stream, info) => {
      const chunks = [];
      stream.on('data', d => { total += d.length; if (total > MAX_TOTAL) { failed = failed || new Error('That upload is too big. Keep it under 60 MB.'); stream.resume(); } else chunks.push(d); });
      stream.on('limit', () => { failed = failed || new Error('A file is too big. Keep it under 60 MB.'); });
      // folder uploads send each file's relative path in the filename
      stream.on('end', () => { if (!failed) files.push({ field, name: info.filename || '', data: Buffer.concat(chunks) }); });
    });
    bb.on('error', reject);
    bb.on('close', () => failed ? reject(failed) : resolve({ fields, files }));
    req.pipe(bb);
  });
}

async function collectFiles(uploaded) {
  let out = [];
  for (const f of uploaded) {
    if (/\.zip$/i.test(f.name) || (f.data[0] === 0x50 && f.data[1] === 0x4b && !/\.(docx|xlsx|pptx)$/i.test(f.name))) {
      let zip;
      try { zip = await JSZip.loadAsync(f.data); } catch (e) { throw new Error('That .zip file couldn’t be opened. Try zipping the folder again.'); }
      const entries = Object.values(zip.files).filter(e => !e.dir);
      if (entries.length > MAX_FILES * 2) throw new Error('That zip has too many files.');
      for (const e of entries) out.push({ path: e.name, data: await e.async('nodebuffer') });
    } else {
      out.push({ path: f.name, data: f.data });
    }
  }
  // clean + validate
  out = out.map(f => ({ path: String(f.path).replace(/\\/g, '/').replace(/^\/+/, ''), data: f.data })).filter(f => f.path && !JUNK.test(f.path));
  // strip one shared top folder ("my-design/index.html" -> "index.html")
  const tops = new Set(out.map(f => f.path.split('/')[0]));
  if (tops.size === 1 && out.every(f => f.path.includes('/'))) {
    const t = [...tops][0] + '/';
    out = out.map(f => ({ path: f.path.slice(t.length), data: f.data }));
  }
  const skipped = [];
  out = out.filter(f => { const p = safePath(f.path); if (!p) { skipped.push(f.path); return false; } f.path = p; return true; });
  if (!out.length) throw new Error('No usable files found. Upload the folder (or a .zip of it) that contains your web pages.');
  if (out.length > MAX_FILES) throw new Error(`That design has ${out.length} files. Keep it under ${MAX_FILES}.`);
  const big = out.find(f => f.data.length > MAX_FILE);
  if (big) throw new Error(`${big.path} is ${(big.data.length / 1048576).toFixed(1)} MB. Keep each file under 25 MB.`);
  const total = out.reduce((s, f) => s + f.data.length, 0);
  if (total > MAX_TOTAL) throw new Error('That design is too big. Keep it under 60 MB.');
  const html = out.filter(f => /\.html?$/i.test(f.path));
  if (!html.length) throw new Error('No web page found. A design needs at least one .html file, ideally index.html.');
  const depth = p => p.split('/').length;
  const idx = html.filter(f => /(^|\/)index\.html?$/i.test(f.path)).sort((a, b) => depth(a.path) - depth(b.path));
  const entry = (idx[0] || html.sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path))[0]).path;
  return { files: out, entry, total, skipped };
}

/* ---------- GitHub ---------- */
async function gh(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'chiactive-upload-server', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!r.ok) { const err = new Error(`GitHub ${method} ${path} failed (${r.status}): ${data && data.message ? data.message : text.slice(0, 200)}`); err.status = r.status; throw err; }
  return data;
}
async function pathExists(p) {
  try { await gh('GET', `/repos/${REPO}/contents/${encodeURI(p)}?ref=${BRANCH}`); return true; }
  catch (e) { if (e.status === 404) return false; throw e; }
}
async function readManifest() {
  try {
    const f = await gh('GET', `/repos/${REPO}/contents/${DIR}/manifest.json?ref=${BRANCH}`);
    const list = JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'));
    return Array.isArray(list) ? list : [];
  } catch (e) { if (e.status === 404) return []; throw e; }
}
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
async function commitDesign(student, info) {
  const base = 'website-design-' + (slugify(student) || 'student');
  let folder = base, n = 2;
  while (await pathExists(`${DIR}/${folder}`)) folder = `${base}-${n++}`;
  const name = `Website design - ${student}` + (folder === base ? '' : ` (${folder.slice(base.length + 1)})`);
  const blobs = await pool(info.files, 6, f => gh('POST', `/repos/${REPO}/git/blobs`, { content: f.data.toString('base64'), encoding: 'base64' }));
  const tree = info.files.map((f, i) => ({ path: `${DIR}/${folder}/${f.path}`, mode: '100644', type: 'blob', sha: blobs[i].sha }));
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await gh('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
    const head = await gh('GET', `/repos/${REPO}/git/commits/${ref.object.sha}`);
    const manifest = (await readManifest()).filter(d => d && d.folder !== folder);
    manifest.push({ folder, name, by: student, entry: info.entry, uploadedAt: new Date().toISOString() });
    const mBlob = await gh('POST', `/repos/${REPO}/git/blobs`, { content: Buffer.from(JSON.stringify(manifest, null, 2) + '\n').toString('base64'), encoding: 'base64' });
    const newTree = await gh('POST', `/repos/${REPO}/git/trees`, { base_tree: head.tree.sha, tree: tree.concat([{ path: `${DIR}/manifest.json`, mode: '100644', type: 'blob', sha: mBlob.sha }]) });
    const commit = await gh('POST', `/repos/${REPO}/git/commits`, { message: `Add ${name}`, tree: newTree.sha, parents: [ref.object.sha] });
    try {
      await gh('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha });
      return { folder, name, entry: info.entry, commit: commit.sha, url: `${PAGES_URL}${DIR}/${folder}/${info.entry.split('/').map(encodeURIComponent).join('/')}` };
    } catch (e) { if (e.status !== 422 || attempt === 2) throw e; } // someone else uploaded at the same moment: retry
  }
}

/* ---------- HTTP ---------- */
const server = http.createServer(async (req, res) => {
  const origin = allowedOrigin(req);
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') {
    res.writeHead(origin ? 204 : 403, origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : {});
    return res.end();
  }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/api/health')) {
    return send(res, 200, { ok: true, service: 'ChiActive upload server', repo: REPO, ready: !!TOKEN }, origin);
  }
  if (req.method === 'POST' && url.pathname === '/api/upload') {
    if (!origin) return send(res, 403, { ok: false, error: 'Uploads are only accepted from the ChiActive site.' }, null);
    if (!TOKEN) return send(res, 503, { ok: false, error: 'The upload server isn’t connected to GitHub yet (missing GITHUB_TOKEN).' }, origin);
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (limited(ip)) return send(res, 429, { ok: false, error: 'Too many uploads from this connection. Try again in an hour.' }, origin);
    try {
      const { fields, files } = await readUpload(req);
      const student = cleanName(fields.student);
      if (student.length < 2) return send(res, 400, { ok: false, error: 'Enter your student name.' }, origin);
      if (!files.length) return send(res, 400, { ok: false, error: 'Choose a .zip or a folder to upload.' }, origin);
      let paths = []; try { paths = JSON.parse(fields.paths || '[]'); } catch (e) {}
      const info = await collectFiles(files.map((f, i) => ({ name: (Array.isArray(paths) && paths[i]) || f.name, data: f.data })));
      const saved = await commitDesign(student, info);
      console.log(`Saved ${saved.name}: ${info.files.length} files, ${(info.total / 1048576).toFixed(1)} MB`);
      return send(res, 200, { ok: true, ...saved, files: info.files.length, skipped: info.skipped.slice(0, 20) }, origin);
    } catch (e) {
      console.error(e);
      const userError = /^GitHub /.test(e.message) ? 'Saving to GitHub failed. Try again in a minute.' : e.message;
      return send(res, 400, { ok: false, error: userError }, origin);
    }
  }
  send(res, 404, { ok: false, error: 'Not found' }, origin);
});
server.listen(PORT, () => console.log(`ChiActive upload server on :${PORT} for ${REPO} (${TOKEN ? 'token set' : 'NO TOKEN'})`));
