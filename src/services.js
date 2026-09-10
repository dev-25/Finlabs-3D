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
    tagline: 'Advisory · Build · Managed',
    desc:
      'Finlabs partners with banks, AMCs, wealth managers and insurers to plan, build and run '
      + 'their technology. Our commitment is rooted in a multidimensional approach: seasoned '
      + 'experts who know the sector, solutions tailored to your existing stack, transparent '
      + 'communication throughout, and results you can measure.',
    page: 'overview',
  },
  {
    tab: 'UI / UX',
    url: 'https://finlabsindia.org/services/ui-ux-consulting',
    kicker: 'SERVICE 01 // EXPERIENCE',
    title: 'UI / UX Consulting',
    sub: 'User-centered design, intuitive interfaces and seamless experiences that drive engagement.',
    tagline: 'Research to design system',
    desc:
      'We start with the people who use your product — interviews, journey mapping and analytics '
      + 'review — then turn what we learn into information architecture, interface design and a '
      + 'component library your engineers can build from. Every screen is checked against WCAG 2.2 AA '
      + 'before handoff.',
    page: 'uiux',
  },
  {
    tab: 'Audits',
    url: 'https://finlabsindia.org/services/application-infra-audits',
    kicker: 'SERVICE 02 // ASSURANCE',
    title: 'Application & Infra Audits',
    sub: 'Identify vulnerabilities, optimize performance and enhance security across code and infrastructure.',
    tagline: 'Find it before an attacker does',
    desc:
      'A full sweep of your applications and infrastructure. Static and dynamic analysis, dependency '
      + 'and SBOM review, CIS benchmark checks against your infrastructure-as-code, and load testing '
      + 'to find the bottleneck before your customers do. You get findings ranked by CVSS severity and '
      + 'a remediation plan sequenced by effort against risk.',
    page: 'audit',
  },
  {
    tab: 'Security',
    url: 'https://finlabsindia.org/services/cybersecurity',
    kicker: 'SERVICE 03 // DEFENCE',
    title: 'Cybersecurity',
    sub: 'Threat assessment, advanced defense strategies and proactive risk mitigation.',
    tagline: 'Zero trust by default',
    desc:
      'Threat modelling workshops map your real attack surface, then we harden it: identity and access '
      + 'redesigned around zero trust, encryption at rest and in transit backed by managed keys, network '
      + 'segmentation, and detection wired into SIEM with SOAR playbooks your team can actually run. '
      + 'Controls are mapped to ISO 27001 and SOC 2 so audits stop being a fire drill.',
    page: 'security',
  },
  {
    tab: 'Cloud',
    url: 'https://finlabsindia.org/services/cloud-architecture-review',
    kicker: 'SERVICE 04 // CLOUD',
    title: 'Cloud Architecture Review',
    sub: 'Optimize efficiency, security and scalability across AWS, Azure and Google Cloud.',
    tagline: 'AWS · Azure · Google Cloud',
    desc:
      'A meticulous review of what you are running and what it costs you. We assess against the AWS '
      + 'Well-Architected Framework, Azure Cloud Adoption Framework and Google Cloud Architecture '
      + 'Framework, check landing zones and Terraform drift, and model resilience across availability '
      + 'zones and regions. The output is a right-sizing and FinOps plan with the savings quantified.',
    page: 'cloud',
  },
  {
    tab: 'Transform',
    url: 'https://finlabsindia.org/services/digital-transformation',
    kicker: 'SERVICE 05 // TRANSFORMATION',
    title: 'Digital Transformation Strategy',
    sub: 'Roadmaps leveraging emerging technologies, data-driven insights and agile delivery.',
    tagline: 'Roadmap to platform',
    desc:
      'We inventory the legacy estate, agree a target architecture, and sequence the migration into '
      + 'waves that keep the business running. Microservices where they earn their keep, an event '
      + 'backbone for the rest, CI/CD so releases stop being events, and a platform team set up to own '
      + 'it after we leave. Progress is tracked against DORA metrics, not slideware.',
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
const SW = 1840;
const SH = 1035;

// browser chrome metrics
const BAR = 44;
const TABH = 48;
const ADDR = 44;
const TOP = BAR + TABH + ADDR;

// -----------------------------------------------------
// DASHBOARD PALETTE  (modelled on a dark fintech console)
// -----------------------------------------------------

const UI = {
  dark: {
    chrome: '#15181e',
    bg: '#1c2027',
    card: '#252A33',
    cardAlt: '#2E343F',
    ink: '#F3F5F8',
    dim: '#98A0AE',
    faint: '#69707E',
    line: 'rgba(255,255,255,0.07)',
    accent: '#FF5964',
    amber: '#FFC247',
    green: '#3ECF8E',
    blue: '#5B9CFF',
    violet: '#9A7BFF',
    tabOff: 'rgba(255,255,255,0.05)',
  },
  light: {
    chrome: '#E7EBF1',
    bg: '#F3F5F9',
    card: '#FFFFFF',
    cardAlt: '#EDF1F6',
    ink: '#171A21',
    dim: '#69707E',
    faint: '#98A0AE',
    line: 'rgba(20,30,50,0.10)',
    accent: '#EF4352',
    amber: '#E9A21B',
    green: '#22A96F',
    blue: '#3D7BE0',
    violet: '#7A5CF0',
    tabOff: 'rgba(20,30,50,0.05)',
  },
};

// -----------------------------------------------------
// SMALL DRAWING PRIMITIVES
// -----------------------------------------------------

function card(ctx, u, x, y, w, h, alt) {
  ctx.fillStyle = alt ? u.cardAlt : u.card;
  rr(ctx, x, y, w, h, 14);
  ctx.fill();
}

function label(ctx, u, text, x, y, size = 13, col) {
  ctx.fillStyle = col || u.dim;
  ctx.font = `600 ${size}px Inter, sans-serif`;
  ctx.fillText(text, x, y);
}

function heading(ctx, u, text, x, y, size = 20, col) {
  ctx.fillStyle = col || u.ink;
  ctx.font = `700 ${size}px Inter, sans-serif`;
  ctx.fillText(text, x, y);
}

function pill(ctx, u, x, y, text, col) {
  ctx.font = '700 12px Inter, sans-serif';
  const w = ctx.measureText(text).width + 22;
  ctx.fillStyle = col + '26';
  rr(ctx, x, y - 11, w, 22, 11);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.fillText(text, x + 11, y + 1);
  return w + 8;
}

// donut used in a few of the cards
function donut(ctx, cx, cy, r, segs, trackCol) {
  ctx.lineWidth = r * 0.42;
  ctx.strokeStyle = trackCol;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  let a = -Math.PI / 2;
  segs.forEach(([frac, col]) => {
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a, a + frac * Math.PI * 2);
    ctx.stroke();
    a += frac * Math.PI * 2;
  });
}

