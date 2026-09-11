/* =====================================================
 * FINLABS HOME — page interactions (no 3D here)
 * =====================================================
 * Reveal-on-scroll, the testimonial carousel, award
 * cards that tilt toward the pointer, and magnetic
 * buttons.
 * ===================================================== */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = window.matchMedia('(pointer: fine)').matches;

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
// Award cards lean toward the pointer, with a moving sheen
// ---------------------------------------------------------------------

if (!REDUCED && FINE) {
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(-4px)`;
      card.style.setProperty('--gx', `${Math.round((x + 0.5) * 100)}%`);
      card.style.setProperty('--gy', `${Math.round((y + 0.5) * 100)}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  });
}

// ---------------------------------------------------------------------
// Magnetic buttons — a slight pull toward the pointer
// ---------------------------------------------------------------------

if (!REDUCED && FINE) {
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
