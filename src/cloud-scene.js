import * as THREE from 'three';
import { Timer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { onTheme } from './theme.js';

/* =====================================================
 * SERVICES › CLOUD — the hero's 3D sky
 * =====================================================
 * Your data centre (a small server rack on a round stand)
 * sends data up three glowing streams into three soft
 * clouds, one per platform, each wearing its logo on a
 * badge: AWS on the left, Azure in the middle, Google
 * Cloud on the right. Small clouds drift behind.
 * Hovering a cloud lifts it; clicking picks it, which the
 * page mirrors in its platform tabs (and vice versa).
 * Only animates while the hero is on screen.
 * ===================================================== */

export const CLOUDS = [
  { id: 'aws', color: '#ff9900', logo: 'services/cloud/aws.svg', name: '', pos: [-2.35, 2.3, -0.1] },
  { id: 'azure', color: '#0078d4', logo: 'services/cloud/azure.svg', name: 'Microsoft Azure', pos: [0, 3.05, -0.75] },
  { id: 'gcp', color: '#4285f4', logo: 'services/cloud/google-cloud-icon.svg', name: 'Google Cloud', pos: [2.35, 2.3, -0.1] },
];

const asset = (p) => `${import.meta.env.BASE_URL}${p}`;

// a puffy cloud: overlapping spheres merged into one mesh, with a softened flat base
function cloudGeometry() {
  const puffs = [
    [0, 0.05, 0, 0.62], [-0.6, -0.1, 0.06, 0.47], [0.62, -0.08, 0.02, 0.5], [-0.28, 0.34, -0.06, 0.46],
    [0.3, 0.36, 0.0, 0.44], [-1.0, -0.22, 0.02, 0.3], [1.05, -0.2, 0.0, 0.32], [0.05, -0.12, 0.3, 0.45],
  ];
  const geo = mergeGeometries(
    puffs.map(([x, y, z, r]) => new THREE.SphereGeometry(r, 32, 22).translate(x, y, z))
  );
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < -0.28) pos.setY(i, -0.28 + (y + 0.28) * 0.22);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildCloudScene(stage, { onPick, onHover } = {}) {
  const canvas = stage.querySelector('canvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    stage.classList.add('is-flat');
    return null;
  }
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const LOOK = new THREE.Vector3(0, 1.75, 0);
  const VIEW = new THREE.Vector3(0, 0.12, 1).normalize();

  const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x9fb6e8, 0.9);
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3, 8, 6);
  const rim = new THREE.DirectionalLight(0xbfe3ff, 0.8);
  rim.position.set(-5, 4, -5);
  scene.add(hemi, key, rim);

  const root = new THREE.Group();
  scene.add(root);

  function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const redraw = (...args) => {
      const g = c.getContext('2d');
      g.clearRect(0, 0, w, h);
      draw(g, w, h, ...args);
      tex.needsUpdate = true;
    };
    redraw();
    return { tex, redraw };
  }

  // ---------------------------------------------------------------- the data centre
  const standMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.35, clearcoat: 0.7 });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.42, 0.22, 96), standMat);
  stand.position.set(0, 0.11, 0.7);
  root.add(stand);
  const standRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.39, 0.025, 10, 120),
    new THREE.MeshStandardMaterial({ color: '#0ea5e9', emissive: '#0ea5e9', emissiveIntensity: 0.6 })
  );
  standRing.rotation.x = Math.PI / 2;
  standRing.position.set(0, 0.22, 0.7);
  root.add(standRing);

  const rack = new THREE.Group();
  rack.position.set(0, 0.22, 0.7);
  root.add(rack);
  const unitGeo = new RoundedBoxGeometry(1.15, 0.3, 0.78, 3, 0.05);
  const unitMat = new THREE.MeshPhysicalMaterial({ color: '#1e2b4f', roughness: 0.4, metalness: 0.3, clearcoat: 0.6 });
  const slotMat = new THREE.MeshStandardMaterial({ color: '#0f172e', roughness: 0.6 });
  const leds = [];
  for (let i = 0; i < 3; i++) {
    const unit = new THREE.Mesh(unitGeo, unitMat);
    unit.position.y = 0.17 + i * 0.34;
    rack.add(unit);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.01), slotMat);
    slot.position.set(-0.12, unit.position.y, 0.395);
    rack.add(slot);
    for (let k = 0; k < 3; k++) {
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 12, 8),
        new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: k === 2 ? '#38bdf8' : '#22c55e', emissiveIntensity: 1.4 })
      );
      led.position.set(0.3 + k * 0.08, unit.position.y, 0.4);
      rack.add(led);
      leds.push({ led, phase: Math.random() * 6, speed: 1.5 + Math.random() * 3 });
    }
  }
  const RACK_TOP = new THREE.Vector3(0, 0.22 + 1.02, 0.7);

  // a name plate at the front of the stand
  const plate = canvasTexture(640, 110, (g, w, h, dark) => {
    g.fillStyle = dark ? '#0e172c' : '#ffffff';
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 40);
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = dark ? 'rgba(150,175,255,0.35)' : 'rgba(15,35,75,0.12)';
    g.stroke();
    g.fillStyle = '#0ea5e9';
    g.beginPath();
    g.arc(58, h / 2, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = dark ? '#e9eeff' : '#0f1a33';
    g.font = '700 44px "JetBrains Mono", ui-monospace, monospace';
    g.textBaseline = 'middle';
    g.fillText('YOUR DATA CENTRE', 92, h / 2 + 2);
  });
  const plateMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.275),
    new THREE.MeshBasicMaterial({ map: plate.tex, transparent: true, toneMapped: false })
  );
  plateMesh.position.set(0, 0.32, 2.12);
  plateMesh.rotation.x = -0.35;
  root.add(plateMesh);

  // ---------------------------------------------------------------- the three clouds
  const cloudGeo = cloudGeometry();
  const cloudMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.78, sheen: 1, sheenColor: new THREE.Color('#bfe3ff'), sheenRoughness: 0.55, clearcoat: 0.15,
  });
  const clouds = [];
  const pickables = [];

  CLOUDS.forEach((c, i) => {
    const group = new THREE.Group();
    group.position.set(...c.pos);
    root.add(group);
    const body = new THREE.Mesh(cloudGeo, cloudMat);
    body.scale.set(1.12, 1.0, 0.95);
    group.add(body);

    // the badge: a coloured rim and a white face carrying the logo
    const badge = new THREE.Group();
    badge.position.set(0, 0.02, 0.72);
    group.add(badge);
    const rimMat = new THREE.MeshStandardMaterial({ color: c.color, emissive: c.color, emissiveIntensity: 0.25, roughness: 0.35 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.08, 64), rimMat);
    disc.rotation.x = Math.PI / 2;
    badge.add(disc);
    const face = canvasTexture(512, 512, (g, w, h, img) => {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
      g.fill();
      if (!img) return;
      const box = c.name ? 230 : 300; // leave room for the name under the Azure and Google icons
      const k = Math.min(box / img.naturalWidth, box / img.naturalHeight);
      const iw = img.naturalWidth * k;
      const ih = img.naturalHeight * k;
      const top = c.name ? 120 : (h - ih) / 2;
      g.drawImage(img, (w - iw) / 2, top + (c.name ? (230 - ih) / 2 : 0), iw, ih);
      if (c.name) {
        g.fillStyle = '#1f2937';
        g.font = '700 40px Outfit, "Segoe UI", sans-serif';
        g.textAlign = 'center';
        g.fillText(c.name, w / 2, 405);
      }
    });
    const faceMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 64),
      new THREE.MeshBasicMaterial({ map: face.tex, toneMapped: false })
    );
    faceMesh.position.z = 0.042;
    badge.add(faceMesh);

    // SVG logos draw straight into the canvas once loaded (and again once fonts settle)
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      face.redraw(img);
      if (ready && !running) frame();
    };
    img.src = asset(c.logo);
    document.fonts?.ready.then(() => img.complete && img.naturalWidth && face.redraw(img));

    [body, disc, faceMesh].forEach((m) => {
      m.userData.cloud = c.id;
      pickables.push(m);
    });

    // the stream from the rack up into this cloud, with packets riding it
    const end = new THREE.Vector3(...c.pos).add(new THREE.Vector3(0, -0.3, 0.1));
    const mid = RACK_TOP.clone().lerp(end, 0.5).add(new THREE.Vector3(c.pos[0] * 0.12, 0.35, 0.45));
    const curve = new THREE.CatmullRomCurve3([RACK_TOP.clone(), RACK_TOP.clone().add(new THREE.Vector3(c.pos[0] * 0.08, 0.35, 0)), mid, end]);
    const tubeMat = new THREE.MeshStandardMaterial({ color: c.color, emissive: c.color, emissiveIntensity: 0.5, transparent: true, opacity: 0.55 });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.02, 10, false), tubeMat);
    root.add(tube);
    const packetMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: c.color, emissiveIntensity: 1.2 });
    const packets = [0, 0.33, 0.66].map((offset) => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), packetMat);
      root.add(p);
      return { mesh: p, offset };
    });

    clouds.push({ ...c, group, body, badge, rimMat, tubeMat, packetMat, curve, packets, lift: 0, focus: 0, target: 0, i });
  });

  // ---------------------------------------------------------------- small clouds drifting behind
  const farMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.9, transparent: true, opacity: 0.55, sheen: 1, sheenColor: new THREE.Color('#cfe8ff') });
  const drifters = [
    [-4.2, 3.6, -3.2, 0.5, 0.05], [3.8, 4.0, -3.6, 0.42, 0.04], [-1.6, 4.4, -4.2, 0.36, 0.06],
    [1.8, 1.2, -3.0, 0.4, 0.035], [-3.4, 1.0, -2.6, 0.34, 0.045],
  ].map(([x, y, z, s, speed]) => {
    const m = new THREE.Mesh(cloudGeo, farMat);
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    root.add(m);
    return { m, x, speed };
  });

  // ---------------------------------------------------------------- theme
  let ready = false;
  let running = false;
  let visible = false;
  onTheme((mode) => {
    const dark = mode === 'dark';
    cloudMat.color.set(dark ? '#dbe7ff' : '#ffffff');
    cloudMat.sheenColor.set(dark ? '#7aa5ff' : '#bfe3ff');
    farMat.color.set(dark ? '#9fb4e6' : '#ffffff');
    farMat.opacity = dark ? 0.16 : 0.55;
    standMat.color.set(dark ? '#16213d' : '#ffffff');
    hemi.intensity = dark ? 0.6 : 0.9;
    plate.redraw(dark);
    if (ready && !running) frame();
  });
  document.fonts?.ready.then(() => {
    plate.redraw(document.documentElement.dataset.theme === 'dark');
    if (ready && !running) frame();
  });

  // ---------------------------------------------------------------- sizing
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    // fit the full width of the side clouds (with room to bob and lean) and the height from stand to top cloud
    const dist = Math.max(4.25 / Math.tan(hHalf), 2.1 / Math.tan(vHalf));
    camera.position.copy(LOOK).addScaledVector(VIEW, dist);
    camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
    if (ready && !running) frame();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---------------------------------------------------------------- picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let selected = null;

  function cloudAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.cloud : null;
  }
  function retarget() {
    clouds.forEach((c) => (c.target = c.id === hovered ? 1 : 0));
  }
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const id = cloudAt(e);
    if (id === hovered) return;
    hovered = id;
    stage.classList.toggle('is-pointing', Boolean(id));
    retarget();
    onHover?.(id);
    kick();
  });
  canvas.addEventListener('pointerleave', () => {
    hovered = null;
    stage.classList.remove('is-pointing');
    retarget();
    kick();
  });
  canvas.addEventListener('click', (e) => {
    const id = cloudAt(e);
    if (id) onPick?.(id);
  });
  window.addEventListener(
    'pointermove',
    (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
    { passive: true }
  );

  // ---------------------------------------------------------------- loop
  const timer = new Timer();
  const tmp = new THREE.Vector3();
  function frame() {
    timer.update();
    const t = REDUCED ? 0 : timer.getElapsed();
    const ease = REDUCED ? 1 : 0.1;
    clouds.forEach((c) => {
      c.lift += (c.target - c.lift) * ease;
      c.focus += ((selected === null || selected === c.id ? 1 : 0) - c.focus) * ease;
      const on = selected === c.id ? 1 : 0;
      c.group.position.y = c.pos[1] + c.lift * 0.2 + (REDUCED ? 0 : Math.sin(t * 0.8 + c.i * 2.1) * 0.08);
      c.group.rotation.y = REDUCED ? 0 : Math.sin(t * 0.35 + c.i) * 0.12;
      c.group.scale.setScalar(1 + c.lift * 0.06 + on * 0.06);
      c.rimMat.emissiveIntensity = 0.25 + c.lift * 0.5 + on * 0.6;
      c.tubeMat.opacity = 0.2 + c.focus * 0.45 + on * 0.25;
      const speed = 0.16 + on * 0.18;
      c.packets.forEach((p) => {
        const k = REDUCED ? p.offset : (t * speed + p.offset) % 1;
        c.curve.getPointAt(k, tmp);
        p.mesh.position.copy(tmp);
        p.mesh.visible = c.focus > 0.3;
        p.mesh.scale.setScalar(Math.sin(k * Math.PI) * 0.9 + 0.3);
      });
    });
    leds.forEach(({ led, phase, speed }) => {
      led.material.emissiveIntensity = REDUCED ? 1.2 : 0.4 + (Math.sin(t * speed + phase) > 0 ? 1.4 : 0);
    });
    drifters.forEach((d) => {
      d.m.position.x = d.x + (REDUCED ? 0 : ((t * d.speed + 4) % 8) - 4) * 0.35;
    });
    root.rotation.y += (pointer.x * 0.12 - root.rotation.y) * 0.05;
    root.rotation.x += (pointer.y * 0.03 - root.rotation.x) * 0.05;
    renderer.render(scene, camera);
  }

  function loop() {
    if (!visible || document.hidden) {
      running = false;
      return;
    }
    requestAnimationFrame(loop);
    frame();
  }
  function start() {
    if (REDUCED || running || !visible || document.hidden) return;
    running = true;
    requestAnimationFrame(loop);
  }
  // with reduced motion there is no loop, so redraw once when something changes
  function kick() {
    if (REDUCED) requestAnimationFrame(frame);
    else start();
  }
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      start();
    },
    { rootMargin: '120px' }
  ).observe(stage);
  document.addEventListener('visibilitychange', start);

  ready = true;
  frame();

  if (import.meta.env.DEV) window.__cloudScene = { render: frame, clouds, camera };

  return {
    /** pick a cloud from outside (the platform tabs and logo buttons) */
    select(id) {
      selected = id;
      kick();
    },
  };
}
