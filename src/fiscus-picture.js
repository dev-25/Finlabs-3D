import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================
 * FISCUS — one clear picture, in 3D
 * =====================================================
 * What the app is for: four scattered corners of a
 * person's money — accounts, bills, investments and
 * spending — feeding along tracks into a single card.
 * Every card stands upright and faces the reader, so
 * the labels read straight on. It only animates while
 * the Fiscus screen is open, and stands still for
 * reduced motion.
 * ===================================================== */

const PX = 220; // canvas pixels per world unit
const FONT = '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

const SRC_W = 2.06;
const SRC_H = 0.8;
const DST_W = 2.66;
const DST_H = 1.46;
const SRC_X = -2.9;
const DST_X = 2.52;

const SOURCES = [
  { title: 'Bank & cards', sub: 'Balances in one place', y: 1.38 },
  { title: 'Bills', sub: 'Due and overdue', y: 0.46 },
  { title: 'Investments', sub: 'Equity, funds, deposits', y: -0.46 },
  { title: 'Expenses', sub: 'Tracked and categorised', y: -1.38 },
];

const BRAND = '#15629b';
const MINT = '#2bb598';

function label(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * PX);
  cv.height = Math.round(h * PX);
  draw(cv.getContext('2d'), cv);
  return cv;
}

function drawSource(cfg) {
  return label(SRC_W, SRC_H, (ctx, cv) => {
    const pad = 26;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = BRAND;
    ctx.beginPath();
    ctx.roundRect(pad, pad - 4, 7, cv.height - (pad - 4) * 2, 4);
    ctx.fill();
    const left = pad + 24;
    ctx.font = `700 34px ${FONT}`;
    ctx.fillStyle = '#123449';
    ctx.fillText(cfg.title, left, cv.height / 2 - 15);
    ctx.font = `500 25px ${FONT}`;
    ctx.fillStyle = '#5d7d90';
    ctx.fillText(cfg.sub, left, cv.height / 2 + 22);
  });
}

function drawTarget() {
  return label(DST_W, DST_H, (ctx, cv) => {
    const pad = 30;
    ctx.textBaseline = 'middle';
    ctx.font = `700 25px ${FONT}`;
    ctx.fillStyle = MINT;
    ctx.letterSpacing = '3px';
    ctx.fillText('FISCUS', pad, pad + 12);
    ctx.letterSpacing = '0px';
    ctx.font = `800 46px ${FONT}`;
    ctx.fillStyle = '#123449';
    ctx.fillText('One clear', pad, cv.height / 2 - 6);
    ctx.fillText('picture', pad, cv.height / 2 + 44);
    ctx.fillStyle = MINT;
    ctx.beginPath();
    ctx.roundRect(pad, cv.height - pad - 14, 58, 6, 3);
    ctx.fill();
  });
}

function shadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(10,46,70,0.38)');
  g.addColorStop(1, 'rgba(10,46,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

export function createPicture(canvas) {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null; // no WebGL: the stylesheet shows the plain list instead
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 90);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd6e6f2, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-1.5, 6, 6);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);

  const cardMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.12,
  });
  const faces = []; // kept so the labels can be redrawn once the web font lands

  function card(w, h, depth, canvasEl, redraw) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new RoundedBoxGeometry(w, h, depth, 4, 0.09), cardMat));
    const tex = new THREE.CanvasTexture(canvasEl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
    );
    face.position.z = depth / 2 + 0.002;
    g.add(face);
    faces.push({ tex, redraw });
    root.add(g);
    return g;
  }

  const sources = SOURCES.map((cfg) => {
    const g = card(SRC_W, SRC_H, 0.2, drawSource(cfg), () => drawSource(cfg));
    g.position.set(SRC_X, cfg.y, 0);
    return { group: g, y: cfg.y };
  });

  const target = card(DST_W, DST_H, 0.28, drawTarget(), drawTarget);
  target.position.set(DST_X, 0, 0.32);
  // a mint rail along its foot, so the destination reads as the answer
  const rail = new THREE.Mesh(
    new RoundedBoxGeometry(DST_W - 0.16, 0.08, 0.31, 3, 0.035),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(MINT) })
  );
  rail.position.set(0, -DST_H / 2 + 0.04, 0);
  target.add(rail);

  // the tracks the data travels, bending in from each corner
  const trackMat = new THREE.MeshBasicMaterial({ color: 0x9ec9dd });
  const runners = sources.map(({ y }, i) => {
    const from = new THREE.Vector3(SRC_X + SRC_W / 2 + 0.06, y, 0);
    const to = new THREE.Vector3(DST_X - DST_W / 2 - 0.06, y * 0.16, 0.32);
    const curve = new THREE.CatmullRomCurve3([
      from,
      new THREE.Vector3((from.x + to.x) / 2 - 0.5, y, 0.1),
      new THREE.Vector3((from.x + to.x) / 2 + 0.8, y * 0.5, 0.2),
      to,
    ]);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.018, 8, false), trackMat));
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 16, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? MINT : BRAND) })
    );
    root.add(dot);
    return { curve, dot, phase: i * 0.26 };
  });

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 13),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.4 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.4, -2.1, 0.2);
  root.add(shadow);

  const pointer = new THREE.Vector2();
  window.addEventListener(
    'pointermove',
    (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
    { passive: true }
  );

  const clock = new THREE.Clock();
  const at = new THREE.Vector3();
  let t = 0;

  function frame() {
    if (!canvas.clientWidth) return; // the list is standing in for it
    t += REDUCED ? 0 : Math.min(clock.getDelta(), 0.05);

    sources.forEach(({ group, y }, i) => {
      group.position.y = y + Math.sin(t * 0.85 + i * 0.8) * 0.03;
    });
    target.position.y = Math.sin(t * 0.7) * 0.04;
    runners.forEach(({ curve, dot, phase }) => {
      const k = (t * 0.16 + phase) % 1;
      curve.getPointAt(k, at);
      dot.position.copy(at);
      dot.visible = k > 0.02 && k < 0.98;
    });

    root.rotation.y += (pointer.x * 0.07 + Math.sin(t * 0.2) * 0.03 - root.rotation.y) * 0.05;
    root.rotation.x += (pointer.y * 0.02 - root.rotation.x) * 0.05;
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const halfW = Math.max(Math.abs(SRC_X) + SRC_W / 2, DST_X + DST_W / 2) + 0.12;
    const halfH = 1.38 + SRC_H / 2 + 0.12;
    const dist = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * 1.05 + 0.32;
    const el = THREE.MathUtils.degToRad(7);
    camera.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    frame();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // the labels are drawn with the site's font, which may land after this
  document.fonts?.ready.then(() => {
    faces.forEach(({ tex, redraw }) => {
      tex.image = redraw();
      tex.needsUpdate = true;
    });
    frame();
  });

  let running = false;
  function loop() {
    if (!running || document.hidden) {
      running = false;
      return;
    }
    requestAnimationFrame(loop);
    frame();
  }

  if (import.meta.env.DEV) window.__picture = { frame };

  return {
    start() {
      frame(); // always leave a drawn frame, even in a tab that is not animating
      if (running || REDUCED) return;
      running = true;
      clock.getDelta();
      requestAnimationFrame(loop);
    },
    stop() {
      running = false;
    },
    frame,
  };
}
