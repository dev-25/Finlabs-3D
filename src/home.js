import './home.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import './home-ui.js';
import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initTheme, onTheme } from './theme.js';

/* =====================================================
 * FINLABS HOME — 3D set into the page
 * =====================================================
 * One transparent canvas above the page draws several
 * small scenes, each into the box of the element that
 * asks for it ([data-view]). Rather than one backdrop
 * scene with a flying camera, the 3D sits in the layout
 * and scrolls with it: offering cards in the hero, a
 * model in each offering tile, and a gold trophy among
 * the awards.
 * ===================================================== */

document.documentElement.classList.add('js');
initTheme();

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DISPLAY = '"Outfit", "Segoe UI", system-ui, sans-serif';
const BODY = '"Inter", "Segoe UI", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

const THEME3D = {
  light: { panel: 0xffffff, metal: 0xb9c6dc, chip: 0x1c2a4c, env: 1.0, exposure: 1.0, hemi: 0.6, sun: 1 },
  dark: { panel: 0x27324f, metal: 0x4d5b82, chip: 0x1b2748, env: 0.75, exposure: 1.1, hemi: 0.4, sun: 0.85 },
};

// =====================================================
// RENDERER
// =====================================================

const canvas = document.querySelector('#scene');
// A hidden tab can mount at 0 x 0; fall back so sizes never become NaN.
const vw0 = window.innerWidth || 1280;
const vh0 = window.innerHeight || 720;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(vw0, vh0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false; // cleared once per frame; each view then draws into its own box

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// =====================================================
// HELPERS
// =====================================================

const clamp01 = (x) => Math.min(1, Math.max(0, x));
function easeOutBack(x) {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

function rbox(w, h, d, r = 0.1) {
  return new RoundedBoxGeometry(w, h, d, 4, Math.min(r, Math.min(w, h, d) / 2 - 0.001));
}

function makeTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
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

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function starShape(outer, inner) {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? inner : outer;
    const a = Math.PI / 2 + (k * Math.PI) / 5;
    if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

function glowTexture(color) {
  return makeTexture(256, 256, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

const shadowTex = makeTexture(256, 256, (ctx, w) => {
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(10,20,50,0.55)');
  g.addColorStop(1, 'rgba(10,20,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
});

// =====================================================
// SHARED MATERIALS (recoloured by theme)
// =====================================================

const T0 = THEME3D.light;
const M = {
  panel: new THREE.MeshPhysicalMaterial({ color: T0.panel, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
  metal: new THREE.MeshPhysicalMaterial({ color: T0.metal, metalness: 0.75, roughness: 0.28, clearcoat: 0.4 }),
  chip: new THREE.MeshPhysicalMaterial({ color: T0.chip, roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.2 }),
  gold: new THREE.MeshPhysicalMaterial({ color: 0xf5c451, metalness: 1, roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
};

function accentMat(hex, glow = 0.12) {
  return new THREE.MeshPhysicalMaterial({
    color: hex, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15,
    emissive: hex, emissiveIntensity: glow,
  });
}
function glowMat(hex, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color: hex, transparent: opacity < 1, opacity,
    depthWrite: opacity >= 1, blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
}

// gold ₹ coins, shared by the hero
const coinTex = makeTexture(256, 256, (ctx, w) => {
  const g = ctx.createRadialGradient(w * 0.38, w * 0.32, w * 0.04, w / 2, w / 2, w / 2);
  g.addColorStop(0, '#fff3c4');
  g.addColorStop(0.55, '#f2c14e');
  g.addColorStop(1, '#b7791f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(122,74,8,0.55)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2 - 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#8a5a0b';
  ctx.font = '700 150px Inter, "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₹', w / 2, w / 2 + 8);
});
const coinFaceMat = new THREE.MeshStandardMaterial({ map: coinTex, metalness: 0.5, roughness: 0.3 });
function makeCoin(r) {
  const c = new THREE.Group();
  const rimGeo = new THREE.CylinderGeometry(r, r, r * 0.22, 40);
  rimGeo.rotateX(Math.PI / 2); // faces along z
  c.add(new THREE.Mesh(rimGeo, M.gold));
  const faceGeo = new THREE.CircleGeometry(r * 0.94, 40);
  const front = new THREE.Mesh(faceGeo, coinFaceMat);
  front.position.z = r * 0.112;
  const back = new THREE.Mesh(faceGeo, coinFaceMat);
  back.position.z = -r * 0.112;
  back.rotation.y = Math.PI;
  c.add(front, back);
  return c;
}

// =====================================================
// VIEWS — one small scene per [data-view] box
// =====================================================

const views = [];
const themedFaces = []; // redrawn on theme change
const typeFaces = []; // redrawn once the webfonts have loaded

const pointer = new THREE.Vector2();
window.addEventListener(
  'pointermove',
  (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
  { passive: true }
);

function addView(key, setup) {
  const el = document.querySelector(`[data-view="${key}"]`);
  if (!el) return;
  const scene = new THREE.Scene();
  scene.environment = envTex;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899cc, T0.hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(4, 8, 7);
  const rim = new THREE.DirectionalLight(0x9db7ff, 0.8);
  rim.position.set(-6, 3, -5);
  scene.add(hemi, sun, rim);
  const view = {
    key, el, scene, hemi, sun, sunBase: 1.4,
    camera: new THREE.PerspectiveCamera(30, 1, 0.1, 100),
    look: new THREE.Vector3(),
    dir: new THREE.Vector3(0, 0.15, 1),
    fitR: 2, // radius that must stay in frame, whatever the box's shape
    entered: false,
    seen: 0, // entrance progress, 0..1, starts once the box is on screen
    onScreen: false,
  };
  Object.assign(view, setup(view));
  view.dir.normalize();
  views.push(view);
}

function fitCamera(v, aspect) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(v.camera.fov / 2));
  const dist = v.fitR / (tanV * Math.min(1, aspect));
  v.camera.position.copy(v.look).addScaledVector(v.dir, dist);
  v.camera.lookAt(v.look);
  v.camera.aspect = aspect;
  v.camera.updateProjectionMatrix();
}

// =====================================================
// HERO — the three offerings as glossy cards, with ₹ coins
// =====================================================

const OFFERS = [
  { key: 'products', title: 'Products', sub: 'Five platforms', n: '01', c: ['#1e3a8a', '#2563eb', '#60a5fa'] },
  { key: 'solutions', title: 'Solutions', sub: 'Eight building blocks', n: '02', c: ['#155e75', '#0891b2', '#5eead4'] },
  { key: 'services', title: 'Services', sub: 'Consult · build · run', n: '03', c: ['#4c1d95', '#7c3aed', '#c4b5fd'] },
];

function drawIcon(ctx, key, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  const line = (pts) => {
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  };
  if (key === 'products') {
    rr(ctx, 3, 4.5, 18, 11.5, 2);
    ctx.stroke();
    line([[1.5, 19.5], [22.5, 19.5]]);
    line([[7, 12.5], [10, 9.5], [12.5, 12], [17, 7.5]]);
  } else if (key === 'solutions') {
    rr(ctx, 6, 6, 12, 12, 2.5);
    ctx.stroke();
    rr(ctx, 9.5, 9.5, 5, 5, 1);
    ctx.stroke();
    [[9, 2.5, 9, 6], [15, 2.5, 15, 6], [9, 18, 9, 21.5], [15, 18, 15, 21.5],
      [2.5, 9, 6, 9], [2.5, 15, 6, 15], [18, 9, 21.5, 9], [18, 15, 21.5, 15]]
      .forEach(([a, b, c, d]) => line([[a, b], [c, d]]));
  } else {
    ctx.beginPath();
    ctx.arc(12, 12, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(12, 12, 9.5, 4, (-25 * Math.PI) / 180, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(19.6, 8.4, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const CW = 3.4; // card width, height and depth (credit-card proportions)
const CH = 2.15;
const CD = 0.07;
const FACE_W = CW - 0.03;
const FACE_H = CH - 0.03;

function cardFace(o) {
  return makeTexture(1024, 648, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, w, 0);
    g.addColorStop(0, o.c[0]);
    g.addColorStop(0.55, o.c[1]);
    g.addColorStop(1, o.c[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const shine = ctx.createRadialGradient(w * 0.82, h * 0.05, 0, w * 0.82, h * 0.05, w * 0.6);
    shine.addColorStop(0, 'rgba(255,255,255,0.35)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 3;
    for (let r = 140; r < 760; r += 64) {
      ctx.beginPath();
      ctx.arc(w + 40, h + 60, r, Math.PI, Math.PI * 1.5);
      ctx.stroke();
    }
    // the title sits near the top, so the strip that peeks out of the fan names each card
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 40px ${DISPLAY}`;
    ctx.fillText('finlabs', 64, 88);
    ctx.globalAlpha = 0.85;
    ctx.textAlign = 'right';
    ctx.font = `700 28px ${MONO}`;
    ctx.fillText(`${o.n} / 03`, w - 64, 86);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    ctx.font = `800 120px ${DISPLAY}`;
    ctx.fillText(o.title, 58, 228);
    ctx.globalAlpha = 0.88;
    ctx.font = `500 38px ${BODY}`;
    ctx.fillText(o.sub, 64, 290);
    ctx.globalAlpha = 0.72;
    ctx.font = `600 22px ${MONO}`;
    ctx.fillText('CELEBRATING A DECADE', 66, h - 70);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(w - 150, h - 150, 84, 0, Math.PI * 2);
    ctx.fill();
    drawIcon(ctx, o.key, w - 200, h - 200, 100);
  });
}

function cardBack(o) {
  return makeTexture(512, 324, (ctx, w, h) => {
    const g = ctx.createLinearGradient(w, h, 0, 0);
    g.addColorStop(0, o.c[0]);
    g.addColorStop(1, o.c[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.font = `800 120px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('finlabs', w / 2, h / 2);
  });
}

// ShapeGeometry UVs are raw shape coordinates; map them onto 0..1
function fitFace(tex) {
  tex.repeat.set(1 / FACE_W, 1 / FACE_H);
  tex.offset.set(0.5, 0.5);
  return tex;
}

const cardBodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(CW - 0.04, CH - 0.04, 0.12), {
  depth: CD - 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 3, curveSegments: 12,
});
cardBodyGeo.translate(0, 0, -(CD - 0.03) / 2);
const cardFaceGeo = new THREE.ShapeGeometry(roundedRectShape(FACE_W, FACE_H, 0.125), 12);

addView('hero', (v) => {
  v.fitR = 2.95;
  v.look.set(0.1, 0, 0);
  v.dir.set(0, 0.08, 1);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(34,211,238,0.9)'), transparent: true, depthWrite: false, opacity: 0.5, toneMapped: false })
  );
  glow.position.z = -2.4;
  v.scene.add(glow);

  const root = new THREE.Group();
  v.scene.add(root);

  // front to back: Products, Solutions, Services
  // stepped far enough apart that each back card's title strip stays visible
  const FAN = [
    { p: [0.75, -0.9, 0.6], r: [-0.06, -0.3, -0.08] },
    { p: [0.0, 0.05, 0], r: [-0.03, -0.24, 0.04] },
    { p: [-0.75, 1.0, -0.6], r: [0.02, -0.18, 0.12] },
  ];
  const cards = OFFERS.map((o, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(cardBodyGeo, new THREE.MeshPhysicalMaterial({
      color: o.c[1], roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15,
    }));
    const faceMat = new THREE.MeshPhysicalMaterial({
      map: fitFace(cardFace(o)), roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1,
    });
    typeFaces.push({ mat: faceMat, draw: () => fitFace(cardFace(o)) });
    const face = new THREE.Mesh(cardFaceGeo, faceMat);
    face.position.z = CD / 2 + 0.002;
    const backMat = new THREE.MeshPhysicalMaterial({ map: fitFace(cardBack(o)), roughness: 0.35, clearcoat: 1 });
    typeFaces.push({ mat: backMat, draw: () => fitFace(cardBack(o)) });
    const back = new THREE.Mesh(cardFaceGeo, backMat);
    back.position.z = -CD / 2 - 0.002;
    back.rotation.y = Math.PI;
    g.add(body, face, back);
    root.add(g);
    return { g, home: FAN[i] };
  });

  const coins = [[-2.1, -1.25, 0.9, 0.34], [2.25, 1.35, -0.3, 0.3], [-2.35, 1.55, 0.5, 0.22], [1.95, -1.75, 1.0, 0.2]]
    .map(([x, y, z, r], k) => {
      const c = makeCoin(r);
      c.userData = { x, y, z, k };
      root.add(c);
      return c;
    });

  const beads = [[2.45, -0.95, -0.6, 0.26, 0x22d3ee], [-1.55, -1.8, 0.2, 0.17, 0xa78bfa], [0.6, 1.85, -0.9, 0.14, 0x60a5fa]]
    .map(([x, y, z, r, hex], k) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), accentMat(hex, 0.25));
      m.userData = { x, y, z, k };
      root.add(m);
      return m;
    });

  const tilt = new THREE.Vector2();
  return {
    update(t, rect) {
      // as the hero scrolls away the cards fan further apart
      const away = clamp01(-rect.top / (rect.height * 0.9));
      tilt.x += (pointer.y * 0.16 - tilt.x) * 0.06;
      tilt.y += (pointer.x * 0.26 - tilt.y) * 0.06;
      root.rotation.set(tilt.x, tilt.y, 0);
      cards.forEach(({ g, home }, i) => {
        const e = easeOutBack(clamp01(v.seen * 1.6 - i * 0.18));
        const spread = 1 + away * 0.55;
        g.position.set(
          home.p[0] * spread,
          home.p[1] * spread - (1 - e) * 2.2 + Math.sin(t * 0.9 + i * 1.7) * 0.07,
          home.p[2] * spread
        );
        g.rotation.set(home.r[0] + Math.sin(t * 0.6 + i) * 0.03, home.r[1] - away * 0.25, home.r[2] * spread);
        g.scale.setScalar(Math.max(0.001, e));
      });
      const ce = Math.max(0.001, easeOutBack(clamp01(v.seen * 1.4 - 0.35)));
      coins.forEach((c) => {
        const { x, y, z, k } = c.userData;
        c.position.set(x, y + Math.sin(t * 1.2 + k) * 0.12, z);
        c.rotation.set(0.25, t * 1.1 + k, 0);
        c.scale.setScalar(ce);
      });
      beads.forEach((m) => {
        const { x, y, z, k } = m.userData;
        m.position.set(x, y + Math.sin(t * 0.8 + k * 2) * 0.15, z);
        m.scale.setScalar(ce);
      });
    },
  };
});

// =====================================================
// OFFERING TILES — a small model in each
// =====================================================

function laptopScreen(mode) {
  const dark = mode === 'dark';
  return makeTexture(512, 320, (ctx, w, h) => {
    const bg = dark ? '#0f1830' : '#ffffff';
    const card = dark ? '#1a2544' : '#eef3fb';
    const ink = dark ? '#e8edff' : '#15203a';
    const mute = dark ? 'rgba(232,237,255,0.3)' : 'rgba(21,32,58,0.18)';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = card;
    ctx.fillRect(0, 0, 92, h);
    ctx.fillStyle = '#2563eb';
    rr(ctx, 20, 20, 52, 18, 9);
    ctx.fill();
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = k === 1 ? '#2563eb' : mute;
      rr(ctx, 20, 64 + k * 30, 52, 12, 6);
      ctx.fill();
    }
    [['₹', '#2563eb'], ['↗', '#22c55e'], ['◎', '#06b6d4']].forEach(([glyph, col], k) => {
      const x = 110 + k * 132;
      ctx.fillStyle = card;
      rr(ctx, x, 22, 118, 70, 12);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.font = '700 30px Inter, Arial, sans-serif';
      ctx.fillText(glyph, x + 14, 58);
      ctx.fillStyle = ink;
      rr(ctx, x + 14, 70, 70, 9, 4);
      ctx.fill();
    });
    ctx.fillStyle = card;
    rr(ctx, 110, 108, 382, 190, 14);
    ctx.fill();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    [0.25, 0.42, 0.36, 0.58, 0.5, 0.72, 0.66, 0.9].forEach((val, k, a) => {
      const x = 130 + (k / (a.length - 1)) * 342;
      const y = 280 - val * 150;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  });
}

function buildLaptop(accent) {
  const holder = new THREE.Group();
  const g = new THREE.Group();
  g.position.y = -0.3;
  g.rotation.x = 0.3;
  holder.add(g);
  g.add(new THREE.Mesh(rbox(1.3, 0.07, 0.86, 0.035), M.panel));
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.03, -0.42);
  hinge.rotation.x = -0.28;
  g.add(hinge);
  const lid = new THREE.Mesh(rbox(1.3, 0.84, 0.05, 0.04), M.chip);
  lid.position.y = 0.42;
  hinge.add(lid);
  const screenMat = new THREE.MeshBasicMaterial({ map: laptopScreen('light'), toneMapped: false });
  themedFaces.push({ mat: screenMat, draw: laptopScreen });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), screenMat);
  screen.position.set(0, 0.42, 0.027);
  hinge.add(screen);
  const pad = new THREE.Mesh(rbox(0.36, 0.01, 0.22, 0.004), accentMat(accent, 0.2));
  pad.position.set(0, 0.04, 0.22);
  g.add(pad);
  return {
    group: holder,
    animate: (t) => {
      holder.rotation.y = Math.sin(t * 0.7) * 0.4 + pointer.x * 0.3;
    },
  };
}

function chipLabel() {
  return makeTexture(256, 256, (ctx, w) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    rr(ctx, 14, 14, w - 28, w - 28, 18);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(42, 42, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#22d3ee';
    ctx.font = `700 92px ${MONO}`;
    ctx.fillText('08', w / 2, 150);
    ctx.fillStyle = '#eef3ff';
    ctx.font = `700 26px ${MONO}`;
    ctx.fillText('SOLUTIONS', w / 2, 196);
  });
}

function buildChip() {
  const holder = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.x = 0.95; // show the printed top
  holder.add(tilt);
  tilt.add(new THREE.Mesh(rbox(1.05, 0.2, 1.05, 0.07), M.chip));
  const labelMat = new THREE.MeshBasicMaterial({ map: chipLabel(), transparent: true, toneMapped: false });
  typeFaces.push({ mat: labelMat, draw: chipLabel });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), labelMat);
  label.rotation.x = -Math.PI / 2;
  label.position.y = 0.102;
  tilt.add(label);
  const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.04, 0.06), M.metal, 20);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  let k = 0;
  for (let side = 0; side < 4; side++) {
    q.setFromAxisAngle(up, (side * Math.PI) / 2);
    for (let j = 0; j < 5; j++) {
      p.set(0.58, -0.02, (j - 2) * 0.19).applyQuaternion(q);
      m.compose(p, q, one);
      pins.setMatrixAt(k++, m);
    }
  }
  tilt.add(pins);
  return {
    group: holder,
    animate: (t) => {
      holder.rotation.y = Math.sin(t * 0.6) * 0.45 + pointer.x * 0.3;
      holder.rotation.z = Math.sin(t * 0.9) * 0.06;
    },
  };
}

function buildOrbit(accent) {
  const holder = new THREE.Group();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.44, 40, 30), accentMat(accent, 0.35));
  holder.add(orb);
  const ring = new THREE.Group();
  ring.rotation.set(1.15, 0, 0.3);
  holder.add(ring);
  ring.add(new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.024, 8, 120), glowMat(accent, 0.7)));
  const sats = [accentMat(accent, 0.3), M.panel, accentMat(0x2563eb, 0.2)].map((mat) => {
    const s = new THREE.Mesh(rbox(0.25, 0.25, 0.25, 0.06), mat);
    ring.add(s);
    return s;
  });
  return {
    group: holder,
    animate: (t) => {
      sats.forEach((s, i) => {
        const a = t * 0.9 + (i * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0);
        s.rotation.set(t + i, t * 0.7, 0);
      });
      orb.scale.setScalar(1 + Math.sin(t * 2.2) * 0.04);
      holder.rotation.y = pointer.x * 0.3;
    },
  };
}

