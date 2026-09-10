import './services.css';
import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initTheme, onTheme } from './theme.js';
import { onSceneChange } from './services-ui.js';

/* =====================================================
 * FINLABS SERVICES — the practice turntable
 * =====================================================
 * A single floating platform presents one 3D model per
 * practice. As each service section scrolls into view,
 * the current model sinks away and the next rises in.
 * The page copy stays in real HTML beside it.
 * ===================================================== */

document.documentElement.classList.add('js');
initTheme();

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ACCENTS = {
  core: 0x3b82f6,
  uiux: 0x8b5cf6,
  audit: 0x14b8a6,
  security: 0x6366f1,
  cloud: 0x0ea5e9,
  transform: 0x22c55e,
};

const THEME3D = {
  light: {
    base: 0xf2f6fd, top: 0xe8eefa, panel: 0xffffff, soft: 0xd9e3f4,
    metal: 0xc5d0e3, ink: 0x1b2640, env: 0.95, exposure: 1.0,
    particles: 0x5f84d6, glow: 0.35, shadow: 0.32,
  },
  dark: {
    base: 0x18223c, top: 0x1c2746, panel: 0x27324f, soft: 0x323e61,
    metal: 0x46537a, ink: 0x0a0f1d, env: 0.5, exposure: 1.12,
    particles: 0x9bb6ff, glow: 0.95, shadow: 0.62,
  },
};

// =====================================================
// RENDERER / SCENE / CAMERA
// =====================================================

const canvas = document.querySelector('#scene');
// A hidden tab can mount at 0 x 0; fall back so aspect never becomes NaN.
const vw0 = window.innerWidth || 1280;
const vh0 = window.innerHeight || 720;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(vw0, vh0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, vw0 / vh0, 0.1, 200);
camera.position.set(0, 3.2, 17);
const LOOK = new THREE.Vector3(0, 1.5, 0);
camera.lookAt(LOOK);

// =====================================================
// LIGHTS
// =====================================================

const hemi = new THREE.HemisphereLight(0xffffff, 0x8899cc, 0.55);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(5, 9, 8);
scene.add(key);

const rim = new THREE.DirectionalLight(0x9db7ff, 0.9);
rim.position.set(-6, 4, -7);
scene.add(rim);

const accentLight = new THREE.PointLight(ACCENTS.core, 14, 14, 1.6);
accentLight.position.set(-2.5, 2.2, 3.5);
scene.add(accentLight);

// =====================================================
// HELPERS
// =====================================================

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

// regular polygon with softened corners, as a THREE.Shape
function roundedPolygon(sides, radius, corner) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
    pts.push(new THREE.Vector2(Math.cos(a) * radius, Math.sin(a) * radius));
  }
  const shape = new THREE.Shape();
  pts.forEach((p, i) => {
    const prev = pts[(i - 1 + sides) % sides];
    const next = pts[(i + 1) % sides];
    const a = p.clone().add(prev.clone().sub(p).normalize().multiplyScalar(corner));
    const b = p.clone().add(next.clone().sub(p).normalize().multiplyScalar(corner));
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(p.x, p.y, b.x, b.y);
  });
  shape.closePath();
  return shape;
}

function slab(shape, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2); // extrude upward
  return g;
}

// =====================================================
// SHARED MATERIALS (recoloured by theme)
// =====================================================

