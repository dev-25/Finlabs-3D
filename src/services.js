import './services.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import './services-ui.js';
import { initTheme } from './theme.js';
import { afterPaint } from './after-paint.js';

/* =====================================================
 * SERVICES — what the page needs to be readable
 * =====================================================
 * The stylesheet, the menu bar and the page's own
 * behaviour load here. The workshop the five practices
 * are laid out in follows once the page is on screen;
 * see after-paint.js for why.
 * ===================================================== */

document.documentElement.classList.add('js');
initTheme();

afterPaint(() => import('./services-scene.js'));
