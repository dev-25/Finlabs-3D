import './solutions.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initTheme, onTheme } from './theme.js';
import { SOLUTIONS, BRAND, onSceneChange, onFitChange } from './solutions-ui.js';

/* =====================================================
 * FINLABS SOLUTIONS — the platform board
 * =====================================================
 * A circuit board carries one chip per solution, each
 * wired to a Finlabs core. Scrolling to a solution flies
 * the camera to its chip, which lifts and presents a 3D
 * model of what the solution does. The copy stays in
 * real HTML beside it.
 * ===================================================== */

document.documentElement.classList.add('js');
initTheme();

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const BRAND_HEX = new THREE.Color(BRAND).getHex();

const THEME3D = {
  light: {
    board: 0xe3ebf9, chip: 0x1c2a4c, panel: 0xffffff, soft: 0xd9e3f4, metal: 0xb9c6dc, ink: 0x16213b,
    env: 0.95, exposure: 1.0, traceGlow: 0.0, route: 0.4, pad: 0.55, particles: 0x4f7fe0,
    tex: {
      bg: '#e8effc', grid: 'rgba(37,99,235,0.07)', trace: '#c3d4f2', main: '#9ab6ea',
      via: '#a9bfe8', silk: 'rgba(30,50,90,0.4)', finger: '#b7c4db',
    },
  },
  dark: {
    board: 0x0c1631, chip: 0x1b2748, panel: 0x27324f, soft: 0x323e61, metal: 0x4d5b82, ink: 0x0a0f1d,
    env: 0.5, exposure: 1.12, traceGlow: 0.9, route: 0.55, pad: 0.85, particles: 0x9bb6ff,
    tex: {
      bg: '#0a1430', grid: 'rgba(120,160,255,0.06)', trace: '#18336c', main: '#244d9e',
      via: '#2a58b8', silk: 'rgba(160,185,255,0.4)', finger: '#3a4a74',
    },
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
camera.position.set(0, 30, 36);
const look = new THREE.Vector3(0, 0, 0);
camera.lookAt(look);

// =====================================================
// LIGHTS
// =====================================================

const hemi = new THREE.HemisphereLight(0xffffff, 0x8899cc, 0.6);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(6, 14, 9);
scene.add(key);

const rim = new THREE.DirectionalLight(0x9db7ff, 0.8);
rim.position.set(-8, 6, -9);
scene.add(rim);

const accentLight = new THREE.PointLight(BRAND_HEX, 16, 12, 1.6);
accentLight.position.set(0, 3, 0);
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

// deterministic randomness, so a theme swap redraws the same board
function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// a polyline you can sample by distance, 0..1
function polyline(points) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const len = points[i].distanceTo(points[i - 1]);
    segs.push({ a: points[i - 1], b: points[i], len, start: total });
    total += len;
  }
  return {
    points,
    total,
    at(u, out) {
      const d = THREE.MathUtils.clamp(u, 0, 1) * total;
      const s = segs.find((sg) => d <= sg.start + sg.len) || segs[segs.length - 1];
      return out.lerpVectors(s.a, s.b, s.len ? (d - s.start) / s.len : 0);
    },
  };
}

function distToSegment(px, pz, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  const k = THREE.MathUtils.clamp(((px - a.x) * dx + (pz - a.z) * dz) / len2, 0, 1);
  return Math.hypot(px - (a.x + k * dx), pz - (a.z + k * dz));
}

// =====================================================
// SHARED MATERIALS (recoloured by theme)
// =====================================================

const T0 = THEME3D.light;
const M = {
  board: new THREE.MeshPhysicalMaterial({ color: T0.board, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.35 }),
  chip: new THREE.MeshPhysicalMaterial({ color: T0.chip, roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.2 }),
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
// LAYOUT — eight chips on an ellipse around the core
// =====================================================

const BOARD_W = 21;
const BOARD_D = 14.6;
const BOARD_H = 0.5;
const CHIP = 2.3;
const CHIP_H = 0.3;
const CORE = 3.3;
const RX = 7.3;
const RZ = 4.7;

// clockwise from back-left, so neighbouring sections are neighbouring chips
const SPOTS = SOLUTIONS.map((_, i) => {
  const a = Math.PI * (0.875 - i * 0.25);
  return new THREE.Vector3(Math.cos(a) * RX, 0, -Math.sin(a) * RZ);
});

// Octilinear PCB routes from the core's edge into the side of each chip
// that faces it: straight out, straight along, one 45° bend, straight in.
const ROUTES = SPOTS.map((c) => {
  const flat = Math.abs(c.x) > Math.abs(c.z) * 1.2; // enter through the side, not the top/bottom
  const sx = Math.sign(c.x) || 1;
  const sz = Math.sign(c.z) || 1;
  const y = 0.04;
  const p0 = flat
    ? new THREE.Vector3(sx * (CORE / 2 + 0.05), y, THREE.MathUtils.clamp(c.z * 0.4, -1.2, 1.2))
    : new THREE.Vector3(THREE.MathUtils.clamp(c.x * 0.4, -1.2, 1.2), y, sz * (CORE / 2 + 0.05));
  const out = flat ? new THREE.Vector3(sx, 0, 0) : new THREE.Vector3(0, 0, sz);
  const pA = p0.clone().addScaledVector(out, 0.4);
  const p2 = flat
    ? new THREE.Vector3(c.x - sx * (CHIP / 2 + 0.2), y, c.z)
    : new THREE.Vector3(c.x, y, c.z - sz * (CHIP / 2 + 0.2));
  const p1 = p2.clone().addScaledVector(out, -0.4);
  const dx = p1.x - pA.x;
  const dz = p1.z - pA.z;
  const m = Math.min(Math.abs(dx), Math.abs(dz));
  const q = Math.abs(dx) > Math.abs(dz)
    ? new THREE.Vector3(pA.x + Math.sign(dx) * (Math.abs(dx) - m), y, pA.z)
    : new THREE.Vector3(pA.x, y, pA.z + Math.sign(dz) * (Math.abs(dz) - m));
  return polyline([p0, pA, q, p1, p2]);
});

// =====================================================
// BOARD — slab, glowing seam, printed circuit texture
// =====================================================

const board = new THREE.Group();
scene.add(board);

const slabMesh = new THREE.Mesh(rbox(BOARD_W, BOARD_H, BOARD_D, 0.24), M.board);
slabMesh.position.y = -BOARD_H / 2;
board.add(slabMesh);

const seamShape = roundedRectShape(BOARD_W + 0.08, BOARD_D + 0.08, 0.3);
seamShape.holes.push(roundedRectShape(BOARD_W - 0.12, BOARD_D - 0.12, 0.2));
const seamGeo = new THREE.ExtrudeGeometry(seamShape, { depth: 0.06, bevelEnabled: false, curveSegments: 8 });
seamGeo.rotateX(-Math.PI / 2);
const seamMat = glowMat(BRAND_HEX);
const seam = new THREE.Mesh(seamGeo, seamMat);
seam.position.y = -BOARD_H * 0.62;
board.add(seam);

const PW = BOARD_W - 0.5;
const PD = BOARD_D - 0.5;
const TEX_W = 2048;
const TEX_H = Math.round((TEX_W * PD) / PW);
const PX = TEX_W / PW; // texture pixels per world unit
const toPx = (x, z) => [((x + PW / 2) / PW) * TEX_W, ((z + PD / 2) / PD) * TEX_H];

// decorative traces, generated once
const DECOR = (() => {
  const rand = seeded(20260911);
  const dirs = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);
  const list = [];
  for (let n = 0; n < 90; n++) {
    let x = (rand() - 0.5) * (PW - 1.2);
    let z = (rand() - 0.5) * (PD - 1.6);
    let d = Math.floor(rand() * 8);
    const pts = [[x, z]];
    const segs = 2 + Math.floor(rand() * 3);
    for (let s = 0; s < segs; s++) {
      const len = 0.5 + rand() * 2.2;
      x = THREE.MathUtils.clamp(x + dirs[d][0] * len, -PW / 2 + 0.4, PW / 2 - 0.4);
      z = THREE.MathUtils.clamp(z + dirs[d][1] * len, -PD / 2 + 0.6, PD / 2 - 0.9);
      pts.push([x, z]);
      d = (d + (rand() < 0.5 ? 1 : 7)) % 8; // turn 45° either way
    }
    list.push(pts);
  }
  return list;
})();