const T0 = THEME3D.light;
const M = {
  base: new THREE.MeshPhysicalMaterial({ color: T0.base, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
  panel: new THREE.MeshPhysicalMaterial({ color: T0.panel, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
  soft: new THREE.MeshStandardMaterial({ color: T0.soft, roughness: 0.55 }),
  metal: new THREE.MeshPhysicalMaterial({ color: T0.metal, metalness: 0.75, roughness: 0.28, clearcoat: 0.4 }),
  ink: new THREE.MeshStandardMaterial({ color: T0.ink, roughness: 0.4 }),
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
  });
}

// =====================================================
// STAGE: parallax root > turntable > platform + models
// =====================================================

const stage = new THREE.Group();
scene.add(stage);
const turn = new THREE.Group();
stage.add(turn);

const R = 2.6;
const SLAB_H = 0.42;
const BEV = 0.08;
const TOP = SLAB_H + BEV + 0.03; // models stand at this height

turn.add(new THREE.Mesh(slab(roundedPolygon(6, R, 0.55), SLAB_H, BEV), M.base));

// inset top plate with a glowing dot grid in the accent colour
const dotTex = makeTexture(512, 512, (ctx, w) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, w);
  ctx.fillStyle = '#fff';
  for (let x = 16; x < w; x += 32) {
    for (let y = 16; y < w; y += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
});
dotTex.colorSpace = THREE.NoColorSpace;
const innerR = R - 0.3;
dotTex.repeat.set(1 / (2 * innerR), 1 / (2 * innerR));
dotTex.offset.set(0.5, 0.5);
const plateMat = new THREE.MeshPhysicalMaterial({
  color: T0.top, roughness: 0.5, clearcoat: 0.4,
  emissive: ACCENTS.core, emissiveMap: dotTex, emissiveIntensity: 0.35,
});
const plate = new THREE.Mesh(slab(roundedPolygon(6, innerR, 0.45), 0.03, 0), plateMat);
plate.position.y = SLAB_H + BEV - 0.005;
turn.add(plate);

// glowing band around the platform's side
const rimMat = glowMat(ACCENTS.core);
const rimBand = new THREE.Mesh(slab(roundedPolygon(6, R + 0.17, 0.62), 0.06, 0), rimMat);
rimBand.position.y = 0.14;
turn.add(rimBand);

// rings of light hovering under the platform
const ringMat = glowMat(ACCENTS.core, 0.34);
const ringA = new THREE.Mesh(new THREE.RingGeometry(R * 1.02, R * 1.07, 120), ringMat);
ringA.rotation.x = -Math.PI / 2;
ringA.position.y = -0.55;
stage.add(ringA);
const ringMat2 = glowMat(ACCENTS.core, 0.16);
const ringB = new THREE.Mesh(new THREE.RingGeometry(R * 0.7, R * 0.73, 120), ringMat2);
ringB.rotation.x = -Math.PI / 2;
ringB.position.y = -0.95;
stage.add(ringB);

// soft contact shadow
const shadowTex = makeTexture(256, 256, (ctx, w) => {
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(10,20,50,0.55)');
  g.addColorStop(1, 'rgba(10,20,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
});
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: T0.shadow });
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), shadowMat);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -1.4;
stage.add(shadow);

// =====================================================
// MODELS — one per practice, plus the core
// =====================================================

const models = {};
function register(name, group) {
  group.userData.mix = name === 'core' ? 1 : 0;
  group.visible = name === 'core';
  turn.add(group);
  models[name] = group;
}

// --- CORE: five practices orbiting one engine ------------------------
{
  const g = new THREE.Group();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.85, 64, 48), accentMat(ACCENTS.core, 0.35));
  g.add(orb);
  const cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.38, 1)),
    new THREE.LineBasicMaterial({ color: ACCENTS.core, transparent: true, opacity: 0.55 })
  );
  g.add(cage);
  const TILT = 0.35;
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.018, 8, 160), glowMat(ACCENTS.core, 0.5));
  orbit.rotation.x = Math.PI / 2 - TILT;
  g.add(orbit);
  const sats = ['uiux', 'audit', 'security', 'cloud', 'transform'].map((k) => {
    const m = new THREE.Mesh(rbox(0.38, 0.38, 0.38, 0.1), accentMat(ACCENTS[k], 0.3));
    g.add(m);
    return m;
  });
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, 0.3, 48), M.panel);
  ped.position.y = TOP + 0.15;
  g.add(ped);
  const pedGlow = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 8, 64), glowMat(ACCENTS.core));
  pedGlow.rotation.x = Math.PI / 2;
  pedGlow.position.y = TOP + 0.31;
  g.add(pedGlow);

  g.userData.animate = (t) => {
    const y = TOP + 1.8 + Math.sin(t * 1.2) * 0.08;
    orb.position.y = y;
    cage.position.y = y;
    orbit.position.y = y;
    cage.rotation.set(t * 0.12, t * 0.25, 0);
    sats.forEach((m, i) => {
      const a = t * 0.45 + i * ((Math.PI * 2) / 5);
      const s = Math.sin(a);
      m.position.set(Math.cos(a) * 2.05, y + s * Math.sin(TILT) * 2.05, s * Math.cos(TILT) * 2.05);
      m.rotation.set(t * 0.8 + i, t * 0.6 + i, 0);
    });
  };
  register('core', g);
}

