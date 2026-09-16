import { createList, byDate, lockScroll, trapTab, hashRouter, asset, REDUCED } from './kc-ui.js';

/* =====================================================
 * KNOWLEDGE CENTRE — SUMMARIWISE
 * =====================================================
 * A cover carousel of the newest summaries, then the full
 * bookshelf with search, themes and sorting. Opening a book
 * slides in a drawer with its details; "Read the summary"
 * widens it and shows the PDF right there (phones get the
 * PDF in a new tab, where their own viewer does better).
 * ===================================================== */

const list = createList({
  list: document.querySelector('#kcItems'),
  group: 'theme',
  noun: 'summaries',
  sorters: {
    new: byDate(-1),
    old: byDate(1),
    az: (a, b) => a.dataset.book.replace(/^The /, '').localeCompare(b.dataset.book.replace(/^The /, '')),
  },
});
const books = new Map(list.items.map((li) => [li.id, li]));

// ---------------------------------------------------------------------
// the carousel
// ---------------------------------------------------------------------

const flow = document.querySelector('#kcFlow');
const slides = [...flow.querySelectorAll('.kc-flow__item')];
const capBook = flow.querySelector('.kc-flow__caption b');
const capAuthor = flow.querySelector('.kc-flow__caption span');
let front = 0;
let auto = null;

function place(i) {
  front = (i + slides.length) % slides.length;
  slides.forEach((el, k) => {
    // shortest way round, so the ring wraps
    let o = k - front;
    if (o > slides.length / 2) o -= slides.length;
    if (o < -slides.length / 2) o += slides.length;
    el.style.setProperty('--o', o);
    el.style.setProperty('--a', Math.abs(o));
    el.toggleAttribute('data-far', Math.abs(o) > 2);
    el.classList.toggle('is-front', o === 0);
    el.querySelector('button').tabIndex = o === 0 ? 0 : -1;
  });
  const li = books.get(slides[front].querySelector('button').dataset.bookKey);
  capBook.textContent = li.dataset.book;
  capAuthor.textContent = `by ${li.dataset.author}`;
}

function play() {
  if (REDUCED || auto) return;
  auto = setInterval(() => place(front + 1), 4500);
}
function pause() {
  clearInterval(auto);
  auto = null;
}

flow.querySelectorAll('[data-flow]').forEach((b) =>
  b.addEventListener('click', () => {
    pause();
    place(front + Number(b.dataset.flow));
  })
);
let swiped = false;
slides.forEach((el, k) =>
  el.querySelector('button').addEventListener(
    'click',
    (e) => {
      // the click that ends a swipe does nothing; a side cover comes to the front; the front one opens
      if (swiped || k !== front) {
        e.stopPropagation();
        e.preventDefault();
      }
      if (swiped) {
        swiped = false;
      } else if (k !== front) {
        pause();
        place(k);
      }
    },
    true
  )
);
flow.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  pause();
  place(front + (e.key === 'ArrowRight' ? 1 : -1));
  slides[front].querySelector('button').focus();
});
flow.addEventListener('pointerenter', pause);
flow.addEventListener('pointerleave', play);
flow.addEventListener('focusin', pause);

// swipe the covers
let swipeX = null;
flow.querySelector('.kc-flow__track').addEventListener('pointerdown', (e) => (swipeX = e.clientX));
window.addEventListener('pointerup', (e) => {
  if (swipeX === null) return;
  const dx = e.clientX - swipeX;
  swipeX = null;
  if (Math.abs(dx) > 50) {
    swiped = true;
    setTimeout(() => (swiped = false), 0);
    pause();
    place(front + (dx < 0 ? 1 : -1));
  }
});

place(0);
new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : pause())).observe(flow);

// ---------------------------------------------------------------------
// the drawer
// ---------------------------------------------------------------------

const drawer = document.querySelector('#kcDrawer');
const panel = drawer.querySelector('.kc-drawer__panel');
const coverImg = drawer.querySelector('.kc-drawer__cover img');
const tag = drawer.querySelector('.kc-drawer__info .kc-tag');
const time = drawer.querySelector('.kc-drawer__info time');
const dTitle = drawer.querySelector('.kc-drawer__title');
const dAuthor = drawer.querySelector('.kc-drawer__author');
const dLine = drawer.querySelector('.kc-drawer__line');
const dIntro = drawer.querySelector('.kc-drawer__intro');
const readBtn = drawer.querySelector('.kc-drawer__read');
const pdfLink = drawer.querySelector('.kc-drawer__pdf');
const note = drawer.querySelector('.kc-drawer__note');
const doc = drawer.querySelector('.kc-drawer__doc');
const frame = doc.querySelector('iframe');
const loading = doc.querySelector('.kc-drawer__loading');
const pos = drawer.querySelector('.kc-drawer__pos');
const baseTitle = document.title;
const SMALL = window.matchMedia('(max-width: 900px), (pointer: coarse)');
let openKey = null;
let returnFocus = null;

