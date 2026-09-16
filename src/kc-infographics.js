import { createList, byDate, lockScroll, trapTab, hashRouter, tilt, REDUCED } from './kc-ui.js';

/* =====================================================
 * KNOWLEDGE CENTRE — INFOGRAPHICS
 * =====================================================
 * A wall of infographics, filterable by theme. Opening one
 * shows it large on a dark stage with its notes alongside:
 * click or scroll to zoom, drag (or pinch) to move around,
 * arrows or a swipe for the next one.
 * ===================================================== */

const list = createList({
  list: document.querySelector('#kcItems'),
  group: 'theme',
  noun: 'infographics',
  sorters: { new: byDate(-1), old: byDate(1) },
});
const tiles = new Map(list.items.map((li) => [li.id, li]));
tilt(list.items.map((li) => li.querySelector('.kc-tile__open')), 6);

const viewer = document.querySelector('#kcViewer');
const box = viewer.querySelector('.kc-viewer__box');
const canvas = viewer.querySelector('.kc-viewer__canvas');
const img = viewer.querySelector('.kc-viewer__img');
const level = viewer.querySelector('.kc-viewer__level');
const shots = viewer.querySelector('.kc-viewer__shots');
const pos = viewer.querySelector('.kc-viewer__pos');
const tag = viewer.querySelector('.kc-viewer__side .kc-tag');
const time = viewer.querySelector('.kc-viewer__side time');
const title = viewer.querySelector('.kc-viewer__title');
const notes = viewer.querySelector('.kc-viewer__notes');
const full = viewer.querySelector('.kc-viewer__full');
const baseTitle = document.title;
let openId = null;
let shotIndex = 0;
let returnFocus = null;

const shotsOf = (li) =>
  li.dataset.shots.split(' ').map((s) => {
    const [src, w, h] = s.split('|');
    return { src, w: +w, h: +h };
  });

// the tile's <img> already carries the base-resolved path, so reuse its directory
function resolve(li, src) {
  const first = li.querySelector('img').getAttribute('src');
  return first.slice(0, first.lastIndexOf('/') + 1) + src.split('/').pop();
}

function showShot(i) {
  const li = tiles.get(openId);
  const all = shotsOf(li);
  shotIndex = (i + all.length) % all.length;
  const s = all[shotIndex];
  resetZoom(false);
  img.src = resolve(li, s.src);
  img.width = s.w;
  img.height = s.h;
  img.alt = `Infographic: ${title.textContent}${all.length > 1 ? ` (image ${shotIndex + 1} of ${all.length})` : ''}`;
  full.href = img.src;
  shots.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', String(k === shotIndex)));
}

function open(id) {
  const li = tiles.get(id);
  if (!li) return;
  if (openId === null) returnFocus = document.activeElement;
  openId = id;
  const order = list.matches().includes(li) ? list.matches() : list.items;
  pos.textContent = `${order.indexOf(li) + 1} of ${order.length}`;
  const cardTag = li.querySelector('.kc-tag');
  tag.textContent = cardTag.textContent;
  tag.dataset.tone = cardTag.dataset.tone;
  time.textContent = li.querySelector('time').textContent;
  title.textContent = li.querySelector('.kc-tile__title').textContent;
  notes.innerHTML = li.querySelector('.kc-tile__text').innerHTML;
  document.title = `${title.textContent} — Finlabs Infographics`;

  const all = shotsOf(li);
  shots.replaceChildren(
    ...(all.length > 1
      ? all.map((s, k) => {
          const item = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', `Image ${k + 1} of ${all.length}`);
          const t = document.createElement('img');
          t.src = resolve(li, s.src);
          t.alt = '';
          b.append(t);
          b.addEventListener('click', () => showShot(k));
          item.append(b);
          return item;
        })
      : [])
  );
  showShot(0);
  viewer.hidden = false;
  lockScroll(true);
  viewer.querySelector('[data-close]').focus({ preventScroll: true });
}

function close() {
  if (openId === null) return;
  const li = tiles.get(openId);
  openId = null;
  viewer.hidden = true;
  lockScroll(false);
  document.title = baseTitle;
  list.reveal(li);
  const btn = li.querySelector('.kc-tile__open');
  (returnFocus && document.contains(returnFocus) && returnFocus !== document.body ? returnFocus : btn).focus({ preventScroll: true });
  if (!returnFocus || returnFocus === document.body) li.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
  returnFocus = null;
}