// --- UI / UX: layered screens with a live interface ------------------
const uiFaces = []; // { mat, kind } — retextured on theme change

function uiTexture(kind, mode) {
  const size = { desk: [1024, 640], tab: [480, 660], phone: [300, 620] }[kind];
  const dark = mode === 'dark';
  const A = '#8b5cf6';
  return makeTexture(size[0], size[1], (ctx, w, h) => {
    const bg = dark ? '#121a30' : '#ffffff';
    const card = dark ? '#1c2642' : '#f1f4fb';
    const line = dark ? 'rgba(255,255,255,0.12)' : 'rgba(20,30,60,0.10)';
    const ink = dark ? '#e8edff' : '#1b2640';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const u = w / 100; // layout unit
    ctx.fillStyle = card;
    ctx.fillRect(0, 0, w, u * 8);
    ctx.fillStyle = A;
    rr(ctx, u * 3, u * 2, u * 4, u * 4, u);
    ctx.fill();
    const side = kind === 'desk' ? u * 18 : 0;
    if (side) {
      ctx.fillStyle = card;
      ctx.fillRect(0, u * 8, side, h);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i === 1 ? A : line;
        rr(ctx, u * 3, u * 14 + i * u * 6, side - u * 6, u * 2.4, u);
        ctx.fill();
      }
    }
    const x0 = side + u * 4;
    const cw = w - x0 - u * 4;
    ctx.fillStyle = ink;
    ctx.font = `700 ${u * 4.2}px Inter, sans-serif`;
    ctx.fillText('Portfolio', x0, u * 17);
    const cols = kind === 'phone' ? 1 : kind === 'tab' ? 2 : 3;
    const tw = (cw - (cols - 1) * u * 2) / cols;
    for (let i = 0; i < cols; i++) {
      ctx.fillStyle = card;
      rr(ctx, x0 + i * (tw + u * 2), u * 21, tw, u * 13, u * 1.6);
      ctx.fill();
      ctx.fillStyle = i === 0 ? A : line;
      rr(ctx, x0 + i * (tw + u * 2) + u * 2, u * 29, tw * 0.5, u * 2.2, u);
      ctx.fill();
    }
    const cy = u * 38;
    const ch = Math.min(h - cy - u * 4, u * 36);
    ctx.fillStyle = card;
    rr(ctx, x0, cy, cw, ch, u * 1.6);
    ctx.fill();
    ctx.strokeStyle = A;
    ctx.lineWidth = u * 0.9;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    [0.3, 0.45, 0.38, 0.62, 0.55, 0.78, 0.7, 0.9].forEach((v, i, a) => {
      const px = x0 + u * 3 + (i / (a.length - 1)) * (cw - u * 6);
      const py = cy + ch - u * 3 - v * (ch - u * 7);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.stroke();
  });
}

function screen(kind, w, h, d) {
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(rbox(w, h, d, 0.12), M.panel));
  const mat = new THREE.MeshBasicMaterial({ map: uiTexture(kind, 'light'), toneMapped: false });
  uiFaces.push({ mat, kind });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.14, h - 0.14), mat);
  face.position.z = d / 2 + 0.002;
  grp.add(face);
  return grp;
}

