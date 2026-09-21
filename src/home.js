import './home.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import './home-ui.js';
import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initTheme, onTheme } from './theme.js';

/* =====================================================
 * FINLABS HOME — 3D set into the page
 * =====================================================
 * One transparent canvas above the page draws several
 * small scenes, each into the box of the element that
 * asks for it ([data-view]). Rather than one backdrop
 * scene with a flying camera, the 3D sits in the layout
 * and scrolls with it: a small machine for each offering
 * in the hero, a model in each offering tile, and a gold
 * trophy among the awards.
 * ===================================================== */

document.documentElement.classList.add('js');
initTheme();

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DISPLAY = '"Outfit", "Segoe UI", system-ui, sans-serif';
const BODY = '"Inter", "Segoe UI", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

let themeMode = 'light'; // kept in step by onTheme, for redrawing labels

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
// HERO — a small machine for each of the three offerings
// =====================================================

const OFFERS = [
  { key: 'products', title: 'Products', c: ['#1e3a8a', '#2563eb', '#60a5fa'] },
  { key: 'solutions', title: 'Solutions', c: ['#0e7490', '#0891b2', '#22d3ee'] },
  { key: 'services', title: 'Services', c: ['#4c1d95', '#7c3aed', '#c4b5fd'] },
];

// the offering's name, on a pill that always faces the camera
function offerLabel(o, mode) {
  return makeTexture(512, 140, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    rr(ctx, 10, 10, w - 20, h - 20, (h - 20) / 2);
    ctx.fillStyle = mode === 'dark' ? 'rgba(10,17,34,0.94)' : 'rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = o.c[1];
    ctx.stroke();
    ctx.fillStyle = mode === 'dark' ? o.c[2] : o.c[0];
    ctx.font = `700 54px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.title, w / 2, h / 2 + 3);
  });
}

function labelSprite(o) {
  const draw = (m) => offerLabel(o, m ?? themeMode);
  const mat = new THREE.SpriteMaterial({ map: draw(), transparent: true, toneMapped: false, depthWrite: false });
  themedFaces.push({ mat, draw }); // light ↔ dark
  typeFaces.push({ mat, draw }); // once the webfonts have loaded
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.05, 0.287, 1);
  return sprite;
}

// PRODUCTS — the apps themselves: a portfolio ticking up, and ₹ on the side
function phoneFace(o, mode) {
  return makeTexture(512, 1024, (ctx, w, h) => {
    const dark = mode === 'dark';
    const card = dark ? '#132043' : '#ffffff';
    const ink = dark ? '#e8edff' : '#16233f';
    const mute = dark ? 'rgba(232,237,255,0.45)' : 'rgba(22,35,63,0.45)';
    ctx.fillStyle = dark ? '#0b1430' : '#eef3fc';
    ctx.fillRect(0, 0, w, h);

    // the header: what the client is worth today
    const g = ctx.createLinearGradient(0, 0, w, 340);
    g.addColorStop(0, o.c[0]);
    g.addColorStop(1, o.c[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, 340);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = `600 30px ${BODY}`;
    ctx.fillText('Portfolio value', 40, 104);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 74px ${DISPLAY}`;
    ctx.fillText('₹ 24,80,500', 36, 186);
    ctx.fillStyle = '#6ee7b7';
    ctx.font = `700 28px ${MONO}`;
    ctx.fillText('▲ 14.2%  this year', 40, 244);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `600 24px ${MONO}`;
    ctx.fillText('FINLABS', 40, 300);

    // the card the chart plays in
    ctx.fillStyle = card;
    rr(ctx, 36, 372, w - 72, 336, 26);
    ctx.fill();
    ctx.fillStyle = mute;
    ctx.font = `600 24px ${MONO}`;
    ctx.fillText('GROWTH · 12 MONTHS', 66, 416);

    // two lines of the sort every plan has
    [['SIP  ·  monthly', '₹ 25,000'], ['Goals on track', '6 of 7']].forEach(([label, value], k) => {
      const y = 736 + k * 104;
      ctx.fillStyle = card;
      rr(ctx, 36, y, w - 72, 86, 22);
      ctx.fill();
      ctx.fillStyle = mute;
      ctx.font = `600 26px ${BODY}`;
      ctx.fillText(label, 66, y + 52);
      ctx.fillStyle = ink;
      ctx.font = `700 30px ${DISPLAY}`;
      ctx.textAlign = 'right';
      ctx.fillText(value, w - 66, y + 52);
      ctx.textAlign = 'left';
    });

    // the app's own tab bar
    ctx.fillStyle = card;
    rr(ctx, 36, 946, w - 72, 56, 28);
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = k === 0 ? o.c[1] : mute;
      ctx.beginPath();
      ctx.arc(104 + k * 102, 974, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// a growth line that can slide past for ever, drawn from repeating waves
function chartStrip(o) {
  return makeTexture(1024, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const at = (x) => {
      const u = (x / w) * Math.PI * 2;
      return h * 0.62 - (Math.sin(u) * 0.2 + Math.sin(u * 2 + 1.1) * 0.12 + Math.sin(u * 3 + 0.4) * 0.06) * h;
    };
    ctx.beginPath();
    ctx.moveTo(0, at(0));
    for (let x = 4; x <= w; x += 4) ctx.lineTo(x, at(x));
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, h * 0.1, 0, h);
    fill.addColorStop(0, `${o.c[2]}cc`);
    fill.addColorStop(1, `${o.c[2]}00`);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, at(0));
    for (let x = 4; x <= w; x += 4) ctx.lineTo(x, at(x));
    ctx.strokeStyle = o.c[2];
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.stroke();
  });
}

