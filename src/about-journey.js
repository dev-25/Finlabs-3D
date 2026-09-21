import './about-journey.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { onTheme } from './theme.js';

/* =====================================================
 * ABOUT — the journey, as a road through ten years
 * =====================================================
 * The decade drives past by itself, right to left: the
 * camera travels along a road whose stations come in
 * from the right and leave to the left, a year at a
 * time. Each station is a pedestal a little taller than
 * the year before, with a pin for every milestone and
 * the year on a sign above. The road lights up behind
 * you, and the current year's milestones sit in a card
 * alongside. The section is an ordinary block in the
 * page, so scrolling past it takes one flick; the years
 * can be paused, and any year can be picked by hand.
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
  const stage = ride.querySelector('.a-ride__stage');
  const playBtn = ride.querySelector('.a-ride__play');
  let ready = false;
  let visible = false;
  let running = false;
  let mode = 'light';
  let target = 0; // the year being shown (0 … N-1)
  let s = 0; // where the camera is, easing toward the target
  let active = -1;
  let playing = true;
  let held = 0; // seconds the current year has been in front of us
  let last = 0; // timestamp of the previous frame

  // the stylesheet stacks the years into one card over the road
  ride.classList.add('is-live');

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe7e4fb, 20, 54); // matches the page, so the road fades into it
  // studio lighting, so white surfaces read as white rather than grey
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 140);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xb8c0ef, 0.55);
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(6, 12, 8);
  scene.add(hemi, key);

  // ---- the road, running left to right with one bend per year, and a
  // short lead-in and run-out at either end. The camera drives along it
  // from left to right, so the years sweep across the screen the other way.
  const STEP = 5.6;
  const pts = years.map((_, i) => new THREE.Vector3(i * STEP, 0, Math.sin(i * 1.15) * 2.6));
  pts.unshift(new THREE.Vector3(-10, 0, pts[0].z - 1));
  pts.push(new THREE.Vector3((N - 1) * STEP + 10, 0, pts[N - 1].z + 1));
  const curve = new THREE.CatmullRomCurve3(pts);
  const tOf = (sv) => (sv + 1) / (pts.length - 1); // year index → curve parameter
  const SAMPLES = N * 40;

  function ribbon(width, y, colored, shift = 0) {
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
      side.crossVectors(tan, UP).normalize();
      if (shift) p.addScaledVector(side, shift);
      side.multiplyScalar(width / 2);
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
  dotTex.repeat.set(LEN / 1.4, 84 / 1.4);
  const groundMat = new THREE.MeshBasicMaterial({ map: dotTex, color: 0x6d5cf6, transparent: true, opacity: 0.28, depthWrite: false });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(LEN, 84), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(((N - 1) * STEP) / 2, -0.01, 0);
  scene.add(ground);

  // ---- a station for every year
  const pedMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const stations = years.map((el, i) => {
    const t = tOf(i);
    const p = curve.getPoint(t);
    const side = new THREE.Vector3().crossVectors(curve.getTangent(t), UP).normalize();
    const g = new THREE.Group();
    // all of them on the far side of the road, so nothing passes between
    // the camera and the year it is looking at
    g.position.copy(p).addScaledVector(side, -2.3);
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


  // ---- the world the road runs through: edge lines, lamp posts,
  // planting and a few ₹ coins turning over the tarmac. Everything is
  // merged or instanced, so the whole lot costs a handful of draw calls.
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const at = (sv) => {
    const tt = tOf(sv);
    const point = curve.getPoint(tt);
    const side = new THREE.Vector3().crossVectors(curve.getTangent(tt), UP).normalize();
    return { point, side };
  };
  const END = N - 1;

  // white lines down both edges of the road
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, toneMapped: false, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(mergeGeometries([ribbon(0.07, 0.02, false, 0.72), ribbon(0.07, 0.02, false, -0.72)]), edgeMat));

  // lamp posts along the near verge, one every half year, lit in that year's colour
  const poles = [];
  const bulbs = [];
  for (let k = 0; k <= END * 2 + 1; k++) {
    const sv = k / 2 - 0.5;
    const { point, side } = at(sv);
    const foot = point.clone().addScaledVector(side, 1.75);
    const pole = new THREE.CylinderGeometry(0.03, 0.055, 1.7, 8);
    pole.translate(0, 0.85, 0);
    const head = new THREE.CylinderGeometry(0.17, 0.09, 0.13, 10);
    head.translate(0, 1.78, 0);
    const arm = mergeGeometries([pole, head]);
    arm.translate(foot.x, 0, foot.z);
    poles.push(arm);
    bulbs.push({ p: new THREE.Vector3(foot.x, 1.71, foot.z), c: yearColor(THREE.MathUtils.clamp(sv / END, 0, 1)) });
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf2f4ff, roughness: 0.45, metalness: 0.25 });
  scene.add(new THREE.Mesh(mergeGeometries(poles), poleMat));

  const bulbMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.12, 14, 10),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    bulbs.length
  );
  const slot = new THREE.Object3D();
  bulbs.forEach((b, i) => {
    slot.position.copy(b.p);
    slot.updateMatrix();
    bulbMesh.setMatrixAt(i, slot.matrix);
    bulbMesh.setColorAt(i, b.c);
  });
  scene.add(bulbMesh);

  // low planting along the far verge
  const bushes = [];
  for (let k = 0; k < 46; k++) {
    const { point, side } = at(rnd() * (END + 1) - 0.5);
    const away = -(4.4 + rnd() * 6);
    const r = 0.24 + rnd() * 0.3;
    const blob = new THREE.IcosahedronGeometry(r, 0);
    blob.scale(1, 0.75 + rnd() * 0.6, 1);
    blob.translate(point.x + side.x * away, r * 0.5, point.z + side.z * away);
    bushes.push(blob);
  }
  const bushMat = new THREE.MeshStandardMaterial({ color: 0xa5b4fc, roughness: 0.75 });
  scene.add(new THREE.Mesh(mergeGeometries(bushes), bushMat));

  // ₹ coins turning over the road — the point of the whole decade
  const coinCanvas = document.createElement('canvas');
  coinCanvas.width = coinCanvas.height = 192;
  const cctx = coinCanvas.getContext('2d');
  const grad = cctx.createRadialGradient(72, 62, 8, 96, 96, 96);
  grad.addColorStop(0, '#fff4c8');
  grad.addColorStop(0.55, '#f2c14e');
  grad.addColorStop(1, '#b7791f');
  cctx.fillStyle = grad;
  cctx.beginPath();
  cctx.arc(96, 96, 94, 0, Math.PI * 2);
  cctx.fill();
  cctx.fillStyle = '#8a5a0b';
  cctx.font = '700 112px Inter, "Segoe UI", Arial, sans-serif';
  cctx.textAlign = 'center';
  cctx.textBaseline = 'middle';
  cctx.fillText('₹', 96, 104);
  const coinTex = new THREE.CanvasTexture(coinCanvas);
  coinTex.colorSpace = THREE.SRGBColorSpace;
  const coinFace = new THREE.MeshStandardMaterial({ map: coinTex, metalness: 0.5, roughness: 0.32 });
  const coinRim = new THREE.MeshStandardMaterial({ color: 0xf5c451, metalness: 1, roughness: 0.25 });
  const coins = [];
  for (let k = 0; k < 9; k++) {
    const { point, side } = at(rnd() * END);
    const r = 0.22 + rnd() * 0.12;
    const coin = new THREE.Group();
    const rim = new THREE.CylinderGeometry(r, r, r * 0.2, 28);
    rim.rotateX(Math.PI / 2);
    coin.add(new THREE.Mesh(rim, coinRim));
    const face = new THREE.CircleGeometry(r * 0.93, 28);
    const front = new THREE.Mesh(face, coinFace);
    front.position.z = r * 0.101;
    const back = new THREE.Mesh(face, coinFace);
    back.position.z = -r * 0.101;
    back.rotation.y = Math.PI;
    coin.add(front, back);
    coin.position.copy(point).addScaledVector(side, 0.6 + rnd() * 2.6);
    coin.position.y = 1.4 + rnd() * 1.7;
    coin.userData = { y: coin.position.y, k };
    coins.push(coin);
    scene.add(coin);
  }

  function dressTick(now) {
    coins.forEach((c) => {
      c.rotation.y = now * 0.9 + c.userData.k;
      c.position.y = c.userData.y + Math.sin(now * 1.1 + c.userData.k) * 0.14;
    });
  }

  // ---- camera: it rides along the road beside the current year, looking
  // across it rather than down it. Driving along means the year in front
  // slides off to the left while the next one comes in from the right.
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const t0 = new THREE.Vector3();
  let backDist = 11.5; // further back on tall, narrow screens — see resize()
  let upDist = 3.9;
  const leadDist = 3.4; // how far behind the year the camera sits, for some depth
  function viewAt(sv) {
    const i = Math.min(Math.floor(sv), N - 2);
    const f = THREE.MathUtils.clamp(sv - i, 0, 1);
    camLook.lerpVectors(stations[i].pos, stations[i + 1].pos, f);
    camLook.y += 0.55 + THREE.MathUtils.lerp(stations[i].h, stations[i + 1].h, f) * 0.6;
    curve.getTangent(tOf(sv), t0);
    // back from the road, up a little, and a step behind along it
    camPos.copy(camLook);
    camPos.z += backDist;
    camPos.y += upDist;
    camPos.addScaledVector(t0, -leadDist);
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    years.forEach((el, k) => el.classList.toggle('is-on', k === i));
    navButtons.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
    // on phones the year buttons scroll sideways; keep the current one in view
    const nav = navButtons[0]?.parentElement;
    const btn = navButtons[i];
    if (nav && btn && nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({ left: btn.offsetLeft - nav.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2, behavior: 'smooth' });
    }
  }

  // ---- the years play by themselves: hold on one, glide to the next
  const DWELL = 3.4; // seconds a year stays in front of us

  function goTo(i) {
    target = THREE.MathUtils.clamp(i, 0, N - 1);
    held = 0;
    setActive(Math.round(target));
    start();
  }

  function setPlaying(on) {
    playing = on;
    held = 0;
    playBtn?.setAttribute('aria-pressed', String(!on));
    playBtn?.classList.toggle('is-paused', !on);
    playBtn?.setAttribute('aria-label', on ? 'Pause the journey' : 'Play the journey');
    if (on) start();
  }
  playBtn?.addEventListener('click', () => setPlaying(!playing));

  // picking a year by hand stops the run there, so it can be read in peace
  navButtons.forEach((b, i) =>
    b.addEventListener('click', () => {
      setPlaying(false);
      goTo(i);
    })
  );

  // after the last year, slip back to the first behind a short fade
  let hopping = false;
  function hopToStart() {
    if (hopping) return;
    hopping = true;
    stage?.classList.add('is-hop');
    setTimeout(() => {
      s = 0;
      goTo(0);
      stage?.classList.remove('is-hop');
      hopping = false;
    }, 380);
  }

  function advance(dt) {
    if (!playing || hopping || !visible) return;
    if (Math.abs(target - s) > 0.02) return; // still gliding to the last one
    held += dt;
    if (held < DWELL) return;
    held = 0;
    if (target >= N - 1) hopToStart();
    else goTo(Math.round(target) + 1);
  }

  function frame() {
    const now = performance.now() / 1000;
    const dt = last ? Math.min(0.1, now - last) : 0;
    last = now;
    advance(dt);
    s += (target - s) * 0.045;
    if (Math.abs(target - s) < 0.0005) s = target;
    viewAt(s);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    trailGeo.setDrawRange(0, Math.floor((trailCount * tOf(s)) / 6) * 6);
    dressTick(now);

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
    poleMat.color.setHex(dark ? 0x35406b : 0xf2f4ff);
    bushMat.color.setHex(dark ? 0x2a3566 : 0xa5b4fc);
    edgeMat.opacity = dark ? 0.3 : 0.5;
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
    backDist = camera.aspect < 1 ? 15 : 11.5;
    upDist = camera.aspect < 1 ? 5.2 : 3.9;
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

  setActive(0);
  setPlaying(true);
  s = target;
  resize();
  ready = true;
  frame();

  // dev-only: render(true) jumps the camera straight to the year being shown,
  // for checking frames in a tab that isn't animating
  if (import.meta.env.DEV) {
    window.__aboutRide = {
      render: (snap) => {
        if (snap) s = target;
        frame();
      },
      go: (i) => {
        setPlaying(false);
        goTo(i);
        s = target;
        frame();
      },
      play: setPlaying,
      // run the clock by hand, for a tab that isn't animating
      step: (secs = 1, steps = 30) => {
        for (let k = 0; k < steps; k++) {
          advance(secs / steps);
          s += (target - s) * 0.045;
        }
        frame();
        return { target, s: +s.toFixed(2), active, camX: +camera.position.x.toFixed(2) };
      },
      state: () => ({ target, s, active, playing, held }),
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
