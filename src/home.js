import './home.css';
import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initTheme, onTheme } from './theme.js';
import { DOORS, BRAND, onSceneChange } from './home-ui.js';

/* =====================================================
 * FINLABS HOME — the lobby
 * =====================================================
 * A round stage holds a glossy "10" for the decade, with
 * rupee coins in orbit, ringed by three doorways: Products,
 * Solutions and Services. Scrolling to an offering turns
 * the stage until that door faces you.
 * ===================================================== */

document.documentElement.classList.add('js');
initTheme();

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const BRAND_HEX = new THREE.Color(BRAND).getHex();
const MONO = '"JetBrains Mono", ui-monospace, monospace';

const THEME3D = {
  light: {
    stage: 0xeef3fb, panel: 0xffffff, metal: 0xb9c6dc, chip: 0x1c2a4c,
    env: 0.95, exposure: 1.0, particles: 0x4f7fe0, shadow: 0.3, door: 0.8, sweep: 0.35,
    tex: { bg: '#e9f0fb', ring: 'rgba(37,99,235,0.13)', tick: 'rgba(37,99,235,0.35)' },
  },
  dark: {
    stage: 0x152040, panel: 0x27324f, metal: 0x4d5b82, chip: 0x1b2748,
    env: 0.5, exposure: 1.12, particles: 0x9bb6ff, shadow: 0.6, door: 0.94, sweep: 0.6,
    tex: { bg: '#0f1834', ring: 'rgba(120,160,255,0.15)', tick: 'rgba(140,175,255,0.45)' },
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

const camera = new THREE.PerspectiveCamera(30, vw0 / vh0, 0.1, 300);
camera.position.set(0, 14, 30);
const look = new THREE.Vector3(0, 2, 0);
camera.lookAt(look);

// =====================================================
// LIGHTS
// =====================================================

const hemi = new THREE.HemisphereLight(0xffffff, 0x8899cc, 0.6);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(6, 12, 10);
scene.add(key);

const rim = new THREE.DirectionalLight(0x9db7ff, 0.9);
rim.position.set(-8, 6, -9);
scene.add(rim);

const accentLight = new THREE.PointLight(BRAND_HEX, 14, 14, 1.6);
accentLight.position.set(0, 3.5, 4);
scene.add(accentLight);

// =====================================================
// HELPERS
// =====================================================

const Y_AXIS = new THREE.Vector3(0, 1, 0);

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

// =====================================================
// SHARED MATERIALS (recoloured by theme)
// =====================================================

const T0 = THEME3D.light;
const M = {
  stage: new THREE.MeshPhysicalMaterial({ color: T0.stage, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
  panel: new THREE.MeshPhysicalMaterial({ color: T0.panel, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
  metal: new THREE.MeshPhysicalMaterial({ color: T0.metal, metalness: 0.75, roughness: 0.28, clearcoat: 0.4 }),
  chip: new THREE.MeshPhysicalMaterial({ color: T0.chip, roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.2 }),
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

// =====================================================
// STAGE — a round platform that turns to present a door
// =====================================================

const STAGE_R = 6.2;
const DOOR_R = 4.55;
const DOOR_ANGLE = DOORS.map((_, i) => (i * Math.PI * 2) / 3);

const lobby = new THREE.Group(); // parallax root
scene.add(lobby);
const carousel = new THREE.Group(); // turns; the emblem stays put
lobby.add(carousel);

const stageBody = new THREE.Mesh(new THREE.CylinderGeometry(STAGE_R, STAGE_R - 0.18, 0.5, 128), M.stage);
stageBody.position.y = -0.25;
carousel.add(stageBody);
const lip = new THREE.Mesh(new THREE.TorusGeometry(STAGE_R - 0.07, 0.08, 16, 180), M.stage);
lip.rotation.x = Math.PI / 2;
lip.position.y = -0.01;
carousel.add(lip);
const bandMat = glowMat(BRAND_HEX);
const band = new THREE.Mesh(new THREE.TorusGeometry(STAGE_R - 0.12, 0.035, 8, 180), bandMat);
band.rotation.x = Math.PI / 2;
band.position.y = -0.36;
carousel.add(band);

// top face: rings, a dial of ticks and a lit path to each door
function stageTexture(mode) {
  const c = THEME3D[mode].tex;
  return makeTexture(1024, 1024, (ctx, w) => {
    const R = w / 2;
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = c.ring;
    ctx.lineWidth = 2;
    for (let r = R * 0.34; r < R * 0.9; r += R * 0.11) {
      ctx.beginPath();
      ctx.arc(R, R, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = c.tick;
    for (let k = 0; k < 120; k++) {
      const a = (k / 120) * Math.PI * 2;
      const r0 = R * (k % 10 === 0 ? 0.88 : 0.92);
      ctx.lineWidth = k % 10 === 0 ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(R + Math.cos(a) * r0, R + Math.sin(a) * r0);
      ctx.lineTo(R + Math.cos(a) * R * 0.96, R + Math.sin(a) * R * 0.96);
      ctx.stroke();
    }
    // world (x, z) lands on canvas (R + x, R + z), so door i sits along (sin θ, cos θ)
    DOORS.forEach((d, i) => {
      const sx = Math.sin(DOOR_ANGLE[i]);
      const sz = Math.cos(DOOR_ANGLE[i]);
      const a = [R + sx * R * 0.34, R + sz * R * 0.34];
      const b = [R + sx * R * 0.7, R + sz * R * 0.7];
      const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      g.addColorStop(0, d.accent + '10');
      g.addColorStop(1, d.accent + '80');
      ctx.strokeStyle = g;
      ctx.lineWidth = R * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.stroke();
      ctx.setLineDash([R * 0.03, R * 0.028]);
      ctx.strokeStyle = d.accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  });
}
const topMat = new THREE.MeshStandardMaterial({ map: stageTexture('light'), roughness: 0.5, metalness: 0.05 });
const top = new THREE.Mesh(new THREE.CircleGeometry(STAGE_R - 0.12, 128), topMat);
top.rotation.x = -Math.PI / 2;
top.position.y = 0.004;
carousel.add(top);

// soft contact shadow and a hovering ring under the stage
const shadowTex = makeTexture(256, 256, (ctx, w) => {
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(10,20,50,0.6)');
  g.addColorStop(1, 'rgba(10,20,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
});
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: T0.shadow });
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(19, 19), shadowMat);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -1.2;
lobby.add(shadow);
const haloMat = glowMat(BRAND_HEX, 0.3);
const halo = new THREE.Mesh(new THREE.RingGeometry(STAGE_R + 0.5, STAGE_R + 0.58, 160), haloMat);
halo.rotation.x = -Math.PI / 2;
halo.position.y = -0.85;
lobby.add(halo);

// =====================================================
// EMBLEM — a glossy "10" with rupee coins in orbit
// =====================================================

const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.28, 96), M.panel);
pedestal.position.y = 0.14;
lobby.add(pedestal);
const pedRingMat = glowMat(BRAND_HEX);
const pedRing = new THREE.Mesh(new THREE.TorusGeometry(1.71, 0.03, 8, 120), pedRingMat);
pedRing.rotation.x = Math.PI / 2;
pedRing.position.y = 0.29;
lobby.add(pedRing);

const emblem = new THREE.Group();
lobby.add(emblem);
const oneMat = new THREE.MeshPhysicalMaterial({
  color: BRAND_HEX, metalness: 0.3, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08,
  emissive: BRAND_HEX, emissiveIntensity: 0.1,
});
const zeroMat = new THREE.MeshPhysicalMaterial({
  color: 0x0ea5e9, metalness: 0.3, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08,
  emissive: 0x0ea5e9, emissiveIntensity: 0.1,
});
const stem = new THREE.Mesh(rbox(0.5, 2.3, 0.5, 0.2), oneMat);
stem.position.x = -0.95;
const flag = new THREE.Mesh(rbox(0.66, 0.34, 0.5, 0.16), oneMat);
flag.position.set(-1.2, 0.86, 0);
flag.rotation.z = 0.62;
const zero = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.25, 32, 96), zeroMat);
zero.scale.set(1, 1.22, 1);
zero.position.x = 0.58;
emblem.add(stem, flag, zero);

// the four-point sparkle from the logo
const sparkle = new THREE.Group();
const sparkMat = glowMat(0xffffff);
[0, Math.PI / 2].forEach((rz) => {
  const ray = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), sparkMat);
  ray.scale.set(0.22, 1, 0.22);
  ray.rotation.z = rz;
  sparkle.add(ray);
});
sparkle.position.set(1.65, 1.15, 0.2);
emblem.add(sparkle);

const rupeeTex = makeTexture(256, 256, (ctx, w) => {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = BRAND;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2 - 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = BRAND;
  ctx.font = '700 150px Inter, "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₹', w / 2, w / 2 + 8);
});
const coinMat = new THREE.MeshPhysicalMaterial({ color: 0x3b82f6, metalness: 0.6, roughness: 0.25, clearcoat: 1 });
const faceMat = new THREE.MeshStandardMaterial({ map: rupeeTex, roughness: 0.35, metalness: 0.15 });
const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 40);
coinGeo.rotateX(Math.PI / 2); // face along z
const faceGeo = new THREE.CircleGeometry(0.27, 40);
const orbit = new THREE.Group();
orbit.rotation.set(0.32, 0, -0.14);
lobby.add(orbit);
const COINS = 7;
const coins = Array.from({ length: COINS }, () => {
  const c = new THREE.Group();
  c.add(new THREE.Mesh(coinGeo, coinMat));
  const f = new THREE.Mesh(faceGeo, faceMat);
  f.position.z = 0.036;
  const b = new THREE.Mesh(faceGeo, faceMat);
  b.position.z = -0.036;
  b.rotation.y = Math.PI;
  c.add(f, b);
  orbit.add(c);
  return c;
});

// =====================================================
// DOORS — one arch per page, each framing a preview
// =====================================================

const DW = 2.7; // outer width
const DH = 2.7; // straight height before the arch begins
const DT = 0.3; // frame thickness
const DD = 0.34; // frame depth
const OPEN_R = DW / 2 - DT;
const OPEN_H = DH + OPEN_R;

function archShape(w, h, t) {
  const R = w / 2;
  const r = R - t;
  const s = new THREE.Shape();
  s.moveTo(-R, 0);
  s.lineTo(-R, h);
  s.absarc(0, h, R, Math.PI, 0, true);
  s.lineTo(R, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h);
  s.absarc(0, h, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  s.closePath();
  return s;
}

function openingShape() {
  const s = new THREE.Shape();
  s.moveTo(-OPEN_R, 0);
  s.lineTo(OPEN_R, 0);
  s.lineTo(OPEN_R, DH);
  s.absarc(0, DH, OPEN_R, 0, Math.PI, false);
  s.lineTo(-OPEN_R, 0);
  return s;
}

const frameGeo = new THREE.ExtrudeGeometry(archShape(DW, DH, DT), {
  depth: DD, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 48,
});
frameGeo.translate(0, 0, -DD / 2);
const rimGeo = new THREE.ExtrudeGeometry(archShape(OPEN_R * 2 + 0.05, DH, 0.05), {
  depth: 0.03, bevelEnabled: false, curveSegments: 48,
});
rimGeo.translate(0, 0, DD / 2 + 0.055);
const openGeo = new THREE.ShapeGeometry(openingShape(), 32);

// ShapeGeometry UVs are raw shape coordinates; map them onto 0..1
function fitOpening(tex, sx = 1) {
  tex.repeat.set(sx / (2 * OPEN_R), 1 / OPEN_H);
  tex.offset.set(0.5 * sx, 0);
  return tex;
}

function doorTexture(accent) {
  return fitOpening(makeTexture(128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, accent + 'f0');
    g.addColorStop(0.55, accent + '90');
    g.addColorStop(1, accent + '30');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.7);
    r.addColorStop(0, 'rgba(255,255,255,0.45)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, w, h);
  }));
}

