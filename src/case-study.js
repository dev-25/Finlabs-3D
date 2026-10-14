import './doc.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import './partners.css';
import './case-study.css';
import { initTheme } from './theme.js';
import { afterPaint } from './after-paint.js';

/* =====================================================
 * CASE STUDIES
 * =====================================================
 * The run of platforms is 3D and follows the page. This
 * side of it keeps the write-ups and the run pointing at
 * the same study, in both directions, and works on its
 * own if the 3D never arrives.
 * ===================================================== */

initTheme();

const studies = [...document.querySelectorAll('.cs-study')];
const labels = [...document.querySelectorAll('[data-case-label]')];

function highlight(i) {
  studies.forEach((el, k) => el.classList.toggle('is-active', k === i));
  labels.forEach((el, k) => el.classList.toggle('is-active', k === i));
}

// a label, or a platform, brings its study forward
labels.forEach((el) => {
  el.addEventListener('click', () => {
    const i = Number(el.dataset.go);
    window.__caseSelect?.(i);
    highlight(i);
    studies[i]?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  });
});

// and the scene says which one it is showing
function listen() {
  window.__onCaseSelect?.((id, i) => highlight(i));
}

highlight(0);

// The world is hidden on a phone, so it is not fetched there. A window that
// starts narrow and is widened should still get it, hence the listener.
const wide = window.matchMedia('(min-width: 761px)');
let asked = false;
function wantScene() {
  if (asked || !wide.matches || !document.querySelector('[data-case-world]')) return;
  asked = true;
  afterPaint(() => import('./case-study-scene.js').then(listen));
}
wide.addEventListener('change', wantScene);
wantScene();
