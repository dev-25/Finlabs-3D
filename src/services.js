import './style.css';
import * as THREE from 'three';
import { Timer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { initTheme, onTheme, currentTheme } from './theme.js';

/* =====================================================
 * FINLABS SERVICES — cybernetic workstation
 * =====================================================
 * A neon-lit operations room. The monitor on the desk is
 * the whole story: every service detail is drawn into the
 * screen, and scrolling swaps which one is displayed.
 * ===================================================== */

initTheme();

// =====================================================
// PALETTE
// =====================================================

const P = {
  dark: {
    air: 0x08070d,
    wall: 0x171220,
    wallFar: 0x241826,
    floor: 0x0d0b12,
    desk: 0x141b23,
    deskTop: 0x1d2731,
    metal: 0x1a2029,
    neon: 0x2ff0e0,
    neonDim: 0x148f88,
    glow: 0xff6a1a,
    glowDeep: 0xc8390e,
    chair: 0x11161d,
    screenGlow: 0x2ff0e0,
    ambient: 0.55,
    fogNear: 18,
    fogFar: 74,
    // canvas colours for the monitor artwork
    scr: {
      bg: '#05141a',
      panel: 'rgba(20,80,92,0.20)',
      edge: 'rgba(47,240,224,0.55)',
      ink: '#d6fbff',
      dim: '#6fb9c4',
      neon: '#2ff0e0',
      warm: '#ff8a3c',
      grid: 'rgba(47,240,224,0.10)',
    },
  },
  light: {
    air: 0xd9e9f7,
    wall: 0xc7dcef,
    wallFar: 0xf0d9c4,
    floor: 0xe6f0fa,
    desk: 0xdce9f4,
    deskTop: 0xeef6fc,
    metal: 0xc3d6e6,
    neon: 0x12a6b4,
    neonDim: 0x7fc4cc,
    glow: 0xf2913f,
    glowDeep: 0xd8611c,
    chair: 0xb9cbdb,
    screenGlow: 0x12a6b4,
    ambient: 1.1,
    fogNear: 24,
    fogFar: 92,
    scr: {
      bg: '#f2fbfe',
      panel: 'rgba(18,166,180,0.10)',
      edge: 'rgba(12,110,130,0.45)',
      ink: '#08303c',
      dim: '#5b8898',
      neon: '#0e8a99',
      warm: '#d8611c',
      grid: 'rgba(12,110,130,0.10)',
    },
  },
};

// =====================================================
// SERVICE CONTENT
// =====================================================

const SERVICES = [
  {
    id: '00',
    kicker: 'FINLABS // TECHNOLOGY CONSULTING',
    title: 'OUR CYBERNETIC SOLUTIONS',
    sub: 'Connect Your Future',
    desc:
      'End-to-end technology consulting for financial services. Seasoned experts, ' +
      'solutions tailored to your stack, transparent communication and measurable ' +
      'results — from first audit to production rollout.',
    stack: ['STRATEGY', 'ARCHITECTURE', 'SECURITY', 'CLOUD', 'DATA', 'DELIVERY'],
    rows: [
      ['ENGAGEMENT', 'Advisory · Build · Managed'],
      ['SECTORS', 'Wealth · AMC · Insurance · Banking'],
      ['DELIVERY', 'Agile pods · Fixed scope · T&M'],
    ],
    stats: [['6', 'PRACTICE AREAS'], ['10 YRS', 'IN MARKET'], ['24/7', 'MANAGED SUPPORT']],
    art: 'network',
  },
  {
    id: '01',
    kicker: 'SERVICE 01 // EXPERIENCE',
    title: 'UI / UX CONSULTING',
    sub: 'User-centered design and seamless experiences',
    desc:
      'User-centered design, intuitive interface development and seamless user ' +
      'experiences that drive engagement and satisfaction — grounded in research, ' +
      'shipped as a living design system.',
    stack: ['FIGMA', 'DESIGN SYSTEMS', 'REACT', 'TYPESCRIPT', 'WCAG 2.2', 'STORYBOOK'],
    rows: [
      ['RESEARCH', 'Interviews · Journey maps · Usability tests'],
      ['DESIGN', 'Wireframes · Prototypes · Tokens'],
      ['HANDOFF', 'Component library · A11y audit'],
    ],
    stats: [['WCAG 2.2', 'AA TARGET'], ['<2s', 'TIME TO INTERACTIVE'], ['1 KIT', 'DESIGN SYSTEM']],
    art: 'wireframe',
  },
  {
    id: '02',
    kicker: 'SERVICE 02 // ASSURANCE',
    title: 'APPLICATION & INFRA AUDITS',
    sub: 'Comprehensive analysis and evaluation',
    desc:
      'Thorough analysis and evaluation of software applications and infrastructure ' +
      'to identify vulnerabilities, optimize performance and enhance security — with ' +
      'a prioritised remediation plan you can actually execute.',
    stack: ['OWASP TOP 10', 'SAST / DAST', 'SONARQUBE', 'k6', 'APM', 'CIS BENCHMARKS'],
    rows: [
      ['CODE', 'Static analysis · Dependency CVEs'],
      ['RUNTIME', 'Load profiles · p95 latency · Bottlenecks'],
      ['OUTPUT', 'Severity-ranked findings · Fix roadmap'],
    ],
    stats: [['OWASP', 'TOP 10 COVERAGE'], ['p95', 'LATENCY BUDGETS'], ['CVSS', 'RANKED FINDINGS']],
    art: 'audit',
  },
  {
    id: '03',
    kicker: 'SERVICE 03 // DEFENCE',
    title: 'CYBERSECURITY',
    sub: 'Threat assessment and defense strategies',
    desc:
      'Comprehensive threat assessment, advanced defense strategies and proactive ' +
      'risk mitigation to safeguard your digital assets — built around zero-trust ' +
      'principles and continuous monitoring.',
    stack: ['ZERO TRUST', 'ISO 27001', 'SOC 2', 'SIEM / SOAR', 'IAM · MFA', 'PEN TESTING'],
    rows: [
      ['ASSESS', 'Threat modelling · Attack surface map'],
      ['DEFEND', 'Segmentation · Encryption at rest / in transit'],
      ['MONITOR', 'SIEM pipelines · Incident runbooks'],
    ],
    stats: [['ISO 27001', 'ALIGNED'], ['SOC 2', 'READINESS'], ['ZERO TRUST', 'BY DEFAULT']],
    art: 'shield',
  },
  {
    id: '04',
    kicker: 'SERVICE 04 // CLOUD',
    title: 'CLOUD ARCHITECTURE REVIEW',
    sub: 'Optimization and alignment with business objectives',
    desc:
      'Meticulous examination of cloud infrastructure to optimize efficiency, security ' +
      'and scalability — identifying optimization opportunities against industry best ' +
      'practices across every major provider.',
    stack: ['AWS', 'AZURE', 'GCP', 'KUBERNETES', 'TERRAFORM', 'FINOPS'],
    rows: [
      ['REVIEW', 'Well-Architected · Landing zones · IaC drift'],
      ['SCALE', 'Autoscaling · Multi-AZ · Disaster recovery'],
      ['COST', 'Right-sizing · Reserved capacity · Tag hygiene'],
    ],
    stats: [['AWS · AZURE · GCP', 'MULTI-CLOUD'], ['IaC', 'TERRAFORM'], ['FinOps', 'COST REVIEW']],
    art: 'cloud',
  },
  {
    id: '05',
    kicker: 'SERVICE 05 // TRANSFORMATION',
    title: 'DIGITAL TRANSFORMATION',
    sub: 'Tailored roadmaps leveraging emerging technologies',
    desc:
      'Crafted roadmaps that leverage cutting-edge technologies, data-driven insights ' +
      'and agile methodologies — with clear stages, an optimized technology stack and ' +
      'user-centric design throughout.',
    stack: ['MICROSERVICES', 'EVENT-DRIVEN', 'CI / CD', 'DATA LAKE', 'API-FIRST', 'MLOps'],
    rows: [
      ['ASSESS', 'Capability gaps · Legacy inventory'],
      ['DESIGN', 'Target architecture · Migration waves'],
      ['ADOPT', 'Enablement · Platform team · Metrics'],
    ],
    stats: [['4 STAGES', 'ASSESS TO SCALE'], ['CI/CD', 'AUTOMATED DELIVERY'], ['API-FIRST', 'ARCHITECTURE']],
    art: 'roadmap',
  },
];

// =====================================================
// RENDERER / SCENE / CAMERA
// =====================================================

const canvas = document.querySelector('#canvas');
// The page can mount at zero size (a hidden tab or pane). Falling back to
// a sane viewport keeps aspect out of NaN, which would otherwise poison
// every camera calculation downstream and never recover.
const vw0 = window.innerWidth || 1280;
const vh0 = window.innerHeight || 720;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(vw0, vh0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, vw0 / vh0, 0.1, 260);

// the screen is the subject: everything else is arranged around it
const SCREEN_W = 15.2;
const SCREEN_H = 8.6;
const SCREEN_Y = 4.2;
const SCREEN_Z = -9;
const SCREEN_FILL = 0.7; // fraction of the viewport the screen should span

const DESK_Y = -1.2;
const FLOOR_Y = -5.6;

scene.fog = new THREE.Fog(P.dark.air, P.dark.fogNear, P.dark.fogFar);

// materials that repaint with the theme
const themed = [];
function tm(mat, key) {
  themed.push({ mat, key });
  return mat;
}

// =====================================================
// LIGHTING
// =====================================================

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const tealLight = new THREE.PointLight(0x2ff0e0, 60, 40);
tealLight.position.set(-6, 3, 2);
scene.add(tealLight);

const warmLight = new THREE.PointLight(0xff6a1a, 90, 46);
warmLight.position.set(4, 7, SCREEN_Z - 3);
scene.add(warmLight);

const keyLight = new THREE.DirectionalLight(0xbfe9ff, 0.5);
keyLight.position.set(-4, 12, 10);
scene.add(keyLight);

// =====================================================
// CANVAS HELPERS
// =====================================================

function makeTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function rbox(w, h, d, radius = 0.1) {
  const r = Math.min(radius, Math.min(w, h, d) / 2 - 0.001);
  return new RoundedBoxGeometry(w, h, d, 3, r);
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  words.forEach((word) => {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lh;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line, x, yy);
  return yy + lh;
}

// =====================================================
// SCREEN ARTWORK
// =====================================================

const SW = 1520;
const SH = 860;

function drawDiagram(ctx, s, c, x, y, w, h) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = c.neon;
  ctx.fillStyle = c.neon;
  ctx.lineWidth = 2.5;

  const cx = w / 2;
  const cy = h / 2;

  if (s.art === 'network') {
    const R = Math.min(w, h) * 0.36;
    const nodes = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr2 = R * (0.5 + ((i * 37) % 10) / 20);
      nodes.push([cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2 * 0.92]);
    }
    ctx.globalAlpha = 0.35;
    nodes.forEach(([ax, ay], i) => {
      nodes.forEach(([bx, by], j) => {
        if (j <= i || (i + j) % 3) return;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      });
    });
    ctx.globalAlpha = 1;
    nodes.forEach(([ax, ay], i) => {
      ctx.fillStyle = i % 4 === 0 ? c.warm : c.neon;
      ctx.beginPath();
      ctx.arc(ax, ay, i % 4 === 0 ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = c.neon;
    ctx.globalAlpha = 0.5;
    [R * 1.15, R * 1.34].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  if (s.art === 'wireframe') {
    [0, 1, 2].forEach((k) => {
      const px = 18 + k * (w / 3.2);
      const py = 16 + k * 22;
      const pw = w / 3.4;
      const ph = h - 90 - k * 20;
      ctx.globalAlpha = 1 - k * 0.24;
      ctx.strokeRect(px, py, pw, ph);
      ctx.fillRect(px + 16, py + 22, pw - 60, 12);
      ctx.globalAlpha = (1 - k * 0.24) * 0.5;
      ctx.fillRect(px + 16, py + 48, pw * 0.55, 8);
      ctx.fillRect(px + 16, py + 66, pw * 0.4, 8);
      ctx.globalAlpha = (1 - k * 0.24) * 0.2;
      ctx.fillRect(px + 16, py + 92, pw - 32, ph - 130);
    });
    ctx.globalAlpha = 1;
  }

  if (s.art === 'audit') {
    const bars = [0.42, 0.68, 0.5, 0.86, 0.58, 0.74, 0.46, 0.62];
    const bw = (w - 40) / bars.length - 14;
    bars.forEach((v, i) => {
      const px = 20 + i * ((w - 40) / bars.length);
      ctx.globalAlpha = 0.16;
      ctx.fillRect(px, 20, bw, h - 80);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = v > 0.7 ? c.warm : c.neon;
      ctx.fillRect(px, 20 + (h - 80) * (1 - v), bw, (h - 80) * v);
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.neon;
    ctx.strokeStyle = c.warm;
    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.moveTo(14, 20 + (h - 80) * 0.28);
    ctx.lineTo(w - 14, 20 + (h - 80) * 0.28);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '600 17px "JetBrains Mono", monospace';
    ctx.fillStyle = c.warm;
    ctx.fillText('THRESHOLD', 16, 20 + (h - 80) * 0.28 - 10);
  }

  if (s.art === 'shield') {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.36);
    ctx.lineTo(cx + w * 0.17, cy - h * 0.22);
    ctx.lineTo(cx + w * 0.17, cy + h * 0.06);
    ctx.quadraticCurveTo(cx + w * 0.17, cy + h * 0.32, cx, cy + h * 0.42);
    ctx.quadraticCurveTo(cx - w * 0.17, cy + h * 0.32, cx - w * 0.17, cy + h * 0.06);
    ctx.lineTo(cx - w * 0.17, cy - h * 0.22);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.07, cy + h * 0.03);
    ctx.lineTo(cx - w * 0.02, cy + h * 0.14);
    ctx.lineTo(cx + w * 0.09, cy - h * 0.12);
    ctx.stroke();
    ctx.lineWidth = 2;
    [0.5, 0.66, 0.82].forEach((r, i) => {
      ctx.globalAlpha = 0.4 - i * 0.11;
      ctx.beginPath();
      ctx.ellipse(cx, cy + h * 0.03, w * r * 0.4, h * r * 0.52, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  if (s.art === 'cloud') {
    // three provider bays feeding one orchestration hub
    const names = ['AWS', 'AZURE', 'GCP'];
    const bw = w / 3.6;
    names.forEach((n, i) => {
      const px = 14 + i * (w / 3.15);
      ctx.globalAlpha = 0.14;
      rr(ctx, px, 12, bw, 76, 10);
      ctx.fill();
      ctx.globalAlpha = 1;
      rr(ctx, px, 12, bw, 76, 10);
      ctx.stroke();
      ctx.font = '700 30px "JetBrains Mono", monospace';
      ctx.fillStyle = c.neon;
      ctx.textAlign = 'center';
      ctx.fillText(n, px + bw / 2, 60);
      ctx.textAlign = 'left';
      // feed line down to the hub
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(px + bw / 2, 92);
      ctx.lineTo(px + bw / 2, 128);
      ctx.lineTo(cx, 150);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    ctx.globalAlpha = 0.16;
    rr(ctx, cx - w * 0.22, 154, w * 0.44, 62, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
    rr(ctx, cx - w * 0.22, 154, w * 0.44, 62, 10);
    ctx.stroke();
    ctx.font = '700 24px "JetBrains Mono", monospace';
    ctx.fillStyle = c.warm;
    ctx.textAlign = 'center';
    ctx.fillText('KUBERNETES · TERRAFORM', cx, 193);
    ctx.textAlign = 'left';
  }

  if (s.art === 'roadmap') {
    const stops = ['ASSESS', 'DESIGN', 'ADOPT', 'SCALE'];
    const y0 = h - 44;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(16, y0);
    ctx.lineTo(w - 16, y0);
    ctx.stroke();
    ctx.globalAlpha = 1;
    stops.forEach((st, i) => {
      const px = 46 + i * ((w - 92) / (stops.length - 1));
      const py = y0 - 34 - i * 34;
      ctx.fillStyle = i === stops.length - 1 ? c.warm : c.neon;
      ctx.beginPath();
      ctx.arc(px, y0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c.neon;
      ctx.beginPath();
      ctx.moveTo(px, y0 - 9);
      ctx.lineTo(px, py + 14);
      ctx.stroke();
      ctx.globalAlpha = 0.16;
      rr(ctx, px - 62, py - 22, 124, 38, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
      rr(ctx, px - 62, py - 22, 124, 38, 8);
      ctx.stroke();
      ctx.font = '700 18px "JetBrains Mono", monospace';
      ctx.fillStyle = c.ink;
      ctx.textAlign = 'center';
      ctx.fillText(st, px, py + 3);
      ctx.textAlign = 'left';
    });
  }

  ctx.restore();
}

function screenTexture(s, mode) {
  const c = P[mode].scr;
  return makeTexture(SW, SH, (ctx, w, h) => {
    // ground
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);

    // faint grid
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 38) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 38) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.textBaseline = 'middle';

    // ---- window chrome ----
    ctx.fillStyle = c.panel;
    ctx.fillRect(0, 0, w, 58);
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 58);
    ctx.lineTo(w, 58);
    ctx.stroke();
    [0, 1, 2].forEach((i) => {
      ctx.fillStyle = i === 0 ? c.warm : c.neon;
      ctx.beginPath();
      ctx.arc(34 + i * 26, 29, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = c.dim;
    ctx.font = '600 19px "JetBrains Mono", monospace';
    ctx.fillText(s.kicker, 122, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = c.neon;
    ctx.fillText('● ONLINE', w - 34, 30);
    ctx.textAlign = 'left';

    // ---- headline ----
    const M = 56;
    let y = 116;
    ctx.fillStyle = c.ink;
    ctx.font = '800 62px "Outfit", sans-serif';
    ctx.fillText(s.title, M, y);

    y += 52;
    ctx.fillStyle = c.neon;
    ctx.font = '600 27px "Outfit", sans-serif';
    ctx.fillText(s.sub, M, y);

    // accent rule
    y += 34;
    const g = ctx.createLinearGradient(M, 0, M + 320, 0);
    g.addColorStop(0, c.neon);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(M, y, 320, 4);

    // ---- left column: description + rows ----
    const colW = w * 0.46;
    y += 42;
    ctx.fillStyle = c.dim;
    ctx.font = '400 23px Inter, sans-serif';
    y = wrap(ctx, s.desc, M, y, colW, 34);

    y += 18;
    s.rows.forEach(([k, v]) => {
      ctx.fillStyle = c.panel;
      rr(ctx, M, y - 20, colW, 44, 8);
      ctx.fill();
      ctx.fillStyle = c.neon;
      ctx.font = '700 15px "JetBrains Mono", monospace';
      ctx.fillText(k, M + 16, y + 2);
      ctx.fillStyle = c.ink;
      ctx.font = '400 17px Inter, sans-serif';
      ctx.fillText(v, M + 150, y + 2);
      y += 54;
    });

    // ---- right column: diagram ----
    const dx = M + colW + 46;
    const dw = w - dx - M;
    const dy = 176;
    const dh = 384;
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 2;
    rr(ctx, dx, dy, dw, dh, 12);
    ctx.stroke();
    drawDiagram(ctx, s, c, dx, dy, dw, dh);

    // ---- tech stack chips ----
    let cxp = dx;
    let cyp = dy + dh + 44;
    ctx.font = '700 16px "JetBrains Mono", monospace';
    s.stack.forEach((chip) => {
      const tw = ctx.measureText(chip).width + 30;
      if (cxp + tw > w - M) {
        cxp = dx;
        cyp += 44;
      }
      ctx.fillStyle = c.panel;
      rr(ctx, cxp, cyp - 17, tw, 34, 17);
      ctx.fill();
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 1.5;
      rr(ctx, cxp, cyp - 17, tw, 34, 17);
      ctx.stroke();
      ctx.fillStyle = c.neon;
      ctx.fillText(chip, cxp + 15, cyp + 1);
      cxp += tw + 12;
    });

    // ---- stats strip ----
    if (s.stats) {
      const sy = h - 168;
      const sw = (colW - 24) / 3;
      s.stats.forEach(([big, small], i) => {
        const sx = M + i * (sw + 12);
        ctx.fillStyle = c.panel;
        rr(ctx, sx, sy, sw, 78, 10);
        ctx.fill();
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = 1.5;
        rr(ctx, sx, sy, sw, 78, 10);
        ctx.stroke();
        ctx.fillStyle = c.neon;
        ctx.font = '700 22px "Outfit", sans-serif';
        ctx.fillText(big, sx + 14, sy + 28);
        ctx.fillStyle = c.dim;
        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.fillText(small, sx + 14, sy + 55);
      });
    }

    // ---- footer ----
    ctx.fillStyle = c.panel;
    ctx.fillRect(0, h - 62, w, 62);
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h - 62);
    ctx.lineTo(w, h - 62);
    ctx.stroke();

    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillStyle = c.dim;
    ctx.fillText('SCROLL MOUSE FOR OTHER SERVICES', M, h - 31);

    // index dots
    const total = SERVICES.length;
    const idx = SERVICES.indexOf(s);
    for (let i = 0; i < total; i++) {
      const px = w - M - (total - 1 - i) * 26;
      ctx.fillStyle = i === idx ? c.neon : c.edge;
      ctx.beginPath();
      ctx.arc(px, h - 31, i === idx ? 7 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = c.neon;
    ctx.font = '700 18px "JetBrains Mono", monospace';
    ctx.fillText(`${s.id} / 0${total - 1}`, w - M - total * 26 - 24, h - 31);
    ctx.textAlign = 'left';

    // scanlines
    ctx.fillStyle = mode === 'dark' ? 'rgba(0,12,18,0.20)' : 'rgba(30,90,110,0.07)';
    for (let yy = 0; yy < h; yy += 4) ctx.fillRect(0, yy, w, 2);
  });
}

// two screen layers so one can crossfade into the next
const screenGeo = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H);
const screenA = new THREE.Mesh(
  screenGeo,
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 })
);
const screenB = new THREE.Mesh(
  screenGeo,
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
);
screenA.position.set(0, SCREEN_Y, SCREEN_Z + 0.16);
screenB.position.set(0, SCREEN_Y, SCREEN_Z + 0.17);
scene.add(screenA, screenB);

let screenTextures = [];
function buildScreens(mode) {
  screenTextures.forEach((t) => t.dispose());
  screenTextures = SERVICES.map((s) => screenTexture(s, mode));
  screenA.material.map = screenTextures[0];
  screenB.material.map = screenTextures[0];
  screenA.material.needsUpdate = true;
  screenB.material.needsUpdate = true;
}

// =====================================================
// ROOM
// =====================================================

const room = new THREE.Group();
scene.add(room);

const floorMat = tm(new THREE.MeshLambertMaterial({ color: P.dark.floor }), 'floor');
const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, FLOOR_Y, SCREEN_Z + 18);
room.add(floor);

const wallMat = tm(new THREE.MeshLambertMaterial({ color: P.dark.wall }), 'wall');
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(52, 30), wallMat);
backWall.position.set(0, 6, SCREEN_Z - 2.6);
room.add(backWall);

[-1, 1].forEach((side) => {
  const w = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), wallMat);
  w.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  w.position.set(side * 20, 6, SCREEN_Z + 16);
  room.add(w);
});

const ceil = new THREE.Mesh(new THREE.PlaneGeometry(52, 46), wallMat);
ceil.rotation.x = Math.PI / 2;
ceil.position.set(0, 15, SCREEN_Z + 14);
room.add(ceil);

// warm wash on the wall behind the monitor — the orange bloom
const washTex = makeTexture(512, 512, (ctx, w, h) => {
  const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
  grad.addColorStop(0, 'rgba(255,150,60,0.95)');
  grad.addColorStop(0.45, 'rgba(255,105,26,0.45)');
  grad.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
});
const washMat = new THREE.MeshBasicMaterial({
  map: washTex,
  transparent: true,
  opacity: 0.75,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const wash = new THREE.Mesh(new THREE.PlaneGeometry(38, 26), washMat);
wash.position.set(0, 6.4, SCREEN_Z - 2.4);
room.add(wash);

// neon frame around the monitor
const neonMat = tm(new THREE.MeshBasicMaterial({ color: P.dark.neon }), 'neon');
function neonBar(w, h, x, y, z) {
  const bar = new THREE.Mesh(rbox(w, h, 0.22, 0.1), neonMat);
  bar.position.set(x, y, z);
  room.add(bar);
  return bar;
}
const FW = SCREEN_W + 1.5;
const FH = SCREEN_H + 1.3;
neonBar(FW, 0.16, 0, SCREEN_Y + FH / 2, SCREEN_Z + 0.2);
neonBar(FW, 0.16, 0, SCREEN_Y - FH / 2, SCREEN_Z + 0.2);
neonBar(0.16, FH, -FW / 2, SCREEN_Y, SCREEN_Z + 0.2);
neonBar(0.16, FH, FW / 2, SCREEN_Y, SCREEN_Z + 0.2);

// monitor bezel behind the screen
const bezelMat = tm(new THREE.MeshLambertMaterial({ color: P.dark.metal }), 'metal');
const bezel = new THREE.Mesh(rbox(SCREEN_W + 2.2, SCREEN_H + 2.0, 0.7, 0.34), bezelMat);
bezel.position.set(0, SCREEN_Y, SCREEN_Z - 0.25);
room.add(bezel);

// =====================================================
// DESK + PERIPHERALS
// =====================================================

const deskMat = tm(new THREE.MeshLambertMaterial({ color: P.dark.desk }), 'desk');
const deskTopMat = tm(new THREE.MeshLambertMaterial({ color: P.dark.deskTop }), 'deskTop');

const deskTop = new THREE.Mesh(rbox(26, 0.5, 5.6, 0.2), deskTopMat);
deskTop.position.set(0, DESK_Y, SCREEN_Z + 5.4);
room.add(deskTop);

// drawer pedestals with neon slots
[-7.4, 7.4].forEach((x) => {
  const ped = new THREE.Mesh(rbox(5.4, 4, 4.6, 0.24), deskMat);
  ped.position.set(x, DESK_Y - 2.3, SCREEN_Z + 5.4);
  room.add(ped);
  [0.9, -0.2, -1.3].forEach((dy) => {
    const slot = new THREE.Mesh(rbox(3.4, 0.09, 0.09, 0.04), neonMat);
    slot.position.set(x, DESK_Y - 2.3 + dy, SCREEN_Z + 7.75);
    room.add(slot);
  });
});

// neon lip along the desk edge
const lip = new THREE.Mesh(rbox(26, 0.1, 0.1, 0.05), neonMat);
lip.position.set(0, DESK_Y - 0.3, SCREEN_Z + 8.2);
room.add(lip);

// keyboard
const kbTex = makeTexture(512, 180, (ctx, w, h) => {
  ctx.fillStyle = '#0f151c';
  ctx.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) {
    for (let cc = 0; cc < 15; cc++) {
      ctx.fillStyle = 'rgba(47,240,224,0.45)';
      ctx.fillRect(14 + cc * 32, 16 + r * 38, 24, 26);
    }
  }
});
const keyboard = new THREE.Mesh(
  rbox(5.6, 0.2, 1.9, 0.08),
  new THREE.MeshBasicMaterial({ map: kbTex })
);
keyboard.position.set(-0.6, DESK_Y + 0.34, SCREEN_Z + 6.6);
room.add(keyboard);

const mouse = new THREE.Mesh(rbox(0.7, 0.24, 1.1, 0.11), bezelMat);
mouse.position.set(3.6, DESK_Y + 0.36, SCREEN_Z + 6.6);
room.add(mouse);

// speakers either side of the monitor
[-9.2, 9.2].forEach((x) => {
  const sp = new THREE.Mesh(rbox(1.5, 2.6, 1.4, 0.16), bezelMat);
  sp.position.set(x, DESK_Y + 1.55, SCREEN_Z + 4.4);
  room.add(sp);
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20),
    neonMat
  );
  cone.rotation.x = Math.PI / 2;
  cone.position.set(x, DESK_Y + 2.0, SCREEN_Z + 5.15);
  room.add(cone);
});

// a couple of small desk devices
[-5.2, 5.8].forEach((x, i) => {
  const dev = new THREE.Mesh(rbox(1.5, 0.7 + i * 0.3, 1.2, 0.14), bezelMat);
  dev.position.set(x, DESK_Y + 0.6 + i * 0.15, SCREEN_Z + 4.6);
  room.add(dev);
  const led = new THREE.Mesh(rbox(0.9, 0.07, 0.07, 0.03), neonMat);
  led.position.set(x, DESK_Y + 0.85 + i * 0.15, SCREEN_Z + 5.22);
  room.add(led);
});

// chair, seen from behind
const chairMat = tm(new THREE.MeshLambertMaterial({ color: P.dark.chair }), 'chair');
const chairBack = new THREE.Mesh(rbox(4.4, 4.6, 0.8, 0.9), chairMat);
chairBack.position.set(-0.4, DESK_Y - 0.6, SCREEN_Z + 11.4);
chairBack.rotation.x = -0.07;
room.add(chairBack);
const chairSeat = new THREE.Mesh(rbox(4.2, 0.7, 3.2, 0.3), chairMat);
chairSeat.position.set(-0.4, DESK_Y - 2.8, SCREEN_Z + 12.6);
room.add(chairSeat);

// =====================================================
// SIDE WALL MAP PANELS
// =====================================================

const mapTex = makeTexture(600, 340, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(47,240,224,0.55)';
  // a loose dot-matrix landmass silhouette
  for (let x = 0; x < w; x += 9) {
    for (let y = 0; y < h; y += 9) {
      const nx = x / w;
      const ny = y / h;
      const land =
        Math.sin(nx * 9 + ny * 3) * Math.cos(ny * 7 - nx * 2) +
        Math.sin(nx * 17 + 1.4) * 0.4;
      if (land > 0.32) {
        ctx.globalAlpha = 0.3 + (land - 0.32) * 0.9;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(47,240,224,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, w - 4, h - 4);
});

// angled panels flanking the monitor, so they read at the frame edges
const mapGeo = new THREE.PlaneGeometry(7.4, 4.4);
[-1, 1].forEach((side) => {
  const m = new THREE.Mesh(
    mapGeo,
    new THREE.MeshBasicMaterial({ map: mapTex, transparent: true, opacity: 0.75 })
  );
  m.position.set(side * 12.4, 6.6, SCREEN_Z + 0.6);
  m.rotation.y = side < 0 ? 0.42 : -0.42;
  room.add(m);

  const m2 = new THREE.Mesh(
    mapGeo,
    new THREE.MeshBasicMaterial({ map: mapTex, transparent: true, opacity: 0.45 })
  );
  m2.position.set(side * 13.2, 1.4, SCREEN_Z + 1.4);
  m2.rotation.y = side < 0 ? 0.55 : -0.55;
  room.add(m2);
});

// =====================================================
// SERVER RACKS — only two, kept to the right
// =====================================================

const rackFaceTex = makeTexture(256, 512, (ctx, w, h) => {
  ctx.fillStyle = '#0b1016';
  ctx.fillRect(0, 0, w, h);
  for (let r = 0; r < 13; r++) {
    const y = 20 + r * 37;
    ctx.fillStyle = 'rgba(47,240,224,0.75)';
    ctx.fillRect(22, y, 36, 7);
    ctx.fillStyle = 'rgba(47,240,224,0.3)';
    ctx.fillRect(68, y, 24, 7);
    ctx.fillStyle = r % 4 === 0 ? '#ff8a3c' : 'rgba(47,240,224,0.5)';
    ctx.fillRect(122, y, 84, 7);
  }
  ctx.fillStyle = 'rgba(47,240,224,0.16)';
  ctx.fillRect(20, 0, 190, 2);
});

const rackLabelTex = (label) =>
  makeTexture(360, 90, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#2ff0e0';
    ctx.font = '700 42px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 8, h / 2);
  });

[['DATA CORE', 0], ['NETWORK HUB', 1]].forEach(([label, k]) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(rbox(4.4, 5.4, 3.4, 0.3), bezelMat);
  body.position.y = 2.7;
  g.add(body);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 3.6),
    new THREE.MeshBasicMaterial({ map: rackFaceTex })
  );
  face.position.set(0, 2.5, 1.72);
  g.add(face);

  const lab = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.8),
    new THREE.MeshBasicMaterial({ map: rackLabelTex(label), transparent: true })
  );
  lab.position.set(0, 4.9, 1.72);
  g.add(lab);

  g.position.set(11.9 + k * 1.6, FLOOR_Y, SCREEN_Z + 2.4 + k * 5.2);
  g.rotation.y = -0.5;
  room.add(g);
});

// =====================================================
// CABLES + FLOOR NEON
// =====================================================

function cable(a, b, sag, color) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= sag;
  const curve = new THREE.CatmullRomCurve3([a, mid, b]);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 24, 0.055, 7, false),
    new THREE.MeshLambertMaterial({ color })
  );
  room.add(mesh);
}
cable(
  new THREE.Vector3(9.6, DESK_Y - 0.4, SCREEN_Z + 4),
  new THREE.Vector3(14, FLOOR_Y + 0.4, SCREEN_Z + 3),
  1.4,
  0x11161d
);
cable(
  new THREE.Vector3(-9.6, DESK_Y - 0.4, SCREEN_Z + 4),
  new THREE.Vector3(-15, FLOOR_Y + 0.5, SCREEN_Z + 2),
  1.6,
  0x11161d
);
cable(
  new THREE.Vector3(11.2, 9.4, SCREEN_Z - 1.6),
  new THREE.Vector3(15.6, 4.4, SCREEN_Z + 1),
  1.1,
  0x11161d
);

