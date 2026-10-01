/* Editable "building blocks" in a design's HTML.
 *
 * A block is either
 *   - an element that holds only text and inline formatting (h1-h6, p, li, a, button, label,
 *     td, blockquote, span, div, …) and isn't inside another block, or
 *   - a loose piece of text next to non-inline things (e.g. "Name" in <label>Name <input></label>).
 * Blocks are numbered in document order. The same numbering is used to show the pencil/trash
 * icons (annotate) and to apply a change to the original source (applyEdit / applyDelete),
 * so the rest of the file is never re-formatted: only the edited range changes.
 */
'use strict';
const { parse, parseFragment, serialize } = require('parse5');

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const SKIP = new Set(['head', 'script', 'style', 'template', 'noscript', 'svg', 'math', 'iframe', 'textarea', 'select', 'option',
  'video', 'audio', 'canvas', 'object', 'picture', 'map', 'input', 'img']);
const BLOCK = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'figcaption', 'label', 'td', 'th', 'dt', 'dd',
  'button', 'a', 'summary', 'caption', 'legend', 'div', 'span', 'small', 'strong', 'em', 'b', 'i', 'address', 'pre', 'time', 'cite', 'q', 'mark', 'code']);
const INLINE = new Set(['a', 'b', 'strong', 'i', 'em', 'u', 's', 'br', 'span', 'small', 'sub', 'sup', 'code', 'mark', 'abbr', 'time',
  'q', 'cite', 'kbd', 'del', 'ins', 'wbr', 'bdi', 'bdo', 'var', 'samp', 'data']);

const isEl = n => n && n.tagName && n.namespaceURI === HTML_NS;
function hasText(n) { return (n.childNodes || []).some(c => (c.nodeName === '#text' && /\S/.test(c.value)) || (isEl(c) && hasText(c))); }
function allInline(n) { return (n.childNodes || []).every(c => !c.tagName || (isEl(c) && INLINE.has(c.tagName) && allInline(c))); }
function textOf(n) { return n.nodeName === '#text' ? n.value : (n.childNodes || []).map(textOf).join(''); }
function innerRange(el) {
  const loc = el.sourceCodeLocation;
  return [loc.startTag.endOffset, loc.endTag ? loc.endTag.startOffset : loc.endOffset];
}

function stripBom(src) { return src.charCodeAt(0) === 0xFEFF ? ['﻿', src.slice(1)] : ['', src]; }

function findBlocks(src) {
  const doc = parse(src, { sourceCodeLocationInfo: true });
  const blocks = [];
  (function walk(node) {
    for (const c of node.childNodes || []) {
      if (c.nodeName === '#text') {
        if (/\S/.test(c.value) && c.sourceCodeLocation) blocks.push({ kind: 'text', node: c });
        continue;
      }
      if (!isEl(c) || SKIP.has(c.tagName)) continue;
      const loc = c.sourceCodeLocation;
      if (BLOCK.has(c.tagName) && loc && loc.startTag && hasText(c) && allInline(c)) { blocks.push({ kind: 'el', node: c }); continue; }
      walk(c.content || c);
    }
  })(doc);
  return { doc, blocks };
}

// every <img> in the page (in document order), also those inside <picture>; numbered separately from text blocks
const IMG_SKIP = new Set(['head', 'script', 'style', 'template', 'noscript', 'svg', 'math', 'iframe', 'textarea', 'select', 'object']);
function findImages(src) {
  const doc = parse(src, { sourceCodeLocationInfo: true });
  const imgs = [];
  (function walk(node) {
    for (const c of node.childNodes || []) {
      if (!isEl(c) || IMG_SKIP.has(c.tagName)) continue;
      if (c.tagName === 'img' && c.sourceCodeLocation && c.sourceCodeLocation.startTag) imgs.push(c);
      walk(c.content || c);
    }
  })(doc);
  return imgs;
}
const attr = (n, name) => { const a = n.attrs.find(x => x.name === name); return a ? a.value : null; };
function describe(b, src) {
  if (b.kind === 'text') return { kind: 'text', tag: '#text', text: b.node.value.trim() };
  const [s, e] = innerRange(b.node);
  const hrefAttr = b.node.attrs.find(a => a.name === 'href');
  return { kind: 'el', tag: b.node.tagName, text: textOf(b.node).replace(/\s+/g, ' ').trim(), html: src.slice(s, e), href: b.node.tagName === 'a' && hrefAttr ? hrefAttr.value : null };
}

