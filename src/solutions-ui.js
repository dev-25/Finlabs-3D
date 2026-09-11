/* =====================================================
 * FINLABS SOLUTIONS — page interactions (no 3D here)
 * =====================================================
 * Section tracking, reveal-on-scroll, the solution rail,
 * the "find your fit" picker, CTA-to-form prefill, the
 * demo form and magnetic buttons. The 3D scene listens
 * via onSceneChange() and onFitChange().
 * ===================================================== */

/** The eight solutions, in page order. Shared with the 3D board. */
export const SOLUTIONS = [
  { key: 'learning', name: 'Learning Hub', label: 'LEARNING HUB', accent: '#6366f1' },
  { key: 'nps', name: 'NPS Systems', label: 'NPS SYSTEMS', accent: '#0ea5e9' },
  { key: 'robo', name: 'RoboInsights', label: 'ROBOINSIGHTS', accent: '#3b82f6' },
  { key: 'onboard', name: 'SwiftOnboard', label: 'SWIFTONBOARD', accent: '#06b6d4' },
  { key: 'datapulse', name: 'DataPulse', label: 'DATAPULSE', accent: '#14b8a6' },
  { key: 'collab', name: 'CollabHub', label: 'COLLABHUB', accent: '#8b5cf6' },
  { key: 'regusure', name: 'ReguSure', label: 'REGUSURE', accent: '#22c55e' },
  { key: 'opsoptima', name: 'OpsOptima', label: 'OPSOPTIMA', accent: '#f59e0b' },
];
export const BRAND = '#2563eb';

const BY_KEY = Object.fromEntries(SOLUTIONS.map((s) => [s.key, s]));
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------
// Which section owns the middle of the viewport?
// ---------------------------------------------------------------------

const sceneListeners = new Set();
let current = { scene: 'overview', side: 'left' };

/** fn({ scene, side }) — scene is 'overview', 'fit', 'contact' or a solution key */
export function onSceneChange(fn) {
  sceneListeners.add(fn);
  fn(current);
  return () => sceneListeners.delete(fn);
}

const sections = [...document.querySelectorAll('[data-scene]')];
const rail = document.querySelector('.rail');
const railLinks = [...document.querySelectorAll('[data-rail]')];

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
  rail?.classList.toggle('on', Boolean(BY_KEY[scene]));
  railLinks.forEach((a) => a.classList.toggle('on', a.dataset.rail === scene));
  // the board steps back behind the form so the copy stays readable
  document.body.classList.toggle('dim3d', scene === 'contact');
  sceneListeners.forEach((fn) => fn(current));
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
// Find your fit — a goal lights up the matching solutions
// ---------------------------------------------------------------------

const fitListeners = new Set();
let fitKeys = [];

/** fn(keys) — the solutions recommended for the selected goal */
export function onFitChange(fn) {
  fitListeners.add(fn);
  fn(fitKeys);
  return () => fitListeners.delete(fn);
}

const goals = [...document.querySelectorAll('[data-goal]')];
const picks = [...document.querySelectorAll('[data-pick]')];
const fitCta = document.querySelector('#fitCta');
const fitCount = document.querySelector('#fitCount');

function selectGoal(btn) {
  goals.forEach((g) => g.setAttribute('aria-pressed', String(g === btn)));
  fitKeys = btn.dataset.goal.split(' ');
  picks.forEach((p) => {
    const on = fitKeys.includes(p.dataset.pick);
    p.classList.toggle('match', on);
    p.style.order = on ? fitKeys.indexOf(p.dataset.pick) : 20;
  });
  if (fitCount) fitCount.textContent = `${fitKeys.length} of 8 solutions match`;
  if (fitCta) {
    fitCta.dataset.solution = BY_KEY[fitKeys[0]].name;
    fitCta.dataset.message = `I'm interested in: ${fitKeys.map((k) => BY_KEY[k].name).join(', ')}.`;
  }
  fitListeners.forEach((fn) => fn(fitKeys));
}
goals.forEach((g) => g.addEventListener('click', () => selectGoal(g)));
if (goals.length) selectGoal(goals.find((g) => g.getAttribute('aria-pressed') === 'true') || goals[0]);

// ---------------------------------------------------------------------
// "Book a demo of X" pre-selects X in the demo form
// ---------------------------------------------------------------------

const form = document.querySelector('#demo');
const select = document.querySelector('#solutionSelect');
const note = document.querySelector('#formNote');

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-solution]');
  if (!link || !select) return;
  const match = [...select.options].find((o) => o.text === link.dataset.solution);
  if (match) select.value = match.value;
  const msg = form?.elements.message;
  if (msg && link.dataset.message && !msg.value.trim()) msg.value = link.dataset.message;
  // let the smooth scroll land before moving focus
  setTimeout(() => form?.querySelector('input[name="first"]')?.focus({ preventScroll: true }), 750);
});

// ---------------------------------------------------------------------
// Demo form — composes an email to the team. There is no backend on
// this site, so the visitor's own mail client sends it.
// ---------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s-]{10,15}$/;

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const get = (k) => String(data.get(k) || '').trim();
  const first = get('first');
  const email = get('email');
  const phone = get('phone');

  const checks = [
    [form.elements.first, Boolean(first), 'Please add your first name.'],
    [form.elements.email, EMAIL_RE.test(email), 'Please enter a valid work email.'],
    [form.elements.phone, !phone || PHONE_RE.test(phone), 'Please check the mobile number.'],
  ];
  checks.forEach(([el, ok]) => el.setAttribute('aria-invalid', String(!ok)));
  const failed = checks.find(([, ok]) => !ok);
  if (failed) {
    note.textContent = failed[2];
    note.className = 'form__note err';
    failed[0].focus();
    return;
  }

  const name = [first, get('last')].filter(Boolean).join(' ');
  const org = get('org');
  const solution = get('solution');
  const subject = `Demo request: ${solution}${org ? ` — ${org}` : ''}`;
  const body = [
    `Name: ${name}`,
    `Email: ${email}`,
    phone && `Mobile: ${phone}`,
    org && `Organisation: ${org}`,
    `Solution: ${solution}`,
    '',
    get('message') || '(no message)',
  ]
    .filter((l) => l !== false && l !== '')
    .join('\n');

  window.location.href =
    `mailto:info@finlabsindia.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  note.textContent = 'Your email app should open with the request ready to send.';
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
