import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================
 * CASE STUDIES — five platforms, one engagement each
 * =====================================================
 * An isometric run of arrow-shaped slabs, stepping down
 * and up across the frame, each one a piece of work: the
 * client's floor, the people on it and the thing we
 * built. A leader line rises or drops from each slab to
 * its label, which is real HTML positioned over the
 * canvas, so the words stay crisp and readable.
 *
 * Hover or click a slab to bring it forward; the page
 * below opens that study. Arrow keys walk the run.
 * ===================================================== */

const host = document.querySelector('[data-case-stage]');
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
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -80, 120);
  camera.position.set(14, 11.5, 14);
  camera.lookAt(0, -0.8, 0);

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
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9ec9ff, roughness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1,
  });

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

  // =====================================================
  // THE ARROW SLABS
  // =====================================================

  /** The arrow outline: a bar with a point on one end and the matching
   *  notch cut from the other, so the run reads as one chain. */
  function arrowShape(w, d, point) {
    const s = new THREE.Shape();
    const hw = w / 2;
    const hd = d / 2;
    s.moveTo(-hw, -hd);
    s.lineTo(hw - point, -hd);
    s.lineTo(hw, 0);
    s.lineTo(hw - point, hd);
    s.lineTo(-hw, hd);
    s.lineTo(-hw + point, 0);
    s.closePath();
    return s;
  }

  const SLAB_W = 5.2;
  const SLAB_D = 3.5;
  const POINT = 1.45;
  const THICK = 0.42;

  const slabGeo = new THREE.ExtrudeGeometry(arrowShape(SLAB_W, SLAB_D, POINT), {
    depth: THICK, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2,
  });
  // laying the extrusion flat already puts its top face at y = THICK, so
  // there is nothing further to translate — anything placed at THICK sits on
  // the surface rather than inside the slab
  slabGeo.rotateX(-Math.PI / 2);

  // the big number pressed into each slab
  function numberTex(n) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.font = '800 200px Outfit, "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // white, with a dark edge, so it carries on any of the five slab colours
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

  // where each slab sits: across in x, stepping down and up in z
  const STEP_X = 4.0;
  const STEP_Z = 2.15;
  const slabs = [];

  CASES.forEach((c, i) => {
    const g = new THREE.Group();
    const home = new THREE.Vector3((i - 2) * STEP_X, 0, (i % 2 ? 1 : -1) * STEP_Z);
    g.position.copy(home);
    root.add(g);

    const faceMat = mat(c.tint, { rough: 0.34, glow: 0.12 });
    const slab = new THREE.Mesh(slabGeo, faceMat);
    g.add(slab);

    // the darker underside, so the slab reads as a solid block
    const under = new THREE.Mesh(slabGeo, mat(c.deep, { rough: 0.6 }));
    under.scale.set(0.99, 1, 0.99);
    under.position.y = -0.2;
    g.add(under);

    // its number, lying on the surface at the blunt end
    const numGeo = new THREE.PlaneGeometry(2.0, 2.0);
    numGeo.rotateX(-Math.PI / 2); // lie flat, face up
    numGeo.rotateY(Math.PI / 2); // and turn the digit along the slab
    const num = new THREE.Mesh(
      numGeo,
      new THREE.MeshBasicMaterial({
        map: numberTex(i + 1), transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    num.position.set(-SLAB_W / 2 + 1.55, THICK + 0.07, 0.95);
    g.add(num);

    // what is happening on this floor
    const vig = new THREE.Group();
    vig.position.set(0.65, THICK, -0.25);
    g.add(vig);
    buildVignette(c.vignette, c.tint, vig);

    // the line up or down to its label
    const up = i % 2 === 0;
    const lead = new THREE.Group();
    const H = 2.35;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, H, 6),
      flat(0xa8c6ff, 0.5)
    );
    post.position.set(0, up ? THICK + H / 2 : -H / 2, up ? -SLAB_D / 2 + 0.4 : SLAB_D / 2 - 0.4);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), flat(c.tint));
    dot.position.set(0, up ? THICK + H : -H, post.position.z);
    lead.add(post, dot);
    g.add(lead);

    slabs.push({ ...c, group: g, slab, faceMat, home, anchor: dot, up, index: i, lift: 0 });
  });

  function buildVignette(kind, tint, into) {
    const tintMat = mat(tint, { rough: 0.4 });
    if (kind === 'advice') {
      // an adviser at a desk, a client across from it
      const d = desk(1.7, 0.9);
      d.position.set(-0.5, 0, 0.1);
      into.add(d);
      const m = monitor(bars, 1.0, 0.62);
      m.position.set(-0.7, 0.45, 0.1);
      m.rotation.y = 0.5;
      into.add(m);
      const a = figure(suitMats[0]);
      a.position.set(-1.5, 0, -0.5);
      a.rotation.y = 0.9;
      into.add(a);
      const b = figure(suitMats[1], { arm: 0.35 });
      b.position.set(0.9, 0, 0.5);
      b.rotation.y = -1.9;
      into.add(b);
      const cube = new THREE.Mesh(box(0.34, 0.34, 0.34, 0.06), tintMat);
      cube.position.set(1.4, 0.17, -0.7);
      cube.rotation.y = 0.5;
      into.add(cube);
    } else if (kind === 'kiosk') {
      // a subscriber at a self-service column, staff beside it
      const r = rack(tint);
      r.position.set(-0.4, 0, -0.3);
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
      b.position.set(-1.5, 0, 0.6);
      b.rotation.y = 0.6;
      into.add(b);
    } else if (kind === 'planning') {
      // someone presenting a plan on a board
      const bd = board(tint, curve);
      bd.position.set(-0.6, 0, -0.4);
      bd.rotation.y = 0.3;
      into.add(bd);
      const a = figure(suitMats[0], { arm: 0.5 });
      a.position.set(0.5, 0, -0.1);
      a.rotation.y = -0.6;
      into.add(a);
      const b = figure(suitMats[1]);
      b.position.set(1.3, 0, 0.7);
      b.rotation.y = -1.6;
      into.add(b);
      const stack = new THREE.Group();
      [0, 1, 2].forEach((k) => {
        const s = new THREE.Mesh(box(0.5, 0.1, 0.36, 0.02), k === 1 ? tintMat : paleMat);
        s.position.y = 0.05 + k * 0.11;
        stack.add(s);
      });
      stack.position.set(-1.6, 0, 0.8);
      into.add(stack);
    } else if (kind === 'branch') {
      // a branch counter with staff on both sides
      const t = table(tint);
      t.position.set(0, 0, 0);
      into.add(t);
      const a = figure(suitMats[1]);
      a.position.set(-1.3, 0, 0.4);
      a.rotation.y = 1.2;
      into.add(a);
      const b = figure(suitMats[2], { arm: 0.4 });
      b.position.set(1.25, 0, -0.35);
      b.rotation.y = -1.4;
      into.add(b);
      const c2 = figure(suitMats[3]);
      c2.position.set(0.2, 0, 1.1);
      c2.rotation.y = Math.PI;
      into.add(c2);
      const m = monitor(rows, 0.8, 0.52);
      m.position.set(-1.4, 0.5, -0.8);
      m.rotation.y = 0.8;
      into.add(m);
    } else {
      // a marketplace: a big board of listings and a buyer
      const bd = board(tint, rows);
      bd.position.set(-0.2, 0, -0.6);
      bd.rotation.y = -0.15;
      into.add(bd);
      const m = monitor(donut, 1.1, 0.7);
      m.position.set(1.3, 0.4, 0.2);
      m.rotation.y = -0.7;
      into.add(m);
      const a = figure(suitMats[2], { arm: 0.3 });
      a.position.set(-1.4, 0, 0.6);
      a.rotation.y = 0.5;
      into.add(a);
      const b = figure(suitMats[0]);
      b.position.set(0.35, 0, 0.9);
      b.rotation.y = -0.2;
      into.add(b);
    }
  }

  // the floor's soft shadow under the whole run
  const shadeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(10,20,50,0.5)');
    g.addColorStop(1, 'rgba(10,20,50,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  slabs.forEach((s) => {
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 6),
      new THREE.MeshBasicMaterial({ map: shadeTex, transparent: true, depthWrite: false })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(s.home.x, -0.62, s.home.z + 0.3);
    root.add(sh);
  });

  // =====================================================
  // SIZE
  // =====================================================

  const FIT_X = 11.6; // half-width of the run, in world units
  function size() {
    const r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    renderer.setSize(r.width, r.height, false);
    const a = r.width / r.height;
    // keep the whole run in frame however the box is shaped
    const halfW = Math.max(FIT_X, 6.6 * a);
    const halfH = halfW / a;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener('resize', size);

  // =====================================================
  // PICKING, AND THE LABELS OVER THE TOP
  // =====================================================

  const labels = [...host.parentElement.querySelectorAll('[data-case-label]')];
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = -1;
  let active = 0;

  const listeners = new Set();
  function announce() {
    listeners.forEach((fn) => fn(CASES[active].id, active));
  }
  window.__caseSelect = (i) => {
    active = Math.max(0, Math.min(slabs.length - 1, i));
    announce();
  };
  window.__onCaseSelect = (fn) => {
    listeners.add(fn);
    fn(CASES[active].id, active);
  };

  function pick(e) {
    const r = host.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(slabs.map((s) => s.slab), false)[0];
    return hit ? slabs.findIndex((s) => s.slab === hit.object) : -1;
  }

  host.addEventListener('pointermove', (e) => {
    hovered = pick(e);
    host.style.cursor = hovered >= 0 ? 'pointer' : 'grab';
  });
  host.addEventListener('pointerleave', () => { hovered = -1; });
  host.addEventListener('click', (e) => {
    const i = pick(e);
    if (i >= 0) window.__caseSelect(i);
  });

  // drag to turn the whole run a little, the way an isometric board tips
  let turn = 0;
  let turnTo = 0;
  let dragging = false;
  let lastX = 0;
  host.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    turnTo = Math.max(-0.5, Math.min(0.5, turnTo + (e.clientX - lastX) * 0.004));
    lastX = e.clientX;
  });
  const stop = () => { dragging = false; };
  host.addEventListener('pointerup', stop);
  host.addEventListener('pointercancel', stop);
  host.style.cursor = 'grab';

  host.tabIndex = 0;
  host.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') window.__caseSelect(active + 1);
    else if (e.key === 'ArrowLeft') window.__caseSelect(active - 1);
    else return;
    e.preventDefault();
  });

  let live = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { live = e.isIntersecting; }).observe(host);
  }

  // =====================================================
  // LOOP
  // =====================================================

  const timer = new Timer();
  const screen = new THREE.Vector3();

  function frame() {
    requestAnimationFrame(frame);
    if (!live) return;
    timer.update();
    const t = REDUCED ? 0 : timer.getElapsed();

    turn += (turnTo - turn) * 0.08;
    root.rotation.y = turn;

    slabs.forEach((s, i) => {
      const want = i === active ? 1 : i === hovered ? 0.55 : 0;
      s.lift += (want - s.lift) * 0.12;
      s.group.position.y = s.home.y + s.lift * 0.6 + (REDUCED ? 0 : Math.sin(t * 0.8 + i) * 0.04);
      s.faceMat.emissiveIntensity = 0.12 + s.lift * 0.3;
      s.slab.scale.setScalar(1 + s.lift * 0.015);
    });

    // put each label where its leader line ends
    const r = host.getBoundingClientRect();
    labels.forEach((el, i) => {
      const s = slabs[i];
      if (!s) return;
      s.anchor.getWorldPosition(screen);
      screen.project(camera);
      const x = (screen.x * 0.5 + 0.5) * r.width;
      const y = (-screen.y * 0.5 + 0.5) * r.height;
      el.style.transform = `translate(-50%, ${s.up ? '-100%' : '0'}) translate(${x}px, ${y}px)`;
      el.classList.toggle('is-active', i === active);
    });

    renderer.render(scene, camera);
  }
  frame();
}
