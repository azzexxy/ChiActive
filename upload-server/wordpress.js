/* Turns a ChiActive design into a WordPress theme, and builds the small "ChiActive Connector" plugin
 * that lets this server publish the winning design to a WordPress site automatically.
 *
 * The theme:
 *  - keeps every file of the design in <theme>/site/ (styles, scripts, pictures, fonts stay as they are)
 *  - on activation creates one WordPress page per .html page (content in a "Custom HTML" block, so it can be
 *    edited in WordPress), sets the design's home page as the front page, and renders each page with the
 *    design's own <head> plus wp_head()/wp_footer() so plugins and the admin bar keep working
 *  - links between pages point to the WordPress pages; links made by the design's scripts (about.html,
 *    images/x.jpg) are redirected to the right page or file
 * The connector plugin checks an HMAC signature (shared secret, 5-minute window, no replays) on every
 * request, then installs the theme zip, activates it and imports the pages. */
'use strict';
const { parse } = require('parse5');
const crypto = require('crypto');

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const URL_ATTRS = new Set(['href', 'src', 'poster', 'data-src', 'action', 'data-href', 'data-background', 'data-bg']);
const SRCSET_ATTRS = new Set(['srcset', 'data-srcset']);
const phpStr = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function normalize(dir, url) {
  const parts = (dir + url).split('/'), out = [];
  for (const x of parts) { if (x === '..') out.pop(); else if (x !== '.' && x !== '') out.push(x); }
  return out.join('/') + (url.endsWith('/') && out.length ? '/' : '');
}
// one URL from the design -> a placeholder the theme fills in at render time
function mapUrl(raw, dir, has, pages) {
  const v = raw.trim();
  if (!v || v[0] === '#' || /^([a-z][a-z0-9+.-]*:|\/\/|\/|\{|%%)/i.test(v)) return null;
  const m = v.match(/^([^?#]*)([?#].*)?$/); let p = m[1], tail = m[2] || '';
  let decoded; try { decoded = decodeURI(p); } catch (e) { decoded = p; }
  let target = normalize(dir, decoded);
  if (!target || target.endsWith('/')) target = (target || '') + 'index.html';
  if (pages.has(target)) { const hash = tail.includes('#') ? tail.slice(tail.indexOf('#')) : ''; return `%%CA_PAGE:${target}%%${hash}`; }
  if (has.has(target)) return `%%CA_THEME%%/${target.split('/').map(encodeURIComponent).join('/')}${tail}`;
  return null;
}
function rewriteCss(css, dir, has, pages) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => { const r = mapUrl(u, dir, has, pages); return r ? `url(${q}${r}${q})` : m; });
}
function rewriteSrcset(v, dir, has, pages) {
  return v.split(',').map(part => { const t = part.trim(), sp = t.search(/\s/), u = sp < 0 ? t : t.slice(0, sp), rest = sp < 0 ? '' : t.slice(sp); const r = mapUrl(u, dir, has, pages); return (r || u) + rest; }).join(', ');
}
// rewrites every link/asset reference in a piece of the page source (by source offsets, the rest stays byte-for-byte)
function rewriteRange(src, start, end, nodes, dir, has, pages) {
  const edits = [];
  for (const n of nodes) {
    const loc = n.sourceCodeLocation; if (!loc) continue;
    if (loc.startOffset < start || loc.endOffset > end) continue;
    const al = loc.attrs || {};
    for (const a of n.attrs || []) {
      const l = al[a.name]; if (!l) continue;
      let nv = null;
      if (URL_ATTRS.has(a.name)) nv = mapUrl(a.value, dir, has, pages);
      else if (SRCSET_ATTRS.has(a.name)) { const r = rewriteSrcset(a.value, dir, has, pages); if (r !== a.value) nv = r; }
      else if (a.name === 'style' && /url\(/.test(a.value)) { const r = rewriteCss(a.value, dir, has, pages); if (r !== a.value) nv = r; }
      else if (a.name === 'content' && n.tagName === 'meta' && /^(og:image|twitter:image)$/.test((n.attrs.find(x => x.name === 'property' || x.name === 'name') || {}).value || '')) nv = mapUrl(a.value, dir, has, pages);
      if (nv != null) edits.push({ at: l.startOffset, del: l.endOffset - l.startOffset, text: `${a.name}="${esc(nv)}"` });
    }
    if (n.tagName === 'style' && n.childNodes && n.childNodes[0] && n.childNodes[0].sourceCodeLocation) {
      const t = n.childNodes[0], tl = t.sourceCodeLocation, css = src.slice(tl.startOffset, tl.endOffset), r = rewriteCss(css, dir, has, pages);
      if (r !== css) edits.push({ at: tl.startOffset, del: tl.endOffset - tl.startOffset, text: r });
    }
  }
  edits.sort((x, y) => y.at - x.at);
  let out = src.slice(start, end);
  for (const e of edits) out = out.slice(0, e.at - start) + e.text + out.slice(e.at - start + e.del);
  return out;
}
function allNodes(root) { const out = []; (function walk(n) { for (const c of n.childNodes || []) { if (c.tagName && c.namespaceURI === HTML_NS) out.push(c); walk(c.content || c); } })(root); return out; }

function slugFor(p) {
  const s = p.replace(/\.html?$/i, '').replace(/(^|\/)index$/i, '').replace(/[^a-z0-9/_-]+/gi, '-').replace(/\//g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return s || 'home';
}
function pageData(path, html, has, pages) {
  const src = html.charCodeAt(0) === 0xFEFF ? html.slice(1) : html;
  const doc = parse(src, { sourceCodeLocationInfo: true });
  const htmlEl = (doc.childNodes || []).find(n => n.tagName === 'html');
  const head = htmlEl && htmlEl.childNodes.find(n => n.tagName === 'head'), body = htmlEl && htmlEl.childNodes.find(n => n.tagName === 'body');
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  const nodes = allNodes(doc);
  const inner = el => { const l = el && el.sourceCodeLocation; if (!l || !l.startTag) return null; return [l.startTag.endOffset, l.endTag ? l.endTag.startOffset : l.endOffset]; };
  const hr = inner(head), br = inner(body);
  let headSrc = hr ? rewriteRange(src, hr[0], hr[1], nodes, dir, has, pages) : '';
  let bodySrc = br ? rewriteRange(src, br[0], br[1], nodes, dir, has, pages) : rewriteRange(src, 0, src.length, nodes, dir, has, pages);
  headSrc = headSrc.replace(/<base\b[^>]*>/gi, '');
  let bodyAttrs = '';
  if (body && body.sourceCodeLocation && body.sourceCodeLocation.startTag) {
    const st = body.sourceCodeLocation.startTag, tag = src.slice(st.startOffset, st.endOffset);
    bodyAttrs = rewriteRange(tag, 0, tag.length, [], dir, has, pages).replace(/^<body\b/i, '').replace(/\/?>$/, '').trim();
    bodyAttrs = bodyAttrs.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, '');
  }
  const t = nodes.find(n => n.tagName === 'title');
  const title = t ? (t.childNodes || []).map(c => c.value || '').join('').replace(/\s+/g, ' ').trim() : '';
  return { source: path, slug: slugFor(path), title: title || slugFor(path).replace(/-/g, ' '), head: headSrc.trim(), body_attrs: bodyAttrs, content: bodySrc.trim() };
}

/* ---------- the theme ---------- */
const IMPORT_PHP = `<?php
/* Creates/updates one WordPress page per page of the ChiActive design. Shared by the theme and the ChiActive Connector. */
if (!defined('ABSPATH')) exit;
if (!function_exists('ca_pages_data')) {
  function ca_pages_data() {
    $f = __DIR__ . '/ca-pages.json';
    if (!file_exists($f)) return array();
    $d = json_decode(file_get_contents($f), true);
    return is_array($d) ? $d : array();
  }
  function ca_page_ids() {
    static $map = null;
    if ($map !== null) return $map;
    $map = array();
    $ids = get_posts(array('post_type' => 'page', 'post_status' => array('publish', 'draft', 'private', 'pending'), 'numberposts' => -1, 'fields' => 'ids', 'meta_key' => '_ca_source'));
    foreach ($ids as $id) { $s = get_post_meta($id, '_ca_source', true); if ($s && !isset($map[$s])) $map[$s] = (int) $id; }
    return $map;
  }
  // overwrite = true: the design is the source of truth (used for automatic publishing)
  function ca_import_pages($overwrite = false) {
    $data = ca_pages_data();
    if (empty($data['pages'])) return 0;
    $existing = ca_page_ids(); $keep = array(); $count = 0;
    if (function_exists('kses_remove_filters')) kses_remove_filters();   // the design's own HTML (styles, scripts) must survive
    foreach ($data['pages'] as $p) {
      $id = isset($existing[$p['source']]) ? $existing[$p['source']] : 0;
      if ($id && !$overwrite) { $keep[] = $id; continue; }
      $post = array('post_type' => 'page', 'post_status' => 'publish', 'post_title' => $p['title'], 'post_name' => $p['slug'],
        'post_content' => "<!-- wp:html -->\\n" . $p['content'] . "\\n<!-- /wp:html -->", 'comment_status' => 'closed');
      if ($id) { $post['ID'] = $id; if ('trash' === get_post_status($id)) wp_untrash_post($id); wp_update_post(wp_slash($post)); }
      else { $id = wp_insert_post(wp_slash($post)); }
      if (!$id || is_wp_error($id)) continue;
      update_post_meta($id, '_ca_source', $p['source']);
      update_post_meta($id, '_ca_head', wp_slash($p['head']));
      update_post_meta($id, '_ca_body', wp_slash($p['body_attrs']));
      update_post_meta($id, '_ca_design', $data['folder']);
      $keep[] = (int) $id; $count++;
      if ($p['source'] === $data['entry']) { update_option('show_on_front', 'page'); update_option('page_on_front', $id); }
    }
    if (function_exists('kses_init')) kses_init();
    if ($overwrite) {   // pages of an earlier winner that aren't part of this design go to the trash (they can be restored there)
      $all = get_posts(array('post_type' => 'page', 'post_status' => array('publish', 'draft', 'private', 'pending'), 'numberposts' => -1, 'fields' => 'ids', 'meta_key' => '_ca_source'));
      foreach ($all as $o) if (!in_array((int) $o, $keep, true)) wp_trash_post($o);
    }
    update_option('ca_theme_imported', $data['version']);
    return $count;
  }
}
`;

const FUNCTIONS_PHP = (meta) => `<?php
/* ${meta.name.replace(/\*\//g, '')} — exported from ChiActive Studio as a WordPress theme. */
if (!defined('ABSPATH')) exit;
require_once __DIR__ . '/ca-import.php';

// first activation (or a new version of the theme): create the pages
add_action('after_switch_theme', function () { ca_import_pages(false); });
add_action('init', function () {
  $d = ca_pages_data();
  if (!empty($d['version']) && get_option('ca_theme_imported') !== $d['version'] && get_option('stylesheet') === basename(__DIR__)) ca_import_pages(false);
});

// WordPress's default block styles would restyle the design: leave them out on the design's pages
add_action('wp_enqueue_scripts', function () {
  if (!is_singular('page') || !get_post_meta(get_queried_object_id(), '_ca_source', true)) return;
  foreach (array('wp-block-library', 'wp-block-library-theme', 'classic-theme-styles', 'global-styles', 'core-block-supports') as $h) { wp_dequeue_style($h); wp_deregister_style($h); }
}, 100);
remove_action('wp_enqueue_scripts', 'wp_enqueue_global_styles');
remove_action('wp_footer', 'wp_enqueue_global_styles', 1);

// the design's pages use their own layout file
add_filter('template_include', function ($t) {
  if (is_singular('page') && get_post_meta(get_queried_object_id(), '_ca_source', true)) return __DIR__ . '/ca-page.php';
  return $t;
});

// fills in the theme address and page links when a page is shown
function ca_fill($html) {
  $theme = get_template_directory_uri() . '/site';
  $html = str_replace('%%CA_THEME%%', $theme, (string) $html);
  return preg_replace_callback('/%%CA_PAGE:([^%]+)%%/', function ($m) {
    $ids = ca_page_ids();
    return isset($ids[$m[1]]) ? get_permalink($ids[$m[1]]) : home_url('/');
  }, $html);
}

// links made by the design's own scripts (about.html, images/x.jpg) go to the right page or file
add_action('template_redirect', function () {
  if (!is_404()) return;
  $path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
  $path = ltrim($path, '/');
  if ($path === '') return;
  $ids = ca_page_ids();
  if (preg_match('/\\.html?$/i', $path)) {
    foreach ($ids as $source => $id) { if ($path === $source || substr($path, -strlen('/' . $source)) === '/' . $source) { wp_safe_redirect(get_permalink($id), 301); exit; } }
  }
  $parts = explode('/', $path);
  while ($parts) {
    $try = implode('/', $parts);
    if (strpos($try, '..') === false && is_file(__DIR__ . '/site/' . $try)) { wp_safe_redirect(get_template_directory_uri() . '/site/' . str_replace('%2F', '/', rawurlencode($try)), 301); exit; }
    array_shift($parts);
  }
});
`;

const PAGE_PHP = `<?php
if (!defined('ABSPATH')) exit;
$ca_id = get_queried_object_id();
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<?php echo ca_fill(get_post_meta($ca_id, '_ca_head', true)); ?>

<?php wp_head(); ?>
</head>
<body <?php echo ca_fill(get_post_meta($ca_id, '_ca_body', true)); ?>>
<?php if (function_exists('wp_body_open')) wp_body_open(); ?>
<?php echo ca_fill(do_blocks(get_post_field('post_content', $ca_id))); ?>
<?php wp_footer(); ?>
</body>
</html>
`;

const INDEX_PHP = `<?php
/* Fallback for anything that isn't one of the design's pages (blog posts, archives, search). */
if (!defined('ABSPATH')) exit;
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head><meta charset="<?php bloginfo('charset'); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><title><?php echo esc_html(wp_get_document_title()); ?></title><?php wp_head(); ?>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.6}</style></head>
<body <?php body_class(); ?>>
<?php if (function_exists('wp_body_open')) wp_body_open(); ?>
<p><a href="<?php echo esc_url(home_url('/')); ?>">&larr; <?php bloginfo('name'); ?></a></p>
<?php if (have_posts()) : while (have_posts()) : the_post(); ?>
<article><h1><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h1><?php the_content(); ?></article>
<?php endwhile; else : ?><p>Nothing found.</p><?php endif; ?>
<?php wp_footer(); ?>
</body>
</html>
`;

/**
 * files: [{ path, buf }] every file of the design; meta: { folder, name, by, entry, slug, version }
 * returns [{ path, buf }] relative to the theme folder (meta.slug)
 */
function buildTheme(files, meta) {
  const has = new Set(files.map(f => f.path));
  const pages = new Set(files.filter(f => /\.html?$/i.test(f.path)).map(f => f.path));
  const out = [];
  const pageList = [];
  for (const f of files) {
    if (/\.html?$/i.test(f.path)) pageList.push(pageData(f.path, f.buf.toString('utf8'), has, pages));
    else out.push({ path: 'site/' + f.path, buf: f.buf });
  }
  pageList.sort((a, b) => (a.source === meta.entry ? -1 : b.source === meta.entry ? 1 : a.source.localeCompare(b.source)));
  const used = new Set();
  pageList.forEach(p => { let s = p.slug, i = 2; while (used.has(s)) s = p.slug + '-' + i++; p.slug = s; used.add(s); });
  const version = meta.version || new Date().toISOString();
  out.push({ path: 'ca-pages.json', buf: Buffer.from(JSON.stringify({ folder: meta.folder, name: meta.name, entry: meta.entry, version, pages: pageList })) });
  out.push({ path: 'style.css', buf: Buffer.from(`/*
Theme Name: ${meta.themeName || meta.name}
Author: ${meta.by || 'ChiActive class'}
Description: ${meta.name} — a ChiActive class design exported from ChiActive Studio. Activating it creates a page for every page of the design and sets its home page. The pages can be edited in WordPress (Pages).
Version: ${version.replace(/[^0-9]/g, '').slice(0, 12) || '1'}
Requires at least: 5.5
Requires PHP: 7.0
License: Proprietary
Text Domain: ${meta.slug}
*/
`) });
  out.push({ path: 'ca-import.php', buf: Buffer.from(IMPORT_PHP) });
  out.push({ path: 'functions.php', buf: Buffer.from(FUNCTIONS_PHP(meta)) });
  out.push({ path: 'ca-page.php', buf: Buffer.from(PAGE_PHP) });
  out.push({ path: 'index.php', buf: Buffer.from(INDEX_PHP) });
  out.push({ path: 'readme.txt', buf: Buffer.from(`${meta.name}\n\nInstall: WordPress → Appearance → Themes → Add New → Upload Theme → choose this .zip → Install → Activate.\nActivating creates one page per page of the design (Pages) and sets the home page.\nThe page content is in a "Custom HTML" block: edit it in WordPress, or change the design in ChiActive Studio and export again.\n`) });
  return { files: out, pages: pageList.length, version };
}

/* ---------- the connector plugin ---------- */
function buildPlugin({ secret, server }) {
  const php = `<?php
/*
Plugin Name: ChiActive Connector
Description: Lets the ChiActive upload server (${server.replace(/\*\//g, '')}) publish the class's winning design to this site automatically: it installs and activates the design as a theme and creates its pages. Every request is signed with a secret only this plugin and the upload server know.
Version: 1.0.0
Requires at least: 5.5
Requires PHP: 7.0
Author: ChiActive Studio
*/
if (!defined('ABSPATH')) exit;
define('CA_CONNECT_SECRET', ${phpStr(secret)});

add_action('rest_api_init', function () {
  register_rest_route('chiactive/v1', '/status', array('methods' => 'GET', 'callback' => 'ca_connect_status', 'permission_callback' => 'ca_connect_verify'));
  register_rest_route('chiactive/v1', '/deploy', array('methods' => 'POST', 'callback' => 'ca_connect_deploy', 'permission_callback' => 'ca_connect_verify'));
});

// signature = HMAC-SHA256(secret, timestamp \\n METHOD \\n route \\n sha256(body)); valid for 5 minutes, never twice
function ca_connect_verify($req) {
  $ts = (string) $req->get_header('x-ca-timestamp');
  $sig = strtolower((string) $req->get_header('x-ca-signature'));
  if ($ts === '' || $sig === '' || !ctype_digit($ts) || abs(time() - (int) $ts) > 300) return new WP_Error('ca_auth', 'Missing or expired signature.', array('status' => 401));
  $want = hash_hmac('sha256', $ts . "\\n" . $req->get_method() . "\\n" . $req->get_route() . "\\n" . hash('sha256', $req->get_body()), CA_CONNECT_SECRET);
  if (!hash_equals($want, $sig)) return new WP_Error('ca_auth', 'Wrong signature.', array('status' => 401));
  $k = 'ca_sig_' . substr($sig, 0, 32);
  if (get_transient($k)) return new WP_Error('ca_auth', 'This request was already used.', array('status' => 401));
  set_transient($k, 1, 600);
  return true;
}

function ca_connect_status($req) {
  $t = wp_get_theme();
  return array('ok' => true, 'site' => get_bloginfo('name'), 'url' => home_url('/'), 'wordpress' => get_bloginfo('version'), 'php' => PHP_VERSION,
    'theme' => $t->get('Name'), 'max_upload' => wp_max_upload_size(), 'post_max' => ini_get('post_max_size'));
}

function ca_connect_deploy($req) {
  @set_time_limit(300);
  $body = $req->get_body();
  if (strlen($body) < 200 || substr($body, 0, 2) !== 'PK') return new WP_Error('ca_bad_zip', 'The theme upload was empty or not a .zip (the site may limit upload sizes: post_max_size is ' . ini_get('post_max_size') . ').', array('status' => 400));
  require_once ABSPATH . 'wp-admin/includes/file.php';
  require_once ABSPATH . 'wp-admin/includes/misc.php';
  require_once ABSPATH . 'wp-admin/includes/theme.php';
  require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
  if (!WP_Filesystem() || 'direct' !== get_filesystem_method()) return new WP_Error('ca_fs', 'WordPress can’t write files on this server without FTP details, so themes can’t be installed automatically. Ask your host to allow direct file writes (FS_METHOD direct).', array('status' => 500));
  $tmp = wp_tempnam('chiactive-theme.zip');
  file_put_contents($tmp, $body);
  $skin = new WP_Ajax_Upgrader_Skin();
  $up = new Theme_Upgrader($skin);
  $res = $up->install($tmp, array('overwrite_package' => true, 'clear_update_cache' => true));
  @unlink($tmp);
  if (is_wp_error($res)) return new WP_Error('ca_install', 'Installing the theme failed: ' . $res->get_error_message(), array('status' => 500));
  if (!$res) { $errs = $skin->get_errors(); return new WP_Error('ca_install', 'Installing the theme failed: ' . (is_wp_error($errs) && $errs->has_errors() ? $errs->get_error_message() : 'unknown error'), array('status' => 500)); }
  $theme = $up->theme_info();
  $slug = $theme ? $theme->get_stylesheet() : sanitize_key((string) $req->get_header('x-ca-theme'));
  if (!$slug || !wp_get_theme($slug)->exists()) return new WP_Error('ca_install', 'The theme was uploaded but can’t be found afterwards.', array('status' => 500));
  switch_theme($slug);
  $n = 0;
  $imp = get_theme_root($slug) . '/' . $slug . '/ca-import.php';
  if (file_exists($imp)) { require_once $imp; $n = ca_import_pages(true); }
  return array('ok' => true, 'theme' => wp_get_theme($slug)->get('Name'), 'pages' => $n, 'url' => home_url('/'));
}

// shows that the connection is active on the Plugins screen
add_filter('plugin_row_meta', function ($links, $file) {
  if ($file === plugin_basename(__FILE__)) $links[] = 'Connected to ' . esc_html(${phpStr(server)});
  return $links;
}, 10, 2);
`;
  return [{ path: 'chiactive-connector.php', buf: Buffer.from(php) },
    { path: 'readme.txt', buf: Buffer.from(`=== ChiActive Connector ===\nInstall: WordPress → Plugins → Add New → Upload Plugin → choose this .zip → Install → Activate.\nThen click "Test connection" on the ChiActive admin page (WordPress tab).\nKeep this file private: it contains the secret key for your site. If it leaks, create a new key on the admin page and install the new plugin.\n`) }];
}

// headers for a signed request to the connector
function signRequest(secret, method, route, body) {
  const ts = String(Math.floor(Date.now() / 1000));
  const bodyHash = crypto.createHash('sha256').update(body || Buffer.alloc(0)).digest('hex');
  const sig = crypto.createHmac('sha256', secret).update(`${ts}\n${method}\n${route}\n${bodyHash}`).digest('hex');
  return { 'X-CA-Timestamp': ts, 'X-CA-Signature': sig };
}

module.exports = { buildTheme, buildPlugin, signRequest, pageData, mapUrl };
