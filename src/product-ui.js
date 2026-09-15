import { createHub } from './finexa-hub.js';
import { createStack } from './gennxt-stack.js';
import { createFlow } from './finaware-flow.js';
import { createPicture } from './fiscus-picture.js';
import { createClimb } from './learngenie-climb.js';

/* =====================================================
 * PRODUCTS — what a product page does, wherever it is
 * =====================================================
 * The same product markup is shown on the showroom's
 * monitor (product-viewport.js) and as its own page
 * (product-page.js). Both wire it up from here: its 3D
 * piece, its tabs, its FAQ search and its pop-up.
 * ===================================================== */

const SCENES = { hub: createHub, stack: createStack, flow: createFlow, picture: createPicture, climb: createClimb };

/** Build the 3D piece named by a `[data-scene]` host, or mark the host flat
 *  (so the stylesheet shows its stand-in) when there is no WebGL. */
export function buildScene(host) {
  const build = SCENES[host?.dataset.scene];
  const piece = build ? build(host.querySelector('canvas')) : null;
  if (host && !piece) host.classList.add('is-flat');
  return piece;
}

/** Feature tabs — each `.fx-tabs` set inside `root` works on its own. */
export function wireTabs(root) {
  root.addEventListener('click', (e) => {
    const tab = e.target.closest('.fx-tabs button');
    if (!tab) return;
    [...tab.parentElement.querySelectorAll('button')].forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      const view = document.getElementById(t.getAttribute('aria-controls'));
      if (view) view.hidden = !on;
    });
  });
}

/** FAQ search, one per product document. */
export function wireFaqs(docs) {
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
}

// the pop-up's sources live in markup, which the build rewrites for the
// site's base path — these do not pass through it, so join them here
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const asset = (path) => (path.startsWith('/') ? BASE + path : path);

/** The pop-up: screenshots open as pictures, client stories as pictures or
 *  as their video. Any `[data-lb-type]` inside `root` opens it. */
export function createLightbox(root, lightbox) {
  if (!lightbox) return { close() {}, isOpen: () => false };
  const media = lightbox.querySelector('.fx-lb__media');
  const title = lightbox.querySelector('.fx-lb__title');
  const sub = lightbox.querySelector('.fx-lb__sub');
  const closeBtn = lightbox.querySelector('.fx-lb__close');
  let returnTo = null;

  function close() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    media.replaceChildren(); // also stops a playing video
    returnTo?.focus({ preventScroll: true });
    returnTo = null;
  }

  function open(trigger) {
    const { lbType: kind, lbSrc: src } = trigger.dataset;
    title.textContent = trigger.dataset.lbTitle || '';
    sub.textContent = trigger.dataset.lbSub || '';
    if (kind === 'video') {
      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${src}?autoplay=1&rel=0`;
      frame.title = trigger.dataset.lbTitle || 'Client video';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture';
      frame.allowFullscreen = true;
      media.replaceChildren(frame);
    } else {
      const img = document.createElement('img');
      img.src = asset(src);
      img.alt = `${trigger.dataset.lbTitle || ''} — ${trigger.dataset.lbSub || ''}`;
      media.replaceChildren(img);
    }
    returnTo = trigger;
    lightbox.hidden = false;
    closeBtn.focus({ preventScroll: true });
  }

  root.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-lb-type]');
    if (trigger && root.contains(trigger)) open(trigger);
  });
  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });

  return { close, isOpen: () => !lightbox.hidden };
}
