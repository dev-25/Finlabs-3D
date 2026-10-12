/* =====================================================
 * i18n — the runtime half
 * =====================================================
 * Nearly everything a reader sees is translated at build
 * time: the pages under /hi/ and /mr/ are whole pages,
 * already in that language. What is left is the handful
 * of strings JavaScript writes after the page has loaded
 * — a filter count, a form's error note — and those come
 * through t() below, reading the dictionary the build
 * inlined into the page.
 *
 * Text drawn inside the 3D scenes is deliberately NOT in
 * here: those labels are painted into canvas textures and
 * stay in English in every language.
 * ===================================================== */

/** The dictionary for this page, inlined by the build. Empty on English. */
const DICT = (typeof window !== 'undefined' && window.__I18N) || {};

export const lang = (typeof document !== 'undefined' && document.documentElement.lang) || 'en';

/**
 * Translate a pattern and fill its {placeholders}.
 *   t('{n} of {total} roles', { n: 3, total: 9 })
 * An untranslated string simply comes back in English.
 */
export function t(pattern, vars) {
  const text = DICT[pattern] || pattern;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
}

/* -----------------------------------------------------
 * The language switcher
 * ---------------------------------------------------*/

const BASE = import.meta.env.BASE_URL; // '/' in dev, '/Finlabs-3D/' once built
const LOCALES = [
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'hi', name: 'हिन्दी', short: 'हि' },
  { code: 'mr', name: 'मराठी', short: 'मर' },
];

/** The same page in another language: swap the locale folder in the path. */
export function urlFor(code) {
  let rest = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname.replace(/^\//, '');
  const first = rest.split('/')[0];
  if (LOCALES.some((l) => l.code === first && l.code !== 'en')) rest = rest.slice(first.length + 1);
  const prefix = code === 'en' ? '' : `${code}/`;
  return BASE + prefix + rest + location.hash;
}

/** Build the switcher and drop it beside the theme toggle. */
export function mountSwitcher() {
  const actions = document.querySelector('.site-nav__actions');
  if (!actions || actions.querySelector('.lang')) return;

  const box = document.createElement('div');
  box.className = 'lang';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lang__btn';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', t('Choose a language'));
  // the short code alone: EN, हि, मर
  button.innerHTML = `<span>${(LOCALES.find((l) => l.code === lang) || LOCALES[0]).short}</span>`;

  const list = document.createElement('div');
  list.className = 'lang__menu';
  list.hidden = true;
  LOCALES.forEach((l) => {
    const a = document.createElement('a');
    a.href = urlFor(l.code);
    a.lang = l.code;
    a.textContent = l.name;
    if (l.code === lang) a.setAttribute('aria-current', 'true');
    list.append(a);
  });

  const close = () => {
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    list.hidden = !list.hidden;
    button.setAttribute('aria-expanded', String(!list.hidden));
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && close());

  box.append(button, list);
  actions.prepend(box);
}