function buildPhone(o) {
  const g = new THREE.Group();
  const phone = new THREE.Group();
  g.add(phone);

  phone.add(new THREE.Mesh(rbox(0.98, 1.92, 0.14, 0.09), M.chip));
  const faceDraw = (m) => phoneFace(o, m ?? themeMode);
  const faceMat = new THREE.MeshBasicMaterial({ map: faceDraw(), toneMapped: false });
  themedFaces.push({ mat: faceMat, draw: faceDraw });
  typeFaces.push({ mat: faceMat, draw: faceDraw });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.74), faceMat);
  screen.position.z = 0.073;
  phone.add(screen);

  const strip = chartStrip(o);
  strip.wrapS = THREE.RepeatWrapping;
  const chart = new THREE.Mesh(
    new THREE.PlaneGeometry(0.71, 0.54),
    new THREE.MeshBasicMaterial({ map: strip, transparent: true, toneMapped: false, depthWrite: false })
  );
  chart.position.set(0, 0.075, 0.079);
  phone.add(chart);

  // a little ₹ beside it: three coins on the table and one still spinning
  const stack = new THREE.Group();
  stack.position.set(-0.72, -0.86, 0.3);
  [0, 1, 2].forEach((k) => {
    const c = makeCoin(0.24);
    c.rotation.x = -Math.PI / 2;
    c.position.y = k * 0.056;
    stack.add(c);
  });
  const spinner = makeCoin(0.22);
  spinner.position.set(0.7, -0.62, 0.34);
  g.add(stack, spinner);

  return {
    group: g,
    animate(t) {
      strip.offset.x = (t * 0.05) % 1;
      phone.rotation.y = Math.sin(t * 0.4) * 0.22;
      phone.rotation.z = Math.sin(t * 0.33) * 0.03;
      phone.position.y = Math.sin(t * 1.1) * 0.03;
      spinner.rotation.set(0.22, t * 1.2, 0);
      spinner.position.y = -0.62 + Math.sin(t * 1.4) * 0.06;
    },
  };
}

