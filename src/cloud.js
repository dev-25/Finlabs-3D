import './doc.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import './cloud.css';
import { initTheme } from './theme.js';
import { buildCloudScene } from './cloud-scene.js';

/* =====================================================
 * SERVICES › CLOUD — page interactions
 * =====================================================
 * The platform tabs, the logo buttons in the hero and the
 * 3D clouds all pick the same platform. Also: the 7 Rs
 * picker, the "how we engage" line filling as you scroll,
 * and a gentle tilt on the service cards.
 * ===================================================== */

initTheme();

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------
// platforms: tabs + hero logos + 3D, one selection
// ---------------------------------------------------------------------

const tabs = [...document.querySelectorAll('.cl-tab')];
const panels = [...document.querySelectorAll('.cl-panel')];
const logos = [...document.querySelectorAll('.cl-logo')];
const platforms = document.querySelector('#platforms');
const stage = document.querySelector('.cl-hero__stage');
let scene = null;

function pick(id, { focus = false, scroll = false } = {}) {
  tabs.forEach((t) => {
    const on = t.dataset.cloud === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus({ preventScroll: scroll });
  });
  panels.forEach((p) => (p.hidden = p.dataset.cloud !== id));
  logos.forEach((l) => l.setAttribute('aria-pressed', String(l.dataset.cloud === id)));
  scene?.select(id);
  if (scroll) platforms.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => pick(tab.dataset.cloud));
  tab.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next = null;
    if (step) next = tabs[(i + step + tabs.length) % tabs.length];
    if (e.key === 'Home') next = tabs[0];
    if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    e.preventDefault();
    pick(next.dataset.cloud, { focus: true });
  });
});
logos.forEach((l) => l.addEventListener('click', () => pick(l.dataset.cloud, { scroll: true })));

if (stage) {
  scene = buildCloudScene(stage, {
    onPick: (id) => pick(id, { scroll: true }),
    onHover: (id) => logos.forEach((l) => l.classList.toggle('is-hover', l.dataset.cloud === id)),
  });
}
// start on AWS in the tabs, with all three clouds lit in 3D until someone chooses
pick('aws');
logos.forEach((l) => l.setAttribute('aria-pressed', 'false'));
scene?.select(null);

// #aws, #azure or #gcp in the address opens that platform
const fromHash = location.hash.slice(1);
if (tabs.some((t) => t.dataset.cloud === fromHash)) pick(fromHash, { scroll: true });

// ---------------------------------------------------------------------
// the 7 Rs
// ---------------------------------------------------------------------

const rs = [...document.querySelectorAll('.cl-r')];
const rDesc = document.querySelector('#rDesc');
const templates = [...rDesc.querySelectorAll('template')];

function showR(i, focus = false) {
  rs.forEach((b, k) => {
    b.setAttribute('aria-selected', String(k === i));
    b.tabIndex = k === i ? 0 : -1;
  });
  rDesc.querySelectorAll(':scope > :not(template)').forEach((el) => el.remove());
  rDesc.append(templates[i].content.cloneNode(true));
  rDesc.setAttribute('aria-labelledby', rs[i].id || '');
  if (focus) rs[i].focus();
}
rs.forEach((b, i) => {
  b.id = `r-${i}`;
  b.addEventListener('click', () => showR(i));
  b.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    showR((i + step + rs.length) % rs.length, true);
  });
});
showR(0);

// ---------------------------------------------------------------------
// how we engage: the line fills and each stage lights as you scroll
// ---------------------------------------------------------------------

const journey = document.querySelector('.cl-journey');
const steps = [...journey.querySelectorAll('.cl-step')];
function drawJourney() {
  const r = journey.getBoundingClientRect();
  const vh = window.innerHeight;
  // 0 when the list's top reaches 85% of the screen, 1 when its bottom reaches 55%
  const k = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.3)));
  journey.style.setProperty('--p', REDUCED ? 1 : k.toFixed(3));
  steps.forEach((s, i) => s.classList.toggle('is-on', REDUCED || k >= i / steps.length + 0.02));
}
window.addEventListener('scroll', drawJourney, { passive: true });
window.addEventListener('resize', drawJourney);
drawJourney();

// ---------------------------------------------------------------------
// service cards lean toward the pointer
// ---------------------------------------------------------------------

if (!REDUCED && window.matchMedia('(pointer: fine)').matches) {
  document.querySelectorAll('.cl-card--tilt').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 6).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 6).toFixed(2)}deg`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
    });
  });
}
