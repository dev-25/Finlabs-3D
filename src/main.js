import './style.css';
import * as THREE from 'three';
import { Timer } from 'three';

/* =====================================================
 * FINLABS SHOWROOM
 * =====================================================
 * A bright, light-blue product room rendered with Three.js.
 * The camera walks down the showroom as the page scrolls,
 * stopping at a display station for each Finlabs platform.
 * The walls carry framed financial artwork, turning gears
 * and flat isometric-style icons.
 * ===================================================== */

// =====================================================
// PALETTE
// =====================================================

const C = {
  air: 0xbde3f1,
  wall: 0xd2ebf6,
  wallTint: 0xb2dded,
  floor: 0xe7f6fc,
  floorLine: 0x9ccfe4,
  runner: 0xbbe1f0,
  ceiling: 0xb2dcef, // light blue, so the white light panels read against it
  navyDeep: 0x0a2c40,
  navy2: 0x11455e,
  white: 0xffffff,
  navy: 0x0e3a52,
  tealDeep: 0x0f6d8c,
  teal: 0x1a8fb5,
  cyan: 0x45bede,
  cyanSoft: 0x9ad9ea,
  orange: 0xf26722,
  amber: 0xf9a825,
  gold: 0xfbc02d,
  goldDeep: 0xe08c10,
};

const CSS = {
  navy: '#0e3a52',
  ink: '#12506e',
  tealDeep: '#0f6d8c',
  teal: '#1a8fb5',
  cyan: '#45bede',
  cyanSoft: '#9ad9ea',
  pale: '#cfe8f4',
  paler: '#eaf6fb',
  white: '#ffffff',
  orange: '#f26722',
  amber: '#f9a825',
  gold: '#fbc02d',
  slate: '#7ba3ba',
};

// =====================================================
// PRODUCTS  (order matches the sections in index.html)
// =====================================================

const PRODUCTS = [
  { name: 'FINEXA', screen: 'wealth', accent: C.teal, prop: 'goldbars' },
  { name: 'FINEXA GenNxT', screen: 'aggregate', accent: C.cyan, prop: 'coins' },
  { name: 'FINAWARE', screen: 'awareness', accent: C.orange, prop: 'calculator' },
  { name: 'FISCUS', screen: 'finance', accent: C.tealDeep, prop: 'cards' },
  { name: 'LEARNGENIE', screen: 'learning', accent: C.amber, prop: 'coffee' },
];

const STATION_GAP = 13;
const stationZ = (i) => -8 - i * STATION_GAP;
const stationX = (i) => (i % 2 === 0 ? 6.4 : -6.4);

// room dimensions
const FLOOR_Y = -3.4;
const CEIL_Y = 7.4;
const HALF_W = 15;
const ROOM_LEN = 92;
const ROOM_MID_Z = -24;
const BACK_Z = ROOM_MID_Z - ROOM_LEN / 2;

// =====================================================
// RENDERER / SCENE / CAMERA
// =====================================================

const canvas = document.querySelector('#canvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.air);
scene.fog = new THREE.Fog(C.air, 40, 108);

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  400
);
camera.position.set(0, -0.3, 18);

// =====================================================
// LIGHTING — bright and even, like a daylit showroom
// =====================================================

scene.add(new THREE.AmbientLight(0xffffff, 1.15));
scene.add(new THREE.HemisphereLight(0xf6fdff, 0xd2ecf6, 0.9));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
keyLight.position.set(12, 20, 14);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xd8f0fb, 0.55);
fillLight.position.set(-14, 8, -10);
scene.add(fillLight);

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

// soft round drop shadow, reused under every object
const shadowTex = makeTexture(256, 256, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(16,74,102,0.34)');
  g.addColorStop(0.55, 'rgba(16,74,102,0.13)');
  g.addColorStop(1, 'rgba(16,74,102,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

const shadowGeo = new THREE.PlaneGeometry(1, 1);

function addShadow(parent, size, y, z = 0, opacity = 1) {
  const s = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity,
      depthWrite: false,
      fog: true,
    })
  );
  s.scale.set(size, size * 0.6, 1);
  s.rotation.x = -Math.PI / 2;
  s.position.set(0, y, z);
  parent.add(s);
  return s;
}

// =====================================================
// ICON PAINTERS — flat, isometric-poster style
// =====================================================

const ICONS = {
  gear(ctx, s) {
    const cx = s / 2;
    const R = s * 0.4;
    const teeth = 10;
    ctx.fillStyle = CSS.cyan;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const r = i % 2 === 0 ? R : R * 0.82;
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cx + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = CSS.paler;
    ctx.beginPath();
    ctx.arc(cx, cx, R * 0.42, 0, Math.PI * 2);
    ctx.fill();
  },

  target(ctx, s) {
    const cx = s / 2;
    const rings = [
      [0.4, CSS.cyan],
      [0.3, CSS.white],
      [0.2, CSS.teal],
      [0.1, CSS.orange],
    ];
    rings.forEach(([r, col]) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cx, s * r, 0, Math.PI * 2);
      ctx.fill();
    });
    // arrow
    ctx.strokeStyle = CSS.orange;
    ctx.lineWidth = s * 0.045;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.03, cx - s * 0.03);
    ctx.lineTo(cx + s * 0.36, cx - s * 0.36);
    ctx.stroke();
    ctx.fillStyle = CSS.orange;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.42, cx - s * 0.42);
    ctx.lineTo(cx + s * 0.26, cx - s * 0.38);
    ctx.lineTo(cx + s * 0.38, cx - s * 0.26);
    ctx.closePath();
    ctx.fill();
  },

  pie(ctx, s) {
    const cx = s / 2;
    const R = s * 0.36;
    const segs = [
      [0, 1.5, CSS.teal],
      [1.5, 3.0, CSS.cyan],
      [3.0, 4.4, CSS.orange],
      [4.4, Math.PI * 2, CSS.cyanSoft],
    ];
    segs.forEach(([a0, a1, col]) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx, cx);
      ctx.arc(cx, cx, R, a0, a1);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = CSS.white;
    ctx.beginPath();
    ctx.arc(cx, cx, R * 0.42, 0, Math.PI * 2);
    ctx.fill();
  },

  bars(ctx, s) {
    const base = s * 0.74;
    const heights = [0.2, 0.34, 0.26, 0.46, 0.58];
    const cols = [CSS.cyanSoft, CSS.cyan, CSS.cyanSoft, CSS.teal, CSS.tealDeep];
    heights.forEach((hh, i) => {
      ctx.fillStyle = cols[i];
      const bw = s * 0.1;
      const x = s * 0.16 + i * s * 0.145;
      ctx.fillRect(x, base - s * hh, bw, s * hh);
    });
    // trend arrow
    ctx.strokeStyle = CSS.orange;
    ctx.lineWidth = s * 0.035;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.18, s * 0.5);
    ctx.lineTo(s * 0.4, s * 0.34);
    ctx.lineTo(s * 0.56, s * 0.42);
    ctx.lineTo(s * 0.8, s * 0.16);
    ctx.stroke();
  },

  line(ctx, s) {
    ctx.strokeStyle = CSS.cyanSoft;
    ctx.lineWidth = s * 0.012;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(s * 0.14, s * (0.2 + i * 0.16));
      ctx.lineTo(s * 0.86, s * (0.2 + i * 0.16));
      ctx.stroke();
    }
    ctx.strokeStyle = CSS.teal;
    ctx.lineWidth = s * 0.04;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.16, s * 0.66);
    ctx.lineTo(s * 0.34, s * 0.48);
    ctx.lineTo(s * 0.5, s * 0.56);
    ctx.lineTo(s * 0.68, s * 0.3);
    ctx.lineTo(s * 0.84, s * 0.22);
    ctx.stroke();
    ctx.fillStyle = CSS.orange;
    ctx.beginPath();
    ctx.arc(s * 0.84, s * 0.22, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
  },

  coin(ctx, s) {
    const cx = s / 2;
    ctx.fillStyle = CSS.amber;
    ctx.beginPath();
    ctx.arc(cx, cx, s * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CSS.gold;
    ctx.beginPath();
    ctx.arc(cx, cx, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CSS.orange;
    ctx.font = `700 ${s * 0.36}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₹', cx, cx + s * 0.02);
  },

  magnifier(ctx, s) {
    const cx = s * 0.44;
    ctx.strokeStyle = CSS.teal;
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.arc(cx, cx, s * 0.26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(69,190,222,0.28)';
    ctx.beginPath();
    ctx.arc(cx, cx, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = CSS.tealDeep;
    ctx.lineWidth = s * 0.075;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.19, cx + s * 0.19);
    ctx.lineTo(s * 0.86, s * 0.86);
    ctx.stroke();
    ctx.fillStyle = CSS.orange;
    ctx.font = `700 ${s * 0.24}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, cx);
  },

  shield(ctx, s) {
    ctx.fillStyle = CSS.teal;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.14);
    ctx.lineTo(s * 0.82, s * 0.28);
    ctx.lineTo(s * 0.82, s * 0.54);
    ctx.quadraticCurveTo(s * 0.82, s * 0.78, s * 0.5, s * 0.88);
    ctx.quadraticCurveTo(s * 0.18, s * 0.78, s * 0.18, s * 0.54);
    ctx.lineTo(s * 0.18, s * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = CSS.white;
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.35, s * 0.5);
    ctx.lineTo(s * 0.46, s * 0.62);
    ctx.lineTo(s * 0.68, s * 0.38);
    ctx.stroke();
  },

  mobile(ctx, s) {
    ctx.fillStyle = CSS.tealDeep;
    rr(ctx, s * 0.31, s * 0.13, s * 0.38, s * 0.74, s * 0.07);
    ctx.fill();
    ctx.fillStyle = CSS.paler;
    rr(ctx, s * 0.35, s * 0.2, s * 0.3, s * 0.58, s * 0.03);
    ctx.fill();
    ctx.fillStyle = CSS.cyan;
    ctx.fillRect(s * 0.39, s * 0.28, s * 0.22, s * 0.05);
    ctx.fillStyle = CSS.cyanSoft;
    ctx.fillRect(s * 0.39, s * 0.38, s * 0.16, s * 0.04);
    ctx.fillRect(s * 0.39, s * 0.46, s * 0.2, s * 0.04);
    ctx.fillStyle = CSS.orange;
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.63, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
  },
};

