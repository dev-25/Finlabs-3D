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
    { id: 'amc', tint: 0x2f6fd0, deep: 0x1b4694, vignette: 'advice' },
    { id: 'nps', tint: 0x0ea5b7, deep: 0x0a6f7e, vignette: 'kiosk' },
    { id: 'insurer', tint: 0x6366f1, deep: 0x4338ca, vignette: 'planning' },
    { id: 'nbfc', tint: 0x2563eb, deep: 0x1a3f8f, vignette: 'branch' },
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
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.22), flat(i ? tint : 0x4f86ff, 0.9));
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
  // THE PLATFORMS, AND THE STAIRS BETWEEN THEM
  // =====================================================

  const PLAT = 6.2; // a platform is square, this wide
  const THICK = 0.5;
  const SIDE = 1.4; // how far each platform steps aside from the last
  const FORWARD = 6.8; // and how far along the run
  const DROP = 2.6; // the fall from one platform to the next

  // where each platform sits: a cascade going down and across, so the run
  // reads as one staircase from the top of the page to the bottom
  const spots = CASES.map((c, i) => new THREE.Vector3(
    (i % 2 ? 1 : -1) * SIDE,
    -i * DROP,
    i * FORWARD
  ));

  const slabGeo = box(PLAT, THICK, PLAT, 0.16);

  /** The big number pressed into each platform. */
  function numberTex(n) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.font = '800 200px Outfit, "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 16;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10,22,50,0.55)';
    ctx.strokeText(String(n), 128, 140);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(n), 128, 140);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** A flight of steps from one platform's edge down to the next. */
  function stairs(from, to, tint) {
    const g = new THREE.Group();
    const a = from.clone();
    const b = to.clone();
    const span = b.clone().sub(a);
    const steps = 7;
    const treadMat = mat(tint, { rough: 0.45 });
    const riserMat = mat(0x1b2b55, { rough: 0.6 });
    for (let k = 0; k < steps; k++) {
      const u = (k + 0.5) / steps;
      const tread = new THREE.Mesh(box(2.0, 0.22, span.length() / steps + 0.26, 0.05), k % 2 ? treadMat : riserMat);
      tread.position.copy(a).addScaledVector(span, u);
      tread.position.y = a.y - (a.y - b.y) * u;
      tread.lookAt(b.x, tread.position.y, b.z);
      g.add(tread);
      // the block under each tread, so the flight reads as solid
      const under = new THREE.Mesh(box(2.0, 0.6, span.length() / steps + 0.2, 0.04), riserMat);
      under.position.copy(tread.position);
      under.position.y -= 0.4;
      under.rotation.copy(tread.rotation);
      g.add(under);
    }
    return g;
  }

  const plats = [];

  CASES.forEach((c, i) => {
    const g = new THREE.Group();
    g.position.copy(spots[i]);
    root.add(g);

    const faceMat = mat(c.tint, { rough: 0.34, glow: 0.1 });
    const slab = new THREE.Mesh(slabGeo, faceMat);
    g.add(slab);

    // the darker block beneath, so each platform reads as a solid island
    const under = new THREE.Mesh(box(PLAT - 0.3, 2.4, PLAT - 0.3, 0.12), mat(c.deep, { rough: 0.62 }));
    under.position.y = -1.4;
    g.add(under);

    // its number, lying on the surface at the near corner
    const numGeo = new THREE.PlaneGeometry(1.9, 1.9);
    numGeo.rotateX(-Math.PI / 2);
    numGeo.rotateY(Math.PI / 4);
    const num = new THREE.Mesh(
      numGeo,
      new THREE.MeshBasicMaterial({
        map: numberTex(i + 1), transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    num.position.set(-PLAT / 2 + 1.5, THICK / 2 + 0.02, PLAT / 2 - 1.5);
    g.add(num);

    // what is happening on this floor
    const vig = new THREE.Group();
    vig.position.set(0.1, THICK / 2, -0.2);
    g.add(vig);
    buildVignette(c.vignette, c.tint, vig);

    plats.push({ ...c, group: g, slab, faceMat, index: i, lift: 0 });

    // the flight down to the next one
    if (i < CASES.length - 1) {
      const from = spots[i].clone();
      from.z += PLAT / 2 - 0.2;
      const to = spots[i + 1].clone();
      to.z -= PLAT / 2 - 0.2;
      root.add(stairs(from, to, c.tint));
    }
  });

  function buildVignette(kind, tint, into) {
    const tintMat = mat(tint, { rough: 0.4 });
    if (kind === 'advice') {
      // the presenting floor: a wall screen, a presenter and rows of chairs
      const s = wallScreen(deck);
      s.position.set(-0.4, 0, -2.0);
      into.add(s);
      const p = figure(suitMats[0], { arm: 0.55 });
      p.position.set(1.0, 0, -1.6);
      p.rotation.y = -0.9;
      into.add(p);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const s2 = seated(suitMats[(r + c) % suitMats.length]);
          s2.position.set(-1.3 + c * 0.85, 0, 0.3 + r * 0.95);
          s2.rotation.y = Math.PI;
          into.add(s2);
        }
      }
      const books = new THREE.Group();
      [0, 1, 2].forEach((k) => {
        const b = new THREE.Mesh(box(0.6, 0.1, 0.44, 0.02), k === 1 ? tintMat : paleMat);
        b.position.y = 0.05 + k * 0.11;
        books.add(b);
      });
      books.position.set(-2.2, 0, 1.2);
      into.add(books);
    } else if (kind === 'kiosk') {
      // a subscriber at a self-service column, staff beside it
      const r = rack(tint);
      r.position.set(-1.1, 0, -1.0);
      into.add(r);
      const p = phone(tint);
      p.position.set(0.95, 1.05, 0.3);
      p.rotation.set(-0.2, -0.5, 0.1);
      into.add(p);
      const a = figure(suitMats[2], { arm: 0.45 });
      a.position.set(0.8, 0, 0.35);
      a.rotation.y = -0.8;
      into.add(a);
      const b = figure(suitMats[3]);
      b.position.set(-1.9, 0, 0.9);
      b.rotation.y = 0.6;
      into.add(b);
      const m = monitor(bars, 1.0, 0.62);
      m.position.set(1.7, 0.45, -1.3);
      m.rotation.y = -0.6;
      into.add(m);
    } else if (kind === 'planning') {
      // someone presenting a plan, a calendar on the wall behind
      const bd = board(tint, curve);
      bd.position.set(-1.2, 0, -1.1);
      bd.rotation.y = 0.3;
      into.add(bd);
      const cal = calendar(tint);
      cal.position.set(1.4, 0, -2.1);
      cal.rotation.y = -0.5;
      into.add(cal);
      const a = figure(suitMats[0], { arm: 0.5 });
      a.position.set(0.2, 0, -0.1);
      a.rotation.y = -0.6;
      into.add(a);
      const b = figure(suitMats[1]);
      b.position.set(1.3, 0, 0.9);
      b.rotation.y = -1.6;
      into.add(b);
      const stack = new THREE.Group();
      [0, 1, 2].forEach((k) => {
        const s = new THREE.Mesh(box(0.5, 0.1, 0.36, 0.02), k === 1 ? tintMat : paleMat);
        s.position.y = 0.05 + k * 0.11;
        stack.add(s);
      });
      stack.position.set(-2.0, 0, 1.1);
      into.add(stack);
    } else if (kind === 'branch') {
      // a branch counter with staff on both sides
      const t = table(tint);
      t.position.set(0, 0, 0);
      into.add(t);
      const a = figure(suitMats[1]);
      a.position.set(-1.5, 0, 0.5);
      a.rotation.y = 1.2;
      into.add(a);
      const b = figure(suitMats[2], { arm: 0.4 });
      b.position.set(1.45, 0, -0.45);
      b.rotation.y = -1.4;
      into.add(b);
      const c2 = figure(suitMats[3]);
      c2.position.set(0.2, 0, 1.4);
      c2.rotation.y = Math.PI;
      into.add(c2);
      const m = monitor(rows, 0.8, 0.52);
      m.position.set(-1.7, 0.5, -1.2);
      m.rotation.y = 0.8;
      into.add(m);
    } else {
      // a marketplace: a big board of listings and a buyer
      const bd = board(tint, rows);
      bd.position.set(-0.6, 0, -1.3);
      bd.rotation.y = -0.15;
      into.add(bd);
      const m = monitor(donut, 1.1, 0.7);
      m.position.set(1.6, 0.4, 0.1);
      m.rotation.y = -0.7;
      into.add(m);
      const a = figure(suitMats[2], { arm: 0.3 });
      a.position.set(-1.7, 0, 0.8);
      a.rotation.y = 0.5;
      into.add(a);
      const b = figure(suitMats[0]);
      b.position.set(0.35, 0, 1.1);
      b.rotation.y = -0.2;
      into.add(b);
    }
  }

  // =====================================================
  // THE THINGS FLOATING AROUND THE RUN
  // =====================================================

  // outlined and solid squares, turning slowly, the way the reference has
  // them scattered through its background
  const confetti = [];
  {
    const seed = (n) => () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const rand = seed(90210);
    const COLORS = [0x4f86ff, 0x38bdf8, 0xf472b6, 0x34d399, 0xe6eeff];
    for (let k = 0; k < 26; k++) {
      const solid = rand() > 0.45;
      const size = 0.4 + rand() * 0.5;
      const color = COLORS[Math.floor(rand() * COLORS.length)];
      const m = solid
        ? new THREE.Mesh(box(size, size, 0.12, 0.06), flat(color, 0.85))
        : new THREE.Mesh(
            new THREE.TorusGeometry(size * 0.6, 0.05, 4, 4),
            flat(color, 0.8)
          );
      if (!solid) m.rotation.z = Math.PI / 4;
      const along = rand() * (CASES.length - 0.4) * FORWARD;
      m.position.set((rand() - 0.5) * 22, -along * (DROP / FORWARD) + 3 + rand() * 7, along - 4 + (rand() - 0.5) * 6);
      root.add(m);
      confetti.push({ m, spin: (rand() - 0.5) * 0.5, bob: rand() * 6.28 });
    }
  }

  // two soft blobs, far behind everything, for the colour wash
  {
    const blobTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    [[0xf472b6, -14, 6, -6, 16], [0x22d3ee, 16, -10, 20, 20]].forEach(([color, x, y, z, s]) => {
      const blob = new THREE.Mesh(
        new THREE.PlaneGeometry(s, s),
        new THREE.MeshBasicMaterial({ map: blobTex, color, transparent: true, opacity: 0.18, depthWrite: false })
      );
      blob.position.set(x, y, z);
      blob.lookAt(blob.position.clone().add(EYE));
      root.add(blob);
    });
  }

  // the soft shadow each platform casts into the dark
  const shadeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(8,16,40,0.55)');
    g.addColorStop(1, 'rgba(8,16,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  plats.forEach((p) => {
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 13),
      new THREE.MeshBasicMaterial({ map: shadeTex, transparent: true, depthWrite: false })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(p.group.position.x, p.group.position.y - 2.9, p.group.position.z + 0.6);
    root.add(sh);
  });

  // =====================================================
  // SIZE
  // =====================================================

  // how much of the world is in frame; the narrower the window, the closer
  // in it has to be for a platform to fill it
  function size() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const a = w / h;
    const halfH = w < 900 ? 8.4 : 7.6;
    const halfW = halfH * a;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener('resize', size);

  // =====================================================
  // WHICH PLATFORM THE PAGE IS ON
  // =====================================================

  const listeners = new Set();
  let active = 0;
  let shown = 0; // what the camera is actually looking at, eased

  function announce() {
    listeners.forEach((fn) => fn(CASES[active].id, active));
  }
  window.__caseSelect = (i) => {
    active = Math.max(0, Math.min(plats.length - 1, i));
    announce();
  };
  window.__onCaseSelect = (fn) => {
    listeners.add(fn);
    fn(CASES[active].id, active);
  };

  // the write-ups drive the camera: whichever is nearest the middle of the
  // window is the platform the run is standing on
  const cards = [...document.querySelectorAll('.cs-study')];
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestD = Infinity;
      cards.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best !== active) window.__caseSelect(best);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // clicking a platform opens its write-up
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = -1;

  function pick(e) {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(plats.map((p) => p.slab), false)[0];
    return hit ? plats.findIndex((p) => p.slab === hit.object) : -1;
  }
  window.addEventListener('pointermove', (e) => {
    // only the bare canvas is pickable: the cards float over it
    hovered = e.target === canvas ? pick(e) : -1;
    canvas.style.cursor = hovered >= 0 ? 'pointer' : '';
  });
  canvas.addEventListener('click', (e) => {
    const i = pick(e);
    if (i < 0) return;
    window.__caseSelect(i);
    cards[i]?.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
  });

  // =====================================================
  // LOOP
  // =====================================================

  const timer = new Timer();
  const look = new THREE.Vector3();
  const want = new THREE.Vector3();
  // the camera's own right: the view looks along -EYE, so this is the axis
  // the run slides along to clear the column of words
  const RIGHT = new THREE.Vector3()
    .crossVectors(EYE.clone().negate(), new THREE.Vector3(0, 1, 0))
    .normalize();

  function frame() {
    requestAnimationFrame(frame);
    timer.update();
    const t = REDUCED ? 0 : timer.getElapsed();

    // the camera walks to the platform the page is on
    shown += (active - shown) * (REDUCED ? 1 : 0.07);
    const i = Math.max(0, Math.min(spots.length - 1, shown));
    const lo = spots[Math.floor(i)];
    const hi = spots[Math.min(spots.length - 1, Math.ceil(i))];
    want.lerpVectors(lo, hi, i - Math.floor(i));
    look.copy(want);
    look.y += 1.2;
    // on a wide window the words hold the left, so the run is framed to the
    // right: pulling the camera's target left pushes the platform right
    const aside = window.innerWidth >= 1000 ? 4.2 : 0;
    look.addScaledVector(RIGHT, -aside);
    camera.position.copy(look).add(EYE);
    camera.lookAt(look);

    plats.forEach((p, k) => {
      const near = k === Math.round(shown) ? 1 : k === hovered ? 0.5 : 0;
      p.lift += (near - p.lift) * 0.1;
      p.group.position.y = spots[k].y + p.lift * 0.35 + (REDUCED ? 0 : Math.sin(t * 0.7 + k) * 0.06);
      p.faceMat.emissiveIntensity = 0.1 + p.lift * 0.25;
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
