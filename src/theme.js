/* =====================================================
 * THEME
 * =====================================================
 * Shared light/dark switch for both pages. The choice is
 * stored per browser and applied to <html data-theme>, and
 * scenes can subscribe to recolour their materials.
 * ===================================================== */

const KEY = 'finlabs-theme';
const listeners = new Set();

export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function read() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* private mode, blocked storage — fall through to the default */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function paint(mode) {
  document.documentElement.dataset.theme = mode;
  const btn = document.querySelector('#themeToggle');
  if (btn) {
    btn.setAttribute('aria-pressed', String(mode === 'dark'));
    btn.setAttribute(
      'aria-label',
      mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    );
  }
  listeners.forEach((fn) => fn(mode));
}

/** Register a callback fired now and on every later change. */
export function onTheme(fn) {
  listeners.add(fn);
  fn(currentTheme());
  return () => listeners.delete(fn);
}

export function initTheme() {
  paint(read());

  document.querySelector('#themeToggle')?.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* not fatal — the theme still applies for this visit */
    }
    paint(next);
  });
}
