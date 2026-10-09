import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { onTheme } from './theme.js';

/* =====================================================
 * OUR PARTNERS — the connections, in 3D
 * =====================================================
 * A Finlabs core with partner nodes on two tilted rings
 * around it, each joined to the middle by a line that a
 * pulse travels along. It is the page's argument in one
 * object: everything we run is wired to someone else.
 * ===================================================== */

const host = document.querySelector('[data-partners-stage]');
const canvas = host?.querySelector('canvas');

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const THEME = {
  light: { core: 0x2563eb, node: 0xffffff, edge: 0x6f9bff, ink: 0x14254a, env: 1.0, exposure: 1.0, line: 0.5 },
  dark: { core: 0x4f86ff, node: 0x33406e, edge: 0x7fdcec, ink: 0xe9eeff, env: 0.8, exposure: 1.12, line: 0.75 },
};

if (canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.1, 7.4);
  camera.lookAt(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899cc, 0.6);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 7, 6);
  const rim = new THREE.DirectionalLight(0x9db7ff, 0.9);
  rim.position.set(-6, 2, -5);
  scene.add(hemi, key, rim);

  const root = new THREE.Group();
  scene.add(root);

  // --- the core: one rounded block for Finlabs itself
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: THEME.light.core, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12,
    emissive: THEME.light.core, emissiveIntensity: 0.18,
  });
  const core = new THREE.Mesh(new RoundedBoxGeometry(1.05, 1.05, 1.05, 6, 0.2), coreMat);
  root.add(core);

  // --- two tilted rings, with the partners standing on them
  const nodeMat = new THREE.MeshPhysicalMaterial({
    color: THEME.light.node, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.18,
  });
  const lineMat = new THREE.LineBasicMaterial({ color: THEME.light.edge, transparent: true, opacity: 0.5 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: THEME.light.edge, transparent: true, opacity: 0.55 });
  const pulseMat = new THREE.MeshBasicMaterial({ color: THEME.light.edge });

  const nodeGeo = new RoundedBoxGeometry(0.34, 0.34, 0.34, 5, 0.08);
  const rings = [
    { r: 2.5, tilt: [0.42, 0, 0.18], count: 7, spin: 0.16 },
    { r: 1.85, tilt: [-0.55, 0.3, -0.25], count: 5, spin: -0.21 },
  ];

  const wheels = [];
  rings.forEach(({ r, tilt, count, spin }) => {
    const wheel = new THREE.Group();
    wheel.rotation.set(...tilt);
    root.add(wheel);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, 128), edgeMat);
    wheel.add(ring);

    const spinner = new THREE.Group();
    wheel.add(spinner);

    const nodes = [];
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      const at = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0);

      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.copy(at);
      node.rotation.z = a;
      spinner.add(node);

      // the line back to the middle, and the pulse that runs along it
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), at]);
      spinner.add(new THREE.Line(geo, lineMat));

      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), pulseMat);
      spinner.add(pulse);
      nodes.push({ node, pulse, at, phase: Math.random() });
    }
    wheels.push({ spinner, nodes, spin });
  });

  onTheme((mode) => {
    const t = THEME[mode];
    coreMat.color.setHex(t.core);
    coreMat.emissive.setHex(t.core);
    nodeMat.color.setHex(t.node);
    lineMat.color.setHex(t.edge);
    edgeMat.color.setHex(t.edge);
    pulseMat.color.setHex(t.edge);
    lineMat.opacity = t.line;
    scene.environmentIntensity = t.env;
    renderer.toneMappingExposure = t.exposure;
  });

  function size() {
    const r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener('resize', size);

  // only while it is on screen
  let live = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { live = e.isIntersecting; }).observe(host);
  }

  const timer = new Timer();
  const pointer = new THREE.Vector2();
  window.addEventListener(
    'pointermove',
    (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
    { passive: true }
  );
  const tilt = new THREE.Vector2();

  function frame() {
    requestAnimationFrame(frame);
    if (!live) return;
    timer.update();
    const t = REDUCED ? 0 : timer.getElapsed();

    tilt.x += (pointer.y * 0.18 - tilt.x) * 0.05;
    tilt.y += (pointer.x * 0.3 - tilt.y) * 0.05;
    root.rotation.set(tilt.x, tilt.y + Math.sin(t * 0.14) * 0.22, 0);

    core.rotation.set(t * 0.2, t * 0.33, 0);
    core.scale.setScalar(1 + Math.sin(t * 1.3) * 0.025);

    wheels.forEach(({ spinner, nodes, spin }) => {
      spinner.rotation.z = t * spin;
      nodes.forEach(({ node, pulse, at, phase }) => {
        node.rotation.y = t * 0.6;
        // the pulse runs from the middle out to its partner, then starts again
        const u = (t * 0.45 + phase) % 1;
        pulse.position.copy(at).multiplyScalar(u);
        pulse.scale.setScalar(Math.sin(u * Math.PI) * 1.1 + 0.15);
      });
    });

    renderer.render(scene, camera);
  }
  frame();
}
