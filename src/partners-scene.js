import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================
 * OUR PARTNERS — the partner portal
 * =====================================================
 * An isometric desk carrying the tally stick: the way a
 * debt was recorded before banks kept ledgers, by
 * splitting a stick in two so each party held a half and
 * the grain matched only its true counterpart. One
 * record, two halves, and neither side can alter its own
 * without the seam showing it.
 *
 * The halves part and close on a slow beat, and the seam
 * lights as they lock. Around them the things a
 * partnership actually exchanges: a dashboard, a rising
 * chart, a ledger of transactions, a key.
 *
 * Dark in both browser modes, like the services piece.
 * Drag it to turn it; let go and it eases back.
 * ===================================================== */

const host = document.querySelector('[data-partners-stage]');
const canvas = host?.querySelector('canvas');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const C = {
  deck: 0x1b2748,
  deckTop: 0x243358,
  edge: 0x3d5390,
  ours: 0x2563eb,
  theirs: 0x22d3ee,
  pale: 0xdfe8ff,
  glass: 0x7fb4ff,
  gold: 0xf5c451,
};

if (canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  // an isometric view, the way the reference is drawn
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(9, 8.4, 9);
  camera.lookAt(0, 0.4, 0);

  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x16203c, 0.6);
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(6, 10, 7);
  const rim = new THREE.DirectionalLight(0x6ea8ff, 1.5);
  rim.position.set(-8, 3, -6);
  scene.add(hemi, key, rim);

  const root = new THREE.Group();
  scene.add(root);

  const solid = (color, { rough = 0.3, glow = 0, metal = 0 } = {}) =>
    new THREE.MeshPhysicalMaterial({
      color, roughness: rough, metalness: metal, clearcoat: 0.8, clearcoatRoughness: 0.2,
      emissive: color, emissiveIntensity: glow,
    });
  const lamp = (color, opacity = 1) =>
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false });

  const deckMat = solid(C.deck, { rough: 0.45 });
  const topMat = solid(C.deckTop, { rough: 0.5 });
  const oursMat = solid(C.ours, { glow: 0.12 });
  const theirsMat = solid(C.theirs, { glow: 0.12 });
  const paleMat = solid(C.pale, { rough: 0.35 });
  const edgeMat = lamp(C.edge, 0.9);

  // --- the desk it all stands on
  const deck = new THREE.Mesh(new RoundedBoxGeometry(7.6, 0.5, 5.4, 5, 0.18), deckMat);
  deck.position.y = -0.25;
  root.add(deck);
  const inlay = new THREE.Mesh(new RoundedBoxGeometry(6.8, 0.06, 4.6, 4, 0.1), topMat);
  inlay.position.y = 0.02;
  root.add(inlay);
  // a lit seam around the rim
  const seam = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.022, 8, 4), lamp(C.theirs, 0.55));
  seam.rotation.x = -Math.PI / 2;
  seam.rotation.z = Math.PI / 4;
  seam.scale.set(1.08, 0.78, 1);
  seam.position.y = -0.48;
  root.add(seam);

  // --- the tally stick: one record, split and held by both sides

  // the record, 2D: a rounded slab cut by a seam that climbs to the right
  // in three steps, so the split that proves the halves belong together
  // reads as a market line going up
  const REC = { w: 4.4, h: 2.8, r: 0.42, depth: 0.78 };
  const SEAM = [
    [-REC.w / 2, -0.30],
    [-0.78, -0.30],
    [-0.78, 0.12],
    [0.78, 0.12],
    [0.78, 0.54],
    [REC.w / 2, 0.54],
  ];

  /** One half of the record: the seam, then round the outside of the slab. */
  function halfShape(upper) {
    const { w, h, r } = REC;
    const sh = new THREE.Shape();
    const seam = upper ? [...SEAM] : [...SEAM].reverse();
    seam.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
    if (upper) {
      // ...up the right edge, across the top, down the left
      sh.lineTo(w / 2, h / 2 - r);
      sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      sh.lineTo(-w / 2 + r, h / 2);
      sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    } else {
      // ...down the left edge, along the bottom, up the right
      sh.lineTo(-w / 2, -h / 2 + r);
      sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      sh.lineTo(w / 2 - r, -h / 2);
      sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    }
    sh.closePath();
    return sh;
  }

  function halfMesh(upper, mat) {
    const geo = new THREE.ExtrudeGeometry(halfShape(upper), {
      depth: REC.depth,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: 0.05,
      bevelSegments: 3,
      curveSegments: 10,
    });
    // both halves are drawn in the same frame, so they must keep it: only
    // the extrusion's depth is re-centred
    geo.translate(0, 0, -REC.depth / 2);
    return new THREE.Mesh(geo, mat);
  }

  const stock = (color) =>
    new THREE.MeshPhysicalMaterial({
      color, roughness: 0.62, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.6,
      emissive: color, emissiveIntensity: 0.07,
    });

  const record = new THREE.Group();
  record.position.set(0, 1.5, 0);
  // square to the isometric camera, so the stepped seam reads as a staircase
  // rather than a foreshortened edge. The desk turns; the record holds its
  // face to the viewer (see the loop), because a mark that is only legible
  // for part of a turn is not a mark.
  record.rotation.y = Math.PI / 4;
  record.scale.setScalar(0.72); // sized to sit on the desk, not cover it
  root.add(record);

  const theirsHalf = halfMesh(true, stock(0x0e90aa)); // the partner's half, above the seam
  const oursHalf = halfMesh(false, stock(0x2558cf)); // ours, below it
  record.add(theirsHalf, oursHalf);

  // the light that runs along the seam when the two halves meet
  const seamGlow = new THREE.Mesh(
    new THREE.BoxGeometry(REC.w * 0.9, 0.035, REC.depth * 1.06),
    lamp(C.pale, 0.55)
  );
  seamGlow.position.y = 0.12;
  record.add(seamGlow);

  // it stands on a plinth, so the record reads as something kept, not dropped
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.26, 1.5, 4, 0.1), paleMat);
  plinth.position.y = 0.16;
  root.add(plinth);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 24), paleMat);
  stem.position.y = 0.42;
  root.add(stem);

  // --- what a partnership passes back and forth
  function panel(w, h, draw) {
    const tex = new THREE.CanvasTexture(
      (() => {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = Math.round((256 * h) / w);
        draw(c.getContext('2d'), c.width, c.height);
        return c;
      })()
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.07, 4, 0.06), solid(0x16203c, { rough: 0.4 }));
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.92, h * 0.88),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    face.position.z = 0.04;
    g.add(frame, face);
    return g;
  }

  const card = (ctx, w, h, body) => {
    ctx.fillStyle = '#0d1630';
    ctx.fillRect(0, 0, w, h);
    body(ctx, w, h);
  };

  // a rising chart
  const chart = panel(2.1, 1.35, (ctx, w, h) =>
    card(ctx, w, h, () => {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 7;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(22, h - 30);
      ctx.lineTo(70, h - 62);
      ctx.lineTo(116, h - 48);
      ctx.lineTo(168, h - 92);
      ctx.lineTo(w - 20, h - 112);
      ctx.stroke();
      ctx.fillStyle = 'rgba(37,99,235,0.45)';
      [30, 62, 94, 126].forEach((x, i) => ctx.fillRect(x, h - 24 - i * 6, 18, 18 + i * 6));
      ctx.fillStyle = 'rgba(223,232,255,0.5)';
      ctx.fillRect(20, 18, 86, 10);
    })
  );
  chart.position.set(-2.1, 2.5, -1.5);
  chart.rotation.set(0, 0.5, 0.04);
  root.add(chart);

  // a ledger of exchanges
  const ledger = panel(1.9, 1.5, (ctx, w, h) =>
    card(ctx, w, h, () => {
      ctx.fillStyle = 'rgba(223,232,255,0.5)';
      ctx.fillRect(18, 16, 70, 9);
      for (let i = 0; i < 5; i++) {
        const y = 42 + i * 24;
        ctx.fillStyle = 'rgba(223,232,255,0.16)';
        ctx.fillRect(18, y, w - 72, 12);
        ctx.fillStyle = i % 2 ? '#22d3ee' : '#2563eb';
        ctx.fillRect(w - 46, y, 28, 12);
      }
    })
  );
  ledger.position.set(2.2, 2.3, -1.4);
  ledger.rotation.set(0, -0.55, -0.04);
  root.add(ledger);

  // a dashboard lying on the desk
  const board = panel(2.4, 1.5, (ctx, w, h) =>
    card(ctx, w, h, () => {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(w * 0.26, h * 0.54, 32, -Math.PI / 2, Math.PI * 0.9);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(223,232,255,0.2)';
      ctx.beginPath();
      ctx.arc(w * 0.26, h * 0.54, 32, Math.PI * 0.9, Math.PI * 1.5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(223,232,255,0.45)';
      for (let i = 0; i < 4; i++) ctx.fillRect(w * 0.47, 30 + i * 26, w * 0.4 - (i % 2) * 28, 12);
    })
  );
  board.rotation.set(-Math.PI / 2, 0, 0.3);
  board.position.set(-1.1, 0.1, 1.5);
  root.add(board);

  // a key, because access is what partners actually trade
  const keyG = new THREE.Group();
  const keyMat = solid(C.gold, { rough: 0.25, metal: 0.9 });
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 14, 34), keyMat);
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.7, 14), keyMat);
  shank.position.y = -0.46;
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.09), keyMat);
  tooth.position.set(0.1, -0.72, 0);
  keyG.add(bow, shank, tooth);
  keyG.position.set(1.7, 0.75, 1.6);
  keyG.rotation.z = 0.5;
  root.add(keyG);

  // small blocks drifting around the desk
  const motes = [];
  const moteGeo = new RoundedBoxGeometry(0.26, 0.26, 0.26, 4, 0.07);
  [[-3.3, 1.9, 1.6, C.theirs], [3.4, 1.5, 1.5, C.ours], [-3.5, 0.7, -1.6, C.pale],
   [3.2, 2.8, -0.6, C.pale], [0.4, 3.3, 1.2, C.theirs]].forEach(([x, y, z, col], i) => {
    const m = new THREE.Mesh(moteGeo, solid(col, { glow: 0.25 }));
    m.position.set(x, y, z);
    m.userData = { y, i };
    root.add(m);
    motes.push(m);
  });

  // the portal's arch: a thin lit ring standing behind the desk, rather than
  // a dome over it — a shell that size simply hides what is inside
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.05, 10, 80, Math.PI), lamp(C.glass, 0.45));
  arch.position.set(0, -0.2, -1.4);
  root.add(arch);
  const archInner = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.025, 8, 70, Math.PI), lamp(C.theirs, 0.3));
  archInner.position.copy(arch.position);
  root.add(archInner);

  // --- sizing: an orthographic frustum that holds the whole desk
  const FIT = 4.9;
  function size() {
    const r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    renderer.setSize(r.width, r.height, false);
    const a = r.width / r.height;
    const h = a >= 1 ? FIT : FIT / a;
    camera.left = -h * a;
    camera.right = h * a;
    camera.top = h;
    camera.bottom = -h;
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener('resize', size);

  // --- interaction: drag to turn, let go and it comes back
  let spin = 0;
  let spinTo = 0;
  let dragging = false;
  let lastX = 0;
  let held = false;

  host.style.touchAction = 'pan-y';
  host.addEventListener('pointerdown', (e) => {
    dragging = held = true;
    lastX = e.clientX;
    host.setPointerCapture(e.pointerId);
    host.style.cursor = 'grabbing';
  });
  host.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    spinTo += (e.clientX - lastX) * 0.008;
    lastX = e.clientX;
  });
  const release = () => {
    dragging = false;
    host.style.cursor = 'grab';
  };
  host.addEventListener('pointerup', release);
  host.addEventListener('pointercancel', release);
  host.addEventListener('pointerleave', () => { held = false; release(); });
  host.addEventListener('pointerenter', () => { held = true; });
  host.style.cursor = 'grab';

  let live = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { live = e.isIntersecting; }).observe(host);
  }

  const timer = new Timer();
  function frame() {
    requestAnimationFrame(frame);
    if (!live) return;
    timer.update();
    const t = REDUCED ? 0 : timer.getElapsed();

    // it turns slowly by itself, and faster under a hand
    if (!dragging && !REDUCED) spinTo += 0.0016;
    spin += (spinTo - spin) * 0.08;
    root.rotation.y = spin;
    root.position.y = Math.sin(t * 0.7) * 0.06;
    // the desk turns around the record, not the record with it
    record.rotation.y = Math.PI / 4 - spin;

    // the halves draw apart, come back together, and the seam lights as
    // they lock — the tally proving itself, over and over
    const beat = (t % 5) / 5;
    const close = Math.min(1, beat / 0.3);
    const eased = 1 - (1 - close) ** 3;
    const apart = (1 - eased) * 0.55;
    theirsHalf.position.set(apart * 0.45, apart, 0);
    oursHalf.position.set(-apart * 0.45, -apart, 0);
    theirsHalf.rotation.z = apart * 0.06;
    oursHalf.rotation.z = -apart * 0.06;
    const pulse = beat > 0.3 ? Math.max(0, 1 - (beat - 0.3) * 4.5) : 0;
    seamGlow.material.opacity = 0.25 + pulse * 0.75;
    seamGlow.scale.set(1, 1 + pulse * 2.4, 1);

    chart.position.y = 2.5 + Math.sin(t * 0.9) * 0.1;
    ledger.position.y = 2.3 + Math.sin(t * 0.8 + 1.6) * 0.1;
    keyG.rotation.y = t * 0.8;
    keyG.position.y = 0.75 + Math.sin(t * 1.1) * 0.08;
    motes.forEach((m) => {
      const { y, i } = m.userData;
      m.position.y = y + Math.sin(t * 0.8 + i * 1.3) * 0.18;
      m.rotation.set(t * 0.4 + i, t * 0.5, 0);
    });

    renderer.render(scene, camera);
  }
  frame();
}