// buses: bundles of parallel traces running to the edge connector
const BUSES = [
  { from: [-CORE / 2 - 0.1, 1.1], to: [-4.6, 6.2], n: 5 },
  { from: [CORE / 2 + 0.1, 1.1], to: [4.6, 6.2], n: 5 },
];

function strokePath(ctx, pts, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([x, z], k) => {
    const [px, py] = toPx(x, z);
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.stroke();
}

function via(ctx, x, z, r, color, hole) {
  const [px, py] = toPx(x, z);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, r * PX, 0, Math.PI * 2);
  ctx.fill();
  if (hole) {
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(px, py, r * PX * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

// draws the copper layer; `c` null means the white-on-black glow mask
function drawCircuit(ctx, c) {
  const trace = c ? c.trace : '#5a6f9a';
  const main = c ? c.main : '#ffffff';
  const viaCol = c ? c.via : '#8aa0cc';
  const hole = c ? c.bg : '#000';
  const w = PX * 0.035;

  DECOR.forEach((pts) => {
    strokePath(ctx, pts, w, trace);
    const [ex, ez] = pts[pts.length - 1];
    via(ctx, ex, ez, 0.07, viaCol, hole);
  });

  BUSES.forEach(({ from, to, n }) => {
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 0.16;
      const mx = from[0] + (to[0] - from[0]) * 0.35;
      strokePath(ctx, [[from[0], from[1] + off], [mx, from[1] + off], [to[0] + off, to[1] - 0.5], [to[0] + off, to[1]]], w, trace);
    }
  });

  ROUTES.forEach((r) => {
    strokePath(ctx, r.points.map((p) => [p.x, p.z]), PX * 0.09, main);
    const e = r.points[r.points.length - 1];
    via(ctx, e.x, e.z, 0.1, viaCol, hole);
  });
}

function boardTexture(mode) {
  const c = THEME3D[mode].tex;
  return makeTexture(TEX_W, TEX_H, (ctx, w, h) => {
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);

    // faint placement grid
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += PX * 0.5) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += PX * 0.5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    drawCircuit(ctx, c);

    // edge connector fingers along the front edge
    ctx.fillStyle = c.finger;
    for (let k = 0; k < 26; k++) {
      const [px, py] = toPx(-3.4 + k * 0.27, PD / 2 - 0.62);
      rr(ctx, px, py, PX * 0.17, PX * 0.55, PX * 0.04);
      ctx.fill();
    }

    // silkscreen
    ctx.fillStyle = c.silk;
    ctx.font = `700 ${PX * 0.26}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    let [sx, sy] = toPx(-PW / 2 + 0.5, PD / 2 - 0.4);
    ctx.fillText('FINLABS · SOLUTIONS PLATFORM', sx, sy);
    ctx.textAlign = 'right';
    [sx, sy] = toPx(PW / 2 - 0.5, PD / 2 - 0.4);
    ctx.fillText('REV 2026 · MADE IN INDIA', sx, sy);
    ctx.textAlign = 'left';
    ctx.font = `600 ${PX * 0.2}px "JetBrains Mono", ui-monospace, monospace`;
    [sx, sy] = toPx(-CORE / 2, -CORE / 2 - 0.3);
    ctx.fillText('U1', sx, sy);
    SPOTS.forEach((p, k) => {
      const [tx, ty] = toPx(p.x - CHIP / 2, p.z - CHIP / 2 - 0.28);
      ctx.fillText(`U${k + 2}`, tx, ty);
    });
  });
}

// emissive mask: only the copper glows in the dark theme
const glowTex = makeTexture(TEX_W, TEX_H, (ctx, w, h) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  drawCircuit(ctx, null);
});

const surfaceMat = new THREE.MeshStandardMaterial({
  map: boardTexture('light'), roughness: 0.55, metalness: 0.05,
  emissive: BRAND_HEX, emissiveMap: glowTex, emissiveIntensity: 0,
});
const surface = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), surfaceMat);
surface.rotation.x = -Math.PI / 2;
surface.position.y = 0.002;
board.add(surface);

// =====================================================
// CHIPS
// =====================================================

const pinGeo = new THREE.BoxGeometry(0.26, 0.05, 0.09);
function pinRing(size, perSide) {
  const mesh = new THREE.InstancedMesh(pinGeo, M.metal, perSide * 4);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const step = (size * 0.8) / (perSide - 1);
  let k = 0;
  for (let side = 0; side < 4; side++) {
    q.setFromAxisAngle(Y_AXIS, (side * Math.PI) / 2);
    for (let j = 0; j < perSide; j++) {
      p.set(size / 2 + 0.06, 0.05, (j - (perSide - 1) / 2) * step).applyQuaternion(q);
      m.compose(p, q, one);
      mesh.setMatrixAt(k++, m);
    }
  }
  return mesh;
}

const MONO = '"JetBrains Mono", ui-monospace, monospace';

function fitText(ctx, text, weight, size, maxW) {
  let s = size;
  ctx.font = `${weight} ${s}px ${MONO}`;
  while (ctx.measureText(text).width > maxW && s > 10) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${MONO}`;
  }
}

function chipLabel(s, i) {
  return makeTexture(512, 512, (ctx, w) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 3;
    rr(ctx, 16, 16, w - 32, w - 32, 26);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.arc(62, 62, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = s.accent;
    ctx.font = `700 132px ${MONO}`;
    ctx.fillText(String(i + 1).padStart(2, '0'), 44, 236);

    ctx.fillStyle = '#eef3ff';
    fitText(ctx, s.label, 700, 52, w - 88);
    ctx.fillText(s.label, 44, 318);

    ctx.fillStyle = 'rgba(238,243,255,0.45)';
    ctx.font = `500 27px ${MONO}`;
    ctx.fillText(`FL-SOL-0${i + 1} · FINLABS`, 44, 362);

    ctx.fillStyle = s.accent;
    rr(ctx, 44, 404, 150, 14, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let gx = 0; gx < 5; gx++) {
      for (let gy = 0; gy < 3; gy++) {
        ctx.beginPath();
        ctx.arc(356 + gx * 24, 404 + gy * 24, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

function coreLabel() {
  return makeTexture(512, 512, (ctx, w) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 3;
    rr(ctx, 16, 16, w - 32, w - 32, 30);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(62, 62, 13, 0, Math.PI * 2);
    ctx.fill();
    // concentric mark
    ctx.strokeStyle = BRAND;
    ctx.lineWidth = 10;
    rr(ctx, 196, 92, 120, 120, 28);
    ctx.stroke();
    ctx.fillStyle = BRAND;
    rr(ctx, 232, 128, 48, 48, 12);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eef3ff';
    ctx.font = `700 76px ${MONO}`;
    ctx.fillText('FINLABS', w / 2, 318);
    ctx.fillStyle = 'rgba(238,243,255,0.5)';
    ctx.font = `600 28px ${MONO}`;
    ctx.fillText('SOLUTIONS CORE', w / 2, 368);
    ctx.fillStyle = 'rgba(238,243,255,0.3)';
    ctx.font = `500 22px ${MONO}`;
    ctx.fillText('U1 · 8 CHANNELS', w / 2, 420);
  });
}

// the glowing outline printed on the board under each chip
const padTex = makeTexture(256, 256, (ctx, w) => {
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 14;
  rr(ctx, 26, 26, w - 52, w - 52, 22);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 10;
  [[20, 20, 1, 1], [w - 20, 20, -1, 1], [20, w - 20, 1, -1], [w - 20, w - 20, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * 34);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * 34, y);
    ctx.stroke();
  });
});

const labelMats = [];
const chips = SOLUTIONS.map((s, i) => {
  const accent = new THREE.Color(s.accent);
  const root = new THREE.Group();
  root.position.copy(SPOTS[i]);
  board.add(root);

  const lift = new THREE.Group();
  root.add(lift);
  const body = new THREE.Mesh(rbox(CHIP, CHIP_H, CHIP, 0.12), M.chip);
  body.position.y = CHIP_H / 2 + 0.06;
  lift.add(body);
  const labelMat = new THREE.MeshBasicMaterial({ map: chipLabel(s, i), transparent: true, toneMapped: false });
  labelMats.push({ mat: labelMat, draw: () => chipLabel(s, i) });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(CHIP - 0.22, CHIP - 0.22), labelMat);
  label.rotation.x = -Math.PI / 2;
  label.position.y = CHIP_H + 0.062;
  lift.add(label);
  lift.add(pinRing(CHIP, 7));

  const padMat = new THREE.MeshBasicMaterial({
    map: padTex, color: accent, transparent: true, opacity: T0.pad, depthWrite: false, toneMapped: false,
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(CHIP + 0.9, CHIP + 0.9), padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.014;
  root.add(pad);

  // the raised trace that lights up when this chip is in focus
  const r = ROUTES[i];
  const path = new THREE.CurvePath();
  for (let k = 1; k < r.points.length; k++) path.add(new THREE.LineCurve3(r.points[k - 1], r.points[k]));
  const routeMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: T0.route, toneMapped: false });
  board.add(new THREE.Mesh(new THREE.TubeGeometry(path, 80, 0.035, 6, false), routeMat));

  const pulseMat = new THREE.MeshBasicMaterial({ color: accent.clone().lerp(new THREE.Color(0xffffff), 0.45), transparent: true, opacity: 0.9, toneMapped: false });
  const pulses = [0, 1, 2].map(() => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), pulseMat);
    board.add(p);
    return p;
  });

  const mount = new THREE.Group();
  mount.position.y = CHIP_H + 0.1;
  lift.add(mount);

  return {
    ...s, i, accent, root, lift, padMat, routeMat, pulseMat, pulses, mount,
    model: null, u: { s: 0.6, rise: 0, glow: 0 },
  };
});
const chipByKey = Object.fromEntries(chips.map((c) => [c.key, c]));

