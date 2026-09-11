import * as THREE from 'three';
import { Timer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { onTheme } from './theme.js';

/* =====================================================
 * ABOUT — the anniversary emblem: a decade of growth
 * =====================================================
 * A layered "10" stands on a round platform engraved
 * 2016 — 2026. Behind it ten bars, one per year, rise in
 * an arc from blue through violet to pink, and a glowing
 * arrow sweeps up over them, as in the Finlabs mark.
 * Confetti drifts round the scene. On load the bars grow
 * and the arrow draws itself; after that it idles gently,
 * and it only animates while the hero is on screen.
 * ===================================================== */

const BLUE = new THREE.Color('#2563eb');
const VIOLET = new THREE.Color('#8b5cf6');
const PINK = new THREE.Color('#ec4899');

// the colour for a point in the decade, t from 0 (2016) to 1 (2025)
function yearColor(t) {
  return t < 0.5 ? BLUE.clone().lerp(VIOLET, t * 2) : VIOLET.clone().lerp(PINK, (t - 0.5) * 2);
}

// bake a bottom-to-top gradient into vertex colours; stops are [0..1, THREE.Color]
function tint(geo, stops) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const pos = geo.attributes.position;
  let attr = geo.attributes.color;
  if (!attr || attr.count !== pos.count) {
    attr = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
    geo.setAttribute('color', attr);
  }
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / (max.y - min.y || 1);
    let k = 1;
    while (k < stops.length - 1 && t > stops[k][0]) k++;
    const [a0, c0] = stops[k - 1];
    const [a1, c1] = stops[k];
    c.lerpColors(c0, c1, THREE.MathUtils.clamp((t - a0) / (a1 - a0 || 1), 0, 1));
    attr.setXYZ(i, c.r, c.g, c.b);
  }
  attr.needsUpdate = true;
  return geo;
}

