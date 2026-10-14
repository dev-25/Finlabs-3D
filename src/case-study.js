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
 * The page is one composition: four platforms joined by
 * stairs, with the title set beside them. All this side
 * does is bring the 3D in once the page is readable —
 * and leave it out on a phone, where the picture costs
 * more than it gives.
 *
 * The five write-ups this page used to carry are kept in
 * src/partials/case-study/studies.html.
 * ===================================================== */

initTheme();

const wide = window.matchMedia('(min-width: 761px)');
let asked = false;

function wantScene() {
  if (asked || !wide.matches || !document.querySelector('[data-case-world]')) return;
  asked = true;
  afterPaint(() => import('./case-study-scene.js'));
}

// a window that starts narrow and is widened should still get it
wide.addEventListener('change', wantScene);
wantScene();
