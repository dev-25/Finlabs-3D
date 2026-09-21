import { REDUCED } from './kc-ui.js';
import './kc-calc.css';

/* =====================================================
 * KNOWLEDGE CENTRE — CALCULATORS
 * =====================================================
 * Two calculators sharing one set of parts: a SIP (the
 * same amount every month) and a lumpsum (one amount,
 * once). Each has three sliders, a donut of invested
 * against returns, a year-by-year chart you can run the
 * pointer along, and a table underneath. The numbers live
 * in the address bar, so a plan can be sent to someone.
 * ===================================================== */

const CALCS = {
  sip: {
    tab: document.querySelector('#tab-sip'),
    panel: document.querySelector('#panel-sip'),
    defaults: { amount: 10000, rate: 12, years: 10 },
    // every instalment earns for the months that follow it
    series(v) {
      const i = v.rate / 1200;
      return every(v.years, (y) => {
        const n = y * 12;
        const value = i ? v.amount * ((Math.pow(1 + i, n) - 1) / i) * (1 + i) : v.amount * n;
        return { invested: v.amount * n, value };
      });
    },
  },
  lumpsum: {
    tab: document.querySelector('#tab-lumpsum'),
    panel: document.querySelector('#panel-lumpsum'),
    defaults: { amount: 300000, rate: 12, years: 10 },
    // one amount, compounding on itself each year
    series(v) {
      return every(v.years, (y) => ({ invested: v.amount, value: v.amount * Math.pow(1 + v.rate / 100, y) }));
    },
  },
};

// year 0 first, so the chart starts where the money starts
function every(years, at) {
  const rows = [{ year: 0, ...at(0) }];
  for (let y = 1; y <= years; y++) rows.push({ year: y, ...at(y) });
  return rows;
}

// ---------------------------------------------------------------------
// numbers, the way they are read in India
// ---------------------------------------------------------------------

const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const trim = (s) => s.replace(/\.?0+$/, '');

function inWords(n) {
  if (n >= 1e7) return `₹${trim((n / 1e7).toFixed(2))} crore`;
  if (n >= 1e5) return `₹${trim((n / 1e5).toFixed(2))} lakh`;
  if (n >= 1e3) return `₹${trim((n / 1e3).toFixed(1))} thousand`;
  return rupees(n);
}