function addOfferView(key, build) {
  addView(key, (v) => {
    v.fitR = 1.2;
    v.look.set(0, 0.08, 0);
    v.dir.set(0, 0.34, 1);
    const tile = v.el.closest('.offer');
    const accent = new THREE.Color(getComputedStyle(tile || v.el).getPropertyValue('--accent').trim() || '#2563eb').getHex();
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.4 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.66;
    v.scene.add(shadow);
    const model = build(accent);
    v.scene.add(model.group);
    let hover = 0;
    return {
      update(t) {
        hover += ((tile?.matches(':hover') ? 1 : 0) - hover) * 0.08;
        const e = easeOutBack(clamp01(v.seen * 1.3));
        model.group.scale.setScalar(Math.max(0.001, e * (1 + hover * 0.1)));
        model.group.position.y = Math.sin(t * 1.2) * 0.05 + hover * 0.08;
        model.animate(t * (1 + hover * 0.8));
      },
    };
  });
}

addOfferView('products', buildLaptop);
addOfferView('solutions', buildChip);
addOfferView('services', buildOrbit);

// =====================================================
// AWARDS — a gold star trophy on a black plinth
// =====================================================

addView('trophy', (v) => {
  v.fitR = 2.15;
  v.look.set(0, 2.0, 0);
  v.dir.set(0, 0.16, 1);
  v.sunBase = 1.7;

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(245,184,61,0.9)'), transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false })
  );
  glow.position.set(0, 2.1, -1.6);
  v.scene.add(glow);

  const trophy = new THREE.Group();
  v.scene.add(trophy);
  const plinthMat = new THREE.MeshPhysicalMaterial({ color: 0x1b2233, roughness: 0.35, metalness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const plinth = new THREE.Mesh(rbox(1.8, 0.8, 1.3, 0.07), plinthMat);
  plinth.position.y = 0.4;
  const plate = new THREE.Mesh(rbox(1.12, 0.34, 0.04, 0.015), M.gold);
  plate.position.set(0, 0.4, 0.66);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.16, 64), M.gold);
  base.position.y = 0.88;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.14, 64), M.gold);
  collar.position.y = 1.03;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 1.45, 32), M.gold);
  stem.position.set(0.06, 1.8, 0);
  stem.rotation.z = -0.1;
  const starGeo = new THREE.ExtrudeGeometry(starShape(1.05, 0.47), {
    depth: 0.24, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.07, bevelSegments: 5, curveSegments: 4,
  });
  starGeo.center();
  const star = new THREE.Mesh(starGeo, M.gold);
  star.position.set(0.16, 2.95, 0);
  star.rotation.z = 0.28;
  trophy.add(plinth, plate, base, collar, stem, star);

  const sparkMat = glowMat(0xffe7a3);
  const sparks = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), sparkMat);
    v.scene.add(m);
    return m;
  });

  const DUST = 70;
  const dPos = new Float32Array(DUST * 3);
  const dSpeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.4 + Math.random() * 1.6;
    dPos[i * 3] = Math.cos(a) * r;
    dPos[i * 3 + 1] = Math.random() * 4.2;
    dPos[i * 3 + 2] = Math.sin(a) * r * 0.6;
    dSpeed[i] = 0.1 + Math.random() * 0.25;
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  v.scene.add(new THREE.Points(dGeo, new THREE.PointsMaterial({
    color: 0xf5c451, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false,
  })));

  return {
    update(t, rect, dt) {
      const e = easeOutBack(clamp01(v.seen * 1.25));
      trophy.scale.setScalar(Math.max(0.001, e));
      trophy.position.y = (1 - e) * -0.8;
      trophy.rotation.y = Math.sin(t * 0.5) * 0.55 + pointer.x * 0.25;
      star.rotation.y = Math.sin(t * 0.9) * 0.12;
      sparks.forEach((m, k) => {
        const a = t * 0.7 + (k * Math.PI * 2) / 6;
        m.position.set(Math.cos(a) * 1.45, 2.95 + Math.sin(a * 1.5) * 0.55, Math.sin(a) * 0.9);
        m.scale.setScalar((0.6 + Math.abs(Math.sin(t * 3 + k)) * 0.9) * e);
        m.rotation.set(t * 2, t * 1.5, 0);
      });
      for (let i = 0; i < DUST; i++) {
        const y = dPos[i * 3 + 1] + dSpeed[i] * dt;
        dPos[i * 3 + 1] = y > 4.2 ? 0 : y;
      }
      dGeo.attributes.position.needsUpdate = true;
    },
  };
});

