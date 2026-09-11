import './doc.css';
import './about.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import { initTheme } from './theme.js';
import './about-hero.js';
import './about-journey.js';

/* =====================================================
 * FINLABS ABOUT US — page interactions
 * =====================================================
 * Team tabs, the profile dialog and reveal-on-scroll,
 * plus the small 3D touches: the group photo and press
 * cards tilt toward the pointer, and the partner wall
 * leans with it.
 * ===================================================== */

document.documentElement.classList.add('js');
initTheme();

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = window.matchMedia('(pointer: fine)').matches;

// ---------------------------------------------------------------------
// Team tabs — Board of Directors, Advisory Board, Senior Leadership
// ---------------------------------------------------------------------

const tabs = [...document.querySelectorAll('.a-tabs [role="tab"]')];

function selectTab(tab, focus = false) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
  if (focus) tab.focus();
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let next = null;
    if (step) next = tabs[(i + step + tabs.length) % tabs.length];
    if (e.key === 'Home') next = tabs[0];
    if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    e.preventDefault();
    selectTab(next, true);
  });
});

// ---------------------------------------------------------------------
// Profile dialog — the full biography behind each card
// ---------------------------------------------------------------------

const dialog = document.querySelector('#bio');
const dPhoto = dialog?.querySelector('.bio__photo img');
const dGroup = dialog?.querySelector('.bio__group');
const dName = dialog?.querySelector('#bioName');
const dRole = dialog?.querySelector('.bio__role');
const dText = dialog?.querySelector('.bio__text');
let opener = null;

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-bio]');
  if (!trigger || !dialog) return;
  const slug = trigger.dataset.bio;
  const bio = document.getElementById(`bio-${slug}`);
  // the founders' names in the story open the same profile as their card
  const card = trigger.classList.contains('person') ? trigger : document.querySelector(`.person[data-bio="${slug}"]`);
  if (!bio || !card) return;
  const img = card.querySelector('img');
  dPhoto.src = img.currentSrc || img.src;
  dPhoto.alt = `Portrait of ${card.querySelector('.person__name').textContent}`;
  dName.textContent = card.querySelector('.person__name').textContent;
  dRole.textContent = card.querySelector('.person__role').textContent;
  dGroup.textContent = card.closest('[role="tabpanel"]')?.dataset.group || '';
  dText.replaceChildren(bio.content.cloneNode(true));
  opener = trigger;
  dialog.showModal();
  dialog.querySelector('.bio__inner').scrollTop = 0;
});

dialog?.querySelector('.bio__close').addEventListener('click', () => dialog.close());
// a click on the dimmed backdrop lands on the <dialog> itself
dialog?.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});
dialog?.addEventListener('close', () => opener?.focus());

// ---------------------------------------------------------------------
// 3D touches — tilt toward the pointer, and the leaning partner wall
// ---------------------------------------------------------------------

if (!REDUCED && FINE) {
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    const max = Number(el.dataset.tilt) || 5;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
    });
  });

  const wall = document.querySelector('.a-wall');
  wall?.addEventListener('pointermove', (e) => {
    const r = wall.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    wall.style.setProperty('--wy', `${(x * 7).toFixed(2)}deg`);
    wall.style.setProperty('--wx', `${(-y * 5).toFixed(2)}deg`);
  });
  wall?.addEventListener('pointerleave', () => {
    wall.style.removeProperty('--wy');
    wall.style.removeProperty('--wx');
  });
}

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