function splice(src, edits) {   // edits: [{at, del, text}] applied from the end so offsets stay valid
  edits.sort((a, b) => b.at - a.at);
  for (const e of edits) src = src.slice(0, e.at) + e.text + src.slice(e.at + (e.del || 0));
  return src;
}
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Copy of the page with every block marked, plus things injected at the top of <head> and the end of <body>. */
function annotate(input, { headStart = '', bodyEnd = '' } = {}) {
  const [bom, src] = stripBom(input);
  const { doc, blocks } = findBlocks(src);
  const edits = [];
  findImages(src).forEach((img, i) => {
    let at = img.sourceCodeLocation.startTag.endOffset - 1;
    if (src[at - 1] === '/') at--;
    edits.push({ at, text: ` data-ca-i="${i}"` });
  });
  blocks.forEach((b, i) => {
    const loc = b.node.sourceCodeLocation;
    if (b.kind === 'text') { edits.push({ at: loc.startOffset, text: `<ca-text data-ca-b="${i}">` }, { at: loc.endOffset, text: '</ca-text>' }); return; }
    let at = loc.startTag.endOffset - 1;
    if (src[at - 1] === '/') at--;
    edits.push({ at, text: ` data-ca-b="${i}"` });
  });
  // where the head starts / body ends
  const html = (doc.childNodes || []).find(n => n.tagName === 'html');
  const head = html && html.childNodes.find(n => n.tagName === 'head');
  const body = html && html.childNodes.find(n => n.tagName === 'body');
  const doctype = (doc.childNodes || []).find(n => n.nodeName === '#documentType');
  let headAt = 0;
  if (head && head.sourceCodeLocation && head.sourceCodeLocation.startTag) headAt = head.sourceCodeLocation.startTag.endOffset;
  else if (html && html.sourceCodeLocation && html.sourceCodeLocation.startTag) headAt = html.sourceCodeLocation.startTag.endOffset;
  else if (doctype && doctype.sourceCodeLocation) headAt = doctype.sourceCodeLocation.endOffset;
  let bodyAt = src.length;
  if (body && body.sourceCodeLocation && body.sourceCodeLocation.endTag) bodyAt = body.sourceCodeLocation.endTag.startOffset;
  // make sure the head/body insertions land outside any block marker at the same offset
  edits.push({ at: headAt, text: headStart, prio: 1 }, { at: bodyAt, text: bodyEnd, prio: -1 });
  edits.sort((a, b) => b.at - a.at || (a.prio || 0) - (b.prio || 0));
  let out = src;
  for (const e of edits) out = out.slice(0, e.at) + e.text + out.slice(e.at);
  return { html: bom + out, count: blocks.length };
}

/* Only inline formatting survives an edit: text, links, bold, italic, line breaks, spans with their classes. */
function sanitizeInline(html) {
  const frag = parseFragment(String(html || ''));
  (function clean(node) {
    node.childNodes = (node.childNodes || []).flatMap(c => {
      if (c.nodeName === '#text') return [c];
      if (c.nodeName === '#comment') return [];
      if (!isEl(c) || !INLINE.has(c.tagName)) {          // unknown tag: keep its text only
        clean(c); return (c.childNodes || []).map(k => { k.parentNode = node; return k; });
      }
      // keep the element's own attributes (classes, data-* hooks the site's script uses) but never event handlers or script links
      c.attrs = c.attrs.filter(a => !/^on/i.test(a.name) && a.name !== 'srcdoc' && !(/^(href|src|action|formaction|xlink:href)$/i.test(a.name) && /^\s*(javascript|data|vbscript):/i.test(a.value)));
      clean(c); return [c];
    });
  })(frag);
  return serialize(frag);
}
function safeHref(h) {
  h = String(h || '').trim();
  if (!h) return '';
  if (/^\s*(javascript|data|vbscript):/i.test(h)) throw Object.assign(new Error('That link address isn’t allowed.'), { user: true, status: 400 });
  return h.slice(0, 500);
}