// =====================================================
// THEME + WEBFONTS
// =====================================================

onTheme((mode) => {
  const t = THEME3D[mode];
  M.panel.color.setHex(t.panel);
  M.metal.color.setHex(t.metal);
  M.chip.color.setHex(t.chip);
  renderer.toneMappingExposure = t.exposure;
  views.forEach((v) => {
    v.scene.environmentIntensity = t.env;
    v.hemi.intensity = t.hemi;
    v.sun.intensity = v.sunBase * t.sun;
  });
  themedFaces.forEach((f) => {
    f.mat.map?.dispose();
    f.mat.map = f.draw(mode);
    f.mat.needsUpdate = true;
  });
});

// Card faces and the chip label use the page's webfonts; canvas text falls
// back silently if they aren't ready, so redraw once they are.
function redrawType() {
  typeFaces.forEach((f) => {
    f.mat.map?.dispose();
    f.mat.map = f.draw();
    f.mat.needsUpdate = true;
  });
}
document.fonts?.ready.then(redrawType);
window.addEventListener('load', () => {
  Promise.all([
    document.fonts?.load(`800 128px ${DISPLAY}`),
    document.fonts?.load(`700 28px ${MONO}`),
  ]).then(redrawType).catch(() => {});
});

// =====================================================
// 3D ON / OFF
// =====================================================

