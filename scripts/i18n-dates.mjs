/* Dates and durations follow a pattern, so they are filled in rather than
 * translated by hand: "11 Nov 2024", "3 min read", "12 weeks", "26 pages".
 * Anything that does not match a pattern is left for a human.
 *   node scripts/i18n-dates.mjs                                          */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES } from './i18n.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MONTHS = {
  Jan: ['जन', 'जाने'], Feb: ['फ़र', 'फेब्रु'], Mar: ['मार्च', 'मार्च'], Apr: ['अप्रै', 'एप्रि'],
  May: ['मई', 'मे'], Jun: ['जून', 'जून'], Jul: ['जुल', 'जुलै'], Aug: ['अग', 'ऑग'],
  Sep: ['सित', 'सप्टें'], Oct: ['अक्तू', 'ऑक्टो'], Nov: ['नव', 'नोव्हें'], Dec: ['दिस', 'डिसें'],
  January: ['जनवरी', 'जानेवारी'], February: ['फ़रवरी', 'फेब्रुवारी'], March: ['मार्च', 'मार्च'],
  April: ['अप्रैल', 'एप्रिल'], June: ['जून', 'जून'], July: ['जुलाई', 'जुलै'],
  August: ['अगस्त', 'ऑगस्ट'], September: ['सितंबर', 'सप्टेंबर'], October: ['अक्तूबर', 'ऑक्टोबर'],
  November: ['नवंबर', 'नोव्हेंबर'], December: ['दिसंबर', 'डिसेंबर'],
};
const idx = { hi: 0, mr: 1 };

const RULES = [
  [/^(\d{1,2}) ([A-Z][a-z]+)( \d{4})?$/, (m, loc) =>
    MONTHS[m[2]] && `${m[1]} ${MONTHS[m[2]][idx[loc]]}${m[3] || ''}`],
  [/^([A-Z][a-z]+) (\d{4})$/, (m, loc) => MONTHS[m[1]] && `${MONTHS[m[1]][idx[loc]]} ${m[2]}`],
  [/^(\d+) min read$/, (m, loc) => (loc === 'hi' ? `${m[1]} मिनट का पाठ` : `${m[1]} मिनिटांचे वाचन`)],
  [/^(\d+) weeks?$/, (m, loc) => (loc === 'hi' ? `${m[1]} सप्ताह` : `${m[1]} आठवडे`)],
  [/^(\d+)\+? years?$/, (m, loc) =>
    (loc === 'hi' ? `${m[0].includes('+') ? m[1] + '+' : m[1]} साल` : `${m[0].includes('+') ? m[1] + '+' : m[1]} वर्षे`)],
  [/^(\d+)[–-](\d+) years?$/, (m, loc) => (loc === 'hi' ? `${m[1]}–${m[2]} साल` : `${m[1]}–${m[2]} वर्षे`)],
  [/^(\d+) pages$/, (m, loc) => (loc === 'hi' ? `${m[1]} पृष्ठ` : `${m[1]} पाने`)],
  [/^(\d+) open roles$/, (m, loc) => (loc === 'hi' ? `${m[1]} पद उपलब्ध` : `${m[1]} पदे उपलब्ध`)],
  [/^(\d+) client stories$/, (m, loc) => (loc === 'hi' ? `${m[1]} ग्राहक कहानियाँ` : `${m[1]} ग्राहक कहाण्या`)],
  [/^(\d+)\+ partners$/, (m, loc) => (loc === 'hi' ? `${m[1]}+ साझेदार` : `${m[1]}+ भागीदार`)],
];

let filled = 0;
for (const loc of LOCALES) {
  const file = resolve(ROOT, `locales/${loc}.json`);
  const dict = JSON.parse(readFileSync(file, 'utf8'));
  for (const [text, have] of Object.entries(dict)) {
    if (have) continue;
    for (const [re, make] of RULES) {
      const m = re.exec(text);
      if (!m) continue;
      const out = make(m, loc);
      if (out) { dict[text] = out; filled++; }
      break;
    }
  }
  writeFileSync(file, JSON.stringify(dict, null, 1) + '\n');
  console.log(`${loc}: ${Object.values(dict).filter(Boolean).length}/${Object.keys(dict).length}`);
}
console.log(`${filled} filled by pattern`);
