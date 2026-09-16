import './doc.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import './careers.css';
import { initTheme } from './theme.js';

/* =====================================================
 * CAREERS
 * =====================================================
 * Filtering the openings, opening one to read it, and
 * linking straight to a role. Applications go by email —
 * there is no backend on this site.
 * ===================================================== */

initTheme();

const jobs = [...document.querySelectorAll('.job')];
const search = document.querySelector('#roleSearch');
const count = document.querySelector('#roleCount');
const empty = document.querySelector('#rolesEmpty');
const chips = [...document.querySelectorAll('.chip')];
const picked = { category: 'all', location: 'all' };

function matches(job) {
  const q = search.value.trim().toLowerCase();
  const { category, location } = job.dataset;
  if (picked.category !== 'all' && category !== picked.category) return false;
  if (picked.location !== 'all' && location !== picked.location) return false;
  return !q || job.textContent.toLowerCase().includes(q);
}

function filter() {
  let shown = 0;
  jobs.forEach((job) => {
    const hit = matches(job);
    job.hidden = !hit;
    if (hit) shown++;
  });
  count.textContent = shown === jobs.length ? `${jobs.length} open roles` : `${shown} of ${jobs.length} roles`;
  empty.hidden = shown > 0;
}

function setOpen(job, open) {
  const head = job.querySelector('.job__head');
  head.setAttribute('aria-expanded', String(open));
  job.querySelector('.job__panel').hidden = !open;
}

if (jobs.length) {
  search.addEventListener('input', filter);

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const { filter: kind, value } = chip.dataset;
      picked[kind] = value;
      chips
        .filter((c) => c.dataset.filter === kind)
        .forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      filter();
    })
  );

  // one open at a time, so the list stays easy to scan
  jobs.forEach((job) => {
    job.querySelector('.job__head').addEventListener('click', () => {
      const open = job.querySelector('.job__head').getAttribute('aria-expanded') === 'true';
      jobs.forEach((other) => setOpen(other, false));
      setOpen(job, !open);
      if (!open) history.replaceState(null, '', `#${job.id}`);
    });
  });

  // a link such as careers.html#backend-developer-node-js opens that role
  function followHash() {
    const job = jobs.find((j) => j.id === decodeURIComponent(location.hash.slice(1)));
    if (!job) return;
    jobs.forEach((other) => setOpen(other, other === job));
    job.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  window.addEventListener('hashchange', followHash);
  if (location.hash) followHash();

  filter();
}
