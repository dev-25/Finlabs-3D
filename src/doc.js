import './doc.css';
import { t } from './i18n.js';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import { initTheme } from './theme.js';

/* =====================================================
 * FINLABS READING PAGES — Terms, Privacy, Contact
 * =====================================================
 * Plain pages, no 3D: the shared menu, the theme switch,
 * a contents list that follows the reader, and the
 * contact form.
 * ===================================================== */

initTheme();

// ---------------------------------------------------------------------
// Contents list — highlight the section being read
// ---------------------------------------------------------------------

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Slide the contents rail sideways so the section being read is visible.
 *
 * This has to move the rail and nothing else. scrollIntoView() would do the
 * job on the rail but then carry on up the tree and scroll the page as well:
 * on a phone the contents list is in the flow near the top, so every time a
 * new section came into view the whole document was dragged back up to it,
 * and the page could not be scrolled past the first screen.
 */
function keepChipInView(link) {
  const rail = link.closest('ol');
  if (!rail || rail.scrollWidth <= rail.clientWidth + 1) return; // not a rail
  const chip = link.getBoundingClientRect();
  const box = rail.getBoundingClientRect();
  const delta = chip.left + chip.width / 2 - (box.left + box.width / 2);
  rail.scrollBy({ left: delta, behavior: REDUCED ? 'auto' : 'smooth' });
}

const tocLinks = [...document.querySelectorAll('.toc a[href^="#"]')];
if (tocLinks.length && 'IntersectionObserver' in window) {
  const byId = new Map(tocLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        tocLinks.forEach((a) => a.classList.remove('on'));
        const link = byId.get(e.target.id);
        if (!link) return;
        link.classList.add('on');
        keepChipInView(link);
      });
    },
    { rootMargin: '-25% 0px -65% 0px' }
  );
  byId.forEach((_, id) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
}

// ---------------------------------------------------------------------
// Contact form — composes an email to the team. There is no backend on
// this site, so the visitor's own mail client sends it.
// ---------------------------------------------------------------------

const form = document.querySelector('#contactForm');
const note = document.querySelector('#formNote');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s-]{10,15}$/;

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const get = (k) => String(data.get(k) || '').trim();
  const name = get('name');
  const email = get('email');
  const phone = get('phone');

  const checks = [
    [form.elements.name, Boolean(name), 'Please add your name.'],
    [form.elements.email, EMAIL_RE.test(email), 'Please enter a valid email address.'],
    [form.elements.phone, !phone || PHONE_RE.test(phone), 'Please check the phone number.'],
  ];
  checks.forEach(([el, ok]) => el.setAttribute('aria-invalid', String(!ok)));
  const failed = checks.find(([, ok]) => !ok);
  if (failed) {
    note.textContent = failed[2];
    note.className = 'form__note err';
    failed[0].focus();
    return;
  }

  const company = get('company');
  const picked = (k) => data.getAll(k).map(String).join(', ');
  const subject = `Enquiry from ${name}${company ? ` — ${company}` : ''}`;
  const body = [
    `Name: ${name}`,
    `Email: ${email}`,
    phone && `Phone: ${phone}`,
    company && `Company: ${company}`,
    picked('product') && `Products: ${picked('product')}`,
    picked('solution') && `Solutions: ${picked('solution')}`,
    picked('service') && `Services: ${picked('service')}`,
    '',
    get('message') || '(no message)',
    '',
    `Marketing consent: ${data.get('marketing') ? 'yes' : 'no'}`,
  ]
    .filter((l) => l !== false && l !== '' && l !== 0)
    .join('\n');

  window.location.href =
    `mailto:info@finlabsindia.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  note.textContent = t('Your email app should open with the message ready to send.');
  note.className = 'form__note ok';
});
