import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================
 * FINEXA GenNxt — the functional architecture, in 3D
 * =====================================================
 * The platform's three layers as three panels stacked in
 * space: channels on top, the app components in the
 * middle, data and integrations underneath. Data runs up
 * the risers between them.
 *
 * The panels stand upright and face the reader, the way
 * the Finexa hub's cards do, so every word reads without
 * perspective squashing it — the depth comes from their
 * thickness, their stagger and the light. It only
 * animates while the GenNxt screen is open, and stands
 * still for reduced motion.
 * ===================================================== */

const PX = 210; // canvas pixels per world unit
const FONT = '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

const LAYERS = [
  {
    title: 'CHANNELS / PRESENTATION',
    items: ['Front office', 'Back office', 'External interfaces'],
    accent: '#6b5ce7',
    w: 5.0,
    h: 1.12,
    y: 1.82,
    z: 0,
  },
  {
    title: 'KEY APP COMPONENTS',
    items: [
      'User management',
      'Data aggregation',
      'Portfolio insights',
      'Model portfolios',
      'Reporting & dashboard',
      'Revenue & reconciliation',
    ],
    accent: '#2f6fd0',
    w: 6.0,
    h: 1.56,
    y: 0,
    z: 0.4,
  },
  {
    title: 'DATA & INTEGRATIONS',
    items: ['BSE StAR / MFU', 'KYC APIs', 'Security data providers'],
    accent: '#12a594',
    w: 5.0,
    h: 1.12,
    y: -1.82,
    z: 0,
  },
];

// the layer's name and its parts, printed on the panel's face
function drawLayer(cfg) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(cfg.w * PX);
  cv.height = Math.round(cfg.h * PX);
  const ctx = cv.getContext('2d');
  const pad = 30;
  const barW = 9;
  const left = pad + barW + 20;

  // an accent bar down the left edge
  ctx.fillStyle = cfg.accent;
  ctx.beginPath();
  ctx.roundRect(pad, pad, barW, cv.height - pad * 2, barW / 2);
  ctx.fill();

  ctx.textBaseline = 'middle';
  ctx.font = `700 32px ${FONT}`;
  ctx.fillStyle = cfg.accent;
  ctx.letterSpacing = '3px';
  ctx.fillText(cfg.title, left, pad + 22);
  ctx.letterSpacing = '0px';

  // the parts, as pills wrapped into rows below the name
  ctx.font = `600 32px ${FONT}`;
  const chipH = 62;
  const gap = 13;
  const room = cv.width - left - pad;
  const chips = cfg.items.map((text) => ({ text, w: ctx.measureText(text).width + 52 }));
  const rows = [];
  let row = [];
  let width = 0;
  chips.forEach((chip) => {
    if (row.length && width + gap + chip.w > room) {
      rows.push(row);
      row = [];
      width = 0;
    }
    width += (row.length ? gap : 0) + chip.w;
    row.push(chip);
  });
  if (row.length) rows.push(row);

  const blockH = rows.length * chipH + (rows.length - 1) * gap;
  let y = pad + 52 + (cv.height - pad * 2 - 52 - blockH) / 2;
  rows.forEach((cells) => {
    let x = left;
    cells.forEach((chip) => {
      ctx.fillStyle = `${cfg.accent}1f`;
      ctx.beginPath();
      ctx.roundRect(x, y, chip.w, chipH, chipH / 2);
      ctx.fill();
      ctx.strokeStyle = `${cfg.accent}4d`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#0b2c3f';
      ctx.fillText(chip.text, x + 26, y + chipH / 2 + 1);
      x += chip.w + gap;
    });
    y += chipH + gap;
  });
  return cv;
}

function shadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(12,44,70,0.4)');
  g.addColorStop(1, 'rgba(12,44,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

export function createStack(canvas) {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null; // no WebGL: the stylesheet shows the plain layer list instead
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd3e2f2, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2.5, 6, 6);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);

  const panelMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.12,
  });

  const faces = []; // kept so the labels can be redrawn once the web font lands

  const layers = LAYERS.map((cfg) => {
    const g = new THREE.Group();
    const depth = 0.26;
    g.add(new THREE.Mesh(new RoundedBoxGeometry(cfg.w, cfg.h, depth, 4, 0.09), panelMat));

    const tex = new THREE.CanvasTexture(drawLayer(cfg));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.w, cfg.h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
    );
    face.position.z = depth / 2 + 0.002;
    g.add(face);
    faces.push({ cfg, tex });

    // a thin accent rail along the bottom edge, for colour in the round
    const rail = new THREE.Mesh(
      new RoundedBoxGeometry(cfg.w - 0.16, 0.07, depth + 0.03, 3, 0.03),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.accent) })
    );
    rail.position.set(0, -cfg.h / 2 + 0.035, 0);
    g.add(rail);

    g.position.set(0, cfg.y, cfg.z);
    root.add(g);
    return { group: g, cfg };
  });

  // risers joining the panels, with data running up them
  const pillarMat = new THREE.MeshBasicMaterial({ color: 0x9ec4e8, transparent: true, opacity: 0.6 });
  const dots = [];
  for (let i = 0; i < LAYERS.length - 1; i++) {
    const top = LAYERS[i];
    const bottom = LAYERS[i + 1];
    const from = bottom.y + bottom.h / 2;
    const to = top.y - top.h / 2;
    const span = to - from;
    const x = Math.min(top.w, bottom.w) / 2 - 0.5;
    [-x, x].forEach((px, k) => {
      const z = (top.z + bottom.z) / 2;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, span, 8), pillarMat);
      pillar.position.set(px, (from + to) / 2, z);
      root.add(pillar);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(bottom.accent) })
      );
      root.add(dot);
      dots.push({ mesh: dot, x: px, z, from, to, phase: (k + i * 2) * 0.4 });
    });
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.45 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -2.5, 0.2);
  root.add(shadow);

  const pointer = new THREE.Vector2();
  window.addEventListener(
    'pointermove',
    (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
    { passive: true }
  );

  const clock = new THREE.Clock();
  let t = 0;

  function frame() {
    if (!canvas.clientWidth) return; // the list is standing in for it
    t += REDUCED ? 0 : Math.min(clock.getDelta(), 0.05);

    layers.forEach(({ group, cfg }, i) => {
      group.position.y = cfg.y + Math.sin(t * 0.8 + i * 0.9) * 0.04;
    });
    dots.forEach((d) => {
      const k = (t * 0.3 + d.phase) % 1;
      d.mesh.position.set(d.x, d.from + (d.to - d.from) * k, d.z);
      d.mesh.visible = k > 0.04 && k < 0.96;
    });

    // a gentle turn only — enough to show the panels' thickness, never
    // enough to lean the words out of true
    root.rotation.y += (pointer.x * 0.09 + Math.sin(t * 0.22) * 0.035 - root.rotation.y) * 0.05;
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
    // a panel standing closer to the reader needs more room than its size
    // alone suggests, so each one is measured from where it actually is
    let dist = 0;
    LAYERS.forEach((l) => {
      dist = Math.max(dist, l.w / 2 / Math.tan(hHalf) + l.z);
      dist = Math.max(dist, (Math.abs(l.y) + l.h / 2) / Math.tan(vHalf) + l.z);
    });
    dist *= 1.11;
    const el = THREE.MathUtils.degToRad(7); // a touch above eye level
    camera.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    frame();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // the labels are drawn with the site's font, which may land after this
  document.fonts?.ready.then(() => {
    faces.forEach(({ cfg, tex }) => {
      tex.image = drawLayer(cfg);
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

  if (import.meta.env.DEV) window.__stack = { frame };

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
