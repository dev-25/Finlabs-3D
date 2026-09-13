/* =====================================================
 * SITE NAV — the menu button, and the scroll line
 * =====================================================
 * Below 960px the page links fold into a drop-down; this
 * opens and closes it. It also draws the thin line along
 * the top of the window that tracks how far down the
 * page you are. The theme switch in the same bar is
 * wired up by theme.js.
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

// ---------------------------------------------------------------------
// the scroll line
// ---------------------------------------------------------------------

const line = document.createElement('div');
line.className = 'site-progress';
line.setAttribute('aria-hidden', 'true');
const fill = document.createElement('span');
line.append(fill);
document.body.prepend(line);

// scroll events already arrive at most once a frame, so no throttle is needed
function drawLine() {
  const room = document.documentElement.scrollHeight - window.innerHeight;
  const k = room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0;
  fill.style.transform = `scaleX(${k.toFixed(4)})`;
}
window.addEventListener('scroll', drawLine, { passive: true });
window.addEventListener('resize', drawLine);
// pages whose height settles after load (images, the About journey) re-measure
new ResizeObserver(drawLine).observe(document.documentElement);
drawLine();
