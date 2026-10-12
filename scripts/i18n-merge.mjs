/* Fold a batch of translations into the locale files:
 *   node scripts/i18n-merge.mjs batch.json
 * The batch is { "english string": { "hi": "…", "mr": "…" } }. A missing or
 * empty value leaves that string in English, which is what the pages fall
 * back to, so a half-translated site is still a working site.            */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES } from './i18n.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const batch = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const known = JSON.parse(readFileSync(resolve(ROOT, 'locales/_strings.json'), 'utf8'));

let unknown = 0;
for (const loc of LOCALES) {
  const file = resolve(ROOT, `locales/${loc}.json`);
  const dict = JSON.parse(readFileSync(file, 'utf8'));
  for (const [english, by] of Object.entries(batch)) {
    if (!(english in known)) { unknown++; continue; }
    if (by[loc]) dict[english] = by[loc];
  }
  writeFileSync(file, JSON.stringify(dict, null, 1) + '\n');
  const done = Object.values(dict).filter(Boolean).length;
  console.log(`${loc}: ${done}/${Object.keys(dict).length} translated`);
}
if (unknown) console.log(`! ${unknown} entries were not strings on the site — skipped`);
