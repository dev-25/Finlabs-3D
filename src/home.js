import './home.css';
import './bang.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import './home-ui.js';
import { initTheme } from './theme.js';
import { afterPaint } from './after-paint.js';

/* =====================================================
 * HOME — what the page needs to be readable
 * =====================================================
 * The stylesheet, the menu bar and the page's own
 * behaviour load here. The 3D — the hero's three
 * machines, a model in each offering tile and the gold
 * trophy — follows once the page is on screen; see
 * after-paint.js for why.
 * ===================================================== */

document.documentElement.classList.add('js');
initTheme();

afterPaint(() => import('./home-scene.js'));
