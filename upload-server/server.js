/* ChiActive upload server
 *
 * Students upload a design (a .zip, unzipped in their browser, or a folder) plus their
 * student name. The browser sends the files in 8 MB pieces, the server writes them to disk,
 * then saves them to the GitHub repo as designs/website-design-<student-name>/... and lists
 * the design in designs/manifest.json so it shows up for everyone.
 *
 *   POST /api/upload/start    {student, visitor, files:[{path,size}]}  -> checks + picks the folder
 *   POST /api/upload/chunk    ?id=&k=&o=   raw bytes of file k at offset o (retry-safe)
 *   POST /api/upload/finish   {id}         -> starts saving to GitHub (background job)
 *   GET  /api/upload/status   ?id=         -> progress / the exact error
 *   GET  /d/<folder>/<path>                 instant preview while GitHub Pages rebuilds
 *   GET  /api/designs                       fresh list of designs
 *   POST /api/event                         visit / view / page / client-error beacons
 *   GET  /admin                             admin page (password: ADMIN_PASSWORD):
 *                                           activity log, rename/delete designs, owners, accounts
 *   GET  /studio                            ChiActive Studio: students sign up / log in, upload their
 *                                           design and edit its text right on the page (pencil + trash)
 *   POST /api/account/(signup|login|logout|password), GET /api/account/me
 *   GET  /api/edit/pages|page, POST /api/edit/block   the Studio editor
 *
 * Student accounts (username + scrypt password hash) are saved encrypted on the "activity-log"
 * branch (accounts/accounts.enc) with a key made from DATA_KEY, LOG_KEY or ADMIN_PASSWORD.
 * Logins use an HttpOnly cookie on this server's own address, so student designs (which run on
 * the GitHub Pages address) can never read them.
 *
 * Activity log: every upload, error, view and admin action is kept in memory and saved,
 * encrypted with a key made from LOG_KEY (or ADMIN_PASSWORD), on the repo branch
 * "activity-log". GitHub Pages only publishes main, so the log is never part of the site.
 *
 * Environment variables (set these in Render, never in the code):
 *   GITHUB_TOKEN     fine-grained token with "Contents: Read and write" on the repo   (required)
 *   ADMIN_PASSWORD   password for /admin                                               (required for the admin page)
 *   LOG_KEY          optional separate key for the log encryption (default: ADMIN_PASSWORD)
 *   DATA_KEY         optional separate key for the accounts file (default: LOG_KEY or ADMIN_PASSWORD).
 *                    If you ever change ADMIN_PASSWORD, set DATA_KEY and LOG_KEY to the OLD password first.
 *   GITHUB_REPO      owner/repo, default "azzexxy/ChiActive"
 *   GITHUB_BRANCH    default "main"
 *   LOG_BRANCH       default "activity-log"
 *   DESIGNS_DIR      folder in the repo, default "designs"
 *   ALLOWED_ORIGINS  comma-separated sites allowed to upload (default: the GitHub Pages site + localhost)
 *   PAGES_URL        public site, default "https://azzexxy.github.io/ChiActive/"
 *   ANTHROPIC_API_KEY  optional: switches on the AI fixer (ai-fixer.js). It diagnoses real errors with Claude,
 *                    tests a fix against a copy of the server (test/selftest.js) and commits it to main.
 *                    The key is removed from process.env at start-up and never logged or shown.
 *   AI_MODEL         optional Claude model (default claude-sonnet-4-5); AI_MAX_PER_DAY (10), AI_MAX_DEPLOYS_PER_DAY (3)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Readable } = require('stream');
const blocksLib = require('./blocks');
const secretsLib = require('./secrets');

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPO || 'azzexxy/ChiActive';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const LOG_BRANCH = process.env.LOG_BRANCH || 'activity-log';
const DIR = (process.env.DESIGNS_DIR || 'designs').replace(/^\/+|\/+$/g, '');
const API = (process.env.GITHUB_API || 'https://api.github.com').replace(/\/+$/, '');
const RAW = (process.env.GITHUB_RAW || 'https://raw.githubusercontent.com').replace(/\/+$/, '');
const PAGES_URL = (process.env.PAGES_URL || 'https://azzexxy.github.io/ChiActive/').replace(/\/?$/, '/');
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://azzexxy.github.io,http://localhost:8000,http://127.0.0.1:8000').split(',').map(s => s.trim()).filter(Boolean);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const LOG_SECRET = process.env.LOG_KEY || ADMIN_PASSWORD;
const TMP = process.env.UPLOAD_TMP || path.join(os.tmpdir(), 'chiactive-uploads');

const MB = 1024 * 1024;
const MAX_FILE = 100 * MB;      // GitHub refuses single files over 100 MB (a hard GitHub rule)
const MAX_TOTAL = 1024 * MB;    // GitHub Pages publishes sites up to 1 GB
const MAX_FILES = 5000;
const CHUNK = 8 * MB;           // the browser sends files in pieces this big
const ALLOWED_EXT = new Set(['html', 'htm', 'css', 'js', 'mjs', 'json', 'map', 'txt', 'md', 'xml', 'csv', 'webmanifest',
  'svg', 'png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'avif', 'ico', 'bmp', 'apng', 'tif', 'tiff',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp4', 'm4v', 'mov', 'webm', 'mp3', 'm4a', 'aac', 'wav', 'ogg', 'pdf', 'glb', 'gltf']);
const TEXT_EXT = new Set(['html', 'htm', 'css', 'js', 'mjs', 'json', 'map', 'txt', 'md', 'xml', 'csv', 'svg', 'webmanifest']);
const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini|\.git|node_modules)(\/|$)|(^|\/)\._/i;
const MIME = { html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', map: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', xml: 'application/xml; charset=utf-8', csv: 'text/csv; charset=utf-8', webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp', apng: 'image/apng', tif: 'image/tiff', tiff: 'image/tiff',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', pdf: 'application/pdf', glb: 'model/gltf-binary', gltf: 'model/gltf+json' };

/* ---------- small helpers ---------- */
let fixer = null;   // the AI fixer (ai-fixer.js), started below
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtMB = n => n >= MB ? (n / MB).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const newId = () => crypto.randomBytes(6).toString('hex');
const extOf = p => (String(p).split('.').pop() || '').toLowerCase();
function userError(status, code, message) { const e = new Error(message); e.status = status; e.code = code; e.user = true; return e; }
function cors(origin) { return origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}; }
function send(res, status, body, origin, extra) {
  if (status >= 400 && body && body.error) res.caError = { error: body.error, code: body.code, ref: body.ref };
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origin), ...(extra || {}) });
  res.end(JSON.stringify(body));
}
function allowedOrigin(req) { const o = req.headers.origin; return o && ORIGINS.includes(o) ? o : null; }
function sameOrigin(req) {   // admin actions must come from the admin page itself
  const o = req.headers.origin; if (!o) return true;
  try { return new URL(o).host === String(req.headers['x-forwarded-host'] || req.headers.host); } catch (e) { return false; }
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0, over = false;
    req.on('data', d => { n += d.length; if (n > limit) over = true; else chunks.push(d); });
    req.on('end', () => over ? reject(userError(413, 'too-big', 'That request was too big.')) : resolve(Buffer.concat(chunks)));
    req.on('aborted', () => reject(userError(400, 'aborted', 'The connection dropped while sending.')));
    req.on('error', reject);
  });
}
async function readJson(req, limit = 2 * MB) {
  const buf = await readBody(req, limit);
  try { return JSON.parse(buf.toString('utf8') || '{}'); } catch (e) { throw userError(400, 'bad-json', 'The browser sent a request the server couldn’t read. Refresh the page and try again.'); }
}
function cleanName(s, n = 60) { return String(s || '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); }
function cleanText(s, n = 300) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }
function slugify(s) { return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50); }
function safePath(p) {
  p = String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!p || JUNK.test(p)) return null;
  const parts = p.split('/');
  if (parts.some(x => !x || x === '.' || x === '..' || x.startsWith('.'))) return null;
  if (!ALLOWED_EXT.has(extOf(p))) return null;
  return parts.join('/');
}
function limiter(max, windowMs) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k); }, windowMs).unref();
  return key => { const now = Date.now(), list = (hits.get(key) || []).filter(t => now - t < windowMs); if (list.length >= max) { hits.set(key, list); return true; } list.push(now); hits.set(key, list); return false; };
}
const uploadLimited = limiter(30, 3600e3);     // 30 uploads per hour per network
const eventLimited = limiter(400, 600e3);
const loginLimited = limiter(8, 900e3);
function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function ipTag(req) { return crypto.createHmac('sha256', 'ip:' + (LOG_SECRET || 'chiactive')).update(clientIp(req)).digest('hex').slice(0, 8); }
function device(ua) {
  ua = String(ua || '');
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const o = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'Chromebook' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'unknown device';
  return `${b} on ${o}`;
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
function mutex() { let last = Promise.resolve(); return fn => { const run = last.then(fn, fn); last = run.catch(() => {}); return run; }; }

/* ---------- GitHub ---------- */
class GitHubError extends Error {
  constructor(status, kind, ghMessage, what) { super(`GitHub ${what} failed (${status || kind}): ${ghMessage}`); this.status = status; this.kind = kind; this.ghMessage = ghMessage; }
}
// GitHub allows roughly 80 "create" requests a minute and 500 an hour; stay under both.
const writes = [];
async function pace(note) {
  for (;;) {
    const now = Date.now();
    while (writes.length && now - writes[0] > 3600e3) writes.shift();
    const inMinute = writes.filter(t => now - t < 60e3);
    if (inMinute.length < 70 && writes.length < 450) { writes.push(now); return; }
    const wait = inMinute.length >= 70 ? 60e3 - (now - inMinute[0]) + 100 : 3600e3 - (now - writes[0]) + 100;
    if (note) note(`GitHub only accepts a limited number of files per ${inMinute.length >= 70 ? 'minute' : 'hour'}, so saving pauses for about ${Math.ceil(wait / 60e3)} min and then continues by itself.`);
    await sleep(Math.min(Math.max(wait, 500), 60e3));
  }
}
async function gh(method, p, body, opts = {}) {
  const retries = opts.retries == null ? 5 : opts.retries;
  const what = `${method} ${p.split('?')[0]}`;
  for (let attempt = 0; ; attempt++) {
    if (method !== 'GET') await pace(opts.note);
    let r, text;
    try {
      r = await fetch(API + p, {
        method,
        headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'chiactive-upload-server',
          ...(body || opts.stream ? { 'Content-Type': 'application/json' } : {}), ...(opts.length ? { 'Content-Length': String(opts.length) } : {}) },
        body: opts.stream ? opts.stream() : body ? JSON.stringify(body) : undefined,
        duplex: opts.stream ? 'half' : undefined,
        signal: AbortSignal.timeout(opts.stream ? 15 * 60e3 : 120e3),
      });
      text = await r.text();
    } catch (e) {
      if (attempt < retries) { await sleep(1000 * 2 ** attempt); continue; }
      throw new GitHubError(0, 'network', (e.cause && e.cause.code) || e.name || e.message, what);
    }
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (r.ok) return data;
    const msg = (data && data.message) || String(text || '').slice(0, 200);
    const remaining = r.headers.get('x-ratelimit-remaining');
    const rate = (r.status === 403 || r.status === 429) && (/rate limit|abuse/i.test(msg) || !!r.headers.get('retry-after') || remaining === '0');
    if ((rate || r.status >= 500) && attempt < retries) {
      const ra = +r.headers.get('retry-after'), reset = +r.headers.get('x-ratelimit-reset');
      let wait = ra ? ra * 1000 : remaining === '0' && reset ? reset * 1000 - Date.now() + 1000 : (rate ? 60e3 : 1500 * 2 ** attempt);
      wait = Math.min(Math.max(wait, 1000), 10 * 60e3);
      if (opts.note && rate) opts.note(`GitHub asked us to slow down, so saving pauses for about ${Math.ceil(wait / 60e3)} min and then continues by itself.`);
      await sleep(wait); continue;
    }
    throw new GitHubError(r.status, rate ? 'rate' : 'http', msg, what);
  }
}
// Turns any error into one clear sentence for the student (and the admin log).
function explain(e) {
  if (!e) return 'Something went wrong on the upload server.';
  if (e.user) return e.message;
  if (e.code === 'ENOSPC') return 'The upload server ran out of disk space. Try again in a few minutes or with a smaller upload.';
  if (e instanceof GitHubError) {
    const said = e.ghMessage ? ` GitHub said: “${cleanText(e.ghMessage, 160)}”` : '';
    if (/secret detected|push protection|rule violation/i.test(e.ghMessage || '')) return 'GitHub blocked the save because a file contains something that looks like a secret key or password (for example an API key). Remove it from your files (a public website should never contain one), then upload again. If you think this is a mistake, tell the gallery admin.' + said;
    if (e.kind === 'network') return `The upload server couldn’t reach GitHub to save your design (${e.ghMessage}). Try again in a few minutes.`;
    if (e.status === 401) return 'The upload server’s GitHub key has expired or is wrong, so nothing can be saved right now. Tell the gallery admin: GITHUB_TOKEN needs renewing in Render.';
    if (e.kind === 'rate') return 'GitHub is limiting how fast files can be saved right now. Try again in 15 minutes.' + said;
    if (e.status === 403) return 'The upload server isn’t allowed to save to the GitHub repository. Tell the gallery admin: the token needs “Contents: Read and write”.' + said;
    if (e.status === 404) return `GitHub couldn’t find the repository ${REPO}, or the upload server’s key can’t see it. Tell the gallery admin.`;
    if (e.status === 413 || /too large|too big|exceeds/i.test(e.ghMessage)) return 'A file was too big for GitHub to accept.' + said;
    if (e.status === 409 || e.status === 422) return 'GitHub rejected the save because the repository changed at the same moment. Try again.' + said;
    if (e.status >= 500) return `GitHub is having problems right now (error ${e.status}). Try again in a few minutes.`;
    return `Saving to GitHub failed (error ${e.status}).` + said;
  }
  return 'Something went wrong on the upload server: ' + cleanText(e.message || String(e), 200);
}
// the code location of a real bug (not for user mistakes or GitHub problems); used by the admin log and the AI fixer
function stackOf(e) {
  if (!e || e.user || e instanceof GitHubError || !e.stack) return undefined;
  return String(e.stack).split('\n').filter(l => !/node:internal|node_modules/.test(l)).slice(0, 8).join('\n').split(__dirname + path.sep).join('');
}
async function pathExists(p, branch = BRANCH) {
  try { await gh('GET', `/repos/${REPO}/contents/${encodeURI(p)}?ref=${branch}`, null, { retries: 2 }); return true; }
  catch (e) { if (e.status === 404) return false; throw e; }
}
async function readManifest() {
  try {
    const f = await gh('GET', `/repos/${REPO}/contents/${DIR}/manifest.json?ref=${BRANCH}`, null, { retries: 2 });
    const list = JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'));
    return Array.isArray(list) ? list : [];
  } catch (e) { if (e.status === 404) return []; throw e; }
}
async function* base64Body(file, pre, post) {
  yield pre; let carry = Buffer.alloc(0);
  for await (const chunk of fs.createReadStream(file, { highWaterMark: 3 * 256 * 1024 })) {
    const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk;
    const cut = buf.length - (buf.length % 3);
    yield Buffer.from(buf.subarray(0, cut).toString('base64'));
    carry = Buffer.from(buf.subarray(cut));
  }
  if (carry.length) yield Buffer.from(carry.toString('base64'));
  yield post;
}
async function createBlob(f, note) {
  if (f.size <= 4 * MB) {
    const data = await fsp.readFile(f.file);
    return (await gh('POST', `/repos/${REPO}/git/blobs`, { content: data.toString('base64'), encoding: 'base64' }, { note })).sha;
  }
  // big files are streamed from disk so they never sit in memory
  const pre = Buffer.from('{"encoding":"base64","content":"'), post = Buffer.from('"}');
  const length = pre.length + 4 * Math.ceil(f.size / 3) + post.length;
  return (await gh('POST', `/repos/${REPO}/git/blobs`, null, { note, length, stream: () => Readable.from(base64Body(f.file, pre, post)) })).sha;
}
function isUtf8(buf) { try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch (e) { return false; } }
// one commit on main: extra tree entries + a changed manifest; retried if someone else saves at the same moment
async function commitToMain(message, treeEntries, changeManifest, note) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = await gh('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
    const head = await gh('GET', `/repos/${REPO}/git/commits/${ref.object.sha}`);
    const manifest = changeManifest((await readManifest()).filter(Boolean).map(d => ({ ...d })));
    const newTree = await gh('POST', `/repos/${REPO}/git/trees`, { base_tree: head.tree.sha, tree: treeEntries.concat([
      { path: `${DIR}/manifest.json`, mode: '100644', type: 'blob', content: JSON.stringify(manifest, null, 2) + '\n' }]) }, { note });
    const commit = await gh('POST', `/repos/${REPO}/git/commits`, { message, tree: newTree.sha, parents: [ref.object.sha] }, { note });
    try {
      await gh('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha }, { note, retries: 2 });
      manifestCache = { at: Date.now(), list: manifest };
      headCache = { at: Date.now(), sha: commit.sha };
      return commit.sha;
    } catch (e) { if (e.status !== 422 || attempt === 4) throw e; await sleep(400 * (attempt + 1)); }
  }
}