{
  const g = new THREE.Group();
  const desk = screen('desk', 3.1, 1.95, 0.12);
  desk.position.set(0.1, TOP + 1.6, -0.45);
  const tab = screen('tab', 1.25, 1.72, 0.1);
  tab.position.set(-1.75, TOP + 1.1, 0.55);
  tab.rotation.y = 0.5;
  const phone = screen('phone', 0.7, 1.42, 0.09);
  phone.position.set(1.8, TOP + 0.95, 0.75);
  phone.rotation.y = -0.5;
  g.add(desk, tab, phone);

  const chipSpots = [
    [-1.0, 2.95, 0.1, true], [1.3, 2.7, 0.2, false], [0.4, 3.15, 0.6, true], [-1.8, 2.3, -0.5, false],
  ];
  const chipMatA = accentMat(ACCENTS.uiux, 0.2);
  const chips = chipSpots.map(([x, y, z, acc]) => {
    const c = new THREE.Mesh(rbox(0.62, 0.36, 0.06, 0.1), acc ? chipMatA : M.panel);
    c.userData.home = new THREE.Vector3(x, TOP + y, z);
    g.add(c);
    return c;
  });
  const tokens = [ACCENTS.uiux, 0x22c55e, 0xf59e0b].map((hex) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 24), accentMat(hex, 0.25));
    g.add(s);
    return s;
  });

  g.userData.animate = (t, mix) => {
    desk.position.y = TOP + 1.6 + Math.sin(t * 0.9) * 0.05;
    tab.position.y = TOP + 1.1 + Math.sin(t * 1.1 + 1) * 0.06;
    phone.position.y = TOP + 0.95 + Math.sin(t * 1.3 + 2) * 0.07;
    chips.forEach((c, i) => {
      // layers fan out from the main screen as the model arrives
      const h = c.userData.home;
      c.position.set(
        THREE.MathUtils.lerp(0.1, h.x, mix),
        h.y + Math.sin(t * 1.4 + i) * 0.08,
        THREE.MathUtils.lerp(-0.4, h.z, mix)
      );
      c.rotation.z = Math.sin(t * 0.8 + i) * 0.08;
    });
    tokens.forEach((s, i) => {
      const a = t * 0.8 + i * 2.1;
      s.position.set(Math.cos(a) * 1.9, TOP + 1.7 + Math.sin(a * 1.3) * 0.4, -0.45 + Math.sin(a) * 1.0);
    });
  };
  register('uiux', g);
}

// --- AUDITS: a stack being scanned ----------------------------------
{
  const g = new THREE.Group();
  const ledOn = glowMat(ACCENTS.audit);
  const ledWarn = glowMat(0xf59e0b);
  const leds = [];
  [0.22, 0.7, 1.18].forEach((y, row) => {
    const s = new THREE.Mesh(rbox(2.5, 0.4, 1.6, 0.12), M.panel);
    s.position.set(0, TOP + y, 0);
    g.add(s);
    const vent = new THREE.Mesh(rbox(1.1, 0.04, 0.02, 0.01), M.soft);
    vent.position.set(0.55, TOP + y, 0.81);
    g.add(vent);
    for (let i = 0; i < 5; i++) {
      const led = new THREE.Mesh(rbox(0.13, 0.06, 0.03, 0.02), i === row + 1 ? ledWarn : ledOn);
      led.position.set(-1.0 + i * 0.2, TOP + y, 0.81);
      g.add(led);
      leds.push(led);
    }
  });

  const scan = new THREE.Group();
  scan.add(new THREE.Mesh(rbox(2.95, 0.025, 2.05, 0.01), glowMat(ACCENTS.audit, 0.75)));
  scan.add(new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.34, 2.05), glowMat(ACCENTS.audit, 0.08)));
  g.add(scan);

  const lens = new THREE.Group();
  lens.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 20, 64), accentMat(ACCENTS.audit, 0.2)));
  lens.add(new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 48),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0.05 })
  ));
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.8, 20), M.metal);
  handle.position.set(0.5, -0.5, 0);
  handle.rotation.z = Math.PI / 4;
  lens.add(handle);
  lens.position.set(1.35, TOP + 2.55, 0.55);
  g.add(lens);

  const pins = [0xef4444, 0xf59e0b, 0x22c55e].map((hex, i) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 18), accentMat(hex, 0.35));
    p.position.set(-1.8, TOP + 0.45 + i * 0.5, 0.5);
    g.add(p);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), M.soft);
    stem.rotation.z = Math.PI / 2;
    stem.position.set(-1.52, p.position.y, 0.5);
    g.add(stem);
    return p;
  });

  g.userData.animate = (t) => {
    scan.position.y = TOP + 0.75 + Math.sin(t * 1.1) * 0.72;
    lens.rotation.z = Math.sin(t * 0.7) * 0.15;
    lens.position.y = TOP + 2.55 + Math.sin(t * 1.2) * 0.1;
    pins.forEach((p, i) => (p.position.y = TOP + 0.45 + i * 0.5 + Math.sin(t * 2 + i) * 0.04));
    leds.forEach((l, i) => (l.visible = Math.sin(t * 3 + i * 1.7) > -0.6));
  };
  register('audit', g);
}

