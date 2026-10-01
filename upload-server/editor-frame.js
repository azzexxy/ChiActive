/* ChiActive Studio editor, injected into a design page shown inside the Studio.
   Every editable block (marked data-ca-b by the server) gets a pencil and a trash icon.
   The page runs in a sandboxed frame, so all saving goes through the Studio window
   (postMessage), which asks for confirmation first and then saves to GitHub. */
(function () {
  'use strict';
  if (window.__caEditor) return;
  window.__caEditor = true;
  var PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var MORE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>';
  var PHOTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>';
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
    if (d.type === 'image') {   // a saved picture shows right away, no reload
      var im = document.querySelector('img[data-ca-i="' + d.index + '"]');
      if (im) { if (d.src) { im.removeAttribute('srcset'); im.removeAttribute('sizes'); if (im.parentNode && im.parentNode.tagName === 'PICTURE') [].slice.call(im.parentNode.querySelectorAll('source')).forEach(function (x) { x.remove(); }); im.src = d.src; } if (d.alt != null) im.setAttribute('alt', d.alt); flash(im); }
    }
    if (d.type === 'bg') {   // a replaced background picture, everywhere on this page
      var want = DESIGN + d.path.split('/').map(encodeURIComponent).join('/');
      [].slice.call(document.querySelectorAll('body *')).forEach(function (x) {
        var v = getComputedStyle(x).backgroundImage;
        if (v && v.indexOf('url(') > -1 && (v.indexOf(want) > -1 || v.indexOf(DESIGN + d.path) > -1)) { x.style.backgroundImage = v.replace(/url\(["']?([^"')]+)["']?\)/g, function (m, u) { return u.split(/[?#]/)[0] === want || u.split(/[?#]/)[0] === DESIGN + d.path ? 'url("' + d.src + '")' : m; }); flash(x); }
      });
    }
    if (d.type === 'flash') { var el = byIndex(d.block); if (el) { el.scrollIntoView({ block: 'center' }); flash(el); } }
  });

  /* ---------- one toolbar that follows the element under the pointer ---------- */
  var blocks = [].slice.call(document.querySelectorAll('[data-ca-b]'));
  function byIndex(i) { return document.querySelector('[data-ca-b="' + i + '"]'); }
  function kind(el) { return NAMES[el.tagName] || 'text'; }
  function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  var layer = document.createElement('div');
  layer.id = 'ca-layer';
  document.body.appendChild(layer);
  var bar = document.createElement('div');
  bar.id = 'ca-bar'; bar.setAttribute('role', 'toolbar'); bar.hidden = true;
  layer.appendChild(bar);
  var CA = window.__CA || {};
  var DESIGN = (function () { try { return new URL('/d/' + CA.folder + '/', document.baseURI).href; } catch (e) { return ''; } })();
  // a background picture from this design (set in CSS or a style attribute)
  function bgOf(el) {
    var v = getComputedStyle(el).backgroundImage, m = v && v !== 'none' && v.match(/url\(["']?([^"')]+)["']?\)/);
    if (!m || !DESIGN || m[1].indexOf(DESIGN) !== 0) return null;
    var path = decodeURIComponent(m[1].slice(DESIGN.length).split(/[?#]/)[0]);
    return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(path) ? { abs: m[1], path: path } : null;
  }
  function targetFrom(t) {
    if (!t || !t.closest || t.closest('#ca-layer') || t.closest('#ca-pop')) return null;
    var b = t.closest('[data-ca-b]'); if (b) return { el: b, type: 'block' };
    var im = t.closest('img[data-ca-i]'); if (im) return { el: im, type: 'img' };
    var pic = t.closest('picture'); if (pic && pic.querySelector('img[data-ca-i]')) return { el: pic.querySelector('img[data-ca-i]'), type: 'img' };
    for (var n = t, i = 0; n && n.nodeType === 1 && n !== document.documentElement && i < 10; n = n.parentElement, i++) { var bg = bgOf(n); if (bg) return { el: n, type: 'bg', bg: bg }; }
    return null;
  }
  var cur = null, pending = null, hideTimer = null, rafOn = false;
  function buttons(tg) {
    var b = function (act, icon, title, cls) { return '<button type="button" class="ca-btn ' + (cls || '') + '" data-act="' + act + '" title="' + title + '" aria-label="' + title + '">' + icon + '</button>'; };
    if (tg.type === 'img') return '<span class="ca-lbl">picture</span>' + b('image', PENCIL, 'Change this picture', 'ca-edit') + b('image-delete', TRASH, 'Delete this picture', 'ca-del');
    if (tg.type === 'bg') return '<span class="ca-lbl">background picture</span>' + b('bg', PENCIL, 'Change this background picture', 'ca-edit');
    var k = kind(tg.el);
    return '<span class="ca-lbl">' + k + '</span>' + b('edit', PENCIL, 'Edit this ' + k, 'ca-edit') + b('delete', TRASH, 'Delete this ' + k, 'ca-del') + (tg.el.tagName === 'CA-TEXT' ? '' : b('more', MORE, 'Move or duplicate', 'ca-more'));
  }
  function show(tg) {
    clearTimeout(pending); clearTimeout(hideTimer);
    if (active || menu) return;   // keep the toolbar on what's being edited
    if (cur && tg && cur.el === tg.el) return;
    if (cur) cur.el.classList.remove('ca-hover');
    cur = tg;
    if (!cur) { bar.hidden = true; return; }
    cur.el.classList.add('ca-hover');
    bar.innerHTML = buttons(cur); bar.hidden = false;
    place();
    if (!rafOn) { rafOn = true; requestAnimationFrame(loop); }
  }
  function soon(tg, ms) { clearTimeout(pending); pending = setTimeout(function () { show(tg); }, ms); }
  // follows the element every frame, so it stays put while scrolling, in sticky headers and during animations
  function loop() {
    if (!cur && !active) { rafOn = false; return; }
    place(); if (active) placePop();
    requestAnimationFrame(loop);
  }
  function place() {
    if (!cur) return;
    if (!cur.el.isConnected) { show(null); return; }
    var r = cur.el.getBoundingClientRect(), W = document.documentElement.clientWidth, H = window.innerHeight;
    if (r.bottom < 0 || r.top > H || (!r.width && !r.height)) { bar.style.visibility = 'hidden'; return; }
    bar.style.visibility = '';
    var bw = bar.offsetWidth, bh = bar.offsetHeight, top, left;
    if (cur.type === 'block') { top = r.top - bh - 3; if (top < 2) top = Math.min(r.bottom + 3, H - bh - 2); left = r.right - bw; }
    else { top = Math.max(2, r.top + 8); left = Math.min(r.right, W) - bw - 8; }
    left = Math.max(2, Math.min(left, W - bw - 2));
    bar.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
  }
  var touchMode = false;   // phones send imitation mouse events after a tap; those must not move or hide the toolbar
  document.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') touchMode = false; }, true);
  document.addEventListener('mouseover', function (e) {
    if (touchMode) return;
    if (bar.contains(e.target) || (menu && menu.contains(e.target))) { clearTimeout(pending); clearTimeout(hideTimer); return; }
    var tg = targetFrom(e.target);
    if (!tg) { clearTimeout(pending); clearTimeout(hideTimer); hideTimer = setTimeout(function () { show(null); }, 350); return; }
    soon(tg, cur && cur.el !== tg.el ? 140 : 0);   // a short pause lets you move onto the toolbar
  }, true);
  document.addEventListener('mouseleave', function () { if (!touchMode) hideTimer = setTimeout(function () { show(null); }, 350); });
  document.addEventListener('focusin', function (e) { var tg = targetFrom(e.target); if (tg) show(tg); }, true);
  // touch screens: the first tap picks an element (shows its toolbar), the next tap acts on it
  var swallowClick = false;
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    touchMode = true;
    if (bar.contains(e.target) || (menu && menu.contains(e.target))) return;
    var tg = targetFrom(e.target);
    if (tg && (!cur || cur.el !== tg.el) && !active) { show(tg); swallowClick = true; }
    else if (!tg && !active && !(e.target.closest && e.target.closest('#ca-pop'))) show(null);
  }, true);
  window.addEventListener('resize', function () { place(); if (active) placePop(); });
  var menu = null;
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function openMenu(btn, el) {
    closeMenu();
    menu = document.createElement('div'); menu.id = 'ca-menu'; menu.setAttribute('role', 'menu');
    menu.innerHTML = '<button type="button" role="menuitem" data-m="move-up">↑ Move up</button><button type="button" role="menuitem" data-m="move-down">↓ Move down</button><button type="button" role="menuitem" data-m="duplicate">⧉ Duplicate</button>';
    layer.appendChild(menu);
    var r = btn.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(r.right - 170, document.documentElement.clientWidth - 174)) + 'px';
    menu.style.top = Math.min(r.bottom + 6, window.innerHeight - 150) + 'px';
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]'); if (!b) return;
      e.preventDefault(); e.stopPropagation(); closeMenu();
      ask({ type: 'ask', action: b.getAttribute('data-m'), block: +el.getAttribute('data-ca-b'), kind: kind(el), before: textOf(el) });
    });
    menu.querySelector('button').focus();
  }
  function schedule() { place(); }
  var scrollTimer = null;
  window.addEventListener('scroll', function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(function () { send({ type: 'scroll', y: window.pageYOffset }); }, 150); });
  function flash(el) { el.classList.add('ca-flash'); setTimeout(function () { el.classList.remove('ca-flash'); }, 1400); }

  var lastTouchAct = 0;
  function barAction(btn) {
    if (!cur) return;
    var act = btn.getAttribute('data-act'), el = cur.el;
    if (act === 'image' || act === 'image-delete') { closeMenu(); if (active) closeEditor(true); ask({ type: 'ask', action: act, block: +el.getAttribute('data-ca-i'), kind: 'picture', src: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '', before: el.getAttribute('alt') || el.getAttribute('src') || 'picture' }); return; }
    if (act === 'bg') { closeMenu(); if (active) closeEditor(true); ask({ type: 'ask', action: 'bg', kind: 'background picture', path: cur.bg.path, src: cur.bg.abs, before: cur.bg.path }); return; }
    if (act === 'edit') { closeMenu(); openEditor(el); } else if (act === 'more') { if (menu) closeMenu(); else openMenu(btn, el); } else { closeMenu(); askDelete(el); }
  }
  // on touch screens act when the finger lifts: some sites cancel the click that would follow a tap
  document.addEventListener('pointerup', function (e) {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    var t = e.target, btn = t.closest && t.closest('#ca-bar .ca-btn'), mi = t.closest && t.closest('#ca-menu [data-m]');
    if (btn && cur) { lastTouchAct = Date.now(); e.preventDefault(); barAction(btn); }
    else if (mi) { e.preventDefault(); mi.click(); lastTouchAct = Date.now(); }
  }, true);

  /* ---------- clicks: our icons first, links stay inside the editor ---------- */
  window.addEventListener('click', function (e) {
    var t = e.target;
    var btn = t.closest && t.closest('#ca-bar .ca-btn');
    if (btn && cur) {
      e.preventDefault(); e.stopPropagation();
      if (Date.now() - lastTouchAct < 800) return;   // already handled when the finger lifted
      barAction(btn);
      return;
    }
    var mi = t.closest && t.closest('#ca-menu [data-m]');
    if (mi && Date.now() - lastTouchAct < 800) { e.preventDefault(); e.stopPropagation(); return; }
    if (swallowClick) { swallowClick = false; if (!(t.closest && (t.closest('#ca-pop') || t.closest('#ca-menu')))) { e.preventDefault(); e.stopPropagation(); return; } }
    if (menu && !(t.closest && t.closest('#ca-menu'))) closeMenu();
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
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu) { closeMenu(); return; } if (e.key === 'Escape' && active) { e.preventDefault(); closeEditor(true); } }, true);

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
    if (!rafOn) { rafOn = true; requestAnimationFrame(loop); }
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

  send({ type: 'ready', count: blocks.length, images: document.querySelectorAll('img[data-ca-i]').length, title: document.title });
})();
