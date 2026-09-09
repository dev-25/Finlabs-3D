import './style.css';
import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { initTheme, onTheme } from './theme.js';

/* =====================================================
 * FINLABS SERVICES — holographic projection room
 * =====================================================
 * A dark tech chamber facing a projection wall. Scrolling
 * swaps the hologram on the wall to the next service and
 * pushes the camera a little closer.
 * ===================================================== */

initTheme();

const SERVICES = [
  { key: 'uiux', title: 'UI/UX CONSULTING', accent: 0x35d6ff, art: 'wireframe' },
  { key: 'audit', title: 'APPLICATION & INFRA AUDITS', accent: 0x4d9dff, art: 'audit' },
  { key: 'sec', title: 'CYBERSECURITY', accent: 0x7b7bff, art: 'shield' },
  { key: 'cloud', title: 'CLOUD ARCHITECTURE REVIEW', accent: 0x2ec5d8, art: 'cloud' },
  { key: 'dx', title: 'DIGITAL TRANSFORMATION', accent: 0x57e0b0, art: 'roadmap' },
];

// =====================================================
// RENDERER / SCENE / CAMERA
// =====================================================

const canvas = document.querySelector('#canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);
camera.position.set(0, 0.6, 20);

const WALL_Z = -14;
const FLOOR_Y = -4.2;
const CEIL_Y = 9;
const HALF_W = 17;

// palettes for the two themes
const THEME_COLORS = {
  dark: {
    air: 0x060b18,
    wall: 0x0d1730,
    floor: 0x081124,
    grid: 0x1f5484,
    trim: 0x1b3a63,
    rack: 0x101d38,
    rackFace: 0x1b3f6b,
    fogNear: 16,
    fogFar: 78,
    ambient: 0.5,
    holoOpacity: 0.96,
  },
  light: {
    air: 0xd7ecfa,
    wall: 0xbcd9ef,
    floor: 0xe4f3fd,
    grid: 0x8cc2e2,
    trim: 0x9dc7e3,
    rack: 0xdcecf8,
    rackFace: 0x9ac5e6,
    fogNear: 22,
    fogFar: 96,
    ambient: 1.05,
    holoOpacity: 0.8,
  },
};

scene.fog = new THREE.Fog(THEME_COLORS.dark.air, 16, 78);

// materials that recolour with the theme
const themed = [];
function themedMat(mat, key) {
  themed.push({ mat, key });
  return mat;
}

// =====================================================
// LIGHTING
// =====================================================

const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

const rim = new THREE.DirectionalLight(0x6fd3ff, 0.8);
rim.position.set(-8, 10, 12);
scene.add(rim);

const rim2 = new THREE.DirectionalLight(0x4d7bff, 0.5);
rim2.position.set(10, 6, 6);
scene.add(rim2);

// =====================================================
// CANVAS HELPERS
// =====================================================

function makeTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function rbox(w, h, d, radius = 0.1) {
  const r = Math.min(radius, Math.min(w, h, d) / 2 - 0.001);
  return new RoundedBoxGeometry(w, h, d, 3, r);
}

// =====================================================
// ROOM
// =====================================================

const room = new THREE.Group();
scene.add(room);

const floorMat = themedMat(new THREE.MeshBasicMaterial({ color: THEME_COLORS.dark.floor }), 'floor');
const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, 90), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, FLOOR_Y, WALL_Z + 40);
room.add(floor);

const grid = new THREE.GridHelper(90, 60, THEME_COLORS.dark.grid, THEME_COLORS.dark.grid);
grid.position.set(0, FLOOR_Y + 0.02, WALL_Z + 40);
grid.material.transparent = true;
grid.material.opacity = 0.4;
themed.push({ mat: grid.material, key: 'grid' });
room.add(grid);

const wallMat = themedMat(new THREE.MeshBasicMaterial({ color: THEME_COLORS.dark.wall }), 'wall');
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, CEIL_Y - FLOOR_Y), wallMat);
backWall.position.set(0, (CEIL_Y + FLOOR_Y) / 2, WALL_Z);
room.add(backWall);

const sideWallGeo = new THREE.PlaneGeometry(90, CEIL_Y - FLOOR_Y);
[-1, 1].forEach((side) => {
  const w = new THREE.Mesh(sideWallGeo, wallMat);
  w.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  w.position.set(side * HALF_W, (CEIL_Y + FLOOR_Y) / 2, WALL_Z + 40);
  room.add(w);
});

const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, 90), wallMat);
ceil.rotation.x = Math.PI / 2;
ceil.position.set(0, CEIL_Y, WALL_Z + 40);
room.add(ceil);

