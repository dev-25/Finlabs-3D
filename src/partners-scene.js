import * as THREE from 'three';
import { Timer } from 'three';

/* =====================================================
 * OUR PARTNERS — the globe
 * =====================================================
 * Partners sit all over the map, so the page opens on
 * one: a dark globe whose land is printed as a matrix of
 * dots, a cage of meridians around it, and an arc
 * leaving Mumbai for each of the places this work has
 * reached. A pulse runs the length of every arc, the way
 * a message does.
 *
 * The land is drawn here rather than loaded: a set of
 * coarse coastline outlines painted into a canvas, then
 * sampled on a grid so only the land carries a dot. That
 * keeps the piece to one file with no texture to fetch.
 *
 * Drag it to spin the globe; let go and it keeps turning.
 * ===================================================== */

const host = document.querySelector('[data-partners-stage]');
const canvas = host?.querySelector('canvas');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const C = {
  sea: 0x101a3a, // the globe under the dots
  land: 0x3f7ddd, // the dots themselves
  landDim: 0x2a5bb0,
  cage: 0x4d7fd0, // meridians and parallels
  arc: 0x22d3ee,
  home: 0xf5c451, // Mumbai
  pin: 0x22d3ee,
  glow: 0x4f86ff,
};

/* ---------------------------------------------------------------
 * The world, as coarse outlines. Each entry is a ring of
 * [longitude, latitude] in degrees — enough points to carry the
 * silhouette of a continent at the size this globe is drawn, and no
 * more. Precision beyond that is wasted: the land is rendered as
 * dots, which round every edge anyway.
 * ------------------------------------------------------------- */