// floor neon runners
[-1, 1].forEach((side) => {
  const strip = new THREE.Mesh(rbox(0.16, 0.1, 34, 0.05), neonMat);
  strip.position.set(side * 19.4, FLOOR_Y + 0.1, SCREEN_Z + 12);
  room.add(strip);
});
// wall neon rails
[-1, 1].forEach((side) => {
  const rail = new THREE.Mesh(rbox(0.14, 0.14, 30, 0.05), neonMat);
  rail.position.set(side * 19.6, 10.6, SCREEN_Z + 12);
  room.add(rail);
});

// drifting motes
const motes = [];
{
  const geo = new THREE.SphereGeometry(0.055, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0x8ff6ee });
  for (let i = 0; i < 44; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(
      (Math.random() - 0.5) * 34,
      FLOOR_Y + Math.random() * 15,
      SCREEN_Z + Math.random() * 26
    );
    room.add(m);
    motes.push({ mesh: m, speed: 0.2 + Math.random() * 0.5, phase: Math.random() * 6.28 });
  }
}

// =====================================================
// THEME
// =====================================================

onTheme((mode) => {
  const t = P[mode];
  scene.background = new THREE.Color(t.air);
  scene.fog.color.setHex(t.air);
  scene.fog.near = t.fogNear;
  scene.fog.far = t.fogFar;
  ambient.intensity = t.ambient;

  themed.forEach(({ mat, key }) => {
    if (t[key] !== undefined) mat.color.setHex(t[key]);
  });

  washMat.opacity = mode === 'dark' ? 0.75 : 0.34;
  tealLight.intensity = mode === 'dark' ? 60 : 18;
  warmLight.intensity = mode === 'dark' ? 90 : 26;
  keyLight.intensity = mode === 'dark' ? 0.5 : 1.1;

  buildScreens(mode);
  document.body.classList.toggle('is-dark', mode === 'dark');
});

