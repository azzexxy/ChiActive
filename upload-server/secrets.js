/* Finds secret keys (API keys, tokens, private keys) in uploaded text files and blanks them out.
 * GitHub refuses ("push protection": "Repository rule violations found / Secret detected in content")
 * any commit that contains one, and a public website must never show them anyway. */
(function (root) {
'use strict';
const PLACEHOLDER = 'REMOVED_SECRET_KEY';
const PATTERNS = [
  ['private key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ['OpenAI API key', /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}|\bsk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}\b|\bsk-[A-Za-z0-9_-]{16,}T3BlbkFJ[A-Za-z0-9_-]{16,}/g],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})\b/g],
  ['AWS access key', /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g],
  ['AWS secret key', /(aws_?secret_?access_?key["'\s:=]{1,6})[A-Za-z0-9/+]{40}\b/gi],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['Google OAuth secret', /\bGOCSPX-[A-Za-z0-9_-]{28}\b/g],
  ['Stripe secret key', /\b(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{20,}\b/g],
  ['Slack token', /\bxox[abposr]-[0-9A-Za-z-]{10,}\b/g],
  ['Slack webhook', /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/]+/g],
  ['Discord webhook', /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g],
  ['Discord bot token', /\b[MN][A-Za-z\d_-]{23,25}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,38}\b/g],
  ['Telegram bot token', /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/g],
  ['SendGrid key', /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g],
  ['Mailchimp key', /\b[0-9a-f]{32}-us\d{1,2}\b/g],
  ['Mailgun key', /\bkey-[0-9a-f]{32}\b/g],
  ['Twilio key', /\bSK[0-9a-f]{32}\b/g],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/g],
  ['Shopify token', /\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b/g],
  ['Hugging Face token', /\bhf_[A-Za-z0-9]{34,}\b/g],
  ['Groq key', /\bgsk_[A-Za-z0-9]{40,}\b/g],
  ['xAI key', /\bxai-[A-Za-z0-9]{40,}\b/g],
  ['Replicate token', /\br8_[A-Za-z0-9]{37}\b/g],
  ['Mapbox secret token', /\bsk\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g],
  ['Square token', /\b(?:EAAA|sq0atp-|sq0csp-)[A-Za-z0-9_-]{22,60}\b/g],
  ['Azure storage key', /AccountKey=[A-Za-z0-9+/]{86}==/g],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{20,}/g],
  ['PayPal/Braintree token', /\baccess_token\$production\$[a-z0-9]{16}\$[a-f0-9]{32}\b/g],
];

// returns { text, found: [{ kind, line }] }; text is unchanged when nothing was found
function scrub(text) {
  const found = [];
  let out = text;
  for (const [kind, re] of PATTERNS) {
    re.lastIndex = 0;
    if (!re.test(out)) continue;
    re.lastIndex = 0;
    out = out.replace(re, (m, keep, offset) => {
      const at = typeof offset === 'number' ? offset : typeof keep === 'number' ? keep : out.indexOf(m);
      found.push({ kind, line: out.slice(0, at).split('\n').length });
      return typeof keep === 'string' && m.startsWith(keep) ? keep + PLACEHOLDER : PLACEHOLDER;
    });
  }
  return { text: out, found };
}

// files that must never be published, whatever is inside them (checked on the file name)
const FORBIDDEN_FILES = [
  ['an environment file (.env) with passwords or keys', /(^|\/)\.env(\.[^/]*)?$|(^|\/)[^/]+\.env$/i],
  ['a private key or certificate file', /\.(pem|key|p12|pfx|jks|keystore|ppk|kdbx|gpg|asc)$/i],
  ['an SSH key', /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i],
  ['a file with login details', /(^|\/)(\.npmrc|\.pypirc|\.netrc|\.htpasswd|\.git-credentials|\.dockercfg|\.s3cfg|\.boto|wp-config\.php)$/i],
  ['a credentials file', /(^|\/)(credentials?|client[-_]?secrets?[^/]*|service[-_]?account[^/]*|[^/]*firebase-adminsdk[^/]*|secrets?|api[-_ ]?keys?|private[-_]?keys?)\.(json|js|mjs|txt|html?|md|csv|xml|ya?ml|ini|cfg|conf)$/i],
  ['a folder with keys or logins', /(^|\/)(\.aws|\.ssh|\.gnupg|\.docker|\.git)\//i],
];
const TEXT_EXT = /\.(html?|css|js|mjs|cjs|jsx|ts|json|map|txt|md|xml|csv|svg|webmanifest|ya?ml|ini|cfg|conf|env|php|py|rb)$/i;
function forbiddenName(path) {
  for (const [why, re] of FORBIDDEN_FILES) if (re.test(String(path || ''))) return why;
  return '';
}
const isPage = path => /\.html?$/i.test(String(path || ''));
/* One check for every uploaded file, used by Studio (in the browser, before anything is sent) and by the upload server
 * (again, before anything is saved to GitHub).
 * returns { action: 'keep' | 'remove' | 'clean', reason, found, text }
 *  - remove: forbidden file name, or a non-page file that contains a secret key: the file is left out completely
 *  - clean:  a web page (.html) that contains a secret key: the key is blanked out so the page itself still works */
function checkFile(path, text) {
  const why = forbiddenName(path);
  if (why) return { action: 'remove', reason: `it is ${why}`, found: [] };
  if (typeof text !== 'string' || !TEXT_EXT.test(String(path))) return { action: 'keep', found: [] };
  const r = scrub(text);
  if (!r.found.length) return { action: 'keep', found: [] };
  const kinds = [...new Set(r.found.map(x => x.kind))].join(', ');
  const lines = r.found.map(x => x.line).slice(0, 5).join(', ');
  if (isPage(path)) return { action: 'clean', reason: `it contains ${r.found.length === 1 ? 'a secret key' : r.found.length + ' secret keys'} (${kinds}, line ${lines}); the key${r.found.length === 1 ? ' was' : 's were'} blanked out and the page kept`, found: r.found, text: r.text };
  return { action: 'remove', reason: `it contains ${r.found.length === 1 ? 'a secret key' : r.found.length + ' secret keys'} (${kinds}, line ${lines})`, found: r.found };
}
const api = { scrub, checkFile, forbiddenName, isTextPath: p => TEXT_EXT.test(String(p || '')), PLACEHOLDER };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CASecrets = api;
})(this);
