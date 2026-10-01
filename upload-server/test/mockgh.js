/* In-memory GitHub API stand-in (git data, contents, refs, raw) for local tests and the AI fixer's self-test. */
// Tiny in-memory GitHub API for tests (git data, contents, refs, branches).
const http = require('http'); const crypto = require('crypto');
const blobs = {}, trees = { t0: {} }, commits = { c0: { tree: 't0', parents: [] } }, refs = { main: 'c0' };
let n = 0; const id = p => p + (++n);
const blobOf = b64 => { const s = 'b' + crypto.createHash('sha1').update(b64).digest('hex').slice(0, 10); blobs[s] = b64; return s; };
let stats = { blobPosts: 0, bigBody: 0, lenMismatch: 0 };
function listing(t, path) {
  const out = {}; const pre = path ? path + '/' : '';
  for (const k of Object.keys(t)) if (k.startsWith(pre)) { const rest = k.slice(pre.length); const name = rest.split('/')[0]; if (rest.includes('/')) out[name] = { type: 'dir', name, path: pre + name, sha: 'd:' + pre + name }; else out[name] = { type: 'file', name, path: k, sha: t[k], size: Buffer.from(blobs[t[k]], 'base64').length }; }
  return Object.values(out);
}
function handler(req, res) {
  const chunks = []; req.on('data', d => chunks.push(d)); req.on('end', () => {
    const raw = Buffer.concat(chunks); if (raw.length > 1e6) stats.bigBody++;
    if (req.headers['content-length'] && +req.headers['content-length'] !== raw.length) stats.lenMismatch++;
    const u = new URL(req.url, 'http://x'); const p = u.pathname; let j = null; try { j = raw.length ? JSON.parse(raw) : null; } catch (e) { }
    const ok = (o, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    let m;
    if (p === '/__stats') return ok(stats);
    if (req.method === 'GET' && (m = p.match(/^\/raw\/[^/]+\/[^/]+\/([^/]+)\/(.+)$/))) {
      const ref = decodeURIComponent(m[1]); const csha = refs[ref] || (commits[ref] ? ref : null);
      const path = m[2].split('/').map(decodeURIComponent).join('/');
      const t = csha && trees[commits[csha].tree]; if (!t || !t[path]) { res.writeHead(404); return res.end('404: Not Found'); }
      res.writeHead(200); return res.end(Buffer.from(blobs[t[path]], 'base64'));
    }
    if (req.headers.authorization !== 'Bearer testtoken') return ok({ message: 'Bad credentials' }, 401);
    if (process.env.MOCK_FAIL === 'blobs' && /\/git\/blobs$/.test(p)) return ok({ message: 'Resource not accessible by personal access token' }, 403);
    if (req.method === 'GET' && (m = p.match(/\/git\/ref\/heads\/(.+)$/))) return refs[m[1]] ? ok({ object: { sha: refs[m[1]] } }) : ok({ message: 'Not Found' }, 404);
    if (req.method === 'POST' && /\/git\/refs$/.test(p)) { refs[j.ref.replace('refs/heads/', '')] = j.sha; return ok({ ref: j.ref }, 201); }
    if (req.method === 'GET' && (m = p.match(/\/git\/commits\/(\w+)$/))) return ok({ tree: { sha: commits[m[1]].tree } });
    if (req.method === 'POST' && /\/git\/blobs$/.test(p)) { stats.blobPosts++; if (!j) return ok({ message: 'Problems parsing JSON' }, 400); return ok({ sha: blobOf(j.encoding === 'base64' ? j.content : Buffer.from(j.content).toString('base64')) }, 201); }
    // like GitHub push protection: refuse content that contains a secret key
    const SECRET = /AKIA[0-9A-Z]{16}|sk-ant-[A-Za-z0-9_-]{20,}/;
    if (req.method === 'POST' && (/\/git\/trees$/.test(p) && j && j.tree.some(e => e.content && SECRET.test(e.content)) || /\/git\/blobs$/.test(p) && j && SECRET.test(j.encoding === 'base64' ? Buffer.from(j.content, 'base64').toString() : j.content)))
      return ok({ message: 'Repository rule violations found\n\nSecret detected in content' }, 409);
    if (req.method === 'POST' && /\/git\/trees$/.test(p)) {
      const t = Object.assign({}, j.base_tree ? trees[j.base_tree] : {});
      for (const e of j.tree) {
        const drop = pre => Object.keys(t).forEach(k => { if (k === pre || k.startsWith(pre + '/')) delete t[k]; });
        if (e.sha === null) { drop(e.path); continue; }
        if (e.type === 'tree') { drop(e.path); for (const [k, v] of Object.entries(trees[e.sha])) t[e.path + '/' + k] = v; continue; }
        t[e.path] = e.content != null ? blobOf(Buffer.from(e.content).toString('base64')) : e.sha;
      }
      const s = id('t'); trees[s] = t; return ok({ sha: s }, 201);
    }
    if (req.method === 'POST' && /\/git\/commits$/.test(p)) { const s = id('c'); commits[s] = { tree: j.tree, message: j.message, parents: j.parents }; return ok({ sha: s }, 201); }
    if (req.method === 'PATCH' && (m = p.match(/\/git\/refs\/heads\/(.+)$/))) { refs[m[1]] = j.sha; return ok({ object: { sha: j.sha } }); }
    if ((m = p.match(/\/contents\/(.+)$/)) || /\/contents$/.test(p)) {
      const path = m ? decodeURI(m[1]) : '';
      const branch = u.searchParams.get('ref') || (j && j.branch) || 'main';
      const csha = refs[branch] || (commits[branch] ? branch : null);
      if (!csha) return ok({ message: 'No commit found for the ref ' + branch }, 404);
      const t = trees[commits[csha].tree];
      if (req.method === 'GET') {
        if (t[path] && /raw/.test(req.headers.accept || '')) { res.writeHead(200); return res.end(Buffer.from(blobs[t[path]], 'base64')); }
        if (t[path]) return ok({ type: 'file', name: path.split('/').pop(), path, sha: t[path], size: Buffer.from(blobs[t[path]], 'base64').length, content: blobs[t[path]], encoding: 'base64' });
        const l = listing(t, path); return l.length ? ok(l) : ok({ message: 'Not Found' }, 404);
      }
      if (req.method === 'PUT') {
        if (t[path] && j.sha !== t[path]) return ok({ message: 'sha does not match' }, 409);
        const nt = Object.assign({}, t); nt[path] = blobOf(j.content); const ts = id('t'); trees[ts] = nt;
        const c = id('c'); commits[c] = { tree: ts, message: j.message, parents: [refs[branch]] }; refs[branch] = c;
        return ok({ content: { sha: nt[path] } }, 201);
      }
    }
    if (req.method === 'GET' && (m = p.match(/\/git\/trees\/(.+)$/))) {
      const sha = decodeURIComponent(m[1]); const t = trees[commits[refs.main].tree];
      if (!sha.startsWith('d:')) return ok({ message: 'Not Found' }, 404);
      const pre = sha.slice(2) + '/';
      return ok({ sha, tree: Object.keys(t).filter(k => k.startsWith(pre)).map(k => ({ path: k.slice(pre.length), type: 'blob', sha: t[k] })) });
    }
    if (req.method === 'GET' && (m = p.match(/\/git\/blobs\/(\w+)$/))) return blobs[m[1]] ? ok({ content: blobs[m[1]], encoding: 'base64' }) : ok({ message: 'Not Found' }, 404);
    if (req.method === 'GET' && p === '/__dump') { const t = trees[commits[refs.main].tree]; const man = t['designs/manifest.json'];
      return ok({ files: Object.keys(t).sort(), manifest: man ? JSON.parse(Buffer.from(blobs[man], 'base64').toString()) : null, message: commits[refs.main].message, branches: Object.keys(refs), logFiles: refs['activity-log'] ? Object.keys(trees[commits[refs['activity-log']].tree]) : [] }); }
    if (req.method === 'GET' && p === '/__blob') { const t = trees[commits[refs[u.searchParams.get('b') || 'main']].tree]; const s = t[u.searchParams.get('path')]; return s ? (res.writeHead(200), res.end(Buffer.from(blobs[s], 'base64'))) : ok({ message: 'no' }, 404); }
    ok({ message: 'nope ' + req.method + ' ' + p }, 404);
  });
}
// a small in-memory copy of the GitHub API, used by the self-test
module.exports.start = (port = 0) => new Promise(r => { const srv = http.createServer(handler); srv.listen(port, '127.0.0.1', () => r(srv)); });
if (require.main === module) module.exports.start(+process.argv[2] || 8899).then(s => console.log('mock GitHub on', s.address().port));
