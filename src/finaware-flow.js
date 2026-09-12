import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================
 * FINAWARE — the programme lifecycle, in 3D
 * =====================================================
 * The five stages an Investor Awareness Program passes
 * through, as cards on a shallow arc with the programme
 * running along the track beneath them. The cards stand
 * upright and turn to face the reader, so their labels
 * read wherever they sit on the arc. It only animates
 * while the Finaware screen is open, and stands still
 * for reduced motion.
 * ===================================================== */

const PX = 220; // canvas pixels per world unit
const FONT = '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

const CARD_W = 1.72;
const CARD_H = 1.2;
const STEP = 2.12;
const SPAN = STEP * 2; // the outermost card's distance from the middle

const STAGES = [
  { no: '01', title: 'Plan', sub: 'Create & schedule', accent: '#0f9b8e' },
  { no: '02', title: 'Approve', sub: 'Admin sign-off', accent: '#0f9b8e' },
  { no: '03', title: 'Deliver', sub: 'Online or offline', accent: '#f26722' },
  { no: '04', title: 'Attend', sub: 'QR check-in', accent: '#f26722' },
  { no: '05', title: 'Report', sub: 'Audit & invoice', accent: '#0f9b8e' },
];

// where a stage sits: a shallow arc, its ends nearer the reader
function stagePos(i) {
  const x = (i - (STAGES.length - 1) / 2) * STEP;
  const k = x / SPAN;
  return new THREE.Vector3(x, 0.16 * (1 - k * k), -0.75 * (1 - k * k));
}

function drawStage(cfg) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(CARD_W * PX);
  cv.height = Math.round(CARD_H * PX);
  const ctx = cv.getContext('2d');
  const pad = 30;

  ctx.textBaseline = 'middle';
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = cfg.accent;
  ctx.letterSpacing = '2px';
  ctx.fillText(cfg.no, pad, pad + 10);
  ctx.letterSpacing = '0px';

  ctx.font = `800 50px ${FONT}`;
  ctx.fillStyle = '#0d2f3a';
  ctx.fillText(cfg.title, pad, cv.height / 2 + 4);

  ctx.font = `600 30px ${FONT}`;
  ctx.fillStyle = '#5b7b85';
  ctx.fillText(cfg.sub, pad, cv.height - pad - 8);

  // a short accent rule under the stage name
  ctx.fillStyle = cfg.accent;
  ctx.beginPath();
  ctx.roundRect(pad, cv.height / 2 + 30, 46, 5, 3);
  ctx.fill();
  return cv;
}

function shadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(10,60,66,0.4)');
  g.addColorStop(1, 'rgba(10,60,66,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

export function createFlow(canvas) {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null; // no WebGL: the stylesheet shows the plain stage list instead
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 90);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd6ece8, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 6, 6);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);

  const cardMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.12,
  });

  const faces = []; // kept so the labels can be redrawn once the web font lands
  const depth = 0.3;

  const cards = STAGES.map((cfg, i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new RoundedBoxGeometry(CARD_W, CARD_H, depth, 4, 0.1), cardMat));

    const tex = new THREE.CanvasTexture(drawStage(cfg));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
    );
    face.position.z = depth / 2 + 0.002;
    g.add(face);
    faces.push({ cfg, tex });

    // the stage's colour, along the card's foot
    const rail = new THREE.Mesh(
      new RoundedBoxGeometry(CARD_W - 0.14, 0.07, depth + 0.03, 3, 0.03),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.accent) })
    );
    rail.position.set(0, -CARD_H / 2 + 0.035, 0);
    g.add(rail);

    g.position.copy(stagePos(i));
    root.add(g);
    return { group: g, base: stagePos(i), phase: i * 0.7 };
  });

  // the track the programme runs along, under the cards
  const curve = new THREE.CatmullRomCurve3(
    STAGES.map((_, i) => stagePos(i).add(new THREE.Vector3(0, -CARD_H / 2 - 0.34, 0)))
  );
  const track = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 120, 0.022, 8, false),
    new THREE.MeshBasicMaterial({ color: 0x8ecfc9 })
  );
  root.add(track);

  const runner = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xf26722 })
  );
  root.add(runner);

  // a tick of progress under each stage the programme has passed
  const pips = STAGES.map((cfg, i) => {
    const pip = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 18, 14),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.accent), transparent: true })
    );
    const p = stagePos(i);
    pip.position.set(p.x, p.y - CARD_H / 2 - 0.34, p.z);
    root.add(pip);
    return pip;
  });

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 13),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.4 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -CARD_H / 2 - 0.5, -0.3);
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

    cards.forEach(({ group, base, phase }) => {
      group.position.y = base.y + Math.sin(t * 0.8 + phase) * 0.035;
      // upright, turned toward the reader, so every label reads
      group.rotation.y = Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z);
    });

    // the programme travelling from planning through to billing
    const k = (t * 0.11) % 1;
    curve.getPointAt(k, at);
    runner.position.copy(at);
    pips.forEach((pip, i) => {
      const reached = k >= i / (STAGES.length - 1) - 0.02;
      pip.scale.setScalar(reached ? 1.15 : 0.6);
      pip.material.opacity = reached ? 1 : 0.4;
    });

    root.rotation.y += (pointer.x * 0.07 + Math.sin(t * 0.2) * 0.03 - root.rotation.y) * 0.05;
    root.rotation.x += (pointer.y * 0.02 + 0.03 - root.rotation.x) * 0.05;
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
    // the outermost cards stand nearest the reader, so they set the framing
    const halfW = SPAN + CARD_W / 2 + 0.15;
    const halfH = CARD_H / 2 + 0.5;
    const dist = Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * 1.06;
    const el = THREE.MathUtils.degToRad(9);
    camera.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist);
    camera.lookAt(0, -0.08, -0.3);
    camera.updateProjectionMatrix();
    frame();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // the labels are drawn with the site's font, which may land after this
  document.fonts?.ready.then(() => {
    faces.forEach(({ cfg, tex }) => {
      tex.image = drawStage(cfg);
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

  if (import.meta.env.DEV) window.__flow = { frame };

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
