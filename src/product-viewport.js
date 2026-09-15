import './product-screen.css';
import { buildScene, wireTabs, wireFaqs, createLightbox } from './product-ui.js';

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
 * The same markup is also each product's own page, so
 * what it does — tabs, pop-up, FAQ — lives in
 * product-ui.js. main.js opens a product here when its
 * computer in the room is clicked.
 * ===================================================== */

const panel = document.querySelector('#productViewport');
const screenEl = panel?.querySelector('.pv__screen');
const scroller = panel?.querySelector('.pv__scroll');
const closeBtn = panel?.querySelector('.pv__close');
const urlBar = panel?.querySelector('.pv__url');
const docs = panel ? [...panel.querySelectorAll('.fx[data-product]')] : [];
const scenes = new Map(); // host element -> its 3D piece, built the first time it is needed
const lightbox = panel ? createLightbox(panel, panel.querySelector('#fxLightbox')) : null;

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
  if (!scenes.has(host)) scenes.set(host, buildScene(host));
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
  lightbox?.close();
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
  closeBtn.addEventListener('click', close);
  // a click on the surround — the gap between the screen and the page edge
  panel.addEventListener('click', (e) => {
    if (e.target === panel) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || current < 0) return;
    if (lightbox.isOpen()) lightbox.close();
    else close();
  });
  // a light focus trap: keep the keyboard inside the screen while it is open
  document.addEventListener('focusin', (e) => {
    if (current >= 0 && !panel.contains(e.target)) closeBtn.focus({ preventScroll: true });
  });

  wireTabs(panel);

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

wireFaqs(docs);