// =====================================================
// INVESTMENT ICON SET — two-tone blue, wall plaques
// =====================================================

const ID = '#12609f'; // deep blue
const IL = '#57a8e2'; // light blue

function iconCoin(ctx, cx, cy, r, col, symbol = '$') {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${r * 1.4}px "Outfit", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, cx, cy + r * 0.06);
}

function iconArrowUp(ctx, x, yTip, w, h, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, yTip);
  ctx.lineTo(x + w / 2, yTip + h * 0.42);
  ctx.lineTo(x + w * 0.19, yTip + h * 0.42);
  ctx.lineTo(x + w * 0.19, yTip + h);
  ctx.lineTo(x - w * 0.19, yTip + h);
  ctx.lineTo(x - w * 0.19, yTip + h * 0.42);
  ctx.lineTo(x - w / 2, yTip + h * 0.42);
  ctx.closePath();
  ctx.fill();
}

function iconPerson(ctx, cx, cy, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.4, s * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.44, cy + s * 0.48);
  ctx.quadraticCurveTo(cx - s * 0.44, cy - s * 0.04, cx, cy - s * 0.04);
  ctx.quadraticCurveTo(cx + s * 0.44, cy - s * 0.04, cx + s * 0.44, cy + s * 0.48);
  ctx.closePath();
  ctx.fill();
}

function iconBag(ctx, cx, cy, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.16, cy - s * 0.42);
  ctx.lineTo(cx + s * 0.16, cy - s * 0.42);
  ctx.lineTo(cx + s * 0.1, cy - s * 0.28);
  ctx.lineTo(cx - s * 0.1, cy - s * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.1, cy - s * 0.28);
  ctx.quadraticCurveTo(cx - s * 0.52, cy + s * 0.06, cx - s * 0.34, cy + s * 0.36);
  ctx.quadraticCurveTo(cx, cy + s * 0.56, cx + s * 0.34, cy + s * 0.36);
  ctx.quadraticCurveTo(cx + s * 0.52, cy + s * 0.06, cx + s * 0.1, cy - s * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${s * 0.3}px "Outfit", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', cx, cy + s * 0.12);
}

