/* =====================================================
 * THEME
 * =====================================================
 * Shared light/dark switch for both pages, applied to
 * <html data-theme>; scenes can subscribe to recolour their
 * materials. A small script in every page's <head> (see
 * vite.config.js) sets the same attribute before the first
 * paint, so pages open in the right theme without a flash.
 *
 * Until someone picks a side the site follows the computer's
 * own setting, and keeps following it — flip the laptop to
 * dark while a page is open and the page turns with it.
 * Choosing the opposite of that setting stores the choice;
 * choosing the one the computer is already on clears it, so
 * the site goes back to following along.
 * ===================================================== */

const KEY = 'finlabs-theme';
const listeners = new Set();
const dark = window.matchMedia?.('(prefers-color-scheme: dark)');

/** What this computer asks for. */
function system() {
  return dark?.matches ? 'dark' : 'light';
}

/** The visitor's own choice, or null while they are following along. */
function chosen() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null; // private mode, blocked storage
  }
}

export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function read() {
  return chosen() || system();
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
      // back on the computer's own setting means following it again
      if (next === system()) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* not fatal — the theme still applies for this visit */
    }
    paint(next);
  });

  // the computer switched over — follow, unless the visitor has chosen
  dark?.addEventListener('change', () => {
    if (!chosen()) paint(system());
  });

  // another tab cleared or made a choice; keep this one in step
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) paint(read());
  });
}