// --- CYBERSECURITY: a padlock inside a gyroscope of shields ---------
{
  const g = new THREE.Group();
  const y0 = TOP + 1.3;
  const body = new THREE.Mesh(rbox(1.7, 1.35, 0.8, 0.24), M.panel);
  body.position.y = y0;
  g.add(body);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.12, 20, 48, Math.PI), M.metal);
  shackle.position.y = y0 + 0.6;
  g.add(shackle);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 32), M.ink);
  hole.rotation.x = Math.PI / 2;
  hole.position.set(0, y0 + 0.08, 0.41);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.04), M.ink);
  slot.position.set(0, y0 - 0.1, 0.41);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 10, 48), glowMat(ACCENTS.security));
  halo.position.set(0, y0 + 0.02, 0.42);
  g.add(hole, slot, halo);

  const rings = [1.5, 1.72, 1.94].map((r, i) => {
    const pivot = new THREE.Group();
    pivot.position.y = y0;
    pivot.rotation.set(i * 0.9, i * 0.5, i * 0.3);
    pivot.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.028, 10, 160), glowMat(ACCENTS.security, 0.7)));
    g.add(pivot);
    return pivot;
  });

  const tileMat = accentMat(ACCENTS.security, 0.3);
  tileMat.transparent = true;
  tileMat.opacity = 0.85;
  const orbit = new THREE.Group();
  orbit.position.y = y0;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const holder = new THREE.Group();
    holder.position.set(Math.sin(a) * 2.35, Math.sin(a * 2) * 0.25, Math.cos(a) * 2.35);
    holder.rotation.y = a;
    const tile = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 6), tileMat);
    tile.rotation.x = Math.PI / 2;
    holder.add(tile);
    orbit.add(holder);
  }
  g.add(orbit);

  g.userData.animate = (t) => {
    rings[0].rotation.y = t * 0.6;
    rings[1].rotation.x = t * 0.45 + 0.9;
    rings[2].rotation.z = t * 0.35 + 0.6;
    orbit.rotation.y = t * 0.3;
    halo.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
    body.position.y = y0 + Math.sin(t * 1.1) * 0.04;
  };
  register('security', g);
}

// --- CLOUD: three providers wired into one control plane ------------
function labelSprite(text, hex) {
  const tex = makeTexture(320, 110, (ctx, w, h) => {
    ctx.fillStyle = '#' + hex.toString(16).padStart(6, '0');
    rr(ctx, 6, 14, w - 12, h - 28, (h - 28) / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 44px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false }));
  s.scale.set(1.05, 0.36, 1);
  return s;
}