// --- the core ---------------------------------------------------------
const core = new THREE.Group();
board.add(core);
const coreBody = new THREE.Mesh(rbox(CORE, 0.42, CORE, 0.16), M.chip);
coreBody.position.y = 0.27;
core.add(coreBody);
const coreLabelMat = new THREE.MeshBasicMaterial({ map: coreLabel(), transparent: true, toneMapped: false });
labelMats.push({ mat: coreLabelMat, draw: coreLabel });
const coreTop = new THREE.Mesh(new THREE.PlaneGeometry(CORE - 0.28, CORE - 0.28), coreLabelMat);
coreTop.rotation.x = -Math.PI / 2;
coreTop.position.y = 0.482;
core.add(coreTop);
core.add(pinRing(CORE, 9));
const coreRingMat = glowMat(BRAND_HEX, 0.55);
const coreRings = [1.35, 1.05].map((r, k) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 8, 120), coreRingMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.95 + k * 0.35;
  core.add(ring);
  return ring;
});
const corePadMat = new THREE.MeshBasicMaterial({
  map: padTex, color: BRAND_HEX, transparent: true, opacity: T0.pad, depthWrite: false, toneMapped: false,
});
const corePad = new THREE.Mesh(new THREE.PlaneGeometry(CORE + 1.1, CORE + 1.1), corePadMat);
corePad.rotation.x = -Math.PI / 2;
corePad.position.y = 0.014;
core.add(corePad);

// --- small parts scattered on the board -------------------------------
{
  const rand = seeded(7331);
  const clear = (x, z, pad) => {
    if (Math.abs(x) < CORE / 2 + pad && Math.abs(z) < CORE / 2 + pad) return false;
    if (SPOTS.some((p) => Math.abs(x - p.x) < CHIP / 2 + pad && Math.abs(z - p.z) < CHIP / 2 + pad)) return false;
    return !ROUTES.some((r) => r.points.some((a, k) => k > 0 && distToSegment(x, z, r.points[k - 1], a) < 0.32));
  };
  const spots = [];
  for (let tries = 0; spots.length < 46 && tries < 900; tries++) {
    const x = (rand() - 0.5) * (PW - 1.4);
    const z = (rand() - 0.5) * (PD - 2.2);
    if (clear(x, z, 0.55) && spots.every(([sx, sz]) => Math.hypot(sx - x, sz - z) > 0.55)) spots.push([x, z, rand()]);
  }
  const res = new THREE.InstancedMesh(rbox(0.34, 0.12, 0.17, 0.04), M.ink, spots.length);
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 20), M.metal, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  let nr = 0;
  let nc = 0;
  spots.forEach(([x, z, k]) => {
    if (k < 0.75) {
      q.setFromAxisAngle(Y_AXIS, k < 0.4 ? 0 : Math.PI / 2);
      m.compose(new THREE.Vector3(x, 0.065, z), q, one);
      res.setMatrixAt(nr++, m);
    } else {
      m.compose(new THREE.Vector3(x, 0.15, z), q.identity(), one);
      caps.setMatrixAt(nc++, m);
    }
  });
  m.compose(zero, q.identity(), zero);
  for (let k = nr; k < spots.length; k++) res.setMatrixAt(k, m);
  for (let k = nc; k < spots.length; k++) caps.setMatrixAt(k, m);
  board.add(res, caps);
}