function pick(src, index) {
  const { blocks } = findBlocks(src);
  const b = blocks[index];
  if (!b) throw Object.assign(new Error('That piece of text no longer exists on this page. The page will reload.'), { user: true, status: 409, code: 'stale' });
  return { b, count: blocks.length };
}

function applyEdit(input, index, change) {
  const [bom, src] = stripBom(input);
  const { b } = pick(src, index);
  if (b.kind === 'text') {
    const raw = src.slice(b.node.sourceCodeLocation.startOffset, b.node.sourceCodeLocation.endOffset);
    const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
    const text = String(change.text != null ? change.text : '').replace(/\s+/g, ' ').trim();
    if (!text) throw Object.assign(new Error('The text is empty. Use the trash icon to delete it instead.'), { user: true, status: 400 });
    return bom + splice(src, [{ at: b.node.sourceCodeLocation.startOffset, del: raw.length, text: lead + escText(text) + trail }]);
  }
  const inner = sanitizeInline(change.html);
  if (!inner.replace(/<[^>]*>/g, '').trim()) throw Object.assign(new Error('The text is empty. Use the trash icon to delete it instead.'), { user: true, status: 400 });
  const [s, e] = innerRange(b.node);
  const edits = [{ at: s, del: e - s, text: inner }];
  if (b.node.tagName === 'a' && change.href != null) {
    const href = safeHref(change.href);
    const al = b.node.sourceCodeLocation.attrs && b.node.sourceCodeLocation.attrs.href;
    if (al) edits.push({ at: al.startOffset, del: al.endOffset - al.startOffset, text: href ? `href="${escAttr(href)}"` : '' });
    else if (href) { let at = b.node.sourceCodeLocation.startTag.endOffset - 1; if (src[at - 1] === '/') at--; edits.push({ at, text: ` href="${escAttr(href)}"` }); }
  }
  return bom + splice(src, edits);
}

function applyDelete(input, index) {
  const [bom, src] = stripBom(input);
  const { b } = pick(src, index);
  const loc = b.node.sourceCodeLocation;
  let s = loc.startOffset, e = loc.endOffset;
  if (b.kind === 'text') {
    const raw = src.slice(s, e);
    return bom + splice(src, [{ at: s, del: raw.length, text: /^\s/.test(raw) || /\s$/.test(raw) ? ' ' : '' }]);
  }
  // remove the whole line when the element was alone on it
  const lineStart = src.lastIndexOf('\n', s - 1) + 1, lineEnd = src.indexOf('\n', e);
  if (/^[ \t]*$/.test(src.slice(lineStart, s)) && /^[ \t]*$/.test(src.slice(e, lineEnd < 0 ? src.length : lineEnd))) { s = lineStart; e = lineEnd < 0 ? src.length : lineEnd + 1; }
  return bom + splice(src, [{ at: s, del: e - s, text: '' }]);
}