/* ---------- folders ---------- */
const reserved = new Set();
async function chooseFolder(student) {
  const base = 'website-design-' + (slugify(student) || 'student');
  let folder = base, n = 2;
  while (reserved.has(folder) || await pathExists(`${DIR}/${folder}`)) folder = `${base}-${n++}`;
  reserved.add(folder);
  return { folder, name: `Website design - ${student}` + (folder === base ? '' : ` (${folder.slice(base.length + 1)})`) };
}

/* ---------- uploads ---------- */
const uploads = new Map();   // id -> upload session
const live = new Map();      // folder -> upload session, for the instant preview

function plan(files) {
  if (!Array.isArray(files) || !files.length) throw userError(400, 'empty', 'No files were sent. Choose a .zip or a folder that contains your web pages.');
  let list = files.map((f, i) => ({ i, path: String((f && f.path) || '').replace(/\\/g, '/').replace(/^\/+/, ''), size: Math.max(0, +(f && f.size) || 0) })).filter(f => f.path && !JUNK.test(f.path));
  const tops = new Set(list.map(f => f.path.split('/')[0]));
  if (tops.size === 1 && list.every(f => f.path.includes('/'))) { const t = [...tops][0] + '/'; list = list.map(f => ({ ...f, path: f.path.slice(t.length) })); }
  const skipped = [], keep = [], seen = new Set();
  for (const f of list) { const p = safePath(f.path); if (!p || seen.has(p)) { skipped.push(f.path); continue; } seen.add(p); keep.push({ ...f, path: p }); }
  if (!keep.length) throw userError(400, 'no-usable-files', 'None of the files can be published (only web files like .html, .css, .js, images, fonts, audio and video are allowed). Upload the folder that contains your web pages.');
  if (keep.length > MAX_FILES) throw userError(400, 'too-many-files', `That design has ${keep.length} files. The gallery takes up to ${MAX_FILES} files per design. Leave out files your site doesn’t use.`);
  const big = keep.filter(f => f.size > MAX_FILE);
  if (big.length) throw userError(400, 'file-too-big', `${big.slice(0, 3).map(f => `“${f.path}” is ${fmtMB(f.size)}`).join(', ')}${big.length > 3 ? ` and ${big.length - 3} more` : ''}. GitHub doesn’t accept single files over 100 MB, so ${big.length === 1 ? 'that file' : 'those files'} can’t be published. Compress ${big.length === 1 ? 'it' : 'them'} (videos shrink a lot with HandBrake) or leave ${big.length === 1 ? 'it' : 'them'} out.`);
  const total = keep.reduce((s, f) => s + f.size, 0);
  if (total > MAX_TOTAL) throw userError(400, 'design-too-big', `That design is ${fmtMB(total)}. GitHub Pages can only publish sites up to 1 GB, so the gallery takes designs up to 1 GB. Compress large videos and images, then try again.`);
  const html = keep.filter(f => /\.html?$/i.test(f.path));
  if (!html.length) throw userError(400, 'no-html', 'No web page found. A design needs at least one .html file, ideally index.html.');
  const depth = p => p.split('/').length;
  const idx = html.filter(f => /(^|\/)index\.html?$/i.test(f.path)).sort((a, b) => depth(a.path) - depth(b.path));
  const entry = (idx[0] || html.slice().sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path))[0]).path;
  return { files: keep, skipped, total, entry };
}

