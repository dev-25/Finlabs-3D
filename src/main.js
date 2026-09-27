import './style.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import { initTheme } from './theme.js';
import { afterPaint } from './after-paint.js';

/* =====================================================
 * PRODUCTS — what the page needs to be readable
 * =====================================================
 * The stylesheet and the menu bar load here. The showroom
 * the products stand in — and the viewport that opens a
 * product from inside it, which is the only way in — both
 * follow once the page is on screen; see after-paint.js.
 * ===================================================== */

initTheme();

afterPaint(() => import('./showroom.js'));