// SOLUTIONS — one platform with seven modules plugged into it
function buildHub(o) {
  const g = new THREE.Group();
  const accent = new THREE.Color(o.c[1]).getHex();
  const light = new THREE.Color(o.c[2]).getHex();

  const core = new THREE.Mesh(rbox(0.78, 0.78, 0.78, 0.16), accentMat(accent, 0.22));
  g.add(core);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 2.8),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(34,211,238,0.8)'), transparent: true, depthWrite: false, opacity: 0.32, toneMapped: false })
  );
  halo.position.z = -0.7;
  g.add(halo);

  // the modules ride one tilted wheel around it, each on its own spoke
  const tiltG = new THREE.Group();
  tiltG.rotation.set(0.42, -0.2, 0);
  g.add(tiltG);
  const wheel = new THREE.Group();
  tiltG.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.012, 8, 96), glowMat(light, 0.5)));

  const R = 0.92;
  const spokeGeo = new THREE.CylinderGeometry(0.015, 0.015, R - 0.46, 6);
  spokeGeo.rotateZ(Math.PI / 2); // lie along the spoke, not up it
  const tiles = [];
  for (let k = 0; k < 7; k++) {
    const arm = new THREE.Group();
    arm.rotation.z = (k / 7) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeo, glowMat(light, 0.4));
    spoke.position.x = 0.46 + (R - 0.46) / 2;
    const tile = new THREE.Mesh(rbox(0.3, 0.3, 0.11, 0.06), k % 2 ? M.panel : accentMat(k % 3 ? light : accent, 0.2));
    tile.position.x = R;
    arm.add(spoke, tile);
    wheel.add(arm);
    tiles.push({ tile, arm });
  }

  return {
    group: g,
    animate(t) {
      wheel.rotation.z = t * 0.3;
      tiles.forEach(({ tile }, k) => {
        // each module keeps itself upright as the wheel turns, and breathes
        tile.rotation.z = -t * 0.3 - (k / 7) * Math.PI * 2;
        tile.position.x = R + Math.sin(t * 1.5 + k * 0.9) * 0.05;
      });
      core.rotation.set(t * 0.22, t * 0.38, 0);
      core.scale.setScalar(1 + Math.sin(t * 1.8) * 0.03);
      g.rotation.y = Math.sin(t * 0.3) * 0.12;
    },
  };
}

// SERVICES — we go over what you already run, then build and keep it running
function auditFace(o, mode) {
  return makeTexture(768, 512, (ctx, w, h) => {
    const dark = mode === 'dark';
    const card = dark ? '#18244a' : '#f2f6fd';
    const mute = dark ? 'rgba(232,237,255,0.4)' : 'rgba(22,35,63,0.28)';
    ctx.fillStyle = dark ? '#0f1a38' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = card;
    ctx.fillRect(0, 0, w, 84);
    ['#f87171', '#fbbf24', '#34d399'].forEach((c, k) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(46 + k * 38, 42, 11, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = mute;
    ctx.font = `700 24px ${MONO}`;
    ctx.fillText('SYSTEM REVIEW', 176, 52);

    // four checks, three passing and one still being looked at
    for (let k = 0; k < 4; k++) {
      const y = 122 + k * 92;
      ctx.fillStyle = card;
      rr(ctx, 40, y, w - 80, 72, 18);
      ctx.fill();
      ctx.fillStyle = mute;
      rr(ctx, 70, y + 26, 190 + (k % 3) * 60, 20, 10);
      ctx.fill();
      const on = k < 3;
      ctx.fillStyle = on ? '#34d399' : o.c[1];
      rr(ctx, w - 214, y + 20, 144, 32, 16);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 20px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(on ? 'PASS' : 'IN REVIEW', w - 142, y + 42);
      ctx.textAlign = 'left';
    }
  });
}

function gearGeo(radius, teeth, depth) {
  const parts = [];
  const body = new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, depth, 36);
  body.rotateX(Math.PI / 2); // the wheel stands up, facing the camera
  parts.push(body);
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2;
    const tooth = new THREE.BoxGeometry(radius * 0.3, radius * 0.26, depth * 0.92);
    tooth.rotateZ(a);
    tooth.translate(Math.cos(a) * radius * 0.92, Math.sin(a) * radius * 0.92, 0);
    parts.push(tooth);
  }
  return mergeGeometries(parts, false);
}

