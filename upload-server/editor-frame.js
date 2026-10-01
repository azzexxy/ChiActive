/* ChiActive Studio editor, injected into a design page shown inside the Studio.
   Every editable block (marked data-ca-b by the server) gets a pencil and a trash icon.
   The page runs in a sandboxed frame, so all saving goes through the Studio window
   (postMessage), which asks for confirmation first and then saves to GitHub. */
(function () {
  'use strict';
  if (window.__caEditor) return;
  window.__caEditor = true;
  var PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
  var NAMES = { H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading', H5: 'heading', H6: 'heading', P: 'text', A: 'link', BUTTON: 'button', LI: 'list item',
    LABEL: 'label', TD: 'table cell', TH: 'table heading', BLOCKQUOTE: 'quote', FIGCAPTION: 'caption', SUMMARY: 'question', 'CA-TEXT': 'text', LEGEND: 'label', CAPTION: 'caption' };
  var ONE_LINE = /^(H[1-6]|A|BUTTON|LI|LABEL|TD|TH|SUMMARY|LEGEND|CAPTION|SPAN|SMALL|STRONG|EM|B|I|TIME|CA-TEXT|DT)$/;

  /* ---------- talking to the Studio ---------- */
  var seq = 0, waiting = {};
  function send(msg) { try { parent.postMessage(Object.assign({ caEditor: true }, msg), '*'); } catch (e) {} }
  function ask(msg) { msg.id = ++seq; send(msg); return new Promise(function (resolve) { waiting[msg.id] = resolve; }); }
  window.addEventListener('message', function (e) {
    if (e.source !== parent || !e.data || !e.data.caStudio) return;
    var d = e.data;
    if (d.type === 'result' && waiting[d.id]) { waiting[d.id](d); delete waiting[d.id]; }
    if (d.type === 'scrollTo') window.scrollTo(0, d.y || 0);
    if (d.type === 'flash') { var el = byIndex(d.block); if (el) { el.scrollIntoView({ block: 'center' }); flash(el); } }
  });

  /* ---------- blocks and their icons ---------- */
  var blocks = [].slice.call(document.querySelectorAll('[data-ca-b]'));
  function byIndex(i) { return document.querySelector('[data-ca-b="' + i + '"]'); }
  function kind(el) { return NAMES[el.tagName] || 'text'; }
  function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  var layer = document.createElement('div');
  layer.id = 'ca-layer';
  document.body.appendChild(layer);
  var tools = [];
  blocks.forEach(function (el) {
    var t = document.createElement('div');
    t.className = 'ca-tools';
    t.setAttribute('data-block', el.getAttribute('data-ca-b'));
    var what = kind(el) + ': ' + clip(el.textContent, 40);
    t.innerHTML = '<button type="button" class="ca-btn ca-edit" data-act="edit" title="Edit this ' + kind(el) + '">' + PENCIL + '</button>' +
      '<button type="button" class="ca-btn ca-del" data-act="delete" title="Delete this ' + kind(el) + '">' + TRASH + '</button>';
    t.children[0].setAttribute('aria-label', 'Edit ' + what);
    t.children[1].setAttribute('aria-label', 'Delete ' + what);
    layer.appendChild(t);
    tools.push({ el: el, t: t });
    function on() { el.classList.add('ca-hover'); t.classList.add('on'); }
    function off() { el.classList.remove('ca-hover'); t.classList.remove('on'); }
    el.addEventListener('mouseenter', on); el.addEventListener('mouseleave', off);
    t.addEventListener('mouseenter', on); t.addEventListener('mouseleave', off);
    t.addEventListener('focusin', on); t.addEventListener('focusout', off);
  });
  var queued = false;
  function place() {
    queued = false;
    var sx = window.pageXOffset, sy = window.pageYOffset, W = document.documentElement.clientWidth;
    tools.forEach(function (x) {
      if (!x.el.isConnected) { x.t.style.display = 'none'; return; }
      var r = x.el.getBoundingClientRect();
      if (!r.width && !r.height) { x.t.style.display = 'none'; return; }
      x.t.style.display = 'flex';
      var left = Math.max(sx + 2, Math.min(sx + r.right - 8, sx + W - 62));
      var top = Math.max(0, sy + r.top - 14);
      x.t.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
    });
    if (active) placePop();
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  setInterval(schedule, 700);
  schedule();
  var scrollTimer = null;
  window.addEventListener('scroll', function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(function () { send({ type: 'scroll', y: window.pageYOffset }); }, 150); });
  function flash(el) { el.classList.add('ca-flash'); setTimeout(function () { el.classList.remove('ca-flash'); }, 1400); }

  /* ---------- clicks: our icons first, links stay inside the editor ---------- */
  window.addEventListener('click', function (e) {
    var t = e.target;
    var btn = t.closest && t.closest('#ca-layer .ca-btn');
    if (btn) {
      e.preventDefault(); e.stopPropagation();
      var el = byIndex(btn.parentNode.getAttribute('data-block'));
      if (el) { if (btn.getAttribute('data-act') === 'edit') openEditor(el); else askDelete(el); }
      return;
    }
    if (t.closest && t.closest('#ca-pop')) return;   // the edit box handles its own buttons
    if (active && active.el.contains(t)) { e.preventDefault(); return; }
    var a = t.closest && t.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    e.preventDefault();
    if (href.charAt(0) === '#') { var target = href.length > 1 && document.getElementById(decodeURIComponent(href.slice(1))); if (target) target.scrollIntoView({ behavior: 'smooth' }); return; }
    if (/^(mailto|tel|javascript|sms):/i.test(href)) return;
    send({ type: 'nav', href: a.href });
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && active) { e.preventDefault(); closeEditor(true); } }, true);

  /* ---------- editing ---------- */
  var active = null;
  function textOf(node) { return (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim(); }
  function openEditor(el) {
    if (active) { if (active.el === el) { active.input.focus(); return; } closeEditor(true); }
    var isText = el.tagName === 'CA-TEXT';
    var links = isText ? [] : (el.tagName === 'A' ? [el] : [].slice.call(el.querySelectorAll('a[href]')));
    var link = links.length === 1 ? links[0] : null;
    var multi = !isText && !ONE_LINE.test(el.tagName);
    var before = { html: el.innerHTML, text: textOf(el), href: link ? link.getAttribute('href') : null };
    var raw = el.textContent;
    var lead = (raw.match(/^\s*/) || [''])[0] ? ' ' : '', trail = (raw.match(/\s*$/) || [''])[0] ? ' ' : '';
    var pop = document.createElement('div');
    pop.id = 'ca-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Edit this ' + kind(el));
    pop.innerHTML = '<div class="ca-title">Edit this ' + kind(el) + '</div>' +
      '<div class="ca-input" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="' + multi + '"></div>' +
      (link ? '<label class="ca-field"><span class="ca-flabel">' + (el.tagName === 'A' ? 'Link goes to' : 'The link in this text goes to') + '</span><input class="ca-href" type="text" spellcheck="false"></label>' : '') +
      '<div class="ca-tip">' + (isText ? 'Enter saves.' : 'Enter saves' + (multi ? ', Shift+Enter starts a new line' : '') + '. Ctrl/⌘+B bold, Ctrl/⌘+I italic.') + ' You’ll be asked to confirm.</div>' +
      '<div class="ca-actions"><button type="button" class="ca-b2 ca-cancel">Cancel</button><button type="button" class="ca-b2 ca-save">Save…</button></div>' +
      '<div class="ca-msg" role="status"></div>';
    document.body.appendChild(pop);
    var input = pop.querySelector('.ca-input'), hrefInput = pop.querySelector('.ca-href');
    if (isText) input.textContent = before.text; else input.innerHTML = el.innerHTML;
    // some browsers (or the design's own styles) won't let you type in a rich text box: use a plain text box instead
    var plain = /[?&]caPlain=1/.test(location.search) || window.__CA_PLAIN || !input.isContentEditable || /read-only/.test(getComputedStyle(input).webkitUserModify || '');
    if (plain) {
      var ta = document.createElement('textarea');
      ta.className = 'ca-input'; ta.setAttribute('spellcheck', 'true'); ta.setAttribute('aria-label', 'Text');
      ta.value = isText ? before.text : (input.innerText || el.innerText || before.text).replace(/[ \t]+\n/g, '\n').trim();
      if (!multi) ta.rows = 2;
      input.parentNode.replaceChild(ta, input); input = ta;
      if (!isText) pop.querySelector('.ca-tip').textContent = 'Enter saves' + (multi ? ', Shift+Enter starts a new line' : '') + '. Bold/italic in this text is simplified to plain text. You’ll be asked to confirm.';
    }
    if (hrefInput) hrefInput.value = before.href || '';
    active = { el: el, pop: pop, input: input, hrefInput: hrefInput, link: link, before: before, isText: isText, multi: multi, lead: lead, trail: trail, plain: plain };
    el.classList.add('ca-editing');
    document.body.classList.add('ca-busy');
    function sync() {
      if (isText) el.textContent = lead + valueText(active).replace(/\s+/g, ' ').trim() + trail;
      else el.innerHTML = valueHtml(active);
      if (link && hrefInput) {
        var v = hrefInput.value.trim();
        if (el.tagName === 'A') el.setAttribute('href', v);
        else { var inner = input.querySelector('a[href]'); if (inner) inner.setAttribute('href', v); var live = el.querySelector('a[href]'); if (live) live.setAttribute('href', v); }
      }
      schedule();
    }
    input.addEventListener('input', sync);
    if (hrefInput) hrefInput.addEventListener('input', sync);
    input.addEventListener('paste', function (e) {
      if (plain) return;
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
      document.execCommand('insertText', false, isText ? text.replace(/\s+/g, ' ') : text);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
      else if (e.key === 'Enter' && e.shiftKey) { if (plain) { if (!multi) e.preventDefault(); return; } e.preventDefault(); if (multi) document.execCommand('insertLineBreak'); }
      if ((e.ctrlKey || e.metaKey) && /^[biu]$/i.test(e.key) && isText) e.preventDefault();   // loose text can't hold formatting
    });
    if (hrefInput) hrefInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    pop.querySelector('.ca-cancel').addEventListener('click', function () { closeEditor(true); });
    pop.querySelector('.ca-save').addEventListener('click', save);
    placePop();
    input.focus();
    if (plain) { try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {} }
    else { var range = document.createRange(); range.selectNodeContents(input); range.collapse(false); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
  }
  function escHtml(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function valueText(a) { return a.plain ? a.input.value : a.input.innerText; }
  // what goes into the element: the rich box's HTML, or the plain box's text (keeping a single link when the whole text was that link)
  function valueHtml(a) {
    if (!a.plain) return a.input.innerHTML;
    var t = a.input.value.replace(/\r/g, '').trim(), html = escHtml(t).replace(/\n/g, a.multi ? '<br>' : ' ');
    var only = a.el.children.length === 1 && a.el.children[0].tagName === 'A' && textOf(a.el.children[0]) === a.before.text ? a.el.children[0] : null;
    if (only && a.el.tagName !== 'A') return '<a href="' + escHtml(a.hrefInput ? a.hrefInput.value.trim() : only.getAttribute('href') || '') + '">' + html + '</a>';
    return html;
  }
  function placePop() {
    if (!active) return;
    var r = active.el.getBoundingClientRect(), W = document.documentElement.clientWidth;
    var w = active.pop.offsetWidth || 420;
    var left = Math.max(8, Math.min(r.left, W - w - 8)) + window.pageXOffset;
    var top = r.bottom + 12 + window.pageYOffset;
    active.pop.style.left = Math.round(left) + 'px';
    active.pop.style.top = Math.round(top) + 'px';
  }
  function msg(text) { if (active) active.pop.querySelector('.ca-msg').textContent = text || ''; }
  function busy(on) { if (!active) return; [].forEach.call(active.pop.querySelectorAll('button, .ca-href'), function (b) { b.disabled = on; }); if (active.plain) active.input.readOnly = on; else active.input.contentEditable = on ? 'false' : 'true'; active.pop.querySelector('.ca-save').textContent = on ? 'Waiting…' : 'Save…'; }
  function closeEditor(revert) {
    if (!active) return;
    var a = active;
    if (revert) { a.el.innerHTML = a.before.html; if (a.link && a.el.tagName === 'A') { if (a.before.href == null) a.el.removeAttribute('href'); else a.el.setAttribute('href', a.before.href); } }
    a.pop.remove();
    a.el.classList.remove('ca-editing');
    document.body.classList.remove('ca-busy');
    active = null;
    schedule();
  }
  function save() {
    var a = active; if (!a) return;
    var after = a.isText || a.plain ? valueText(a).replace(/\s+/g, ' ').trim() : textOf(a.input);
    var afterHref = a.hrefInput ? a.hrefInput.value.trim() : null;
    if (!after) { msg('The text is empty. To remove it, press Cancel and use the trash icon.'); return; }
    if ((a.isText || a.plain ? after === a.before.text : a.input.innerHTML === a.before.html) && afterHref === (a.before.href == null ? null : a.before.href)) { closeEditor(false); return; }
    msg(''); busy(true);
    ask({ type: 'ask', action: 'edit', block: +a.el.getAttribute('data-ca-b'), kind: kind(a.el),
      before: a.before.text, after: after, beforeHref: a.before.href, afterHref: afterHref,
      html: a.isText ? null : valueHtml(a), text: a.isText ? after : null, href: a.el.tagName === 'A' ? afterHref : null
    }).then(function (r) {
      if (active !== a) return;
      busy(false);
      if (r.ok) { closeEditor(false); flash(a.el); }
      else if (r.cancelled) { msg('Not saved. Keep editing, or press Cancel to undo.'); a.input.focus(); }
      else msg(r.message || 'Saving didn’t work. Try again.');
    });
  }
  function askDelete(el) {
    if (active) closeEditor(true);
    el.classList.add('ca-deleting');
    ask({ type: 'ask', action: 'delete', block: +el.getAttribute('data-ca-b'), kind: kind(el), before: textOf(el) }).then(function (r) {
      el.classList.remove('ca-deleting');
      if (r.ok) { el.style.display = 'none'; schedule(); }
    });
  }

  send({ type: 'ready', count: blocks.length, title: document.title });
})();
