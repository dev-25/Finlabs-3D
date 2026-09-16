import { createList, byDate, lockScroll, trapTab, hashRouter, asset, REDUCED } from './kc-ui.js';

/* =====================================================
 * KNOWLEDGE CENTRE — BLOGS
 * =====================================================
 * The list filters by topic, searches titles and excerpts
 * and pages nine at a time. Opening a card slides in the
 * reader: the article is fetched from its own small JSON
 * file, so the list page stays light. #slug links (from
 * the home page, or shared) open straight onto a post.
 * ===================================================== */

const list = createList({
  list: document.querySelector('#kcItems'),
  group: 'topic',
  noun: 'articles',
  page: 9,
  sorters: {
    new: byDate(-1),
    old: byDate(1),
    short: (a, b) => a.querySelector('[data-minutes]').dataset.minutes - b.querySelector('[data-minutes]').dataset.minutes,
  },
});

const cards = new Map(list.items.map((li) => [li.querySelector('[data-post]').dataset.post, li]));

// ---------------------------------------------------------------------
// the reader
// ---------------------------------------------------------------------

const reader = document.querySelector('#kcReader');
const panel = reader.querySelector('.kc-reader__panel');
const scroller = reader.querySelector('.kc-reader__scroll');
const inner = reader.querySelector('.kc-reader__inner');
const tag = reader.querySelector('.kc-reader__meta .kc-tag');
const time = reader.querySelector('.kc-reader__meta time');
const mins = reader.querySelector('.kc-reader__mins');
const title = reader.querySelector('.kc-reader__title');
const cover = reader.querySelector('.kc-reader__cover');
const body = reader.querySelector('.kc-reader__body');
const pager = reader.querySelector('.kc-reader__pager');
const bar = reader.querySelector('.kc-reader__progress span');
const toast = reader.querySelector('.kc-toast');
const cache = new Map();
let openSlug = null;
let returnFocus = null;
let token = 0;

const SIZE_KEY = 'finlabs-reader-size';
let size = 17;
try {
  size = Number(localStorage.getItem(SIZE_KEY)) || 17;
} catch {
  /* storage blocked: keep the default */
}
inner.style.setProperty('--fs', `${size}px`);

function fetchPost(slug) {
  if (!cache.has(slug)) {
    const p = fetch(asset(`knowledge-centre/blogs/${slug}.json`))
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .catch((err) => {
        cache.delete(slug);
        throw err;
      });
    cache.set(slug, p);
  }
  return cache.get(slug);
}

function fill(slug) {
  const li = cards.get(slug);
  const link = li.querySelector('[data-post]');
  const cardTag = li.querySelector('.kc-tag');
  tag.textContent = cardTag.textContent;
  tag.dataset.tone = cardTag.dataset.tone;
  time.textContent = li.querySelector('time').textContent;
  time.dateTime = li.dataset.date;
  mins.textContent = `· ${link.dataset.minutes} min read`;
  title.textContent = li.querySelector('.kc-card__title').textContent;
  // posts that open on their own banner don't need the cover as well
  cover.hidden = link.dataset.leadFigure === 'true';
  const img = cover.querySelector('img');
  if (!cover.hidden) {
    const src = li.querySelector('img');
    img.src = src.currentSrc || src.src;
    img.width = src.width;
    img.height = src.height;
  }
  document.title = `${title.textContent} — Finlabs Blog`;

  body.classList.add('is-loading');
  body.innerHTML = '<div class="kc-skeleton" aria-label="Loading the article"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
  const mine = ++token;
  fetchPost(slug)
    .then(({ html }) => {
      if (mine !== token) return;
      body.innerHTML = html.replaceAll('src="knowledge-centre/', `src="${asset('knowledge-centre/')}`);
      body.classList.remove('is-loading');
      progress();
    })
    .catch(() => {
      if (mine !== token) return;
      body.classList.remove('is-loading');
      body.innerHTML = '<p>This article didn’t load. Check your connection and try again.</p><p><button class="kc-btn kc-btn--ghost" type="button" data-retry>Try again</button></p>';
    });

  // previous / next follow the list as it's currently filtered and sorted
  const order = list.matches().map((el) => el.querySelector('[data-post]').dataset.post);
  const at = order.indexOf(slug);
  const prev = at > 0 ? order[at - 1] : null;
  const next = at >= 0 && at < order.length - 1 ? order[at + 1] : null;
  const link2 = (s, dir, label) => {
    const a = document.createElement('a');
    a.href = `#${s}`;
    a.dataset.post = s;
    a.dataset.dir = dir;
    const span = document.createElement('span');
    span.textContent = label;
    const b = document.createElement('b');
    b.textContent = cards.get(s).querySelector('.kc-card__title').textContent;
    a.append(span, b);
    return a;
  };
  pager.replaceChildren(...[prev && link2(prev, 'prev', '← Previous in this list'), next && link2(next, 'next', 'Next in this list →')].filter(Boolean));
}

const baseTitle = document.title;

function open(slug) {
  if (!cards.has(slug)) return;
  const wasOpen = openSlug !== null;
  if (!wasOpen) returnFocus = document.activeElement;
  openSlug = slug;
  fill(slug);
  reader.hidden = false;
  lockScroll(true);
  scroller.scrollTop = 0;
  bar.style.transform = 'scaleX(0)';
  if (!wasOpen) panel.querySelector('.kc-reader__back').focus({ preventScroll: true });
  else scroller.focus({ preventScroll: true });
}

function close() {
  if (openSlug === null) return;
  const slug = openSlug;
  openSlug = null;
  token++;
  reader.hidden = true;
  lockScroll(false);
  document.title = baseTitle;
  // land back on the card that was read, even if it came from a link
  const li = cards.get(slug);
  list.reveal(li);
  const target = returnFocus && document.contains(returnFocus) && returnFocus !== document.body ? returnFocus : li.querySelector('a');
  target.focus({ preventScroll: true });
  if (!returnFocus || returnFocus === document.body) li.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
  returnFocus = null;
}

const route = hashRouter({ has: (id) => cards.has(id), open, close });

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-post]');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault();
    route.go(a.dataset.post);
    return;
  }
  if (e.target.closest('[data-close]') && !reader.hidden) route.leave();
  if (e.target.closest('[data-retry]') && openSlug) fill(openSlug);
});

reader.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') route.leave();
  trapTab(e, panel);
});

// reading progress along the reader's top bar
function progress() {
  const room = scroller.scrollHeight - scroller.clientHeight;
  bar.style.transform = `scaleX(${room > 0 ? Math.min(1, scroller.scrollTop / room).toFixed(4) : 1})`;
}
scroller.addEventListener('scroll', progress, { passive: true });

// text size
reader.querySelectorAll('[data-size]').forEach((btn) =>
  btn.addEventListener('click', () => {
    size = Math.min(22, Math.max(14, size + Number(btn.dataset.size)));
    inner.style.setProperty('--fs', `${size}px`);
    try {
      localStorage.setItem(SIZE_KEY, String(size));
    } catch {
      /* not saved; fine */
    }
    progress();
  })
);

// copy a link to the open article
let toastTimer;
reader.querySelector('.kc-reader__copy').addEventListener('click', async () => {
  const url = location.href;
  let ok = false;
  try {
    await navigator.clipboard.writeText(url);
    ok = true;
  } catch {
    ok = false;
  }
  toast.textContent = ok ? 'Link copied' : url;
  toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-on'), ok ? 1800 : 5000);
});

route.start();
