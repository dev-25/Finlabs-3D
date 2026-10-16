import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================
 * OUR PARTNERS — the handshake
 * =====================================================
 * Two people meeting on a lit platform, hands joined in
 * the middle: ours in navy, theirs in red. Around them a
 * built landscape of blocks, slabs and panels — the
 * market infrastructure a partnership is actually made
 * of, stacked the way an isometric drawing stacks it.
 *
 * Drag it to turn it; let go and it eases back.
 * ===================================================== */

const host = document.querySelector('[data-partners-stage]');
const canvas = host?.querySelector('canvas');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const C = {
  deck: 0xa9cdf2, // the platform they stand on
  deckTop: 0xcbe2fb,
  edge: 0x5b8fd8,
  ours: 0x27335f, // our suit
  theirs: 0xd8443f, // the partner's jacket
  shirt: 0xeaf2ff,
  skin: 0xf1c6a4,
  hair: 0x1d2440,
  pale: 0xdfe8ff,
  glass: 0x7fb4ff,
  gold: 0xf5c451,
  block: 0x2f6fd0,
  blockDeep: 0x1d3f8f,
  blockLight: 0x7fb0f0,
  blockPurple: 0x4b3fa8,
  blockCyan: 0x35c6e8,
  accent: 0xe4484a,
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

  // --- the platform they meet on
  const deck = new THREE.Mesh(new RoundedBoxGeometry(6.4, 0.46, 6.4, 5, 0.16), solid(C.deck, { rough: 0.5 }));
  deck.position.y = -0.23;
  root.add(deck);
  const inlay = new THREE.Mesh(new RoundedBoxGeometry(5.5, 0.06, 5.5, 4, 0.1), solid(C.deckTop, { rough: 0.45 }));
  inlay.position.y = 0.03;
  root.add(inlay);
  // the faint circuitry printed on it
  const grid = new THREE.Group();
  for (let k = -2; k <= 2; k++) {
    [[5.0, 0.02, k * 1.1], [0.02, 5.0, k * 1.1]].forEach(([w, d, off], axis) => {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(axis ? 0.02 : 5.0, 0.012, axis ? 5.0 : 0.02),
        lamp(C.edge, 0.22)
      );
      line.position.set(axis ? off : 0, 0.07, axis ? 0 : off);
      grid.add(line);
    });
  }
  root.add(grid);

  // the lit disc each of them stands on
  function pad(x, z, color) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 10, 44), lamp(color, 0.75));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.08, z);
    root.add(ring);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(0.62, 44), lamp(color, 0.14));
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(x, 0.07, z);
    root.add(fill);
  }

  // --- the two of them
  const skinMat = solid(C.skin, { rough: 0.6 });
  const hairMat = solid(C.hair, { rough: 0.55 });
  const shirtMat = solid(C.shirt, { rough: 0.45 });
  const shoeMat = solid(0x161c33, { rough: 0.5 });

  /**
   * One person, built to meet the other: the near arm reaches for a point
   * between them, the far arm rests at the side.
   * @param {object} o
   * @param {number} o.x        where they stand
   * @param {number} o.face     the way they are turned, in radians
   * @param {number} o.jacket   jacket colour
   * @param {number} o.trousers trouser colour
   * @param {number} o.tie      tie colour
   * @param {number} o.reach    which way the shaking arm swings: 1 or -1
   */
  function person({ x, z, face, jacket, trousers, tie, reach }) {
    const g = new THREE.Group();
    g.position.set(x, 0.05, z);
    g.rotation.y = face;
    const jacketMat = solid(jacket, { rough: 0.5 });
    const trouserMat = solid(trousers, { rough: 0.5 });

    [-0.16, 0.16].forEach((lx) => {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.26, 1.0, 0.26, 4, 0.1), trouserMat);
      leg.position.set(lx, 0.52, 0);
      g.add(leg);
      const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.14, 0.42, 4, 0.06), shoeMat);
      shoe.position.set(lx, 0.07, 0.07);
      g.add(shoe);
    });

    const torso = new THREE.Mesh(new RoundedBoxGeometry(0.76, 1.0, 0.44, 5, 0.16), jacketMat);
    torso.position.y = 1.5;
    g.add(torso);
    // the shirt and tie showing between the lapels
    const shirt = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.7, 0.1, 4, 0.05), shirtMat);
    shirt.position.set(0, 1.62, 0.2);
    g.add(shirt);
    const tieMesh = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.46, 0.06, 3, 0.03), solid(tie, { rough: 0.4 }));
    tieMesh.position.set(0, 1.55, 0.25);
    g.add(tieMesh);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.14, 16), skinMat);
    neck.position.y = 2.06;
    g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 26, 20), skinMat);
    head.position.y = 2.32;
    g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.272, 26, 20, 0, Math.PI * 2, 0, 1.15), hairMat);
    hair.position.y = 2.34;
    g.add(hair);

    // the arm that rests at the side
    const rest = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.86, 0.22, 4, 0.08), jacketMat);
    rest.position.set(-reach * 0.46, 1.44, 0.02);
    rest.rotation.z = reach * 0.14;
    g.add(rest);

    // the arm that reaches. Both of them aim at the same point on their own
    // centre line, HAND, a little in front: stand them face to face HAND*2
    // apart and the two hands arrive in the same place.
    const upper = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.58, 0.21, 4, 0.08), jacketMat);
    upper.position.set(reach * 0.36, 1.58, 0.22);
    upper.rotation.set(0.62, 0, -reach * 0.42);
    g.add(upper);
    const fore = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.66, 0.19, 4, 0.08), jacketMat);
    fore.position.set(reach * 0.2, 1.33, 0.52);
    fore.rotation.set(1.22, 0, -reach * 0.55);
    g.add(fore);
    const cuff = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 14), skinMat);
    cuff.position.set(0.02, 1.26, HAND - 0.06);
    g.add(cuff);

    root.add(g);
    return g;
  }

  // They stand along the axis that runs left-to-right across this isometric
  // view, so both read in profile rather than one hiding behind the other.
  const HAND = 0.82; // how far in front of themselves each one reaches
  const AX = new THREE.Vector3(1, 0, -1).normalize();
  const hereA = AX.clone().multiplyScalar(-HAND);
  const hereB = AX.clone().multiplyScalar(HAND);
  const SHAKE = new THREE.Vector3(0, 1.26, 0); // where the hands meet

  pad(hereA.x, hereA.z, C.blockCyan);
  pad(hereB.x, hereB.z, C.accent);

  const us = person({
    x: hereA.x, z: hereA.z, face: Math.atan2(AX.x, AX.z),
    jacket: C.ours, trousers: 0x1b2748, tie: 0x9fb6e8, reach: 1,
  });
  const them = person({
    x: hereB.x, z: hereB.z, face: Math.atan2(-AX.x, -AX.z),
    jacket: C.theirs, trousers: 0x23304f, tie: 0xf3f6ff, reach: 1,
  });
  // the people lead the picture, so they stand a little above the blocks
  us.scale.setScalar(1.12);
  them.scale.setScalar(1.12);

  // the hands, joined
  const clasp = new THREE.Group();
  clasp.position.copy(SHAKE);
  root.add(clasp);
  const grip = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.26, 0.28, 5, 0.1), skinMat);
  grip.rotation.y = Math.atan2(AX.x, AX.z);
  clasp.add(grip);
  // the light that answers the grip
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), lamp(0xffffff, 0.9));
  clasp.add(spark);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 10, 48), lamp(C.blockCyan, 0.8));
  halo.rotation.x = Math.PI / 2;
  clasp.add(halo);

  // --- the built landscape behind them
  const blockMats = {
    blue: solid(C.block, { rough: 0.45 }),
    deep: solid(C.blockDeep, { rough: 0.5 }),
    light: solid(C.blockLight, { rough: 0.45 }),
    purple: solid(C.blockPurple, { rough: 0.5 }),
    cyan: solid(C.blockCyan, { rough: 0.4, glow: 0.12 }),
    red: solid(C.accent, { rough: 0.45 }),
    pale: solid(C.pale, { rough: 0.45 }),
  };

  // [x, y, z, w, h, d, material]
  const blocks = [
    [-3.5, 0.9, -2.2, 1.9, 1.9, 1.9, 'light'], // the big cube at the back left
    [-3.5, 2.3, -2.2, 1.3, 0.9, 1.3, 'blue'],
    [-4.3, 0.35, 0.4, 1.5, 0.75, 2.4, 'deep'], // the slab running forward
    [-3.0, 0.2, 2.4, 2.0, 0.45, 1.4, 'purple'],
    [3.4, 0.75, -2.4, 1.6, 1.6, 1.6, 'blue'], // the stack on the right
    [3.4, 1.85, -2.4, 1.1, 0.6, 1.1, 'cyan'],
    [4.0, 0.3, 0.6, 1.4, 0.65, 2.2, 'deep'],
    [3.1, 0.22, 2.4, 1.8, 0.45, 1.3, 'light'],
    [0.2, 1.5, -3.6, 2.2, 3.0, 0.7, 'deep'], // the tall panel directly behind
    [-1.9, 0.6, -3.4, 1.0, 1.2, 1.0, 'purple'],
    [1.9, 0.45, 3.1, 0.9, 0.9, 0.9, 'pale'],
  ];
  blocks.forEach(([bx, by, bz, w, h, d, mat]) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, 0.08), blockMats[mat]);
    m.position.set(bx, by, bz);
    root.add(m);
  });

  // the framed panel on the tall block, as the reference has it
  const wallPanel = new THREE.Mesh(new RoundedBoxGeometry(1.4, 1.4, 0.1, 4, 0.06), blockMats.pale);
  wallPanel.position.set(0.2, 1.9, -3.22);
  root.add(wallPanel);
  const frameInner = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), lamp(C.blockCyan, 0.5));
  frameInner.position.set(0.2, 1.9, -3.15);
  root.add(frameInner);

  // the red cube on its plinth, front and centre
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.16, 1.1, 4, 0.06), blockMats.pale);
  plinth.position.set(0, 0.14, 2.0);
  root.add(plinth);
  const redCube = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.62, 4, 0.1), blockMats.red);
  redCube.position.set(0, 0.55, 2.0);
  root.add(redCube);

  // and the case between them, the thing actually being handed over
  const caseG = new THREE.Group();
  caseG.position.set(-1.5, 0.42, 1.5);
  root.add(caseG);
  const caseBody = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.44, 0.34, 4, 0.08), blockMats.red);
  caseG.add(caseBody);
  const caseHandle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 20, Math.PI), solid(0x2a1b1b));
  caseHandle.position.y = 0.24;
  caseG.add(caseHandle);

  // small blocks drifting around the meeting
  const motes = [];
  const moteGeo = new RoundedBoxGeometry(0.26, 0.26, 0.26, 4, 0.07);
  [[-3.6, 2.9, 1.2, C.blockCyan], [3.6, 3.1, 0.8, C.accent], [-2.6, 3.4, -0.6, C.pale],
   [2.4, 3.6, -1.8, C.blockLight], [0.2, 4.0, 1.6, C.blockCyan]].forEach(([mx, my, mz, col], i) => {
    const m = new THREE.Mesh(moteGeo, solid(col, { glow: 0.25 }));
    m.position.set(mx, my, mz);
    m.userData = { y: my, i };
    root.add(m);
    motes.push(m);
  });

  // the arch standing behind it all
  const arch = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.05, 10, 80, Math.PI), lamp(C.glass, 0.4));
  arch.position.set(0, -0.2, -1.8);
  root.add(arch);

  // --- sizing: an orthographic frustum that holds the whole desk
  const FIT = 4.6; // close enough that the two of them lead the picture
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

    // the two of them settle, the grip lights, and the case waits between
    const breathe = Math.sin(t * 0.9);
    us.position.y = 0.05 + breathe * 0.02;
    them.position.y = 0.05 - breathe * 0.02;
    clasp.position.y = SHAKE.y + breathe * 0.015;
    const beat = (t % 5) / 5;
    const pulse = beat < 0.22 ? Math.max(0, 1 - beat * 4.5) : 0;
    spark.scale.setScalar(0.7 + pulse * 1.6);
    halo.scale.setScalar(1 + pulse * 1.8);
    halo.material.opacity = 0.8 * (1 - pulse * 0.7);

    redCube.rotation.y = t * 0.5;
    redCube.position.y = 0.55 + Math.sin(t * 1.1) * 0.05;
    caseG.position.y = 0.42 + Math.sin(t * 0.8 + 1) * 0.03;
    motes.forEach((m) => {
      const { y, i } = m.userData;
      m.position.y = y + Math.sin(t * 0.8 + i * 1.3) * 0.18;
      m.rotation.set(t * 0.4 + i, t * 0.5, 0);
    });

    renderer.render(scene, camera);
  }
  frame();
}
