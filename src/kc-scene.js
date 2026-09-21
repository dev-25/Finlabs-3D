import * as THREE from 'three';
import { Timer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { onTheme } from './theme.js';

/* =====================================================
 * KNOWLEDGE CENTRE — the hub's 3D stand
 * =====================================================
 * A round white platform holds the three ways in:
 *   left   Blogs         a fanned stack of article sheets
 *   centre SummariWise   an open book whose page turns
 *   right  Infographics  a chart board with rising bars
 *                        and a turning donut
 * Each stands on its own pedestal with a name plate.
 * Hovering one lifts it (and lights its card below);
 * clicking opens that section. It only animates while
 * the hero is on screen.
 * ===================================================== */

const BLUE = '#2563eb';
const VIOLET = '#7c3aed';
const AQUA = '#0891b2';
const GREEN = '#059669';

export function buildKnowledgeScene(stage, { onPick, onHover } = {}) {
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

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const LOOK = new THREE.Vector3(0, 1.15, 0);
  const VIEW = new THREE.Vector3(0, 0.36, 1).normalize();

  scene.add(new THREE.HemisphereLight(0xffffff, 0xa8b4ec, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 9, 7);
  const rim = new THREE.DirectionalLight(0xc4b5fd, 0.8);
  rim.position.set(-6, 5, -6);
  scene.add(key, rim);

  const root = new THREE.Group();
  scene.add(root);

  // ---------------------------------------------------------------- helpers
  const disposables = [];
  const mat = (color, extra = {}) => {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25, ...extra });
    disposables.push(m);
    return m;
  };
  function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const redraw = (...args) => {
      draw(c.getContext('2d'), w, h, ...args);
      tex.needsUpdate = true;
    };
    redraw();
    return { tex, redraw };
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  }

  // ---------------------------------------------------------------- platform
  const PLAT_R = 4.6;
  const platformMat = mat('#ffffff', { roughness: 0.3, clearcoat: 0.8 });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(PLAT_R, PLAT_R * 1.02, 0.34, 128), platformMat);
  platform.position.y = 0.17;
  root.add(platform);
  const ringMat = mat(BLUE, { emissive: BLUE, emissiveIntensity: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(PLAT_R + 0.02, 0.035, 12, 160), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.34;
  root.add(ring);

  // a quiet dot grid on the platform top
  const dots = canvasTexture(1024, 1024, (g, w, h, dark) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = dark ? 'rgba(122,165,255,0.55)' : 'rgba(37,99,235,0.28)';
    for (let x = 16; x < w; x += 32) {
      for (let y = 16; y < h; y += 32) {
        const d = Math.hypot(x - w / 2, y - h / 2) / (w / 2);
        if (d > 0.97) continue;
        g.beginPath();
        g.arc(x, y, 2.6 * (1 - d * 0.5), 0, Math.PI * 2);
        g.fill();
      }
    }
  });
  const dotMat = new THREE.MeshBasicMaterial({ map: dots.tex, transparent: true, depthWrite: false, toneMapped: false });
  disposables.push(dotMat);
  const dotDisc = new THREE.Mesh(new THREE.CircleGeometry(PLAT_R, 96), dotMat);
  dotDisc.rotation.x = -Math.PI / 2;
  dotDisc.position.y = 0.345;
  root.add(dotDisc);

  // ---------------------------------------------------------------- stations
  const STATIONS = [
    { id: 'blogs', label: 'BLOGS', sub: '36 articles', x: -3.15, z: -0.4, color: BLUE },
    { id: 'infographics', label: 'INFOGRAPHICS', sub: '10 at a glance', x: -1.05, z: 0.5, color: VIOLET },
    { id: 'summariwise', label: 'SUMMARIWISE', sub: '31 book summaries', x: 1.05, z: 0.5, color: AQUA },
    { id: 'calculators', label: 'CALCULATORS', sub: 'SIP & lumpsum', x: 3.15, z: -0.4, color: GREEN },
  ];
  const stations = [];
  const pickables = [];
  const baseMats = [];

  function pedestal(s) {
    const g = new THREE.Group();
    g.position.set(s.x, 0.34, s.z);
    root.add(g);
    const baseMat = mat('#f4f7ff', { roughness: 0.4 });
    baseMats.push(baseMat);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.01, 0.22, 64), baseMat);
    base.position.y = 0.11;
    g.add(base);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.99, 0.025, 8, 96), mat(s.color, { emissive: s.color, emissiveIntensity: 0.4 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.2;
    g.add(band);

    // the name plate, leaning back at the front edge
    const plate = canvasTexture(640, 150, (c, w, h, dark) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = dark ? '#0e172c' : '#ffffff';
      roundRect(c, 4, 4, w - 8, h - 8, 34);
      c.fill();
      c.lineWidth = 4;
      c.strokeStyle = dark ? 'rgba(150,175,255,0.35)' : 'rgba(15,35,75,0.12)';
      c.stroke();
      c.fillStyle = s.color;
      roundRect(c, 30, 40, 12, h - 80, 6);
      c.fill();
      c.fillStyle = dark ? '#e9eeff' : '#0f1a33';
      c.font = '800 54px Outfit, "Segoe UI", sans-serif';
      c.textBaseline = 'alphabetic';
      c.fillText(s.label, 62, 84);
      c.fillStyle = dark ? '#8d99b5' : '#5d6a86';
      c.font = '600 28px "JetBrains Mono", ui-monospace, monospace';
      c.fillText(s.sub.toUpperCase(), 64, 122);
    });
    const plateMat = new THREE.MeshBasicMaterial({ map: plate.tex, transparent: true, toneMapped: false });
    disposables.push(plateMat);
    const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 0.45), plateMat);
    plateMesh.position.set(0, 0.34, 1.1);
    plateMesh.rotation.x = -0.5;
    g.add(plateMesh);

    const holder = new THREE.Group(); // lifts on hover
    holder.position.y = 0.22;
    g.add(holder);
    return { group: g, holder, plate, band };
  }

  // ---- Blogs: three article sheets, fanned
  function buildBlogs(holder) {
    const sheetGeo = new RoundedBoxGeometry(1.45, 1.9, 0.05, 4, 0.06);
    const article = canvasTexture(512, 672, (c, w, h, dark, variant = 0) => {
      c.fillStyle = dark ? '#111b33' : '#ffffff';
      c.fillRect(0, 0, w, h);
      // picture block
      const grad = c.createLinearGradient(0, 0, w, 260);
      grad.addColorStop(0, variant ? '#7c3aed' : '#2563eb');
      grad.addColorStop(1, variant ? '#0891b2' : '#7c3aed');
      c.fillStyle = grad;
      roundRect(c, 36, 36, w - 72, 230, 22);
      c.fill();
      // a small rising chart inside it
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 9;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(80, 220);
      c.lineTo(170, 160);
      c.lineTo(240, 190);
      c.lineTo(330, 110);
      c.lineTo(430, 80);
      c.stroke();
      // tag, title and text lines
      c.fillStyle = dark ? 'rgba(122,165,255,0.25)' : 'rgba(37,99,235,0.12)';
      roundRect(c, 36, 300, 150, 34, 17);
      c.fill();
      c.fillStyle = dark ? '#e9eeff' : '#0f1a33';
      roundRect(c, 36, 360, w - 90, 30, 10);
      c.fill();
      roundRect(c, 36, 404, w - 190, 30, 10);
      c.fill();
      c.fillStyle = dark ? 'rgba(188,198,223,0.45)' : 'rgba(51,65,95,0.28)';
      for (let i = 0; i < 6; i++) {
        roundRect(c, 36, 470 + i * 30, i === 5 ? 250 : w - 72 - (i % 2) * 40, 14, 7);
        c.fill();
      }
    });
    const faceMat = new THREE.MeshStandardMaterial({ map: article.tex, roughness: 0.55 });
    const edgeMat = mat('#e8eefc', { roughness: 0.5, clearcoat: 0.2 });
    disposables.push(faceMat);
    const sheets = [];
    for (let i = 0; i < 3; i++) {
      // box faces: +x -x +y -y +z -z ; only the front shows the article
      const m = new THREE.Mesh(sheetGeo, [edgeMat, edgeMat, edgeMat, edgeMat, i === 2 ? faceMat : edgeMat, edgeMat]);
      const pivot = new THREE.Group();
      pivot.position.set((i - 1) * 0.28, 0.02, (i - 1) * 0.18 - 0.1);
      pivot.rotation.set(-0.12, (1 - i) * 0.22 + 0.18, (1 - i) * 0.05);
      m.position.y = 0.95;
      pivot.add(m);
      holder.add(pivot);
      sheets.push(pivot);
    }
    return {
      article,
      tick(t) {
        sheets[2].position.y = 0.02 + (Math.sin(t * 1.4) + 1) * 0.05;
        sheets[1].position.y = 0.02 + (Math.sin(t * 1.4 + 1.2) + 1) * 0.025;
      },
    };
  }

  // ---- SummariWise: an open book with a turning page
  function buildBook(holder) {
    const book = new THREE.Group();
    book.position.y = 0.55;
    book.rotation.x = 0.95; // raised toward the viewer, like a book on a stand
    holder.add(book);

    const W = 1.05; // one half's width
    const H = 1.5;
    const pageText = canvasTexture(512, 720, (c, w, h, dark, side = 0) => {
      c.fillStyle = dark ? '#f1ede3' : '#fffdf7';
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(15,26,51,0.75)';
      if (side === 0) {
        c.fillStyle = BLUE;
        c.font = '800 44px Outfit, "Segoe UI", sans-serif';
        c.fillText('Summari', 56, 120);
        c.fillStyle = AQUA;
        c.fillText('Wise', 56 + c.measureText('Summari').width, 120);
        c.fillStyle = 'rgba(15,26,51,0.2)';
        c.fillRect(56, 150, 150, 6);
      }
      c.fillStyle = 'rgba(15,26,51,0.26)';
      for (let i = 0; i < (side === 0 ? 14 : 17); i++) {
        const y = (side === 0 ? 210 : 90) + i * 34;
        roundRect(c, 56, y, (i % 4 === 3 ? 260 : w - 112) - (side * 10) % 30, 12, 6);
        c.fill();
      }
    });
    const pageText2 = canvasTexture(512, 720, (c, w, h, dark) => {
      c.fillStyle = dark ? '#f1ede3' : '#fffdf7';
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(8,145,178,0.16)';
      roundRect(c, 56, 70, w - 112, 200, 18);
      c.fill();
      c.strokeStyle = AQUA;
      c.lineWidth = 8;
      c.beginPath();
      c.arc(w / 2, 170, 60, -Math.PI / 2, Math.PI * 1.1);
      c.stroke();
      c.fillStyle = 'rgba(15,26,51,0.26)';
      for (let i = 0; i < 12; i++) {
        roundRect(c, 56, 320 + i * 34, i % 5 === 4 ? 220 : w - 112, 12, 6);
        c.fill();
      }
    });
    const coverMat = mat(BLUE, { roughness: 0.45, clearcoat: 0.5 });
    const paperMat = mat('#fbf8f0', { roughness: 0.9, clearcoat: 0 });
    const leftFace = new THREE.MeshStandardMaterial({ map: pageText.tex, roughness: 0.9 });
    const rightFace = new THREE.MeshStandardMaterial({ map: pageText2.tex, roughness: 0.9 });
    disposables.push(leftFace, rightFace);

    const halves = [];
    for (const side of [-1, 1]) {
      const half = new THREE.Group();
      half.rotation.z = side * 0.12; // the pages rise a little from the spine
      book.add(half);
      const cover = new THREE.Mesh(new RoundedBoxGeometry(W + 0.08, 0.05, H + 0.1, 3, 0.02), coverMat);
      cover.position.set(side * (W / 2 + 0.03), -0.06, 0);
      half.add(cover);
      const block = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, H), [
        paperMat, paperMat, side < 0 ? leftFace : rightFace, paperMat, paperMat, paperMat,
      ]);
      block.position.set(side * (W / 2 + 0.01), 0.03, 0);
      // the page texture lies flat on top: turn its UVs so text reads from the viewer
      half.add(block);
      halves.push(half);
    }
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, H + 0.1, 16, 1, false, Math.PI, Math.PI), coverMat);
    spine.rotation.x = Math.PI / 2;
    spine.position.y = -0.07;
    book.add(spine);

    // the turning page: a bendable plane hinged on the spine
    const pageGeo = new THREE.PlaneGeometry(W, H, 18, 1);
    pageGeo.translate(W / 2, 0, 0);
    pageGeo.rotateX(-Math.PI / 2);
    const flat = pageGeo.attributes.position.array.slice();
    const turnMat = new THREE.MeshStandardMaterial({ color: '#fffdf7', roughness: 0.9, side: THREE.DoubleSide });
    disposables.push(turnMat);
    const turn = new THREE.Mesh(pageGeo, turnMat);
    turn.position.y = 0.095;
    book.add(turn);

    // a ribbon bookmark
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.5), mat('#f59e0b', { roughness: 0.6 }));
    ribbon.position.set(0.12, 0.1, H / 2 + 0.2);
    ribbon.rotation.x = 0.35;
    book.add(ribbon);

    return {
      pages: [pageText, pageText2],
      tick(t) {
        // one turn every 5 s: lift, sweep over the spine, settle
        const p = REDUCED ? 0.18 : ((t % 5) / 5);
        const k = THREE.MathUtils.smootherstep(Math.min(1, p / 0.55), 0, 1);
        const angle = 0.12 + k * (Math.PI - 0.24); // lying on the right page → lying on the left
        const bend = Math.sin(k * Math.PI) * 0.35;
        const pos = pageGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = flat[i * 3];
          const u = x / W; // 0 at the spine, 1 at the edge
          const a = angle + bend * u * u * (k < 0.5 ? -1 : 1) * 0.6;
          pos.setX(i, Math.cos(a) * x);
          pos.setY(i, Math.sin(a) * x + 0.01 * u);
        }
        pos.needsUpdate = true;
        pageGeo.computeVertexNormals();
        turn.visible = p < 0.62;
        halves.forEach((h, i) => (h.rotation.z = (i ? 1 : -1) * (0.12 + Math.sin(t * 0.8) * 0.01)));
      },
    };
  }

  // ---- Infographics: a chart board with bars and a donut
  function buildBoard(holder) {
    const board = new THREE.Group();
    board.position.set(0, 0.05, -0.15);
    board.rotation.set(-0.08, -0.22, 0);
    holder.add(board);
    const panel = new THREE.Mesh(new RoundedBoxGeometry(1.8, 1.65, 0.08, 4, 0.08), mat('#ffffff', { roughness: 0.4 }));
    panel.position.y = 1.02;
    board.add(panel);
    const face = canvasTexture(560, 512, (c, w, h, dark) => {
      c.fillStyle = dark ? '#0e172c' : '#ffffff';
      c.fillRect(0, 0, w, h);
      c.fillStyle = dark ? '#e9eeff' : '#0f1a33';
      roundRect(c, 40, 40, 260, 26, 10);
      c.fill();
      c.fillStyle = dark ? 'rgba(188,198,223,0.45)' : 'rgba(51,65,95,0.25)';
      roundRect(c, 40, 82, 180, 14, 7);
      c.fill();
      c.strokeStyle = dark ? 'rgba(150,175,255,0.2)' : 'rgba(15,35,75,0.1)';
      c.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(40, 170 + i * 80);
        c.lineTo(w - 40, 170 + i * 80);
        c.stroke();
      }
    });
    const faceMat = new THREE.MeshBasicMaterial({ map: face.tex, toneMapped: false });
    disposables.push(faceMat);
    const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 1.5), faceMat);
    facePlane.position.set(0, 1.02, 0.045);
    board.add(facePlane);
    // stand legs
    const legMat = mat('#c9d4ee', { roughness: 0.4 });
    for (const x of [-0.55, 0.55]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 12), legMat);
      leg.position.set(x, 0.12, -0.02);
      board.add(leg);
    }

    const colors = [BLUE, '#4f46e5', VIOLET, AQUA];
    const bars = colors.map((c, i) => {
      const bar = new THREE.Mesh(new RoundedBoxGeometry(0.22, 1, 0.14, 3, 0.04), mat(c, { roughness: 0.3 }));
      bar.geometry.translate(0, 0.5, 0);
      bar.position.set(-0.55 + i * 0.3, 0.36, 0.13);
      board.add(bar);
      return bar;
    });

    const donut = new THREE.Group();
    donut.position.set(0.95, 0.45, 0.55);
    holder.add(donut);
    const parts = [
      [0.46, BLUE],
      [0.3, VIOLET],
      [0.24, AQUA],
    ];
    let start = 0;
    parts.forEach(([share, c]) => {
      const arc = share * Math.PI * 2 - 0.08;
      const seg = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 16, 48, arc), mat(c, { roughness: 0.3 }));
      seg.rotation.z = start;
      donut.add(seg);
      start += share * Math.PI * 2;
    });
    return {
      face,
      tick(t) {
        bars.forEach((bar, i) => {
          const target = 0.35 + 0.22 * i + Math.sin(t * 1.3 + i * 0.9) * 0.12;
          bar.scale.y = REDUCED ? 0.35 + 0.22 * i : target;
        });
        donut.rotation.y = Math.sin(t * 0.6) * 0.6;
        donut.rotation.x = -0.25;
        donut.position.y = 0.45 + Math.sin(t * 1.1) * 0.05;
      },
    };
  }

  // ---- Calculators: a pocket calculator, with a ₹ coin turning beside it
  function buildCalc(holder) {
    const g = new THREE.Group();
    g.position.set(0, 0.05, -0.05);
    g.rotation.set(-0.1, -0.16, 0);
    holder.add(g);

    const body = new THREE.Mesh(new RoundedBoxGeometry(1.34, 1.78, 0.26, 4, 0.12), mat('#f4f7ff', { roughness: 0.35 }));
    body.position.y = 0.95;
    g.add(body);

    const screen = canvasTexture(512, 208, (c, w, h, dark) => {
      c.fillStyle = dark ? '#0b1d33' : '#dff3ea';
      roundRect(c, 0, 0, w, h, 26);
      c.fill();
      c.fillStyle = dark ? 'rgba(160,220,200,0.5)' : 'rgba(6,78,59,0.45)';
      c.font = '600 30px "JetBrains Mono", ui-monospace, monospace';
      c.fillText('TOTAL VALUE', 28, 52);
      c.fillStyle = dark ? '#6ee7b7' : '#047857';
      c.font = '800 74px Outfit, "Segoe UI", sans-serif';
      c.textAlign = 'right';
      c.fillText('₹23,23,391', w - 28, 140);
      c.textAlign = 'left';
      c.fillStyle = dark ? 'rgba(160,220,200,0.45)' : 'rgba(6,78,59,0.4)';
      c.font = '600 26px "JetBrains Mono", ui-monospace, monospace';
      c.fillText('10 YR · 12%', 28, 182);
    });
    const screenMat = new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false });
    disposables.push(screenMat);
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.43), screenMat);
    screenMesh.position.set(0, 1.5, 0.135);
    g.add(screenMesh);

    // four rows of keys, with the tall one on the right doing the adding up
    const keyMat = mat('#dbe4f7', { roughness: 0.4 });
    const warmMat = mat(GREEN, { roughness: 0.3, emissive: GREEN, emissiveIntensity: 0.25 });
    const keys = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const last = col === 3;
        const key = new THREE.Mesh(
          new RoundedBoxGeometry(0.22, 0.2, 0.07, 3, 0.035),
          last && row > 1 ? warmMat : keyMat
        );
        key.position.set(-0.39 + col * 0.26, 1.11 - row * 0.245, 0.13);
        g.add(key);
        keys.push(key);
      }
    }

    const coin = new THREE.Group();
    coin.position.set(0.92, 0.6, 0.5);
    holder.add(coin);
    const coinFace = canvasTexture(192, 192, (c, w, h, dark) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = dark ? '#f6cf6a' : '#f2c14e';
      c.beginPath();
      c.arc(96, 96, 92, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#8a5a0b';
      c.font = '700 116px Inter, "Segoe UI", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('₹', 96, 104);
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
    });
    const coinMat = new THREE.MeshBasicMaterial({ map: coinFace.tex, transparent: true, toneMapped: false });
    disposables.push(coinMat);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 32), mat('#f5c451', { roughness: 0.25, metalness: 0.6 }));
    rim.rotation.x = Math.PI / 2;
    coin.add(rim);
    [0.035, -0.035].forEach((z, i) => {
      const side = new THREE.Mesh(new THREE.CircleGeometry(0.285, 32), coinMat);
      side.position.z = z;
      side.rotation.y = i ? Math.PI : 0;
      coin.add(side);
    });

    return {
      face: screen,
      tick(t) {
        // a finger running over the keypad
        const lit = REDUCED ? -1 : Math.floor(t * 2.2) % keys.length;
        keys.forEach((key, i) => {
          const press = i === lit ? 0.035 : 0;
          key.position.z = 0.13 - press;
        });
        coin.rotation.y = REDUCED ? 0.4 : t * 1.1;
        coin.position.y = 0.6 + (REDUCED ? 0 : Math.sin(t * 1.2) * 0.07);
      },
    };
  }

  const builders = { blogs: buildBlogs, summariwise: buildBook, infographics: buildBoard, calculators: buildCalc };
  STATIONS.forEach((s) => {
    const p = pedestal(s);
    const inner = builders[s.id](p.holder);
    p.group.traverse((o) => {
      if (o.isMesh) {
        o.userData.station = s.id;
        pickables.push(o);
      }
    });
    stations.push({ ...s, ...p, inner, lift: 0, target: 0 });
  });

  // ---------------------------------------------------------------- floating sparks
  const SPARKS = 42;
  const sparkGeo = new THREE.SphereGeometry(0.035, 10, 8);
  const sparkMat = new THREE.MeshStandardMaterial({ roughness: 0.3, emissiveIntensity: 0.6 });
  disposables.push(sparkMat);
  const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, SPARKS);
  const seeds = [];
  const palette = [BLUE, VIOLET, AQUA, GREEN].map((c) => new THREE.Color(c));
  for (let i = 0; i < SPARKS; i++) {
    seeds.push({ r: 2.2 + Math.random() * 2.4, a: Math.random() * Math.PI * 2, y: 0.8 + Math.random() * 2.4, s: 0.05 + Math.random() * 0.1 });
    sparks.setColorAt(i, palette[i % 4]);
  }
  root.add(sparks);
  const tmp = new THREE.Object3D();
  function placeSparks(t) {
    seeds.forEach((d, i) => {
      const a = d.a + t * d.s;
      tmp.position.set(Math.cos(a) * d.r, d.y + Math.sin(t * 0.7 + i) * 0.12, Math.sin(a) * d.r * 0.55 - 0.6);
      tmp.scale.setScalar(0.7 + ((i * 7) % 5) * 0.15);
      tmp.updateMatrix();
      sparks.setMatrixAt(i, tmp.matrix);
    });
    sparks.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- theme
  let ready = false;
  let running = false;
  let visible = false;
  onTheme((mode) => {
    const dark = mode === 'dark';
    // in the dark the white stand turns to deep navy, with less gloss to catch the light
    platformMat.color.set(dark ? '#111b36' : '#ffffff');
    platformMat.clearcoat = dark ? 0.35 : 0.8;
    platformMat.roughness = dark ? 0.55 : 0.3;
    baseMats.forEach((m) => m.color.set(dark ? '#1b2748' : '#f4f7ff'));
    dots.redraw(dark);
    stations.forEach((st) => {
      st.plate.redraw(dark);
      st.inner.article?.redraw(dark, 0);
      st.inner.face?.redraw(dark);
    });
    key.intensity = dark ? 1.1 : 1.4;
    if (ready && !running) frame();
  });
  // canvas text uses the page fonts: redraw once they have loaded
  document.fonts?.ready.then(() => {
    const dark = document.documentElement.dataset.theme === 'dark';
    stations.forEach((st) => {
      st.plate.redraw(dark);
      st.inner.pages?.forEach((p, i) => p.redraw(dark, i));
    });
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
    // the stand is wide and fairly flat: fit its width and its height separately
    const dist = Math.max(4.9 / Math.tan(hHalf), 2.15 / Math.tan(vHalf));
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

  function stationAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.station : null;
  }
  function setHover(id) {
    if (id === hovered) return;
    hovered = id;
    stage.classList.toggle('is-pointing', Boolean(id));
    stations.forEach((st) => (st.target = st.id === id ? 1 : 0));
    onHover?.(id);
    if (!running) start(true);
  }
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') setHover(stationAt(e));
  });
  canvas.addEventListener('pointerleave', () => setHover(null));
  canvas.addEventListener('click', (e) => {
    const id = stationAt(e);
    if (id) onPick?.(id);
  });
  window.addEventListener(
    'pointermove',
    (e) => pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
    { passive: true }
  );

  // ---------------------------------------------------------------- loop
  const timer = new Timer();
  function frame() {
    timer.update();
    const t = REDUCED ? 0 : timer.getElapsed();
    stations.forEach((st, i) => {
      st.lift += (st.target - st.lift) * (REDUCED ? 1 : 0.12);
      st.holder.position.y = 0.22 + st.lift * 0.22 + (REDUCED ? 0 : Math.sin(t * 0.9 + i * 2) * 0.03);
      st.holder.scale.setScalar(1 + st.lift * 0.06);
      st.band.material.emissiveIntensity = 0.4 + st.lift * 1.2;
      st.inner.tick(t);
    });
    placeSparks(t);
    root.rotation.y += (pointer.x * 0.14 + Math.sin(t * 0.25) * 0.05 - root.rotation.y) * 0.05;
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
  function start(force = false) {
    if (running || !visible || document.hidden) return;
    if (REDUCED && !force) return;
    if (REDUCED) {
      // no loop: settle the hover lift in a few frames
      let n = 0;
      const settle = () => {
        frame();
        if (++n < 2) requestAnimationFrame(settle);
      };
      requestAnimationFrame(settle);
      return;
    }
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
  document.addEventListener('visibilitychange', () => start());

  ready = true;
  frame();

  const api = {
    /** light a station from outside (the section cards) */
    highlight(id) {
      stations.forEach((st) => (st.target = st.id === id ? 1 : 0));
      start(true);
    },
  };
  if (import.meta.env.DEV) window.__kcScene = { render: frame, stations, camera };
  return api;
}
