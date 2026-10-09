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
 * One job beyond the menu bar and the theme: the row of
 * client quotes scrolls by the card, and its two arrows
 * grey out at each end.
 * ===================================================== */

initTheme();

// the connections piece is 3D, so it follows the page
afterPaint(() => import('./partners-scene.js'));

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const rail = document.querySelector('.voices__track');
const prev = document.querySelector('[data-voices="prev"]');
const next = document.querySelector('[data-voices="next"]');

function syncArrows() {
  if (!rail) return;
  const max = rail.scrollWidth - rail.clientWidth;
  if (prev) prev.disabled = rail.scrollLeft < 8;
  if (next) next.disabled = rail.scrollLeft > max - 8;
}

function step(dir) {
  const card = rail?.querySelector('.quote');
  if (!card) return;
  const gap = parseFloat(getComputedStyle(rail).columnGap) || 18;
  rail.scrollBy({ left: dir * (card.getBoundingClientRect().width + gap), behavior: REDUCED ? 'auto' : 'smooth' });
}

prev?.addEventListener('click', () => step(-1));
next?.addEventListener('click', () => step(1));
rail?.addEventListener('scroll', () => requestAnimationFrame(syncArrows), { passive: true });
window.addEventListener('resize', syncArrows);
syncArrows();
