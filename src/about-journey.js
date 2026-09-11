import './about-journey.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { onTheme } from './theme.js';

/* =====================================================
 * ABOUT — the journey, as a road through ten years
 * =====================================================
 * Scrolling through the milestones section carries the
 * camera along a winding road. Each year is a station
 * beside it: a pedestal a little taller than the year
 * before, with a pin for every milestone and the year on
 * a sign above. The road lights up behind you, and the
 * current year's milestones sit in a card alongside.
 * Without WebGL, or with reduced motion, the section
 * stays the plain list it is in the markup.
 * ===================================================== */

const UP = new THREE.Vector3(0, 1, 0);
const BLUE = new THREE.Color('#2563eb');
const VIOLET = new THREE.Color('#8b5cf6');
const PINK = new THREE.Color('#ec4899');

// blue in 2016, violet mid-decade, pink by 2026 — the same scale as the hero bars
function yearColor(t) {
  return t < 0.5 ? BLUE.clone().lerp(VIOLET, t * 2) : VIOLET.clone().lerp(PINK, (t - 0.5) * 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// the year on a pill-shaped sign that always faces the camera
function yearLabel(year, color) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 192;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
  sprite.scale.set(1.9, 0.71, 1);
  const hex = `#${color.getHexString()}`;
  sprite.userData.draw = (mode) => {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 512, 192);
    roundRect(ctx, 16, 20, 480, 152, 72);
    ctx.fillStyle = mode === 'dark' ? '#0e172c' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = hex;
    ctx.stroke();
    ctx.fillStyle = hex;
    ctx.font = '800 104px Outfit, "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(year, 256, 100);
    tex.needsUpdate = true;
  };
  return sprite;
}

// a map pin, like the ones on the original timeline
function makePin(mat, eyeMat) {
  const pin = new THREE.Group();
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 20), mat);
  tip.rotation.x = Math.PI; // point down
  tip.position.y = 0.19;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), mat);
  bulb.position.y = 0.48;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), eyeMat);
  eye.position.set(0, 0.48, 0.16);
  pin.add(tip, bulb, eye);
  return pin;
}