const seen = new WeakMap();
function show(el, value, format = rupees) {
  const from = seen.get(el) ?? 0;
  seen.set(el, value);
  if (REDUCED || Math.abs(value - from) < 1) {
    el.textContent = format(value);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 340);
    const ease = 1 - Math.pow(1 - k, 3);
    el.textContent = format(from + (value - from) * ease);
    if (k < 1 && seen.get(el) === value) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------------
// one calculator
// ---------------------------------------------------------------------

const W = 640; // the chart's own coordinates
const H = 240;
const TOP = 14;

function setup(mode, calc) {
  const { panel, defaults } = calc;
  const form = panel.querySelector('.calc__form');
  const inputs = {
    amount: form.querySelector('[name="amount"]'),
    rate: form.querySelector('[name="rate"]'),
    years: form.querySelector('[name="years"]'),
  };
  const sliders = [...form.querySelectorAll('.calc__slider')];
  const out = Object.fromEntries([...panel.querySelectorAll('[data-out]')].map((el) => [el.dataset.out, el]));
  const arc = panel.querySelector('.calc__arc');
  const plot = panel.querySelector('.calc__plot');
  const svg = plot.querySelector('svg');
  const grid = svg.querySelector('.calc__grid');
  const area = svg.querySelector('.calc__area');
  const line = svg.querySelector('.calc__line');
  const base = svg.querySelector('.calc__base');
  const marker = svg.querySelector('.calc__marker');
  const tip = panel.querySelector('.calc__tip');
  const xaxis = panel.querySelector('.calc__xaxis');
  const tbody = panel.querySelector('tbody');
  const ARC = 2 * Math.PI * 47;

  let rows = [];
  let pinned = null; // the year the pointer is over

  const read = () => ({
    amount: clamp(inputs.amount, defaults.amount),
    rate: clamp(inputs.rate, defaults.rate),
    years: Math.round(clamp(inputs.years, defaults.years)),
  });

  function clamp(el, fallback) {
    const n = Number(el.value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Number(el.max), Math.max(Number(el.min), n));
  }

  function draw() {
    const v = read();
    sliders.forEach((s) => (s.value = String(v[s.dataset.for.split('-')[1]] ?? s.value)));
    rows = calc.series(v);
    const last = rows[rows.length - 1];
    const returns = last.value - last.invested;

    show(out.invested, last.invested);
    show(out.returns, returns);
    show(out.total, last.value);
    const share = last.value > 0 ? returns / last.value : 0;
    show(out.share, share * 100, (n) => `${Math.round(n)}%`);
    arc.style.strokeDasharray = `${(ARC * share).toFixed(2)} ${ARC.toFixed(2)}`;
    out.words.textContent =
      `About ${inWords(last.value)} after ${v.years} ${v.years === 1 ? 'year' : 'years'} — ` +
      `${inWords(returns)} of it returns, at ${trim(v.rate.toFixed(2))}% a year.`;

    // ---- the chart
    const top = Math.max(last.value, 1);
    const x = (y) => (y / v.years) * W;
    const yOf = (n) => H - (n / top) * (H - TOP);
    const path = rows.map((r, k) => `${k ? 'L' : 'M'}${x(r.year).toFixed(1)},${yOf(r.value).toFixed(1)}`).join(' ');
    line.setAttribute('d', path);
    area.setAttribute('d', `${path} L${W},${H} L0,${H} Z`);
    base.setAttribute('d', rows.map((r, k) => `${k ? 'L' : 'M'}${x(r.year).toFixed(1)},${yOf(r.invested).toFixed(1)}`).join(' '));
    grid.innerHTML = [0.25, 0.5, 0.75, 1]
      .map((f) => `<line x1="0" x2="${W}" y1="${(H - f * (H - TOP)).toFixed(1)}" y2="${(H - f * (H - TOP)).toFixed(1)}" />`)
      .join('');

    // year labels: every year while there is room, then every fifth
    const stepY = v.years <= 12 ? 1 : v.years <= 20 ? 2 : 5;
    xaxis.innerHTML = rows
      .filter((r) => r.year && (r.year % stepY === 0 || r.year === v.years))
      .map((r) => `<li style="left:${((r.year / v.years) * 100).toFixed(2)}%">${r.year}</li>`)
      .join('');

    tbody.innerHTML = rows
      .filter((r) => r.year)
      .map(
        (r) =>
          `<tr><th scope="row">${r.year}</th><td>${rupees(r.invested)}</td><td>${rupees(r.value - r.invested)}</td><td>${rupees(r.value)}</td></tr>`
      )
      .join('');

    if (pinned !== null) mark(Math.min(pinned, v.years));
    else clearMark();
    saveToUrl(mode, v);
  }

  // ---- running the pointer along the chart
  function mark(year) {
    const r = rows[year];
    if (!r) return;
    pinned = year;
    const top = Math.max(rows[rows.length - 1].value, 1);
    const px = (year / (rows.length - 1)) * W;
    const py = H - (r.value / top) * (H - TOP);
    marker.hidden = false;
    marker.querySelector('line').setAttribute('x1', px);
    marker.querySelector('line').setAttribute('x2', px);
    marker.querySelector('circle').setAttribute('cx', px);
    marker.querySelector('circle').setAttribute('cy', py);
    tip.hidden = false;
    tip.style.left = `${((year / (rows.length - 1)) * 100).toFixed(2)}%`;
    tip.innerHTML =
      `<b>Year ${year}</b><span>Invested ${rupees(r.invested)}</span><span>Value ${rupees(r.value)}</span>`;
    out.reading.textContent = `Year ${year}: ${rupees(r.invested)} invested, worth ${rupees(r.value)}.`;
  }

  function clearMark() {
    pinned = null;
    marker.hidden = true;
    tip.hidden = true;
    out.reading.textContent = '';
  }

  function yearAt(event) {
    const box = plot.getBoundingClientRect();
    const k = (event.clientX - box.left) / box.width;
    return Math.max(0, Math.min(rows.length - 1, Math.round(k * (rows.length - 1))));
  }
  plot.addEventListener('pointermove', (e) => mark(yearAt(e)));
  plot.addEventListener('pointerdown', (e) => mark(yearAt(e)));
  plot.addEventListener('pointerleave', clearMark);

  // ---- inputs
  sliders.forEach((s) => {
    const field = document.querySelector(`#${s.dataset.for}`);
    s.addEventListener('input', () => {
      field.value = s.value;
      draw();
    });
  });
  Object.values(inputs).forEach((el) => {
    el.addEventListener('input', draw);
    el.addEventListener('blur', () => {
      el.value = String(clamp(el, Number(el.defaultValue)));
      draw();
    });
  });
  panel.querySelectorAll('[data-set]').forEach((chip) =>
    chip.addEventListener('click', () => {
      inputs[chip.dataset.set].value = chip.dataset.value;
      draw();
    })
  );

  panel.querySelector('[data-act="reset"]').addEventListener('click', () => {
    Object.entries(defaults).forEach(([k, val]) => (inputs[k].value = String(val)));
    clearMark();
    draw();
  });

  const copyBtn = panel.querySelector('[data-act="copy"]');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      flash(copyBtn, 'Link copied');
    } catch {
      flash(copyBtn, 'Press Ctrl/Cmd + C');
    }
  });

  return {
    draw,
    set(values) {
      Object.entries(values).forEach(([k, val]) => {
        if (inputs[k] && Number.isFinite(val)) inputs[k].value = String(val);
      });
      draw();
    },
  };
}