// each painter fills a square of side S
const INVEST_ICONS = {
  investor(ctx, S) {
    iconPerson(ctx, S * 0.4, S * 0.6, S * 0.52, IL);
    iconCoin(ctx, S * 0.74, S * 0.28, S * 0.19, ID);
  },

  portfolio(ctx, S) {
    ctx.fillStyle = ID;
    ctx.fillRect(S * 0.12, S * 0.36, S * 0.62, S * 0.44);
    ctx.fillRect(S * 0.3, S * 0.24, S * 0.26, S * 0.1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(S * 0.34, S * 0.27, S * 0.18, S * 0.05);
    // pie badge
    ctx.fillStyle = IL;
    ctx.beginPath();
    ctx.arc(S * 0.76, S * 0.3, S * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ID;
    ctx.beginPath();
    ctx.moveTo(S * 0.76, S * 0.3);
    ctx.arc(S * 0.76, S * 0.3, S * 0.2, -Math.PI / 2, 0.35);
    ctx.closePath();
    ctx.fill();
  },

  asset(ctx, S) {
    iconCoin(ctx, S * 0.5, S * 0.34, S * 0.19, IL);
    const hand = (flip) => {
      ctx.save();
      if (flip) {
        ctx.translate(S, 0);
        ctx.scale(-1, 1);
      }
      ctx.fillStyle = ID;
      ctx.beginPath();
      ctx.moveTo(S * 0.1, S * 0.56);
      ctx.quadraticCurveTo(S * 0.12, S * 0.84, S * 0.46, S * 0.84);
      ctx.lineTo(S * 0.46, S * 0.7);
      ctx.quadraticCurveTo(S * 0.28, S * 0.7, S * 0.25, S * 0.56);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    hand(false);
    hand(true);
  },

  dividend(ctx, S) {
    iconCoin(ctx, S * 0.5, S * 0.3, S * 0.18, ID);
    iconPerson(ctx, S * 0.22, S * 0.72, S * 0.34, IL);
    iconPerson(ctx, S * 0.5, S * 0.76, S * 0.34, IL);
    iconPerson(ctx, S * 0.78, S * 0.72, S * 0.34, IL);
  },

  investment(ctx, S) {
    // hand
    ctx.fillStyle = ID;
    ctx.beginPath();
    ctx.moveTo(S * 0.14, S * 0.66);
    ctx.quadraticCurveTo(S * 0.16, S * 0.9, S * 0.5, S * 0.9);
    ctx.quadraticCurveTo(S * 0.84, S * 0.9, S * 0.86, S * 0.66);
    ctx.lineTo(S * 0.72, S * 0.66);
    ctx.quadraticCurveTo(S * 0.7, S * 0.78, S * 0.5, S * 0.78);
    ctx.quadraticCurveTo(S * 0.3, S * 0.78, S * 0.28, S * 0.66);
    ctx.closePath();
    ctx.fill();
    // leaves
    ctx.fillStyle = IL;
    [-1, 1].forEach((d) => {
      ctx.beginPath();
      ctx.ellipse(S * (0.5 + d * 0.16), S * 0.56, S * 0.15, S * 0.08, d * 0.5, 0, Math.PI * 2);
      ctx.fill();
    });
    iconCoin(ctx, S * 0.5, S * 0.28, S * 0.17, ID);
  },

  volatility(ctx, S) {
    ctx.strokeStyle = IL;
    ctx.lineWidth = S * 0.035;
    ctx.beginPath();
    ctx.moveTo(S * 0.14, S * 0.16);
    ctx.lineTo(S * 0.14, S * 0.82);
    ctx.lineTo(S * 0.88, S * 0.82);
    ctx.stroke();
    ctx.strokeStyle = ID;
    ctx.lineWidth = S * 0.05;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(S * 0.2, S * 0.6);
    ctx.lineTo(S * 0.34, S * 0.34);
    ctx.lineTo(S * 0.46, S * 0.62);
    ctx.lineTo(S * 0.6, S * 0.3);
    ctx.lineTo(S * 0.74, S * 0.56);
    ctx.stroke();
    iconArrowUp(ctx, S * 0.86, S * 0.2, S * 0.16, S * 0.28, IL);
  },

  stock(ctx, S) {
    const base = S * 0.82;
    [0.24, 0.36, 0.3, 0.5].forEach((hh, i) => {
      ctx.fillStyle = IL;
      ctx.fillRect(S * (0.16 + i * 0.18), base - S * hh, S * 0.12, S * hh);
    });
    ctx.strokeStyle = ID;
    ctx.lineWidth = S * 0.04;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(S * 0.18, S * 0.44);
    ctx.lineTo(S * 0.38, S * 0.3);
    ctx.lineTo(S * 0.56, S * 0.38);
    ctx.lineTo(S * 0.8, S * 0.16);
    ctx.stroke();
    [[0.18, 0.44], [0.38, 0.3], [0.56, 0.38], [0.8, 0.16]].forEach(([x, y]) => {
      ctx.fillStyle = ID;
      ctx.beginPath();
      ctx.arc(S * x, S * y, S * 0.045, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  risk(ctx, S) {
    ctx.fillStyle = ID;
    ctx.beginPath();
    ctx.arc(S * 0.5, S * 0.54, S * 0.36, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = IL;
    ctx.beginPath();
    ctx.arc(S * 0.5, S * 0.54, S * 0.36, Math.PI, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ID;
    ctx.lineWidth = S * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(S * 0.5, S * 0.54);
    ctx.lineTo(S * 0.5, S * 0.82);
    ctx.stroke();
    // warning badge
    ctx.fillStyle = IL;
    ctx.beginPath();
    ctx.moveTo(S * 0.78, S * 0.6);
    ctx.lineTo(S * 0.95, S * 0.9);
    ctx.lineTo(S * 0.61, S * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${S * 0.16}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', S * 0.78, S * 0.81);
  },

  yield(ctx, S) {
    const base = S * 0.84;
    [0.2, 0.34, 0.5].forEach((hh, i) => {
      ctx.fillStyle = IL;
      ctx.fillRect(S * (0.14 + i * 0.2), base - S * hh, S * 0.14, S * hh);
    });
    ctx.strokeStyle = ID;
    ctx.lineWidth = S * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(S * 0.2, S * 0.5);
    ctx.lineTo(S * 0.62, S * 0.22);
    ctx.stroke();
    iconCoin(ctx, S * 0.76, S * 0.28, S * 0.18, ID);
  },

  cashflow(ctx, S) {
    ctx.strokeStyle = IL;
    ctx.lineWidth = S * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(S * 0.5, S * 0.5, S * 0.34, 0.4, Math.PI * 1.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(S * 0.5, S * 0.5, S * 0.34, Math.PI * 1.45, Math.PI * 2.3);
    ctx.stroke();
    ctx.fillStyle = IL;
    ctx.beginPath();
    ctx.moveTo(S * 0.5, S * 0.06);
    ctx.lineTo(S * 0.34, S * 0.2);
    ctx.lineTo(S * 0.5, S * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(S * 0.5, S * 0.94);
    ctx.lineTo(S * 0.66, S * 0.8);
    ctx.lineTo(S * 0.5, S * 0.72);
    ctx.closePath();
    ctx.fill();
    iconCoin(ctx, S * 0.5, S * 0.5, S * 0.19, ID);
  },

  gain(ctx, S) {
    iconBag(ctx, S * 0.42, S * 0.58, S * 0.78, ID);
    iconArrowUp(ctx, S * 0.82, S * 0.14, S * 0.24, S * 0.4, IL);
  },

  analysis(ctx, S) {
    ctx.strokeStyle = ID;
    ctx.lineWidth = S * 0.07;
    ctx.beginPath();
    ctx.arc(S * 0.44, S * 0.42, S * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(S * 0.44, S * 0.42, S * 0.25, 0, Math.PI * 2);
    ctx.fill();
    const base = S * 0.56;
    [0.1, 0.18, 0.26].forEach((hh, i) => {
      ctx.fillStyle = IL;
      ctx.fillRect(S * (0.3 + i * 0.1), base - S * hh, S * 0.07, S * hh);
    });
    ctx.strokeStyle = ID;
    ctx.lineWidth = S * 0.09;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(S * 0.64, S * 0.62);
    ctx.lineTo(S * 0.86, S * 0.86);
    ctx.stroke();
  },
};

const INVEST_LIST = [
  ['investor', 'INVESTOR'],
  ['portfolio', 'PORTFOLIO'],
  ['asset', 'ASSET'],
  ['dividend', 'DIVIDEND'],
  ['investment', 'INVESTMENT'],
  ['volatility', 'VOLATILITY'],
  ['stock', 'STOCK'],
  ['risk', 'RISK MANAGEMENT'],
  ['yield', 'YIELD'],
  ['cashflow', 'CASHFLOW'],
  ['gain', 'FINANCIAL GAIN'],
  ['analysis', 'ANALYSIS'],
];

// icon painted straight onto the wall — no card, no frame, no caption
function plaqueTexture(kind) {
  return makeTexture(360, 360, (ctx, w) => {
    ctx.clearRect(0, 0, w, w);
    INVEST_ICONS[kind](ctx, w);
  });
}

// =====================================================
// WALL ART — framed posters (used beside the stations)
// =====================================================

function posterTexture(kind, portrait) {
  const w = portrait ? 420 : 560;
  const h = portrait ? 540 : 420;
  return makeTexture(w, h, (ctx) => {
    // frame
    ctx.fillStyle = CSS.white;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(15,109,140,0.18)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    // mat
    const m = 26;
    ctx.fillStyle = CSS.paler;
    ctx.fillRect(m, m, w - m * 2, h - m * 2);
    // icon
    const s = Math.min(w, h) - m * 2 - 30;
    ctx.save();
    ctx.translate((w - s) / 2, (h - s) / 2);
    ICONS[kind](ctx, s);
    ctx.restore();
  });
}

// Background wall drawings. These are placed one per slot alongside the
// icons (never underneath them), so nothing ever overlaps.

const MOTIF_TINT = 'rgba(78,171,208,0.40)';
const MOTIF_SOFT = 'rgba(78,171,208,0.26)';

const MOTIFS = {
  rupee(ctx, S) {
    ctx.strokeStyle = MOTIF_TINT;
    ctx.lineWidth = S * 0.03;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = MOTIF_TINT;
    ctx.font = `700 ${S * 0.46}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₹', S / 2, S / 2 + S * 0.02);
  },

  arcs(ctx, S) {
    ctx.strokeStyle = MOTIF_SOFT;
    ctx.lineWidth = S * 0.035;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.8, i * S * 0.16, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
  },

  bars(ctx, S) {
    ctx.fillStyle = MOTIF_SOFT;
    [0.28, 0.46, 0.34, 0.6, 0.74].forEach((hh, i) => {
      ctx.fillRect(S * (0.1 + i * 0.17), S * 0.86 - S * hh, S * 0.1, S * hh);
    });
  },

  trend(ctx, S) {
    ctx.strokeStyle = MOTIF_TINT;
    ctx.lineWidth = S * 0.045;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(S * 0.1, S * 0.72);
    ctx.lineTo(S * 0.34, S * 0.42);
    ctx.lineTo(S * 0.52, S * 0.58);
    ctx.lineTo(S * 0.9, S * 0.18);
    ctx.stroke();
  },

  dots(ctx, S) {
    ctx.fillStyle = MOTIF_SOFT;
    for (let x = 0; x < 6; x++) {
      for (let y = 0; y < 6; y++) {
        ctx.beginPath();
        ctx.arc(S * (0.16 + x * 0.14), S * (0.16 + y * 0.14), S * 0.024, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  ring(ctx, S) {
    ctx.strokeStyle = MOTIF_SOFT;
    ctx.lineWidth = S * 0.05;
    for (let i = 2; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(S * 0.5, S * 0.5, i * S * 0.1, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  donut(ctx, S) {
    ctx.strokeStyle = MOTIF_TINT;
    ctx.lineWidth = S * 0.14;
    ctx.beginPath();
    ctx.arc(S * 0.5, S * 0.5, S * 0.3, -Math.PI / 2, Math.PI * 0.9);
    ctx.stroke();
    ctx.strokeStyle = MOTIF_SOFT;
    ctx.beginPath();
    ctx.arc(S * 0.5, S * 0.5, S * 0.3, Math.PI * 0.9, Math.PI * 1.5);
    ctx.stroke();
  },

  wave(ctx, S) {
    ctx.strokeStyle = MOTIF_SOFT;
    ctx.lineWidth = S * 0.038;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const x = S * (0.06 + (i / 40) * 0.88);
        const y = S * (0.34 + k * 0.16) + Math.sin(i / 5 + k) * S * 0.05;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
};

const MOTIF_ORDER = ['rupee', 'bars', 'arcs', 'trend', 'ring', 'donut', 'dots', 'wave'];
const motifCache = {};
function motifTexture(kind) {
  if (!motifCache[kind]) {
    motifCache[kind] = makeTexture(512, 512, (ctx, w) => {
      ctx.clearRect(0, 0, w, w);
      MOTIFS[kind](ctx, w);
    });
  }
  return motifCache[kind];
}

// =====================================================
// ROOM SHELL
// =====================================================

const room = new THREE.Group();
scene.add(room);

// The room shell is deliberately unlit (MeshBasicMaterial) so the walls,
// floor and ceiling hold their exact flat colours — the look of the
// isometric poster art. Only the objects in the room take shading.

// floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(HALF_W * 2, ROOM_LEN),
  new THREE.MeshBasicMaterial({ color: C.floor })
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, FLOOR_Y, ROOM_MID_Z);
room.add(floor);

// floor grid
const grid = new THREE.GridHelper(ROOM_LEN, ROOM_LEN / 2, C.floorLine, C.floorLine);
grid.position.set(0, FLOOR_Y + 0.012, ROOM_MID_Z);
grid.material.transparent = true;
grid.material.opacity = 0.34;
room.add(grid);

// central runner
const runner = new THREE.Mesh(
  new THREE.PlaneGeometry(7.5, ROOM_LEN - 6),
  new THREE.MeshBasicMaterial({ color: C.runner })
);
runner.rotation.x = -Math.PI / 2;
runner.position.set(0, FLOOR_Y + 0.02, ROOM_MID_Z);
room.add(runner);

// ceiling
const ceiling = new THREE.Mesh(
  new THREE.PlaneGeometry(HALF_W * 2, ROOM_LEN),
  new THREE.MeshBasicMaterial({ color: C.ceiling })
);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.set(0, CEIL_Y, ROOM_MID_Z);
room.add(ceiling);

// side walls (mural)
const wallGeo = new THREE.PlaneGeometry(ROOM_LEN, CEIL_Y - FLOOR_Y);
const wallMat = new THREE.MeshBasicMaterial({ color: C.wall });

const leftWall = new THREE.Mesh(wallGeo, wallMat);
leftWall.rotation.y = Math.PI / 2;
leftWall.position.set(-HALF_W, (CEIL_Y + FLOOR_Y) / 2, ROOM_MID_Z);
room.add(leftWall);

const rightWall = new THREE.Mesh(wallGeo, wallMat);
rightWall.rotation.y = -Math.PI / 2;
rightWall.position.set(HALF_W, (CEIL_Y + FLOOR_Y) / 2, ROOM_MID_Z);
room.add(rightWall);

// baseboards — a dark blue line running the length of the room
const baseGeo = new THREE.BoxGeometry(0.3, 0.85, ROOM_LEN);
const baseMat = new THREE.MeshBasicMaterial({ color: C.navy2 });
[-HALF_W + 0.15, HALF_W - 0.15].forEach((x) => {
  const b = new THREE.Mesh(baseGeo, baseMat);
  b.position.set(x, FLOOR_Y + 0.425, ROOM_MID_Z);
  room.add(b);
});

// end wall — soft rings, then the Finlabs logo mounted on a white board
const backTex = makeTexture(1024, 512, (ctx, w, h) => {
  ctx.fillStyle = CSS.pale;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120,196,224,0.32)';
  ctx.lineWidth = 16;
  for (let i = 1; i <= 5; i++) {
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.5, i * 64, 0, Math.PI * 2);
    ctx.stroke();
  }
});

const backWall = new THREE.Mesh(
  new THREE.PlaneGeometry(HALF_W * 2, CEIL_Y - FLOOR_Y),
  new THREE.MeshBasicMaterial({ map: backTex })
);
backWall.position.set(0, (CEIL_Y + FLOOR_Y) / 2, BACK_Z);
room.add(backWall);

// the end wall carries a large drawing rather than the logo — the logo
// now lives in the page's top-left corner
const endMotif = new THREE.Mesh(
  new THREE.PlaneGeometry(8.5, 8.5),
  new THREE.MeshBasicMaterial({
    map: motifTexture('rupee'),
    transparent: true,
    depthWrite: false,
  })
);
endMotif.position.set(0, 2, BACK_Z + 0.1);
room.add(endMotif);

// ceiling light panels
const panelGeo = new THREE.PlaneGeometry(4.6, 1.1);
const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
for (let z = 12; z > BACK_Z + 6; z -= 9) {
  const p = new THREE.Mesh(panelGeo, panelMat);
  p.rotation.x = Math.PI / 2;
  p.position.set(0, CEIL_Y - 0.03, z);
  room.add(p);
}

// =====================================================
// WALL DECOR — framed posters + turning gears
// =====================================================

const posterCache = {};
function getPoster(kind, portrait) {
  const key = kind + (portrait ? 'P' : 'L');
  if (!posterCache[key]) posterCache[key] = posterTexture(kind, portrait);
  return posterCache[key];
}

function gearGeometry(radius, teeth, depth) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / (teeth * 2);
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.82;
    const a = i * step;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius * 0.34, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.05,
    bevelThickness: 0.05,
    bevelSegments: 2,
    curveSegments: 20,
  });
}

const gears = [];

// -----------------------------------------------------
// WALL LAYOUT
// -----------------------------------------------------
// Each wall is divided into evenly spaced slots along its length, and a
// slot holds exactly ONE kind of thing — icons, a background drawing, or
// a gear. An icon can therefore never land on top of a drawing. Every
// slot is filled, so no stretch of wall is left blank.

const SLOT_START = 2;
const SLOT_GAP = 6;
const ICON_SIZE = 2.4;
const MOTIF_SIZE = 5.2;

// i = icon pair, m = background drawing, g = gear
const WALL_PLAN = {
  '-1': ['i', 'm', 'i', 'i', 'm', 'g', 'i', 'm', 'i', 'i', 'm', 'i'],
  '1': ['m', 'i', 'i', 'm', 'i', 'i', 'g', 'm', 'i', 'm', 'i', 'i'],
};

const iconGeo = new THREE.PlaneGeometry(ICON_SIZE, ICON_SIZE);
const motifGeo = new THREE.PlaneGeometry(MOTIF_SIZE, MOTIF_SIZE);

let iconCursor = 0;
let motifCursor = 0;
let gearCursor = 0;

[-1, 1].forEach((side) => {
  const plan = WALL_PLAN[String(side)];
  const faceY = side < 0 ? Math.PI / 2 : -Math.PI / 2;

  plan.forEach((item, slot) => {
    const z = SLOT_START - slot * SLOT_GAP;
    if (z < BACK_Z + 4) return;

    if (item === 'i') {
      // two icons stacked; the 2.4-tall planes clear each other and
      // nothing else shares this slot
      [1.85, 5.0].forEach((y) => {
        const [kind] = INVEST_LIST[iconCursor % INVEST_LIST.length];
        iconCursor++;
        const icon = new THREE.Mesh(
          iconGeo,
          new THREE.MeshBasicMaterial({
            map: plaqueTexture(kind),
            transparent: true,
            opacity: 0.95,
          })
        );
        icon.position.set(side * (HALF_W - 0.06), y, z);
        icon.rotation.y = faceY;
        room.add(icon);
      });
      return;
    }

    if (item === 'm') {
      const kind = MOTIF_ORDER[motifCursor % MOTIF_ORDER.length];
      motifCursor++;
      const motif = new THREE.Mesh(
        motifGeo,
        new THREE.MeshBasicMaterial({
          map: motifTexture(kind),
          transparent: true,
          depthWrite: false,
        })
      );
      motif.position.set(side * (HALF_W - 0.04), 3.4, z);
      motif.rotation.y = faceY;
      room.add(motif);
      return;
    }

    // gear
    const spec = [
      { r: 2.2, teeth: 12, col: C.cyanSoft },
      { r: 2.1, teeth: 13, col: C.cyan },
    ][gearCursor % 2];
    const holder = new THREE.Group();
    holder.rotation.y = faceY;
    holder.position.set(side * (HALF_W - 0.25), 3.2, z);
    const mesh = new THREE.Mesh(
      gearGeometry(spec.r, spec.teeth, 0.42),
      new THREE.MeshLambertMaterial({ color: spec.col })
    );
    holder.add(mesh);
    room.add(holder);
    gears.push({ mesh, speed: gearCursor % 2 === 0 ? 0.12 : -0.1 });
    gearCursor++;
  });
});

// =====================================================
// PRODUCT SCREEN ARTWORK
// =====================================================

function screenTexture(product) {
  return makeTexture(1024, 680, (ctx, w, h) => {
    // page
    ctx.fillStyle = CSS.white;
    ctx.fillRect(0, 0, w, h);

    // header
    ctx.fillStyle = CSS.navy;
    ctx.fillRect(0, 0, w, 88);
    ctx.fillStyle = CSS.white;
    ctx.font = '700 40px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(product.name, 40, 46);

    const accent = '#' + product.accent.toString(16).padStart(6, '0');
    ctx.fillStyle = accent;
    ctx.fillRect(w - 132, 34, 92, 22);

    const body = { x: 40, y: 124, w: w - 80, h: h - 168 };
    SCREENS[product.screen](ctx, body, accent);

    // footer strip
    ctx.fillStyle = CSS.paler;
    ctx.fillRect(0, h - 44, w, 44);
    ctx.fillStyle = CSS.slate;
    ctx.font = '500 22px "JetBrains Mono", monospace';
    ctx.fillText('FINLABS INDIA', 40, h - 21);
  });
}

function donut(ctx, cx, cy, r, segs) {
  let a = -Math.PI / 2;
  segs.forEach(([frac, col]) => {
    const a1 = a + frac * Math.PI * 2;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a, a1);
    ctx.closePath();
    ctx.fill();
    a = a1;
  });
  ctx.fillStyle = CSS.white;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.56, 0, Math.PI * 2);
  ctx.fill();
}

function label(ctx, text, x, y, size = 20, col = CSS.slate) {
  ctx.fillStyle = col;
  ctx.font = `500 ${size}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

const SCREENS = {
  // Finexa — advisory dashboard
  wealth(ctx, b, accent) {
    label(ctx, 'CLIENT LIFECYCLE DASHBOARD', b.x, b.y - 12, 22, CSS.tealDeep);

    ctx.fillStyle = CSS.paler;
    rr(ctx, b.x, b.y + 12, 300, 250, 16);
    ctx.fill();
    donut(ctx, b.x + 150, b.y + 137, 92, [
      [0.38, CSS.teal],
      [0.26, CSS.cyan],
      [0.2, CSS.orange],
      [0.16, CSS.cyanSoft],
    ]);
    label(ctx, 'AUM MIX', b.x + 22, b.y + 40, 18);

    // area chart
    const cx = b.x + 336;
    const cw = b.w - 336;
    ctx.fillStyle = CSS.paler;
    rr(ctx, cx, b.y + 12, cw, 250, 16);
    ctx.fill();
    label(ctx, 'PORTFOLIO GROWTH', cx + 22, b.y + 40, 18);

    const pts = [0.34, 0.44, 0.38, 0.56, 0.5, 0.72, 0.86];
    const gx = cx + 26;
    const gw = cw - 52;
    const gy = b.y + 240;
    const gh = 150;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    pts.forEach((p, i) => ctx.lineTo(gx + (i / (pts.length - 1)) * gw, gy - p * gh));
    ctx.lineTo(gx + gw, gy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(26,143,181,0.18)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = gx + (i / (pts.length - 1)) * gw;
      const y = gy - p * gh;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // client rows
    ['ONBOARDING', 'REVIEWS DUE', 'SIP BOOK'].forEach((t, i) => {
      const y = b.y + 292 + i * 54;
      ctx.fillStyle = CSS.paler;
      rr(ctx, b.x, y, b.w, 42, 10);
      ctx.fill();
      label(ctx, t, b.x + 20, y + 21, 18, CSS.ink);
      ctx.fillStyle = [CSS.teal, CSS.cyan, CSS.orange][i];
      rr(ctx, b.x + 260, y + 13, [300, 210, 380][i], 16, 8);
      ctx.fill();
    });
  },

  // GenNxT — multi-asset aggregation
  aggregate(ctx, b, accent) {
    label(ctx, 'ALL ASSETS · ONE VIEW', b.x, b.y - 12, 22, CSS.tealDeep);

    const tiles = [
      ['EQUITY', CSS.teal],
      ['DEBT', CSS.cyan],
      ['GOLD', CSS.amber],
      ['CASH', CSS.cyanSoft],
    ];
    tiles.forEach(([t, col], i) => {
      const x = b.x + i * ((b.w + 16) / 4);
      const tw = (b.w + 16) / 4 - 16;
      ctx.fillStyle = CSS.paler;
      rr(ctx, x, b.y + 12, tw, 110, 14);
      ctx.fill();
      ctx.fillStyle = col;
      rr(ctx, x + 18, b.y + 30, 40, 40, 10);
      ctx.fill();
      label(ctx, t, x + 18, b.y + 95, 18, CSS.ink);
    });

    // stacked bars
    ctx.fillStyle = CSS.paler;
    rr(ctx, b.x, b.y + 146, b.w - 260, 240, 16);
    ctx.fill();
    label(ctx, 'MULTI-ASSET REPORTING', b.x + 22, b.y + 174, 18);

    const stacks = [
      [70, 46, 30],
      [96, 40, 44],
      [64, 70, 34],
      [110, 52, 26],
      [88, 60, 52],
      [130, 44, 38],
    ];
    stacks.forEach((st, i) => {
      let base = b.y + 366;
      const x = b.x + 34 + i * 74;
      [CSS.teal, CSS.cyan, CSS.amber].forEach((col, k) => {
        ctx.fillStyle = col;
        ctx.fillRect(x, base - st[k], 44, st[k]);
        base -= st[k];
      });
    });

    // donut + security badge
    const px = b.x + b.w - 240;
    ctx.fillStyle = CSS.paler;
    rr(ctx, px, b.y + 146, 240, 240, 16);
    ctx.fill();
    donut(ctx, px + 120, b.y + 240, 74, [
      [0.42, accent],
      [0.28, CSS.teal],
      [0.18, CSS.amber],
      [0.12, CSS.cyanSoft],
    ]);
    label(ctx, 'ENTERPRISE-GRADE', px + 26, b.y + 350, 17, CSS.tealDeep);
  },

  // Finaware — investor awareness programmes
  awareness(ctx, b, accent) {
    label(ctx, 'INVESTOR AWARENESS PROGRAMS', b.x, b.y - 12, 22, CSS.tealDeep);

    // calendar
    ctx.fillStyle = CSS.paler;
    rr(ctx, b.x, b.y + 12, 380, 260, 16);
    ctx.fill();
    label(ctx, 'PROGRAMME CALENDAR', b.x + 22, b.y + 40, 18);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 7; c++) {
        const on = (r * 7 + c) % 5 === 0;
        ctx.fillStyle = on ? accent : CSS.white;
        rr(ctx, b.x + 24 + c * 48, b.y + 64 + r * 48, 38, 38, 8);
        ctx.fill();
      }
    }

    // reach stats
    const sx = b.x + 412;
    const sw = b.w - 412;
    [
      ['PROGRAMMES', '1 2 4', CSS.teal],
      ['ATTENDEES', '8 6 K', CSS.cyan],
      ['COMPLIANCE', '1 0 0 %', CSS.orange],
    ].forEach(([t, v, col], i) => {
      const y = b.y + 12 + i * 92;
      ctx.fillStyle = CSS.paler;
      rr(ctx, sx, y, sw, 76, 14);
      ctx.fill();
      ctx.fillStyle = col;
      rr(ctx, sx, y, 8, 76, 4);
      ctx.fill();
      label(ctx, t, sx + 26, y + 26, 17);
      ctx.fillStyle = CSS.navy;
      ctx.font = '700 30px "Outfit", sans-serif';
      ctx.fillText(v, sx + 26, y + 54);
    });

    // audience dots
    ctx.fillStyle = CSS.paler;
    rr(ctx, b.x, b.y + 296, b.w, 90, 14);
    ctx.fill();
    label(ctx, 'DIGITAL + OFFLINE REACH', b.x + 22, b.y + 322, 17);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = i < 18 ? CSS.teal : CSS.cyanSoft;
      ctx.beginPath();
      ctx.arc(b.x + 30 + i * 34, b.y + 358, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Fiscus — personal finance manager
  finance(ctx, b, accent) {
    label(ctx, 'ACCOUNTS · CARDS · E-WALLETS', b.x, b.y - 12, 22, CSS.tealDeep);

    // cards
    ctx.save();
    ctx.translate(b.x + 40, b.y + 40);
    ctx.rotate(-0.06);
    ctx.fillStyle = CSS.cyan;
    rr(ctx, 0, 0, 300, 186, 20);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    rr(ctx, 26, 46, 54, 40, 8);
    ctx.fill();
    ctx.fillStyle = CSS.white;
    ctx.font = '600 24px "JetBrains Mono", monospace';
    ctx.fillText('•••• 4416', 26, 140);
    ctx.restore();

    ctx.save();
    ctx.translate(b.x + 168, b.y + 116);
    ctx.rotate(0.05);
    ctx.fillStyle = accent;
    rr(ctx, 0, 0, 300, 186, 20);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    rr(ctx, 26, 46, 54, 40, 8);
    ctx.fill();
    ctx.fillStyle = CSS.white;
    ctx.font = '600 24px "JetBrains Mono", monospace';
    ctx.fillText('•••• 9028', 26, 140);
    ctx.restore();

    // account list
    const lx = b.x + 512;
    const lw = b.w - 512;
    label(ctx, 'LINKED · NO PASSWORDS SHARED', lx, b.y + 24, 17, CSS.orange);
    ['SAVINGS', 'CURRENT', 'CREDIT CARD', 'E-WALLET'].forEach((t, i) => {
      const y = b.y + 48 + i * 74;
      ctx.fillStyle = CSS.paler;
      rr(ctx, lx, y, lw, 60, 12);
      ctx.fill();
      ctx.fillStyle = [CSS.teal, CSS.cyan, CSS.orange, CSS.amber][i];
      rr(ctx, lx + 16, y + 14, 32, 32, 8);
      ctx.fill();
      label(ctx, t, lx + 62, y + 30, 18, CSS.ink);
    });

    // balance
    ctx.fillStyle = CSS.paler;
    rr(ctx, b.x, b.y + 322, 470, 64, 14);
    ctx.fill();
    label(ctx, 'TRACKED LIVE', b.x + 20, b.y + 340, 16);
    ctx.fillStyle = CSS.navy;
    ctx.font = '700 30px "Outfit", sans-serif';
    ctx.fillText('ALL ACCOUNTS · ONE PLACE', b.x + 20, b.y + 370);
  },

  // Learngenie — L&D mobile app
  learning(ctx, b, accent) {
    label(ctx, 'GAMIFIED LEARNING · WHITE-LABELLED', b.x, b.y - 12, 22, CSS.tealDeep);

    // phone
    ctx.fillStyle = CSS.navy;
    rr(ctx, b.x + 20, b.y + 12, 200, 372, 26);
    ctx.fill();
    ctx.fillStyle = CSS.white;
    rr(ctx, b.x + 32, b.y + 34, 176, 328, 16);
    ctx.fill();
    ctx.fillStyle = accent;
    rr(ctx, b.x + 48, b.y + 52, 144, 46, 10);
    ctx.fill();
    ['MODULE 01', 'MODULE 02', 'MODULE 03', 'MODULE 04'].forEach((t, i) => {
      ctx.fillStyle = CSS.paler;
      rr(ctx, b.x + 48, b.y + 116 + i * 56, 144, 44, 10);
      ctx.fill();
      ctx.fillStyle = i < 2 ? CSS.teal : CSS.cyanSoft;
      ctx.beginPath();
      ctx.arc(b.x + 70, b.y + 138 + i * 56, 11, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, t, b.x + 88, b.y + 138 + i * 56, 15, CSS.ink);
    });

    // progress ring
    const rx = b.x + 350;
    ctx.fillStyle = CSS.paler;
    rr(ctx, b.x + 254, b.y + 12, 250, 250, 16);
    ctx.fill();
    ctx.strokeStyle = CSS.pale;
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(rx + 28, b.y + 137, 78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(rx + 28, b.y + 137, 78, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.42);
    ctx.stroke();
    ctx.fillStyle = CSS.navy;
    ctx.font = '700 44px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('71%', rx + 28, b.y + 150);
    ctx.textAlign = 'left';

    // badges
    const bx = b.x + 528;
    label(ctx, 'ACHIEVEMENTS', bx, b.y + 30, 17);
    [CSS.amber, CSS.teal, CSS.orange, CSS.cyan].forEach((col, i) => {
      const x = bx + (i % 2) * 96;
      const y = b.y + 56 + Math.floor(i / 2) * 96;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + 36, y + 36, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CSS.white;
      ctx.font = '700 30px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', x + 36, y + 48);
      ctx.textAlign = 'left';
    });

    // hr integration bar
    ctx.fillStyle = CSS.paler;
    rr(ctx, b.x + 254, b.y + 288, b.w - 254, 96, 14);
    ctx.fill();
    label(ctx, 'HR INTEGRATION · EMPLOYEES · PARTNERS · CHANNELS', b.x + 276, b.y + 336, 18, CSS.ink);
  },
};

// =====================================================
// DESK PROPS
// =====================================================

const goldMat = new THREE.MeshLambertMaterial({ color: C.gold });
const goldDeepMat = new THREE.MeshLambertMaterial({ color: C.goldDeep });
const whiteMat = new THREE.MeshLambertMaterial({ color: C.white });

function propGoldBars() {
  const g = new THREE.Group();
  const bar = new THREE.BoxGeometry(1.05, 0.34, 0.55);
  const rows = [
    [-1.1, 0, 1.1],
    [-0.55, 0.55],
    [0],
  ];
  rows.forEach((row, r) => {
    row.forEach((x) => {
      const m = new THREE.Mesh(bar, r === 2 ? goldDeepMat : goldMat);
      m.position.set(x, 0.17 + r * 0.36, 0);
      m.rotation.y = 0.06 * x;
      g.add(m);
    });
  });
  return g;
}

function propCoins() {
  const g = new THREE.Group();
  const coin = new THREE.CylinderGeometry(0.42, 0.42, 0.09, 26);
  [
    [-0.9, 5],
    [0, 8],
    [0.9, 3],
  ].forEach(([x, n]) => {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(coin, i % 2 ? goldMat : goldDeepMat);
      m.position.set(x, 0.05 + i * 0.095, 0);
      g.add(m);
    }
  });
  return g;
}

function propCalculator() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.22, 2.1),
    new THREE.MeshLambertMaterial({ color: C.orange })
  );
  body.position.y = 0.11;
  g.add(body);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.42), whiteMat);
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, 0.23, -0.62);
  g.add(screen);

  const keyGeo = new THREE.BoxGeometry(0.22, 0.06, 0.22);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const k = new THREE.Mesh(keyGeo, whiteMat);
      k.position.set(-0.45 + c * 0.3, 0.24, -0.15 + r * 0.32);
      g.add(k);
    }
  }
  g.rotation.y = -0.4;
  return g;
}

function propCards() {
  const g = new THREE.Group();
  const card = new THREE.BoxGeometry(1.5, 0.06, 0.95);
  const cols = [C.cyan, C.tealDeep, C.orange];
  cols.forEach((col, i) => {
    const m = new THREE.Mesh(card, new THREE.MeshLambertMaterial({ color: col }));
    m.position.set(i * 0.24, 0.04 + i * 0.08, i * 0.16);
    m.rotation.y = -0.2 + i * 0.16;
    g.add(m);
  });
  return g;
}

function propCoffee() {
  const g = new THREE.Group();
  const cupMat = new THREE.MeshLambertMaterial({ color: C.orange });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.5, 24), cupMat);
  cup.position.y = 0.25;
  g.add(cup);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.055, 10, 22), cupMat);
  handle.position.set(0.46, 0.28, 0);
  handle.rotation.y = Math.PI / 2;
  g.add(handle);

  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.07, 26), whiteMat);
  saucer.position.y = 0.035;
  g.add(saucer);

  const brew = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.02, 24),
    new THREE.MeshLambertMaterial({ color: 0x8c4a1e })
  );
  brew.position.y = 0.5;
  g.add(brew);
  return g;
}

