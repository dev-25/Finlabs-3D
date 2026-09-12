import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================
 * FINEXA — the transactions hub
 * =====================================================
 * The banner from the product page, in 3D: NSE, BSE StAR
 * MF and MFU circling one Finexa hub, with transactions
 * running along the links between them. It only animates
 * while the Finexa screen is open.
 * ===================================================== */

const BASE = import.meta.env.BASE_URL;
const NODES = [
  { file: 'logo-nse.webp', label: 'NSE' },
  { file: 'logo-bse-star-mf.webp', label: 'BSE StAR MF' },
  { file: 'logo-mfu.webp', label: 'MFU' },
];

// the Finexa wordmark, drawn for the hub tile
function wordmarkTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.font = '700 96px Outfit, "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fin = ctx.measureText('fin').width;
  const x = ctx.measureText('x').width;
  const a = ctx.measureText('a').width;
  const total = fin + x + a;
  let cursor = 256 - total / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f4c81';
  ctx.fillText('fin', cursor, 256);
  cursor += fin;
  ctx.fillStyle = '#2dd4bf'; // the teal x, as in the logo
  ctx.fillText('x', cursor, 256);
  cursor += x;
  ctx.fillStyle = '#0f4c81';
  ctx.fillText('a', cursor, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createHub(canvas) {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null; // no WebGL: the stylesheet shows the flat banner instead
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, 0.35, 9.2);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d8f0, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 6, 7);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);

  const tileMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12,
  });
  const loader = new THREE.TextureLoader();

  function tile(size, texture, depth = 0.26) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new RoundedBoxGeometry(size, size, depth, 5, size * 0.24), tileMat));
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 0.66, size * 0.66),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false })
    );
    face.position.z = depth / 2 + 0.002;
    g.add(face);
    return g;
  }

  // the hub, with a soft halo behind it
  const hub = tile(1.85, wordmarkTexture(), 0.32);
  root.add(hub);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x7fd4e8, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.5, 96), haloMat);
  halo.position.z = -0.3;
  root.add(halo);

  // the two arcs from the banner
  [3.15, 3.9].forEach((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.012, 8, 180),
      new THREE.MeshBasicMaterial({ color: i ? 0xa8c6f0 : 0x2f6fd0, transparent: true, opacity: i ? 0.35 : 0.5 })
    );
    ring.rotation.x = 0.32 * (i ? -1 : 1);
    root.add(ring);
  });

  // one platform per node, on its own orbit
  const RADIUS = 3.15;
  const linkMat = new THREE.MeshBasicMaterial({ color: 0x6aa9e0, transparent: true, opacity: 0.55 });
  const packetMat = new THREE.MeshBasicMaterial({ color: 0x1a8fb5 });
  const nodes = NODES.map((n, i) => {
    const tex = loader.load(`${BASE}products/finexa/${n.file}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const g = tile(1.45, tex);
    root.add(g);
    const link = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 8), linkMat);
    root.add(link);
    const packet = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), packetMat);
    root.add(packet);
    return { g, link, packet, angle: (i / NODES.length) * Math.PI * 2 + Math.PI / 2, phase: i * 0.7 };
  });

  const pointer = new THREE.Vector2();
  window.addEventListener(
    'pointermove',
    (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
    { passive: true }
  );

  const clock = new THREE.Clock();
  let t = 0;
  const mid = new THREE.Vector3();

  function frame() {
    t += REDUCED ? 0 : Math.min(clock.getDelta(), 0.05);
    nodes.forEach((n, i) => {
      const a = n.angle + t * 0.18;
      const x = Math.cos(a) * RADIUS;
      const y = Math.sin(a) * RADIUS * 0.72;
      const z = Math.sin(a) * 0.6;
      n.g.position.set(x, y, z);
      n.g.rotation.y = Math.sin(t * 0.6 + n.phase) * 0.12;
      // the link from the hub out to the platform
      mid.set(x / 2, y / 2, z / 2);
      n.link.position.copy(mid);
      const len = Math.hypot(x, y, z);
      n.link.scale.y = Math.max(0.001, len - 1.6);
      n.link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z).normalize());
      // a transaction running in along it
      const k = (t * 0.42 + i * 0.33) % 1;
      n.packet.position.set(x * (1 - k) * 0.82, y * (1 - k) * 0.82, z * (1 - k) * 0.82);
      n.packet.visible = k > 0.06 && k < 0.94;
    });
    hub.rotation.y = Math.sin(t * 0.5) * 0.18;
    halo.scale.setScalar(1 + Math.sin(t * 1.4) * 0.03);
    root.rotation.y += (pointer.x * 0.12 - root.rotation.y) * 0.05;
    root.rotation.x += (pointer.y * 0.05 - root.rotation.x) * 0.05;
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole ring in view on narrow screens
    camera.position.z = camera.aspect < 1 ? 12.5 : 9.2;
    camera.updateProjectionMatrix();
    frame();
  }
  new ResizeObserver(resize).observe(canvas);

  let running = false;
  function loop() {
    if (!running || document.hidden) {
      running = false;
      return;
    }
    requestAnimationFrame(loop);
    frame();
  }

  resize();

  return {
    start() {
      if (running || REDUCED) {
        frame();
        return;
      }
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
