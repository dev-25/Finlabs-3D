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
    tab: 'Overview',
    url: 'https://finlabsindia.org/technology-consulting',
    kicker: 'FINLABS // TECHNOLOGY CONSULTING',
    title: 'Our Cybernetic Solutions',
    sub: 'Seasoned experts, tailored solutions, transparent communication and measurable results.',
    page: 'overview',
  },
  {
    tab: 'UI / UX',
    url: 'https://finlabsindia.org/services/ui-ux-consulting',
    kicker: 'SERVICE 01 // EXPERIENCE',
    title: 'UI / UX Consulting',
    sub: 'User-centered design, intuitive interfaces and seamless experiences that drive engagement.',
    page: 'uiux',
  },
  {
    tab: 'Audits',
    url: 'https://finlabsindia.org/services/application-infra-audits',
    kicker: 'SERVICE 02 // ASSURANCE',
    title: 'Application & Infra Audits',
    sub: 'Identify vulnerabilities, optimize performance and enhance security across code and infrastructure.',
    page: 'audit',
  },
  {
    tab: 'Security',
    url: 'https://finlabsindia.org/services/cybersecurity',
    kicker: 'SERVICE 03 // DEFENCE',
    title: 'Cybersecurity',
    sub: 'Threat assessment, advanced defense strategies and proactive risk mitigation.',
    page: 'security',
  },
  {
    tab: 'Cloud',
    url: 'https://finlabsindia.org/services/cloud-architecture-review',
    kicker: 'SERVICE 04 // CLOUD',
    title: 'Cloud Architecture Review',
    sub: 'Optimize efficiency, security and scalability across AWS, Azure and Google Cloud.',
    page: 'cloud',
  },
  {
    tab: 'Transform',
    url: 'https://finlabsindia.org/services/digital-transformation',
    kicker: 'SERVICE 05 // TRANSFORMATION',
    title: 'Digital Transformation Strategy',
    sub: 'Roadmaps leveraging emerging technologies, data-driven insights and agile delivery.',
    page: 'transform',
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
const SCREEN_W = 16.2;
const SCREEN_H = 9.2;
const SCREEN_Y = 4.2;
const SCREEN_Z = -9;
const SCREEN_FILL = 0.8; // fraction of the viewport the screen should span

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
const SW = 1760;
const SH = 1000;

// browser chrome metrics
const BAR = 46;    // title bar
const TABH = 52;   // tab strip
const ADDR = 46;   // address bar
const TOP = BAR + TABH + ADDR;

function chip(ctx, c, x, y, label, font = '700 15px "JetBrains Mono", monospace') {
  ctx.font = font;
  const w = ctx.measureText(label).width + 26;
  ctx.fillStyle = c.panel;
  rr(ctx, x, y - 15, w, 30, 15);
  ctx.fill();
  ctx.strokeStyle = c.edge;
  ctx.lineWidth = 1.4;
  rr(ctx, x, y - 15, w, 30, 15);
  ctx.stroke();
  ctx.fillStyle = c.neon;
  ctx.fillText(label, x + 13, y + 1);
  return w + 10;
}

function panel(ctx, c, x, y, w, h, title) {
  ctx.fillStyle = c.panel;
  rr(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = c.edge;
  ctx.lineWidth = 1.6;
  rr(ctx, x, y, w, h, 12);
  ctx.stroke();
  if (title) {
    ctx.fillStyle = c.dim;
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText(title, x + 16, y + 20);
  }
}

// -----------------------------------------------------
// PER-DOMAIN PAGE MOCKS
// -----------------------------------------------------

const PAGES = {
  // Overview — a services index
  overview(ctx, c, x, y, w, h) {
    ctx.fillStyle = c.ink;
    ctx.font = '800 58px "Outfit", sans-serif';
    ctx.fillText('Technology Consulting', x, y + 46);
    ctx.fillStyle = c.neon;
    ctx.font = '600 24px "Outfit", sans-serif';
    ctx.fillText('Advisory · Build · Managed services for financial institutions', x, y + 92);

    const cards = [
      ['UI / UX', 'Research → design system'],
      ['AUDITS', 'Code, infra, performance'],
      ['SECURITY', 'Zero-trust, SOC 2, ISO'],
      ['CLOUD', 'AWS · Azure · GCP'],
      ['TRANSFORM', 'Roadmap → platform'],
      ['DATA', 'Lakehouse, MLOps'],
    ];
    const cw = (w - 40) / 3;
    const ch = 108;
    cards.forEach(([t, d], i) => {
      const px = x + (i % 3) * (cw + 20);
      const py = y + 132 + Math.floor(i / 3) * (ch + 18);
      panel(ctx, c, px, py, cw, ch);
      ctx.fillStyle = c.neon;
      ctx.font = '700 24px "Outfit", sans-serif';
      ctx.fillText(t, px + 18, py + 42);
      ctx.fillStyle = c.dim;
      ctx.font = '400 17px Inter, sans-serif';
      ctx.fillText(d, px + 18, py + 74);
    });

    // engagement bar
    const by = y + 132 + 2 * (ch + 18) + 12;
    panel(ctx, c, x, by, w, 92, 'ENGAGEMENT MODEL');
    ['DISCOVERY', 'ARCHITECTURE', 'BUILD', 'HARDENING', 'RUN'].forEach((st, i) => {
      const px = x + 24 + i * ((w - 60) / 5);
      ctx.fillStyle = i < 3 ? c.neon : c.edge;
      ctx.beginPath();
      ctx.arc(px + 8, by + 60, 9, 0, Math.PI * 2);
      ctx.fill();
      if (i < 4) {
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 20, by + 60);
        ctx.lineTo(px + (w - 60) / 5 - 4, by + 60);
        ctx.stroke();
      }
      ctx.fillStyle = c.dim;
      ctx.font = '600 13px "JetBrains Mono", monospace';
      ctx.fillText(st, px, by + 88);
    });
  },

  // UI/UX — a design tool workspace
  uiux(ctx, c, x, y, w, h) {
    const railW = 200;
    // layers rail
    panel(ctx, c, x, y, railW, h - 120, 'LAYERS');
    ['Frame / Dashboard', 'Nav / Sidebar', 'Card / Portfolio', 'Chart / AUM', 'Table / Holdings', 'Modal / KYC', 'Token / Colour', 'Token / Type']
      .forEach((l, i) => {
        ctx.fillStyle = i === 2 ? c.neon : c.dim;
        ctx.font = '400 14px Inter, sans-serif';
        ctx.fillText(l, x + 16, y + 52 + i * 30);
      });

    // artboards
    const ax = x + railW + 22;
    const aw = w - railW - 260;
    panel(ctx, c, ax, y, aw, h - 120, 'ARTBOARDS — 1440 / 768 / 375');
    [0, 1, 2].forEach((k) => {
      const bw = (aw - 80) / 3;
      const bx = ax + 20 + k * (bw + 20);
      const by = y + 46;
      const bh = h - 200;
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = c.neon;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(bx, by, bw, 24);
      ctx.globalAlpha = 0.32;
      ctx.fillRect(bx + 14, by + 44, bw - 28, 46);
      ctx.globalAlpha = 0.18;
      ctx.fillRect(bx + 14, by + 104, bw * 0.52, 14);
      ctx.fillRect(bx + 14, by + 126, bw * 0.4, 14);
      ctx.fillRect(bx + 14, by + 160, bw - 28, bh - 200);
      ctx.globalAlpha = 1;
      // selection handles on the middle artboard
      if (k === 1) {
        ctx.strokeStyle = c.warm;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bx + 10, by + 40, bw - 20, 54);
        [[bx + 10, by + 40], [bx + bw - 10, by + 40], [bx + 10, by + 94], [bx + bw - 10, by + 94]]
          .forEach(([hx, hy]) => {
            ctx.fillStyle = c.warm;
            ctx.fillRect(hx - 4, hy - 4, 8, 8);
          });
      }
    });

    // tokens rail
    const tx = ax + aw + 22;
    panel(ctx, c, tx, y, w - (tx - x), h - 120, 'DESIGN TOKENS');
    ['#0E7C8B', '#35D6FF', '#0B2430', '#F2913F', '#E8F6FA'].forEach((hex, i) => {
      ctx.fillStyle = hex;
      rr(ctx, tx + 16, y + 44 + i * 40, 30, 30, 7);
      ctx.fill();
      ctx.fillStyle = c.dim;
      ctx.font = '500 13px "JetBrains Mono", monospace';
      ctx.fillText(hex, tx + 56, y + 62 + i * 40);
    });
    ctx.fillStyle = c.dim;
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText('TYPE SCALE', tx + 16, y + 262);
    ['48 / 32 / 24', '18 / 16 / 14'].forEach((t, i) => {
      ctx.fillStyle = c.neon;
      ctx.font = '400 16px Inter, sans-serif';
      ctx.fillText(t, tx + 16, y + 292 + i * 26);
    });

    let cx2 = x;
    ['FIGMA', 'REACT', 'TYPESCRIPT', 'STORYBOOK', 'WCAG 2.2', 'TOKENS STUDIO'].forEach((t) => {
      cx2 += chip(ctx, c, cx2, h - 66, t);
    });
  },

  // Audits — a scan report
  audit(ctx, c, x, y, w, h) {
    const colW = w * 0.56;
    panel(ctx, c, x, y, colW, h - 120, 'FINDINGS — SEVERITY RANKED');
    const rows = [
      ['CRITICAL', 'CVE-2025-4188 · transitive dep', 9.8],
      ['HIGH', 'Missing rate limit on /auth', 8.1],
      ['HIGH', 'Secrets in CI environment', 7.9],
      ['MEDIUM', 'N+1 query on holdings view', 6.2],
      ['MEDIUM', 'TLS 1.1 still negotiated', 5.4],
      ['LOW', 'Verbose error responses', 3.1],
    ];
    rows.forEach(([sev, txt, score], i) => {
      const ry = y + 52 + i * 46;
      const col = sev === 'CRITICAL' ? '#ff5a5a' : sev === 'HIGH' ? c.warm : c.neon;
      ctx.fillStyle = col;
      rr(ctx, x + 16, ry, 6, 30, 3);
      ctx.fill();
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillText(sev, x + 34, ry + 18);
      ctx.fillStyle = c.ink;
      ctx.font = '400 16px Inter, sans-serif';
      ctx.fillText(txt, x + 132, ry + 18);
      ctx.fillStyle = c.dim;
      ctx.font = '600 15px "JetBrains Mono", monospace';
      ctx.fillText(String(score), x + colW - 56, ry + 18);
    });

    // coverage + latency
    const rx = x + colW + 24;
    const rw = w - colW - 24;
    panel(ctx, c, rx, y, rw, 176, 'COVERAGE');
    [['SAST', 0.94], ['DAST', 0.81], ['DEPENDENCIES', 0.97], ['IaC / CIS', 0.72]].forEach(([lab, v], i) => {
      const py = y + 56 + i * 30;
      ctx.fillStyle = c.dim;
      ctx.font = '500 13px "JetBrains Mono", monospace';
      ctx.fillText(lab, rx + 16, py);
      ctx.fillStyle = c.edge;
      rr(ctx, rx + 150, py - 8, rw - 210, 12, 6);
      ctx.fill();
      ctx.fillStyle = c.neon;
      rr(ctx, rx + 150, py - 8, (rw - 210) * v, 12, 6);
      ctx.fill();
      ctx.fillStyle = c.neon;
      ctx.fillText(Math.round(v * 100) + '%', rx + rw - 48, py);
    });

    panel(ctx, c, rx, y + 194, rw, h - 314, 'LOAD PROFILE — k6');
    const gx = rx + 18;
    const gw = rw - 36;
    const gy = y + 194 + (h - 314) - 30;
    const gh = h - 314 - 70;
    ctx.strokeStyle = c.neon;
    ctx.lineWidth = 3;
    ctx.beginPath();
    [0.2, 0.34, 0.3, 0.52, 0.48, 0.7, 0.62, 0.86].forEach((v, i, arr) => {
      const px = gx + (i / (arr.length - 1)) * gw;
      const py = gy - v * gh;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.fillStyle = c.dim;
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.fillText('p95 latency vs virtual users', gx, gy + 20);

    let cx2 = x;
    ['OWASP TOP 10', 'SAST / DAST', 'SONARQUBE', 'TRIVY', 'k6', 'CIS BENCHMARKS'].forEach((t) => {
      cx2 += chip(ctx, c, cx2, h - 66, t);
    });
  },

  // Security — a SOC console
  security(ctx, c, x, y, w, h) {
    const mapW = w * 0.54;
    panel(ctx, c, x, y, mapW, h - 260, 'THREAT MAP — LIVE');
    // dotted world + attack arcs
    ctx.fillStyle = c.neon;
    for (let px = 0; px < mapW - 40; px += 11) {
      for (let py = 0; py < h - 330; py += 11) {
        const nx = px / (mapW - 40);
        const ny = py / (h - 330);
        const land = Math.sin(nx * 9 + ny * 3) * Math.cos(ny * 7 - nx * 2) + Math.sin(nx * 17 + 1.4) * 0.4;
        if (land > 0.34) {
          ctx.globalAlpha = 0.18 + (land - 0.34) * 0.6;
          ctx.fillRect(x + 22 + px, y + 44 + py, 4, 4);
        }
      }
    }
    ctx.globalAlpha = 1;
    [[0.24, 0.34, 0.68, 0.6], [0.6, 0.28, 0.36, 0.72]].forEach(([ax, ay, bx, by]) => {
      const p0 = [x + 22 + ax * (mapW - 44), y + 44 + ay * (h - 330)];
      const p1 = [x + 22 + bx * (mapW - 44), y + 44 + by * (h - 330)];
      ctx.strokeStyle = c.warm;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.quadraticCurveTo((p0[0] + p1[0]) / 2, Math.min(p0[1], p1[1]) - 60, p1[0], p1[1]);
      ctx.stroke();
      [p0, p1].forEach(([cx3, cy3]) => {
        ctx.fillStyle = c.warm;
        ctx.beginPath();
        ctx.arc(cx3, cy3, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // alert feed
    const rx = x + mapW + 24;
    const rw = w - mapW - 24;
    panel(ctx, c, rx, y, rw, h - 260, 'ALERT FEED');
    [
      ['12:04:11', 'Impossible travel — user 8842', 'HIGH'],
      ['12:03:47', 'Brute force blocked · 214 attempts', 'MED'],
      ['12:01:02', 'New device enrolled (MFA)', 'INFO'],
      ['11:58:20', 'Privilege escalation attempt', 'HIGH'],
      ['11:55:09', 'TLS cert expiring in 14d', 'MED'],
      ['11:51:44', 'Anomalous egress to 45.**.**.7', 'HIGH'],
    ].forEach(([t, msg, sev], i) => {
      const py = y + 56 + i * 40;
      ctx.fillStyle = c.dim;
      ctx.font = '500 13px "JetBrains Mono", monospace';
      ctx.fillText(t, rx + 16, py);
      ctx.fillStyle = c.ink;
      ctx.font = '400 15px Inter, sans-serif';
      ctx.fillText(msg, rx + 104, py);
      ctx.fillStyle = sev === 'HIGH' ? '#ff5a5a' : sev === 'MED' ? c.warm : c.neon;
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText(sev, rx + rw - 56, py);
    });

    // compliance badges
    const by = y + h - 246;
    ['ISO 27001', 'SOC 2 TYPE II', 'PCI DSS', 'RBI / SEBI', 'GDPR'].forEach((b, i) => {
      const bw = (w - 4 * 14) / 5;
      const bx = x + i * (bw + 14);
      panel(ctx, c, bx, by, bw, 82);
      ctx.fillStyle = c.neon;
      ctx.font = '700 18px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b, bx + bw / 2, by + 38);
      ctx.fillStyle = c.dim;
      ctx.font = '500 12px "JetBrains Mono", monospace';
      ctx.fillText('ALIGNED', bx + bw / 2, by + 62);
      ctx.textAlign = 'left';
    });

    let cx2 = x;
    ['ZERO TRUST', 'SIEM / SOAR', 'IAM · MFA', 'EDR', 'PEN TESTING', 'KMS / HSM'].forEach((t) => {
      cx2 += chip(ctx, c, cx2, h - 66, t);
    });
  },

  // Cloud — a multi-cloud architecture board
  cloud(ctx, c, x, y, w, h) {
    const providers = [
      ['AWS', ['EC2 · EKS', 'S3 · RDS', 'Lambda', 'CloudFront']],
      ['MICROSOFT AZURE', ['AKS · VMSS', 'Blob · SQL DB', 'Functions', 'Front Door']],
      ['GOOGLE CLOUD', ['GKE · GCE', 'BigQuery · GCS', 'Cloud Run', 'Cloud CDN']],
    ];
    const cw = (w - 48) / 3;
    providers.forEach(([name, items], i) => {
      const px = x + i * (cw + 24);
      panel(ctx, c, px, y, cw, 232, null);
      // provider header band
      ctx.fillStyle = c.neon;
      ctx.globalAlpha = 0.16;
      rr(ctx, px, y, cw, 52, 12);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = c.neon;
      ctx.font = '700 22px "Outfit", sans-serif';
      ctx.fillText(name, px + 18, y + 32);
      items.forEach((it, k) => {
        ctx.fillStyle = c.edge;
        rr(ctx, px + 18, y + 70 + k * 38, cw - 36, 30, 7);
        ctx.fill();
        ctx.fillStyle = c.ink;
        ctx.font = '500 15px "JetBrains Mono", monospace';
        ctx.fillText(it, px + 30, y + 90 + k * 38);
      });
      // link down to the platform layer
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + cw / 2, y + 232);
      ctx.lineTo(px + cw / 2, y + 268);
      ctx.lineTo(x + w / 2, y + 292);
      ctx.stroke();
    });

    // platform layer
    panel(ctx, c, x + w * 0.16, y + 292, w * 0.68, 78);
    ctx.fillStyle = c.warm;
    ctx.font = '700 24px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KUBERNETES  ·  TERRAFORM  ·  ARGO CD', x + w / 2, y + 326);
    ctx.fillStyle = c.dim;
    ctx.font = '500 14px "JetBrains Mono", monospace';
    ctx.fillText('one control plane across all three providers', x + w / 2, y + 354);
    ctx.textAlign = 'left';

    // review scorecard
    const by = y + 392;
    [['WELL-ARCHITECTED', 0.86], ['COST / FINOPS', 0.71], ['RESILIENCE · MULTI-AZ', 0.93], ['IaC DRIFT', 0.64]]
      .forEach(([lab, v], i) => {
        const bw = (w - 3 * 16) / 4;
        const bx = x + i * (bw + 16);
        panel(ctx, c, bx, by, bw, 92);
        ctx.fillStyle = c.dim;
        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.fillText(lab, bx + 14, by + 26);
        ctx.fillStyle = c.edge;
        rr(ctx, bx + 14, by + 44, bw - 28, 12, 6);
        ctx.fill();
        ctx.fillStyle = v > 0.8 ? c.neon : c.warm;
        rr(ctx, bx + 14, by + 44, (bw - 28) * v, 12, 6);
        ctx.fill();
        ctx.fillStyle = c.ink;
        ctx.font = '700 22px "Outfit", sans-serif';
        ctx.fillText(Math.round(v * 100) + '%', bx + 14, by + 80);
      });

    let cx2 = x;
    ['AWS', 'AZURE', 'GCP', 'KUBERNETES', 'TERRAFORM', 'FINOPS'].forEach((t) => {
      cx2 += chip(ctx, c, cx2, h - 66, t);
    });
  },

  // Transformation — roadmap + delivery pipeline
  transform(ctx, c, x, y, w, h) {
    panel(ctx, c, x, y, w, 250, 'TRANSFORMATION ROADMAP');
    const cols = [
      ['Q1 · ASSESS', ['Legacy inventory', 'Capability gaps', 'Data lineage']],
      ['Q2 · DESIGN', ['Target architecture', 'Migration waves', 'API contracts']],
      ['Q3 · ADOPT', ['Platform team', 'CI/CD rollout', 'Pilot migration']],
      ['Q4 · SCALE', ['Event backbone', 'Data lakehouse', 'MLOps enablement']],
    ];
    const cw = (w - 60) / 4;
    cols.forEach(([t, items], i) => {
      const px = x + 18 + i * (cw + 14);
      ctx.fillStyle = i < 2 ? c.neon : c.edge;
      rr(ctx, px, y + 44, cw, 6, 3);
      ctx.fill();
      ctx.fillStyle = i < 2 ? c.neon : c.dim;
      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.fillText(t, px, y + 78);
      items.forEach((it, k) => {
        ctx.fillStyle = c.panel;
        rr(ctx, px, y + 96 + k * 44, cw, 36, 8);
        ctx.fill();
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = 1.2;
        rr(ctx, px, y + 96 + k * 44, cw, 36, 8);
        ctx.stroke();
        ctx.fillStyle = c.ink;
        ctx.font = '400 15px Inter, sans-serif';
        ctx.fillText(it, px + 12, y + 118 + k * 44);
      });
    });

    // pipeline
    const py = y + 274;
    panel(ctx, c, x, py, w, 108, 'DELIVERY PIPELINE');
    const stages = ['COMMIT', 'BUILD', 'TEST', 'SCAN', 'STAGE', 'DEPLOY'];
    stages.forEach((st, i) => {
      const px = x + 30 + i * ((w - 80) / stages.length);
      const done = i < 4;
      ctx.fillStyle = done ? c.neon : c.edge;
      rr(ctx, px, py + 52, (w - 80) / stages.length - 18, 30, 8);
      ctx.fill();
      ctx.fillStyle = done ? (c.bg || '#04141a') : c.dim;
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillText(st, px + 14, py + 72);
    });

    // metric tiles
    const my = py + 126;
    [['DEPLOY FREQ', 'daily'], ['LEAD TIME', '< 1 day'], ['CHANGE FAIL', '4.2%'], ['MTTR', '38 min']]
      .forEach(([lab, val], i) => {
        const bw = (w - 3 * 16) / 4;
        const bx = x + i * (bw + 16);
        panel(ctx, c, bx, my, bw, 92);
        ctx.fillStyle = c.dim;
        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.fillText(lab, bx + 14, my + 26);
        ctx.fillStyle = c.neon;
        ctx.font = '700 30px "Outfit", sans-serif';
        ctx.fillText(val, bx + 14, my + 66);
      });

    let cx2 = x;
    ['MICROSERVICES', 'EVENT-DRIVEN', 'CI / CD', 'DATA LAKEHOUSE', 'API-FIRST', 'MLOps'].forEach((t) => {
      cx2 += chip(ctx, c, cx2, h - 66, t);
    });
  },
};

// -----------------------------------------------------
// THE BROWSER WINDOW
// -----------------------------------------------------

function screenTexture(active, mode) {
  const c = P[mode].scr;
  const s = SERVICES[active];

  return makeTexture(SW, SH, (ctx, w, h) => {
    ctx.textBaseline = 'middle';

    // ---- window shell ----
    ctx.fillStyle = mode === 'dark' ? '#0a1c24' : '#dfeef4';
    ctx.fillRect(0, 0, w, TOP);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, TOP, w, h - TOP);

    // faint content grid
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 44) {
      ctx.beginPath();
      ctx.moveTo(gx, TOP);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = TOP; gy < h; gy += 44) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // ---- traffic lights ----
    ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(30 + i * 24, BAR / 2, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = c.dim;
    ctx.font = '600 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('FINLABS CONSOLE', w - 26, BAR / 2);
    ctx.textAlign = 'left';

    // ---- tab strip: one tab per service ----
    const tabPad = 12;
    const stripW = w - tabPad * 2;
    const tabW = stripW / SERVICES.length;
    SERVICES.forEach((sv, i) => {
      const tx = tabPad + i * tabW;
      const ty = BAR + 6;
      const th = TABH - 6;
      const on = i === active;

      ctx.fillStyle = on ? c.bg : mode === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(0,40,60,0.05)';
      rr(ctx, tx + 2, ty, tabW - 6, th, 10);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = c.neon;
        ctx.lineWidth = 2;
        rr(ctx, tx + 2, ty, tabW - 6, th, 10);
        ctx.stroke();
        // active underline
        ctx.fillStyle = c.neon;
        rr(ctx, tx + 12, ty + th - 5, tabW - 26, 4, 2);
        ctx.fill();
      }

      // favicon dot
      ctx.fillStyle = on ? c.neon : c.edge;
      ctx.beginPath();
      ctx.arc(tx + 22, ty + th / 2, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = on ? c.ink : c.dim;
      ctx.font = on
        ? '700 15px "JetBrains Mono", monospace'
        : '500 15px "JetBrains Mono", monospace';
      let label = sv.tab;
      while (ctx.measureText(label).width > tabW - 74 && label.length > 4) {
        label = label.slice(0, -1);
      }
      ctx.fillText(label, tx + 38, ty + th / 2);

      // close glyph
      ctx.fillStyle = c.edge;
      ctx.font = '400 16px "JetBrains Mono", monospace';
      ctx.fillText('×', tx + tabW - 24, ty + th / 2);
    });

    // ---- address bar ----
    const ay = BAR + TABH + 7;
    ctx.fillStyle = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,40,60,0.06)';
    rr(ctx, 14, ay, w - 28, ADDR - 14, 16);
    ctx.fill();
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 1.2;
    rr(ctx, 14, ay, w - 28, ADDR - 14, 16);
    ctx.stroke();
    // padlock
    ctx.strokeStyle = c.neon;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(40, ay + 12, 4.5, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = c.neon;
    ctx.fillRect(35, ay + 12, 11, 9);
    ctx.fillStyle = c.dim;
    ctx.font = '500 15px "JetBrains Mono", monospace';
    ctx.fillText(s.url, 60, ay + 16);
    ctx.textAlign = 'right';
    ctx.fillStyle = c.edge;
    ctx.fillText('⟳    ☆    ⋯', w - 32, ay + 16);
    ctx.textAlign = 'left';

    // ---- page content ----
    const M = 44;
    const px = M;
    const py = TOP + 30;
    const pw = w - M * 2;
    const ph = h - py - 30;

    // page heading strip
    ctx.fillStyle = c.neon;
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillText(s.kicker, px, py + 8);
    ctx.fillStyle = c.ink;
    ctx.font = '800 40px "Outfit", sans-serif';
    ctx.fillText(s.title, px, py + 46);
    ctx.fillStyle = c.dim;
    ctx.font = '400 19px Inter, sans-serif';
    ctx.fillText(s.sub, px, py + 82);

    // divider
    ctx.fillStyle = c.edge;
    ctx.fillRect(px, py + 106, pw, 1.5);

    PAGES[s.page](ctx, c, px, py + 132, pw, ph - 132);

    // ---- status bar ----
    ctx.fillStyle = mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,40,60,0.05)';
    ctx.fillRect(0, h - 34, w, 34);
    ctx.fillStyle = c.dim;
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.fillText('SCROLL MOUSE TO SWITCH TABS', 20, h - 17);
    ctx.textAlign = 'right';
    ctx.fillStyle = c.neon;
    ctx.fillText(`TAB ${active + 1} / ${SERVICES.length}`, w - 20, h - 17);
    ctx.textAlign = 'left';

    // scanlines
    ctx.fillStyle = mode === 'dark' ? 'rgba(0,12,18,0.16)' : 'rgba(30,90,110,0.05)';
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
  screenTextures = SERVICES.map((_, i) => screenTexture(i, mode));
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
const bezelHousingMat = tm(new THREE.MeshLambertMaterial({ color: P.dark.metal }), 'metal');

// The back wall gets a printed circuit pattern so neither theme reads as
// a flat slab — it does most of the decorating work in light mode.
function wallPatternTex(mode) {
  const line = mode === 'dark' ? 'rgba(47,240,224,0.16)' : 'rgba(16,120,140,0.30)';
  const dot = mode === 'dark' ? 'rgba(47,240,224,0.30)' : 'rgba(16,120,140,0.45)';
  const base = mode === 'dark' ? '#171220' : '#c7dcef';
  return makeTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    // right-angle traces
    for (let i = 0; i < 9; i++) {
      const y = 26 + i * 56;
      const jog = 60 + ((i * 47) % 140);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(jog, y);
      ctx.lineTo(jog + 34, y + 34);
      ctx.lineTo(w, y + 34);
      ctx.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * 74;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 90 + ((i * 61) % 180));
      ctx.stroke();
    }
    // pads
    ctx.fillStyle = dot;
    for (let i = 0; i < 46; i++) {
      const x = (i * 97) % w;
      const y = (i * 151) % h;
      ctx.fillRect(x, y, 7, 7);
    }
  });
}

const WALL_TEX = { dark: wallPatternTex('dark'), light: wallPatternTex('light') };
WALL_TEX.dark.wrapS = WALL_TEX.dark.wrapT = THREE.RepeatWrapping;
WALL_TEX.light.wrapS = WALL_TEX.light.wrapT = THREE.RepeatWrapping;
WALL_TEX.dark.repeat.set(4, 2.4);
WALL_TEX.light.repeat.set(4, 2.4);

const backWallMat = new THREE.MeshLambertMaterial({ map: WALL_TEX.dark });
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(52, 30), backWallMat);
backWall.position.set(0, 6, SCREEN_Z - 2.6);
room.add(backWall);

// overhead light bars — they read as fixtures in light, as neon in dark
const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
[-8.5, 0, 8.5].forEach((x) => {
  const bar = new THREE.Mesh(rbox(5.2, 0.2, 0.8, 0.09), barMat);
  bar.position.set(x, 13.4, SCREEN_Z + 9);
  room.add(bar);
  const housing = new THREE.Mesh(rbox(6.0, 0.34, 1.3, 0.14), bezelHousingMat);
  housing.position.set(x, 13.62, SCREEN_Z + 9);
  room.add(housing);
});

// framed accent panels either side of the monitor
const artTex = (mode) =>
  makeTexture(400, 300, (ctx, w, h) => {
    const ink = mode === 'dark' ? '#2ff0e0' : '#0e7c8b';
    ctx.fillStyle = mode === 'dark' ? 'rgba(10,28,36,0.9)' : 'rgba(255,255,255,0.92)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    [0.18, 0.36, 0.28, 0.56, 0.5, 0.78].forEach((v, i, a) => {
      const px = 34 + (i / (a.length - 1)) * (w - 68);
      const py = h - 50 - v * (h - 110);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText('UPTIME 99.98%', 34, 44);
  });

const ART_TEX = { dark: artTex('dark'), light: artTex('light') };
const artMats = [];
[-1, 1].forEach((side) => {
  const m = new THREE.MeshBasicMaterial({ map: ART_TEX.dark });
  artMats.push(m);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.15), m);
  art.position.set(side * 17.6, 10.2, SCREEN_Z - 2.3);
  room.add(art);
});

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

  backWallMat.map = WALL_TEX[mode];
  backWallMat.needsUpdate = true;
  artMats.forEach((m) => {
    m.map = ART_TEX[mode];
    m.needsUpdate = true;
  });
  barMat.color.setHex(mode === 'dark' ? 0xd8fffb : 0xffffff);

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
