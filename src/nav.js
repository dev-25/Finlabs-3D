/* =====================================================
 * SITE NAV — the menu button on small screens
 * =====================================================
 * Below 960px the page links fold into a drop-down; this
 * opens and closes it. The theme switch in the same bar
 * is wired up by theme.js.
 * ===================================================== */

const nav = document.querySelector('.site-nav');
const menu = nav?.querySelector('.site-nav__menu');

function setOpen(open) {
  nav.classList.toggle('open', open);
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

if (nav && menu) {
  menu.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.querySelectorAll('.site-nav__links a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) setOpen(false);
  });
}