// neon trim lines running back toward the wall
const trimMat = themedMat(new THREE.MeshBasicMaterial({ color: 0x2f8fd6 }), 'trimGlow');
const trimGeo = new THREE.BoxGeometry(0.14, 0.14, 76);
[[-HALF_W + 0.4, FLOOR_Y + 0.5], [HALF_W - 0.4, FLOOR_Y + 0.5],
 [-HALF_W + 0.4, CEIL_Y - 0.6], [HALF_W - 0.4, CEIL_Y - 0.6]].forEach(([x, y]) => {
  const t = new THREE.Mesh(trimGeo, trimMat);
  t.position.set(x, y, WALL_Z + 36);
  room.add(t);
});

// =====================================================
// PROJECTION WALL FRAME
// =====================================================

const HOLO_W = 17;
const HOLO_H = 9.4;
const HOLO_Y = 2.1;

const frameMat = themedMat(new THREE.MeshLambertMaterial({ color: 0x16304f }), 'rack');
const frameThick = 0.34;
[[0, HOLO_H / 2 + 0.3, HOLO_W + 1.4, frameThick],
 [0, -HOLO_H / 2 - 0.3, HOLO_W + 1.4, frameThick]].forEach(([x, y, w, h]) => {
  const bar = new THREE.Mesh(rbox(w, h, 0.5, 0.14), frameMat);
  bar.position.set(x, HOLO_Y + y, WALL_Z + 0.3);
  room.add(bar);
});
[[-HOLO_W / 2 - 0.7, 0], [HOLO_W / 2 + 0.7, 0]].forEach(([x, y]) => {
  const bar = new THREE.Mesh(rbox(frameThick, HOLO_H + 1.2, 0.5, 0.14), frameMat);
  bar.position.set(x, HOLO_Y + y, WALL_Z + 0.3);
  room.add(bar);
});

// =====================================================
// HOLOGRAM ARTWORK — one panel per service
// =====================================================