function flash(btn, text) {
  const was = btn.textContent;
  btn.textContent = text;
  btn.classList.add('is-done');
  setTimeout(() => {
    btn.textContent = was;
    btn.classList.remove('is-done');
  }, 1600);
}

// ---------------------------------------------------------------------
// the address bar keeps the plan
// ---------------------------------------------------------------------

let mode = 'sip';
function saveToUrl(which, v) {
  if (which !== mode) return;
  const q = new URLSearchParams({ a: String(v.amount), r: String(v.rate), y: String(v.years) });
  history.replaceState(null, '', `?${q}#${which}`);
}

const built = Object.fromEntries(Object.entries(CALCS).map(([key, calc]) => [key, setup(key, calc)]));

// ---------------------------------------------------------------------
// the two tabs
// ---------------------------------------------------------------------

const tabs = Object.entries(CALCS);

function pick(which, { focus = false } = {}) {
  if (!CALCS[which]) return;
  mode = which;
  tabs.forEach(([key, calc]) => {
    const on = key === which;
    calc.tab.setAttribute('aria-selected', String(on));
    calc.tab.tabIndex = on ? 0 : -1;
    calc.panel.hidden = !on;
    if (on && focus) calc.tab.focus();
  });
  built[which].draw();
}

tabs.forEach(([key, calc], i) => {
  calc.tab.addEventListener('click', () => pick(key));
  calc.tab.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    pick(tabs[(i + step + tabs.length) % tabs.length][0], { focus: true });
  });
});

// open on whatever the address asks for, with its numbers
const params = new URLSearchParams(location.search);
const wanted = location.hash.slice(1);
const start = CALCS[wanted] ? wanted : 'sip';
const asked = (key) => (params.has(key) ? Number(params.get(key)) : NaN);
const numbers = { amount: asked('a'), rate: asked('r'), years: asked('y') };
pick(start);
if (Object.values(numbers).some(Number.isFinite)) built[start].set(numbers);

window.addEventListener('hashchange', () => {
  const next = location.hash.slice(1);
  if (CALCS[next] && next !== mode) pick(next);
});

if (import.meta.env.DEV) window.__calc = { built, pick, CALCS };
