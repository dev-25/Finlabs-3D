/* =====================================================
 * FINLABS HOME — page interactions (no 3D here)
 * =====================================================
 * Section tracking, reveal-on-scroll, the testimonial
 * carousel and magnetic buttons. The 3D lobby listens
 * via onSceneChange().
 * ===================================================== */

export const DOORS = [
  { key: 'products', label: 'PRODUCTS', accent: '#2563eb' },
  { key: 'solutions', label: 'SOLUTIONS', accent: '#06b6d4' },
  { key: 'services', label: 'SERVICES', accent: '#8b5cf6' },
];
export const BRAND = '#2563eb';

const BY_KEY = Object.fromEntries(DOORS.map((d) => [d.key, d]));
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------
// Which section owns the middle of the viewport?
// ---------------------------------------------------------------------

const listeners = new Set();
let current = { scene: 'hero', side: 'left' };

/** fn({ scene, side }) — scene is 'hero', 'voices', 'cta' or a door key */
export function onSceneChange(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

const sections = [...document.querySelectorAll('[data-scene]')];

function track() {
  const mid = window.innerHeight * 0.5;
  let hit = null;
  sections.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top <= mid && r.bottom >= mid) hit = el;
  });
  if (!hit) return;

  const scene = hit.dataset.scene;
  const side = hit.dataset.side || 'left';
  if (scene === current.scene && side === current.side) return;
  current = { scene, side };

  document.body.style.setProperty('--accent', BY_KEY[scene]?.accent || BRAND);
  // the lobby steps back behind the long-form sections so they stay readable
  document.body.classList.toggle('dim3d', scene === 'voices' || scene === 'cta');
  listeners.forEach((fn) => fn(current));
}

let queued = false;
function queueTrack() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    track();
  });
}
window.addEventListener('scroll', queueTrack, { passive: true });
window.addEventListener('resize', queueTrack);
track();

// ---------------------------------------------------------------------
// Reveal on scroll, lightly staggered within each parent
// ---------------------------------------------------------------------

const revealables = [...document.querySelectorAll('[data-reveal]')];
revealables.forEach((el) => {
  const siblings = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
  el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 6) * 70}ms`;
});

// Safety net: IntersectionObserver alone can miss elements when the page
// mounts hidden, so anything already on screen is revealed directly too.
function revealVisible() {
  const h = window.innerHeight || document.documentElement.clientHeight;
  if (!h) return;
  revealables.forEach((el) => {
    if (el.classList.contains('in')) return;
    const r = el.getBoundingClientRect();
    if (r.top < h * 0.94 && r.bottom > 0) el.classList.add('in');
  });
}
window.addEventListener('scroll', () => requestAnimationFrame(revealVisible), { passive: true });
window.addEventListener('resize', revealVisible);
document.addEventListener('visibilitychange', revealVisible);
window.addEventListener('load', revealVisible);
requestAnimationFrame(revealVisible);

if ('IntersectionObserver' in window && !REDUCED) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );
  revealables.forEach((el) => io.observe(el));
} else {
  revealables.forEach((el) => el.classList.add('in'));
}

// ---------------------------------------------------------------------
// Testimonials — a scroll-snap row with previous / next buttons
// ---------------------------------------------------------------------

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

// ---------------------------------------------------------------------
// Magnetic buttons — a slight pull toward the pointer
// ---------------------------------------------------------------------

if (!REDUCED && window.matchMedia('(pointer: fine)').matches) {
  document.querySelectorAll('[data-magnetic]').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${dx * 0.16}px, ${dy * 0.28}px)`;
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.transform = '';
    });
  });
}
