import './doc.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import { initTheme } from './theme.js';
import './product-screen.css';
import './product-page.css';
import { buildScene, wireTabs, wireFaqs, createLightbox } from './product-ui.js';

/* =====================================================
 * PRODUCT PAGES — products/*.html
 * =====================================================
 * Each product as a page of its own: the same markup
 * the showroom shows on its monitor, laid out full width
 * with the site's menu and footer. Its 3D piece runs
 * only while it is on screen.
 * ===================================================== */

initTheme();

const doc = document.querySelector('.fx--page');

if (doc) {
  wireTabs(doc);
  wireFaqs([doc]);

  const lightbox = createLightbox(doc, document.querySelector('#fxLightbox'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') lightbox.close();
  });

  const host = doc.querySelector('[data-scene]');
  const piece = host ? buildScene(host) : null;
  if (piece) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => (entry.isIntersecting ? piece.start() : piece.stop())).observe(host);
    } else {
      piece.start();
    }
    // the loop pauses in a background tab; pick it up again on return
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && host.getBoundingClientRect().bottom > 0) piece.start();
    });
  }
}