function pdfUrl(li) {
  return asset(li.dataset.pdf);
}

function setReading(on) {
  const li = books.get(openKey);
  drawer.classList.toggle('is-reading', on);
  readBtn.setAttribute('aria-expanded', String(on));
  readBtn.textContent = on ? 'Hide the summary' : 'Read the summary';
  doc.hidden = !on;
  if (on) {
    const url = `${pdfUrl(li)}#view=FitH`;
    if (frame.dataset.src !== url) {
      loading.hidden = false;
      frame.dataset.src = url;
      frame.src = url;
      frame.title = `SummariWise: ${li.dataset.book} by ${li.dataset.author} (PDF)`;
    }
  }
}

frame.addEventListener('load', () => (loading.hidden = true));

function open(key) {
  const li = books.get(key);
  if (!li) return;
  if (openKey === null) returnFocus = document.activeElement;
  const same = openKey === key;
  openKey = key;
  const order = list.matches().includes(li) ? list.matches() : list.items;
  pos.textContent = `Book ${order.indexOf(li) + 1} of ${order.length}`;
  const card = li.querySelector('img');
  coverImg.src = card.currentSrc || card.src;
  coverImg.width = card.width;
  coverImg.height = card.height;
  coverImg.alt = `${li.dataset.book} by ${li.dataset.author}`;
  const cardTag = li.querySelector('.kc-tag');
  tag.textContent = cardTag.textContent;
  tag.dataset.tone = cardTag.dataset.tone;
  time.textContent = li.querySelector('time').textContent;
  dTitle.textContent = li.dataset.book;
  dAuthor.textContent = `by ${li.dataset.author}`;
  dLine.textContent = li.querySelector('.kc-book__line').textContent;
  dIntro.textContent = li.querySelector('.kc-book__intro').textContent;
  pdfLink.href = pdfUrl(li);
  pdfLink.setAttribute('download', `SummariWise - ${li.dataset.book}.pdf`);
  pdfLink.textContent = `Download PDF (${li.dataset.size})`;
  note.textContent = SMALL.matches ? 'The summary opens as a PDF in a new tab.' : 'The summary opens right here, beside these details.';
  document.title = `${li.dataset.book} — SummariWise | Finlabs`;
  const wasReading = drawer.classList.contains('is-reading');
  if (!same) {
    frame.removeAttribute('src');
    delete frame.dataset.src;
  }
  drawer.hidden = false;
  lockScroll(true);
  if (wasReading && !SMALL.matches) setReading(true);
  drawer.querySelector('.kc-drawer__info').scrollTop = 0;
  if (!returnFocus || returnFocus.closest('#kcItems, #kcFlow') || !drawer.contains(document.activeElement)) {
    readBtn.focus({ preventScroll: true });
  }
}

function close() {
  if (openKey === null) return;
  const li = books.get(openKey);
  openKey = null;
  drawer.hidden = true;
  setReadingOff();
  lockScroll(false);
  document.title = baseTitle;
  list.reveal(li);
  const target = returnFocus && document.contains(returnFocus) && returnFocus !== document.body ? returnFocus : li.querySelector('button');
  target.focus({ preventScroll: true });
  if (!returnFocus || returnFocus === document.body) li.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
  returnFocus = null;
}

function setReadingOff() {
  drawer.classList.remove('is-reading');
  readBtn.setAttribute('aria-expanded', 'false');
  readBtn.textContent = 'Read the summary';
  doc.hidden = true;
  frame.removeAttribute('src');
  delete frame.dataset.src;
}

function step(dir) {
  const order = list.matches().length ? list.matches() : list.items;
  const at = order.indexOf(books.get(openKey));
  route.go(order[(at + dir + order.length) % order.length].id);
}

const route = hashRouter({ has: (id) => books.has(id), open, close });

document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-book-key]');
  if (opener) {
    route.go(opener.dataset.bookKey);
    return;
  }
  if (drawer.hidden) return;
  if (e.target.closest('[data-close]')) route.leave();
  const s = e.target.closest('[data-step]');
  if (s) step(Number(s.dataset.step));
});

readBtn.addEventListener('click', () => {
  if (SMALL.matches) {
    window.open(pdfUrl(books.get(openKey)), '_blank', 'noopener');
    return;
  }
  setReading(!drawer.classList.contains('is-reading'));
});

drawer.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return route.leave();
  trapTab(e, panel);
});

route.start();