// extrude a flat shape toward the viewer, centred on z = 0
function extrude(shape, depth, bevel) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 5, curveSegments: 64,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
function easeOutBack(x) {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function buildEmblem(renderer, stage) {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INTRO = REDUCED ? 0 : 2.6; // seconds for the bars to grow and the arrow to draw
  // loop state; `ready` flips once the whole scene exists, so early
  // callbacks (the theme fires immediately) don't try to draw it
  let ready = false;
  let visible = false;
  let running = false;
  let mode = 'light';

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const LOOK = new THREE.Vector3(0, 1.9, 0);
  const VIEW_DIR = new THREE.Vector3(0, 0.3, 1).normalize();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x9aa6e6, 0.6);
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(4, 9, 7);
  const rim = new THREE.DirectionalLight(0xc4b5fd, 0.9); // a violet rim light from behind
  rim.position.set(-6, 4, -6);
  scene.add(hemi, key, rim);

  const root = new THREE.Group();
  scene.add(root);

  // ---- the round platform
  const PLAT_R = 3.1;
  const PLAT_H = 0.5;
  const platformMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2,
  });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(PLAT_R, PLAT_R, PLAT_H, 128), platformMat);
  platform.position.y = PLAT_H / 2;
  root.add(platform);

  // its top face carries a dot grid that glows violet
  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = dotCanvas.height = 512;
  const dctx = dotCanvas.getContext('2d');
  dctx.fillStyle = '#000';
  dctx.fillRect(0, 0, 512, 512);
  dctx.fillStyle = '#fff';
  for (let x = 16; x < 512; x += 32) {
    for (let y = 16; y < 512; y += 32) {
      dctx.beginPath();
      dctx.arc(x, y, 2.6, 0, Math.PI * 2);
      dctx.fill();
    }
  }
  const topMat = new THREE.MeshPhysicalMaterial({
    color: 0xeef0ff, roughness: 0.45, clearcoat: 0.5,
    emissive: 0x6d5cf6, emissiveMap: new THREE.CanvasTexture(dotCanvas), emissiveIntensity: 0.4,
  });
  const top = new THREE.Mesh(new THREE.CircleGeometry(PLAT_R - 0.14, 128), topMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = PLAT_H + 0.003;
  root.add(top);

  // a bright rim, and a faint halo ring floating beneath
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x7c5cf6, toneMapped: false });
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(PLAT_R + 0.01, 0.03, 12, 200), rimMat);
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = PLAT_H;
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x8b5cf6, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(new THREE.RingGeometry(PLAT_R + 0.35, PLAT_R + 0.42, 200), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -0.2;
  root.add(rimRing, halo);

  // "2016 — 2026" engraved round the front of the platform's side
  const bandCanvas = document.createElement('canvas');
  bandCanvas.width = 4096; // the band's circumference is about 20 units
  bandCanvas.height = 64; // and it is 0.3 tall — so letters keep their proportions
  const bandTex = new THREE.CanvasTexture(bandCanvas);
  bandTex.colorSpace = THREE.SRGBColorSpace;
  bandTex.anisotropy = 8;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(PLAT_R + 0.004, PLAT_R + 0.004, 0.3, 200, 1, true),
    new THREE.MeshBasicMaterial({ map: bandTex, transparent: true, toneMapped: false })
  );
  band.position.y = PLAT_H * 0.46;
  band.rotation.y = Math.PI; // the text is drawn mid-texture, which maps to the back
  root.add(band);
  function drawBand() {
    const ctx = bandCanvas.getContext('2d');
    const { width: w, height: h } = bandCanvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = mode === 'dark' ? '#d9ccff' : '#4c3bb5';
    ctx.font = '700 44px Outfit, "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
    ctx.fillText('2016  —  2026', w / 2, h / 2 + 2);
    bandTex.needsUpdate = true;
  }

  // ---- ten bars, one per year, rising in an arc behind the "10"
  const BAR_R = 2.35;
  const barMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12,
  });
  const bars = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const h = 0.55 + t * 2.45;
    const phi = Math.PI + 1.28 - t * 2.56; // from behind-left, round the back, to behind-right
    const geo = new RoundedBoxGeometry(0.34, h, 0.34, 3, 0.07);
    geo.translate(0, h / 2, 0); // grow up from the platform
    const bar = new THREE.Mesh(geo, barMat);
    bar.position.set(Math.sin(phi) * BAR_R, PLAT_H, Math.cos(phi) * BAR_R);
    bar.userData = { h, color: yearColor(t) };
    root.add(bar);
    bars.push(bar);
  }
  function paintBars() {
    const base = new THREE.Color(mode === 'dark' ? 0x1e2a4a : 0xf4f3ff);
    bars.forEach((bar) =>
      tint(bar.geometry, [[0, base], [0.35, base.clone().lerp(bar.userData.color, 0.4)], [1, bar.userData.color]])
    );
  }

  // ---- the arrow: a glowing line over the bar tops, ending in a head
  const arrowPts = [new THREE.Vector3(-2.95, PLAT_H + 0.2, 0.55)];
  bars.forEach((bar) =>
    arrowPts.push(new THREE.Vector3(bar.position.x, PLAT_H + bar.userData.h + 0.34, bar.position.z + 0.18))
  );
  const lastBar = bars[bars.length - 1];
  arrowPts.push(
    new THREE.Vector3(lastBar.position.x + 0.5, PLAT_H + lastBar.userData.h + 1.05, lastBar.position.z + 0.4)
  );
  const arrowCurve = new THREE.CatmullRomCurve3(arrowPts, false, 'centripetal');
  const TUBE_SEGS = 360;
  const RADIAL = 12;
  const tubeGeo = new THREE.TubeGeometry(arrowCurve, TUBE_SEGS, 0.05, RADIAL, false);
  {
    const col = new Float32Array(tubeGeo.attributes.position.count * 3);
    for (let i = 0; i <= TUBE_SEGS; i++) {
      const c = yearColor(i / TUBE_SEGS);
      for (let j = 0; j <= RADIAL; j++) c.toArray(col, (i * (RADIAL + 1) + j) * 3);
    }
    tubeGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const tube = new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  const tubeCount = tubeGeo.index.count;
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.17, 0.46, 32),
    new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false })
  );
  const endTan = arrowCurve.getTangentAt(1);
  head.position.copy(arrowCurve.getPointAt(1)).addScaledVector(endTan, 0.18);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endTan);
  root.add(tube, head);

  // a spark of light that runs up the arrow now and then
  const packet = new THREE.Group();
  packet.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })));
  const packetGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: 0xf0abfc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  packetGlow.scale.setScalar(0.7);
  packet.add(packetGlow);
  root.add(packet);

  // ---- the "10": a gradient front layer over a paler back layer
  const V = (x, y) => new THREE.Vector2(x, y);
  const oneShape = new THREE.Shape([
    V(0.25, 1), V(0.25, -1), V(-0.25, -1), V(-0.25, 0.46), V(-0.55, 0.3), V(-0.68, 0.56), V(-0.12, 1),
  ]);
  const zeroShape = new THREE.Shape().absellipse(0, 0, 0.8, 1, 0, Math.PI * 2);
  zeroShape.holes.push(new THREE.Path().absellipse(0, 0, 0.38, 0.6, 0, Math.PI * 2));
  const frontMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.2, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1,
  });
  const backMat = new THREE.MeshPhysicalMaterial({ color: 0xc7d2fe, roughness: 0.35, clearcoat: 0.6 });
  const DIGIT_STOPS = [[0, new THREE.Color('#1d4ed8')], [0.55, new THREE.Color('#5b4ff0')], [1, new THREE.Color('#a855f7')]];
  const ten = new THREE.Group(); // origin at the digits' foot, so it grows up from the platform
  ten.position.set(0, PLAT_H, 0.35);
  root.add(ten);
  [[oneShape, -0.8], [zeroShape, 0.7]].forEach(([shape, x]) => {
    const front = new THREE.Mesh(tint(extrude(shape, 0.34, 0.06), DIGIT_STOPS), frontMat);
    front.position.set(x, 1.06, 0);
    const back = new THREE.Mesh(extrude(shape, 0.3, 0.05), backMat);
    back.position.set(x + 0.07, 0.99, -0.3); // offset down-right and behind, like stacked lettering
    ten.add(back, front);
  });

  // the four-point sparkle from the anniversary logo
  const starShape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.085 : 0.3;
    if (i) starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  starShape.closePath();
  const sparkle = new THREE.Mesh(
    extrude(starShape, 0.1, 0.025),
    new THREE.MeshPhysicalMaterial({ color: 0x2dd4bf, emissive: 0x2dd4bf, emissiveIntensity: 0.35, roughness: 0.25, clearcoat: 1 })
  );
  sparkle.position.set(1.62, 2.14, 0.25);
  ten.add(sparkle);

  // ---- confetti drifting round the scene
  const PALETTE = ['#2563eb', '#6366f1', '#8b5cf6', '#c084fc', '#ec4899', '#22d3ee', '#fbbf24'];
  const FLAKES = 44;
  const confettiMat = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide, roughness: 0.5, metalness: 0.15, transparent: true, opacity: 0,
  });
  const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.16), confettiMat, FLAKES);
  const flakes = [];
  const flakeColor = new THREE.Color();
  for (let i = 0; i < FLAKES; i++) {
    flakes.push({
      r: 2.9 + Math.random() * 1.3,
      a: Math.random() * Math.PI * 2,
      y: 0.8 + Math.random() * 3.6,
      speed: 0.05 + Math.random() * 0.07,
      spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2),
      bob: Math.random() * Math.PI * 2,
    });
    confetti.setColorAt(i, flakeColor.set(PALETTE[i % PALETTE.length]));
  }
  root.add(confetti);
  const dummy = new THREE.Object3D();
  function placeConfetti(t) {
    flakes.forEach((f, i) => {
      const a = f.a + t * f.speed;
      dummy.position.set(Math.sin(a) * f.r, f.y + Math.sin(t * 0.6 + f.bob) * 0.18, Math.cos(a) * f.r);
      dummy.rotation.set(f.spin.x * t, f.spin.y * t, f.spin.z * t);
      dummy.updateMatrix();
      confetti.setMatrixAt(i, dummy.matrix);
    });
    confetti.instanceMatrix.needsUpdate = true;
  }

  // ---- soft shadow beneath the floating platform
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext('2d');
  const grad = sctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(40,20,90,0.55)');
  grad.addColorStop(1, 'rgba(40,20,90,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 256, 256);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, opacity: 0.3,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 8.8), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.36;
  root.add(shadow);

  // ---- theme
  onTheme((m) => {
    mode = m;
    const dark = m === 'dark';
    platformMat.color.setHex(dark ? 0x18223f : 0xffffff);
    topMat.color.setHex(dark ? 0x1c2748 : 0xeef0ff);
    topMat.emissiveIntensity = dark ? 0.9 : 0.4;
    backMat.color.setHex(dark ? 0x312e81 : 0xc7d2fe);
    rimMat.color.setHex(dark ? 0xa78bfa : 0x7c5cf6);
    haloMat.color.setHex(dark ? 0xa78bfa : 0x8b5cf6);
    scene.environmentIntensity = dark ? 0.6 : 1;
    renderer.toneMappingExposure = dark ? 1.15 : 1;
    hemi.intensity = dark ? 0.4 : 0.6;
    shadowMat.opacity = dark ? 0.6 : 0.3;
    drawBand();
    paintBars();
    if (ready && !running) frame(); // a paused emblem still shows the new theme
  });
  // redraw the engraving once the page font has loaded
  document.fonts?.ready.then(() => {
    drawBand();
    if (ready && !running) frame();
  });

  // ---- sizing: fit the whole emblem inside the stage at any aspect
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const dist = 4.1 / Math.sin(Math.min(vHalf, hHalf)); // a sphere of radius 4.1 holds the scene
    camera.position.copy(LOOK).addScaledVector(VIEW_DIR, dist);
    camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
    if (ready && !running) frame(); // resizing clears the canvas
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---- motion
  const pointer = new THREE.Vector2();
  window.addEventListener(
    'pointermove',
    (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
    { passive: true }
  );

  const timer = new Timer();
  function frame() {
    timer.update();
    const t = REDUCED ? 0 : timer.getElapsed();
    const k = INTRO ? THREE.MathUtils.clamp(t / INTRO, 0, 1) : 1; // intro progress

    // the bars grow one after another, then the arrow draws over them
    bars.forEach((bar, i) => {
      const g = THREE.MathUtils.clamp((k - i * 0.045) / 0.45, 0, 1);
      bar.scale.y = Math.max(0.001, easeOutCubic(g));
      bar.visible = g > 0;
    });
    const draw = THREE.MathUtils.clamp((k - 0.5) / 0.45, 0, 1);
    tubeGeo.setDrawRange(0, Math.floor((tubeCount * draw) / 6) * 6);
    head.visible = draw > 0.9;
    head.scale.setScalar(THREE.MathUtils.clamp((draw - 0.9) / 0.1, 0.001, 1));
    ten.scale.setScalar(0.55 + 0.45 * easeOutBack(THREE.MathUtils.clamp(k / 0.32, 0, 1)));
    confettiMat.opacity = THREE.MathUtils.clamp((k - 0.35) / 0.4, 0, 1) * 0.95;
    confetti.visible = confettiMat.opacity > 0.01;
    placeConfetti(t);

    const cycle = k < 1 ? -1 : ((t - INTRO) % 4.5) / 2.2;
    packet.visible = cycle >= 0 && cycle <= 1;
    if (packet.visible) packet.position.copy(arrowCurve.getPointAt(cycle));

    ten.rotation.y = Math.sin(t * 0.45) * 0.16; // turns on its foot, so it stays standing
    sparkle.rotation.z = t * 0.8;
    sparkle.scale.setScalar(1 + Math.sin(t * 2) * 0.07);
    root.rotation.y += (pointer.x * 0.22 + Math.sin(t * 0.3) * 0.06 - root.rotation.y) * 0.05;
    root.rotation.x += (pointer.y * 0.05 - root.rotation.x) * 0.05;
    renderer.render(scene, camera);
  }

  // animate only while the stage is on screen and the tab is visible
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
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      start();
    },
    { rootMargin: '120px' }
  ).observe(stage);
  document.addEventListener('visibilitychange', start);

  // one frame straight away, so the emblem is there before the loop starts
  ready = true;
  frame();

  if (import.meta.env.DEV) window.__aboutHero = { render: frame };
}

// ---------------------------------------------------------------------
// start-up — last, so the constants above exist before the scene is built
// ---------------------------------------------------------------------

const heroStage = document.querySelector('.a-hero__stage');
const heroCanvas = heroStage?.querySelector('canvas');
let heroRenderer = null;
if (heroCanvas) {
  try {
    heroRenderer = new THREE.WebGLRenderer({ canvas: heroCanvas, antialias: true, alpha: true });
  } catch {
    heroStage.classList.add('is-flat'); // no WebGL: the stylesheet draws a flat "10" instead
  }
}
if (heroRenderer) buildEmblem(heroRenderer, heroStage);
