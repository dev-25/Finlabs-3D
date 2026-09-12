import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================
 * LEARNGENIE — the learning journey, in 3D
 * =====================================================
 * A learner's path as a climb: four cards stepping up
 * and back, joined by a ribbon, with badges waiting at
 * the top. The cards stand upright and face the reader,
 * so their labels read straight on. It only animates
 * while the Learngenie screen is open, and stands still
 * for reduced motion.
 * ===================================================== */

const PX = 220; // canvas pixels per world unit
const FONT = '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

const CARD_W = 2.18;
const CARD_H = 1.08;
const INDIGO = '#5b5bd6';
const AMBER = '#f9a825';

const STEPS = [
  { no: '01', title: 'Learning path', sub: 'Personalised journey', x: -3.36, y: -1.2, z: 0.52 },
  { no: '02', title: 'Learn', sub: 'Self-paced and live', x: -1.12, y: -0.4, z: 0.17 },
  { no: '03', title: 'Assess', sub: 'Exams and assignments', x: 1.12, y: 0.4, z: -0.17 },
  { no: '04', title: 'Certify', sub: 'Badges and certificates', x: 3.36, y: 1.2, z: -0.52 },
];

function drawStep(cfg) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(CARD_W * PX);
  cv.height = Math.round(CARD_H * PX);
  const ctx = cv.getContext('2d');
  const pad = 28;
  const accent = cfg.no === '04' ? AMBER : INDIGO;

  ctx.textBaseline = 'middle';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = accent;
  ctx.letterSpacing = '2px';
  ctx.fillText(cfg.no, pad, pad + 8);
  ctx.letterSpacing = '0px';

  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = '#211d47';
  ctx.fillText(cfg.title, pad, cv.height / 2 + 6);

  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = '#5e5b85';
  ctx.fillText(cfg.sub, pad, cv.height - pad - 6);

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(pad, cv.height / 2 + 30, 44, 5, 3);
  ctx.fill();
  return cv;
}

function shadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(33,29,71,0.35)');
  g.addColorStop(1, 'rgba(33,29,71,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

// a rounded five-pointed star, for the badges at the summit
function starShape(outer, inner) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function createClimb(canvas) {
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

  scene.add(new THREE.HemisphereLight(0xffffff, 0xdedaf5, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-1, 6, 6);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);

  const cardMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.12,
  });
  const faces = []; // kept so the labels can be redrawn once the web font lands
  const depth = 0.28;

  const steps = STEPS.map((cfg) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new RoundedBoxGeometry(CARD_W, CARD_H, depth, 4, 0.1), cardMat));

    const tex = new THREE.CanvasTexture(drawStep(cfg));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
    );
    face.position.z = depth / 2 + 0.002;
    g.add(face);
    faces.push({ cfg, tex });

    const rail = new THREE.Mesh(
      new RoundedBoxGeometry(CARD_W - 0.14, 0.07, depth + 0.03, 3, 0.03),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.no === '04' ? AMBER : INDIGO) })
    );
    rail.position.set(0, -CARD_H / 2 + 0.035, 0);
    g.add(rail);

    g.position.set(cfg.x, cfg.y, cfg.z);
    root.add(g);
    return { group: g, cfg };
  });

  // the ribbon the learner climbs, passing under each step
  const curve = new THREE.CatmullRomCurve3(
    STEPS.map((c) => new THREE.Vector3(c.x, c.y - CARD_H / 2 - 0.3, c.z))
  );
  root.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(curve, 140, 0.026, 8, false),
      new THREE.MeshBasicMaterial({ color: 0xb9b6ee })
    )
  );
  const learner = new THREE.Mesh(
    new THREE.SphereGeometry(0.082, 18, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(AMBER) })
  );
  root.add(learner);

  // the badges earned at the summit
  const badgeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(AMBER), roughness: 0.3, metalness: 0.25, clearcoat: 1,
  });
  const badgeGeo = new THREE.ExtrudeGeometry(starShape(0.26, 0.11), {
    depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2,
  });
  const badges = [0, 1, 2].map((i) => {
    const b = new THREE.Mesh(badgeGeo, badgeMat);
    b.position.set(STEPS[3].x - 0.55 + i * 0.55, STEPS[3].y + CARD_H / 2 + 0.5, STEPS[3].z);
    root.add(b);
    return { mesh: b, phase: i * 0.9 };
  });

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.38 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -2.3, 0.1);
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

    steps.forEach(({ group, cfg }, i) => {
      group.position.y = cfg.y + Math.sin(t * 0.8 + i * 0.8) * 0.032;
    });
    const k = (t * 0.12) % 1;
    curve.getPointAt(k, at);
    learner.position.copy(at);
    badges.forEach(({ mesh, phase }) => {
      mesh.position.y = STEPS[3].y + CARD_H / 2 + 0.5 + Math.sin(t * 1.1 + phase) * 0.06;
      mesh.rotation.y = Math.sin(t * 0.5 + phase) * 0.5;
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
    const halfW = 3.36 + CARD_W / 2 + 0.12;
    const halfH = 1.2 + CARD_H / 2 + 0.78; // the badges sit above the last card
    const dist = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * 1.05 + 0.5;
    const el = THREE.MathUtils.degToRad(7);
    camera.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist);
    camera.lookAt(0, 0.12, 0);
    camera.updateProjectionMatrix();
    frame();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // the labels are drawn with the site's font, which may land after this
  document.fonts?.ready.then(() => {
    faces.forEach(({ cfg, tex }) => {
      tex.image = drawStep(cfg);
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

  if (import.meta.env.DEV) window.__climb = { frame };

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
