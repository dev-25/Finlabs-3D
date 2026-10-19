/* =====================================================
 * FORM SUBMISSION
 * =====================================================
 * Every form on the site goes through here: a POST to
 * the API, which stores the enquiry and emails it on.
 *
 * No third-party bot check. Instead each form carries a
 * honeypot field and the time it rendered, and the
 * Lambda reads both. The honeypot is positioned off
 * screen and hidden from assistive technology, so a
 * person never meets it and a bot parsing the HTML fills
 * it like any other input.
 *
 * Three things this has to get right, because a lost
 * enquiry is a lost customer:
 *
 *   - the button is disabled while in flight, so one
 *     impatient double-click is not two leads
 *   - a failure says what to do next, and the typed
 *     message is still sitting in the form
 *   - if the API is not configured yet, the form falls
 *     back to the old mailto rather than swallowing
 *     what someone just wrote
 * ===================================================== */

import { t } from './i18n.js';

/** Injected at build time from backend.config.json — see vite.config.js. */
const CFG = typeof __BACKEND__ !== 'undefined' ? __BACKEND__ : { apiBaseUrl: '', cvUploads: false };

export const backendReady = Boolean(CFG.apiBaseUrl);

/** CV upload is a separate endpoint, and may not be deployed yet. */
export const cvUploadReady = Boolean(CFG.apiBaseUrl && CFG.cvUploads);

// ---------------------------------------------------------------------
// the quiet bot check
// ---------------------------------------------------------------------

/**
 * Add the honeypot and the clock to a form, once.
 *
 * The field is named something a bot would want to fill. It is pushed off
 * screen rather than display:none, because some bots skip fields that are
 * not rendered, and it carries aria-hidden and tabindex=-1 so no person
 * using a keyboard or a screen reader can land on it.
 */
function arm(form) {
  if (form.__armed) return;
  form.__armed = true;

  const trap = document.createElement('div');
  trap.setAttribute('aria-hidden', 'true');
  trap.style.cssText =
    'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden';
  trap.innerHTML =
    '<label>Website<input type="text" name="_trap" tabindex="-1" autocomplete="off" /></label>';
  form.appendChild(trap);

  form.__renderedAt = Date.now();
}

/** Arm every form on the page. Cheap, so it runs on load. */
export function armForms(root = document) {
  for (const form of root.querySelectorAll('form')) arm(form);
}

// ---------------------------------------------------------------------
// submitting
// ---------------------------------------------------------------------

/** Pages sit at the root and one level down, so links need the right prefix. */
function siteRoot() {
  const depth = location.pathname.replace(/^\/|\/$/g, '').split('/').length - 1;
  return '../'.repeat(Math.max(0, depth));
}

/** FormData → a plain object, with repeated names collected into arrays. */
export function readForm(form) {
  const out = {};
  for (const [k, v] of new FormData(form).entries()) {
    if (v instanceof File) continue;
    if (k === '_trap') continue; // travels separately, not as a field
    if (k in out) out[k] = Array.isArray(out[k]) ? [...out[k], v] : [out[k], v];
    else out[k] = v;
  }
  return out;
}

/** A trailing slash in the configured URL would make this `//submit`. */
const API = (CFG.apiBaseUrl || '').replace(/\/+$/, '');

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || t('Something went wrong. Please try again.'));
  return data;
}

/**
 * Send a form.
 * @param {object} o
 * @param {HTMLFormElement} o.form
 * @param {string} o.formId      which schema the Lambda should use
 * @param {object} [o.extra]     fields the form element does not hold
 * @param {(msg: string, kind: 'ok'|'err'|'busy') => void} o.say
 * @param {() => void} [o.onSuccess]
 * @param {() => void} [o.fallback]  used when the API is not configured yet
 */
export async function submitForm({ form, formId, extra = {}, say, onSuccess, fallback }) {
  if (!backendReady) return fallback?.();

  arm(form); // in case this form was added to the page after load
  const button = form.querySelector('[type="submit"]');
  const fields = { ...readForm(form), ...extra };
  const marketing = Boolean(fields.marketing);
  delete fields.marketing;

  button?.setAttribute('disabled', '');
  say(t('Sending…'), 'busy');

  try {
    const { id } = await post('/submit', {
      form: formId,
      fields,
      trap: form.elements._trap?.value || '',
      renderedAt: form.__renderedAt,
      marketing,
      page: location.pathname,
    });
    form.reset();

    // A confirmation with its own URL is what makes the conversion countable —
    // analytics cannot see a message that only changed some text in place.
    // Forms embedded in something else (the game modal, the application
    // dialog) pass onSuccess and keep their own confirmation instead, because
    // throwing someone out of a game to say thank you is not a thank you.
    if (onSuccess) {
      say(t('Thank you — we have your message and will be in touch within one working day.'), 'ok');
      onSuccess(id);
    } else {
      location.assign(`${siteRoot()}thank-you.html?form=${encodeURIComponent(formId)}`);
    }
  } catch (err) {
    console.error('form submit failed', err);
    say(err.message || t('Something went wrong. Please try again.'), 'err');
  } finally {
    button?.removeAttribute('disabled');
  }
}

/**
 * Upload a CV straight to S3, then return the key to attach to the
 * application. The file never touches our API: it is too big for the
 * gateway and there is no reason to pay to pass it through.
 */
export async function uploadCv({ form, file, role, say }) {
  arm(form);
  say(t('Uploading your CV…'), 'busy');
  const { url, key } = await post('/cv-upload-url', {
    filename: file.name,
    contentType: file.type,
    size: file.size,
    role,
    trap: form.elements._trap?.value || '',
    renderedAt: form.__renderedAt,
  });
  const put = await fetch(url, { method: 'PUT', headers: { 'content-type': file.type }, body: file });
  if (!put.ok) throw new Error(t('We could not upload that file. Please try again.'));
  return { key, name: file.name };
}
