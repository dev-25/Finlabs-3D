import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================
 * FINEXA — the transactions hub
 * =====================================================
 * A simple arrangement: NSE, BSE and MF Utilities ride a
 * level ring around one Finexa card, joined to it by thin
 * links with a transaction running along each. The cards
 * stay upright and face the reader, so the logos always
 * read. It only animates while the Finexa screen is open.
 * ===================================================== */

const BASE = import.meta.env.BASE_URL;
const PLATFORMS = ['logo-nse.webp', 'logo-bse.webp', 'logo-mfu.webp'];

const CARD_W = 1.78;
const CARD_H = 1.12;
const HUB_W = 2.15;
const HUB_H = 1.35;
const RADIUS = 3.2;

function shadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(12,44,70,0.42)');
  g.addColorStop(1, 'rgba(12,44,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
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
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd3e2f2, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(2.5, 6, 6);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);

  const cardMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1,
  });
  const loader = new THREE.TextureLoader();

  // a white card with a logo fitted on its face
  function card(w, h, texture, depth = 0.16) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new RoundedBoxGeometry(w, h, depth, 5, 0.16), cardMat));
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false })
    );
    face.position.z = depth / 2 + 0.002;
    g.add(face);
    const fit = (aspect) => {
      const maxW = w * 0.74;
      const maxH = h * 0.56;
      const fw = Math.min(maxW, maxH * aspect);
      face.scale.set(fw, fw / aspect, 1);
    };
    if (texture.image) fit(texture.image.width / texture.image.height);
    return { group: g, fit };
  }

  // the middle card carries the Finexa logo
  const hubTex = loader.load(`${BASE}products/finexa/logo-finexa.webp`, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    hub.fit(t.image.width / t.image.height);
  });
  const hub = card(HUB_W, HUB_H, hubTex, 0.2);
  hub.group.position.y = 0.45; // sits above the ring, so the near card passes under it
  root.add(hub.group);

  // the three platforms, on a level ring around it
  const platforms = PLATFORMS.map((file, i) => {
    const tex = loader.load(`${BASE}products/finexa/${file}`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      c.fit(t.image.width / t.image.height);
    });
    const c = card(CARD_W, CARD_H, tex);
    root.add(c.group);
    const link = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0x8fb8e4, transparent: true, opacity: 0.7 })
    );
    root.add(link);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x1a8fb5 })
    );
    root.add(dot);
    return { ...c, link, dot, angle: (i / PLATFORMS.length) * Math.PI * 2, phase: i * 1.1 };
  });

  // the ring they travel, and a soft shadow under everything
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(RADIUS, 0.006, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0x9ec4e8, transparent: true, opacity: 0.55 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.62;
  root.add(ring);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(9.5, 9.5),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.55 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.3;
  root.add(shadow);

  const pointer = new THREE.Vector2();
  window.addEventListener(
    'pointermove',
    (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
    { passive: true }
  );

  const clock = new THREE.Clock();
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let t = 0;

  function frame() {
    t += REDUCED ? 0 : Math.min(clock.getDelta(), 0.05);
    hub.group.position.y = 0.45 + Math.sin(t * 0.9) * 0.05;
    hub.group.rotation.y = Math.sin(t * 0.4) * 0.12;

    platforms.forEach((p, i) => {
      const a = p.angle + t * 0.22;
      const x = Math.sin(a) * RADIUS;
      const z = Math.cos(a) * RADIUS;
      const y = -0.62 + Math.sin(t * 1.1 + p.phase) * 0.07;
      p.group.position.set(x, y, z);
      // upright, turned toward the reader, so the logo always reads
      p.group.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);

      dir.set(-x, hub.group.position.y - y, -z);
      const len = dir.length();
      p.link.position.set(x + dir.x * 0.5, y + dir.y * 0.5, z + dir.z * 0.5);
      p.link.scale.y = Math.max(0.001, len - 2.1);
      p.link.quaternion.setFromUnitVectors(up, dir.clone().normalize());

      // one transaction running in along the link
      const k = (t * 0.34 + i * 0.33) % 1;
      p.dot.position.set(x + dir.x * k, y + dir.y * k, z + dir.z * k);
      p.dot.visible = k > 0.12 && k < 0.86;
    });

    root.rotation.y += (pointer.x * 0.1 - root.rotation.y) * 0.05;
    root.rotation.x += (pointer.y * 0.04 + 0.06 - root.rotation.x) * 0.05;
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // frame the whole ring, from slightly above
    const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const dist = Math.max(2.35 / halfV, 4.25 / (halfV * camera.aspect));
    camera.position.set(0, 1.7, dist);
    camera.lookAt(0, -0.05, 0);
    camera.updateProjectionMatrix();
    frame();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let running = false;
  function loop() {
    if (!running || document.hidden) {
      running = false;
      return;
    }
    requestAnimationFrame(loop);
    frame();
  }

  if (import.meta.env.DEV) window.__hub = { frame };

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