const LAND = [
  // Africa
  [[-17, 21], [-16, 14], [-13, 8], [-8, 4], [0, 5], [6, 4], [9, 4], [9, -1], [12, -5],
   [13, -11], [12, -17], [15, -23], [18, -29], [20, -34], [26, -34], [31, -30], [33, -26],
   [35, -21], [40, -15], [40, -10], [39, -5], [41, 0], [43, 5], [51, 11], [44, 12],
   [37, 15], [34, 20], [32, 24], [25, 31], [20, 31], [11, 33], [3, 36], [-5, 35],
   [-9, 32], [-13, 27], [-17, 21]],
  // Europe
  [[-9, 43], [-9, 38], [-6, 36], [0, 38], [4, 42], [8, 44], [12, 45], [14, 42], [18, 40],
   [21, 37], [24, 35], [27, 37], [30, 41], [36, 45], [40, 48], [45, 52], [48, 58],
   [44, 64], [34, 68], [28, 70], [22, 70], [16, 68], [12, 64], [10, 59], [8, 58],
   [12, 55], [10, 54], [5, 53], [0, 51], [-2, 48], [-5, 48], [-9, 43]],
  // Britain and Ireland
  [[-6, 50], [-3, 50], [0, 52], [-1, 55], [-3, 58], [-6, 58], [-5, 54], [-6, 50]],
  // Asia, north of the steppe
  [[45, 52], [52, 56], [60, 57], [70, 56], [78, 52], [86, 50], [94, 50], [102, 52],
   [112, 50], [120, 52], [128, 54], [136, 56], [142, 60], [148, 62], [158, 62],
   [162, 68], [172, 68], [178, 70], [170, 72], [150, 74], [130, 74], [110, 76],
   [90, 76], [70, 73], [60, 70], [55, 68], [48, 66], [44, 64], [48, 58], [45, 52]],
  // Asia, the southern half, with India
  [[45, 52], [48, 44], [52, 40], [56, 38], [60, 36], [62, 30], [66, 26], [70, 23],
   [72, 20], [73, 16], [77, 8], [80, 12], [82, 17], [86, 21], [89, 22], [92, 21],
   [95, 16], [99, 10], [104, 9], [107, 11], [109, 16], [112, 21], [117, 24], [121, 30],
   [122, 37], [127, 39], [129, 43], [133, 46], [138, 52], [142, 54], [136, 56],
   [128, 54], [120, 52], [112, 50], [102, 52], [94, 50], [86, 50], [78, 52], [70, 56],
   [60, 57], [52, 56], [45, 52]],
  // Japan
  [[131, 32], [136, 34], [140, 36], [142, 40], [145, 44], [141, 45], [138, 38],
   [134, 34], [131, 32]],
  // Indonesia and the islands
  [[96, 5], [104, 1], [112, -3], [118, -8], [124, -9], [131, -4], [127, 1], [120, 1],
   [112, 2], [104, 5], [96, 5]],
  // Australia
  [[114, -22], [113, -26], [116, -32], [120, -34], [129, -32], [135, -35], [140, -38],
   [147, -38], [151, -34], [153, -28], [146, -19], [142, -11], [136, -12], [130, -11],
   [125, -14], [122, -17], [114, -22]],
  // New Zealand
  [[166, -46], [171, -44], [174, -41], [177, -38], [175, -36], [172, -40], [168, -44],
   [166, -46]],
  // North America
  [[-168, 66], [-160, 71], [-150, 70], [-140, 70], [-128, 70], [-115, 69], [-100, 69],
   [-90, 68], [-80, 70], [-68, 66], [-64, 60], [-56, 54], [-60, 47], [-66, 45],
   [-70, 42], [-74, 39], [-76, 35], [-81, 31], [-80, 26], [-84, 30], [-90, 29],
   [-95, 29], [-97, 26], [-101, 22], [-105, 20], [-110, 24], [-114, 29], [-117, 33],
   [-122, 38], [-124, 44], [-124, 48], [-131, 54], [-138, 59], [-148, 60], [-155, 58],
   [-162, 60], [-166, 63], [-168, 66]],
  // Greenland
  [[-45, 60], [-35, 65], [-25, 70], [-20, 76], [-25, 82], [-40, 83], [-55, 82],
   [-60, 76], [-55, 68], [-45, 60]],
  // South America
  [[-81, 0], [-80, -5], [-76, -14], [-71, -18], [-70, -24], [-72, -32], [-73, -40],
   [-75, -48], [-71, -54], [-66, -55], [-64, -50], [-62, -42], [-58, -38], [-56, -34],
   [-48, -26], [-40, -21], [-35, -8], [-44, -2], [-50, 1], [-56, 5], [-61, 9],
   [-70, 11], [-77, 8], [-79, 2], [-81, 0]],
];

