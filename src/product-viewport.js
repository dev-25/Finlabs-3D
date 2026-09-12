import './product-screen.css';
import { createHub } from './finexa-hub.js';
import { createStack } from './gennxt-stack.js';
import { createFlow } from './finaware-flow.js';
import { createPicture } from './fiscus-picture.js';
import { createClimb } from './learngenie-climb.js';

/* =====================================================
 * PRODUCTS — the on-screen product viewport
 * =====================================================
 * Owns the panel that opens when a product's "Explore"
 * button is pressed: the window chrome, the in-screen
 * tabs, its FAQ and the scroll lock. main.js flies the
 * camera into that station's monitor and, while it does,
 * feeds this module the screen's projected rectangle so
 * the panel lands exactly on it. With no 3D running the
 * panel simply opens by itself.
 *
 * One panel serves every product: each product's page
 * lives in its own `.fx[data-product]` article and only
 * the one being explored is shown. Each may carry a 3D
 * piece, named by `data-scene` and built on first use.
 * ===================================================== */

const SCENES = { hub: createHub, stack: createStack, flow: createFlow, picture: createPicture, climb: createClimb };

// the pop-up's sources live in markup, which the build rewrites for the
// site's base path — these do not pass through it, so join them here
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const asset = (path) => (path.startsWith('/') ? BASE + path : path);

const panel = document.querySelector('#productViewport');
const lightbox = panel?.querySelector('#fxLightbox');
const lbMedia = lightbox?.querySelector('.fx-lb__media');
const lbTitle = lightbox?.querySelector('.fx-lb__title');
const lbSub = lightbox?.querySelector('.fx-lb__sub');
const screenEl = panel?.querySelector('.pv__screen');
const scroller = panel?.querySelector('.pv__scroll');
const closeBtn = panel?.querySelector('.pv__close');
const urlBar = panel?.querySelector('.pv__url');
const docs = panel ? [...panel.querySelectorAll('.fx[data-product]')] : [];
const scenes = new Map(); // host element -> its 3D piece, built the first time it is needed

const openListeners = new Set();
const closeListeners = new Set();
let current = -1;
let opener = null;
let driven = false; // true once the 3D scene starts positioning the panel

export function onExplore(fn) {
  openListeners.add(fn);
}
export function onExploreClose(fn) {
  closeListeners.add(fn);
}
export function isOpen() {
  return current >= 0;
}

// the panel's resting box, straight from the CSS rule, so the transform
// below can be measured against it without reading back a transformed box
function baseRect() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(vw * 0.96, vh * 0.96 * (6.05 / 4.05));
  const h = w * (4.05 / 6.05);
  return { x: (vw - w) / 2, y: (vh - h) / 2, width: w, height: h };
}

function show() {
  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');
}

function hide() {
  panel.hidden = true;
  panel.setAttribute('aria-hidden', 'true');
  screenEl.style.opacity = '';
  screenEl.style.transform = '';
}

// show the product being explored and dress the window bar to match
function activate(index) {
  let active = null;
  docs.forEach((doc) => {
    const on = Number(doc.dataset.product) === index;
    doc.hidden = !on;
    if (on) active = doc;
  });
  if (!active) return null;
  if (urlBar) urlBar.textContent = active.dataset.url || '';
  closeBtn?.setAttribute(
    'aria-label',
    `Close ${active.dataset.name || 'this product'} and go back to the showroom`
  );
  const heading = active.querySelector('h1[id]');
  if (heading) screenEl.setAttribute('aria-labelledby', heading.id);
  return active;
}

// each product's 3D piece runs only while its page is the one on screen
function runScene(doc) {
  scenes.forEach((piece, host) => {
    if (!doc.contains(host)) piece?.stop();
  });
  const host = doc.querySelector('[data-scene]');
  if (!host) return;
  if (!scenes.has(host)) {
    const build = SCENES[host.dataset.scene];
    const piece = build ? build(host.querySelector('canvas')) : null;
    if (!piece) host.classList.add('is-flat'); // no WebGL: show the flat stand-in
    scenes.set(host, piece);
  }
  scenes.get(host)?.start();
}

export function open(index, trigger) {
  if (!panel || current === index) return;
  const doc = activate(index);
  if (!doc) return;
  current = index;
  opener = trigger || null;
  show();
  panel.classList.add('is-open');
  panel.classList.toggle('is-static', !driven); // no 3D: it just appears
  if (!driven) panel.classList.add('is-live');
  document.body.classList.add('viewport-open');
  scroller.scrollTop = 0;
  runScene(doc);
  openListeners.forEach((fn) => fn(index));
  // let the camera land before moving the keyboard focus into the screen
  setTimeout(() => closeBtn?.focus({ preventScroll: true }), driven ? 850 : 60);
}

