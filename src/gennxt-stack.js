import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================
 * FINEXA GenNxt — the functional architecture, in 3D
 * =====================================================
 * The platform's three layers as three slabs stacked in
 * space: channels on top, the app components in the
 * middle, data and integrations underneath. Each slab
 * carries its own name and parts, printed on its top
 * face, and data runs up the corner pillars between
 * them. It only animates while the GenNxt screen is
 * open, and stands still for reduced motion.
 * ===================================================== */

const PX = 224; // canvas pixels per world unit
const FONT = '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

// the stack's outer dimensions, used to frame it
const WIDTH = 6.05;
const DEPTH = 2.55;
const SPAN = 3.32; // top slab's top to bottom slab's underside

const LAYERS = [
  {
    title: 'CHANNELS / PRESENTATION',
    items: ['Front office', 'Back office', 'External interfaces'],
    accent: '#6b5ce7',
    w: 4.7,
    d: 1.95,
    y: 1.5,
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
    w: 5.4,
    d: 2.25,
    y: 0,
  },
  {
    title: 'DATA & INTEGRATIONS',
    items: ['BSE StAR / MFU', 'KYC APIs', 'Security data providers'],
    accent: '#12a594',
    w: 6.05,
    d: 2.55,
    y: -1.5,
  },
];

// the layer's name and its parts, printed on the slab's top face
function drawLayer(cfg) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(cfg.w * PX);
  cv.height = Math.round(cfg.d * PX);
  const ctx = cv.getContext('2d');
  const pad = 38;

  ctx.textBaseline = 'middle';

  // the parts, as pills wrapped into centred rows
  ctx.font = `600 30px ${FONT}`;
  const chipH = 60;
  const gap = 14;
  const chips = cfg.items.map((text) => ({ text, w: ctx.measureText(text).width + 48 }));
  const rows = [];
  let row = [];
  let width = 0;
  chips.forEach((chip) => {
    if (row.length && width + gap + chip.w > cv.width - pad * 2) {
      rows.push({ row, width });
      row = [];
      width = 0;
    }
    width += (row.length ? gap : 0) + chip.w;
    row.push(chip);
  });
  if (row.length) rows.push({ row, width });

  const titleH = 54;
  const blockH = rows.length * chipH + (rows.length - 1) * gap;
  let y = (cv.height - titleH) / 2 - blockH / 2;
  rows.forEach(({ row: cells, width: rowW }) => {
    let x = (cv.width - rowW) / 2;
    cells.forEach((chip) => {
      ctx.fillStyle = `${cfg.accent}1f`;
      ctx.beginPath();
      ctx.roundRect(x, y, chip.w, chipH, chipH / 2);
      ctx.fill();
      ctx.strokeStyle = `${cfg.accent}4d`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#0b2c3f';
      ctx.fillText(chip.text, x + 24, y + chipH / 2 + 1);
      x += chip.w + gap;
    });
    y += chipH + gap;
  });

  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = cfg.accent;
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'center';
  ctx.fillText(cfg.title, cv.width / 2, cv.height - pad - 6);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
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
  key.position.set(2.5, 7, 5);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);

  const slabMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.12,
  });

  const faces = []; // kept so the labels can be redrawn once the web font lands

  const layers = LAYERS.map((cfg) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new RoundedBoxGeometry(cfg.w, 0.32, cfg.d, 4, 0.1), slabMat));

    const tex = new THREE.CanvasTexture(drawLayer(cfg));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.w, cfg.d),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.171;
    g.add(face);
    faces.push({ cfg, tex });

    // a thin accent band around the slab's edge, so the layers read apart
    const band = new THREE.Mesh(
      new RoundedBoxGeometry(cfg.w + 0.02, 0.1, cfg.d + 0.02, 3, 0.04),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.accent) })
    );
    band.position.y = -0.15;
    g.add(band);

    g.position.y = cfg.y;
    root.add(g);
    return { group: g, cfg };
  });

  // corner pillars joining the layers, with data running up them
  const pillarMat = new THREE.MeshBasicMaterial({ color: 0x9ec4e8, transparent: true, opacity: 0.55 });
  const dots = [];
  for (let i = 0; i < LAYERS.length - 1; i++) {
    const top = LAYERS[i];
    const bottom = LAYERS[i + 1];
    const w = Math.max(top.w, bottom.w) / 2 - 0.22;
    const d = Math.max(top.d, bottom.d) / 2 - 0.22;
    const span = top.y - bottom.y - 0.32;
    const midY = (top.y + bottom.y) / 2;
    [
      [w, d],
      [-w, d],
      [w, -d],
      [-w, -d],
    ].forEach(([x, z], k) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, span, 8), pillarMat);
      pillar.position.set(x, midY, z);
      root.add(pillar);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.058, 16, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(bottom.accent) })
      );
      root.add(dot);
      dots.push({ mesh: dot, x, z, from: bottom.y + 0.16, to: top.y - 0.16, phase: (k + i * 2) * 0.37 });
    });
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 11),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.5 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -2.4;
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
    t += REDUCED ? 0 : Math.min(clock.getDelta(), 0.05);

    layers.forEach(({ group, cfg }, i) => {
      group.position.y = cfg.y + Math.sin(t * 0.8 + i * 0.9) * 0.045;
    });
    dots.forEach((d) => {
      const k = (t * 0.3 + d.phase) % 1;
      d.mesh.position.set(d.x, d.from + (d.to - d.from) * k, d.z);
      d.mesh.visible = k > 0.06 && k < 0.94;
    });

    root.rotation.y += (pointer.x * 0.16 + Math.sin(t * 0.22) * 0.06 - root.rotation.y) * 0.05;
    root.rotation.x += (pointer.y * 0.03 - root.rotation.x) * 0.05;
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // frame the whole stack, seen from above so the top faces read
    const el = THREE.MathUtils.degToRad(30);
    const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    // the stack seen from `el` above: its height flattens, its depth adds
    const halfH = (SPAN / 2) * Math.cos(el) + (DEPTH / 2) * Math.sin(el);
    const dist = Math.max(halfH / Math.tan(vHalf), (WIDTH / 2) / Math.tan(hHalf)) * 1.06;
    camera.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist);
    camera.lookAt(0, -0.05, 0);
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