async function saveToGitHub(s) {
  const note = n => { s.note = n; };
  s.stage = 'files'; s.done = 0;
  // GitHub refuses any save that contains a secret key (API key, token, private key), so blank those out first
  s.secrets = [];
  for (const f of s.files) {
    if (!TEXT_EXT.has(extOf(f.path)) || f.size > 5 * MB) continue;
    const buf = await fsp.readFile(f.file);
    if (!isUtf8(buf)) continue;
    const r = secretsLib.scrub(buf.toString('utf8'));
    if (!r.found.length) continue;
    await fsp.writeFile(f.file, r.text); f.size = Buffer.byteLength(r.text);
    r.found.forEach(x => s.secrets.push({ path: f.path, kind: x.kind, line: x.line }));
  }
  if (s.secrets.length) logEvent('upload-secrets', { ref: s.id, student: s.student, folder: s.folder,
    message: `Removed ${s.secrets.length} secret key${s.secrets.length === 1 ? '' : 's'} before saving: ` + s.secrets.slice(0, 8).map(x => `${x.kind} in ${x.path} line ${x.line}`).join('; ') }, null, s.who);
  const inline = [], blobs = []; let inlineBytes = 0;
  for (const f of s.files) {
    if (TEXT_EXT.has(extOf(f.path)) && f.size <= MB && inlineBytes + f.size <= 8 * MB) {
      const buf = await fsp.readFile(f.file);
      if (isUtf8(buf)) { inline.push({ path: f.path, content: buf.toString('utf8') }); inlineBytes += f.size; continue; }
    }
    blobs.push(f);
  }
  s.steps = blobs.length + 1;                     // every image/media file, plus the final commit
  const shas = new Map(), oneBig = mutex();
  await pool(blobs, 3, async f => {
    const sha = f.size > 8 * MB ? await oneBig(() => createBlob(f, note)) : await createBlob(f, note);
    shas.set(f.path, sha); s.done++; s.note = '';
  });
  s.stage = 'commit';
  const tree = inline.map(x => ({ path: x.path, mode: '100644', type: 'blob', content: x.content }))
    .concat(blobs.map(f => ({ path: f.path, mode: '100644', type: 'blob', sha: shas.get(f.path) })));
  const designTree = await gh('POST', `/repos/${REPO}/git/trees`, { tree }, { note });
  s.commit = await commitToMain(`Add ${s.name}`, [{ path: `${DIR}/${s.folder}`, mode: '040000', type: 'tree', sha: designTree.sha }], list => {
    list = list.filter(d => d.folder !== s.folder);
    list.push({ folder: s.folder, name: s.name, by: s.student, owner: s.owner, entry: s.entry, uploadedAt: new Date().toISOString() });
    return list;
  }, note);
  s.done++;
}

function publicStatus(s) {
  return { ok: true, id: s.id, ref: s.id, status: s.status, stage: s.stage, done: s.done || 0, steps: s.steps || 0, note: s.note || '',
    error: s.error || '', secrets: (s.secrets || []).slice(0, 20), folder: s.folder, name: s.name, entry: s.entry, commit: s.commit || '',
    url: `${PAGES_URL}${DIR}/${s.folder}/${s.entry.split('/').map(encodeURIComponent).join('/')}` };
}
function dropUpload(s, keepPreviewMs) {
  const rm = () => { uploads.delete(s.id); if (live.get(s.folder) === s) live.delete(s.folder); fsp.rm(s.dir, { recursive: true, force: true }).catch(() => {}); };
  reserved.delete(s.folder);
  if (keepPreviewMs) setTimeout(rm, keepPreviewMs).unref(); else rm();
}
// sweep: forget uploads that were started but never finished
setInterval(() => {
  const now = Date.now();
  for (const s of uploads.values()) {
    if (s.status === 'receiving' && now - s.lastActive > 60 * 60e3) {
      logEvent('upload-abandoned', { ref: s.id, student: s.student, visitor: s.visitor, folder: s.folder, files: s.files.length, size: s.total,
        received: s.files.reduce((n, f) => n + f.got, 0), message: 'Started uploading but never finished (tab closed or connection lost).' }, null, s.who);
      dropUpload(s);
    }
  }
}, 5 * 60e3).unref();

async function handleStart(req, res, origin, user) {
  const who = { ip: ipTag(req), device: device(req.headers['user-agent']) };
  let body = {};
  try {
    if (!TOKEN) throw userError(503, 'no-token', 'The upload server isn’t connected to GitHub yet (GITHUB_TOKEN is missing in Render). Tell the gallery admin.');
    body = await readJson(req);
    let owner = user.isAdmin ? undefined : user.id;
    const student = cleanName(user.isAdmin ? (body.name || 'Admin') : user.name);
    if (user.isAdmin && body.owner) {
      const acc = (await loadAccounts()).find(a => a.id === String(body.owner));
      if (!acc) throw userError(400, 'no-account', 'That student account doesn’t exist anymore. Pick another owner.');
      owner = acc.id;
    }
    if (student.length < 2) throw userError(400, 'no-name', 'Enter your student name. It becomes the design name.');
    if (uploadLimited(clientIp(req))) throw userError(429, 'rate-limited', 'Too many uploads from your network in the last hour (the limit is 30). Try again later.');
    const p = plan(body.files);
    const { folder, name } = await chooseFolder(student);   // also checks the GitHub connection before anything is sent
    const id = newId(), dir = path.join(TMP, id);
    await fsp.mkdir(dir, { recursive: true });
    const s = { id, dir, student, owner, actor: user.id, username: user.username, visitor: cleanText(body.visitor, 20), folder, name, entry: p.entry, total: p.total, skipped: p.skipped,
      files: p.files.map((f, k) => ({ i: f.i, path: f.path, size: f.size, got: 0, file: path.join(dir, String(k)) })),
      status: 'receiving', created: Date.now(), lastActive: Date.now(), who };
    await Promise.all(s.files.map(f => fsp.writeFile(f.file, '')));
    uploads.set(id, s);
    logEvent('upload-start', { ref: id, student, username: user.username, visitor: s.visitor, folder, files: s.files.length, size: s.total, skipped: p.skipped.length || undefined }, req);
    return send(res, 200, { ok: true, id, ref: id, folder, name, entry: p.entry, chunk: CHUNK, files: s.files.map(f => f.i), skipped: p.skipped.slice(0, 50) }, origin);
  } catch (e) {
    const msg = explain(e), ref = newId();
    logEvent(e.user ? 'upload-rejected' : 'upload-failed', { ref, stage: 'check', student: cleanName(body.student), visitor: cleanText(body.visitor, 20),
      files: Array.isArray(body.files) ? body.files.length : undefined, size: Array.isArray(body.files) ? body.files.reduce((n, f) => n + (+(f && f.size) || 0), 0) : undefined,
      error: msg, detail: e.user ? undefined : cleanText(e.message, 300) }, req, who);
    if (!e.user) console.error(e);
    return send(res, e.user && e.status ? e.status : 502, { ok: false, error: msg, code: e.code || 'github', ref }, origin);
  }
}

async function handleChunk(req, res, origin, url, user) {
  let s = uploads.get(url.searchParams.get('id') || '');
  if (s && s.actor !== user.id) s = null;
  if (!s) { req.resume(); return send(res, 404, { ok: false, code: 'expired', error: 'This upload was lost because the upload server restarted or it took over an hour. Please upload again.' }, origin); }
  if (s.status !== 'receiving') { req.resume(); return send(res, 409, { ok: false, code: 'finished', error: 'This upload is already being saved.' }, origin); }
  const f = s.files[+url.searchParams.get('k')], o = +url.searchParams.get('o');
  if (!f || !(o >= 0)) { req.resume(); return send(res, 400, { ok: false, code: 'bad-chunk', error: 'The browser sent a piece of a file the server didn’t expect. Refresh the page and try again.' }, origin); }
  let buf;
  try { buf = await readBody(req, CHUNK + 1024); }
  catch (e) { return send(res, 400, { ok: false, code: e.code || 'aborted', error: 'The connection dropped while sending part of “' + f.path + '”.' }, origin); }
  if (o > f.got) return send(res, 409, { ok: false, code: 'gap', got: f.got, error: 'A piece was missing; resending.' }, origin);
  if (o + buf.length > f.size) return send(res, 400, { ok: false, code: 'too-long', error: `“${f.path}” changed while it was being uploaded. Upload it again.` }, origin);
  try {
    const fh = await fsp.open(f.file, 'r+');
    try { await fh.write(buf, 0, buf.length, o); } finally { await fh.close(); }
  } catch (e) {
    const msg = explain(e);
    logEvent('upload-failed', { ref: s.id, stage: 'receive', student: s.student, visitor: s.visitor, folder: s.folder, error: msg, detail: cleanText(e.message, 200), stack: stackOf(e) }, req);
    return send(res, 507, { ok: false, code: e.code || 'disk', error: msg, ref: s.id }, origin);
  }
  f.got = Math.max(f.got, o + buf.length); s.lastActive = Date.now();
  return send(res, 200, { ok: true, got: f.got }, origin);
}

async function handleFinish(req, res, origin, user) {
  let body;
  try { body = await readJson(req, 64 * 1024); } catch (e) { return send(res, 400, { ok: false, error: e.message }, origin); }
  const s0 = uploads.get(String(body.id || ''));
  const s = s0 && s0.actor === user.id ? s0 : null;
  if (!s) return send(res, 404, { ok: false, code: 'expired', error: 'This upload was lost because the upload server restarted. Please upload again.' }, origin);
  if (s.status !== 'receiving') return send(res, 200, publicStatus(s), origin);
  const missing = s.files.filter(f => f.got !== f.size);
  if (missing.length) return send(res, 400, { ok: false, code: 'incomplete', ref: s.id, error: `${missing.length} file${missing.length === 1 ? '' : 's'} didn’t arrive completely (for example “${missing[0].path}”). Try again.` }, origin);
  s.status = 'saving'; s.stage = 'files'; s.savingSince = Date.now();
  live.set(s.folder, s);   // the instant preview works from this moment
  logEvent('upload-received', { ref: s.id, student: s.student, visitor: s.visitor, folder: s.folder, files: s.files.length, size: s.total, seconds: Math.round((Date.now() - s.created) / 1000) }, req);
  send(res, 202, publicStatus(s), origin);
  try {
    await saveToGitHub(s);
    s.status = 'done'; s.stage = 'done'; s.note = '';
    logEvent('upload-saved', { ref: s.id, student: s.student, visitor: s.visitor, folder: s.folder, name: s.name, files: s.files.length, size: s.total,
      seconds: Math.round((Date.now() - s.created) / 1000), commit: s.commit.slice(0, 7) }, null, s.who);
    dropUpload(s, 30 * 60e3);
  } catch (e) {
    console.error(e);
    s.status = 'failed'; s.error = explain(e);
    logEvent('upload-failed', { ref: s.id, stage: s.stage === 'commit' ? 'commit' : 'saving files', student: s.student, visitor: s.visitor, folder: s.folder,
      files: s.files.length, size: s.total, saved: s.done, error: s.error, detail: cleanText(e.message, 300), stack: stackOf(e) }, null, s.who);
    if (live.get(s.folder) === s) live.delete(s.folder);
    reserved.delete(s.folder);
    setTimeout(() => dropUpload(s), 10 * 60e3).unref();   // keep the status for the browser a little longer
  }
}