function buildRide(renderer, ride, canvas) {
  const years = [...ride.querySelectorAll('.a-year')];
  const N = years.length;
  const navButtons = [...ride.querySelectorAll('.a-ride__years button')];
  const hint = ride.querySelector('.a-ride__hint');
  let ready = false;
  let visible = false;
  let running = false;
  let mode = 'light';
  let target = 0; // where the scroll says we are, in years (0 … N-1)
  let s = 0; // where the camera is, easing toward the target
  let active = -1;

  // the stylesheet pins the stage and stacks the years into one card
  ride.style.setProperty('--n', N);
  ride.classList.add('is-live');

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe7e4fb, 16, 44); // matches the page, so the road fades into it
  // studio lighting, so white surfaces read as white rather than grey
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 140);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xb8c0ef, 0.55);
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(6, 12, 8);
  scene.add(hemi, key);

  // ---- the road, one bend per year, with a short lead-in and run-out
  const STEP = 7;
  const pts = years.map((_, i) => new THREE.Vector3(Math.sin(i * 1.15) * 3.2, 0, -i * STEP));
  pts.unshift(new THREE.Vector3(pts[0].x - 1, 0, 8));
  pts.push(new THREE.Vector3(pts[N - 1].x + 1, 0, -(N - 1) * STEP - 10));
  const curve = new THREE.CatmullRomCurve3(pts);
  const tOf = (sv) => (sv + 1) / (pts.length - 1); // year index → curve parameter
  const SAMPLES = N * 40;

  function ribbon(width, y, colored) {
    const pos = [];
    const col = [];
    const idx = [];
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const side = new THREE.Vector3();
    for (let k = 0; k <= SAMPLES; k++) {
      const t = k / SAMPLES;
      curve.getPoint(t, p);
      curve.getTangent(t, tan);
      side.crossVectors(tan, UP).normalize().multiplyScalar(width / 2);
      pos.push(p.x - side.x, y, p.z - side.z, p.x + side.x, y, p.z + side.z);
      if (colored) {
        const c = yearColor(THREE.MathUtils.clamp((t * (pts.length - 1) - 1) / (N - 1), 0, 1));
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      if (k < SAMPLES) {
        const a = k * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (colored) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  const roadMat = new THREE.MeshStandardMaterial({ color: 0xfbfaff, roughness: 0.7, side: THREE.DoubleSide });
  const road = new THREE.Mesh(ribbon(1.7, 0.01), roadMat);
  // the whole route as a faint line, and the part travelled so far in full colour
  const aheadMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.22, toneMapped: false, side: THREE.DoubleSide, depthWrite: false,
  });
  const ahead = new THREE.Mesh(ribbon(0.36, 0.035, true), aheadMat);
  const trailGeo = ribbon(0.36, 0.05, true);
  const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide }));
  const trailCount = trailGeo.index.count;
  scene.add(road, ahead, trail);

  // a dotted floor that fades into the fog
  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = dotCanvas.height = 128;
  const dctx = dotCanvas.getContext('2d');
  dctx.fillStyle = '#fff';
  dctx.beginPath();
  dctx.arc(64, 64, 7, 0, Math.PI * 2);
  dctx.fill();
  const dotTex = new THREE.CanvasTexture(dotCanvas);
  dotTex.wrapS = dotTex.wrapT = THREE.RepeatWrapping;
  const LEN = (N - 1) * STEP + 40;
  dotTex.repeat.set(60 / 1.4, LEN / 1.4);
  const groundMat = new THREE.MeshBasicMaterial({ map: dotTex, color: 0x6d5cf6, transparent: true, opacity: 0.28, depthWrite: false });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, LEN), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.01, -LEN / 2 + 14);
  scene.add(ground);

  // ---- a station for every year
  const pedMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const stations = years.map((el, i) => {
    const t = tOf(i);
    const p = curve.getPoint(t);
    const side = new THREE.Vector3().crossVectors(curve.getTangent(t), UP).normalize();
    const g = new THREE.Group();
    g.position.copy(p).addScaledVector(side, (i % 2 ? 1 : -1) * 2.25); // alternate sides of the road
    const color = yearColor(i / (N - 1));
    const h = 0.3 + i * 0.17; // each year stands a little taller than the one before

    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, h, 6), pedMat);
    ped.position.y = h / 2;
    const accent = new THREE.MeshPhysicalMaterial({
      color, emissive: color, emissiveIntensity: 0.18, roughness: 0.25, clearcoat: 1,
    });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.07, 6), accent);
    plate.position.y = h + 0.035;
    g.add(ped, plate);

    // one pin per milestone, in a row across the pedestal
    const count = el.querySelectorAll('.a-mile').length;
    const pins = [];
    for (let k = 0; k < count; k++) {
      const pin = makePin(accent, eyeMat);
      pin.position.set((k - (count - 1) / 2) * 0.55, h + 0.07, 0);
      pin.userData.y = pin.position.y;
      g.add(pin);
      pins.push(pin);
    }

    const label = yearLabel(el.dataset.year, color);
    label.position.y = h + 1.5;
    g.add(label);
    scene.add(g);
    return { pins, label, accent, pos: g.position, h };
  });

  // ---- camera: it looks at the current year's station, gliding from one
  // to the next as you scroll, from behind and above along the road — so
  // the station stays in view whichever side of the road it stands on
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const t0 = new THREE.Vector3();
  let backDist = 8.5; // further back on tall, narrow screens — see resize()
  let upDist = 3.1;
  function viewAt(sv) {
    const i = Math.min(Math.floor(sv), N - 2);
    const f = THREE.MathUtils.clamp(sv - i, 0, 1);
    camLook.lerpVectors(stations[i].pos, stations[i + 1].pos, f);
    camLook.y += 0.7 + THREE.MathUtils.lerp(stations[i].h, stations[i + 1].h, f) * 0.6;
    curve.getTangent(tOf(sv), t0);
    camPos.copy(camLook).addScaledVector(t0, -backDist);
    camPos.y += upDist;
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    years.forEach((el, k) => el.classList.toggle('is-on', k === i));
    navButtons.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
    hint?.classList.toggle('is-gone', i > 0);
    // on phones the year buttons scroll sideways; keep the current one in view
    const nav = navButtons[0]?.parentElement;
    const btn = navButtons[i];
    if (nav && btn && nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({ left: btn.offsetLeft - nav.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2, behavior: 'smooth' });
    }
  }

  function readScroll() {
    const r = ride.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const p = total > 0 ? THREE.MathUtils.clamp(-r.top / total, 0, 1) : 0;
    target = p * (N - 1);
    setActive(Math.round(target));
    start();
  }
  window.addEventListener('scroll', readScroll, { passive: true });

  // the year buttons jump to that year's stretch of the scroll
  navButtons.forEach((b, i) =>
    b.addEventListener('click', () => {
      const top = window.scrollY + ride.getBoundingClientRect().top;
      const total = ride.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + (i / (N - 1)) * total + 1 });
    })
  );

  function frame() {
    s += (target - s) * 0.09;
    if (Math.abs(target - s) < 0.0005) s = target;
    viewAt(s);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    trailGeo.setDrawRange(0, Math.floor((trailCount * tOf(s)) / 6) * 6);

    const now = performance.now() / 1000;
    stations.forEach((st, i) => {
      const on = i === active;
      st.accent.emissiveIntensity += ((on ? 0.65 : 0.18) - st.accent.emissiveIntensity) * 0.15;
      const w = st.label.scale.x + ((on ? 2.15 : 1.75) - st.label.scale.x) * 0.15;
      st.label.scale.set(w, w * (0.71 / 1.9), 1);
      st.pins.forEach((pin, k) => {
        pin.position.y = pin.userData.y + (on ? Math.abs(Math.sin(now * 2.2 + k)) * 0.12 : 0);
        pin.rotation.y = on ? now * 1.2 : 0;
      });
    });
    renderer.render(scene, camera);
  }

  // ---- theme
  onTheme((m) => {
    mode = m;
    const dark = m === 'dark';
    scene.fog.color.setHex(dark ? 0x0a1122 : 0xe7e4fb);
    roadMat.color.setHex(dark ? 0x1a2542 : 0xfbfaff);
    pedMat.color.setHex(dark ? 0x1b2744 : 0xffffff);
    groundMat.color.setHex(dark ? 0x8fa6ff : 0x6d5cf6);
    groundMat.opacity = dark ? 0.18 : 0.28;
    aheadMat.opacity = dark ? 0.3 : 0.22;
    hemi.intensity = dark ? 0.35 : 0.55;
    hemi.groundColor.setHex(dark ? 0x1a2240 : 0xb8c0ef);
    key.intensity = dark ? 0.7 : 1.0;
    scene.environmentIntensity = dark ? 0.5 : 1;
    renderer.toneMappingExposure = dark ? 1.1 : 1;
    stations.forEach((st) => st.label.userData.draw(mode));
    if (ready && !running) frame();
  });
  document.fonts?.ready.then(() => {
    stations.forEach((st) => st.label.userData.draw(mode));
    if (ready && !running) frame();
  });

  // ---- sizing; on wide screens the focus sits right of the card, on
  // narrow ones above it
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // a portrait screen sees a narrow slice, so stand further back and higher
    backDist = camera.aspect < 1 ? 12.5 : 8.5;
    upDist = camera.aspect < 1 ? 4.4 : 3.1;
    if (window.innerWidth > 960) camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    camera.updateProjectionMatrix();
    if (ready && !running) frame();
  }
  new ResizeObserver(resize).observe(canvas);

  // ---- run only while the ride is on screen and the tab is visible
  function loop() {
    if (!visible || document.hidden) {
      running = false;
      return;
    }
    requestAnimationFrame(loop);
    frame();
  }
  function start() {
    if (running || !visible || document.hidden) return;
    running = true;
    requestAnimationFrame(loop);
  }
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      start();
    },
    { rootMargin: '200px' }
  ).observe(ride);
  document.addEventListener('visibilitychange', start);

  readScroll();
  s = target;
  resize();
  ready = true;
  frame();

  // dev-only: render(true) jumps the camera straight to the scroll position,
  // for checking frames in a tab that isn't animating
  if (import.meta.env.DEV) {
    window.__aboutRide = {
      render: (snap) => {
        if (snap) s = target;
        frame();
      },
      state: () => ({ target, s, active }),
    };
  }
}

// ---------------------------------------------------------------------
// start-up — last, so the constants above exist before the scene is built
// ---------------------------------------------------------------------

const rideEl = document.querySelector('.a-ride');
const rideCanvas = rideEl?.querySelector('.a-ride__canvas');
let rideRenderer = null;
if (rideCanvas && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  try {
    rideRenderer = new THREE.WebGLRenderer({ canvas: rideCanvas, antialias: true, alpha: true });
  } catch {
    rideRenderer = null; // no WebGL: the milestones stay a plain list
  }
}
if (rideRenderer) buildRide(rideRenderer, rideEl, rideCanvas);