// =====================================================
// MODELS — one per solution, standing on its chip
// =====================================================

const themedFaces = []; // { mat, draw(mode) } — retextured on theme change

function attach(key, g, animate) {
  const c = chipByKey[key];
  g.userData.animate = animate;
  c.model = g;
  c.mount.add(g);
}

function linePath(points) {
  const path = new THREE.CurvePath();
  for (let k = 1; k < points.length; k++) path.add(new THREE.LineCurve3(points[k - 1], points[k]));
  return path;
}

// --- LEARNING HUB: a stack of books under a mortarboard --------------
{
  const A = chipByKey.learning.accent.getHex();
  const g = new THREE.Group();
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
  const covers = [accentMat(A, 0.15), M.panel, accentMat(0x3b82f6, 0.12)];
  let y = 0;
  const books = [[1.75, 0.27, 1.25, 0.1], [1.6, 0.25, 1.15, -0.14], [1.66, 0.23, 1.18, 0.22]].map(([w, h, d, rot], k) => {
    const b = new THREE.Group();
    b.add(new THREE.Mesh(rbox(w, h, d, 0.05), covers[k]));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, h * 0.7, d - 0.12), pageMat);
    pages.position.set(0.07, 0, 0.07);
    b.add(pages);
    b.rotation.y = rot;
    b.userData.y = y + h / 2;
    b.position.y = b.userData.y;
    y += h;
    g.add(b);
    return b;
  });
  const stackTop = y;

  const cap = new THREE.Group();
  cap.add(new THREE.Mesh(rbox(1.25, 0.07, 1.25, 0.03), M.chip));
  const skull = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.36, 40), M.chip);
  skull.position.y = -0.2;
  cap.add(skull);
  const tasselMat = accentMat(A, 0.45);
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), tasselMat);
  button.position.y = 0.05;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.6, 6), tasselMat);
  cord.rotation.z = Math.PI / 2;
  cord.position.set(0.3, 0.045, 0);
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.065, 0.34, 12), tasselMat);
  tassel.position.set(0.6, -0.14, 0);
  cap.add(button, cord, tassel);
  g.add(cap);

  const sparkMat = accentMat(A, 0.5);
  const sparks = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), sparkMat);
    g.add(m);
    return m;
  });

  attach('learning', g, (t) => {
    books.forEach((b, k) => (b.position.y = b.userData.y + Math.sin(t * 1.4 + k) * 0.012));
    cap.position.y = stackTop + 0.72 + Math.sin(t * 1.3) * 0.1;
    cap.rotation.y = Math.PI / 4 + t * 0.4;
    cap.rotation.z = Math.sin(t * 0.9) * 0.08;
    sparks.forEach((m, k) => {
      const a = t * 0.9 + (k * Math.PI * 2) / 3;
      m.position.set(Math.cos(a) * 1.25, stackTop + 0.55 + Math.sin(a * 2) * 0.3, Math.sin(a) * 0.9);
      m.rotation.set(t * 2, t * 1.5, 0);
    });
  });
}

// --- NPS SYSTEMS: a growing corpus and a spinning rupee --------------
{
  const s = chipByKey.nps;
  const A = s.accent.getHex();
  const g = new THREE.Group();
  const coinMat = new THREE.MeshPhysicalMaterial({
    color: A, metalness: 0.55, roughness: 0.25, clearcoat: 1, emissive: A, emissiveIntensity: 0.08,
  });
  const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.1, 40);
  const stacks = [[-0.74, 0.4, 4], [0, 0.05, 7], [0.74, 0.35, 10]].map(([x, z, n]) =>
    Array.from({ length: n }, (_, k) => {
      const c = new THREE.Mesh(coinGeo, coinMat);
      c.position.set(x + ((k % 3) - 1) * 0.014, 0.05 + k * 0.104, z);
      g.add(c);
      return c;
    })
  );

  const rupeeTex = makeTexture(256, 256, (ctx, w) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = s.accent;
    ctx.font = '700 150px Inter, "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₹', w / 2, w / 2 + 8);
  });
  const big = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 56), coinMat);
  edge.rotation.x = Math.PI / 2;
  big.add(edge);
  const faceMat = new THREE.MeshStandardMaterial({ map: rupeeTex, roughness: 0.35, metalness: 0.15 });
  const front = new THREE.Mesh(new THREE.CircleGeometry(0.57, 56), faceMat);
  front.position.z = 0.072;
  const back = front.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.072;
  big.add(front, back);
  g.add(big);

  const arrowPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.1, 0.75, 0.7), new THREE.Vector3(-0.35, 1.05, 0.72),
    new THREE.Vector3(0.35, 1.3, 0.7), new THREE.Vector3(1.1, 1.85, 0.6),
  ]);
  const arrowGeo = new THREE.TubeGeometry(arrowPath, 60, 0.035, 8, false);
  const arrowMat = glowMat(A);
  g.add(new THREE.Mesh(arrowGeo, arrowMat));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 20), arrowMat);
  tip.position.copy(arrowPath.getPointAt(1));
  tip.quaternion.setFromUnitVectors(Y_AXIS, arrowPath.getTangentAt(1).normalize());
  g.add(tip);
  const arrowCount = arrowGeo.index.count;

  attach('nps', g, (t, mix) => {
    const grow = THREE.MathUtils.clamp(mix * 1.25, 0, 1);
    stacks.forEach((coins) => coins.forEach((c, k) => (c.visible = k < Math.ceil(coins.length * grow))));
    big.position.set(0, 2.2 + Math.sin(t * 1.2) * 0.08, -0.15);
    big.rotation.y = t * 0.9;
    const draw = THREE.MathUtils.clamp((mix - 0.3) / 0.7, 0, 1);
    arrowGeo.setDrawRange(0, Math.floor((arrowCount * draw) / 6) * 6);
    tip.visible = draw > 0.98;
  });
}