/* ---------- images ---------- */
function pickImage(src, index) {
  const img = findImages(src)[index];
  if (!img) throw Object.assign(new Error('That image no longer exists on this page. The page will reload.'), { user: true, status: 409, code: 'stale' });
  return img;
}
function imageInfo(input, index) { const [, src] = stripBom(input); const img = pickImage(src, index); return { src: attr(img, 'src') || '', alt: attr(img, 'alt') || '' }; }
// new src and/or alt text; srcset/sizes are dropped when the picture changes, or browsers keep showing the old one
function applyImage(input, index, change) {
  const [bom, src] = stripBom(input);
  const img = pickImage(src, index), loc = img.sourceCodeLocation, attrsLoc = loc.attrs || {}, edits = [];
  const set = (name, value) => {
    const al = attrsLoc[name];
    if (al && value == null) { let st = al.startOffset; while (st > 0 && /[ \t\n]/.test(src[st - 1])) st--; edits.push({ at: st, del: al.endOffset - st, text: '' }); }
    else if (al) edits.push({ at: al.startOffset, del: al.endOffset - al.startOffset, text: `${name}="${escAttr(value)}"` });
    else if (value != null) { let at = loc.startTag.endOffset - 1; if (src[at - 1] === '/') at--; edits.push({ at, text: ` ${name}="${escAttr(value)}"` }); }
  };
  if (change.src != null) {
    const v = String(change.src).trim();
    if (!v || /^\s*(javascript|vbscript):/i.test(v)) throw Object.assign(new Error('That picture address isn’t allowed.'), { user: true, status: 400 });
    if (v !== attr(img, 'src')) { set('src', v.slice(0, 2000)); if (attrsLoc.srcset) set('srcset', null); if (attrsLoc.sizes) set('sizes', null); if (attrsLoc['data-src']) set('data-src', null); }
  }
  if (change.alt != null) set('alt', String(change.alt).slice(0, 300));
  return bom + splice(src, edits);
}
function applyImageDelete(input, index) {
  const [bom, src] = stripBom(input);
  let node = pickImage(src, index);
  if (node.parentNode && node.parentNode.tagName === 'picture') node = node.parentNode;   // the whole <picture>
  return bom + removeNode(src, node);
}
function removeNode(src, node) {
  const loc = node.sourceCodeLocation;
  let s = loc.startOffset, e = loc.endOffset;
  const lineStart = src.lastIndexOf('\n', s - 1) + 1, lineEnd = src.indexOf('\n', e);
  if (/^[ \t]*$/.test(src.slice(lineStart, s)) && /^[ \t]*$/.test(src.slice(e, lineEnd < 0 ? src.length : lineEnd))) { s = lineStart; e = lineEnd < 0 ? src.length : lineEnd + 1; }
  return splice(src, [{ at: s, del: e - s, text: '' }]);
}

/* ---------- moving and duplicating a block ---------- */
function siblingEl(node, dir) {
  const kids = (node.parentNode && node.parentNode.childNodes) || [];
  let i = kids.indexOf(node) + dir;
  for (; i >= 0 && i < kids.length; i += dir) {
    const k = kids[i];
    if (k.nodeName === '#text' && !/\S/.test(k.value)) continue;
    if (k.nodeName === '#comment') continue;
    return isEl(k) && k.sourceCodeLocation ? k : null;   // loose text next to it: don't move across
  }
  return null;
}
function applyMove(input, index, dir) {
  const [bom, src] = stripBom(input);
  const { b } = pick(src, index);
  if (b.kind !== 'el') throw Object.assign(new Error('This piece of text can’t be moved on its own. Use the code editor for that.'), { user: true, status: 400 });
  const other = siblingEl(b.node, dir < 0 ? -1 : 1);
  if (!other) throw Object.assign(new Error(dir < 0 ? 'This is already the first item here.' : 'This is already the last item here.'), { user: true, status: 400, code: 'edge' });
  const [first, second] = dir < 0 ? [other, b.node] : [b.node, other];
  const a = first.sourceCodeLocation, c = second.sourceCodeLocation;
  const out = src.slice(0, a.startOffset) + src.slice(c.startOffset, c.endOffset) + src.slice(a.endOffset, c.startOffset) + src.slice(a.startOffset, a.endOffset) + src.slice(c.endOffset);
  return bom + out;
}
function applyDuplicate(input, index) {
  const [bom, src] = stripBom(input);
  const { b } = pick(src, index);
  if (b.kind !== 'el') throw Object.assign(new Error('This piece of text can’t be copied on its own. Use the code editor for that.'), { user: true, status: 400 });
  const loc = b.node.sourceCodeLocation;
  const lineStart = src.lastIndexOf('\n', loc.startOffset - 1) + 1, indent = src.slice(lineStart, loc.startOffset);
  const sep = /^[ \t]*$/.test(indent) ? '\n' + indent : ' ';
  return bom + splice(src, [{ at: loc.endOffset, text: sep + src.slice(loc.startOffset, loc.endOffset) }]);
}
function blockInfo(input, index) { const [, src] = stripBom(input); return describe(pick(src, index).b, src); }
function countBlocks(input) { return findBlocks(stripBom(input)[1]).blocks.length; }

function countImages(input) { return findImages(stripBom(input)[1]).length; }
module.exports = { annotate, applyEdit, applyDelete, blockInfo, countBlocks, sanitizeInline, findBlocks, findImages, imageInfo, applyImage, applyImageDelete, applyMove, applyDuplicate, countImages };