const PROP_BUILDERS = {
  goldbars: propGoldBars,
  coins: propCoins,
  calculator: propCalculator,
  cards: propCards,
  coffee: propCoffee,
};

// =====================================================
// PRODUCT STATIONS
// =====================================================

const stations = [];

const monitorFrameGeo = new THREE.BoxGeometry(6.6, 4.6, 0.36);
const monitorScreenGeo = new THREE.PlaneGeometry(6.05, 4.05);
const neckGeo = new THREE.BoxGeometry(0.5, 1.5, 0.4);
const footGeo = new THREE.BoxGeometry(2.6, 0.24, 1.3);
const podiumGeo = new THREE.BoxGeometry(4.4, 1.0, 2.4);

PRODUCTS.forEach((product, i) => {
  const g = new THREE.Group();
  const accentMat = new THREE.MeshLambertMaterial({ color: product.accent });

  // podium
  const podium = new THREE.Mesh(
    podiumGeo,
    new THREE.MeshLambertMaterial({ color: C.white })
  );
  podium.position.y = FLOOR_Y + 0.5;
  g.add(podium);

  const podiumBand = new THREE.Mesh(
    new THREE.BoxGeometry(4.44, 0.16, 2.44),
    accentMat
  );
  podiumBand.position.y = FLOOR_Y + 0.08;
  g.add(podiumBand);

  // stand
  const foot = new THREE.Mesh(footGeo, new THREE.MeshLambertMaterial({ color: C.cyanSoft }));
  foot.position.y = FLOOR_Y + 1.12;
  g.add(foot);

  const neck = new THREE.Mesh(neckGeo, new THREE.MeshLambertMaterial({ color: C.cyanSoft }));
  neck.position.y = FLOOR_Y + 1.98;
  g.add(neck);

  // monitor
  const frame = new THREE.Mesh(monitorFrameGeo, accentMat);
  frame.position.y = FLOOR_Y + 5.0;
  g.add(frame);

  const screen = new THREE.Mesh(
    monitorScreenGeo,
    new THREE.MeshBasicMaterial({ map: screenTexture(product) })
  );
  screen.position.set(0, FLOOR_Y + 5.0, 0.2);
  g.add(screen);

  // accent glow card behind the monitor
  const backCard = new THREE.Mesh(
    new THREE.PlaneGeometry(8.6, 6.4),
    new THREE.MeshBasicMaterial({
      color: product.accent,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    })
  );
  backCard.position.set(0, FLOOR_Y + 5.0, -0.45);
  g.add(backCard);

  // framed chart beside the station
  const sideArt = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 1.86),
    new THREE.MeshBasicMaterial({
      map: getPoster(['bars', 'pie', 'target', 'line', 'coin'][i], false),
    })
  );
  sideArt.position.set(i % 2 === 0 ? 4.7 : -4.7, FLOOR_Y + 3.5, -0.6);
  sideArt.rotation.y = (i % 2 === 0 ? -1 : 1) * 0.38;
  g.add(sideArt);

  // desk props on the podium
  const props = PROP_BUILDERS[product.prop]();
  props.position.set(i % 2 === 0 ? -1.2 : 1.2, FLOOR_Y + 1.0, 0.9);
  props.scale.setScalar(0.85);
  g.add(props);

  // contact shadow
  addShadow(g, 9, FLOOR_Y + 0.03, 0.4, 0.9);

  g.position.set(stationX(i), 0, stationZ(i));
  g.userData.baseY = 0;
  scene.add(g);
  stations.push({ group: g });
});