/* ---------- instant preview (/d/<folder>/<path>) ---------- */
let manifestCache = { at: 0, list: [] };
let headCache = { at: 0, sha: '' };
async function headSha() {   // raw.githubusercontent caches branch names for minutes; commit ids are always fresh
  if (headCache.sha && Date.now() - headCache.at < 10e3) return headCache.sha;
  try { const r = await gh('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`, null, { retries: 1 }); headCache = { at: Date.now(), sha: r.object.sha }; } catch (e) { /* keep the old one */ }
  return headCache.sha || BRANCH;
}
async function freshManifest(maxAge) {
  if (Date.now() - manifestCache.at > maxAge) { try { manifestCache = { at: Date.now(), list: await readManifest() }; } catch (e) { /* keep the old copy */ } }
  return manifestCache.list;
}
async function servePreview(req, res, url) {
  const parts = url.pathname.slice(3).split('/').map(x => { try { return decodeURIComponent(x); } catch (e) { return '\u0000'; } });
  const folder = parts.shift();
  const notFound = () => { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(`<!doctype html><title>Not found</title><p style="font:16px system-ui;padding:40px">This page isn’t part of the design. <a href="${PAGES_URL}">Back to the class gallery</a></p>`); };
  if (!folder || !/^[a-z0-9-]+$/.test(folder)) return notFound();
  const s = live.get(folder);
  let entry = s ? s.entry : null;
  if (!entry) { const d = (await freshManifest(30e3)).find(x => x && x.folder === folder); entry = (d && d.entry) || 'index.html'; }
  let p = parts.join('/');
  if (!p) { res.writeHead(302, { Location: `/d/${folder}/${entry.split('/').map(encodeURIComponent).join('/')}` }); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  if (!safePath(p)) return notFound();
  const type = MIME[extOf(p)] || 'application/octet-stream';
  const head = { 'Content-Type': type, 'Cache-Control': 'public, max-age=60', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin',
    // student code runs in a sandbox (its own blank origin), so it can't use this server's logins
    'Content-Security-Policy': 'sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox' };
  const local = s && s.files.find(f => f.path === p);
  if (local) { res.writeHead(200, { ...head, 'Content-Length': local.size }); return req.method === 'HEAD' ? res.end() : fs.createReadStream(local.file).pipe(res); }
  try {
    const buf = await repoFile(folder, p);
    if (!buf) return notFound();
    res.writeHead(200, { ...head, 'Content-Length': buf.length });
    return res.end(req.method === 'HEAD' ? undefined : buf);
  } catch (e) { return notFound(); }
}

// A design file at the newest commit: the public raw address first (fast, no rate limit),
// then the GitHub API (works even if the raw address is slow to update or refuses the request).
async function repoFile(folder, p) {
  const sha = await headSha();
  const enc = `${DIR}/${folder}/${p}`.split('/').map(encodeURIComponent).join('/');
  try {
    const r = await fetch(`${RAW}/${REPO}/${sha}/${enc}`, { signal: AbortSignal.timeout(20e3) });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (r.status !== 404) console.error(`raw ${r.status} for ${folder}/${p}`);
  } catch (e) { console.error('raw fetch failed:', e.message); }
  if (!TOKEN) return null;
  try {
    const r = await fetch(`${API}/repos/${REPO}/contents/${enc}?ref=${sha}`, { headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github.raw', 'User-Agent': 'chiactive-upload-server', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30e3) });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
  } catch (e) { console.error('API raw fetch failed:', e.message); }
  return null;
}

/* ---------- activity log ---------- */
const LOG_KEY = LOG_SECRET ? crypto.scryptSync(LOG_SECRET, 'chiactive-activity-log', 32) : null;
const logState = { buffer: [], recent: [], timer: null, timerAt: 0, chain: Promise.resolve(), persist: !!(TOKEN && LOG_KEY), lastError: '', parts: {} };
function logEvent(type, data, req, who) {
  const e = { id: newId(), t: new Date().toISOString(), type };
  for (const [k, v] of Object.entries(data || {})) if (v !== undefined && v !== null && v !== '') e[k] = typeof v === 'string' ? cleanText(v, k === 'stack' ? 1500 : 500) : v;
  if (req) { e.ip = ipTag(req); e.device = device(req.headers['user-agent']); } else if (who) { e.ip = who.ip; e.device = who.device; }
  console.log('[event] ' + JSON.stringify(e));
  logState.recent.push(e); if (logState.recent.length > 6000) logState.recent.splice(0, 1000);
  if (logState.persist) { logState.buffer.push(e); scheduleFlush(/^(upload|admin|server|ai)/.test(type) ? 5e3 : 60e3); }
  if (fixer) try { fixer.onEvent(e); } catch (x) { console.error('AI fixer:', x); }
  return e;
}
function scheduleFlush(ms) {
  if (logState.timer && logState.timerAt <= Date.now() + ms) return;
  clearTimeout(logState.timer); logState.timerAt = Date.now() + ms;
  logState.timer = setTimeout(() => { logState.timer = null; flushLogs(); }, ms);
}
function flushLogs() {
  logState.chain = logState.chain.then(async () => {
    const batch = logState.buffer.splice(0);
    if (!batch.length) return;
    try {
      const byDay = {};
      batch.forEach(e => { (byDay[e.t.slice(0, 10)] = byDay[e.t.slice(0, 10)] || []).push(e); });
      for (const day of Object.keys(byDay)) await appendLog(day, encrypt(byDay[day]));
      logState.lastError = '';
    } catch (e) {
      logState.buffer.unshift(...batch); logState.lastError = explain(e);
      console.error('Saving the activity log failed:', e.message);
      scheduleFlush(5 * 60e3);
    }
  });
  return logState.chain;
}
function encrypt(obj, key = LOG_KEY) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return 'v1.' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function decrypt(line, key = LOG_KEY, any = false) {
  try {
    const raw = Buffer.from(line.trim().replace(/^v1\./, ''), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const v = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
    return any || Array.isArray(v) ? v : null;
  } catch (e) { return null; }
}
let logBranchReady = null;
function ensureLogBranch() {
  if (!logBranchReady) logBranchReady = (async () => {
    try { await gh('GET', `/repos/${REPO}/git/ref/heads/${LOG_BRANCH}`, null, { retries: 2 }); return; } catch (e) { if (e.status !== 404) throw e; }
    const tree = await gh('POST', `/repos/${REPO}/git/trees`, { tree: [{ path: 'README.md', mode: '100644', type: 'blob',
      content: '# ChiActive activity log\n\nEncrypted activity log for the class gallery admin page (uploads, errors, views, admin actions).\nThe files can only be read with the admin key. Open the admin page on the upload server to see them.\nGitHub Pages only publishes the main branch, so this branch is never part of the website.\n' }] });
    const c = await gh('POST', `/repos/${REPO}/git/commits`, { message: 'Start the activity log', tree: tree.sha, parents: [] });
    await gh('POST', `/repos/${REPO}/git/refs`, { ref: `refs/heads/${LOG_BRANCH}`, sha: c.sha });
  })().catch(e => { logBranchReady = null; throw e; });
  return logBranchReady;
}
async function appendLog(day, line) {
  await ensureLogBranch();
  let part = logState.parts[day] || 1;
  for (let attempt = 0; attempt < 8; attempt++) {
    const p = `logs/${day}${part > 1 ? '.' + part : ''}.log`;
    let cur = null;
    try { cur = await gh('GET', `/repos/${REPO}/contents/${p}?ref=${LOG_BRANCH}`, null, { retries: 2 }); } catch (e) { if (e.status !== 404) throw e; }
    if (cur && cur.size > 700 * 1024) { part++; continue; }   // start a new part before GitHub's 1 MB read limit
    const old = cur && cur.content ? Buffer.from(cur.content, 'base64').toString('utf8') : '';
    try {
      await gh('PUT', `/repos/${REPO}/contents/${p}`, { message: `Activity log ${day}`, branch: LOG_BRANCH, content: Buffer.from(old + line + '\n').toString('base64'), ...(cur ? { sha: cur.sha } : {}) }, { retries: 2 });
      logState.parts[day] = part; return;
    } catch (e) { if (e.status !== 409 && e.status !== 422) throw e; await sleep(300); }
  }
  throw new Error('Could not append to the activity log.');
}
const logFileCache = new Map();
async function loadLogs(days) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const out = { events: [], unreadable: 0, persisted: logState.persist, error: '', pending: logState.buffer.length, saveError: logState.lastError };
  if (logState.persist) {
    try {
      let list = [];
      try { list = await gh('GET', `/repos/${REPO}/contents/logs?ref=${LOG_BRANCH}`, null, { retries: 2 }); } catch (e) { if (e.status !== 404) throw e; }
      const files = (Array.isArray(list) ? list : []).filter(f => f.type === 'file' && /^\d{4}-\d{2}-\d{2}(\.\d+)?\.log$/.test(f.name) && f.name.slice(0, 10) >= since);
      await pool(files, 4, async f => {
        let c = logFileCache.get(f.path);
        if (!c || c.sha !== f.sha) {
          const full = await gh('GET', `/repos/${REPO}/contents/${f.path}?ref=${LOG_BRANCH}`, null, { retries: 2 });
          const events = []; let bad = 0;
          for (const line of Buffer.from(full.content || '', 'base64').toString('utf8').split('\n')) { if (!line.trim()) continue; const v = decrypt(line); if (v) events.push(...v); else bad++; }
          c = { sha: f.sha, events, bad }; logFileCache.set(f.path, c);
        }
        out.events.push(...c.events); out.unreadable += c.bad;
      });
    } catch (e) { out.error = explain(e); }
  }
  const seen = new Set(out.events.map(e => e.id));
  for (const e of logState.recent) if (!seen.has(e.id) && e.t.slice(0, 10) >= since) out.events.push(e);
  out.events.sort((a, b) => b.t.localeCompare(a.t));
  return out;
}

/* ---------- admin ---------- */
const SESSION_KEY = ADMIN_PASSWORD ? crypto.createHash('sha256').update('session:' + ADMIN_PASSWORD).digest() : null;
const hmac = (k, v) => crypto.createHmac('sha256', k).update(v).digest('hex');
function cookies(req) { const out = {}; String(req.headers.cookie || '').split(';').forEach(c => { const i = c.indexOf('='); if (i > 0) { try { out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); } catch (e) { /* ignore */ } } }); return out; }
// admin in the Studio, unless they switched to viewing it as a student
function studioAdmin(req) { return isAdmin(req) && cookies(req).ca_as !== '1'; }
function isAdmin(req) {
  if (!SESSION_KEY) return false;
  const [exp, sig] = String(cookies(req).ca_admin || '').split('.');
  if (!exp || !sig || +exp < Date.now()) return false;
  const good = hmac(SESSION_KEY, exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
function passwordOk(p) {
  if (!ADMIN_PASSWORD) return false;
  const a = crypto.createHash('sha256').update(String(p || '')).digest(), b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}
function sessionCookie(req, value, maxAge) {
  const secure = String(req.headers['x-forwarded-proto'] || '').startsWith('https') ? '; Secure' : '';
  return `ca_admin=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
let adminHtml = null;
function adminPage(res) {
  if (!adminHtml) adminHtml = fs.readFileSync(path.join(__dirname, 'admin.html'));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
  res.end(adminHtml);
}
async function adminDesigns() {
  const manifest = await freshManifest(0);
  let dirs = [];
  try { dirs = (await gh('GET', `/repos/${REPO}/contents/${DIR}?ref=${BRANCH}`, null, { retries: 2 })).filter(i => i.type === 'dir').map(i => i.name); } catch (e) { if (e.status !== 404) throw e; }
  let accounts = []; try { accounts = await loadAccounts(); } catch (e) { /* accounts not set up yet */ }
  const ownerName = id => { const a = accounts.find(x => x.id === id); return a ? `${a.name} (@${a.username})` : id ? 'deleted account' : ''; };
  const list = manifest.filter(d => d && d.folder).map(d => ({ ...d, ownerName: ownerName(d.owner), missing: !dirs.includes(d.folder) }));
  dirs.filter(f => !list.some(d => d.folder === f)).forEach(f => list.push({ folder: f, name: f, by: '', entry: 'index.html', unlisted: true }));
  return list.sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
}
async function adminRename(req, body) {
  const folder = String(body.folder || ''), name = cleanName(body.name, 90), by = cleanName(body.by);
  if (!/^[a-z0-9-]+$/.test(folder)) throw userError(400, 'bad-folder', 'That design folder isn’t valid.');
  if (name.length < 2) throw userError(400, 'bad-name', 'Enter a design name (at least 2 characters).');
  if (by.length < 2) throw userError(400, 'bad-name', 'Enter the student name (at least 2 characters).');
  let before = null;
  await commitToMain(`Rename ${folder} to “${name}”`, [], list => {
    let d = list.find(x => x.folder === folder);
    if (!d) { d = { folder, entry: String(body.entry || 'index.html'), uploadedAt: new Date().toISOString() }; list.push(d); }
    before = { name: d.name, by: d.by };
    d.name = name; d.by = by;
    return list;
  });
  const s = live.get(folder); if (s) { s.name = name; s.student = by; }
  logEvent('admin-rename', { folder, name, student: by, message: before && before.name ? `Was “${before.name}” by ${before.by || '?'}` : '' }, req);
}
async function adminDelete(req, body) {
  const folder = String(body.folder || '');
  if (!/^[a-z0-9-]+$/.test(folder)) throw userError(400, 'bad-folder', 'That design folder isn’t valid.');
  const exists = await pathExists(`${DIR}/${folder}`);
  let gone = null;
  await commitToMain(`Delete ${folder}`, exists ? [{ path: `${DIR}/${folder}`, mode: '040000', type: 'tree', sha: null }] : [], list => {
    gone = list.find(x => x.folder === folder) || null;
    if (!gone && !exists) throw userError(404, 'not-found', 'That design doesn’t exist anymore.');
    return list.filter(x => x.folder !== folder);
  });
  live.delete(folder);
  logEvent('admin-delete', { folder, name: gone && gone.name, student: gone && gone.by }, req);
}

const EVENT_TYPES = new Set(['visit', 'view', 'page', 'client-error']);

/* ---------- student accounts ---------- */
const DATA_SECRET = process.env.DATA_KEY || process.env.LOG_KEY || ADMIN_PASSWORD;
const DATA_KEY = DATA_SECRET ? crypto.scryptSync(DATA_SECRET, 'chiactive-accounts', 32) : null;
const USER_KEY = DATA_SECRET ? crypto.createHash('sha256').update('user-session:' + DATA_SECRET).digest() : null;
const ACCOUNTS_PATH = 'accounts/accounts.enc';
const acct = { list: null, sha: null, loading: null, lock: mutex() };
const signupLimited = limiter(10, 3600e3), accountLoginLimited = limiter(10, 900e3), userLoginLimited = limiter(10, 900e3), editLimited = limiter(240, 600e3);
function scryptAsync(pw, salt) { return new Promise((ok, no) => crypto.scrypt(String(pw), salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => e ? no(e) : ok(k))); }
async function loadAccounts() {
  if (acct.list) return acct.list;
  if (!acct.loading) acct.loading = (async () => {
    if (!DATA_KEY) throw userError(503, 'no-key', 'Student accounts aren’t switched on yet: the gallery admin needs to set ADMIN_PASSWORD in Render.');
    if (!TOKEN) throw userError(503, 'no-token', 'The upload server isn’t connected to GitHub yet. Tell the gallery admin.');
    let f = null;
    try { f = await gh('GET', `/repos/${REPO}/contents/${ACCOUNTS_PATH}?ref=${LOG_BRANCH}`, null, { retries: 2 }); } catch (e) { if (e.status !== 404) throw e; }
    if (!f) { acct.sha = null; acct.list = []; return acct.list; }
    const data = decrypt(Buffer.from(f.content || '', 'base64').toString('utf8'), DATA_KEY, true);
    if (!data || !Array.isArray(data.accounts)) throw userError(503, 'locked', 'Student accounts are locked because the admin key changed. Admin: set DATA_KEY in Render to the previous ADMIN_PASSWORD.');
    acct.sha = f.sha; acct.list = data.accounts; return acct.list;
  })().finally(() => { acct.loading = null; });
  return acct.loading;
}
function changeAccounts(fn) {   // one change at a time; saved to GitHub before it counts
  return acct.lock(async () => {
    const list = JSON.parse(JSON.stringify(await loadAccounts()));
    const result = await fn(list);
    await ensureLogBranch();
    const body = { message: 'Update student accounts', branch: LOG_BRANCH, content: Buffer.from(encrypt({ v: 1, accounts: list }, DATA_KEY)).toString('base64') };
    for (let attempt = 0; ; attempt++) {
      try { const r = await gh('PUT', `/repos/${REPO}/contents/${ACCOUNTS_PATH}`, { ...body, ...(acct.sha ? { sha: acct.sha } : {}) }, { retries: 2 }); acct.sha = r.content.sha; break; }
      catch (e) {
        if ((e.status !== 409 && e.status !== 422) || attempt > 2) throw e;
        try { acct.sha = (await gh('GET', `/repos/${REPO}/contents/${ACCOUNTS_PATH}?ref=${LOG_BRANCH}`, null, { retries: 1 })).sha; } catch (x) { if (x.status === 404) acct.sha = null; else throw x; }
      }
    }
    acct.list = list;
    return result;
  });
}
function viewAsCookie(req, on) {
  const secure = String(req.headers['x-forwarded-proto'] || '').startsWith('https') ? '; Secure' : '';
  return `ca_as=${on ? '1' : ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${on ? 12 * 3600 : 0}${secure}`;
}
function userCookie(req, a, maxAge = 30 * 86400) {
  const secure = String(req.headers['x-forwarded-proto'] || '').startsWith('https') ? '; Secure' : '';
  if (!a) return `ca_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  const exp = String(Date.now() + maxAge * 1000), body = `${a.id}.${a.pwv || 0}.${exp}`;
  return `ca_user=${body}.${hmac(USER_KEY, body)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
async function currentUser(req) {
  if (!USER_KEY) return null;
  const parts = String(cookies(req).ca_user || '').split('.');
  if (parts.length !== 4 || +parts[2] < Date.now()) return null;
  const body = parts.slice(0, 3).join('.'), good = hmac(USER_KEY, body);
  if (parts[3].length !== good.length || !crypto.timingSafeEqual(Buffer.from(parts[3]), Buffer.from(good))) return null;
  const a = (await loadAccounts()).find(x => x.id === parts[0]);
  return a && String(a.pwv || 0) === parts[1] ? a : null;
}
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,23}$/;
function checkPassword(pw, username) {
  pw = String(pw || '');
  if (pw.length < 8) throw userError(400, 'weak', 'Use a password of at least 8 characters.');
  if (pw.length > 200) throw userError(400, 'weak', 'That password is too long.');
  if (pw.toLowerCase() === String(username || '').toLowerCase()) throw userError(400, 'weak', 'Your password can’t be your username.');
  if (/^(.)\1+$/.test(pw) || /^(12345678|password|qwertyui|abcdefgh)/i.test(pw)) throw userError(400, 'weak', 'That password is too easy to guess. Try three random words.');
  return pw;
}
async function myDesigns(user, admin) {
  const list = (await freshManifest(3e3)).filter(d => d && d.folder && (admin || (user && d.owner === user.id)));
  for (const s of live.values()) if ((admin || (user && s.owner === user.id)) && !list.some(d => d.folder === s.folder)) list.push({ folder: s.folder, name: s.name, by: s.student, owner: s.owner, entry: s.entry, uploadedAt: new Date(s.created).toISOString(), saving: s.status !== 'done' });
  return list.sort((a, b) => String(b.editedAt || b.uploadedAt || '').localeCompare(String(a.editedAt || a.uploadedAt || '')));
}
async function handleAccount(req, res, route) {
  const who = { ip: ipTag(req), device: device(req.headers['user-agent']) };
  if (req.method === 'POST' && !sameOrigin(req)) { req.resume(); return send(res, 403, { ok: false, error: 'Accounts only work from ChiActive Studio.' }); }
  try {
    if (req.method === 'GET' && route === '/api/account/me') {
      const admin = studioAdmin(req), viewingAs = isAdmin(req) && !admin;
      let user = null, error = '';
      try { user = await currentUser(req); } catch (e) { error = explain(e); }
      if (!DATA_KEY) error = 'Student accounts aren’t switched on yet: the gallery admin needs to set ADMIN_PASSWORD in Render. Try again later.';
      let accounts = [];
      if (admin) { try { accounts = (await loadAccounts()).map(a => ({ id: a.id, username: a.username, name: a.name })); } catch (e) { /* not set up */ } }
      return send(res, 200, { ok: true, admin, viewingAs, accounts, error, pages: PAGES_URL, user: user && { id: user.id, username: user.username, name: user.name, created: user.created },
        designs: user || admin ? await myDesigns(admin ? null : user, admin) : [] });
    }
    if (req.method !== 'POST') return send(res, 404, { ok: false, error: 'Not found' });
    const body = await readJson(req, 16 * 1024);
    if (route === '/api/account/logout') return send(res, 200, { ok: true }, null, { 'Set-Cookie': [userCookie(req, null), viewAsCookie(req, false)] });
    if (route === '/api/account/signup') {
      if (signupLimited(clientIp(req))) throw userError(429, 'rate-limited', 'Too many new accounts from your network in the last hour. Try again later.');
      const username = String(body.username || '').trim().toLowerCase(), name = cleanName(body.name);
      if (!USERNAME_RE.test(username)) throw userError(400, 'bad-username', 'Pick a username of 3 to 24 characters: letters, numbers, dots, dashes or underscores.');
      if (name.length < 2) throw userError(400, 'bad-name', 'Enter your name (at least 2 characters). It’s shown on your design.');
      const pw = checkPassword(body.password, username);
      const salt = crypto.randomBytes(16).toString('hex'), hash = (await scryptAsync(pw, salt)).toString('hex');
      const a = await changeAccounts(list => {
        if (list.some(x => x.username === username)) throw userError(409, 'taken', `The username “${username}” is taken. Pick another one.`);
        const a = { id: newId(), username, name, salt, hash, pwv: 0, created: new Date().toISOString() };
        list.push(a); return a;
      });
      logEvent('account-signup', { username, student: name }, req);
      return send(res, 200, { ok: true, user: { username, name } }, null, { 'Set-Cookie': userCookie(req, a) });
    }
    if (route === '/api/account/login') {
      const username = String(body.username || '').trim().toLowerCase();
      if (accountLoginLimited(clientIp(req)) || userLoginLimited(username)) throw userError(429, 'rate-limited', 'Too many login attempts. Wait 15 minutes and try again.');
      const a = (await loadAccounts()).find(x => x.username === username);
      const hash = await scryptAsync(String(body.password || ''), a ? a.salt : 'no-such-user-salt');
      if (!a || !crypto.timingSafeEqual(hash, Buffer.from(a.hash, 'hex'))) {
        logEvent('account-login-failed', { username: cleanText(username, 40) }, req); await sleep(400);
        throw userError(401, 'bad-login', 'That username and password don’t match. Check them and try again.');
      }
      logEvent('account-login', { username, student: a.name }, req);
      return send(res, 200, { ok: true, user: { username: a.username, name: a.name } }, null, { 'Set-Cookie': userCookie(req, a) });
    }
    if (route === '/api/account/password') {
      const me = await currentUser(req);
      if (!me) throw userError(401, 'login', 'Log in first.');
      const cur = await scryptAsync(String(body.current || ''), me.salt);
      if (!crypto.timingSafeEqual(cur, Buffer.from(me.hash, 'hex'))) throw userError(401, 'bad-login', 'Your current password isn’t right.');
      const pw = checkPassword(body.next, me.username);
      const salt = crypto.randomBytes(16).toString('hex'), hash = (await scryptAsync(pw, salt)).toString('hex');
      const a = await changeAccounts(list => { const x = list.find(y => y.id === me.id); x.salt = salt; x.hash = hash; x.pwv = (x.pwv || 0) + 1; return x; });
      logEvent('account-password', { username: me.username, student: me.name }, req);
      return send(res, 200, { ok: true }, null, { 'Set-Cookie': userCookie(req, a) });
    }
    return send(res, 404, { ok: false, error: 'Not found' });
  } catch (e) {
    if (!e.user) { console.error(e); logEvent('account-error', { stage: route.split('/').pop(), error: explain(e), detail: cleanText(e.message, 300), stack: stackOf(e) }, null, who); }
    return send(res, e.user && e.status ? e.status : 502, { ok: false, code: e.code, error: explain(e) });
  }
}

/* ---------- Studio editor: edit / delete text blocks right on the page ---------- */
const editLocks = new Map();
function folderLock(folder) { if (!editLocks.has(folder)) editLocks.set(folder, mutex()); return editLocks.get(folder); }
const sha1 = s => crypto.createHash('sha1').update(s).digest('hex');
async function canEdit(req, folder) {
  if (studioAdmin(req)) return { admin: true, user: null };
  const user = await currentUser(req);
  if (!user) throw userError(401, 'login', 'Your login expired. Log in again to keep editing.');
  const d = (await freshManifest(3e3)).find(x => x && x.folder === folder);
  if (!d || d.owner !== user.id) throw userError(403, 'not-yours', 'You can only edit your own designs.');
  return { user };
}
async function readDesignFile(folder, p) {
  const f = await gh('GET', `/repos/${REPO}/contents/${encodeURI(`${DIR}/${folder}/${p}`)}?ref=${await headSha()}`, null, { retries: 2 });
  if (Array.isArray(f) || f.type !== 'file') throw userError(404, 'not-found', 'That page doesn’t exist.');
  if (f.content) return Buffer.from(f.content, 'base64').toString('utf8');
  const b = await gh('GET', `/repos/${REPO}/git/blobs/${f.sha}`, null, { retries: 2 });   // pages over 1 MB
  return Buffer.from(b.content, 'base64').toString('utf8');
}
async function listPages(folder) {
  const dir = (await gh('GET', `/repos/${REPO}/contents/${DIR}?ref=${await headSha()}`, null, { retries: 2 })).find(i => i.type === 'dir' && i.name === folder);
  if (!dir) throw userError(404, 'not-found', 'That design isn’t on GitHub yet. If you just uploaded it, wait until saving finishes.');
  const t = await gh('GET', `/repos/${REPO}/git/trees/${dir.sha}?recursive=1`, null, { retries: 2 });
  return (t.tree || []).filter(x => x.type === 'blob' && /\.html?$/i.test(x.path)).map(x => x.path).sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
}
function selfUrl(req) { return `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${req.headers['x-forwarded-host'] || req.headers.host}`; }
let editorAssets = null;
function editorPage(req, folder, p, src, name) {
  if (!editorAssets) editorAssets = { js: fs.readFileSync(path.join(__dirname, 'editor-frame.js'), 'utf8'), css: fs.readFileSync(path.join(__dirname, 'editor-frame.css'), 'utf8') };
  const dirPart = p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '';
  const base = `${selfUrl(req)}/d/${folder}/${dirPart.split('/').map(encodeURIComponent).join('/')}`;
  // storage shim: the editor frame is sandboxed, so localStorage/cookies would throw and break the site's own scripts
  const shim = `<script>(function(){function M(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}['localStorage','sessionStorage'].forEach(function(n){try{window[n].length}catch(e){try{Object.defineProperty(window,n,{value:M(),configurable:true})}catch(x){}}});try{document.cookie}catch(e){try{var c='';Object.defineProperty(document,'cookie',{get:function(){return c},set:function(v){},configurable:true})}catch(x){}}})();</script>`;
  const cfg = `<script>window.__CA=${JSON.stringify({ path: p, folder, name }).replace(/</g, '\\u003c')};</script>`;
  return blocksLib.annotate(src, { headStart: `<base href="${base}">${shim}`, bodyEnd: `<style>${editorAssets.css}</style>${cfg}<script>${editorAssets.js}</script>` });
}
async function handleEdit(req, res, route, url) {
  if (req.method === 'POST' && !sameOrigin(req)) { req.resume(); return send(res, 403, { ok: false, error: 'Editing only works from ChiActive Studio.' }); }
  const folder = String(url.searchParams.get('folder') || '');
  let body = {}, who = null;
  try {
    if (req.method === 'POST') body = await readJson(req, 512 * 1024);
    const f = folder || String(body.folder || '');
    if (!/^[a-z0-9-]+$/.test(f)) throw userError(400, 'bad-folder', 'That design doesn’t exist.');
    who = await canEdit(req, f);
    const d = (await freshManifest(3e3)).find(x => x && x.folder === f) || { folder: f, name: f, entry: 'index.html' };
    if (req.method === 'GET' && route === '/api/edit/pages') {
      return send(res, 200, { ok: true, folder: f, name: d.name, by: d.by || '', entry: d.entry || 'index.html', pages: await listPages(f), pagesUrl: PAGES_URL, admin: !!who.admin });
    }
    const p = String(url.searchParams.get('path') || body.path || '').replace(/^\/+/, '');
    if (!safePath(p) || !/\.html?$/i.test(p)) throw userError(400, 'bad-path', 'That isn’t a page of this design.');
    if (req.method === 'GET' && route === '/api/edit/page') {
      const src = await readDesignFile(f, p);
      const out = editorPage(req, f, p, src, d.name);
      return send(res, 200, { ok: true, path: p, sha: sha1(src), count: out.count, html: out.html });
    }
    if (req.method === 'POST' && route === '/api/edit/block') {
      const actor = who.user || { id: 'admin', username: 'admin', name: 'Admin' };
      if (editLimited(actor.id)) throw userError(429, 'rate-limited', 'That’s a lot of changes in a short time. Wait a few minutes and try again.');
      const action = body.action === 'delete' ? 'delete' : 'edit', index = +body.block;
      return await folderLock(f)(async () => {
        const src = await readDesignFile(f, p);
        if (sha1(src) !== body.sha) throw userError(409, 'stale', 'This page changed since you opened it (maybe in another tab), so it was reloaded. Please make your change again.');
        const before = blocksLib.blockInfo(src, index);
        const next = action === 'delete' ? blocksLib.applyDelete(src, index) : blocksLib.applyEdit(src, index, { html: body.html, text: body.text, href: body.href });
        const after = action === 'delete' ? null : blocksLib.blockInfo(next, index);
        if (next !== src) {
          await commitToMain(`${action === 'delete' ? 'Delete text in' : 'Edit'} ${d.name}: ${p}`, [{ path: `${DIR}/${f}/${p}`, mode: '100644', type: 'blob', content: next }], list => {
            const m = list.find(x => x.folder === f); if (m) m.editedAt = new Date().toISOString(); return list;
          });
          const s = live.get(f); if (s && s.status === 'done') live.delete(f);
        }
        const count = blocksLib.countBlocks(next);
        logEvent(action === 'delete' ? 'edit-delete' : 'edit-save', { folder: f, name: d.name, page: p, student: actor.name, username: actor.username,
          message: action === 'delete' ? `Deleted “${cleanText(before.text, 120)}”` : `“${cleanText(before.text, 100)}” → “${cleanText(after.text, 100)}”${after.href && after.href !== before.href ? ` (link: ${after.href})` : ''}` }, req);
        return send(res, 200, { ok: true, sha: sha1(next), count, reload: action === 'delete' || count !== blocksLib.countBlocks(src), changed: next !== src });
      });
    }
    return send(res, 404, { ok: false, error: 'Not found' });
  } catch (e) {
    if (!e.user) console.error(e);
    if (!(e.user && (e.status === 401 || e.status === 409))) logEvent('edit-failed', { folder: folder || cleanText(body.folder, 80), page: cleanText(body.path || url.searchParams.get('path'), 120), student: who && who.user ? who.user.name : undefined, error: explain(e), detail: e.user ? undefined : cleanText(e.message, 300), stack: stackOf(e) }, req);
    return send(res, e.user && e.status ? e.status : 502, { ok: false, code: e.code, error: explain(e) });
  }
}

/* ---------- admin: owners and accounts ---------- */
async function adminSetOwner(req, body) {
  const folder = String(body.folder || ''), owner = String(body.owner || '');
  if (!/^[a-z0-9-]+$/.test(folder)) throw userError(400, 'bad-folder', 'That design folder isn’t valid.');
  let acc = null;
  if (owner) { acc = (await loadAccounts()).find(a => a.id === owner); if (!acc) throw userError(404, 'no-account', 'That account doesn’t exist.'); }
  await commitToMain(`Set owner of ${folder}`, [], list => {
    const d = list.find(x => x.folder === folder); if (!d) throw userError(404, 'not-found', 'That design isn’t in the gallery list. Rename it first to add it.');
    if (acc) d.owner = acc.id; else delete d.owner; return list;
  });
  logEvent('admin-owner', { folder, message: acc ? `Owner is now ${acc.name} (@${acc.username})` : 'Owner removed' }, req);
}
async function adminResetPassword(req, body) {
  const id = String(body.id || '');
  const acc = (await loadAccounts()).find(a => a.id === id); if (!acc) throw userError(404, 'no-account', 'That account doesn’t exist.');
  const pw = checkPassword(body.password, acc.username);
  const salt = crypto.randomBytes(16).toString('hex'), hash = (await scryptAsync(pw, salt)).toString('hex');
  await changeAccounts(list => { const x = list.find(a => a.id === id); x.salt = salt; x.hash = hash; x.pwv = (x.pwv || 0) + 1; });
  logEvent('admin-reset', { username: acc.username, student: acc.name, message: 'Admin set a new password (the student is logged out everywhere)' }, req);
}
async function adminDeleteAccount(req, body) {
  const id = String(body.id || '');
  const acc = (await loadAccounts()).find(a => a.id === id); if (!acc) throw userError(404, 'no-account', 'That account doesn’t exist.');
  await changeAccounts(list => { list.splice(list.findIndex(a => a.id === id), 1); });
  logEvent('admin-account-delete', { username: acc.username, student: acc.name, message: 'Account deleted (their designs stay in the gallery without an owner)' }, req);
}
let studioHtml = null;
function studioPage(res) {
  if (!studioHtml) studioHtml = fs.readFileSync(path.join(__dirname, 'studio.html'));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
  res.end(studioHtml);
}
const staticCache = new Map();
function staticFile(res, rel, type) {
  if (!staticCache.has(rel)) staticCache.set(rel, fs.readFileSync(path.join(__dirname, rel)));
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' });
  res.end(staticCache.get(rel));
}
const EVENT_FIELDS = ['folder', 'page', 'student', 'visitor', 'message', 'stage', 'size', 'files', 'ref', 'by', 'path', 'stack'];

/* ---------- HTTP ---------- */
const server = http.createServer(async (req, res) => {
  const origin = allowedOrigin(req);
  const url = new URL(req.url, 'http://x');
  const route = url.pathname;
  const t0 = Date.now();
  res.on('finish', () => {   // every failed API request ends up in the admin log with its exact message
    if (res.statusCode < 400 || !route.startsWith('/api/') || route === '/api/event' || route === '/api/account/me') return;
    if (res.statusCode === 401 && (route.startsWith('/api/admin/') || route === '/api/edit/pages')) return;
    logEvent('request-error', { stage: `${req.method} ${route}`, status: res.statusCode, error: res.caError ? res.caError.error : `HTTP ${res.statusCode}`,
      ref: res.caError && res.caError.ref, detail: res.caError && res.caError.code ? 'code: ' + res.caError.code : undefined, seconds: Math.round((Date.now() - t0) / 100) / 10 }, req);
  });
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(origin ? 204 : 403, origin ? { ...cors(origin), 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } : {});
      return res.end();
    }
    if (req.method === 'GET' && (route === '/' || route === '/api/health')) {
      return send(res, 200, { ok: true, service: 'ChiActive upload server', repo: REPO, ready: !!TOKEN, maxFile: MAX_FILE, maxTotal: MAX_TOTAL, maxFiles: MAX_FILES, chunk: CHUNK }, origin || '*');
    }
    if (req.method === 'GET' && route === '/api/designs') {
      const list = (await freshManifest(5e3)).slice();
      for (const s of live.values()) if (!list.some(d => d && d.folder === s.folder)) list.push({ folder: s.folder, name: s.name, by: s.student, entry: s.entry, uploadedAt: new Date(s.savingSince || s.created).toISOString() });
      return send(res, 200, { ok: true, designs: list }, origin || '*');
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && route.startsWith('/d/')) return await servePreview(req, res, url);

    // uploads
    if (route.startsWith('/api/upload')) {
      if (origin) { req.resume(); return send(res, 410, { ok: false, code: 'old-page', error: 'Uploading moved to ChiActive Studio, where you log in first. Refresh the gallery page and click “Sign up or log in”.' }, origin); }
      if (!sameOrigin(req)) { req.resume(); return send(res, 403, { ok: false, code: 'origin', error: 'Uploads are only accepted from ChiActive Studio.' }); }
      const user = studioAdmin(req) ? { id: 'admin', username: 'admin', name: 'Admin', isAdmin: true } : await currentUser(req).catch(() => null);
      if (!user) { req.resume(); return send(res, 401, { ok: false, code: 'login', error: 'Your login expired. Log in again, then upload.' }); }
      if (req.method === 'POST' && route === '/api/upload/start') return await handleStart(req, res, null, user);
      if (req.method === 'POST' && route === '/api/upload/chunk') return await handleChunk(req, res, null, url, user);
      if (req.method === 'POST' && route === '/api/upload/finish') return await handleFinish(req, res, null, user);
      if (req.method === 'GET' && route === '/api/upload/status') {
        const s = uploads.get(url.searchParams.get('id') || '');
        if (s && s.actor !== user.id) return send(res, 404, { ok: false, code: 'expired', error: 'Upload not found.' });
        return s ? send(res, 200, publicStatus(s), origin) : send(res, 404, { ok: false, code: 'expired', error: 'The upload server restarted and lost track of this upload. Check the gallery; if your design isn’t there, upload it again.' }, origin);
      }
      if (route === '/api/upload') { req.resume(); return send(res, 410, { ok: false, code: 'old-page', error: 'The gallery page was updated. Refresh the page (Cmd+Shift+R or Ctrl+F5) and upload again.' }, origin); }
    }

    // activity beacons from the gallery and the demo viewer
    if (req.method === 'POST' && route === '/api/event') {
      if ((!origin && !(req.headers.origin && sameOrigin(req))) || eventLimited(clientIp(req))) { req.resume(); res.writeHead(204, cors(origin)); return res.end(); }
      let body = {};
      try { body = JSON.parse((await readBody(req, 8192)).toString('utf8')); } catch (e) { res.writeHead(400, cors(origin)); return res.end(); }
      if (EVENT_TYPES.has(body.type)) {
        const data = {};
        EVENT_FIELDS.forEach(k => { if (body[k] != null && body[k] !== '') data[k] = typeof body[k] === 'number' ? body[k] : cleanText(body[k], k === 'message' ? 400 : k === 'stack' ? 1200 : 160); });
        if (data.student) data.student = cleanName(data.student);
        logEvent(body.type, data, req);
      }
      res.writeHead(204, cors(origin)); return res.end();
    }

    // ChiActive Studio (accounts, uploads, editor)
    if (req.method === 'GET' && (route === '/studio' || route.startsWith('/studio/'))) return studioPage(res);
    if (req.method === 'GET' && route === '/vendor/jszip.min.js') return staticFile(res, 'vendor/jszip.min.js', 'text/javascript; charset=utf-8');
    if (route.startsWith('/api/account/')) return await handleAccount(req, res, route);
    if (route.startsWith('/api/edit/')) return await handleEdit(req, res, route, url);

    // admin
    if (req.method === 'GET' && (route === '/admin' || route === '/admin/')) return adminPage(res);
    if (route.startsWith('/api/admin/')) {
      if (req.method === 'POST' && !sameOrigin(req)) { req.resume(); return send(res, 403, { ok: false, error: 'Admin actions only work from the admin page.' }); }
      if (req.method === 'POST' && route === '/api/admin/login') {
        if (!ADMIN_PASSWORD) return send(res, 503, { ok: false, error: 'No admin password is set yet. Add ADMIN_PASSWORD under Environment in Render, then try again.' });
        if (loginLimited(clientIp(req))) return send(res, 429, { ok: false, error: 'Too many login attempts. Wait 15 minutes and try again.' });
        const body = await readJson(req, 4096);
        if (!passwordOk(body.password)) { logEvent('admin-login-failed', {}, req); await sleep(600); return send(res, 401, { ok: false, error: 'That password isn’t right.' }); }
        logEvent('admin-login', {}, req);
        const exp = String(Date.now() + 12 * 3600e3);
        return send(res, 200, { ok: true }, null, { 'Set-Cookie': sessionCookie(req, `${exp}.${hmac(SESSION_KEY, exp)}`, 12 * 3600) });
      }
      if (req.method === 'POST' && route === '/api/admin/logout') return send(res, 200, { ok: true }, null, { 'Set-Cookie': sessionCookie(req, '', 0) });
      if (!isAdmin(req)) { req.resume(); return send(res, 401, { ok: false, error: 'Log in first.', needsPassword: !ADMIN_PASSWORD }); }
      if (req.method === 'GET' && route === '/api/admin/logs') {
        const days = Math.min(Math.max(+url.searchParams.get('days') || 7, 1), 365);
        const data = await loadLogs(days);
        return send(res, 200, { ok: true, days, ...data, server: { repo: REPO, branch: BRANCH, logBranch: LOG_BRANCH, tokenSet: !!TOKEN, pages: PAGES_URL,
          uptimeMin: Math.round(process.uptime() / 60), activeUploads: [...uploads.values()].filter(s => s.status !== 'done').map(s => ({ student: s.student, status: s.status, stage: s.stage, done: s.done || 0, steps: s.steps || 0, note: s.note || '', size: s.total, files: s.files.length })) } });
      }
      if (req.method === 'GET' && route === '/api/admin/designs') {
        let accounts = [], accountsError = '';
        try { accounts = (await loadAccounts()).map(a => ({ id: a.id, username: a.username, name: a.name })); } catch (e) { accountsError = explain(e); }
        return send(res, 200, { ok: true, pages: PAGES_URL, designs: await adminDesigns(), accounts, accountsError });
      }
      if (req.method === 'GET' && route === '/api/admin/accounts') {
        try {
          const manifest = await freshManifest(5e3);
          const list = (await loadAccounts()).map(a => ({ id: a.id, username: a.username, name: a.name, created: a.created, designs: manifest.filter(d => d && d.owner === a.id).map(d => d.name) }));
          return send(res, 200, { ok: true, accounts: list.sort((a, b) => String(b.created).localeCompare(String(a.created))) });
        } catch (e) { return send(res, 200, { ok: false, error: explain(e), accounts: [] }); }
      }
      if (req.method === 'POST' && route === '/api/admin/view-as') {
        const body = await readJson(req, 4096);
        try {
          if (body.stop) { logEvent('admin-view-as', { message: 'Back to admin in Studio' }, req); return send(res, 200, { ok: true }, null, { 'Set-Cookie': [userCookie(req, null), viewAsCookie(req, false)] }); }
          let acc;
          if (body.createTest) {
            const salt = crypto.randomBytes(16).toString('hex'), hash = (await scryptAsync(crypto.randomBytes(18).toString('base64'), salt)).toString('hex');
            acc = await changeAccounts(list => {
              let u = 'test-student', n = 2; while (list.some(a => a.username === u)) u = `test-student-${n++}`;
              const a = { id: newId(), username: u, name: 'Test Student' + (n > 2 ? ' ' + (n - 1) : ''), salt, hash, pwv: 0, created: new Date().toISOString(), test: true };
              list.push(a); return a;
            });
          } else {
            acc = (await loadAccounts()).find(a => a.id === String(body.id || ''));
            if (!acc) throw userError(404, 'no-account', 'That student account doesn’t exist.');
          }
          logEvent('admin-view-as', { username: acc.username, student: acc.name, message: body.createTest ? 'Created a test student and opened Studio as them' : `Opened Studio as @${acc.username}` }, req);
          return send(res, 200, { ok: true, user: { username: acc.username, name: acc.name } }, null, { 'Set-Cookie': [userCookie(req, acc, 12 * 3600), viewAsCookie(req, true)] });
        } catch (e) { return send(res, e.user && e.status ? e.status : 502, { ok: false, error: explain(e) }); }
      }
      // AI fixer
      if (req.method === 'GET' && route === '/api/admin/ai') return send(res, 200, await fixer.adminView());
      if (req.method === 'POST' && route.startsWith('/api/admin/ai/')) {
        const body = await readJson(req, 16 * 1024);
        try {
          const what = route.split('/').pop();
          if (what === 'settings') { await fixer.setMode(String(body.mode || '')); logEvent('admin-ai', { message: `AI fixer mode set to “${body.mode}”` }, req); }
          else if (what === 'approve') { await fixer.approve(String(body.id || '')); logEvent('admin-ai', { ref: cleanText(body.id, 20), message: 'Approved an AI fix' }, req); }
          else if (what === 'revert') { const sha = await fixer.revert(String(body.id || '')); logEvent('admin-ai', { ref: cleanText(body.id, 20), message: `Undid an AI fix (commit ${sha.slice(0, 7)})` }, req); }
          else if (what === 'analyze') {
            let ev = null;
            if (body.eventId) {
              ev = logState.recent.find(x => x.id === body.eventId) || (await loadLogs(30)).events.find(x => x.id === body.eventId);
              if (!ev) throw userError(404, 'no-event', 'That log entry wasn’t found.');
            } else {
              const text = cleanText(body.text, 1500);
              if (text.length < 10) throw userError(400, 'short', 'Describe the problem in a sentence or two.');
              ev = { id: newId(), t: new Date().toISOString(), type: 'admin-report', stage: 'reported by admin', message: text };
            }
            fixer.analyzeNow(ev);
            logEvent('admin-ai', { ref: ev.id, message: body.eventId ? `Asked Claude about a ${ev.type} entry` : 'Asked Claude about a problem: ' + cleanText(body.text, 200) }, req);
          } else return send(res, 404, { ok: false, error: 'Not found' });
          return send(res, 200, await fixer.adminView());
        } catch (e) { return send(res, e.user && e.status ? e.status : 502, { ok: false, error: e.user ? e.message : explain(e) }); }
      }
      if (req.method === 'POST' && ['/api/admin/owner', '/api/admin/account/reset', '/api/admin/account/delete'].includes(route)) {
        const body = await readJson(req, 16 * 1024);
        try {
          if (route === '/api/admin/owner') await adminSetOwner(req, body);
          else if (route === '/api/admin/account/reset') await adminResetPassword(req, body);
          else await adminDeleteAccount(req, body);
          return send(res, 200, { ok: true });
        } catch (e) {
          logEvent('admin-error', { stage: route.split('/').pop(), error: explain(e), detail: e.user ? undefined : cleanText(e.message, 300), stack: stackOf(e) }, req);
          return send(res, e.user && e.status ? e.status : 502, { ok: false, error: explain(e) });
        }
      }
      if (req.method === 'POST' && (route === '/api/admin/rename' || route === '/api/admin/delete')) {
        const body = await readJson(req, 16 * 1024);
        try {
          if (route.endsWith('rename')) await adminRename(req, body); else await adminDelete(req, body);
          return send(res, 200, { ok: true, designs: await adminDesigns() });
        } catch (e) {
          const msg = explain(e);
          logEvent('admin-error', { folder: cleanText(body.folder, 80), stage: route.endsWith('rename') ? 'rename' : 'delete', error: msg, detail: e.user ? undefined : cleanText(e.message, 300), stack: stackOf(e) }, req);
          return send(res, e.user && e.status ? e.status : 502, { ok: false, error: msg });
        }
      }
    }
    send(res, 404, { ok: false, error: 'Not found' }, origin);
  } catch (e) {
    console.error(e);
    if (!e.user) logEvent('server-error', { stage: `${req.method} ${route}`, error: explain(e), detail: cleanText(e.message, 300), stack: stackOf(e) }, req);
    if (!res.headersSent) send(res, e.user && e.status ? e.status : 500, { ok: false, error: explain(e) }, origin);
    else res.end();
  }
});

/* ---------- AI fixer ---------- */
fixer = require('./ai-fixer').createFixer({ gh, commitToMain, logEvent, encrypt, decrypt, ensureLogBranch, explain, key: LOG_KEY, REPO, BRANCH, LOG_BRANCH,
  serverDir: __dirname, activeUploads: () => [...uploads.values()].filter(s => s.status !== 'done' && s.status !== 'failed').length, recentEvents: () => logState.recent.slice(-200) });
// a bug outside a request: log it (the AI fixer picks it up) and keep serving
process.on('uncaughtException', e => { console.error('Uncaught:', e); try { logEvent('server-crash', { error: explain(e), detail: cleanText(e && e.message, 300), stack: stackOf(e) }); } catch (x) { /* ignore */ } });
process.on('unhandledRejection', e => { console.error('Unhandled rejection:', e); try { logEvent('server-crash', { error: explain(e), detail: cleanText(e && e.message || e, 300), stack: stackOf(e) }); } catch (x) { /* ignore */ } });

/* ---------- start / stop ---------- */
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
server.requestTimeout = 0;            // big uploads can take a while
server.headersTimeout = 60e3;
server.listen(PORT, () => {
  console.log(`ChiActive upload server on :${PORT} for ${REPO} (${TOKEN ? 'token set' : 'NO TOKEN'}, admin ${ADMIN_PASSWORD ? 'on' : 'off'}, log ${logState.persist ? 'saved to ' + LOG_BRANCH : 'memory only'})`);
  logEvent('server-start', { message: `Upload server started (${TOKEN ? 'GitHub connected' : 'no GitHub token'}, activity log ${logState.persist ? 'saved' : 'memory only'}, AI fixer ${fixer.keySet() ? 'on' : 'off: no ANTHROPIC_API_KEY'})`, ref: process.env.RENDER_GIT_COMMIT ? process.env.RENDER_GIT_COMMIT.slice(0, 7) : undefined });
});
async function shutdown(sig) {
  console.log(`${sig}: saving the activity log…`);
  try { await Promise.race([flushLogs(), sleep(20e3)]); } catch (e) { /* ignore */ }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