{
  const g = new THREE.Group();
  const puff = (mat) => {
    const c = new THREE.Group();
    [[0, 0, 0, 0.5], [0.46, -0.04, 0.05, 0.38], [-0.46, -0.05, 0, 0.36], [0.18, 0.28, -0.05, 0.36], [-0.18, 0.2, 0.1, 0.33]]
      .forEach(([x, y, z, r]) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat);
        s.position.set(x, y, z);
        c.add(s);
      });
    return c;
  };
  const hubPos = new THREE.Vector3(0, TOP + 0.95, 0.65);
  const clouds = [
    ['AWS', -1.75, 2.45, -0.2],
    ['Azure', 0.05, 3.05, -0.75],
    ['GCP', 1.85, 2.35, 0.1],
  ].map(([name, x, y, z]) => {
    const c = puff(M.panel);
    c.position.set(x, TOP + y, z);
    c.scale.setScalar(0.9);
    const tag = labelSprite(name, ACCENTS.cloud);
    tag.position.set(x, TOP + y - 0.66, z + 0.2);
    g.add(c, tag);
    return c;
  });

  const wheel = new THREE.Group();
  wheel.position.copy(hubPos);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.2, 7), accentMat(ACCENTS.cloud, 0.25));
  disc.rotation.x = Math.PI / 2;
  wheel.add(disc);
  for (let i = 0; i < 7; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.04), M.panel);
    const a = (i / 7) * Math.PI * 2;
    spoke.position.set(Math.sin(a) * 0.25, Math.cos(a) * 0.25, 0.12);
    spoke.rotation.z = -a;
    wheel.add(spoke);
  }
  const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24), M.panel);
  hubCap.rotation.x = Math.PI / 2;
  hubCap.position.z = 0.13;
  wheel.add(hubCap);
  g.add(wheel);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 16), M.metal);
  stand.position.set(hubPos.x, TOP + 0.17, hubPos.z);
  g.add(stand);

  const tubeMat = glowMat(ACCENTS.cloud, 0.6);
  const packetMat = glowMat(0xffffff);
  const links = clouds.map((c) => {
    const a = c.position.clone().add(new THREE.Vector3(0, -0.42, 0));
    const mid = a.clone().lerp(hubPos, 0.5);
    mid.y += 0.15;
    const curve = new THREE.CatmullRomCurve3([a, mid, hubPos.clone()]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.03, 8, false), tubeMat));
    const packets = [0, 0.5].map(() => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), packetMat);
      g.add(p);
      return p;
    });
    return { curve, packets };
  });

  g.userData.animate = (t) => {
    wheel.rotation.z = t * 0.5;
    clouds.forEach((c, i) => (c.position.y += Math.sin(t * 1.1 + i * 2) * 0.0015));
    links.forEach(({ curve, packets }, i) => {
      packets.forEach((p, k) => p.position.copy(curve.getPointAt((t * 0.28 + k * 0.5 + i * 0.17) % 1)));
    });
  };
  register('cloud', g);
}

// --- TRANSFORMATION: a rising roadmap -------------------------------
{
  const g = new THREE.Group();
  const heights = [0.5, 0.9, 1.35, 1.9, 2.55];
  const capMat = accentMat(ACCENTS.transform, 0.3);
  const pillars = heights.map((h, i) => {
    const p = new THREE.Group();
    const geo = rbox(0.55, h, 0.55, 0.1);
    geo.translate(0, h / 2, 0); // origin at the base so it grows upward
    p.add(new THREE.Mesh(geo, M.panel));
    const cap = new THREE.Mesh(rbox(0.6, 0.08, 0.6, 0.03), capMat);
    cap.position.y = h;
    p.add(cap);
    p.position.set(-1.7 + i * 0.85, TOP, 0.75 - i * 0.35);
    g.add(p);
    return p;
  });

  const pts = heights.map((h, i) => new THREE.Vector3(-1.7 + i * 0.85, TOP + h + 0.32, 0.75 - i * 0.35));
  pts.push(new THREE.Vector3(2.35, TOP + 3.35, -1.15));
  const path = new THREE.CatmullRomCurve3(pts);
  const tubeGeo = new THREE.TubeGeometry(path, 90, 0.045, 10, false);
  const tube = new THREE.Mesh(tubeGeo, glowMat(ACCENTS.transform));
  g.add(tube);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.38, 24), capMat);
  arrow.position.copy(path.getPointAt(1));
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), path.getTangentAt(1).normalize());
  g.add(arrow);

  const cubeMat = accentMat(ACCENTS.transform, 0.35);
  const cubes = Array.from({ length: 6 }, (_, i) => {
    const c = new THREE.Mesh(rbox(0.16, 0.16, 0.16, 0.04), cubeMat);
    c.userData.x = -1.9 + i * 0.75;
    c.userData.z = 0.9 - i * 0.3;
    g.add(c);
    return c;
  });

  const indexCount = tubeGeo.index.count;
  g.userData.animate = (t, mix) => {
    pillars.forEach((p, i) => {
      p.scale.y = THREE.MathUtils.clamp(mix * 1.5 - i * 0.12, 0.001, 1);
    });
    const grow = THREE.MathUtils.clamp((mix - 0.35) / 0.65, 0, 1);
    tubeGeo.setDrawRange(0, Math.floor(indexCount * grow / 6) * 6);
    arrow.visible = grow > 0.98;
    cubes.forEach((c, i) => {
      const k = (t * 0.22 + i / cubes.length) % 1;
      c.position.set(c.userData.x, TOP + 0.3 + k * 3.2, c.userData.z);
      c.rotation.set(t + i, t * 0.7 + i, 0);
      c.scale.setScalar(Math.sin(k * Math.PI) * mix + 0.001);
    });
  };
  register('transform', g);
}

