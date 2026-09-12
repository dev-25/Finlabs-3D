import './finexa.css';
import { createHub } from './finexa-hub.js';

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
 * ===================================================== */

const panel = document.querySelector('#productViewport');
const lightbox = panel?.querySelector('#fxLightbox');
const lbMedia = lightbox?.querySelector('.fx-lb__media');
const lbTitle = lightbox?.querySelector('.fx-lb__title');
const lbSub = lightbox?.querySelector('.fx-lb__sub');
let hub = null; // the 3D transactions hub, built the first time it is needed
const screenEl = panel?.querySelector('.pv__screen');
const scroller = panel?.querySelector('.pv__scroll');
const closeBtn = panel?.querySelector('.pv__close');

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

export function open(index, trigger) {
  if (!panel || current === index) return;
  current = index;
  opener = trigger || null;
  show();
  panel.classList.add('is-open');
  panel.classList.toggle('is-static', !driven); // no 3D: it just appears
  if (!driven) panel.classList.add('is-live');
  document.body.classList.add('viewport-open');
  scroller.scrollTop = 0;
  // the hero's 3D hub: build it on first open, then let it run
  const hubEl = panel.querySelector('#fxHub');
  if (!hub && hubEl) {
    hub = createHub(hubEl.querySelector('.fx-hub__canvas'));
    if (!hub) hubEl.classList.add('is-flat'); // no WebGL: show the flat banner
  }
  hub?.start();
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
  hub?.stop();
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

  // in-screen feature tabs
  const tabs = [...panel.querySelectorAll('.fx-tabs button')];
  tabs.forEach((tab, i) =>
    tab.addEventListener('click', () => {
      tabs.forEach((t, k) => {
        t.setAttribute('aria-selected', String(k === i));
        document.getElementById(t.getAttribute('aria-controls')).hidden = k !== i;
      });
    })
  );

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
    img.src = src;
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
// FAQ filter
// ---------------------------------------------------------------------

const faqSearch = panel?.querySelector('#fxFaqSearch');
const faqCount = panel?.querySelector('#fxFaqCount');
const questions = panel ? [...panel.querySelectorAll('.fx-q')] : [];

function filterFaqs() {
  const q = faqSearch.value.trim().toLowerCase();
  let shown = 0;
  questions.forEach((item) => {
    const hit = !q || item.textContent.toLowerCase().includes(q);
    item.hidden = !hit;
    if (hit) shown++;
    if (!hit) item.open = false;
  });
  faqCount.textContent = q
    ? `${shown} of ${questions.length} questions match “${faqSearch.value.trim()}”`
    : `${questions.length} questions`;
}

if (faqSearch) {
  faqSearch.addEventListener('input', filterFaqs);
  filterFaqs();
}
