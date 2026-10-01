/* Self-test for the ChiActive upload server.
 * Starts a fake GitHub and a copy of the server (from the folder given as argument, default ..),
 * then walks through everything students and admins do. Prints a JSON report; exit code 0 = all passed.
 *   node test/selftest.js [serverFolder]
 * The AI fixer runs this against every proposed fix before anything is committed. */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const mock = require('./mockgh');

const dir = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const results = [];
let child = null, mockSrv = null, logs = '';
const deadline = setTimeout(() => finish('Timed out after 120 s'), 120e3);

function check(name, ok, info) { results.push({ name, ok: !!ok, info: ok ? undefined : String(info || '').slice(0, 300) }); return ok; }
async function finish(fatal) {
  clearTimeout(deadline);
  if (child) child.kill('SIGKILL');
  if (mockSrv) mockSrv.close();
  const passed = results.filter(r => r.ok).length;
  const ok = !fatal && results.length > 0 && passed === results.length;
  console.log(JSON.stringify({ ok, passed, total: results.length, fatal: fatal || undefined, failed: results.filter(r => !r.ok), serverLog: ok ? undefined : logs.slice(-2500) }, null, 1));
  process.exit(ok ? 0 : 1);
}
process.on('unhandledRejection', e => finish('Test crashed: ' + (e && e.stack || e)));