// =====================================================
// FLOATING ACCENTS — coins drifting through the room
// =====================================================

const floaters = [];
{
  const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 26);
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(coinGeo, i % 2 ? goldMat : goldDeepMat);
    // kept out to the sides so nothing drifts across the camera lens
    const side = i % 2 === 0 ? -1 : 1;
    m.position.set(
      side * (7.5 + Math.random() * 5.5),
      0.6 + Math.random() * 4.2,
      -5 - Math.random() * 62
    );
    m.rotation.z = Math.PI / 2;
    scene.add(m);
    floaters.push({ mesh: m, phase: Math.random() * 6.28, speed: 0.4 + Math.random() * 0.5 });
  }
}

// =====================================================
// SCROLL TRACKING
// =====================================================

let scrollProgress = 0;
let heroFade = 1; // 1 while the hero fills the screen, 0 once scrolled away
let outro = 0;    // 0..1 once past the last product, walking up to the sign
let focus = 0;
let focusEased = 0;

const progressBar = document.querySelector('#progress span');
const scrollCue = document.querySelector('#scrollcue');
const productsSection = document.querySelector('.products');
const sections = [...document.querySelectorAll('.product')].map((el) => ({
  el,
  inner: el.querySelector('.product__inner'),
}));

function updateScroll() {
  const vh = window.innerHeight;
  if (vh === 0) return; // hidden tab — skip to avoid NaN

  const doc = document.documentElement.scrollHeight - vh;
  scrollProgress = doc > 0 ? window.scrollY / doc : 0;
  heroFade = THREE.MathUtils.clamp(1 - window.scrollY / (vh * 0.55), 0, 1);

  // one station per section; focus hits a whole number at the midpoint
  // of that section's pinned range
  const sectionH = sections[0].el.offsetHeight || vh;
  const pinned = sectionH - vh;
  const raw =
    (window.scrollY - productsSection.offsetTop - pinned / 2) / sectionH;
  focus = THREE.MathUtils.clamp(raw, 0, PRODUCTS.length - 1);

  // once the last product is behind us, keep walking toward the sign
  const last = sections[sections.length - 1].el;
  outro = THREE.MathUtils.clamp(
    (window.scrollY - (last.offsetTop + sectionH - vh)) / (vh * 0.9),
    0,
    1
  );

  // fade each panel in and out around its pinned range
  const pinEnd = pinned / sectionH;
  sections.forEach(({ el, inner }) => {
    const d = (window.scrollY - el.offsetTop) / sectionH;
    let o = 1;
    if (d < 0) o = 1 + d / 0.3;
    else if (d > pinEnd) o = 1 - (d - pinEnd) / 0.3;
    o = THREE.MathUtils.clamp(o, 0, 1);
    inner.style.opacity = o;
    inner.style.transform = `translateY(${(1 - o) * 26}px)`;
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
const lookTarget = new THREE.Vector3(0, 0.4, 0);

function loop() {
  if (!enabled) {
    running = false;
    return;
  }
  running = true;
  requestAnimationFrame(loop);

  // keep the drawing buffer in step with the viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw > 0 && vh > 0 && Math.abs(camera.aspect - vw / vh) > 0.001) {
    handleResize();
  }

  timer.update();
  const t = timer.getElapsed();

  focusEased += (focus - focusEased) * 0.1;

  const i = Math.floor(focusEased);
  const frac = focusEased - i;
  const next = Math.min(i + 1, PRODUCTS.length - 1);

  // hero framing — stand further back and look away from station 01
  // so the headline on the left stays clear
  const heroBias = heroFade;

  const zTarget =
    THREE.MathUtils.lerp(stationZ(i), stationZ(next), frac) +
    10.5 +
    heroBias * 13 -
    outro * 5;
  // at the end, drift back to the middle of the room to face the sign
  const sideTarget =
    THREE.MathUtils.lerp(stationX(i), stationX(next), frac) * (1 - outro);

  camera.position.z += (zTarget - camera.position.z) * 0.08;
  camera.position.x +=
    (sideTarget * 0.26 - heroBias * 2.4 + Math.sin(t * 0.35) * 0.35 - camera.position.x) * 0.06;
  camera.position.y +=
    (-0.2 + Math.sin(t * 0.5) * 0.2 - camera.position.y) * 0.06;

  lookTarget.x += (sideTarget * 0.5 - heroBias * 3.4 - lookTarget.x) * 0.07;
  lookTarget.y += (0.5 - lookTarget.y) * 0.07;
  lookTarget.z += (camera.position.z - 17 - lookTarget.z) * 0.07;
  camera.lookAt(lookTarget);

  // stations breathe and turn a little toward the visitor
  stations.forEach((st, idx) => {
    const g = st.group;
    g.position.y = g.userData.baseY + Math.sin(t * 0.8 + idx) * 0.09;
    const dx = camera.position.x - g.position.x;
    const dz = camera.position.z - g.position.z;
    g.rotation.y += (Math.atan2(dx, dz) * 0.3 - g.rotation.y) * 0.05;
  });

  // wall gears
  gears.forEach((g) => {
    g.mesh.rotation.z += g.speed * 0.02;
  });



  // drifting coins
  floaters.forEach((f) => {
    f.mesh.position.y += Math.sin(t * f.speed + f.phase) * 0.004;
    f.mesh.rotation.y += 0.006;
    f.mesh.rotation.x = Math.sin(t * 0.4 + f.phase) * 0.25;
  });

  renderer.render(scene, camera);

  if (import.meta.env.DEV) {
    window.__dbg = {
      cam: camera.position.toArray().map((n) => +n.toFixed(2)),
      focus: +focus.toFixed(2),
      outro: +outro.toFixed(2),
    };
  }
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

// =====================================================
// START
// =====================================================

updateScroll();
loop();