/* Where the work has reached. Mumbai is home; the rest are arcs out. */
const PLACES = [
  { name: 'Mumbai', lat: 19.08, lon: 72.88, home: true },
  { name: 'London', lat: 51.5, lon: -0.13 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Dubai', lat: 25.2, lon: 55.27 },
  { name: 'Accra', lat: 5.6, lon: -0.19 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
];

const R = 2.6; // the globe's radius

/** A point on the globe, from degrees. */
function onGlobe(lat, lon, radius = R) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

if (canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 1.6, 10.5);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x0b1026, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(5, 4, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x4f86ff, 1.4);
  rim.position.set(-7, 2, -5);
  scene.add(rim);

  const root = new THREE.Group();
  root.rotation.z = 0.24; // the axial tilt, so it reads as a planet
  scene.add(root);

  const globe = new THREE.Group();
  root.add(globe);

  // --- the sea
  const sea = new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 48),
    new THREE.MeshPhysicalMaterial({
      color: C.sea, roughness: 0.62, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.4,
    })
  );
  globe.add(sea);

  // --- the land, as a matrix of dots
  // The outlines are painted into a canvas first, then read back: a dot
  // goes wherever the canvas says land, which keeps the coastlines honest
  // without hand-placing thousands of points.
  const MAP_W = 1024;
  const MAP_H = 512;
  const mask = document.createElement('canvas');
  mask.width = MAP_W;
  mask.height = MAP_H;
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, MAP_W, MAP_H);
  mctx.fillStyle = '#fff';
  LAND.forEach((ring) => {
    mctx.beginPath();
    ring.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * MAP_W;
      const y = ((90 - lat) / 180) * MAP_H;
      i ? mctx.lineTo(x, y) : mctx.moveTo(x, y);
    });
    mctx.closePath();
    mctx.fill();
  });
  const pixels = mctx.getImageData(0, 0, MAP_W, MAP_H).data;
  const isLand = (lat, lon) => {
    const x = Math.floor(((lon + 180) / 360) * MAP_W) % MAP_W;
    const y = Math.floor(((90 - lat) / 180) * MAP_H);
    if (y < 0 || y >= MAP_H) return false;
    return pixels[(y * MAP_W + x) * 4] > 128;
  };

  // dots on an equal-area spiral, so they do not bunch at the poles
  const dotGeo = new THREE.SphereGeometry(0.022, 8, 6);
  const dotMat = new THREE.MeshBasicMaterial({ color: C.land, toneMapped: false });
  const dimMat = new THREE.MeshBasicMaterial({ color: C.landDim, toneMapped: false });
  const COUNT = 11000;
  const spots = [];
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const lat = Math.asin(y) * (180 / Math.PI);
    const lon = ((i * 137.508) % 360) - 180;
    if (isLand(lat, lon)) spots.push(onGlobe(lat, lon, R + 0.012));
  }
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, spots.length);
  const dim = new THREE.InstancedMesh(dotGeo, dimMat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  let bright = 0;
  let faint = 0;
  spots.forEach((p, i) => {
    m4.compose(p, q, one);
    if (i % 3) dots.setMatrixAt(bright++, m4);
    else dim.setMatrixAt(faint++, m4);
  });
  m4.compose(zero, q, zero);
  for (let i = bright; i < spots.length; i++) dots.setMatrixAt(i, m4);
  for (let i = faint; i < spots.length; i++) dim.setMatrixAt(i, m4);
  globe.add(dots, dim);

  // --- the cage: meridians and parallels over the sea
  const cageMat = new THREE.LineBasicMaterial({ color: C.cage, transparent: true, opacity: 0.18 });
  for (let k = 0; k < 12; k++) {
    const pts = [];
    for (let a = -90; a <= 90; a += 4) pts.push(onGlobe(a, k * 30, R + 0.006));
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cageMat));
  }
  [-60, -30, 0, 30, 60].forEach((lat) => {
    const pts = [];
    for (let a = -180; a <= 180; a += 4) pts.push(onGlobe(lat, a, R + 0.006));
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cageMat));
  });

  // --- the air around it
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.055, 48, 32),
    new THREE.MeshBasicMaterial({
      color: C.glow, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false,
    })
  );
  globe.add(halo);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(R * 1.28, 0.012, 8, 120),
    new THREE.MeshBasicMaterial({ color: C.arc, transparent: true, opacity: 0.35, toneMapped: false })
  );
  ring.rotation.x = Math.PI / 2.1;
  root.add(ring);

  // --- the places, and the arcs between them
  const home = PLACES.find((p) => p.home);
  const homeAt = onGlobe(home.lat, home.lon);
  const pins = [];
  const arcs = [];

  PLACES.forEach((place) => {
    const at = onGlobe(place.lat, place.lon, R + 0.02);
    const color = place.home ? C.home : C.pin;
    const pinMat = new THREE.MeshBasicMaterial({ color, toneMapped: false });

    const head = new THREE.Mesh(new THREE.SphereGeometry(place.home ? 0.075 : 0.055, 16, 12), pinMat);
    head.position.copy(at);
    globe.add(head);

    // the ring that sits flat on the surface under each pin
    const flat = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.115, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, toneMapped: false })
    );
    flat.position.copy(at);
    flat.lookAt(0, 0, 0);
    globe.add(flat);
    pins.push({ flat, head, home: !!place.home });

    if (place.home) return;

    // a great-circle arc, lifted off the surface by how far it travels
    const start = homeAt.clone();
    const end = onGlobe(place.lat, place.lon);
    const lift = 1 + start.angleTo(end) * 0.42;
    const mid = start.clone().add(end).multiplyScalar(0.5).setLength(R * lift);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const line = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 60, 0.016, 8, false),
      new THREE.MeshBasicMaterial({ color: C.arc, transparent: true, opacity: 0.5, toneMapped: false })
    );
    globe.add(line);

    // the pulse that runs it
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false })
    );
    globe.add(pulse);
    arcs.push({ curve, pulse, offset: Math.random() });
  });

  // --- a scatter of distant specks, for depth
  const specks = new THREE.Group();
  const speckGeo = new THREE.SphereGeometry(0.02, 6, 5);
  const speckMat = new THREE.MeshBasicMaterial({ color: 0x9fc0ff, transparent: true, opacity: 0.55, toneMapped: false });
  for (let i = 0; i < 60; i++) {
    const s = new THREE.Mesh(speckGeo, speckMat);
    const r = R * (1.6 + Math.random() * 1.5);
    const a = Math.random() * Math.PI * 2;
    const b = (Math.random() - 0.5) * Math.PI;
    s.position.set(Math.cos(b) * Math.cos(a) * r, Math.sin(b) * r * 0.7, Math.cos(b) * Math.sin(a) * r);
    specks.add(s);
  }
  scene.add(specks);

  // --- sizing
  function size() {
    const r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    // a narrow box needs the camera further out, or the globe is clipped
    camera.position.setZ(camera.aspect < 1 ? 12.5 : 10.5);
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener('resize', size);

  // --- drag to spin
  // open with Mumbai facing the reader, since that is where the work is: a
  // point sits at longitude L when the globe is turned to π/2 − θ(L)
  const FACE_HOME = Math.PI / 2 - ((home.lon + 180) * Math.PI) / 180;
  let spin = FACE_HOME;
  let spinTo = FACE_HOME;
  let dragging = false;
  let lastX = 0;

  host.style.touchAction = 'pan-y';
  host.addEventListener('pointerdown', (e) => {
    dragging = true;
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
  host.addEventListener('pointerleave', release);
  host.style.cursor = 'grab';

  let live = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { live = e.isIntersecting; }).observe(host);
  }

  // --- the loop
  const timer = new Timer();
  const at = new THREE.Vector3();

  function frame() {
    requestAnimationFrame(frame);
    if (!live) return;
    timer.update();
    const t = REDUCED ? 0 : timer.getElapsed();

    if (!dragging && !REDUCED) spinTo += 0.0022;
    spin += (spinTo - spin) * 0.08;
    globe.rotation.y = spin;
    ring.rotation.z = spin * 0.3;
    specks.rotation.y = spin * 0.2;

    // each message leaves, arrives, and leaves again
    arcs.forEach(({ curve, pulse, offset }) => {
      const u = (t * 0.22 + offset) % 1;
      curve.getPoint(u, at);
      pulse.position.copy(at);
      const fade = Math.sin(u * Math.PI);
      pulse.scale.setScalar(0.5 + fade * 0.9);
      pulse.material.opacity = fade;
    });

    // the pins breathe, Mumbai a little brighter than the rest
    pins.forEach(({ flat, head, home: isHome }, i) => {
      const beat = (Math.sin(t * 1.6 + i) + 1) / 2;
      flat.scale.setScalar(1 + beat * (isHome ? 0.7 : 0.45));
      flat.material.opacity = 0.8 - beat * 0.45;
      head.scale.setScalar(1 + beat * 0.12);
    });

    renderer.render(scene, camera);
  }
  frame();
}
