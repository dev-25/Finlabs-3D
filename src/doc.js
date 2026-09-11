import './doc.css';
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

const tocLinks = [...document.querySelectorAll('.toc a[href^="#"]')];
if (tocLinks.length && 'IntersectionObserver' in window) {
  const byId = new Map(tocLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        tocLinks.forEach((a) => a.classList.remove('on'));
        const link = byId.get(e.target.id);
        link?.classList.add('on');
        // keep the active chip in view when the list scrolls sideways on phones
        link?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
  const interests = data.getAll('interest').map(String);
  const subject = `Enquiry from ${name}${company ? ` — ${company}` : ''}`;
  const body = [
    `Name: ${name}`,
    `Email: ${email}`,
    phone && `Phone: ${phone}`,
    company && `Company: ${company}`,
    get('website') && `Website: ${get('website')}`,
    interests.length && `Interested in: ${interests.join(', ')}`,
    '',
    get('message') || '(no message)',
  ]
    .filter((l) => l !== false && l !== '' && l !== 0)
    .join('\n');

  window.location.href =
    `mailto:info@finlabsindia.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  note.textContent = 'Your email app should open with the message ready to send.';
  note.className = 'form__note ok';
});
