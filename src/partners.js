import './doc.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import './partners.css';
import { initTheme } from './theme.js';
import { afterPaint } from './after-paint.js';

/* =====================================================
 * OUR PARTNERS (and the case study page, which shares
 * this page's furniture)
 * =====================================================
 * Beyond the menu bar and the theme there is only the
 * connections piece; the client quotes moved to the home
 * page, and their rail is wired up in home-ui.js.
 * ===================================================== */

initTheme();

// the connections piece is 3D, so it follows the page
afterPaint(() => import('./partners-scene.js'));