// --- ROBOINSIGHTS: a friendly advisor bot reading the market ----------
{
  const A = chipByKey.robo.accent.getHex();
  const g = new THREE.Group();
  const torso = new THREE.Mesh(rbox(1.05, 0.72, 0.78, 0.26), M.panel);
  torso.position.y = 0.42;
  const eyeMat = glowMat(A);
  const chest = new THREE.Mesh(new THREE.CircleGeometry(0.13, 32), eyeMat);
  chest.position.set(0, 0.46, 0.395);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.16, 20), M.metal);
  neck.position.y = 0.86;
  g.add(torso, chest, neck);

  const head = new THREE.Group();
  head.position.y = 1.42;
  g.add(head);
  head.add(new THREE.Mesh(rbox(1.3, 0.96, 0.95, 0.3), M.panel));
  const visor = new THREE.Mesh(rbox(1.06, 0.6, 0.06, 0.16), M.chip);
  visor.position.z = 0.47;
  head.add(visor);
  const eyes = [-0.24, 0.24].map((x) => {
    const e = new THREE.Mesh(rbox(0.2, 0.2, 0.04, 0.09), eyeMat);
    e.position.set(x, 0.05, 0.51);
    head.add(e);
    return e;
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 8, 24, Math.PI), eyeMat);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.1, 0.51);
  head.add(smile);
  const earMat = accentMat(A, 0.2);
  [-0.69, 0.69].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 28), earMat);
    ear.rotation.z = Math.PI / 2;
    ear.position.x = x;
    head.add(ear);
  });
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), M.metal);
  stalk.position.y = 0.62;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), eyeMat);
  bulb.position.y = 0.8;
  head.add(stalk, bulb);

  // a little candlestick chart on a floating tray
  const tray = new THREE.Group();
  tray.position.set(-1.2, 2.2, 0.1);
  tray.rotation.y = 0.35;
  g.add(tray);
  tray.add(new THREE.Mesh(rbox(1.0, 0.06, 0.46, 0.03), M.panel));
  const upMat = accentMat(A, 0.25);
  const downMat = accentMat(0xef4444, 0.2);
  const candles = [0.34, 0.5, 0.3, 0.62].map((h, k) => {
    const c = new THREE.Group();
    const body = new THREE.Mesh(rbox(0.12, 1, 0.12, 0.03), k === 2 ? downMat : upMat);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), M.metal);
    c.add(body, wick);
    c.position.set(-0.33 + k * 0.22, 0.03, 0);
    c.userData = { h, body, wick };
    tray.add(c);
    return c;
  });

  attach('robo', g, (t) => {
    head.rotation.y = Math.sin(t * 0.6) * 0.25;
    head.rotation.z = Math.sin(t * 0.9) * 0.05;
    const blink = t % 3.4 < 0.12 ? 0.15 : 1;
    eyes.forEach((e) => (e.scale.y = blink));
    bulb.scale.setScalar(1 + Math.sin(t * 4) * 0.15);
    tray.position.y = 2.2 + Math.sin(t * 1.2) * 0.07;
    candles.forEach((c, k) => {
      const h = c.userData.h * (0.8 + 0.3 * Math.sin(t * 1.7 + k * 1.3) ** 2);
      c.userData.body.scale.y = h;
      c.userData.body.position.y = 0.05 + h / 2;
      c.userData.wick.scale.y = h + 0.14;
      c.userData.wick.position.y = 0.05 + h / 2;
    });
  });
}

// --- SWIFTONBOARD: a phone doing digital KYC --------------------------
function onboardScreen(mode) {
  const dark = mode === 'dark';
  const A = chipByKey.onboard.accent;
  return makeTexture(372, 744, (ctx, w, h) => {
    const bg = dark ? '#111a31' : '#ffffff';
    const card = dark ? '#1b2644' : '#eef3fb';
    const ink = dark ? '#e8edff' : '#15203a';
    const mute = dark ? 'rgba(232,237,255,0.35)' : 'rgba(21,32,58,0.3)';
    const hex = '#' + A.getHexString();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = mute;
    rr(ctx, w / 2 - 44, 18, 88, 16, 8);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = '700 34px Inter, sans-serif';
    ctx.fillText('Onboarding', 28, 100);
    ['#22c55e', hex, mute].forEach((c, k) => {
      ctx.fillStyle = c;
      rr(ctx, 28 + k * 108, 124, 96, 10, 5);
      ctx.fill();
    });
    // face scan
    const cx = w / 2;
    const cy = 262;
    ctx.fillStyle = card;
    ctx.beginPath();
    ctx.arc(cx, cy, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mute;
    ctx.beginPath();
    ctx.arc(cx, cy - 18, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 46, 48, 30, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = hex;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(cx + sx * 100, cy + sy * 70);
      ctx.lineTo(cx + sx * 100, cy + sy * 100);
      ctx.lineTo(cx + sx * 70, cy + sy * 100);
      ctx.stroke();
    });
    // fields
    [['PAN', 0.62], ['Aadhaar e-KYC', 0.8], ['Bank account', 0.5]].forEach(([label, fill], k) => {
      const y = 404 + k * 82;
      ctx.fillStyle = card;
      rr(ctx, 28, y, w - 56, 62, 14);
      ctx.fill();
      ctx.fillStyle = mute;
      ctx.font = '600 17px Inter, sans-serif';
      ctx.fillText(label, 46, y + 26);
      ctx.fillStyle = ink;
      rr(ctx, 46, y + 38, (w - 120) * fill, 10, 5);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(w - 54, y + 31, 12, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = hex;
    rr(ctx, 28, h - 102, w - 56, 64, 32);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Continue', w / 2, h - 61);
  });
}

{
  const A = chipByKey.onboard.accent;
  const g = new THREE.Group();
  const phone = new THREE.Group();
  phone.rotation.y = -0.22;
  g.add(phone);
  phone.add(new THREE.Mesh(rbox(1.05, 2.0, 0.12, 0.16), M.chip));
  const screenMat = new THREE.MeshBasicMaterial({ map: onboardScreen('light'), toneMapped: false });
  themedFaces.push({ mat: screenMat, draw: onboardScreen });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.93, 1.86), screenMat);
  screen.position.z = 0.062;
  phone.add(screen);

  const idTex = makeTexture(330, 210, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#' + A.getHexString();
    ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px Inter, sans-serif';
    ctx.fillText('e-KYC  ·  VERIFIED', 18, 31);
    ctx.fillStyle = '#dbe5f5';
    rr(ctx, 18, 64, 88, 110, 10);
    ctx.fill();
    ctx.fillStyle = '#9fb2d4';
    ctx.beginPath();
    ctx.arc(62, 104, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(62, 160, 32, 22, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#c9d5ea';
    [[124, 76, 170], [124, 104, 130], [124, 132, 150], [124, 160, 96]].forEach(([x, y, lw]) => {
      rr(ctx, x, y, lw, 12, 6);
      ctx.fill();
    });
  });
  const card = new THREE.Group();
  card.add(new THREE.Mesh(rbox(1.1, 0.7, 0.04, 0.07), M.panel));
  const cardFace = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.63), new THREE.MeshBasicMaterial({ map: idTex, toneMapped: false }));
  cardFace.position.z = 0.022;
  card.add(cardFace);
  card.rotation.set(0, 0.35, 0.08);
  g.add(card);

  const badge = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 40), accentMat(0x22c55e, 0.3));
  disc.rotation.x = Math.PI / 2;
  badge.add(disc);
  const tick = linePath([new THREE.Vector3(-0.13, 0.0, 0.05), new THREE.Vector3(-0.03, -0.1, 0.05), new THREE.Vector3(0.14, 0.1, 0.05)]);
  badge.add(new THREE.Mesh(new THREE.TubeGeometry(tick, 24, 0.035, 8, false), glowMat(0xffffff)));
  g.add(badge);

  attach('onboard', g, (t, mix) => {
    phone.position.set(0.28, 1.2 + Math.sin(t * 1.1) * 0.05, 0);
    const out = THREE.MathUtils.clamp(mix * 1.3 - 0.3, 0, 1);
    card.position.set(THREE.MathUtils.lerp(0.2, -0.8, out), 0.95 + Math.sin(t * 1.3 + 1) * 0.07, 0.35);
    badge.position.set(0.9, 2.2 + Math.sin(t * 1.6) * 0.06, 0.25);
    badge.scale.setScalar(out * (1 + Math.sin(t * 3) * 0.05) + 0.001);
    badge.rotation.y = Math.sin(t * 1.2) * 0.3;
  });
}

