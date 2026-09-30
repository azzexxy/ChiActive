/* ChiActive activity beacons: tells the upload server (admin log) when someone opens the
   gallery, views a design or clicks to another page in it, and when an upload fails in the
   browser. Sends a random visitor id (kept in this browser) and the student name only if
   this browser uploaded a design before. Nothing is sent if no upload server is set. */
(function () {
  var C = window.CHIACTIVE || {};
  var API = (C.uploadApi || '').replace(/\/+$/, '');
  function visitor() {
    try { var v = localStorage.getItem('chiactive-visitor'); if (!v) { v = Math.random().toString(36).slice(2, 10); localStorage.setItem('chiactive-visitor', v); } return v; } catch (e) { return ''; }
  }
  function student() { try { return localStorage.getItem('chiactive-student') || ''; } catch (e) { return ''; } }
  window.chiVisitor = visitor;
  window.chiTrack = function (type, data) {
    if (!API) return;
    var body = { type: type, visitor: visitor(), path: location.pathname };
    var st = student(); if (st) body.student = st;
    for (var k in data || {}) if (data[k] != null && data[k] !== '') body[k] = data[k];
    var json = JSON.stringify(body);
    try { if (navigator.sendBeacon && navigator.sendBeacon(API + '/api/event', new Blob([json], { type: 'text/plain' }))) return; } catch (e) {}
    try { fetch(API + '/api/event', { method: 'POST', body: json, headers: { 'Content-Type': 'text/plain' }, keepalive: true, mode: 'cors' }).catch(function () {}); } catch (e) {}
  };
})();