// =====================================================
// SCROLL
// =====================================================

let scrollProgress = 0;
let focus = 0;
let focusEased = 0;
let outro = 0;

const progressBar = document.querySelector('#progress span');
const scrollCue = document.querySelector('#scrollcue');
const deck = document.querySelector('.deck');
const slides = [...document.querySelectorAll('.slide')];

function updateScroll() {
  const vh = window.innerHeight;
  if (vh === 0) return;

  const doc = document.documentElement.scrollHeight - vh;
  scrollProgress = doc > 0 ? window.scrollY / doc : 0;

  const slideH = slides[0].offsetHeight || vh;
  focus = THREE.MathUtils.clamp(
    (window.scrollY - deck.offsetTop) / slideH,
    0,
    SERVICES.length - 1
  );

  const last = slides[slides.length - 1];
  outro = THREE.MathUtils.clamp(
    (window.scrollY - (last.offsetTop + slideH - vh * 0.4)) / (vh * 0.9),
    0,
    1
  );

  progressBar.style.width = scrollProgress * 100 + '%';
  scrollCue.style.opacity = scrollProgress > 0.02 ? 0 : 0.95;
  document.body.style.setProperty('--outro', String(outro));
}
window.addEventListener('scroll', updateScroll, { passive: true });

// =====================================================
// 3D ON / OFF
// =====================================================