// --- DATAPULSE: live bars, a heartbeat trace and a donut --------------
{
  const A = chipByKey.datapulse.accent.getHex();
  const g = new THREE.Group();
  const heights = [0.55, 0.9, 0.7, 1.25, 1.05];
  const barHi = accentMat(A, 0.25);
  const barLo = accentMat(A, 0.08);
  const bars = heights.map((h, k) => {
    const geo = rbox(0.28, 1, 0.28, 0.06);
    geo.translate(0, 0.5, 0);
    const m = new THREE.Mesh(geo, k === 3 ? barHi : k % 2 ? M.panel : barLo);
    m.position.set(-0.8 + k * 0.4, 0, 0.4);
    m.userData.h = h;
    g.add(m);
    return m;
  });

  const ecg = [[-1.15, 0], [-0.55, 0], [-0.42, 0.26], [-0.28, -0.3], [-0.12, 0.62], [0.06, -0.22], [0.2, 0], [0.62, 0], [0.74, 0.18], [0.86, 0], [1.15, 0]]
    .map(([x, y]) => new THREE.Vector3(x, 2.2 + y, 0.25));
  const ecgGeo = new THREE.TubeGeometry(linePath(ecg), 180, 0.03, 6, false);
  g.add(new THREE.Mesh(ecgGeo, glowMat(A)));
  const ecgLine = polyline(ecg);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), glowMat(0xffffff));
  g.add(head);
  const ecgCount = ecgGeo.index.count;
  const ecgSegs = 180;

  const donut = new THREE.Group();
  donut.position.set(0.72, 1.35, -0.55);
  g.add(donut);
  let a0 = 0;
  [[2.3, accentMat(A, 0.2)], [2.2, M.panel], [1.78, accentMat(0x3b82f6, 0.15)]].forEach(([arc, mat]) => {
    const seg = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 16, 48, arc - 0.06), mat);
    seg.rotation.z = a0;
    donut.add(seg);
    a0 += arc;
  });

  const scratch = new THREE.Vector3();
  attach('datapulse', g, (t, mix) => {
    bars.forEach((b, k) => (b.scale.y = b.userData.h * (0.82 + 0.18 * Math.sin(t * 1.6 + k)) * THREE.MathUtils.clamp(mix * 1.2, 0.01, 1)));
    const p = (t * 0.32) % 1;
    ecgGeo.setDrawRange(0, Math.floor(ecgSegs * p) * (ecgCount / ecgSegs));
    head.position.copy(ecgLine.at(p, scratch));
    donut.rotation.z = t * 0.5;
    donut.position.y = 1.35 + Math.sin(t * 1.1) * 0.06;
  });
}

// --- COLLABHUB: partners orbiting a shared hub ------------------------
{
  const A = chipByKey.collab.accent.getHex();
  const g = new THREE.Group();
  const hubY = 1.45;
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.4, 40, 30), accentMat(A, 0.3));
  hub.position.y = hubY;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.022, 8, 80), glowMat(A, 0.7));
  halo.rotation.x = Math.PI / 2;
  halo.position.y = hubY;
  g.add(hub, halo);

  const ring = new THREE.Group();
  ring.position.y = hubY;
  g.add(ring);
  const headMat = accentMat(A, 0.2);
  const linkMat = glowMat(A, 0.5);
  const packetMat = glowMat(0xffffff);
  const bodyGeo = new THREE.CapsuleGeometry(0.13, 0.16, 6, 16);
  const links = Array.from({ length: 5 }, (_, k) => {
    const a = (k / 5) * Math.PI * 2;
    const pos = new THREE.Vector3(Math.cos(a) * 1.25, Math.sin(a * 2) * 0.14 - 0.1, Math.sin(a) * 0.95);
    const person = new THREE.Group();
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 18), k % 2 ? M.panel : headMat);
    headM.position.y = 0.16;
    const body = new THREE.Mesh(bodyGeo, k % 2 ? headMat : M.panel);
    body.position.y = -0.12;
    person.add(headM, body);
    person.position.copy(pos);
    ring.add(person);
    const start = pos.clone().setLength(0.45);
    ring.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(start, pos), 8, 0.014, 6, false), linkMat));
    const packet = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), packetMat);
    ring.add(packet);
    return { start, pos, packet };
  });

  attach('collab', g, (t) => {
    ring.rotation.y = t * 0.35;
    hub.scale.setScalar(1 + Math.sin(t * 2.4) * 0.04);
    halo.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08);
    links.forEach(({ start, pos, packet }, k) => packet.position.lerpVectors(start, pos, 0.5 + 0.5 * Math.sin(t * 2 + k * 1.3)));
  });
}