let enabled = true;
let running = false;
const toggle3d = document.querySelector('#toggle3d');
toggle3d?.addEventListener('click', () => {
  enabled = !enabled;
  toggle3d.setAttribute('aria-pressed', String(enabled));
  document.body.classList.toggle('no3d', !enabled);
  if (enabled && !running) loop();
});

// =====================================================
// LOOP
// =====================================================

const timer = new Timer();
let clock = 0;

// dev-only: step frames by hand (a hidden preview pane pauses rAF)
if (import.meta.env.DEV) {
  window.__tick = (n = 1) => {
    for (let k = 0; k < n; k++) frame(1 / 60);
    return window.__home;
  };
}

function loop() {
  if (!enabled) {
    running = false;
    return;
  }
  running = true;
  requestAnimationFrame(loop);
  frame();
}

function frame(stepDt) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (!W || !H) return;
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x !== W || size.y !== H || canvas.width === 0) handleResize();

  timer.update();
  const dt = REDUCED ? 0 : stepDt ?? Math.min(timer.getDelta(), 0.1);
  clock += dt;
  const t = REDUCED ? 0 : clock;

  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);

  views.forEach((v) => {
    const r = v.el.getBoundingClientRect();
    v.onScreen = r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
    if (!v.onScreen) return;
    // entrances play once, the first time a box is well into view
    if (!v.entered && (H - r.top) / H > 0.2) v.entered = true;
    if (v.entered) v.seen = REDUCED ? 1 : Math.min(1, v.seen + dt * 0.8);

    v.update(t, r, dt);
    fitCamera(v, r.width / r.height);
    const x = r.left;
    const y = H - r.bottom; // WebGL counts from the bottom
    renderer.setViewport(x, y, r.width, r.height);
    renderer.setScissor(x, y, r.width, r.height);
    renderer.clearDepth();
    renderer.render(v.scene, v.camera);
  });

  if (import.meta.env.DEV) {
    window.__home = {
      size: [W, H],
      views: views.map((v) => ({ key: v.key, on: v.onScreen, seen: +v.seen.toFixed(2) })),
    };
  }
}

function handleResize() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (!W || !H) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
}
window.addEventListener('resize', handleResize);

loop();