export function close() {
  if (!panel || current < 0) return;
  current = -1;
  panel.classList.remove('is-open', 'is-live');
  document.body.classList.remove('viewport-open');
  closeLightbox();
  scenes.forEach((piece) => piece?.stop());
  closeListeners.forEach((fn) => fn());
  if (!driven) hide();
  opener?.focus({ preventScroll: true });
  opener = null;
}

/** Called every frame while the camera is near the monitor: `rect` is the
 *  screen's projected box in CSS pixels, or null once it is back in the room. */
export function place(rect, opacity, interactive) {
  if (!panel) return;
  driven = true;
  if (!rect) {
    if (current < 0) hide();
    return;
  }
  if (panel.hidden) show();
  panel.classList.remove('is-static');
  panel.classList.toggle('is-live', Boolean(interactive));
  screenEl.style.opacity = opacity.toFixed(3);
  // below 760px the panel is a full-screen sheet, so it doesn't track
  if (window.matchMedia('(max-width: 760px)').matches) return;
  const base = baseRect();
  const scale = rect.width / base.width;
  const dx = rect.x + rect.width / 2 - (base.x + base.width / 2);
  const dy = rect.y + rect.height / 2 - (base.y + base.height / 2);
  screenEl.style.transform =
    `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px)) scale(${scale.toFixed(4)})`;
}

if (panel) {
  document.querySelectorAll('[data-explore]').forEach((btn) =>
    btn.addEventListener('click', () => open(Number(btn.dataset.explore), btn))
  );
  closeBtn.addEventListener('click', close);
  // a click on the surround — the gap between the screen and the page edge
  panel.addEventListener('click', (e) => {
    if (e.target === panel) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || current < 0) return;
    if (!lightbox.hidden) closeLightbox();
    else close();
  });
  // a light focus trap: keep the keyboard inside the screen while it is open
  document.addEventListener('focusin', (e) => {
    if (current >= 0 && !panel.contains(e.target)) closeBtn.focus({ preventScroll: true });
  });

  // in-screen feature tabs — each product's set works on its own
  panel.addEventListener('click', (e) => {
    const tab = e.target.closest('.fx-tabs button');
    if (!tab) return;
    [...tab.parentElement.querySelectorAll('button')].forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      const view = document.getElementById(t.getAttribute('aria-controls'));
      if (view) view.hidden = !on;
    });
  });

  // in-screen navigation scrolls the panel, not the page behind it
  panel.querySelectorAll('.fx-top nav a').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = panel.querySelector(a.getAttribute('href'));
      if (!target) return;
      const top =
        target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 56;
      scroller.scrollTo({ top, behavior: 'smooth' });
    })
  );
}

// ---------------------------------------------------------------------
// The pop-up: screenshots open as pictures, client stories as pictures
// or as their video.
// ---------------------------------------------------------------------

function closeLightbox() {
  if (!lightbox || lightbox.hidden) return;
  lightbox.hidden = true;
  lbMedia.replaceChildren(); // also stops a playing video
}

function openLightbox(trigger) {
  const kind = trigger.dataset.lbType;
  const src = trigger.dataset.lbSrc;
  lbTitle.textContent = trigger.dataset.lbTitle || '';
  lbSub.textContent = trigger.dataset.lbSub || '';
  if (kind === 'video') {
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${src}?autoplay=1&rel=0`;
    frame.title = trigger.dataset.lbTitle || 'Client video';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture';
    frame.allowFullscreen = true;
    lbMedia.replaceChildren(frame);
  } else {
    const img = document.createElement('img');
    img.src = asset(src);
    img.alt = `${trigger.dataset.lbTitle || ''} — ${trigger.dataset.lbSub || ''}`;
    lbMedia.replaceChildren(img);
  }
  lightbox.hidden = false;
  lightbox.querySelector('.fx-lb__close').focus({ preventScroll: true });
}

if (lightbox) {
  panel.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-lb-type]');
    if (trigger) openLightbox(trigger);
  });
  lightbox.querySelector('.fx-lb__close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}

// ---------------------------------------------------------------------
// FAQ filter — one per product page
// ---------------------------------------------------------------------

docs.forEach((doc) => {
  const search = doc.querySelector('[data-faq-search]');
  const count = doc.querySelector('[data-faq-count]');
  if (!search || !count) return;
  const questions = [...doc.querySelectorAll('.fx-q')];

  function filterFaqs() {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    questions.forEach((item) => {
      const hit = !q || item.textContent.toLowerCase().includes(q);
      item.hidden = !hit;
      if (hit) shown++;
      if (!hit) item.open = false;
    });
    count.textContent = q
      ? `${shown} of ${questions.length} questions match “${search.value.trim()}”`
      : `${questions.length} questions`;
  }

  search.addEventListener('input', filterFaqs);
  filterFaqs();
});