function step(dir) {
  const order = list.matches().length ? list.matches() : list.items;
  const at = order.indexOf(tiles.get(openId));
  route.go(order[(at + dir + order.length) % order.length].id);
}

const route = hashRouter({ has: (id) => tiles.has(id), open, close });

document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-info]');
  if (opener && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    route.go(opener.dataset.info);
    return;
  }
  if (viewer.hidden) return;
  if (e.target.closest('[data-close]')) route.leave();
  const nav = e.target.closest('[data-step]');
  if (nav) step(Number(nav.dataset.step));
  const z = e.target.closest('[data-zoom]');
  if (z) {
    const d = Number(z.dataset.zoom);
    if (d === 0) resetZoom(true);
    else zoomAt(scale * (d > 0 ? 1.4 : 1 / 1.4), null, true);
  }
});

viewer.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return route.leave();
  if (e.target.closest('a, input')) return trapTab(e, box);
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === '+' || e.key === '=') zoomAt(scale * 1.4, null, true);
  else if (e.key === '-' || e.key === '_') zoomAt(scale / 1.4, null, true);
  else if (e.key === '0') resetZoom(true);
  else return trapTab(e, box);
  e.preventDefault();
});

// ---------------------------------------------------------------------
// zoom and pan: transform: translate(x, y) scale(s), from the top-left
// ---------------------------------------------------------------------

const MAX = 5;
let scale = 1;
let tx = 0;
let ty = 0;

function render(ease) {
  img.classList.toggle('is-easing', Boolean(ease) && !REDUCED);
  img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  canvas.classList.toggle('is-zoomed', scale > 1.01);
  level.textContent = `${Math.round(scale * 100)}%`;
}

// keep the zoomed picture covering its own box, so it can't be lost off screen
function clamp() {
  const w = img.offsetWidth;
  const h = img.offsetHeight;
  tx = Math.min(0, Math.max(w - w * scale, tx));
  ty = Math.min(0, Math.max(h - h * scale, ty));
}

function zoomAt(next, point, ease) {
  next = Math.min(MAX, Math.max(1, next));
  const r = img.getBoundingClientRect();
  const left = r.left - tx; // the untransformed box
  const top = r.top - ty;
  const px = (point ? point.x : r.left + r.width / 2) - left;
  const py = (point ? point.y : r.top + r.height / 2) - top;
  tx = px - ((px - tx) * next) / scale;
  ty = py - ((py - ty) * next) / scale;
  scale = next;
  if (scale === 1) tx = ty = 0;
  clamp();
  render(ease);
}

function resetZoom(ease) {
  scale = 1;
  tx = ty = 0;
  render(ease);
}

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    zoomAt(scale * Math.exp(-e.deltaY * 0.0022), { x: e.clientX, y: e.clientY }, false);
  },
  { passive: false }
);

const pointers = new Map();
let drag = null; // { x, y, tx, ty, moved, t }
let pinch = null; // { dist, scale }

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
    drag = null;
  } else {
    // pointer capture retargets later events to the canvas, so note now whether this began on the picture
    drag = { x: e.clientX, y: e.clientY, tx, ty, moved: false, t: performance.now(), onImg: e.target === img };
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    zoomAt(pinch.scale * (d / pinch.dist), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, false);
    return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 6) drag.moved = true;
  if (scale > 1.01 && drag.moved) {
    canvas.classList.add('is-dragging');
    tx = drag.tx + dx;
    ty = drag.ty + dy;
    clamp();
    render(false);
  }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  canvas.classList.remove('is-dragging');
  if (pinch) {
    if (pointers.size < 2) pinch = null;
    drag = null;
    return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const quick = performance.now() - drag.t < 450;
  if (e.type === 'pointerup' && !drag.moved && drag.onImg) {
    // a click: zoom in to that spot, or back out
    if (scale > 1.01) resetZoom(true);
    else zoomAt(2.5, { x: e.clientX, y: e.clientY }, true);
  } else if (e.type === 'pointerup' && scale <= 1.01 && quick && Math.abs(dx) > 60) {
    step(dx < 0 ? 1 : -1); // a swipe
  }
  drag = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
window.addEventListener('resize', () => {
  if (!viewer.hidden) resetZoom(false);
});

route.start();
