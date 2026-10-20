import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================
 * CASE STUDIES — a world the page is read inside
 * =====================================================
 * Five isometric platforms stepping down and across,
 * joined by staircases, each one an engagement: the
 * client's floor, the people on it and the thing we
 * built. The canvas is fixed behind the whole page, so
 * scrolling walks the run — the camera glides from one
 * platform to the next as its write-up comes up, the way
 * the showroom moves between products.
 *
 * Clicking a platform jumps to its write-up; the labels
 * and arrow keys do the same. Everything here is for
 * looking at: the words are HTML over the top.
 * ===================================================== */

const host = document.querySelector('[data-case-world]');
const canvas = host?.querySelector('canvas');
if (canvas) start();

function start() {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // the five, in the order they are walked
  const CASES = [
    { id: 'amc', tint: 0x11568e, deep: 0x1b4694, vignette: 'advice' },
    { id: 'nps', tint: 0x0ea5b7, deep: 0x0a6f7e, vignette: 'kiosk' },
    { id: 'insurer', tint: 0x3875b0, deep: 0x4338ca, vignette: 'planning' },
    { id: 'nbfc', tint: 0x11568e, deep: 0x1a3f8f, vignette: 'branch' },
    { id: 'market', tint: 0x14b8a6, deep: 0x0d7a6e, vignette: 'market' },
  ];

  const INK = 0x0e1a38;
  const PALE = 0xe6eeff;
  const SKIN = 0xf0c8a8;
  const SUIT = [0x24355f, 0x37508a, 0x1f2d4d, 0x44568c];

  // =====================================================
  // RENDERER
  // =====================================================

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;

  // a true isometric view: equal angles, no perspective
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -120, 220);
  const EYE = new THREE.Vector3(15, 12.5, 15); // the angle everything is seen from

  scene.add(new THREE.HemisphereLight(0xd6e4ff, 0x16203c, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.55);
  key.position.set(10, 16, 9);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x7fa8ff, 1.0);
  fill.position.set(-12, 5, -8);
  scene.add(fill);

  const root = new THREE.Group();
  scene.add(root);

  // =====================================================
  // SMALL PARTS
  // =====================================================

  const mat = (color, { rough = 0.42, glow = 0, metal = 0 } = {}) =>
    new THREE.MeshPhysicalMaterial({
      color, roughness: rough, metalness: metal, clearcoat: 0.55, clearcoatRoughness: 0.3,
      emissive: color, emissiveIntensity: glow,
    });
  const flat = (color, opacity = 1) =>
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false });

  const inkMat = mat(INK, { rough: 0.5 });
  const paleMat = mat(PALE, { rough: 0.38 });
  const skinMat = mat(SKIN, { rough: 0.6 });
  const suitMats = SUIT.map((c) => mat(c, { rough: 0.55 }));

  const box = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, r);

  /** One person: a body, a head, and arms held like the reference's figures. */
  function figure(suit, { height = 1, arm = 0.2 } = {}) {
    const g = new THREE.Group();
    const legs = new THREE.Mesh(box(0.26, 0.42 * height, 0.2, 0.07), inkMat);
    legs.position.y = 0.21 * height;
    const torso = new THREE.Mesh(box(0.34, 0.46 * height, 0.24, 0.1), suit);
    torso.position.y = 0.63 * height;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), skinMat);
    head.position.y = 0.98 * height;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 16, 0, Math.PI * 2, 0, 1.1), inkMat);
    hair.position.y = 0.99 * height;
    g.add(legs, torso, head, hair);
    [-1, 1].forEach((s) => {
      const a = new THREE.Mesh(box(0.1, 0.38 * height, 0.1, 0.04), suit);
      a.position.set(s * 0.22, 0.64 * height, 0.02);
      a.rotation.z = -s * arm;
      g.add(a);
    });
    return g;
  }

  /** Someone sitting, for the rows in front of a presenter. */
  function seated(suit) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(box(0.34, 0.08, 0.32, 0.03), paleMat);
    seat.position.y = 0.3;
    const back = new THREE.Mesh(box(0.34, 0.34, 0.07, 0.03), suit);
    back.position.set(0, 0.46, -0.16);
    const legs = new THREE.Mesh(box(0.1, 0.3, 0.1, 0.03), inkMat);
    legs.position.set(0, 0.15, 0.04);
    const torso = new THREE.Mesh(box(0.3, 0.34, 0.22, 0.08), suit);
    torso.position.y = 0.5;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), skinMat);
    head.position.y = 0.76;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14, 0, Math.PI * 2, 0, 1.1), inkMat);
    hair.position.y = 0.77;
    g.add(seat, back, legs, torso, head, hair);
    return g;
  }

  /** A screen with something on it, drawn once into a canvas. */
  function screenTex(draw, w = 220, h = 140) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0c1733';
    ctx.fillRect(0, 0, w, h);
    draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const bars = (ctx, w, h) => {
    ctx.fillStyle = 'rgba(190,214,255,0.35)';
    ctx.fillRect(14, 12, 70, 8);
    [34, 52, 40, 68, 58].forEach((v, i) => {
      ctx.fillStyle = i % 2 ? '#38bdf8' : '#4f86ff';
      ctx.fillRect(16 + i * 26, h - 16 - v, 18, v);
    });
  };
  const curve = (ctx, w, h) => {
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(16, h - 26);
    ctx.lineTo(60, h - 52);
    ctx.lineTo(104, h - 40);
    ctx.lineTo(150, h - 78);
    ctx.lineTo(w - 14, h - 96);
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,214,255,0.3)';
    ctx.fillRect(14, 12, 54, 8);
  };
  const rows = (ctx, w, h) => {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = 'rgba(190,214,255,0.18)';
      ctx.fillRect(14, 16 + i * 22, w - 58, 12);
      ctx.fillStyle = i % 2 ? '#38bdf8' : '#4f86ff';
      ctx.fillRect(w - 38, 16 + i * 22, 24, 12);
    }
  };
  const donut = (ctx, w, h) => {
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#1e3566';
    ctx.beginPath();
    ctx.arc(w * 0.32, h / 2, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#4f86ff';
    ctx.beginPath();
    ctx.arc(w * 0.32, h / 2, 34, -Math.PI / 2, Math.PI * 0.75);
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,214,255,0.3)';
    for (let i = 0; i < 3; i++) ctx.fillRect(w * 0.56, 34 + i * 26, 70 - i * 14, 10);
  };
  /** the pie-and-bars deck the presenter stands beside */
  const deck = (ctx, w, h) => {
    ctx.fillStyle = 'rgba(190,214,255,0.3)';
    ctx.fillRect(14, 14, 86, 10);
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(52, h * 0.62, 26, -Math.PI / 2, Math.PI * 0.6);
    ctx.stroke();
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(52, h * 0.62, 26, Math.PI * 0.6, Math.PI * 1.5);
    ctx.stroke();
    [30, 48, 38, 60].forEach((v, i) => {
      ctx.fillStyle = i % 2 ? '#4f86ff' : '#34d399';
      ctx.fillRect(108 + i * 26, h - 20 - v, 16, v);
    });
  };

  /** A monitor on a stand. */
  function monitor(draw, w = 1.0, h = 0.64) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(box(w, h, 0.07, 0.05), inkMat);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.9, h * 0.86),
      new THREE.MeshBasicMaterial({ map: screenTex(draw), toneMapped: false })
    );
    face.position.z = 0.04;
    const neck = new THREE.Mesh(box(0.08, 0.2, 0.08, 0.02), paleMat);
    neck.position.y = -h / 2 - 0.1;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.04, 20), paleMat);
    foot.position.y = -h / 2 - 0.2;
    g.add(shell, face, neck, foot);
    g.position.y = h / 2 + 0.22;
    return g;
  }

  /** A big wall screen, as the presenting platform has. */
  function wallScreen(draw, w = 2.2, h = 1.4) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(box(w, h, 0.1, 0.06), paleMat);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.92, h * 0.88),
      new THREE.MeshBasicMaterial({ map: screenTex(draw, 420, 270), toneMapped: false })
    );
    face.position.z = 0.055;
    const stand = new THREE.Mesh(box(0.12, 1.1, 0.12, 0.04), paleMat);
    stand.position.y = -h / 2 - 0.55;
    g.add(shell, face, stand);
    g.position.y = h / 2 + 1.1;
    return g;
  }

  /** A desk, with legs. */
  function desk(w = 1.5, d = 0.8, h = 0.45) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(box(w, 0.07, d, 0.03), paleMat);
    top.position.y = h;
    g.add(top);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(box(0.07, h, 0.07, 0.02), inkMat);
      leg.position.set((sx * w) / 2 - sx * 0.1, h / 2, (sz * d) / 2 - sz * 0.1);
      g.add(leg);
    });
    return g;
  }

  /** A standing board on an easel, for the presenting scenes. */
  function board(tint, draw) {
    const g = new THREE.Group();
    const panel = new THREE.Mesh(box(1.25, 0.9, 0.06, 0.04), paleMat);
    panel.position.y = 1.05;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 0.78),
      new THREE.MeshBasicMaterial({ map: screenTex(draw), toneMapped: false })
    );
    face.position.set(0, 1.05, 0.035);
    g.add(panel, face);
    [-1, 1].forEach((s) => {
      const leg = new THREE.Mesh(box(0.05, 1.1, 0.05, 0.02), mat(tint));
      leg.position.set(s * 0.5, 0.55, -0.06);
      leg.rotation.x = 0.12;
      g.add(leg);
    });
    return g;
  }

  /** A server rack / kiosk column. */
  function rack(tint) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(box(0.7, 1.5, 0.6, 0.08), inkMat);
    body.position.y = 0.75;
    g.add(body);
    for (let i = 0; i < 5; i++) {
      const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.14), flat(i === 1 ? tint : 0x24365f));
      slot.position.set(0, 0.4 + i * 0.26, 0.305);
      g.add(slot);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), flat(0x34d399));
    lamp.position.set(0.22, 1.42, 0.3);
    g.add(lamp);
    return g;
  }

  /** A low table with laptops around it. */
  function table(tint) {
    const g = new THREE.Group();
    g.add(desk(1.7, 1.0, 0.4));
    [-0.45, 0.45].forEach((x, i) => {
      const lap = new THREE.Group();
      const base = new THREE.Mesh(box(0.42, 0.03, 0.3, 0.01), paleMat);
      const lid = new THREE.Mesh(box(0.42, 0.28, 0.02, 0.01), inkMat);
      lid.position.set(0, 0.15, -0.14);
      lid.rotation.x = -0.32;
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.22), flat(i ? tint : 0x709abb, 0.9));
      glow.position.set(0, 0.15, -0.125);
      glow.rotation.x = -0.32;
      lap.add(base, lid, glow);
      lap.position.set(x, 0.49, i ? 0.2 : -0.2);
      lap.rotation.y = i ? 0.3 : Math.PI - 0.3;
      g.add(lap);
    });
    return g;
  }

  /** A phone held up, for the mobile-first scenes. */
  function phone(tint) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(box(0.42, 0.78, 0.05, 0.06), inkMat);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.66), flat(tint, 0.95));
    face.position.z = 0.03;
    g.add(body, face);
    return g;
  }

  /** A wall calendar, with one day picked out. */
  function calendar(tint) {
    const g = new THREE.Group();
    const sheet = new THREE.Mesh(box(1.0, 1.2, 0.06, 0.04), paleMat);
    sheet.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.26), flat(tint));
    head.position.set(0, 1.04, 0.035);
    g.add(sheet, head);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        const day = new THREE.Mesh(
          new THREE.PlaneGeometry(0.13, 0.11),
          flat(r === 1 && c === 3 ? 0xf472b6 : 0x25407a, r === 1 && c === 3 ? 1 : 0.6)
        );
        day.position.set(-0.36 + c * 0.18, 0.84 - r * 0.17, 0.035);
        g.add(day);
      }
    }
    return g;
  }

  // =====================================================
  // THE COMPOSITION
  // =====================================================
  // Four platforms at four heights, joined by flights of stairs: the
  // presenting floor at the back, a laptop floor to its left, a handshake
  // floor to its right and the planning floor at the front, with the whole
  // arrangement read from one fixed isometric angle.

  const PLAT = 8.4; // a platform is this wide, and flat: a plate, not a block
  const THICK = 0.34;

  // the reference fills its platforms with one flat blue-violet, #697cbe,
  // with the odd face a shade under it; these are set so the lit render
  // lands on that colour rather than above it
  const SLAB = 0x273b7f;
  const SLAB_DEEP = 0x20316c;
  const slabMat = mat(SLAB, { rough: 0.42 });
  const slabDeepMat = mat(SLAB_DEEP, { rough: 0.55 });

  // Each platform differs from its neighbour along one axis only, so every
  // flight runs straight out of the middle of an edge and into the middle of
  // the one facing it. In this view +x reads as down-right and +z as
  // down-left. One plate is a rectangle rather than a square, as the
  // reference's presenting floor is.
  const RUN = 13.5; // how far apart two joined platforms stand
  const FALL = 2.4; // and how far the lower one sits below

  const FLOORS = [
    { id: 'amc', at: new THREE.Vector3(0, 0, 0), w: 11.4, d: 8.0, scene: 'stage' },
    { id: 'nps', at: new THREE.Vector3(0, -FALL, RUN), w: 8.4, d: 8.4, scene: 'laptop' },
    { id: 'insurer', at: new THREE.Vector3(RUN, -FALL, 0), w: 8.4, d: 8.4, scene: 'deal' },
    { id: 'nbfc', at: new THREE.Vector3(RUN, -FALL * 2, RUN), w: 8.4, d: 8.4, scene: 'plan' },
  ];

  /** One flight: steps that float. Each is a plate the same thickness as a
   *  platform, set a little apart from the next and a little lower, with
   *  nothing joining them — the way the reference's staircases read. */
  function stairs(a, b, width = 3.4) {
    const g = new THREE.Group();
    const span = b.clone().sub(a);
    const run = Math.hypot(span.x, span.z);
    const steps = Math.max(5, Math.round(run / 1.25));
    const tread = run / steps;
    const rise = (a.y - b.y) / steps;
    const alongZ = Math.abs(span.z) > Math.abs(span.x);
    for (let k = 0; k < steps; k++) {
      const u = (k + 0.5) / steps;
      const depth = tread * 0.62; // the gap between one step and the next
      const step = new THREE.Mesh(
        alongZ ? box(width, THICK, depth, 0.03) : box(depth, THICK, width, 0.03),
        slabMat
      );
      step.position.copy(a).addScaledVector(span, u);
      step.position.y = a.y - rise * (k + 0.5);
      g.add(step);
      // the thin edge under the plate, the only depth a floating step has
      const edge = new THREE.Mesh(
        alongZ ? box(width - 0.1, 0.26, depth - 0.1, 0.02) : box(depth - 0.1, 0.26, width - 0.1, 0.02),
        slabDeepMat
      );
      edge.position.copy(step.position);
      edge.position.y -= 0.22;
      g.add(edge);
    }
    return g;
  }

  const plats = [];

  FLOORS.forEach((f, i) => {
    const g = new THREE.Group();
    g.position.copy(f.at);
    root.add(g);

    const slab = new THREE.Mesh(box(f.w, THICK, f.d, 0.06), slabMat);
    g.add(slab);
    // the plate's own edge: a shallow skirt, so it has thickness without
    // becoming a block
    const skirt = new THREE.Mesh(box(f.w - 0.16, 0.55, f.d - 0.16, 0.04), slabDeepMat);
    skirt.position.y = -0.42;
    g.add(skirt);

    const vig = new THREE.Group();
    vig.position.y = THICK / 2;
    // the plates are wide, so what stands on them is scaled to fill them the
    // way the reference's furniture does
    vig.scale.setScalar(1.5);
    g.add(vig);
    buildFloor(f.scene, vig);

    plats.push({ ...f, group: g, slab, index: i, lift: 0 });
  });

  // the four flights: down-left and down-right from the top floor, and the
  // same again into the planning floor at the bottom
  [[0, 1], [0, 2], [1, 3], [2, 3]].forEach(([from, to]) => {
    const A = FLOORS[from];
    const B = FLOORS[to];
    const dir = B.at.clone().sub(A.at).setY(0).normalize();
    const half = (f) => (Math.abs(dir.z) > Math.abs(dir.x) ? f.d : f.w) / 2;
    root.add(stairs(A.at.clone().addScaledVector(dir, half(A)), B.at.clone().addScaledVector(dir, -half(B))));
  });

  // =====================================================
  // WHAT IS HAPPENING ON EACH FLOOR
  // =====================================================

  /** A laptop, open, with something on the screen. */
  function laptop(scale = 1) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(box(2.0, 0.12, 1.4, 0.05), paleMat);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), flat(0xc9d7f5));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.07, 0.3);
    const keys = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), flat(0xdbe5fb));
    keys.rotation.x = -Math.PI / 2;
    keys.position.set(0, 0.07, -0.3);
    const lid = new THREE.Mesh(box(2.0, 1.3, 0.08, 0.05), paleMat);
    lid.position.set(0, 0.68, -0.72);
    lid.rotation.x = -0.26;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.84, 1.14),
      new THREE.MeshBasicMaterial({ map: screenTex(deck, 420, 270), toneMapped: false })
    );
    face.position.set(0, 0.68, -0.675);
    face.rotation.x = -0.26;
    g.add(base, pad, keys, lid, face);
    g.scale.setScalar(scale);
    return g;
  }

  /** A briefcase, stood on the floor. */
  function briefcase() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(box(0.5, 0.4, 0.16, 0.04), mat(0x33406e, { rough: 0.5 }));
    body.position.y = 0.2;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 16, Math.PI), mat(0x1d2748));
    handle.position.y = 0.4;
    g.add(body, handle);
    return g;
  }

  /** A gavel on its block, with a couple of documents beside it. */
  function gavel(tint) {
    const g = new THREE.Group();
    const block = new THREE.Mesh(box(0.5, 0.1, 0.3, 0.03), mat(0x8b5a2b, { rough: 0.5 }));
    block.position.y = 0.05;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16), mat(0x7a4a22, { rough: 0.45 }));
    head.rotation.z = Math.PI / 2;
    head.position.set(0, 0.2, 0);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 12), mat(0x9c6b35));
    shaft.rotation.set(0, 0, Math.PI / 2);
    shaft.position.set(0.32, 0.2, 0);
    const papers = new THREE.Group();
    [0, 1].forEach((k) => {
      const sheet = new THREE.Mesh(box(0.54, 0.03, 0.4, 0.01), k ? flat(tint, 0.9) : paleMat);
      sheet.position.set(-0.1 + k * 0.06, 0.02 + k * 0.035, 0.05 - k * 0.04);
      sheet.rotation.y = k * 0.2;
      papers.add(sheet);
    });
    papers.position.set(-0.75, 0, 0.1);
    g.add(block, head, shaft, papers);
    return g;
  }

  /** A desk calendar, its date showing. */
  function deskCalendar(day = '28') {
    const g = new THREE.Group();
    const stand = new THREE.Mesh(box(0.6, 0.06, 0.4, 0.02), paleMat);
    const sheet = new THREE.Mesh(box(0.56, 0.6, 0.05, 0.03), paleMat);
    sheet.position.y = 0.33;
    const head = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), flat(0xf0587f));
    head.position.set(0, 0.54, 0.03);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#23306a';
    ctx.font = '800 76px Outfit, "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(day, 64, 74);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.34),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    face.position.set(0, 0.3, 0.03);
    g.add(stand, sheet, head, face);
    return g;
  }

  /** A desk with a chair, for the rows in the presenting room. */
  function deskRow(suit) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(box(1.5, 0.08, 0.5, 0.03), paleMat);
    top.position.y = 0.52;
    const front = new THREE.Mesh(box(1.5, 0.44, 0.06, 0.02), paleMat);
    front.position.set(0, 0.3, 0.22);
    g.add(top, front);
    [-0.4, 0.4].forEach((x) => {
      const s = seated(suit);
      s.position.set(x, 0, -0.55);
      g.add(s);
    });
    const lap = new THREE.Mesh(box(0.42, 0.26, 0.03, 0.01), inkMat);
    lap.position.set(0.35, 0.68, -0.1);
    lap.rotation.x = -0.4;
    g.add(lap);
    return g;
  }

  function buildFloor(kind, into) {
    if (kind === 'stage') {
      // the presenting room: a screen on a stand, a presenter beside it and
      // two rows of desks facing it
      const s = wallScreen(deck, 2.6, 1.6);
      s.position.set(-0.6, 0, -2.1);
      s.rotation.y = 0.12;
      into.add(s);
      const p = figure(suitMats[0], { arm: 0.6 });
      p.position.set(1.1, 0, -1.7);
      p.rotation.y = -1.0;
      into.add(p);
      [0, 1].forEach((r) => {
        const row = deskRow(suitMats[r + 1]);
        row.position.set(-0.1 + r * 0.25, 0, 0.1 + r * 1.35);
        into.add(row);
      });
      const books = new THREE.Group();
      [0, 1, 2].forEach((k) => {
        const b = new THREE.Mesh(box(0.8, 0.12, 0.56, 0.02), k === 1 ? mat(0x709abb) : paleMat);
        b.position.y = 0.06 + k * 0.13;
        books.add(b);
      });
      books.position.set(-2.1, 0, 1.0);
      into.add(books);
    } else if (kind === 'laptop') {
      // the analysis floor: a big open laptop, two people reading it
      const l = laptop(1.15);
      l.position.set(-0.9, 0, -0.6);
      l.rotation.y = 0.5;
      into.add(l);
      const a = figure(suitMats[1], { arm: 0.3 });
      a.position.set(1.1, 0, 0.1);
      a.rotation.y = -1.9;
      into.add(a);
      const b = figure(suitMats[3], { arm: 0.45 });
      b.position.set(1.5, 0, 1.0);
      b.rotation.y = -2.2;
      into.add(b);
    } else if (kind === 'deal') {
      // the agreement floor: two meeting over a handshake, papers and a
      // gavel on the floor beside them, someone sitting on the step
      const a = figure(suitMats[0], { arm: 0.75 });
      a.position.set(-0.7, 0, -0.5);
      a.rotation.y = -1.3;
      into.add(a);
      const b = figure(suitMats[2], { arm: 0.75 });
      b.position.set(0.55, 0, -0.1);
      b.rotation.y = 1.8;
      into.add(b);
      const c = briefcase();
      c.position.set(1.15, 0, 0.45);
      into.add(c);
      const gv = gavel(0xf0587f);
      gv.position.set(-1.5, 0, 1.2);
      gv.rotation.y = 0.5;
      into.add(gv);
      const sitter = seated(suitMats[1]);
      sitter.position.set(-2.0, 0, -1.3);
      sitter.rotation.y = 2.2;
      into.add(sitter);
    } else {
      // the planning floor: the month on the wall, the day on the desk
      const cal = calendar(0xf0587f);
      cal.scale.setScalar(1.9);
      cal.position.set(-1.2, 0, -1.4);
      cal.rotation.y = 0.35;
      into.add(cal);
      const d = deskCalendar('28');
      d.scale.setScalar(1.6);
      d.position.set(1.3, 0, 0.2);
      d.rotation.y = -0.4;
      into.add(d);
      const a = figure(suitMats[2], { arm: 0.4 });
      a.position.set(0.1, 0, 1.0);
      a.rotation.y = -0.4;
      into.add(a);
    }
  }

  // =====================================================
  // THE THINGS FLOATING AROUND THE COMPOSITION
  // =====================================================

  // outlined and solid squares, turning slowly, the way the reference has
  // them scattered through its background
  const confetti = [];
  {
    const seed = (n) => () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const rand = seed(90210);
    const COLORS = [0xf0587f, 0x709abb, 0xffffff, 0x38bdf8, 0xf9a8d4];
    for (let k = 0; k < 24; k++) {
      const solid = rand() > 0.5;
      const size = 0.45 + rand() * 0.5;
      const color = COLORS[Math.floor(rand() * COLORS.length)];
      const m = solid
        ? new THREE.Mesh(box(size, size, 0.1, 0.05), flat(color, 0.9))
        : new THREE.Mesh(new THREE.TorusGeometry(size * 0.62, 0.045, 4, 4), flat(color, 0.85));
      if (!solid) m.rotation.z = Math.PI / 4;
      m.position.set((rand() - 0.5) * 30, 2 + rand() * 11, (rand() - 0.5) * 26);
      root.add(m);
      confetti.push({ m, spin: (rand() - 0.5) * 0.5, bob: rand() * 6.28 });
    }
  }

  // the soft shadow each platform casts into the dark
  const shadeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(8,16,40,0.5)');
    g.addColorStop(1, 'rgba(8,16,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  plats.forEach((p) => {
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 15),
      new THREE.MeshBasicMaterial({ map: shadeTex, transparent: true, depthWrite: false })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(p.group.position.x, p.group.position.y - 3.0, p.group.position.z + 0.6);
    root.add(sh);
  });

  // =====================================================
  // SIZE — the whole composition, always in frame
  // =====================================================

  const CENTRE = new THREE.Vector3(RUN / 2, -FALL, RUN / 2);
  const SPAN = 21.5; // half-height of the composition, in world units

  function size() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const a = w / h;
    // the words take the right third on a wide window, so the composition is
    // framed into what is left of it
    const wide = w >= 1000;
    const halfH = wide ? SPAN * 0.76 : SPAN * 0.86;
    const halfW = halfH * a;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();

    const look = CENTRE.clone();
    // pushing the camera's target to its own right slides the picture left,
    // which is where the composition belongs: the title takes the right
    if (wide) look.addScaledVector(RIGHT, halfW * 0.40);
    camera.position.copy(look).add(EYE);
    camera.lookAt(look);
    home.copy(look);
  }

  // the camera's own right, so the composition can be set beside the words
  const RIGHT = new THREE.Vector3()
    .crossVectors(EYE.clone().negate(), new THREE.Vector3(0, 1, 0))
    .normalize();
  const home = new THREE.Vector3();

  size();
  window.addEventListener('resize', size);

  // =====================================================
  // A LITTLE LIFE
  // =====================================================

  // the pointer tips the whole arrangement, the way an isometric board tilts
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!REDUCED) {
    window.addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  let live = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { live = e.isIntersecting; }).observe(canvas);
  }

  const timer = new Timer();

  // what the composition covers on screen, so the layout can be checked
  window.__caseBounds = () => {
    const v = new THREE.Vector3();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    plats.forEach((p) => {
      [[-PLAT / 2, PLAT / 2], [PLAT / 2, PLAT / 2], [-PLAT / 2, -PLAT / 2], [PLAT / 2, -PLAT / 2]].forEach(([dx, dz]) => {
        v.set(p.group.position.x + dx, p.group.position.y, p.group.position.z + dz).project(camera);
        const x = (v.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      });
    });
    return { minX: Math.round(minX), maxX: Math.round(maxX), minY: Math.round(minY), maxY: Math.round(maxY) };
  };

  function frame() {
    requestAnimationFrame(frame);
    if (!live) return;
    timer.update();
    const t = REDUCED ? 0 : timer.getElapsed();

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    root.rotation.y = pointer.x * 0.06;
    root.rotation.x = pointer.y * 0.02;

    plats.forEach((p, k) => {
      p.group.position.y = p.at.y + (REDUCED ? 0 : Math.sin(t * 0.7 + k * 1.3) * 0.07);
    });

    confetti.forEach(({ m, spin, bob }, k) => {
      m.rotation.y = t * spin;
      m.rotation.x = Math.sin(t * 0.4 + k) * 0.3;
      m.position.y += Math.sin(t * 0.8 + bob) * 0.004;
    });

    renderer.render(scene, camera);
  }
  frame();
}