// a band of light that sweeps across each doorway
const sweepCanvas = makeTexture(512, 16, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.58, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});
sweepCanvas.wrapS = THREE.RepeatWrapping;

function plaqueTexture(d, i) {
  return makeTexture(512, 96, (ctx, w, h) => {
    ctx.textBaseline = 'middle';
    ctx.fillStyle = d.accent;
    ctx.globalAlpha = 0.55;
    ctx.font = `700 26px ${MONO}`;
    ctx.fillText(`0${i + 1}`, 34, h / 2);
    ctx.globalAlpha = 1;
    ctx.font = `700 42px ${MONO}`;
    ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.fillText(d.label, w / 2 + 18, h / 2 + 2);
  });
}

const labelMats = []; // redrawn once the mono webfont has loaded
const themedFaces = []; // redrawn on theme change

// --- previews ---------------------------------------------------------
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
    ctx.fillStyle = BRAND;
    rr(ctx, 20, 20, 52, 18, 9);
    ctx.fill();
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = k === 1 ? BRAND : mute;
      rr(ctx, 20, 64 + k * 30, 52, 12, 6);
      ctx.fill();
    }
    [['₹', BRAND], ['↗', '#22c55e'], ['◎', '#06b6d4']].forEach(([glyph, col], k) => {
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
    ctx.strokeStyle = BRAND;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    [0.25, 0.42, 0.36, 0.58, 0.5, 0.72, 0.66, 0.9].forEach((v, k, a) => {
      const x = 130 + (k / (a.length - 1)) * 342;
      const y = 280 - v * 150;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  });
}

function buildProducts(accent) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(rbox(1.3, 0.07, 0.86, 0.035), M.panel);
  g.add(base);
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
  g.rotation.x = 0.28; // tip it towards the viewer
  return {
    group: g,
    animate: (t) => {
      g.rotation.y = Math.sin(t * 0.7) * 0.35;
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

function buildSolutions() {
  const g = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.x = 1.0; // show the printed top to the viewer
  g.add(tilt);
  tilt.add(new THREE.Mesh(rbox(1.05, 0.2, 1.05, 0.07), M.chip));
  const labelMat = new THREE.MeshBasicMaterial({ map: chipLabel(), transparent: true, toneMapped: false });
  labelMats.push({ mat: labelMat, draw: chipLabel });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), labelMat);
  label.rotation.x = -Math.PI / 2;
  label.position.y = 0.102;
  tilt.add(label);
  const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.04, 0.06), M.metal, 20);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let k = 0;
  for (let side = 0; side < 4; side++) {
    q.setFromAxisAngle(Y_AXIS, (side * Math.PI) / 2);
    for (let j = 0; j < 5; j++) {
      p.set(0.58, -0.02, (j - 2) * 0.19).applyQuaternion(q);
      m.compose(p, q, one);
      pins.setMatrixAt(k++, m);
    }
  }
  tilt.add(pins);
  return {
    group: g,
    animate: (t) => {
      g.rotation.y = Math.sin(t * 0.6) * 0.4;
      g.rotation.z = Math.sin(t * 0.9) * 0.06;
    },
  };
}