// =====================================================
// AMBIENT PARTICLES
// =====================================================

const PCOUNT = 260;
const pPos = new Float32Array(PCOUNT * 3);
for (let i = 0; i < PCOUNT; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 14;
  pPos[i * 3 + 1] = -1 + Math.random() * 7.5;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 10;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({
  color: T0.particles, size: 0.045, transparent: true, opacity: 0.6, depthWrite: false,
});
const particles = new THREE.Points(pGeo, pMat);
stage.add(particles);

// =====================================================
// THEME
// =====================================================

onTheme((mode) => {
  const t = THEME3D[mode];
  M.base.color.setHex(t.base);
  M.panel.color.setHex(t.panel);
  M.soft.color.setHex(t.soft);
  M.metal.color.setHex(t.metal);
  M.ink.color.setHex(t.ink);
  plateMat.color.setHex(t.top);
  plateMat.emissiveIntensity = t.glow;
  scene.environmentIntensity = t.env;
  renderer.toneMappingExposure = t.exposure;
  pMat.color.setHex(t.particles);
  shadowMat.opacity = t.shadow;
  hemi.intensity = mode === 'dark' ? 0.35 : 0.6;
  key.intensity = mode === 'dark' ? 1.1 : 1.5;
  uiFaces.forEach((f) => {
    f.mat.map?.dispose();
    f.mat.map = uiTexture(f.kind, mode);
    f.mat.needsUpdate = true;
  });
});

// =====================================================
// SECTION → MODEL
// =====================================================

let activeName = 'core';
let stageMode = 'side';
const accentTarget = new THREE.Color(ACCENTS.core);
const accentNow = new THREE.Color(ACCENTS.core);

onSceneChange((scene, mode) => {
  activeName = models[scene] ? scene : 'core';
  stageMode = mode;
  accentTarget.setHex(ACCENTS[activeName]);
});

// dev-only: switch the presented model without scrolling
if (import.meta.env.DEV) {
  // snap = true skips the transition, so a single rendered frame shows
  // the finished model (useful when frames are scarce)
  window.__setScene = (name, snap = false) => {
    if (!models[name]) return `unknown scene: ${name}`;
    activeName = name;
    accentTarget.setHex(ACCENTS[name]);
    if (snap) {
      Object.entries(models).forEach(([k, m]) => (m.userData.mix = k === name ? 1 : 0));
      accentNow.setHex(ACCENTS[name]);
    }
    return name;
  };
}

// =====================================================
// PLACEMENT — sit the stage in the space right of the copy
// =====================================================

let colRight = 0;
const colEl = document.querySelector('.col');
function measure() {
  colRight = colEl ? colEl.getBoundingClientRect().right : 0;
}
// Re-measure whenever the column's box changes — including the moment a
// page that mounted at zero size is laid out for real. Relying on window
// resize alone missed that case and parked the stage over the copy.
if (colEl && 'ResizeObserver' in window) new ResizeObserver(measure).observe(colEl);

function stageTarget() {
  const w = window.innerWidth || 1280;
  const dist = camera.position.distanceTo(LOOK);
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
  const halfW = halfH * camera.aspect;
  if (w < 900) return { x: 0, y: 0.9, z: stageMode === 'back' ? -4 : 0, s: 0.8 };
  if (stageMode === 'back') return { x: halfW * 0.3, y: 0.3, z: -7, s: 0.9 };
  if (colRight <= 0) measure();
  const leftWorld = (((colRight + 24) / w) * 2 - 1) * halfW;
  const room = halfW - leftWorld;
  return { x: leftWorld + room / 2, y: 0, z: 0, s: THREE.MathUtils.clamp(room / 6.2, 0.55, 1.05) };
}

const pointer = new THREE.Vector2();
window.addEventListener(
  'pointermove',
  (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
  { passive: true }
);

function easeOutBack(x) {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

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
let placed = false; // first valid frame snaps into place instead of sliding across the copy

function loop() {
  if (!enabled) {
    running = false;
    return;
  }
  running = true;
  requestAnimationFrame(loop);

  // NaN-safe: a zero-size mount leaves aspect as NaN, and every
  // comparison against NaN is false — so test for it explicitly
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw > 0 && vh > 0 && (!Number.isFinite(camera.aspect) || canvas.width === 0 || Math.abs(camera.aspect - vw / vh) > 0.001)) {
    handleResize();
  }

  timer.update();
  const t = REDUCED ? 0 : timer.getElapsed();
  const ease = REDUCED ? 1 : 0.075;

  // models: the active one rises in, the others sink into the platform
  Object.entries(models).forEach(([name, m]) => {
    m.userData.mix += ((name === activeName ? 1 : 0) - m.userData.mix) * ease;
    const mix = m.userData.mix;
    m.visible = mix > 0.004;
    if (!m.visible) return;
    m.scale.setScalar(Math.max(0.001, easeOutBack(mix)));
    m.position.y = (1 - mix) * -1.4;
    m.rotation.y = (1 - mix) * 0.9;
    m.userData.animate?.(t, mix);
  });

  // accent colour follows the active practice
  accentNow.lerp(accentTarget, 0.06);
  rimMat.color.copy(accentNow);
  ringMat.color.copy(accentNow);
  ringMat2.color.copy(accentNow);
  plateMat.emissive.copy(accentNow);
  accentLight.color.copy(accentNow);

  // stage placement, facing the camera, with pointer parallax
  const tgt = stageTarget();
  if (!placed && colRight > 0) {
    stage.position.set(tgt.x, tgt.y, tgt.z);
    stage.scale.setScalar(tgt.s);
    placed = true;
  }
  stage.position.x += (tgt.x - stage.position.x) * 0.06;
  stage.position.y += (tgt.y - stage.position.y) * 0.06;
  stage.position.z += (tgt.z - stage.position.z) * 0.06;
  stage.scale.setScalar(stage.scale.x + (tgt.s - stage.scale.x) * 0.06);
  const face = Math.atan2(-stage.position.x, camera.position.z - stage.position.z);
  stage.rotation.y += (face + pointer.x * 0.22 - stage.rotation.y) * 0.05;
  stage.rotation.x += (pointer.y * 0.06 - stage.rotation.x) * 0.05;

  turn.rotation.y = Math.sin(t * 0.25) * 0.28;
  ringA.scale.setScalar(1 + Math.sin(t * 1.5) * 0.015);
  ringMat.opacity = 0.28 + Math.sin(t * 2) * 0.06;
  particles.rotation.y = t * 0.03;

  renderer.render(scene, camera);

  if (import.meta.env.DEV) {
    window.__svc = {
      active: activeName,
      mode: stageMode,
      stage: stage.position.toArray().map((n) => +n.toFixed(2)),
      scale: +stage.scale.x.toFixed(2),
      mix: Object.fromEntries(Object.entries(models).map(([k, m]) => [k, +m.userData.mix.toFixed(2)])),
    };
  }
}

// =====================================================
// RESIZE
// =====================================================

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  measure();
}
window.addEventListener('resize', handleResize);

measure();
loop();