function buildAudit(o) {
  const g = new THREE.Group();
  const accent = new THREE.Color(o.c[1]).getHex();
  const light = new THREE.Color(o.c[2]).getHex();

  // the system under review, on a panel
  const panel = new THREE.Group();
  panel.rotation.set(-0.1, 0.26, 0);
  panel.add(new THREE.Mesh(rbox(1.5, 1.0, 0.08, 0.05), M.chip));
  const faceDraw = (m) => auditFace(o, m ?? themeMode);
  const faceMat = new THREE.MeshBasicMaterial({ map: faceDraw(), toneMapped: false });
  themedFaces.push({ mat: faceMat, draw: faceDraw });
  typeFaces.push({ mat: faceMat, draw: faceDraw });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.93), faceMat);
  face.position.z = 0.043;
  panel.add(face);
  g.add(panel);

  // the magnifier going over it
  const lens = new THREE.Group();
  lens.add(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 14, 40), accentMat(accent, 0.2)));
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.25, 36),
    new THREE.MeshPhysicalMaterial({ color: 0xdbeafe, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.35 })
  );
  lens.add(glass);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.36, 12), accentMat(light, 0.16));
  handle.position.set(0.25, -0.25, 0);
  handle.rotation.z = Math.PI / 4;
  lens.add(handle);
  lens.position.z = 0.42;
  g.add(lens);

  // and the work that follows the review
  const gear = new THREE.Mesh(gearGeo(0.34, 10, 0.15), accentMat(light, 0.22));
  gear.position.set(-0.95, -0.52, 0.12);
  g.add(gear);

  return {
    group: g,
    animate(t) {
      lens.position.x = Math.sin(t * 0.55) * 0.42;
      lens.position.y = Math.sin(t * 0.83 + 1) * 0.26;
      lens.rotation.z = Math.sin(t * 0.55) * 0.12;
      gear.rotation.z = -t * 0.6;
      panel.rotation.y = 0.26 + Math.sin(t * 0.4) * 0.12;
      g.position.y = Math.sin(t * 1.05) * 0.03;
    },
  };
}

const BUILD = { products: buildPhone, solutions: buildHub, services: buildAudit };
// where each one floats, how big it stands, and where its name sits
const SPOTS = [
  { p: [-1.85, 0.2, 0.3], size: 1.1, labelY: -1.3 },
  { p: [1.45, 1.1, -0.45], size: 1.05, labelY: -1.15 },
  { p: [1.15, -1.55, 0.2], size: 1.05, labelY: -1.0 },
];

addView('hero', (v) => {
  v.fitR = 3.5;
  v.look.set(0.1, -0.3, 0);
  v.dir.set(0, 0.1, 1);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(34,211,238,0.9)'), transparent: true, depthWrite: false, opacity: 0.5, toneMapped: false })
  );
  glow.position.set(0, -0.3, -2.4);
  v.scene.add(glow);

  const root = new THREE.Group();
  v.scene.add(root);

  const pieces = OFFERS.map((o, i) => {
    const holder = new THREE.Group();
    holder.position.set(...SPOTS[i].p);
    const model = BUILD[o.key](o);
    const label = labelSprite(o);
    label.position.y = SPOTS[i].labelY;
    holder.add(model.group, label);
    root.add(holder);
    return { holder, model, home: SPOTS[i].p, size: SPOTS[i].size };
  });

  const coins = [[-3.0, -1.7, 0.9, 0.3], [3.05, 2.05, -0.3, 0.26], [-2.7, 2.2, 0.5, 0.2], [2.6, -2.4, 1.0, 0.18]]
    .map(([x, y, z, r], k) => {
      const c = makeCoin(r);
      c.userData = { x, y, z, k };
      root.add(c);
      return c;
    });

  const beads = [[2.9, -0.9, -0.6, 0.22, 0x22d3ee], [-2.5, -2.3, 0.2, 0.15, 0xa78bfa], [0.9, 2.5, -0.9, 0.13, 0x60a5fa]]
    .map(([x, y, z, r, hex], k) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), accentMat(hex, 0.25));
      m.userData = { x, y, z, k };
      root.add(m);
      return m;
    });

  const tilt = new THREE.Vector2();
  return {
    update(t, rect) {
      // as the hero scrolls away the three drift further apart
      const away = clamp01(-rect.top / (rect.height * 0.9));
      tilt.x += (pointer.y * 0.16 - tilt.x) * 0.06;
      tilt.y += (pointer.x * 0.26 - tilt.y) * 0.06;
      root.rotation.set(tilt.x, tilt.y, 0);
      pieces.forEach(({ holder, model, home, size }, i) => {
        const e = easeOutBack(clamp01(v.seen * 1.6 - i * 0.2));
        const spread = 1 + away * 0.4;
        holder.position.set(
          home[0] * spread,
          home[1] * spread - (1 - e) * 2.2 + Math.sin(t * 0.9 + i * 1.7) * 0.07,
          home[2] * spread
        );
        holder.scale.setScalar(Math.max(0.001, e * size));
        model.animate(t);
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
    ctx.fillText('07', w / 2, 150);
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
  themeMode = mode;
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
