/* =====================================================
 * i18n — the shared text walker
 * =====================================================
 * One place that knows which parts of a built page are
 * words a reader sees. Both halves of the system use it,
 * so what the extractor pulls out is exactly what the
 * build puts back:
 *
 *   scripts/i18n-extract.mjs  — collects the English
 *     strings into locales/_strings.json
 *   vite.config.js (i18n plugin) — walks each built page
 *     again and swaps in the translations
 *
 * Text inside <script>, <style>, <svg> and <template> is
 * left alone, as is anything drawn into the 3D scenes:
 * those labels are canvas textures, not markup, and stay
 * in English by design.
 * ===================================================== */

const SKIP = new Set(['script', 'style', 'svg', 'template', 'code', 'pre']);

// attributes a reader actually sees, by tag
const ATTRS = {
  img: ['alt', 'title'],
  a: ['title', 'aria-label'],
  button: ['aria-label', 'title'],
  input: ['placeholder', 'aria-label', 'title', 'value'],
  textarea: ['placeholder', 'aria-label'],
  select: ['aria-label'],
  option: ['label'],
  nav: ['aria-label'],
  section: ['aria-label'],
  div: ['aria-label'],
  header: ['aria-label'],
  form: ['aria-label'],
  ul: ['aria-label'],
  th: ['abbr'],
};

// <meta> and <title> carry the page's search listing
const META_NAMES = new Set([
  'description', 'keywords',
  'og:title', 'og:description', 'og:image:alt',
  'twitter:title', 'twitter:description', 'twitter:image:alt',
  'apple-mobile-web-app-title',
]);

const ENTITY = /&(amp|lt|gt|quot|#39|nbsp|mdash|ndash|rsquo|lsquo|ldquo|rdquo|hellip|times|#x27|#\d+);/g;
const ENT = {
  amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'", nbsp: ' ',
  mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  hellip: '…', times: '×',
};

export function decode(s) {
  return s.replace(ENTITY, (m, name) => {
    if (ENT[name]) return ENT[name];
    if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
    return m;
  });
}

export function encode(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Worth translating? Skip whitespace, punctuation, numbers and bare symbols. */
export function translatable(text) {
  const t = text.trim();
  if (t.length < 2) return false;
  if (!/[A-Za-z]/.test(t)) return false; // numbers, arrows, bullets, rupee signs
  if (/^[A-Za-z]$/.test(t)) return false;
  if (/^[A-Z]{2,4}$/.test(t)) return false; // avatar initials, ISO, IAP, AMC…
  return true;
}

/** collapse runs of whitespace — the key a dictionary is looked up by */
export function key(text) {
  return decode(text).replace(/\s+/g, ' ').trim();
}

/**
 * Walk a page's visible text. `fn(text)` returns a replacement, or null to
 * leave it as it is. Returns the rebuilt HTML.
 */
export function walkHtml(html, fn) {
  const out = [];
  const token = /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-zA-Z][\w-]*)\b[^>]*>|[^<]+/g;
  let skipping = null; // the tag we are inside and ignoring
  let m;
  let last = 0;
  while ((m = token.exec(html))) {
    out.push(html.slice(last, m.index));
    last = m.index + m[0].length;
    const piece = m[0];

    // comments and the doctype carry nothing a reader reads
    if (piece.startsWith('<!')) { out.push(piece); continue; }

    if (piece.startsWith('<')) {
      const tag = (m[1] || '').toLowerCase();
      const closing = piece.startsWith('</');
      if (skipping) {
        if (closing && tag === skipping) skipping = null;
        out.push(piece);
        continue;
      }
      if (!closing && SKIP.has(tag) && !piece.endsWith('/>')) skipping = tag;
      out.push(closing ? piece : attrs(piece, tag, fn));
      continue;
    }

    // a text node
    if (skipping || !translatable(piece)) { out.push(piece); continue; }
    const lead = piece.match(/^\s*/)[0];
    const tail = piece.match(/\s*$/)[0];
    const hit = fn(key(piece));
    out.push(hit == null ? piece : lead + encode(hit) + tail);
  }
  out.push(html.slice(last));
  return out.join('');
}

// the translatable attributes of one opening tag
function attrs(tag, name, fn) {
  const wanted = new Set(ATTRS[name] || []);
  if (name === 'meta') {
    const which = (tag.match(/\b(?:name|property)\s*=\s*"([^"]*)"/i) || [])[1];
    if (!which || !META_NAMES.has(which.toLowerCase())) return tag;
    wanted.add('content');
  }
  if (name === 'input') {
    const type = (tag.match(/\btype\s*=\s*"([^"]*)"/i) || [])[1];
    if (type && !['submit', 'button', 'reset'].includes(type.toLowerCase())) wanted.delete('value');
  }
  if (!wanted.size) return tag;
  return tag.replace(/([\w-]+)\s*=\s*"([^"]*)"/g, (whole, attr, value) => {
    if (!wanted.has(attr.toLowerCase()) || !translatable(value)) return whole;
    const hit = fn(key(value));
    return hit == null ? whole : `${attr}="${encode(hit).replace(/"/g, '&quot;')}"`;
  });
}

/** <title>…</title> is a text node already, so nothing extra is needed. */
export const LOCALES = ['hi', 'mr'];
export const LOCALE_NAMES = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };

/* The strings JavaScript writes after the page has loaded. They are not in
 * the markup, so the extractor adds them by hand and the build inlines just
 * these into each translated page for src/i18n.js to read. */
export const UI_STRINGS = [
  'Open menu', 'Close menu', 'Choose a language',
  '{n} open roles', '{n} of {total} roles',
  '{n} of {total} {noun}', 'Showing all {n} {noun}', 'Show more {noun} ({n} left)', 'articles',
  '{n} of {total} questions match “{q}”', '{n} questions',
  '{n} of {total} solutions match',
  'Please add your name.', 'Please enter a valid work email.',
  'Your email app should open with the message ready to send.',
  'Your email app should open with the enquiry ready to send.',
  'Your email app should open with the request ready to send.',
  'Loading the article', 'This article didn’t load. Check your connection and try again.',
  'Try again', '· {n} min read', 'Link copied',
  'Correct! +{xp} XP', 'Incorrect (+{xp} XP participation)',
  'Your name and rank are on the live leaderboard below!',
  'Next question', 'Play full game', 'You (Player)',
];