function holoArt(service) {
  return makeTexture(1100, 620, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const hex = '#' + service.accent.toString(16).padStart(6, '0');

    // faint field
    ctx.fillStyle = 'rgba(40,140,200,0.10)';
    rr(ctx, 8, 8, w - 16, h - 16, 18);
    ctx.fill();

    // frame + corner ticks
    ctx.strokeStyle = hex;
    ctx.lineWidth = 3;
    rr(ctx, 8, 8, w - 16, h - 16, 18);
    ctx.stroke();
    ctx.lineWidth = 7;
    [[34, 34, 1, 1], [w - 34, 34, -1, 1], [34, h - 34, 1, -1], [w - 34, h - 34, -1, -1]]
      .forEach(([x, y, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(x + sx * 46, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + sy * 46);
        ctx.stroke();
      });

    // heading
    ctx.fillStyle = hex;
    ctx.font = '700 40px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(service.title, 58, 74);
    ctx.globalAlpha = 0.55;
    ctx.fillRect(58, 104, w - 116, 3);
    ctx.globalAlpha = 1;

    const bx = 58;
    const by = 150;
    const bw = w - 116;
    const bh = h - 240;

    ctx.strokeStyle = hex;
    ctx.fillStyle = hex;

    if (service.art === 'wireframe') {
      // stacked UI wireframes
      ctx.lineWidth = 3;
      [0, 1, 2].forEach((k) => {
        const px = bx + k * (bw / 3);
        ctx.globalAlpha = 0.9 - k * 0.2;
        ctx.strokeRect(px + 20, by + 20 + k * 18, bw / 3 - 60, bh - 80 - k * 30);
        ctx.fillRect(px + 40, by + 50 + k * 18, bw / 3 - 120, 12);
        ctx.fillRect(px + 40, by + 80 + k * 18, bw / 4, 8);
        ctx.fillRect(px + 40, by + 100 + k * 18, bw / 5, 8);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(px + 40, by + 140 + k * 18, bw / 3 - 120, bh - 240);
      });
      ctx.globalAlpha = 1;
    }

    if (service.art === 'audit') {
      // bar scan + flagged rows
      ctx.lineWidth = 3;
      const bars = [0.35, 0.62, 0.48, 0.8, 0.55, 0.7, 0.42];
      bars.forEach((v, i) => {
        const px = bx + 30 + i * ((bw - 60) / bars.length);
        const bwid = (bw - 60) / bars.length - 18;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(px, by, bwid, bh - 60);
        ctx.globalAlpha = 0.95;
        ctx.fillRect(px, by + (bh - 60) * (1 - v), bwid, (bh - 60) * v);
      });
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ff8a8a';
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.moveTo(bx, by + (bh - 60) * 0.3);
      ctx.lineTo(bx + bw, by + (bh - 60) * 0.3);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (service.art === 'shield') {
      const cx = bx + bw / 2;
      const cy = by + bh / 2 - 20;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 140);
      ctx.lineTo(cx + 110, cy - 90);
      ctx.lineTo(cx + 110, cy + 20);
      ctx.quadraticCurveTo(cx + 110, cy + 120, cx, cy + 165);
      ctx.quadraticCurveTo(cx - 110, cy + 120, cx - 110, cy + 20);
      ctx.lineTo(cx - 110, cy - 90);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.16;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(cx - 44, cy + 10);
      ctx.lineTo(cx - 10, cy + 48);
      ctx.lineTo(cx + 54, cy - 34);
      ctx.stroke();
      // scanning rings
      ctx.lineWidth = 2;
      [180, 230, 280].forEach((r, i) => {
        ctx.globalAlpha = 0.4 - i * 0.1;
        ctx.beginPath();
        ctx.arc(cx, cy + 10, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    if (service.art === 'cloud') {
      const cx = bx + bw / 2;
      const cy = by + 110;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx - 80, cy, 58, Math.PI * 0.6, Math.PI * 1.7);
      ctx.arc(cx, cy - 40, 74, Math.PI * 1.1, Math.PI * 1.95);
      ctx.arc(cx + 90, cy, 56, Math.PI * 1.4, Math.PI * 0.4);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.14;
      ctx.fill();
      ctx.globalAlpha = 1;
      // nodes beneath
      ctx.lineWidth = 3;
      [-1, 0, 1].forEach((k) => {
        const nx = cx + k * 160;
        const ny = by + bh - 70;
        ctx.beginPath();
        ctx.moveTo(cx, cy + 60);
        ctx.lineTo(nx, ny - 40);
        ctx.stroke();
        ctx.globalAlpha = 0.2;
        rr(ctx, nx - 62, ny - 40, 124, 74, 12);
        ctx.fill();
        ctx.globalAlpha = 1;
        rr(ctx, nx - 62, ny - 40, 124, 74, 12);
        ctx.stroke();
      });
    }

    if (service.art === 'roadmap') {
      ctx.lineWidth = 4;
      const y0 = by + bh - 90;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(bx + 20, y0);
      ctx.lineTo(bx + bw - 20, y0);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const stops = ['ASSESS', 'DESIGN', 'ADOPT', 'SCALE'];
      stops.forEach((s, i) => {
        const px = bx + 60 + i * ((bw - 120) / (stops.length - 1));
        const py = y0 - (i + 1) * 42;
        ctx.beginPath();
        ctx.arc(px, y0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px, y0 - 15);
        ctx.lineTo(px, py + 18);
        ctx.stroke();
        ctx.globalAlpha = 0.22;
        rr(ctx, px - 80, py - 34, 160, 52, 10);
        ctx.fill();
        ctx.globalAlpha = 1;
        rr(ctx, px - 80, py - 34, 160, 52, 10);
        ctx.stroke();
        ctx.font = '700 22px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(s, px, py - 6);
        ctx.textAlign = 'left';
      });
    }

    // readout strip
    ctx.font = '500 20px "JetBrains Mono", monospace';
    ctx.globalAlpha = 0.7;
    ctx.fillText('FINLABS // TECHNOLOGY CONSULTING', 58, h - 52);
    ctx.textAlign = 'right';
    ctx.fillText('● LIVE PROJECTION', w - 58, h - 52);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;

    // scanlines
    ctx.fillStyle = 'rgba(0,20,40,0.20)';
    for (let y = 0; y < h; y += 5) ctx.fillRect(0, y, w, 2);
  });
}

const holoGeo = new THREE.PlaneGeometry(HOLO_W, HOLO_H);
const holoPanels = SERVICES.map((s) => {
  const mesh = new THREE.Mesh(
    holoGeo,
    new THREE.MeshBasicMaterial({
      map: holoArt(s),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  mesh.position.set(0, HOLO_Y, WALL_Z + 0.4);
  room.add(mesh);
  return mesh;
});

// glow wash behind the projection
const washMat = new THREE.MeshBasicMaterial({
  color: 0x35d6ff,
  transparent: true,
  opacity: 0.16,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const wash = new THREE.Mesh(new THREE.PlaneGeometry(HOLO_W + 8, HOLO_H + 6), washMat);
wash.position.set(0, HOLO_Y, WALL_Z + 0.2);
room.add(wash);

// projector on the floor, throwing the beam at the wall
const projector = new THREE.Group();
const projBody = new THREE.Mesh(
  rbox(2.2, 1.0, 1.5, 0.22),
  themedMat(new THREE.MeshLambertMaterial({ color: 0x16304f }), 'rack')
);
projBody.position.y = 0.5;
projector.add(projBody);
const lensMat = new THREE.MeshBasicMaterial({ color: 0x9beaff });
const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 20), lensMat);
lens.rotation.x = Math.PI / 2;
lens.position.set(0, 0.55, -0.78);
projector.add(lens);
projector.position.set(0, FLOOR_Y, WALL_Z + 12);
room.add(projector);

const beamMat = new THREE.MeshBasicMaterial({
  color: 0x6fd3ff,
  transparent: true,
  opacity: 0.07,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const beam = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 0.34, 11.6, 22, 1, true), beamMat);
beam.rotation.x = Math.PI / 2;
beam.position.set(0, FLOOR_Y + 0.55, WALL_Z + 6.2);
room.add(beam);

// =====================================================
// TECH DRESSING — racks, nodes, data motes
// =====================================================

const rackFaceTex = makeTexture(256, 512, (ctx, w, h) => {
  ctx.fillStyle = '#0e2547';
  ctx.fillRect(0, 0, w, h);
  for (let r = 0; r < 12; r++) {
    const y = 22 + r * 40;
    ctx.fillStyle = 'rgba(120,215,255,0.75)';
    ctx.fillRect(24, y, 40, 8);
    ctx.fillStyle = 'rgba(120,215,255,0.35)';
    ctx.fillRect(74, y, 26, 8);
    ctx.fillStyle = r % 3 === 0 ? '#9beaff' : 'rgba(120,215,255,0.5)';
    ctx.fillRect(130, y, 76, 8);
    ctx.fillStyle = 'rgba(120,215,255,0.16)';
    ctx.fillRect(24, y + 15, 182, 3);
  }
});

const rackGeo = rbox(1.5, 4.2, 1.6, 0.24);
const rackFaceGeo = new THREE.PlaneGeometry(1.05, 3.2);
const rackFaceMat = new THREE.MeshBasicMaterial({ map: rackFaceTex });
const rackBodyMat = themedMat(new THREE.MeshLambertMaterial({ color: 0x101d38 }), 'rack');

for (let i = 0; i < 8; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const g = new THREE.Group();
  const body = new THREE.Mesh(rackGeo, rackBodyMat);
  body.position.y = 2.1;
  g.add(body);
  const face = new THREE.Mesh(rackFaceGeo, rackFaceMat);
  face.position.set(0, 2.3, 0.82);
  g.add(face);
  g.position.set(side * (HALF_W - 3.4), FLOOR_Y, WALL_Z + 6 + Math.floor(i / 2) * 9);
  g.rotation.y = side < 0 ? 0.5 : -0.5;
  room.add(g);
}

// drifting data motes
const motes = [];
{
  const geo = new THREE.SphereGeometry(0.07, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0x9beaff });
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(
      (Math.random() - 0.5) * 30,
      FLOOR_Y + Math.random() * 12,
      WALL_Z + Math.random() * 40
    );
    room.add(m);
    motes.push({ mesh: m, speed: 0.3 + Math.random() * 0.8, phase: Math.random() * 6.28 });
  }
}

// =====================================================
// THEME REACTION
// =====================================================

onTheme((mode) => {
  const t = THEME_COLORS[mode];
  scene.background = new THREE.Color(t.air);
  scene.fog.color.setHex(t.air);
  scene.fog.near = t.fogNear;
  scene.fog.far = t.fogFar;
  ambient.intensity = t.ambient;

  themed.forEach(({ mat, key }) => {
    if (key === 'trimGlow') return; // stays lit in both themes
    if (t[key] !== undefined) mat.color.setHex(t[key]);
  });

  grid.material.opacity = mode === 'dark' ? 0.4 : 0.55;
  washMat.opacity = mode === 'dark' ? 0.16 : 0.09;
  beamMat.opacity = mode === 'dark' ? 0.07 : 0.04;
  rackBodyMat.color.setHex(t.rack);
  document.body.classList.toggle('is-dark', mode === 'dark');
});

// =====================================================
// SCROLL
// =====================================================

let scrollProgress = 0;
let focus = 0;
let focusEased = 0;
let outro = 0;

const progressBar = document.querySelector('#progress span');
const scrollCue = document.querySelector('#scrollcue');
const projection = document.querySelector('.services');
const cards = [...document.querySelectorAll('.service')].map((el) => ({
  el,
  inner: el.querySelector('.service__inner'),
}));

function updateScroll() {
  const vh = window.innerHeight;
  if (vh === 0) return;

  const doc = document.documentElement.scrollHeight - vh;
  scrollProgress = doc > 0 ? window.scrollY / doc : 0;

  const sectionH = cards[0].el.offsetHeight || vh;
  const pinned = sectionH - vh;
  focus = THREE.MathUtils.clamp(
    (window.scrollY - projection.offsetTop - pinned / 2) / sectionH,
    0,
    SERVICES.length - 1
  );

  const last = cards[cards.length - 1].el;
  outro = THREE.MathUtils.clamp(
    (window.scrollY - (last.offsetTop + sectionH - vh)) / (vh * 0.9),
    0,
    1
  );

  const pinEnd = pinned / sectionH;
  cards.forEach(({ el, inner }) => {
    const d = (window.scrollY - el.offsetTop) / sectionH;
    let o = 1;
    if (d < 0) o = 1 + d / 0.3;
    else if (d > pinEnd) o = 1 - (d - pinEnd) / 0.3;
    o = THREE.MathUtils.clamp(o, 0, 1);
    inner.style.opacity = o;
    inner.style.transform = `translateY(${(1 - o) * 24}px)`;
  });

  progressBar.style.width = scrollProgress * 100 + '%';
  scrollCue.style.opacity = scrollProgress > 0.02 ? 0 : 0.95;
}
window.addEventListener('scroll', updateScroll, { passive: true });

// =====================================================
// 3D ON / OFF
// =====================================================

let enabled = true;
let running = false;
const toggle = document.querySelector('#toggle3d');
toggle.addEventListener('click', () => {
  enabled = !enabled;
  toggle.setAttribute('aria-pressed', String(enabled));
  toggle.querySelector('[data-state]').textContent = enabled ? 'ON' : 'OFF';
  document.body.classList.toggle('no3d', !enabled);
  if (enabled && !running) loop();
});

// =====================================================
// ANIMATION
// =====================================================

const timer = new Timer();
const lookTarget = new THREE.Vector3(0, HOLO_Y, WALL_Z);
const accentColor = new THREE.Color();

function loop() {
  if (!enabled) {
    running = false;
    return;
  }
  running = true;
  requestAnimationFrame(loop);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw > 0 && vh > 0 && Math.abs(camera.aspect - vw / vh) > 0.001) handleResize();

  timer.update();
  const t = timer.getElapsed();

  focusEased += (focus - focusEased) * 0.1;

  // crossfade the projections, with a flicker as they swap
  const flicker = 0.93 + Math.sin(t * 26) * 0.035 + Math.sin(t * 61) * 0.02;
  holoPanels.forEach((p, i) => {
    const near = 1 - THREE.MathUtils.clamp(Math.abs(focusEased - i), 0, 1);
    p.material.opacity = near * flicker;
    p.position.y = HOLO_Y + Math.sin(t * 0.7 + i) * 0.06;
    p.visible = near > 0.002;
  });

  // wash + trim take the colour of whichever service is showing
  const idx = Math.round(THREE.MathUtils.clamp(focusEased, 0, SERVICES.length - 1));
  accentColor.setHex(SERVICES[idx].accent);
  washMat.color.lerp(accentColor, 0.05);
  trimMat.color.lerp(accentColor, 0.03);
  lensMat.color.lerp(accentColor, 0.05);

  // camera eases toward the wall as you go, drifting slightly
  const zTarget = 20 - focusEased * 1.5 - outro * 3.5;
  camera.position.z += (zTarget - camera.position.z) * 0.06;
  camera.position.x += (Math.sin(t * 0.25) * 0.7 - camera.position.x) * 0.05;
  camera.position.y += (0.6 + Math.sin(t * 0.4) * 0.25 - camera.position.y) * 0.05;
  camera.lookAt(lookTarget);

  // motes drift toward the wall and wrap around
  motes.forEach((m) => {
    m.mesh.position.z -= m.speed * 0.02;
    m.mesh.position.y += Math.sin(t * 0.8 + m.phase) * 0.002;
    if (m.mesh.position.z < WALL_Z + 0.5) m.mesh.position.z = WALL_Z + 40;
  });

  renderer.render(scene, camera);
}

// =====================================================
// RESIZE
// =====================================================

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  updateScroll();
}
window.addEventListener('resize', handleResize);

updateScroll();
loop();