function areaChart(ctx, u, x, y, w, h, pts, col) {
  const px = (i) => x + (i / (pts.length - 1)) * w;
  const py = (v) => y + h - v * h;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, col + '55');
  g.addColorStop(1, col + '00');
  ctx.beginPath();
  ctx.moveTo(px(0), y + h);
  pts.forEach((v, i) => ctx.lineTo(px(i), py(v)));
  ctx.lineTo(px(pts.length - 1), y + h);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  pts.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(px(pts.length - 1), py(pts[pts.length - 1]), 5.5, 0, Math.PI * 2);
  ctx.fill();
}

function barChart(ctx, u, x, y, w, h, vals, cols) {
  const bw = w / vals.length - 12;
  vals.forEach((v, i) => {
    const bx = x + i * (w / vals.length);
    ctx.fillStyle = u.line;
    rr(ctx, bx, y, bw, h, 6);
    ctx.fill();
    ctx.fillStyle = cols[i % cols.length];
    rr(ctx, bx, y + h * (1 - v), bw, h * v, 6);
    ctx.fill();
  });
}

// -----------------------------------------------------
// ILLUSTRATION TILES
// Flat vector artwork, drawn per domain. Not photography —
// swap these for real assets by loading textures instead.
// -----------------------------------------------------

function illustration(ctx, u, kind, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  rr(ctx, x, y, w, h, 14);
  ctx.clip();

  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  if (kind === 'uiux') {
    g.addColorStop(0, '#5B9CFF');
    g.addColorStop(1, '#9A7BFF');
  } else if (kind === 'audit') {
    g.addColorStop(0, '#FFC247');
    g.addColorStop(1, '#FF5964');
  } else if (kind === 'security') {
    g.addColorStop(0, '#FF5964');
    g.addColorStop(1, '#9A7BFF');
  } else if (kind === 'cloud') {
    g.addColorStop(0, '#3ECF8E');
    g.addColorStop(1, '#5B9CFF');
  } else if (kind === 'transform') {
    g.addColorStop(0, '#9A7BFF');
    g.addColorStop(1, '#3ECF8E');
  } else {
    g.addColorStop(0, '#5B9CFF');
    g.addColorStop(1, '#3ECF8E');
  }
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x + w * (0.15 + i * 0.2), y + h * (i % 2 ? 0.72 : 0.28), h * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 5;

  if (kind === 'uiux') {
    ctx.strokeRect(cx - 62, cy - 44, 124, 88);
    ctx.fillRect(cx - 62, cy - 44, 124, 16);
    ctx.globalAlpha = 0.75;
    ctx.fillRect(cx - 50, cy - 16, 54, 10);
    ctx.fillRect(cx - 50, cy + 4, 78, 10);
    ctx.globalAlpha = 1;
  }
  if (kind === 'audit') {
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 12, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(cx + 14, cy + 14);
    ctx.lineTo(cx + 48, cy + 48);
    ctx.stroke();
  }
  if (kind === 'security') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 52);
    ctx.lineTo(cx + 42, cy - 32);
    ctx.lineTo(cx + 42, cy + 6);
    ctx.quadraticCurveTo(cx + 42, cy + 42, cx, cy + 58);
    ctx.quadraticCurveTo(cx - 42, cy + 42, cx - 42, cy + 6);
    ctx.lineTo(cx - 42, cy - 32);
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - 17, cy + 4);
    ctx.lineTo(cx - 3, cy + 20);
    ctx.lineTo(cx + 22, cy - 16);
    ctx.stroke();
  }
  if (kind === 'cloud') {
    ctx.beginPath();
    ctx.arc(cx - 30, cy + 8, 24, Math.PI * 0.6, Math.PI * 1.7);
    ctx.arc(cx, cy - 12, 32, Math.PI * 1.1, Math.PI * 1.95);
    ctx.arc(cx + 34, cy + 8, 23, Math.PI * 1.4, Math.PI * 0.4);
    ctx.closePath();
    ctx.stroke();
  }
  if (kind === 'transform') {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 60, cy + 34);
    ctx.lineTo(cx - 18, cy - 6);
    ctx.lineTo(cx + 10, cy + 14);
    ctx.lineTo(cx + 62, cy - 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 62, cy - 40);
    ctx.lineTo(cx + 34, cy - 38);
    ctx.lineTo(cx + 58, cy - 14);
    ctx.closePath();
    ctx.fill();
  }
  if (kind === 'overview') {
    ctx.lineWidth = 4;
    [[-52, 0], [0, -34], [52, 0], [0, 34]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// small round avatar, drawn rather than photographed
function avatar(ctx, x, y, r, a, b, initials) {
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `700 ${r * 0.85}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(initials, x, y + 1);
  ctx.textAlign = 'left';
}

// -----------------------------------------------------
// PER-SERVICE DASHBOARD DATA
// -----------------------------------------------------

const BOARD = {
  overview: {
    stats: [
      ['Active engagements', '24', '+3 this quarter', 'green'],
      ['Avg. delivery', '11 wks', 'discovery to launch', 'blue'],
      ['Client retention', '96%', 'rolling 12 months', 'amber'],
    ],
    chartTitle: 'Engagements delivered',
    chart: [0.24, 0.36, 0.32, 0.5, 0.46, 0.64, 0.72, 0.88],
    chartCol: 'green',
    listTitle: 'Practice areas',
    list: [
      ['UI / UX Consulting', 'Research → design system', 'Active'],
      ['Application & Infra Audits', 'Code, infra, performance', 'Active'],
      ['Cybersecurity', 'Zero-trust, SOC 2, ISO 27001', 'Active'],
      ['Cloud Architecture Review', 'AWS · Azure · GCP', 'Active'],
      ['Digital Transformation', 'Roadmap → platform', 'Active'],
    ],
    sideTitle: 'Engagement model',
    side: [['Advisory', '4–8 wks'], ['Build', '3–9 mths'], ['Managed', 'Ongoing']],
    illo: 'overview',
  },
  uiux: {
    stats: [
      ['Task success', '94%', '+18 pts post-redesign', 'green'],
      ['Time to interactive', '1.8s', 'p75, mobile', 'blue'],
      ['Components shipped', '142', 'in the design system', 'violet'],
    ],
    chartTitle: 'Usability score by round',
    chart: [0.3, 0.42, 0.4, 0.58, 0.66, 0.74, 0.82, 0.94],
    chartCol: 'blue',
    listTitle: 'What we deliver',
    list: [
      ['Discovery research', 'Interviews, journey maps, analytics review', 'Wk 1–2'],
      ['Information architecture', 'Flows, sitemap, content model', 'Wk 2–3'],
      ['Interface design', 'Wireframes → high-fidelity, prototypes', 'Wk 3–6'],
      ['Design system', 'Tokens, components, Storybook, docs', 'Wk 6–9'],
      ['Accessibility audit', 'WCAG 2.2 AA, screen-reader passes', 'Wk 9'],
    ],
    sideTitle: 'Stack',
    side: [['Figma', 'Design'], ['React + TS', 'Build'], ['Storybook', 'Docs'], ['WCAG 2.2', 'Standard']],
    illo: 'uiux',
  },
  audit: {
    stats: [
      ['Findings raised', '68', '9 critical, 21 high', 'accent'],
      ['Code coverage', '81%', 'after remediation', 'green'],
      ['p95 latency', '−42%', 'under 2× peak load', 'amber'],
    ],
    chartTitle: 'Open findings over remediation',
    chart: [0.92, 0.84, 0.7, 0.58, 0.44, 0.3, 0.2, 0.12],
    chartCol: 'accent',
    listTitle: 'Audit scope',
    list: [
      ['Static analysis', 'SonarQube, Semgrep, secret scanning', 'SAST'],
      ['Dynamic testing', 'Authenticated crawl, fuzzing, API abuse', 'DAST'],
      ['Dependencies', 'SBOM, CVE triage, licence review', 'Trivy'],
      ['Infrastructure', 'CIS benchmarks, IaC drift, network policy', 'Terraform'],
      ['Performance', 'Load profiles, N+1 queries, cache strategy', 'k6'],
    ],
    sideTitle: 'Severity mix',
    side: [['Critical', '9'], ['High', '21'], ['Medium', '26'], ['Low', '12']],
    illo: 'audit',
  },
  security: {
    stats: [
      ['Mean time to detect', '6 min', 'down from 41 min', 'green'],
      ['Blocked intrusions', '1,284', 'last 30 days', 'accent'],
      ['Controls mapped', '212', 'ISO 27001 + SOC 2', 'blue'],
    ],
    chartTitle: 'Threat events blocked',
    chart: [0.4, 0.55, 0.48, 0.7, 0.62, 0.8, 0.74, 0.9],
    chartCol: 'accent',
    listTitle: 'Defence programme',
    list: [
      ['Threat modelling', 'STRIDE workshops, attack surface map', 'Assess'],
      ['Identity', 'Zero trust, IAM roles, MFA, session policy', 'Defend'],
      ['Data protection', 'Encryption at rest and in transit, KMS/HSM', 'Defend'],
      ['Detection', 'SIEM pipelines, SOAR playbooks, EDR', 'Monitor'],
      ['Assurance', 'Penetration tests, red team, tabletop drills', 'Verify'],
    ],
    sideTitle: 'Compliance',
    side: [['ISO 27001', 'Aligned'], ['SOC 2 Type II', 'Ready'], ['PCI DSS', 'Scoped'], ['RBI / SEBI', 'Mapped']],
    illo: 'security',
  },
  cloud: {
    stats: [
      ['Monthly spend', '−31%', 'after right-sizing', 'green'],
      ['Availability', '99.98%', 'multi-AZ, multi-region', 'blue'],
      ['IaC coverage', '88%', 'Terraform managed', 'violet'],
    ],
    chartTitle: 'Cloud spend after review',
    chart: [0.9, 0.86, 0.72, 0.64, 0.52, 0.46, 0.42, 0.38],
    chartCol: 'green',
    listTitle: 'Reviewed across all three providers',
    list: [
      ['AWS', 'EC2 · EKS · S3 · RDS · Lambda · CloudFront', 'Well-Architected'],
      ['Microsoft Azure', 'AKS · VMSS · Blob · SQL DB · Functions', 'CAF review'],
      ['Google Cloud', 'GKE · GCE · BigQuery · GCS · Cloud Run', 'Architecture FW'],
      ['Orchestration', 'Kubernetes, Helm, Argo CD, service mesh', 'Platform'],
      ['Infrastructure as code', 'Terraform modules, drift detection, policy', 'OPA'],
    ],
    sideTitle: 'Workload split',
    side: [['AWS', '52%'], ['Azure', '28%'], ['GCP', '20%']],
    illo: 'cloud',
  },
  transform: {
    stats: [
      ['Deploy frequency', 'Daily', 'from monthly', 'green'],
      ['Lead time', '< 1 day', 'commit to production', 'blue'],
      ['Change failure', '4.2%', 'elite band', 'amber'],
    ],
    chartTitle: 'Delivery throughput',
    chart: [0.18, 0.26, 0.34, 0.42, 0.56, 0.66, 0.8, 0.92],
    chartCol: 'violet',
    listTitle: 'Transformation roadmap',
    list: [
      ['Q1 · Assess', 'Legacy inventory, capability gaps, data lineage', 'Done'],
      ['Q2 · Design', 'Target architecture, migration waves, API contracts', 'Done'],
      ['Q3 · Adopt', 'Platform team, CI/CD rollout, pilot migration', 'Active'],
      ['Q4 · Scale', 'Event backbone, data lakehouse, MLOps enablement', 'Planned'],
      ['Ongoing', 'Enablement, golden paths, developer experience', 'Planned'],
    ],
    sideTitle: 'Architecture',
    side: [['Microservices', 'Core'], ['Event-driven', 'Backbone'], ['API-first', 'Contract'], ['MLOps', 'Data']],
    illo: 'transform',
  },
};

// -----------------------------------------------------
// THE BROWSER WINDOW + DASHBOARD
// -----------------------------------------------------

function screenTexture(active, mode) {
  const u = UI[mode];
  const s = SERVICES[active];
  const b = BOARD[s.page];

  return makeTexture(SW, SH, (ctx, w, h) => {
    ctx.textBaseline = 'middle';

    // ================= browser chrome =================
    ctx.fillStyle = u.chrome;
    ctx.fillRect(0, 0, w, TOP);
    ctx.fillStyle = u.bg;
    ctx.fillRect(0, TOP, w, h - TOP);

    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(28 + i * 22, BAR / 2, 7, 0, Math.PI * 2);
      ctx.fill();
    });

    // tabs — one per service
    const pad = 10;
    const tabW = (w - pad * 2) / SERVICES.length;
    SERVICES.forEach((sv, i) => {
      const tx = pad + i * tabW;
      const ty = BAR + 4;
      const th = TABH - 4;
      const on = i === active;

      ctx.fillStyle = on ? u.bg : u.tabOff;
      rr(ctx, tx + 2, ty, tabW - 6, th + 10, 10);
      ctx.fill();

      ctx.fillStyle = on ? u.accent : u.faint;
      ctx.beginPath();
      ctx.arc(tx + 20, ty + th / 2, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = on ? u.ink : u.dim;
      ctx.font = on ? '700 15px Inter, sans-serif' : '500 15px Inter, sans-serif';
      ctx.fillText(sv.tab, tx + 36, ty + th / 2);

      ctx.fillStyle = u.faint;
      ctx.font = '400 15px Inter, sans-serif';
      ctx.fillText('×', tx + tabW - 26, ty + th / 2);
    });

    // address bar
    const ay = BAR + TABH + 6;
    ctx.fillStyle = u.tabOff;
    rr(ctx, 12, ay, w - 24, ADDR - 14, 15);
    ctx.fill();
    ctx.strokeStyle = u.green;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(36, ay + 11, 4, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = u.green;
    ctx.fillRect(31.5, ay + 11, 9, 8);
    ctx.fillStyle = u.dim;
    ctx.font = '500 14px Inter, sans-serif';
    ctx.fillText(s.url, 54, ay + 15);

    // ================= app header =================
    const M = 34;
    let y = TOP + 34;

    ctx.fillStyle = u.accent;
    rr(ctx, M, y - 13, 26, 26, 8);
    ctx.fill();
    ctx.fillStyle = u.ink;
    ctx.font = '800 17px Inter, sans-serif';
    ctx.fillText('Finlabs', M + 36, y);

    let nx = M + 132;
    ['Home', 'Services', 'Insights', 'Support'].forEach((n, i) => {
      ctx.fillStyle = i === 1 ? u.accent : u.dim;
      ctx.font = i === 1 ? '700 14px Inter, sans-serif' : '500 14px Inter, sans-serif';
      ctx.fillText(n, nx, y);
      if (i === 1) {
        ctx.fillStyle = u.accent;
        rr(ctx, nx, y + 15, ctx.measureText(n).width, 3, 1.5);
        ctx.fill();
      }
      nx += ctx.measureText(n).width + 34;
    });

    // search
    ctx.fillStyle = u.card;
    rr(ctx, nx + 20, y - 15, 260, 30, 15);
    ctx.fill();
    ctx.fillStyle = u.faint;
    ctx.font = '400 13px Inter, sans-serif';
    ctx.fillText('Search reports', nx + 44, y + 1);
    ctx.strokeStyle = u.faint;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(nx + 33, y - 1, 5, 0, Math.PI * 2);
    ctx.stroke();

    // account
    avatar(ctx, w - M - 18, y, 17, u.violet, u.blue, 'FI');
    ctx.fillStyle = u.ink;
    ctx.font = '600 14px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Finlabs India', w - M - 46, y - 7);
    ctx.fillStyle = u.faint;
    ctx.font = '400 12px Inter, sans-serif';
    ctx.fillText('Consulting workspace', w - M - 46, y + 9);
    ctx.textAlign = 'left';

    ctx.fillStyle = u.line;
    ctx.fillRect(M, y + 30, w - M * 2, 1);

    // ================= layout =================
    const colGap = 22;
    const rightW = 420;
    const leftW = w - M * 2 - rightW - colGap;
    const leftX = M;
    const rightX = M + leftW + colGap;
    let ly = y + 62;

    // ---- title + description ----
    heading(ctx, u, s.title, leftX, ly + 14, 32);
    ly += 44;
    ctx.fillStyle = u.dim;
    ctx.font = '400 16px Inter, sans-serif';
    ly = wrap(ctx, s.desc, leftX, ly, leftW - 20, 25) + 6;

    // ---- stat cards ----
    const sw = (leftW - 2 * 14) / 3;
    b.stats.forEach(([lab, val, sub, col], i) => {
      const sx = leftX + i * (sw + 14);
      card(ctx, u, sx, ly, sw, 100);
      label(ctx, u, lab, sx + 18, ly + 26, 12);
      ctx.fillStyle = u.ink;
      ctx.font = '800 30px Inter, sans-serif';
      ctx.fillText(val, sx + 18, ly + 58);
      ctx.fillStyle = u[col];
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillText(sub, sx + 18, ly + 82);
    });
    ly += 118;

    // ---- chart card ----
    const chartH = 190;
    card(ctx, u, leftX, ly, leftW, chartH);
    heading(ctx, u, b.chartTitle, leftX + 18, ly + 26, 15);
    label(ctx, u, 'Last 8 periods', leftX + 18, ly + 48, 12);
    areaChart(ctx, u, leftX + 18, ly + 66, leftW - 46, chartH - 96, b.chart, u[b.chartCol]);
    ['1', '2', '3', '4', '5', '6', '7', '8'].forEach((t, i, a) => {
      ctx.fillStyle = u.faint;
      ctx.font = '500 11px Inter, sans-serif';
      ctx.fillText(t, leftX + 18 + (i / (a.length - 1)) * (leftW - 46), ly + chartH - 16);
    });
    ly += chartH + 18;

    // ---- list card ----
    const listH = h - ly - 54;
    card(ctx, u, leftX, ly, leftW, listH);
    heading(ctx, u, b.listTitle, leftX + 18, ly + 26, 15);
    b.list.forEach((row, i) => {
      const ry = ly + 58 + i * 42;
      if (ry + 20 > ly + listH) return;
      ctx.fillStyle = u.cardAlt;
      rr(ctx, leftX + 14, ry - 15, leftW - 28, 34, 8);
      ctx.fill();
      ctx.fillStyle = u.ink;
      ctx.font = '600 14px Inter, sans-serif';
      ctx.fillText(row[0], leftX + 28, ry + 2);
      ctx.fillStyle = u.dim;
      ctx.font = '400 13px Inter, sans-serif';
      ctx.fillText(row[1], leftX + 268, ry + 2);
      const tagCol =
        row[2] === 'Active' || row[2] === 'Done' ? u.green : row[2] === 'Planned' ? u.amber : u.blue;
      ctx.textAlign = 'right';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillStyle = tagCol;
      ctx.fillText(row[2], leftX + leftW - 28, ry + 2);
      ctx.textAlign = 'left';
    });

    // ================= right column =================
    let ry2 = y + 62;

    // illustration tile
    const illoH = 210;
    illustration(ctx, u, b.illo, rightX, ry2, rightW, illoH);
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    rr(ctx, rightX + 16, ry2 + illoH - 54, rightW - 32, 38, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px Inter, sans-serif';
    ctx.fillText(s.tagline, rightX + 30, ry2 + illoH - 35);
    ry2 += illoH + 18;

    // side metric card
    const sideH = 224;
    card(ctx, u, rightX, ry2, rightW, sideH);
    heading(ctx, u, b.sideTitle, rightX + 18, ry2 + 26, 15);
    b.side.forEach(([k, v], i) => {
      const yy = ry2 + 62 + i * 38;
      ctx.fillStyle = [u.blue, u.green, u.amber, u.violet][i % 4];
      rr(ctx, rightX + 18, yy - 6, 10, 10, 3);
      ctx.fill();
      ctx.fillStyle = u.ink;
      ctx.font = '600 14px Inter, sans-serif';
      ctx.fillText(k, rightX + 38, yy);
      ctx.textAlign = 'right';
      ctx.fillStyle = u.dim;
      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillText(v, rightX + rightW - 18, yy);
      ctx.textAlign = 'left';
    });
    ry2 += sideH + 18;

    // team / contact card
    const teamH = h - ry2 - 54;
    if (teamH > 90) {
      card(ctx, u, rightX, ry2, rightW, teamH);
      heading(ctx, u, 'Your delivery pod', rightX + 18, ry2 + 26, 15);
      [
        ['AR', 'Engagement lead', u.accent, u.amber],
        ['SM', 'Principal architect', u.blue, u.violet],
        ['KP', 'Security specialist', u.green, u.blue],
      ].forEach(([ini, role, c1, c2], i) => {
        const yy = ry2 + 62 + i * 44;
        if (yy + 18 > ry2 + teamH) return;
        avatar(ctx, rightX + 32, yy, 15, c1, c2, ini);
        ctx.fillStyle = u.ink;
        ctx.font = '600 14px Inter, sans-serif';
        ctx.fillText(role, rightX + 58, yy);
      });
    }

    // ================= status bar =================
    ctx.fillStyle = u.chrome;
    ctx.fillRect(0, h - 32, w, 32);
    ctx.fillStyle = u.dim;
    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillText('Scroll to switch tabs', 20, h - 16);
    ctx.textAlign = 'right';
    ctx.fillStyle = u.accent;
    ctx.font = '700 12px Inter, sans-serif';
    ctx.fillText(`Tab ${active + 1} of ${SERVICES.length}`, w - 20, h - 16);
    ctx.textAlign = 'left';
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
const lookTarget = new THREE.Vector3(0, SCREEN_Y, SCREEN_Z);
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
  // Head-on and centred. Drifting the camera or aiming off-centre makes
  // the screen render as a trapezoid instead of a rectangle.
  camera.position.x += (0 - camera.position.x) * 0.08;
  camera.position.y += (SCREEN_Y + outro * 1.6 - camera.position.y) * 0.08;
  lookTarget.y += (SCREEN_Y + outro * 1.6 - lookTarget.y) * 0.08;
  lookTarget.x = 0;
  lookTarget.z = SCREEN_Z;
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
