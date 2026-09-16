import './doc.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import './knowledge.css';
import { initTheme } from './theme.js';

/* =====================================================
 * KNOWLEDGE CENTRE — pieces shared by the three pages
 * =====================================================
 * Search, topic chips, sorting and "show more" for a list
 * of cards; plus the small helpers every pop-up needs:
 * locking the page scroll, keeping Tab inside, and
 * resolving asset paths against the site's base URL.
 * ===================================================== */

initTheme();

export const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// public files live under the site's base (/Finlabs-3D/ on GitHub Pages)
export function asset(path) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

export const fold = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'");

// ---------------------------------------------------------------------
// the list: search + chips + sort + paging
// ---------------------------------------------------------------------

/**
 * @param {object} o
 * @param {HTMLElement} o.list      the <ul> holding the cards
 * @param {string} o.group          chip data attribute and card data attribute ("topic", "theme")
 * @param {string} o.noun           "articles", "infographics", "summaries"
 * @param {Record<string, (a: HTMLElement, b: HTMLElement) => number>} o.sorters
 * @param {number} [o.page]         cards per page; omit to show every match
 */
export function createList({ list, group, noun, sorters, page = 0 }) {
  const items = [...list.children];
  const search = document.querySelector('#kcSearch');
  const sort = document.querySelector('#kcSort');
  const count = document.querySelector('#kcCount');
  const empty = document.querySelector('#kcEmpty');
  const more = document.querySelector('#kcMore');
  const chips = [...document.querySelectorAll(`.kc-chips [data-${group}]`)];
  const haystack = new Map(items.map((el) => [el, fold(el.textContent + ' ' + Object.values(el.dataset).join(' '))]));
  const listeners = new Set();
  let shown = page;
  let picked = 'all';
  let matches = items;

  function pick(value) {
    if (!chips.some((c) => c.dataset[group] === value)) value = 'all';
    picked = value;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset[group] === value)));
  }

  function apply({ keepPage = false } = {}) {
    const words = search ? fold(search.value.trim()).split(/\s+/).filter(Boolean) : [];
    const order = [...items].sort(sorters[sort?.value] || sorters.new);
    matches = order.filter((el) => {
      if (picked !== 'all' && el.dataset[group] !== picked) return false;
      const text = haystack.get(el);
      return words.every((w) => text.includes(w));
    });
    if (!keepPage) shown = page;
    const limit = page ? shown : Infinity;
    const frag = document.createDocumentFragment();
    order.forEach((el) => frag.append(el));
    list.append(frag);
    const visible = new Set(matches.slice(0, limit));
    items.forEach((el) => {
      const on = visible.has(el);
      // replay the entrance animation only for cards that were hidden
      if (on && el.hidden) el.style.animationDelay = `${Math.min(8, [...visible].indexOf(el)) * 40}ms`;
      el.hidden = !on;
    });
    if (count) {
      const filtered = matches.length !== items.length;
      count.textContent = filtered
        ? `${matches.length} of ${items.length} ${noun}`
        : `Showing all ${items.length} ${noun}`;
    }
    if (empty) empty.hidden = matches.length > 0;
    if (more) more.parentElement.hidden = !page || matches.length <= shown;
    if (more) more.textContent = `Show more ${noun} (${matches.length - Math.min(shown, matches.length)} left)`;
    listeners.forEach((fn) => fn(matches));
  }

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      pick(chip.dataset[group]);
      apply();
      syncUrl();
    })
  );
  let typing;
  search?.addEventListener('input', () => {
    clearTimeout(typing);
    typing = setTimeout(apply, 120);
  });
  sort?.addEventListener('change', () => apply());
  more?.addEventListener('click', () => {
    const first = matches[shown];
    shown += page;
    apply({ keepPage: true });
    first?.querySelector('a, button')?.focus({ preventScroll: true });
  });
  document.querySelectorAll('[data-reset]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (search) search.value = '';
      pick('all');
      apply();
      syncUrl();
      search?.focus();
    })
  );

  // "/" jumps to the search box, as on most reading sites
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || !search || e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (document.documentElement.classList.contains('kc-lock')) return;
    e.preventDefault();
    search.focus();
  });

  // a topic link from the hub (?topic=security) arrives pre-filtered
  const params = new URLSearchParams(location.search);
  if (params.get(group)) pick(params.get(group));
  function syncUrl() {
    const url = new URL(location.href);
    if (picked === 'all') url.searchParams.delete(group);
    else url.searchParams.set(group, picked);
    history.replaceState(history.state, '', url);
  }

  apply();

  return {
    items,
    /** the cards that match right now, in display order (including ones behind "show more") */
    matches: () => matches,
    /** make sure a card is on screen even if paging or a filter hid it */
    reveal(el) {
      if (!matches.includes(el)) {
        if (search) search.value = '';
        pick('all');
        apply();
      }
      const at = matches.indexOf(el);
      if (page && at >= shown) {
        shown = Math.ceil((at + 1) / page) * page;
        apply({ keepPage: true });
      }
    },
    onChange: (fn) => listeners.add(fn),
  };
}

export const byDate = (dir) => (a, b) => dir * a.dataset.date.localeCompare(b.dataset.date);

// ---------------------------------------------------------------------
// pop-ups
// ---------------------------------------------------------------------

export function lockScroll(on) {
  document.documentElement.classList.toggle('kc-lock', on);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])';

/** keep Tab and Shift+Tab inside an open dialog */
export function trapTab(e, root) {
  if (e.key !== 'Tab') return;
  const els = [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (!els.length) return;
  const first = els[0];
  const last = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * One item per URL hash: opening pushes #slug so Back closes it again,
 * and a shared link with #slug opens straight onto that item.
 */
export function hashRouter({ has, open, close }) {
  let pushed = false;
  const current = () => decodeURIComponent(location.hash.slice(1));

  function sync() {
    const id = current();
    if (id && has(id)) open(id);
    else close();
  }
  window.addEventListener('popstate', () => {
    pushed = false;
    sync();
  });
  window.addEventListener('hashchange', sync);

  return {
    go(id) {
      if (current() === id) return open(id);
      if (current() && has(current())) history.replaceState(history.state, '', `#${id}`);
      else {
        history.pushState({ kc: true }, '', `#${id}`);
        pushed = true;
      }
      open(id);
    },
    leave() {
      if (!current()) return close();
      if (pushed || history.state?.kc) {
        pushed = false;
        history.back(); // popstate closes it
      } else {
        history.replaceState(null, '', location.pathname + location.search);
        close();
      }
    },
    start: sync,
  };
}

export function niceDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** tilt a card toward the pointer (fine pointers only) */
export function tilt(els, max = 5) {
  if (REDUCED || !window.matchMedia('(pointer: fine)').matches) return;
  els.forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
    });
  });
}