let enabled = true;
let running = false;
const toggle = document.querySelector('#toggle3d');
toggle.addEventListener('click', () => {
  enabled = !enabled;
  toggle.setAttribute('aria-pressed', String(enabled));
  toggle.querySelector('[data-state]').textContent = enabled ? 'ON' : 'OFF';
  document.body.classList.toggle('no3d', !enabled);
  if (enabled && !running) loop();
});

// =====================================================
// CAMERA FRAMING
// =====================================================

// distance at which the screen spans SCREEN_FILL of the viewport
function screenDistance() {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const byHeight = SCREEN_H / 2 / Math.tan(vFov / 2) / SCREEN_FILL;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const byWidth = SCREEN_W / 2 / Math.tan(hFov / 2) / SCREEN_FILL;
  return Math.max(byHeight, byWidth);
}

// =====================================================
// ANIMATION
// =====================================================

const timer = new Timer();
const lookTarget = new THREE.Vector3(0, SCREEN_Y - 0.9, SCREEN_Z);
let shownIndex = 0;

camera.position.set(0, SCREEN_Y, SCREEN_Z + 18);

function loop() {
  if (!enabled) {
    running = false;
    return;
  }
  running = true;
  requestAnimationFrame(loop);

  // NaN-safe: if the page mounted at zero size, camera.aspect is NaN and
  // every comparison against it is false, so check the buffer explicitly
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (
    vw > 0 &&
    vh > 0 &&
    (!Number.isFinite(camera.aspect) ||
      canvas.width === 0 ||
      Math.abs(camera.aspect - vw / vh) > 0.001)
  ) {
    handleResize();
  }

  timer.update();
  const t = timer.getElapsed();

  focusEased += (focus - focusEased) * 0.12;

  // swap the screen art when the nearest slide changes, crossfading
  const nearest = Math.round(focusEased);
  if (nearest !== shownIndex && screenTextures[nearest]) {
    screenB.material.map = screenA.material.map;
    screenB.material.opacity = 1;
    screenA.material.map = screenTextures[nearest];
    screenA.material.opacity = 0;
    screenA.material.needsUpdate = true;
    screenB.material.needsUpdate = true;
    shownIndex = nearest;
  }
  screenA.material.opacity += (1 - screenA.material.opacity) * 0.14;
  screenB.material.opacity += (0 - screenB.material.opacity) * 0.14;

  // a faint CRT breathe
  const breathe = 0.97 + Math.sin(t * 5.5) * 0.012 + Math.sin(t * 19) * 0.006;
  screenA.material.opacity *= breathe;

  // camera: locked on the screen, drifting, pulling back at the end
  const dist = screenDistance();
  const zTarget = SCREEN_Z + dist + outro * 9;
  camera.position.z += (zTarget - camera.position.z) * 0.07;
  camera.position.x += (Math.sin(t * 0.22) * 0.5 - camera.position.x) * 0.05;
  camera.position.y +=
    (SCREEN_Y + Math.sin(t * 0.31) * 0.22 + outro * 1.6 - camera.position.y) * 0.06;
  lookTarget.y += (SCREEN_Y - 0.9 + outro * 1.6 - lookTarget.y) * 0.06;
  camera.lookAt(lookTarget);

  // motes drift toward the wall
  motes.forEach((m) => {
    m.mesh.position.z -= m.speed * 0.02;
    m.mesh.position.y += Math.sin(t * 0.8 + m.phase) * 0.0018;
    if (m.mesh.position.z < SCREEN_Z - 1) m.mesh.position.z = SCREEN_Z + 26;
  });

  renderer.render(scene, camera);

  if (import.meta.env.DEV) {
    window.__S = { scene, camera, screenA, screenB, room, renderer, focusEased, outro };
  }
}

// =====================================================
// RESIZE
// =====================================================

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // repair a position that already went non-finite
  if (!Number.isFinite(camera.position.z)) {
    camera.position.set(0, SCREEN_Y, SCREEN_Z + screenDistance());
  }
  updateScroll();
}
window.addEventListener('resize', handleResize);

buildScreens(currentTheme());
updateScroll();
loop();
