/* =====================================================
 * APPLYING FOR A ROLE
 * =====================================================
 * "Apply for this role" used to open the visitor's mail
 * client with hr@ in the To field, which meant an
 * application only arrived if the person had a working
 * mail client, remembered to attach the CV, and got the
 * subject line right.
 *
 * Now it opens a dialog. The CV goes straight to S3
 * through a presigned URL, then the application itself
 * is posted with the key. One submission, nothing to
 * remember.
 *
 * The DPDP line about 12 months is not decoration: the
 * bucket's lifecycle rule enforces it.
 * ===================================================== */

import './careers-apply.css';
import { t } from './i18n.js';
import { submitForm, uploadCv, cvUploadReady } from './forms.js';

const MAX_MB = 10;
const OK_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

let dialog = null;

function build() {
  const el = document.createElement('div');
  el.className = 'ap';
  el.innerHTML = `
    <div class="ap__sheet" role="dialog" aria-modal="true" aria-labelledby="apTitle">
      <button class="ap__close" type="button" data-ap-close aria-label="${t('Close')}">&times;</button>
      <h2 class="ap__title" id="apTitle">${t('Apply for this role')}</h2>
      <p class="ap__role" data-ap-role></p>
      <form class="ap__form" novalidate>
        <label>${t('Full name')} *<input name="name" type="text" autocomplete="name" required /></label>
        <label>${t('Email')} *<input name="email" type="email" autocomplete="email" required /></label>
        <label>${t('Phone')}<input name="phone" type="tel" autocomplete="tel" /></label>
        <label class="ap__file">
          ${t('Your CV')} *
          <input name="cv" type="file" accept=".pdf,.doc,.docx" required />
          <small>${t('PDF or Word, up to')} ${MAX_MB} MB</small>
        </label>
        <label>${t('Anything you would like us to know')}<textarea name="note" rows="3"></textarea></label>
        <p class="ap__notice">
          ${t('We use your CV only to assess you for roles at Finlabs, and keep it for 12 months. You can ask us to delete it at any time:')}
          <a href="mailto:privacy@finlabsindia.com">privacy@finlabsindia.com</a>.
        </p>
        <button class="ap__send" type="submit">${t('Send application')}</button>
        <p class="ap__note" role="status" aria-live="polite"></p>
      </form>
    </div>`;
  document.body.appendChild(el);

  const form = el.querySelector('.ap__form');
  const note = el.querySelector('.ap__note');
  const say = (msg, kind) => {
    note.textContent = msg;
    note.className = `ap__note ${kind === 'err' ? 'err' : kind === 'ok' ? 'ok' : ''}`;
  };

  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-ap-close]')) close();
  });
  document.addEventListener('keydown', onKey);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = form.elements.cv.files?.[0];

    if (!form.elements.name.value.trim()) return say(t('Please add your name.'), 'err');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.elements.email.value)) {
      return say(t('Please enter a valid email address.'), 'err');
    }
    if (!file) return say(t('Please attach your CV.'), 'err');
    if (!OK_TYPES.includes(file.type)) return say(t('Please upload a PDF or Word document.'), 'err');
    if (file.size > MAX_MB * 1024 * 1024) return say(`${t('Please keep the file under')} ${MAX_MB} MB.`, 'err');

    const role = el.querySelector('[data-ap-role]').textContent;
    const send = form.querySelector('.ap__send');
    send.setAttribute('disabled', '');

    try {
      const cv = await uploadCv({ form, file, role, say });
      await submitForm({
        form,
        formId: 'careers',
        extra: { role, cvKey: cv.key, cvName: cv.name },
        say,
        onSuccess: () => setTimeout(close, 2500),
      });
    } catch (err) {
      console.error('application failed', err);
      say(err.message || t('Something went wrong. Please try again.'), 'err');
    } finally {
      send.removeAttribute('disabled');
    }
  });

  return { el, form, say };
}

function onKey(e) {
  if (e.key === 'Escape') close();
}

function close() {
  dialog?.el.remove();
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
  dialog = null;
}

function open(role) {
  if (dialog) close();
  dialog = build();
  dialog.el.querySelector('[data-ap-role]').textContent = role;
  document.body.style.overflow = 'hidden';
  dialog.form.elements.name.focus();
}

// ---------------------------------------------------------------------
// Take over the Apply links — but only when CV upload is actually
// deployed. An application needs /cv-upload-url and a bucket behind it;
// until both exist the mailto these links already carry is better than a
// dialog that collects someone's CV and then cannot send it.
// ---------------------------------------------------------------------
if (cvUploadReady) {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.btn-apply');
    if (!link) return;
    e.preventDefault();
    const role =
      link.closest('.job')?.querySelector('h3, h2')?.textContent.trim() ||
      decodeURIComponent((link.getAttribute('href').match(/subject=([^&]*)/) || [, ''])[1])
        .replace(/^Application:\s*/, '') ||
      'General application';
    open(role);
  });
}
