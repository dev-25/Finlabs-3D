/* What is left to translate:  node scripts/i18n-todo.mjs [from] [count] */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES } from './i18n.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strings = JSON.parse(readFileSync(resolve(ROOT, 'locales/_strings.json'), 'utf8'));
const dicts = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(resolve(ROOT, `locales/${l}.json`), 'utf8'))])
);

const todo = Object.keys(strings).filter((s) => LOCALES.some((l) => !dicts[l][s]));
const from = Number(process.argv[2] || 0);
const count = Number(process.argv[3] || 60);
const slice = todo.slice(from, from + count);
console.log(JSON.stringify(slice, null, 1));
console.error(`# ${slice.length} shown, ${from + slice.length} of ${todo.length} still untranslated`);
