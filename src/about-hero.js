import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { onTheme } from './theme.js';

/* =====================================================
 * ABOUT — the anniversary emblem
 * =====================================================
 * A bevelled "10" standing on a plinth engraved
 * 2016 — 2026, with ten beads — one per year — circling
 * it. It animates only while the hero is on screen and
 * the tab is visible; otherwise it holds its last frame.
 * ===================================================== */

const stage = document.querySelector('.a-hero__stage');
const canvas = stage?.querySelector('canvas');

let renderer = null;
if (canvas) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    stage.classList.add('is-flat'); // no WebGL: the stylesheet draws a flat "10" instead
  }
}
if (renderer) buildEmblem(renderer);

// a two-colour fade from the bottom of a geometry to its top, baked into vertex colours
function tint(geo, bottomHex, topHex) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const lo = new THREE.Color(bottomHex);
  const hi = new THREE.Color(topHex);
  const c = new THREE.Color();
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    c.lerpColors(lo, hi, (pos.getY(i) - min.y) / (max.y - min.y || 1));
    c.toArray(col, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
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

function buildEmblem(renderer) {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // loop state; `ready` flips once the whole scene exists, so early
  // callbacks (the theme fires immediately) don't try to draw it
  let ready = false;
  let visible = false;
  let running = false;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const LOOK = new THREE.Vector3(0, 1.4, 0);
  const VIEW_DIR = new THREE.Vector3(0, 0.3, 1).normalize();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899cc, 0.6);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 8, 7);
  const rim = new THREE.DirectionalLight(0x9db7ff, 0.9);
  rim.position.set(-6, 3, -6);
  scene.add(hemi, key, rim);

  const root = new THREE.Group();
  scene.add(root);

  // ---- the plinth, with a thin blue band and an engraved plaque
  const PLINTH_H = 0.56;
  const plinthMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.25,
  });
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(4.6, PLINTH_H, 1.9, 4, 0.08), plinthMat);
  plinth.position.y = PLINTH_H / 2;
  const bandMat = new THREE.MeshBasicMaterial({ color: 0x2563eb });
  const band = new THREE.Mesh(new RoundedBoxGeometry(4.63, 0.04, 1.93, 2, 0.018), bandMat);
  band.position.y = PLINTH_H - 0.06;
  root.add(plinth, band);

  const plaqueCanvas = document.createElement('canvas');
  plaqueCanvas.width = 1024;
  plaqueCanvas.height = 128;
  const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
  plaqueTex.colorSpace = THREE.SRGBColorSpace;
  plaqueTex.anisotropy = 8;
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.4),
    new THREE.MeshBasicMaterial({ map: plaqueTex, transparent: true, toneMapped: false })
  );
  plaque.position.set(0, 0.25, 0.952); // on the flat of the front face
  root.add(plaque);

  let mode = 'light';
  function drawPlaque() {
    const ctx = plaqueCanvas.getContext('2d');
    const { width: w, height: h } = plaqueCanvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = mode === 'dark' ? '#cfe0ff' : '#1d3f8f';
    ctx.font = '700 62px Outfit, "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '12px';
    ctx.fillText('2016 — 2026', w / 2, h / 2 + 3);
    plaqueTex.needsUpdate = true;
  }
  // redraw once the page font has loaded, so the plaque matches the headings
  document.fonts?.ready.then(() => {
    drawPlaque();
    if (ready && !running) frame();
  });

  // ---- the "10", fading from deep blue at the foot to sky blue at the top
  const ten = new THREE.Group();
  ten.position.y = PLINTH_H + 1.06; // digits are 2 tall, plus the bevel
  root.add(ten);
  const digitMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12,
  });
  const V = (x, y) => new THREE.Vector2(x, y);
  const oneShape = new THREE.Shape([
    V(0.25, 1), V(0.25, -1), V(-0.25, -1), V(-0.25, 0.46), V(-0.55, 0.3), V(-0.68, 0.56), V(-0.12, 1),
  ]);
  const zeroShape = new THREE.Shape().absellipse(0, 0, 0.8, 1, 0, Math.PI * 2);
  zeroShape.holes.push(new THREE.Path().absellipse(0, 0, 0.38, 0.6, 0, Math.PI * 2));
  const one = new THREE.Mesh(tint(extrude(oneShape, 0.46, 0.07), 0x1d3fa8, 0x3aa0f5), digitMat);
  one.position.x = -0.8;
  const zero = new THREE.Mesh(tint(extrude(zeroShape, 0.46, 0.07), 0x1d3fa8, 0x3aa0f5), digitMat);
  zero.position.x = 0.7;
  ten.add(one, zero);

  // the four-point sparkle from the anniversary logo
  const starShape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.085 : 0.3;
    if (i) starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  starShape.closePath();
  const sparkleMat = new THREE.MeshPhysicalMaterial({
    color: 0x2dd4bf, emissive: 0x2dd4bf, emissiveIntensity: 0.3, roughness: 0.25, clearcoat: 1,
  });
  const sparkle = new THREE.Mesh(extrude(starShape, 0.1, 0.025), sparkleMat);
  sparkle.position.set(1.62, 1.08, 0.3);
  ten.add(sparkle);

  // ---- ten beads on a tilted ring, one per year; the tenth is larger
  const orbit = new THREE.Group();
  orbit.position.y = ten.position.y;
  orbit.rotation.x = 0.3; // front dips toward the viewer, so the ring reads as a ring
  root.add(orbit);
  const RING_R = 2.75;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.012, 8, 240), ringMat);
  ring.rotation.x = Math.PI / 2;
  orbit.add(ring);
  const beads = new THREE.Group();
  orbit.add(beads);
  const beadMat = new THREE.MeshPhysicalMaterial({
    color: 0x60a5fa, roughness: 0.3, clearcoat: 1, emissive: 0x60a5fa, emissiveIntensity: 0.15,
  });
  for (let i = 0; i < 10; i++) {
    const tenth = i === 9;
    const bead = new THREE.Mesh(new THREE.SphereGeometry(tenth ? 0.13 : 0.075, 32, 20), tenth ? sparkleMat : beadMat);
    const a = (i / 10) * Math.PI * 2;
    bead.position.set(Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R);
    beads.add(bead);
  }

  // ---- soft contact shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext('2d');
  const grad = sctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(10,20,50,0.6)');
  grad.addColorStop(1, 'rgba(10,20,50,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 256, 256);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.32 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 3.4), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  root.add(shadow);

  // ---- theme
  onTheme((m) => {
    mode = m;
    const dark = m === 'dark';
    plinthMat.color.setHex(dark ? 0x1b2744 : 0xffffff);
    bandMat.color.setHex(dark ? 0x60a5fa : 0x2563eb);
    ringMat.color.setHex(dark ? 0x7aa5ff : 0x3b82f6);
    scene.environmentIntensity = dark ? 0.55 : 1;
    renderer.toneMappingExposure = dark ? 1.15 : 1;
    hemi.intensity = dark ? 0.4 : 0.6;
    shadowMat.opacity = dark ? 0.6 : 0.32;
    drawPlaque();
    if (ready && !running) frame(); // a paused emblem still shows the new theme
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
    const dist = 3.1 / Math.sin(Math.min(vHalf, hHalf)); // a sphere of radius 3.1 holds the emblem
    camera.position.copy(LOOK).addScaledVector(VIEW_DIR, dist);
    camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
    // resizing clears the canvas; redraw straight away if the loop is paused
    if (ready && !running) frame();
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
    ten.rotation.y = Math.sin(t * 0.45) * 0.22; // turns on its foot, so it stays standing
    sparkle.rotation.z = t * 0.8;
    sparkle.scale.setScalar(1 + Math.sin(t * 2) * 0.06);
    beads.rotation.y = t * 0.22;
    root.rotation.y += (pointer.x * 0.25 - root.rotation.y) * 0.05;
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
    if (running || !visible || document.hidden) return;
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

  // one frame straight away, so the emblem is there even before the loop
  // starts (a page opened in a background tab, a print, a screenshot)
  ready = true;
  frame();

  if (import.meta.env.DEV) window.__aboutHero = { render: frame };
}