function buildServices(accent) {
  const g = new THREE.Group();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 40, 30), accentMat(accent, 0.35));
  g.add(orb);
  const ring = new THREE.Group();
  ring.rotation.set(1.15, 0, 0.3);
  g.add(ring);
  ring.add(new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.018, 8, 120), glowMat(accent, 0.7)));
  const satMats = [accentMat(accent, 0.3), M.panel, accentMat(0x3b82f6, 0.2)];
  const sats = satMats.map((mat) => {
    const s = new THREE.Mesh(rbox(0.2, 0.2, 0.2, 0.05), mat);
    ring.add(s);
    return s;
  });
  return {
    group: g,
    animate: (t) => {
      sats.forEach((s, k) => {
        const a = t * 0.9 + (k * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 0.74, Math.sin(a) * 0.74, 0);
        s.rotation.set(t + k, t * 0.7, 0);
      });
      orb.scale.setScalar(1 + Math.sin(t * 2.2) * 0.04);
    },
  };
}

const BUILDERS = { products: buildProducts, solutions: buildSolutions, services: buildServices };

const doors = DOORS.map((d, i) => {
  const accent = new THREE.Color(d.accent);
  const root = new THREE.Group();
  root.position.set(Math.sin(DOOR_ANGLE[i]) * DOOR_R, 0, Math.cos(DOOR_ANGLE[i]) * DOOR_R);
  root.rotation.y = DOOR_ANGLE[i]; // facing outward, away from the emblem
  carousel.add(root);

  const frame = new THREE.Mesh(frameGeo, M.panel);
  frame.position.y = 0.02;
  root.add(frame);
  const rimMat = new THREE.MeshBasicMaterial({ color: accent.clone(), toneMapped: false });
  const rimLine = new THREE.Mesh(rimGeo, rimMat);
  rimLine.position.y = 0.02;
  root.add(rimLine);

  const openMat = new THREE.MeshBasicMaterial({
    map: doorTexture(d.accent), transparent: true, opacity: T0.door,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const opening = new THREE.Mesh(openGeo, openMat);
  opening.position.y = 0.02;
  root.add(opening);
  const sweepTex = fitOpening(sweepCanvas.clone(), 0.5);
  const sweepMat = new THREE.MeshBasicMaterial({
    map: sweepTex, transparent: true, opacity: T0.sweep, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  const sweep = new THREE.Mesh(openGeo, sweepMat);
  sweep.position.set(0, 0.02, 0.01);
  root.add(sweep);

  const plaque = new THREE.Group();
  plaque.position.set(0, 0.36, DD / 2 + 0.2);
  root.add(plaque);
  plaque.add(new THREE.Mesh(rbox(2.2, 0.42, 0.14, 0.07), M.panel));
  const plaqueMat = new THREE.MeshBasicMaterial({ map: plaqueTexture(d, i), transparent: true, toneMapped: false });
  labelMats.push({ mat: plaqueMat, draw: () => plaqueTexture(d, i) });
  const plaqueFace = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.385), plaqueMat);
  plaqueFace.position.z = 0.072;
  plaque.add(plaqueFace);

  const preview = BUILDERS[d.key](accent.getHex());
  preview.group.position.set(0, 1.95, 0.55);
  root.add(preview.group);

  return { ...d, i, accent, root, rimMat, openMat, sweepTex, sweepMat, preview, glow: 0.55 };
});
const doorByKey = Object.fromEntries(doors.map((d) => [d.key, d]));

// =====================================================
// AMBIENT PARTICLES
// =====================================================

const PCOUNT = 200;
const P_TOP = 7;
const pPos = new Float32Array(PCOUNT * 3);
const pSpeed = new Float32Array(PCOUNT);
for (let i = 0; i < PCOUNT; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 2 + Math.random() * 8;
  pPos[i * 3] = Math.cos(a) * r;
  pPos[i * 3 + 1] = Math.random() * P_TOP;
  pPos[i * 3 + 2] = Math.sin(a) * r;
  pSpeed[i] = 0.12 + Math.random() * 0.3;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({
  color: T0.particles, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false,
});
lobby.add(new THREE.Points(pGeo, pMat));

// =====================================================
// THEME
// =====================================================

let themeMode = 'light';
onTheme((mode) => {
  themeMode = mode;
  const t = THEME3D[mode];
  M.stage.color.setHex(t.stage);
  M.panel.color.setHex(t.panel);
  M.metal.color.setHex(t.metal);
  M.chip.color.setHex(t.chip);
  topMat.map?.dispose();
  topMat.map = stageTexture(mode);
  topMat.needsUpdate = true;
  scene.environmentIntensity = t.env;
  renderer.toneMappingExposure = t.exposure;
  pMat.color.setHex(t.particles);
  shadowMat.opacity = t.shadow;
  hemi.intensity = mode === 'dark' ? 0.35 : 0.6;
  key.intensity = mode === 'dark' ? 1.1 : 1.5;
  themedFaces.forEach((f) => {
    f.mat.map?.dispose();
    f.mat.map = f.draw(mode);
    f.mat.needsUpdate = true;
  });
});

// Plaques and the chip label are drawn in JetBrains Mono; canvas text
// falls back silently if the webfont isn't ready, so redraw once it is.
function redrawType() {
  labelMats.forEach((l) => {
    l.mat.map?.dispose();
    l.mat.map = l.draw();
    l.mat.needsUpdate = true;
  });
}
document.fonts?.ready.then(redrawType);
window.addEventListener('load', () => {
  document.fonts?.load(`700 42px ${MONO}`).then(redrawType).catch(() => {});
});

// =====================================================
// SECTION → STAGE + CAMERA
// =====================================================

let sceneName = 'hero';
let side = 'left';
let snap = false;

onSceneChange(({ scene: s, side: sd }) => {
  sceneName = s;
  side = sd;
});

// dev-only: jump to a section's view without scrolling
if (import.meta.env.DEV) {
  window.__setScene = (name, sd = 'left', now = false) => {
    sceneName = name;
    side = sd;
    snap = now;
    return name;
  };
}

// Cards on either side share the hero column's width and page padding,
// so one measurement tells us where the free space is.
let colRight = 0;
const colEl = document.querySelector('.hero .col');
function measure() {
  colRight = colEl ? colEl.getBoundingClientRect().right : 0;
}
if (colEl && 'ResizeObserver' in window) new ResizeObserver(measure).observe(colEl);

const pointer = new THREE.Vector2();
window.addEventListener(
  'pointermove',
  (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
  { passive: true }
);

const tgtPos = new THREE.Vector3();
const tgtLook = new THREE.Vector3();
const dir = new THREE.Vector3();
let tgtShift = 0;
let measureTick = 0;

function computeTargets() {
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;
  // cheap insurance against a stale measurement from a zero-size mount
  if (colRight <= 0 || ++measureTick % 30 === 0) measure();
  let freeL = 0;
  let freeR = w;
  if (w >= 900 && colRight > 0) {
    if (side === 'left') freeL = colRight + 24;
    else if (side === 'right') freeR = w - colRight - 24;
  }
  const freeW = Math.max(freeR - freeL, 240);
  tgtShift = (freeL + freeR) / 2 - w / 2;

  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const fitDist = (half, min, max) => THREE.MathUtils.clamp(half / (tanV * (freeW / h)), min, max);
  let dist;
  if (doorByKey[sceneName]) {
    // the stage has turned this door to face +z
    tgtLook.set(0, 1.95, DOOR_R);
    dir.set(0, 0.26, 1);
    dist = fitDist(2.0, 10.5, 28);
  } else if (sceneName === 'voices' || sceneName === 'cta') {
    tgtLook.set(0, 1.6, 0);
    dir.set(0, 0.55, 1);
    dist = fitDist(7.5, 18, 60);
  } else {
    tgtLook.set(0, 1.9, 0);
    dir.set(0, 0.42, 1);
    dist = fitDist(6.6, 16, 60);
  }
  dir.y += pointer.y * -0.05;
  dir.normalize().applyAxisAngle(Y_AXIS, pointer.x * 0.1);
  tgtPos.copy(tgtLook).addScaledVector(dir, dist);
}

// hero: Products front-right, Services front-left, Solutions behind the "10"
const HERO_TURN = Math.PI / 3;
let turn = HERO_TURN;

function turnTarget(dt) {
  const d = doorByKey[sceneName];
  if (d) return -DOOR_ANGLE[d.i];
  if (sceneName === 'hero') return HERO_TURN;
  return turn + dt * 0.12; // idle spin behind the long-form sections
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
const accentNow = new THREE.Color(BRAND_HEX);
const accentTarget = new THREE.Color(BRAND_HEX);
const lightTarget = new THREE.Vector3();
let shift = 0;
let placed = false; // the first valid frame snaps into place instead of flying across the copy

// dev-only: step frames by hand (a hidden preview pane pauses rAF)
if (import.meta.env.DEV) {
  window.__tick = (n = 1) => {
    for (let k = 0; k < n; k++) frame();
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

function frame() {
  // NaN-safe: a zero-size mount leaves aspect as NaN, and every
  // comparison against NaN is false — so test for it explicitly
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw > 0 && vh > 0 && (!Number.isFinite(camera.aspect) || canvas.width === 0 || Math.abs(camera.aspect - vw / vh) > 0.001)) {
    handleResize();
  }

  timer.update();
  const t = REDUCED ? 0 : timer.getElapsed();
  const dt = REDUCED ? 0 : Math.min(timer.getDelta(), 0.1);
  const jump = snap || REDUCED;
  const T = THEME3D[themeMode];

  // turn the stage the short way round to the section's door
  const target = turnTarget(dt);
  const diff = Math.atan2(Math.sin(target - turn), Math.cos(target - turn));
  turn += jump ? diff : diff * 0.06;
  carousel.rotation.y = turn;

  const focus = doorByKey[sceneName] || null;
  doors.forEach((d) => {
    const want = focus ? (d === focus ? 1 : 0.18) : sceneName === 'hero' ? 0.6 : 0.45;
    d.glow += (want - d.glow) * (jump ? 1 : 0.07);
    d.rimMat.color.copy(d.accent).multiplyScalar(0.35 + 0.65 * d.glow);
    d.openMat.opacity = T.door * (0.4 + 0.6 * d.glow);
    d.sweepMat.opacity = T.sweep * d.glow;
    d.sweepTex.offset.x = 0.25 + ((t * 0.16 + d.i * 0.33) % 1);
    const s = 0.9 + 0.25 * d.glow;
    d.preview.group.scale.setScalar(s);
    d.preview.group.position.y = 1.95 + Math.sin(t * 1.3 + d.i) * 0.06;
    d.preview.animate(t * (0.6 + 0.6 * d.glow));
  });

  // emblem: bob and sway, never a full spin, so the "10" stays readable
  emblem.position.y = 2.35 + Math.sin(t * 1.1) * 0.08;
  emblem.rotation.y = Math.sin(t * 0.45) * 0.28 + pointer.x * 0.15;
  sparkle.rotation.z = t * 0.8;
  sparkle.scale.setScalar(0.85 + Math.sin(t * 2.6) * 0.18);
  coins.forEach((c, k) => {
    const a = t * 0.45 + (k * Math.PI * 2) / COINS;
    c.position.set(Math.cos(a) * 2.35, 2.35 + Math.sin(a * 2) * 0.12, Math.sin(a) * 2.35);
    c.rotation.y = -a + Math.PI / 2 + t * 0.8;
  });

  // accent colour + light follow the focused door
  accentTarget.set(focus ? focus.accent : BRAND_HEX);
  accentNow.lerp(accentTarget, jump ? 1 : 0.06);
  bandMat.color.copy(accentNow);
  haloMat.color.copy(accentNow);
  accentLight.color.copy(accentNow);
  lightTarget.set(0, focus ? 3 : 3.5, focus ? DOOR_R + 2.5 : 4);
  accentLight.position.lerp(lightTarget, jump ? 1 : 0.06);
  haloMat.opacity = 0.24 + Math.sin(t * 2) * 0.06;

  for (let i = 0; i < PCOUNT; i++) {
    const y = pPos[i * 3 + 1] + pSpeed[i] * dt;
    pPos[i * 3 + 1] = y > P_TOP ? 0 : y;
  }
  pGeo.attributes.position.needsUpdate = true;

  // camera: fly to the section's view, projected into the free space
  computeTargets();
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;
  if (jump || (!placed && (colRight > 0 || w < 900))) {
    camera.position.copy(tgtPos);
    look.copy(tgtLook);
    shift = tgtShift;
    placed = true;
    snap = false;
  }
  camera.position.lerp(tgtPos, 0.05);
  look.lerp(tgtLook, 0.05);
  shift += (tgtShift - shift) * 0.06;
  camera.lookAt(look);
  camera.setViewOffset(w, h, -shift, 0, w, h);

  renderer.render(scene, camera);

  if (import.meta.env.DEV) {
    window.__home = {
      scene: sceneName,
      side,
      turn: +turn.toFixed(2),
      cam: camera.position.toArray().map((n) => +n.toFixed(2)),
      shift: Math.round(shift),
      colRight: Math.round(colRight),
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
