/* Collect every English string a reader sees, from the pages as the build
 * assembles them (includes expanded), into locales/_strings.json. Run it
 * after changing any page copy:  npm run i18n:extract                     */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkHtml, LOCALES, UI_STRINGS } from './i18n.mjs';
import { PAGES } from './pages.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INCLUDE = /<!--\s*include:\s*([\w./-]+)\s*(\|\s*demote\s*)?-->/g;

const expand = (html, depth = 0) => {
  if (depth > 8) throw new Error('includes nested too deep');
  return html.replace(INCLUDE, (_, file, demote) => {
    const part = expand(readFileSync(resolve(ROOT, file), 'utf8'), depth + 1);
    return demote ? part.replace(/<h1(\s|>)/g, '<h2$1').replace(/<\/h1>/g, '</h2>') : part;
  });
};

const strings = new Map(); // text -> [pages it appears on]
for (const page of Object.values(PAGES)) {
  walkHtml(expand(readFileSync(resolve(ROOT, page), 'utf8')), (text) => {
    if (!strings.has(text)) strings.set(text, []);
    const where = strings.get(text);
    if (!where.includes(page)) where.push(page);
    return null; // extracting only
  });
}

// the strings JavaScript writes are not in any page's markup
for (const text of UI_STRINGS) if (!strings.has(text)) strings.set(text, ['(javascript)']);

const sorted = [...strings.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
writeFileSync(
  resolve(ROOT, 'locales/_strings.json'),
  JSON.stringify(Object.fromEntries(sorted.map(([t, where]) => [t, where])), null, 1) + '\n'
);

// every locale file gets a slot for each string, keeping what is already translated
for (const loc of LOCALES) {
  const file = resolve(ROOT, `locales/${loc}.json`);
  const have = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const next = {};
  for (const [text] of sorted) next[text] = have[text] || '';
  writeFileSync(file, JSON.stringify(next, null, 1) + '\n');
  const done = Object.values(next).filter(Boolean).length;
  console.log(`${loc}: ${done}/${sorted.length} translated`);
}
const words = [...strings.keys()].reduce((n, t) => n + t.split(/\s+/).length, 0);
console.log(`${sorted.length} strings, ${words} words, across ${Object.keys(PAGES).length} pages`);