// --- REGUSURE: a shield that signs off the paperwork ------------------
{
  const A = chipByKey.regusure.accent.getHex();
  const g = new THREE.Group();
  const shieldShape = (k) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.78 * k);
    s.quadraticCurveTo(0.35 * k, 0.62 * k, 0.66 * k, 0.62 * k);
    s.lineTo(0.66 * k, 0.05 * k);
    s.quadraticCurveTo(0.62 * k, -0.55 * k, 0, -0.85 * k);
    s.quadraticCurveTo(-0.62 * k, -0.55 * k, -0.66 * k, 0.05 * k);
    s.lineTo(-0.66 * k, 0.62 * k);
    s.quadraticCurveTo(-0.35 * k, 0.62 * k, 0, 0.78 * k);
    return s;
  };
  const shield = new THREE.Group();
  const outerGeo = new THREE.ExtrudeGeometry(shieldShape(1), {
    depth: 0.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 4, curveSegments: 16,
  });
  outerGeo.center();
  shield.add(new THREE.Mesh(outerGeo, accentMat(A, 0.18)));
  const innerGeo = new THREE.ExtrudeGeometry(shieldShape(0.74), { depth: 0.04, bevelEnabled: false, curveSegments: 16 });
  innerGeo.translate(0, 0.02, 0.15);
  shield.add(new THREE.Mesh(innerGeo, M.panel));
  const tickGeo = new THREE.TubeGeometry(
    linePath([new THREE.Vector3(-0.26, 0.02, 0.22), new THREE.Vector3(-0.06, -0.19, 0.22), new THREE.Vector3(0.3, 0.24, 0.22)]),
    40, 0.06, 10, false
  );
  shield.add(new THREE.Mesh(tickGeo, accentMat(A, 0.35)));
  g.add(shield);
  const tickCount = tickGeo.index.count;

  const docTex = makeTexture(256, 330, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1c2a4c';
    rr(ctx, 22, 24, 130, 16, 8);
    ctx.fill();
    for (let k = 0; k < 5; k++) {
      const y = 70 + k * 42;
      ctx.fillStyle = '#22c55e';
      rr(ctx, 22, y, 20, 20, 5);
      ctx.fill();
      ctx.fillStyle = '#d3ddef';
      rr(ctx, 54, y + 4, 150 - (k % 2) * 40, 12, 6);
      ctx.fill();
    }
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w - 58, h - 50, 30, 0, Math.PI * 2);
    ctx.stroke();
  });
  const docMat = new THREE.MeshBasicMaterial({ map: docTex, toneMapped: false });
  const docs = [[-0.62, 1.3, -0.45, 0.35], [0.62, 1.15, -0.62, -0.3]].map(([x, y, z, ry]) => {
    const d = new THREE.Group();
    d.add(new THREE.Mesh(rbox(1.0, 1.3, 0.04, 0.05), M.panel));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.2), docMat);
    face.position.z = 0.022;
    d.add(face);
    d.position.set(x, y, z);
    d.rotation.y = ry;
    d.userData.y = y;
    g.add(d);
    return d;
  });

  const orbit = new THREE.Group();
  orbit.position.y = 1.45;
  orbit.rotation.x = 0.35;
  g.add(orbit);
  orbit.add(new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.018, 8, 140), glowMat(A, 0.6)));
  const nodes = [0, 1, 2].map(() => {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), glowMat(A));
    orbit.add(n);
    return n;
  });

  attach('regusure', g, (t, mix) => {
    shield.position.set(0.05, 1.45 + Math.sin(t * 1.1) * 0.06, 0.3);
    shield.rotation.y = Math.sin(t * 0.7) * 0.25;
    const draw = THREE.MathUtils.clamp((mix - 0.35) / 0.65, 0, 1);
    tickGeo.setDrawRange(0, Math.floor((tickCount * draw) / 6) * 6);
    docs.forEach((d, k) => (d.position.y = d.userData.y + Math.sin(t * 1.2 + k * 2) * 0.05));
    orbit.rotation.y = t * 0.5;
    nodes.forEach((n, k) => {
      const a = (k * Math.PI * 2) / 3;
      n.position.set(Math.cos(a) * 1.12, Math.sin(a) * 1.12, 0);
    });
  });
}

// --- OPSOPTIMA: gears driving a conveyor of finished tasks ------------
function gearShape(outer, inner, teeth, hole) {
  const s = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let k = 0; k < teeth; k++) {
    const a0 = k * step;
    [[inner, a0], [outer, a0 + step * 0.18], [outer, a0 + step * 0.48], [inner, a0 + step * 0.66]].forEach(([r, a], j) => {
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (k === 0 && j === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
  }
  s.closePath();
  const h = new THREE.Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  s.holes.push(h);
  return s;
}

{
  const A = chipByKey.opsoptima.accent.getHex();
  const g = new THREE.Group();
  const gear = (outer, inner, teeth, mat) => {
    const geo = new THREE.ExtrudeGeometry(gearShape(outer, inner, teeth, outer * 0.24), {
      depth: 0.18, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 12,
    });
    geo.translate(0, 0, -0.09);
    const m = new THREE.Mesh(geo, mat);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(outer * 0.2, outer * 0.2, 0.34, 20), M.metal);
    axle.rotation.x = Math.PI / 2;
    const grp = new THREE.Group();
    grp.add(m, axle);
    grp.userData.gear = m;
    g.add(grp);
    return grp;
  };
  const gA = gear(0.72, 0.58, 12, accentMat(A, 0.15));
  gA.position.set(-0.35, 1.6, -0.2);
  const gB = gear(0.48, 0.36, 8, M.panel);
  gB.position.set(-0.35 + 1.07 * Math.cos(0.61), 1.6 + 1.07 * Math.sin(0.61), -0.2);
  const gC = gear(0.4, 0.3, 7, accentMat(0x3b82f6, 0.12));
  gC.position.set(-0.35 + 0.99 * Math.cos(-0.7), 1.6 + 0.99 * Math.sin(-0.7), -0.2);

  const belt = new THREE.Mesh(rbox(2.2, 0.12, 0.6, 0.06), M.chip);
  belt.position.set(0, 0.2, 0.55);
  g.add(belt);
  [-1.1, 1.1].forEach((x) => {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.66, 20), M.metal);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(x, 0.2, 0.55);
    g.add(roller);
  });
  const doneMat = accentMat(A, 0.25);
  const parcels = [0, 1, 2, 3].map(() => {
    const p = new THREE.Mesh(rbox(0.28, 0.24, 0.28, 0.06), M.panel);
    g.add(p);
    return p;
  });

  attach('opsoptima', g, (t) => {
    gA.userData.gear.rotation.z = t * 0.8;
    gB.userData.gear.rotation.z = -t * 0.8 * (12 / 8) + 0.2;
    gC.userData.gear.rotation.z = -t * 0.8 * (12 / 7) + 0.1;
    parcels.forEach((p, k) => {
      const u = (t * 0.18 + k / parcels.length) % 1;
      p.position.set(-1.0 + u * 2.0, 0.39, 0.55);
      p.material = u > 0.5 ? doneMat : M.panel; // processed once it passes the gears
      p.scale.setScalar(Math.min(1, Math.sin(u * Math.PI) * 4));
    });
  });
}

// =====================================================
// AMBIENT PARTICLES — bits drifting up off the board
// =====================================================