(async () => {
  mockSrv = await mock.start(0);
  const ghPort = mockSrv.address().port;
  const port = 20000 + Math.floor(Math.random() * 20000);
  const A = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(dir, 'server.js')], {
    cwd: dir,
    env: { PATH: process.env.PATH, PORT: String(port), GITHUB_TOKEN: 'testtoken', ADMIN_PASSWORD: 'selftest-password',
      GITHUB_API: `http://127.0.0.1:${ghPort}`, GITHUB_RAW: `http://127.0.0.1:${ghPort}/raw`, PAGES_URL: 'http://127.0.0.1:1/',
      ALLOWED_ORIGINS: 'http://127.0.0.1:1', UPLOAD_TMP: fs.mkdtempSync(path.join(os.tmpdir(), 'ca-selftest-')), SELFTEST: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', d => { logs += d; }); child.stderr.on('data', d => { logs += d; });
  child.on('exit', code => { if (code !== null && code !== 0) logs += `\n[server exited with code ${code}]`; });

  // wait for the server
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(A + '/api/health')).ok; } catch (e) { await new Promise(r => setTimeout(r, 250)); } }
  if (!check('server starts', up, logs.slice(-500))) return finish('Server did not start');

  const jar = {};
  const call = async (p, body, who = 'student', raw) => {
    const headers = { Origin: A, ...(jar[who] ? { cookie: jar[who] } : {}) };
    if (body !== undefined && !raw) headers['Content-Type'] = 'application/json';
    const r = await fetch(A + p, { method: body !== undefined ? 'POST' : 'GET', headers, body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined });
    const c = r.headers.get('set-cookie'); if (c) jar[who] = c.split(/,(?=\s*ca_)/).map(x => x.split(';')[0].trim()).filter(x => !/=$/.test(x)).join('; ');
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { status: r.status, json, text };
  };

  // pages
  let r = await call('/studio'); check('Studio page loads', r.status === 200 && r.text.includes('ChiActive Studio'), r.status);
  r = await call('/admin'); check('admin page loads', r.status === 200 && r.text.includes('ChiActive'), r.status);
  r = await call('/vendor/jszip.min.js'); check('zip reader is served', r.status === 200, r.status);

  // accounts
  r = await call('/api/account/signup', { name: 'Self Test', username: 'selftest', password: 'lakefront-parka-77' });
  check('student can sign up', r.status === 200 && jar.student, r.text);
  r = await call('/api/account/me'); check('student is logged in', r.json && r.json.user && r.json.user.username === 'selftest', r.text);
  r = await call('/api/account/signup', { name: 'Other', username: 'selftest', password: 'lakefront-parka-77' }, 'other');
  check('duplicate username is refused', r.status === 409, r.text);
  r = await call('/api/account/login', { username: 'selftest', password: 'wrong-password-1' }, 'other');
  check('wrong password is refused', r.status === 401, r.text);

  // upload a small design in pieces
  const files = [
    ['site/index.html', '<!doctype html><html><head><title>T</title><link rel="stylesheet" href="s.css"></head><body><h1>Hello world</h1><p>First paragraph.</p><a href="two.html">Two</a><label>Name <input></label></body></html>'],
    ['site/two.html', '<!doctype html><title>2</title><h2>Second page</h2>'],
    ['site/s.css', 'h1{color:red}'],
    ['site/config.js', 'var mapKey = "' + 'AKIA' + 'QWERTYUIOPASDFGH' + '";\nvar ai = "' + 'sk-' + 'ant-' + 'api03-' + 'Zx9'.repeat(12) + '";\n'],
    ['site/pic.png', Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')],
  ];
  r = await call('/api/upload/start', { files: files.map(f => ({ path: f[0], size: Buffer.byteLength(f[1]) })) });
  check('upload starts', r.status === 200 && r.json && r.json.ok, r.text);
  const up1 = r.json || {};
  let chunksOk = true;
  for (let k = 0; k < (up1.files || []).length; k++) {
    const data = files[up1.files[k]][1];
    const c = await call(`/api/upload/chunk?id=${up1.id}&k=${k}&o=0`, typeof data === 'string' ? Buffer.from(data) : data, 'student', true);
    if (c.status !== 200) { chunksOk = false; check('upload pieces arrive', false, c.text); }
  }
  if (chunksOk) check('upload pieces arrive', true);
  r = await call('/api/upload/finish', { id: up1.id }); check('upload finishes', r.status === 202 || r.status === 200, r.text);
  let st = r.json || {};
  for (let i = 0; i < 40 && st.status === 'saving'; i++) { await new Promise(z => setTimeout(z, 250)); st = (await call('/api/upload/status?id=' + up1.id)).json || {}; }
  check('upload is saved to GitHub', st.status === 'done', JSON.stringify(st).slice(0, 200));
  check('secret keys are removed before saving', st.secrets && st.secrets.length === 2, JSON.stringify(st.secrets));
  const folder = up1.folder;
  r = await call('/api/designs'); check('design is listed', r.json && r.json.designs.some(d => d.folder === folder), r.text);
  r = await call(`/d/${folder}/config.js`); check('no secret key reaches the website', r.status === 200 && r.text.includes('REMOVED_SECRET_KEY') && !/AKIA[0-9A-Z]{16}/.test(r.text), r.text.slice(0, 200));
  r = await call(`/d/${folder}/index.html`); check('instant preview works', r.status === 200 && r.text.includes('Hello world'), r.status);

  // editor
  r = await call(`/api/edit/pages?folder=${folder}`); check('editor lists pages', r.json && r.json.ok && r.json.pages.includes('two.html'), r.text);
  r = await call(`/api/edit/page?folder=${folder}&path=index.html`);
  check('editor page loads with blocks', r.json && r.json.ok && r.json.count >= 3 && r.json.html.includes('__caEditor'), r.text.slice(0, 200));
  const page = r.json || {};
  const h1 = page.html && page.html.match(/<h1 data-ca-b="(\d+)"/);
  r = await call('/api/edit/block', { folder, path: 'index.html', sha: page.sha, block: h1 ? +h1[1] : 0, action: 'edit', html: 'Hello <b>class</b>' });
  check('text edit saves', r.json && r.json.ok, r.text);
  const afterEdit = r.json || {};
  r = await call(`/d/${folder}/index.html`); check('edit shows in preview', r.text.includes('Hello <b>class</b>'), r.text.slice(0, 200));
  const p2 = (await call(`/api/edit/page?folder=${folder}&path=index.html`)).json || {};
  const para = p2.html && p2.html.match(/<p data-ca-b="(\d+)"/);
  r = await call('/api/edit/block', { folder, path: 'index.html', sha: p2.sha, block: para ? +para[1] : 1, action: 'delete' });
  check('text delete saves', r.json && r.json.ok && r.json.reload, r.text);
  r = await call('/api/edit/block', { folder, path: 'index.html', sha: afterEdit.sha, block: 0, action: 'edit', html: 'x' });
  check('stale page is refused', r.status === 409, r.text);
  r = await call(`/api/edit/page?folder=${folder}&path=index.html`, undefined, 'other');
  check('other people cannot edit', r.status === 401 || r.status === 403, r.text);

  // admin
  r = await call('/api/admin/login', { password: 'selftest-password' }, 'admin'); check('admin can log in', r.status === 200, r.text);
  r = await call('/api/admin/logs?days=1', undefined, 'admin'); check('admin log loads', r.json && r.json.ok && r.json.events.length > 0, r.text.slice(0, 200));
  r = await call('/api/admin/designs', undefined, 'admin'); check('admin design list loads', r.json && r.json.ok && r.json.designs.some(d => d.folder === folder), r.text.slice(0, 200));
  r = await call('/api/admin/accounts', undefined, 'admin'); check('admin account list loads', r.json && r.json.ok && r.json.accounts.length >= 1, r.text.slice(0, 200));
  r = await call('/api/admin/logs?days=1', undefined, 'student'); check('students cannot read the admin log', r.status === 401, r.status);

  finish();
})();
