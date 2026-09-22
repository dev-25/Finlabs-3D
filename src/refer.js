import './doc.css';
import './nav.css';
import './nav.js';
import './whatsapp.js';
import './refer.css';
import { initTheme } from './theme.js';

/* =====================================================
 * REFER & EARN
 * =====================================================
 * Two small jobs: the estimator that turns a contract
 * value and a rate into a number, and the form that
 * registers a referral. There is no backend on this site,
 * so the referral goes out through the visitor's own mail
 * client, the way the contact form does.
 * ===================================================== */

initTheme();

const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const trim = (s) => s.replace(/\.?0+$/, '');

function inWords(n) {
  if (n >= 1e7) return `about ₹${trim((n / 1e7).toFixed(2))} crore`;
  if (n >= 1e5) return `about ₹${trim((n / 1e5).toFixed(2))} lakh`;
  if (n >= 1e3) return `about ₹${trim((n / 1e3).toFixed(1))} thousand`;
  return rupees(n);
}

// ---------------------------------------------------------------------
// the estimator
// ---------------------------------------------------------------------

const calc = document.querySelector('#referCalc');
if (calc) {
  const deal = calc.querySelector('[name="deal"]');
  const slider = calc.querySelector('.refer__slider');
  const tier = calc.querySelector('[name="tier"]');
  const payout = calc.querySelector('[data-out="payout"]');
  const words = calc.querySelector('[data-out="words"]');
  const rows = [...document.querySelectorAll('.refer__tiers tbody tr')];

  const value = () => {
    const n = Number(deal.value);
    if (!Number.isFinite(n)) return Number(deal.defaultValue);
    return Math.min(Number(deal.max), Math.max(Number(deal.min), n));
  };

  function draw() {
    const contract = value();
    const rate = Number(tier.value);
    slider.value = String(contract);
    const earned = (contract * rate) / 100;
    payout.textContent = rupees(earned);
    words.textContent = `${trim(rate.toFixed(2))}% of ${rupees(contract)} — ${inWords(earned)}.`;
    // the row the rate belongs to lights up beside it
    rows.forEach((r) => r.classList.toggle('is-on', Number(r.dataset.tier) === rate));
  }

  slider.addEventListener('input', () => {
    deal.value = slider.value;
    draw();
  });
  deal.addEventListener('input', draw);
  deal.addEventListener('blur', () => {
    deal.value = String(value());
    draw();
  });
  tier.addEventListener('change', draw);
  calc.addEventListener('submit', (e) => e.preventDefault());
  draw();
}

// ---------------------------------------------------------------------
// the referral form — composed into an email for the team
// ---------------------------------------------------------------------

const form = document.querySelector('#referForm');
const note = document.querySelector('#referNote');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s-]{10,15}$/;

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const get = (k) => String(data.get(k) || '').trim();
  const name = get('name');
  const email = get('email');
  const phone = get('phone');
  const clientCompany = get('clientCompany');
  const clientContact = get('clientContact');
  const clientEmail = get('clientEmail');
  const clientPhone = get('clientPhone');
  const product = get('product');

  const checks = [
    [form.elements.name, Boolean(name), 'Please add your name.'],
    [form.elements.email, EMAIL_RE.test(email), 'Please enter a valid email address.'],
    [form.elements.phone, !phone || PHONE_RE.test(phone), 'Please check your phone number.'],
    [form.elements.clientCompany, Boolean(clientCompany), "Please add the firm's name."],
    [form.elements.clientContact, Boolean(clientContact), 'Please tell us who to speak to.'],
    [form.elements.clientEmail, EMAIL_RE.test(clientEmail), "Please enter a valid email address for them."],
    [form.elements.clientPhone, !clientPhone || PHONE_RE.test(clientPhone), 'Please check their phone number.'],
    [form.elements.product, Boolean(product), 'Please choose a product.'],
    [form.elements.consent, form.elements.consent.checked, 'Please confirm you have their permission to share these details.'],
  ];
  checks.forEach(([el, ok]) => el.setAttribute('aria-invalid', String(!ok)));
  const failed = checks.find(([, ok]) => !ok);
  if (failed) {
    note.textContent = failed[2];
    note.className = 'refer__note err';
    failed[0].focus();
    return;
  }

  const subject = `Referral: ${clientCompany} — from ${name}`;
  const lines = [];
  const add = (label, value) => value && lines.push(`${label}: ${value}`);

  lines.push('REFERRED BY');
  add('Name', name);
  add('Email', email);
  add('Phone', phone);
  add('Company', get('company'));
  lines.push('', 'THE FIRM');
  add('Company', clientCompany);
  add('Contact', clientContact);
  add('Email', clientEmail);
  add('Phone', clientPhone);
  add('City', get('city'));
  add('Product', product);
  lines.push('', 'NOTES', get('notes') || '(none)', '');
  lines.push('I have their permission to share these details.');
  lines.push(
    form.elements.credit.checked
      ? 'They may be told the introduction came from me.'
      : 'Please do not mention my name to them.'
  );
  const body = lines.join('\n');

  window.location.href =
    `mailto:info@finlabsindia.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  note.textContent = 'Your email app should open with the referral ready to send. We reply within two working days.';
  note.className = 'refer__note ok';
});