const PCOUNT = 220;
const P_TOP = 6;
const pPos = new Float32Array(PCOUNT * 3);
const pSpeed = new Float32Array(PCOUNT);
for (let i = 0; i < PCOUNT; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * BOARD_W;
  pPos[i * 3 + 1] = Math.random() * P_TOP;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * BOARD_D;
  pSpeed[i] = 0.15 + Math.random() * 0.35;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({
  color: T0.particles, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false,
});
board.add(new THREE.Points(pGeo, pMat));

// =====================================================
// THEME
// =====================================================

let themeMode = 'light';
onTheme((mode) => {
  themeMode = mode;
  const t = THEME3D[mode];
  M.board.color.setHex(t.board);
  M.chip.color.setHex(t.chip);
  M.panel.color.setHex(t.panel);
  M.soft.color.setHex(t.soft);
  M.metal.color.setHex(t.metal);
  M.ink.color.setHex(t.ink);
  surfaceMat.map?.dispose();
  surfaceMat.map = boardTexture(mode);
  surfaceMat.emissiveIntensity = t.traceGlow;
  surfaceMat.needsUpdate = true;
  scene.environmentIntensity = t.env;
  renderer.toneMappingExposure = t.exposure;
  pMat.color.setHex(t.particles);
  hemi.intensity = mode === 'dark' ? 0.35 : 0.6;
  key.intensity = mode === 'dark' ? 1.1 : 1.5;
  themedFaces.forEach((f) => {
    f.mat.map?.dispose();
    f.mat.map = f.draw(mode);
    f.mat.needsUpdate = true;
  });
});

// Chip labels and silkscreen are drawn in JetBrains Mono. Canvas text
// falls back silently if the webfont isn't ready, so redraw once it is.
function redrawType() {
  labelMats.forEach((l) => {
    l.mat.map?.dispose();
    l.mat.map = l.draw();
    l.mat.needsUpdate = true;
  });
  surfaceMat.map?.dispose();
  surfaceMat.map = boardTexture(themeMode);
  surfaceMat.needsUpdate = true;
}
document.fonts?.ready.then(redrawType);
window.addEventListener('load', () => {
  document.fonts?.load(`700 48px ${MONO}`).then(redrawType).catch(() => {});
});

// =====================================================
// SECTION → CAMERA + CHIP STATES
// =====================================================

let sceneName = 'overview';
let side = 'left';
let fitKeys = [];
let snap = false;

onSceneChange(({ scene: s, side: sd }) => {
  sceneName = s;
  side = sd;
});
onFitChange((keys) => {
  fitKeys = keys;
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

// Where is the free space beside the copy? Cards on either side share
// the hero column's width and page padding, so one measurement serves both.
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

function computeTargets(t) {
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;
  // cheap insurance against a stale measurement from a page that was laid
  // out at zero size and never told when it grew
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
  const c = chipByKey[sceneName];
  let dist;
  let az = pointer.x * 0.12;
  if (c) {
    tgtLook.set(c.root.position.x, 1.85, c.root.position.z);
    az += THREE.MathUtils.clamp(c.root.position.x * 0.05, -0.4, 0.4);
    dir.set(0, 0.6, 1);
    dist = fitDist(2.9, 11, 26);
  } else if (sceneName === 'fit') {
    tgtLook.set(0, 0, 0.4);
    dir.set(0, 1.05, 1);
    dist = fitDist(11, 24, 80);
  } else if (sceneName === 'contact') {
    tgtLook.set(0, 0, 0);
    dir.set(0, 0.8, 1);
    dist = fitDist(11.5, 30, 80);
  } else {
    tgtLook.set(0, 0.3, 0.6);
    dir.set(0, 0.85, 1);
    dist = fitDist(11.2, 24, 80);
    az += Math.sin(t * 0.12) * 0.06; // a slow idle sway on the overview
  }
  dir.y += pointer.y * -0.06;
  dir.normalize().applyAxisAngle(Y_AXIS, az);
  tgtPos.copy(tgtLook).addScaledVector(dir, dist);
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
const scratch = new THREE.Vector3();
let shift = 0;
let placed = false; // the first valid frame snaps into place instead of flying across the copy

// dev-only: step frames by hand (a hidden preview pane pauses rAF)
if (import.meta.env.DEV) {
  window.__tick = (n = 1) => {
    for (let k = 0; k < n; k++) frame();
    return window.__sol;
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
  const ease = jump ? 1 : 0.075;

  // chips: the focused one lifts and presents its model; the rest stand by
  const focusKey = chipByKey[sceneName] ? sceneName : null;
  const T = THEME3D[themeMode];
  chips.forEach((c) => {
    let s = 0.62;
    let rise = 0;
    let glow = 0.45;
    if (focusKey) {
      const on = c.key === focusKey;
      s = on ? 1 : 0;
      rise = on ? 0.5 : 0;
      glow = on ? 1 : 0.12;
    } else if (sceneName === 'fit') {
      const on = fitKeys.includes(c.key);
      s = on ? 0.85 : 0.22;
      rise = on ? 0.4 : 0;
      glow = on ? 1 : 0.1;
    }
    const u = c.u;
    u.s += (s - u.s) * ease;
    u.p = (u.p ?? 1) + ((s > 0 ? 1 : 0) - (u.p ?? 1)) * ease; // presence drives each model's build-up
    u.rise += (rise - u.rise) * ease;
    u.glow += (glow - u.glow) * ease;

    c.lift.position.y = u.rise + (rise > 0 ? Math.sin(t * 1.5 + c.i) * 0.03 : 0);
    c.padMat.opacity = T.pad * (0.3 + 0.7 * u.glow);
    c.routeMat.opacity = Math.min(1, T.route * (0.45 + 1.1 * u.glow));
    c.pulseMat.opacity = 0.2 + 0.8 * u.glow;
    c.pulses.forEach((p, k) => {
      const along = (t * (0.18 + 0.32 * u.glow) + k / c.pulses.length + c.i * 0.11) % 1;
      ROUTES[c.i].at(along, p.position);
      p.position.y = 0.05;
    });

    const m = c.model;
    m.visible = u.s > 0.01;
    if (!m.visible) return;
    m.scale.setScalar(Math.max(0.001, u.s));
    m.userData.animate(t, u.p);
  });

  // accent colour + light follow the focused chip
  const fc = focusKey ? chipByKey[focusKey] : null;
  accentTarget.set(fc ? fc.accent : BRAND_HEX);
  accentNow.lerp(accentTarget, jump ? 1 : 0.06);
  seamMat.color.copy(accentNow);
  accentLight.color.copy(accentNow);
  lightTarget.set(fc ? fc.root.position.x : 0, fc ? 3 : 4, fc ? fc.root.position.z + 1.5 : 1);
  accentLight.position.lerp(lightTarget, jump ? 1 : 0.06);
  accentLight.intensity = fc ? 18 : 10;

  coreRings[0].rotation.z = t * 0.4;
  coreRings[1].rotation.z = -t * 0.6;
  coreRings.forEach((r, k) => (r.position.y = 0.95 + k * 0.35 + Math.sin(t * 1.4 + k) * 0.04));
  corePadMat.opacity = T.pad;

  for (let i = 0; i < PCOUNT; i++) {
    const y = pPos[i * 3 + 1] + pSpeed[i] * dt;
    pPos[i * 3 + 1] = y > P_TOP ? 0 : y;
  }
  pGeo.attributes.position.needsUpdate = true;

  // camera: fly to the section's view, projected into the free space
  computeTargets(t);
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;
  if (jump || (!placed && (colRight > 0 || w < 900))) {
    camera.position.copy(tgtPos);
    look.copy(tgtLook);
    shift = tgtShift;
    placed = true;
    snap = false;
  }
  camera.position.lerp(tgtPos, 0.045);
  look.lerp(tgtLook, 0.045);
  shift += (tgtShift - shift) * 0.06;
  camera.lookAt(look);
  camera.setViewOffset(w, h, -shift, 0, w, h);

  renderer.render(scene, camera);

  if (import.meta.env.DEV) {
    window.__sol = {
      scene: sceneName,
      side,
      fit: fitKeys,
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
