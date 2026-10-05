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
    ['site/index.html', '<!doctype html><html><head><title>T</title><link rel="stylesheet" href="s.css"></head><body><h1>Hello world</h1><p>First paragraph.</p><a href="two.html">Two</a><label>Name <input></label><img src="pic.png" alt="Pic"></body></html>'],
    ['site/two.html', '<!doctype html><title>2</title><h2>Second page</h2><script>var k = "' + 'gh' + 'p_' + 'A1b2C3'.repeat(7) + '";</script>'],
    ['site/.env', 'OPENAI_KEY=whatever'],
    ['site/s.css', 'h1{color:red}'],
    ['site/config.js', 'var mapKey = "' + 'AKIA' + 'QWERTYUIOPASDFGH' + '";\nvar ai = "' + 'sk-' + 'ant-' + 'api03-' + 'Zx9'.repeat(12) + '";\n'],
    ['site/pic.png', Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')],
  ];
  r = await call('/api/upload/start', { files: files.map(f => ({ path: f[0], size: Buffer.byteLength(f[1]) })) });
  check('upload starts', r.status === 200 && r.json && r.json.ok, r.text);
  check('.env files are left out before uploading', r.json && r.json.removed && r.json.removed.some(x => /\.env$/.test(x.path)) && r.json.files.length === files.length - 1, r.text);
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
  check('files with secret keys are left out', st.removed && st.removed.some(x => x.path === 'config.js'), JSON.stringify(st.removed));
  check('keys in web pages are blanked out', st.secrets && st.secrets.length === 1 && st.secrets[0].path === 'two.html', JSON.stringify(st.secrets));
  const folder = up1.folder;
  r = await call('/api/designs'); check('design is listed', r.json && r.json.designs.some(d => d.folder === folder), r.text);
  r = await call(`/d/${folder}/config.js`); check('a file with secret keys is not published', r.status === 404, r.status);
  r = await call(`/d/${folder}/two.html`); check('no secret key reaches the website', r.status === 200 && r.text.includes('REMOVED_SECRET_KEY') && !/ghp_[A-Za-z0-9]{36}/.test(r.text), r.text.slice(0, 200));
  r = await call(`/d/${folder}/.env`); check('the .env file is not published', r.status === 404, r.status);
  r = await call(`/api/edit/files?folder=${folder}`); check('GitHub never received the files with secrets', r.json && r.json.files && !r.json.files.some(x => x.path === 'config.js' || x.path === '.env') && r.json.files.some(x => x.path === 'two.html'), r.text.slice(0, 300));
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

  // editors: the admin lets a second student edit the first student's design
  r = await call('/api/account/signup', { name: 'Helper', username: 'selftest-helper', password: 'harbor-mitten-42' }, 'helper');
  check('second student can sign up', r.status === 200, r.text);
  const helperId = ((await call('/api/admin/accounts', undefined, 'admin')).json.accounts.find(a => a.username === 'selftest-helper') || {}).id;
  r = await call(`/api/edit/page?folder=${folder}&path=index.html`, undefined, 'helper');
  check('a non-editor cannot edit', r.status === 403, r.status);
  r = await call('/api/admin/editors', { folder, editors: [helperId] }, 'admin'); check('admin can add an editor', r.status === 200, r.text);
  r = await call('/api/admin/designs', undefined, 'admin'); check('editor shows in the admin design list', r.json && r.json.designs.find(d => d.folder === folder).editors.includes(helperId), r.text.slice(0, 200));
  r = await call('/api/account/me', undefined, 'helper'); check('the design is listed for the editor', r.json && (r.json.designs || []).some(d => d.folder === folder && d.role === 'editor'), r.text.slice(0, 300));
  const hp = (await call(`/api/edit/page?folder=${folder}&path=index.html`, undefined, 'helper')).json || {};
  const h2 = hp.html && hp.html.match(/<h2 data-ca-b="(\d+)"|<a data-ca-b="(\d+)"/);
  r = await call('/api/edit/block', { folder, path: 'index.html', sha: hp.sha, block: h2 ? +(h2[1] || h2[2]) : 0, action: 'edit', html: 'Edited by the helper' }, 'helper');
  check('the editor can save a change', r.json && r.json.ok, r.text);
  r = await call('/api/admin/editors', { folder, editors: [] }, 'admin'); check('admin can remove an editor', r.status === 200, r.text);
  r = await call(`/api/edit/page?folder=${folder}&path=index.html`, undefined, 'helper');
  check('a removed editor cannot edit anymore', r.status === 403, r.status);

  // download the design as a .zip
  const dl = async who => { const res = await fetch(A + `/api/download?folder=${folder}`, { headers: jar[who] ? { cookie: jar[who] } : {} }); return { status: res.status, type: res.headers.get('content-type'), disp: res.headers.get('content-disposition') || '', buf: Buffer.from(await res.arrayBuffer()) }; };
  let z = await dl('student');
  check('owner can download a .zip named after the design', z.status === 200 && /zip/.test(z.type) && /Website design - Self Test\.zip/.test(decodeURIComponent(z.disp)), z.status + ' ' + z.disp);
  let names = [];
  try {
    const JSZip = require(path.join(dir, 'vendor', 'jszip.min.js'));
    const zz = await JSZip.loadAsync(z.buf); names = Object.keys(zz.files);
    const idx = await zz.file('Website design - Self Test/index.html').async('string');
    check('the .zip holds every file, with the latest edits', names.includes('Website design - Self Test/s.css') && names.includes('Website design - Self Test/pic.png') && idx.includes('Edited by the helper'), names.join(', '));
  } catch (e) { check('the .zip can be opened', false, e.message); }
  z = await dl('helper'); check('any student can download any design', z.status === 200 && z.buf.length > 100, z.status);
  z = await dl('admin'); check('admin can download any design', z.status === 200 && z.buf.length > 100, z.status);
  z = await dl('nobody'); check('gallery visitors can download any design', z.status === 200 && /zip/.test(z.type), z.status);
  z = await (async () => { const r = await fetch(A + '/api/download?folder=no-such-design'); return { status: r.status }; })(); check('unknown designs give a clear error', z.status === 404, z.status);

  // code editor: files, save, conflicts, new files, upload, rename, delete, history, restore
  r = await call(`/api/edit/files?folder=${folder}`); check('editor lists every file', r.json && r.json.ok && r.json.files.some(x => x.path === 's.css' && x.kind === 'text') && r.json.files.some(x => x.path === 'pic.png' && x.kind === 'image'), r.text.slice(0, 200));
  r = await call(`/api/edit/file?folder=${folder}&path=s.css`); const css = r.json || {};
  check('a CSS file opens as text', css.ok && css.text === 'h1{color:red}' && css.sha, r.text.slice(0, 200));
  r = await call('/api/edit/file', { folder, path: 's.css', text: 'h1{color:blue}', sha: css.sha }); check('a CSS file can be saved', r.json && r.json.ok, r.text);
  r = await call(`/d/${folder}/s.css?x=1`); check('the saved CSS is live', r.text.includes('blue'), r.text);
  r = await call('/api/edit/file', { folder, path: 's.css', text: 'h1{color:green}', sha: css.sha }); check('saving over a newer version is refused', r.status === 409, r.text);
  r = await call('/api/edit/file', { folder, path: 'new.html', text: '<!doctype html><title>New</title><h1>New page</h1>', sha: null }); check('a new page can be created', r.json && r.json.ok, r.text);
  r = await call('/api/edit/file', { folder, path: 'new.html', text: 'x', sha: null }); check('a page name can’t be used twice', r.status === 409, r.text);
  r = await call('/api/edit/file', { folder, path: 'evil.exe', text: 'x', sha: null }); check('files that aren’t web files are refused', r.status === 400, r.text);
  r = await call('/api/edit/file', { folder, path: '../escape.html', text: 'x', sha: null }); check('paths outside the design are refused', r.status === 400, r.text);
  r = await call(`/api/edit/upload?folder=${folder}&path=images/up.png`, Buffer.from('89504e470d0a1a0a00', 'hex'), 'student', true); check('an image can be uploaded', r.json && r.json.ok, r.text);
  r = await call(`/api/edit/upload?folder=${folder}&path=images/up.png`, Buffer.from('89504e47', 'hex'), 'student', true); check('uploading over a file needs “replace”', r.status === 409, r.text);
  r = await call(`/api/edit/upload?folder=${folder}&path=images/up.png&overwrite=1`, Buffer.from('89504e47', 'hex'), 'student', true); check('a file can be replaced', r.json && r.json.replaced, r.text);
  r = await call('/api/edit/rename', { folder, path: 'new.html', to: 'renamed.html' }); check('a file can be renamed', r.json && r.json.ok, r.text);
  r = await call('/api/edit/remove', { folder, path: 'renamed.html' }); check('a file can be deleted', r.json && r.json.ok, r.text);
  r = await call(`/api/edit/files?folder=${folder}`); check('the file list is up to date', r.json && !r.json.files.some(x => /new|renamed/.test(x.path)) && r.json.files.some(x => x.path === 'images/up.png'), r.text.slice(0, 300));
  r = await call(`/api/edit/history?folder=${folder}&path=s.css`); const vers = (r.json && r.json.versions) || [];
  check('a file has a version history', vers.length >= 2, r.text.slice(0, 300));
  r = await call(`/api/edit/version?folder=${folder}&path=s.css&commit=${(vers[vers.length - 1] || {}).commit}`); check('an old version can be viewed', r.json && r.json.text === 'h1{color:red}', r.text);
  r = await call('/api/edit/restore', { folder, path: 's.css', commit: (vers[vers.length - 1] || {}).commit }); check('an old version can be restored', r.json && r.json.ok, r.text);
  r = await call(`/api/edit/file?folder=${folder}&path=s.css`); check('the restored file is back', r.json && r.json.text === 'h1{color:red}', r.text);
  r = await call(`/api/edit/files?folder=${folder}`, undefined, 'helper'); check('non-editors can’t see the files', r.status === 403, r.status);

  // visual editor: move, duplicate, images
  let pg = (await call(`/api/edit/page?folder=${folder}&path=index.html`)).json || {};
  const firstP = pg.html && pg.html.match(/<p data-ca-b="(\d+)"/), img = pg.html && pg.html.match(/<img[^>]*data-ca-i="(\d+)"/);
  check('images are editable on the page', !!img, pg.html && pg.html.slice(0, 200));
  const blk = firstP ? +firstP[1] : (pg.html.match(/<a data-ca-b="(\d+)"/) || [0, 1])[1];
  r = await call('/api/edit/block', { folder, path: 'index.html', sha: pg.sha, block: +blk, action: 'duplicate' }); check('a block can be duplicated', r.json && r.json.ok && r.json.reload, r.text);
  r = await call('/api/edit/block', { folder, path: 'index.html', sha: r.json && r.json.sha, block: +blk, action: 'move-up' }); check('a block can be moved', r.json && r.json.ok, r.text);
  r = await call('/api/edit/block', { folder, path: 'index.html', sha: r.json && r.json.sha, block: img ? +img[1] : 0, action: 'image', src: 'images/up.png', alt: 'Uploaded' }); check('an image can be swapped', r.json && r.json.ok, r.text);
  r = await call(`/d/${folder}/index.html?x=2`); check('the swapped image is on the page', r.text.includes('src="images/up.png"') && r.text.includes('alt="Uploaded"'), r.text.slice(0, 300));
  pg = (await call(`/api/edit/page?folder=${folder}&path=index.html`)).json || {};
  r = await call('/api/edit/block', { folder, path: 'index.html', sha: pg.sha, block: img ? +img[1] : 0, action: 'image-delete' }); check('an image can be deleted', r.json && r.json.ok, r.text);

  // upload a new version of the whole design
  const v2 = [['site/index.html', '<!doctype html><title>V2</title><h1>Version two</h1>'], ['site/style.css', 'body{}']];
  r = await call('/api/upload/start', { replace: folder, files: v2.map(f => ({ path: f[0], size: Buffer.byteLength(f[1]) })) });
  check('a new version can be started', r.json && r.json.ok && r.json.folder === folder, r.text);
  const up2 = r.json || {};
  for (let k = 0; k < (up2.files || []).length; k++) await call(`/api/upload/chunk?id=${up2.id}&k=${k}&o=0`, Buffer.from(v2[up2.files[k]][1]), 'student', true);
  r = await call('/api/upload/finish', { id: up2.id }); st = r.json || {};
  for (let i = 0; i < 40 && st.status === 'saving'; i++) { await new Promise(z => setTimeout(z, 250)); st = (await call('/api/upload/status?id=' + up2.id)).json || {}; }
  r = await call(`/api/edit/files?folder=${folder}`);
  check('the new version replaces all files', st.status === 'done' && r.json && r.json.files.map(x => x.path).sort().join() === 'index.html,style.css', JSON.stringify(st).slice(0, 100) + ' ' + r.text.slice(0, 200));
  r = await call('/api/designs'); const dd = r.json && r.json.designs.find(x => x.folder === folder);
  check('name and owner stay the same', dd && dd.name === 'Website design - Self Test' && dd.owner, JSON.stringify(dd));
  r = await call('/api/upload/start', { replace: folder, files: v2.map(f => ({ path: f[0], size: 5 })) }, 'helper');
  check('others can’t upload a new version', r.status === 403, r.text);

  // sub-admins: a student account the main admin promotes; removable at any time
  r = await call('/api/account/signup', { name: 'Sub Admin', username: 'selftest-sub', password: 'violet-canoe-93' }, 'sub');
  const subId = ((await call('/api/admin/accounts', undefined, 'admin')).json.accounts.find(a => a.username === 'selftest-sub') || {}).id;
  r = await call('/api/admin/logs?days=1', undefined, 'sub'); check('a normal student is not an admin', r.status === 401, r.status);
  r = await call('/api/admin/subadmin', { id: subId, on: true }, 'student'); check('students cannot make sub-admins', r.status === 401, r.status);
  r = await call('/api/admin/subadmin', { id: subId, on: true }, 'admin'); check('admin can make a sub-admin', r.status === 200, r.text);
  r = await call('/api/admin/me', undefined, 'sub'); check('sub-admin can open the admin page with their own login', r.json && r.json.role === 'sub-admin' && r.json.username === 'selftest-sub', r.text);
  r = await call('/api/admin/accounts', undefined, 'sub'); check('sub-admin sees the account list', r.json && r.json.ok && r.json.accounts.find(a => a.id === subId).subAdmin === true, r.text.slice(0, 200));
  r = await call('/api/account/me', undefined, 'sub'); check('sub-admin is an admin in Studio', r.json && r.json.admin && r.json.subAdmin && r.json.subAdmin.username === 'selftest-sub', r.text.slice(0, 200));
  r = await call(`/api/edit/page?folder=${folder}&path=index.html`, undefined, 'sub'); check('sub-admin can edit every design', r.json && r.json.ok, r.status);
  r = await call('/api/admin/subadmin', { id: helperId, on: true }, 'sub'); check('sub-admins cannot make other sub-admins', r.status === 403, r.text);
  r = await call('/api/admin/subadmin', { id: subId, on: false }, 'sub'); check('sub-admins cannot change sub-admin roles', r.status === 403, r.text);
  r = await call('/api/admin/account/delete', { id: subId }, 'sub'); check('sub-admins cannot delete a sub-admin account', r.status === 403, r.text);
  r = await call('/api/admin/view-as', { id: helperId }, 'sub'); check('sub-admin can view Studio as a student', r.status === 200, r.text);
  r = await call('/api/account/me', undefined, 'sub'); check('…and sees it as that student', r.json && r.json.viewingAs && r.json.user && r.json.user.username === 'selftest-helper', r.text.slice(0, 200));
  r = await call('/api/admin/view-as', { stop: true }, 'sub');
  r = await call('/api/account/me', undefined, 'sub'); check('back to sub-admin after viewing as a student', r.json && r.json.admin && r.json.subAdmin && !r.json.viewingAs, r.text.slice(0, 200));
  r = await call('/api/admin/view-as', { id: helperId }, 'sub');
  r = await call('/api/admin/subadmin', { id: subId, on: false }, 'admin'); check('admin can remove a sub-admin', r.status === 200, r.text);
  r = await call('/api/admin/logs?days=1', undefined, 'sub'); check('removed sub-admin loses admin access immediately', r.status === 401, r.status);
  r = await call('/api/account/me', undefined, 'sub'); check('removed sub-admin loses the student they were viewing as', r.json && !r.json.user && !r.json.admin, r.text.slice(0, 200));
  r = await call('/api/admin/logs?days=1', undefined, 'admin');
  check('sub-admin changes are in the log', r.json && r.json.events.some(e => e.type === 'admin-subadmin-remove') && r.json.events.some(e => e.subAdmin === 'selftest-sub'), r.text.slice(0, 200));

  finish();
})();
