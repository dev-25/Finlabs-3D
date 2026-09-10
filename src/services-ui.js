/* =====================================================
 * FINLABS SERVICES — page interactions (no 3D here)
 * =====================================================
 * Section tracking, reveal-on-scroll, the practice rail,
 * CTA-to-form prefill, the enquiry form and magnetic
 * buttons. The 3D scene subscribes via onSceneChange().
 * ===================================================== */

const ACCENT_HEX = {
  core: '#3b82f6',
  uiux: '#8b5cf6',
  audit: '#14b8a6',
  security: '#6366f1',
  cloud: '#0ea5e9',
  transform: '#22c55e',
};
const PRACTICES = ['uiux', 'audit', 'security', 'cloud', 'transform'];
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------
// Which section owns the middle of the viewport?
// ---------------------------------------------------------------------

const listeners = new Set();
let current = { scene: 'core', mode: 'side' };

/** fn(scene, mode) — mode is 'side' (beside the copy) or 'back' (behind full-width sections) */
export function onSceneChange(fn) {
  listeners.add(fn);
  fn(current.scene, current.mode);
  return () => listeners.delete(fn);
}

const sections = [...document.querySelectorAll('[data-scene]')];
const rail = document.querySelector('.rail');
const railLinks = [...document.querySelectorAll('[data-rail]')];

function track() {
  const mid = window.innerHeight * 0.5;
  let hit = null;
  // last match wins, so nested/later sections take priority
  sections.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top <= mid && r.bottom >= mid) hit = el;
  });
  if (!hit) return;

  const scene = hit.dataset.scene;
  const mode = hit.closest('.process, .why, .contact') ? 'back' : 'side';
  if (scene === current.scene && mode === current.mode) return;
  current = { scene, mode };

  document.body.style.setProperty('--accent', ACCENT_HEX[scene] || ACCENT_HEX.core);
  const inPractice = PRACTICES.includes(scene);
  rail?.classList.toggle('on', inPractice);
  railLinks.forEach((a) => a.classList.toggle('on', a.dataset.rail === scene));
  listeners.forEach((fn) => fn(scene, mode));
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

// Safety net: reveal anything already on screen. IntersectionObserver alone
// can miss elements when the page mounts hidden, and copy that never
// appears is the worst possible failure on a page meant to convert.
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
// "Talk to us about X" pre-selects X in the enquiry form
// ---------------------------------------------------------------------

const form = document.querySelector('#enquiry');
const select = document.querySelector('#serviceSelect');
const note = document.querySelector('#formNote');

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-service]');
  if (!link || !select) return;
  const wanted = link.dataset.service;
  const match = [...select.options].find((o) => o.text === wanted);
  if (match) select.value = match.value;
  // let the smooth scroll land before moving focus
  setTimeout(() => form?.querySelector('input[name="name"]')?.focus({ preventScroll: true }), 750);
});

// ---------------------------------------------------------------------
// Enquiry form — composes an email to the team. There is no backend on
// this site, so the visitor's own mail client sends it.
// ---------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const get = (k) => String(data.get(k) || '').trim();
  const name = get('name');
  const email = get('email');

  const nameEl = form.elements.name;
  const emailEl = form.elements.email;
  nameEl.setAttribute('aria-invalid', String(!name));
  emailEl.setAttribute('aria-invalid', String(!EMAIL_RE.test(email)));

  if (!name || !EMAIL_RE.test(email)) {
    note.textContent = !name ? 'Please add your name.' : 'Please enter a valid work email.';
    note.className = 'form__note err';
    (!name ? nameEl : emailEl).focus();
    return;
  }

  const company = get('company');
  const service = get('service');
  const message = get('message');
  const subject = `Enquiry: ${service}${company ? ` — ${company}` : ''}`;
  const body = [
    `Name: ${name}`,
    `Email: ${email}`,
    company && `Company: ${company}`,
    `Interested in: ${service}`,
    '',
    message || '(no message)',
  ]
    .filter((l) => l !== false && l !== '')
    .join('\n');

  window.location.href =
    `mailto:info@finlabsindia.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  note.textContent = 'Your email app should open with the enquiry ready to send.';
  note.className = 'form__note ok';
});

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
