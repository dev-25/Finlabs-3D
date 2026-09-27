import './solutions.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import './solutions-ui.js';
import { initTheme } from './theme.js';
import { afterPaint } from './after-paint.js';

/* =====================================================
 * SOLUTIONS — what the page needs to be readable
 * =====================================================
 * The stylesheet, the menu bar and the page's own
 * behaviour load here. The board each solution is built
 * on follows once the page is on screen; see
 * after-paint.js for why.
 * ===================================================== */

document.documentElement.classList.add('js');
initTheme();

afterPaint(() => import('./solutions-scene.js'));
