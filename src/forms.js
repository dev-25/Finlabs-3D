/* =====================================================
 * FORM SUBMISSION
 * =====================================================
 * Every form on the site goes through here: Turnstile
 * for the bot check, then a POST to the API, which
 * stores the enquiry and emails it on.
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
const CFG = typeof __BACKEND__ !== 'undefined' ? __BACKEND__ : { apiBaseUrl: '', turnstileSiteKey: '' };

export const backendReady = Boolean(CFG.apiBaseUrl && CFG.turnstileSiteKey);

// ---------------------------------------------------------------------
// Turnstile
// ---------------------------------------------------------------------
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TURNSTILE_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => reject(new Error('turnstile failed to load'));
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Put an invisible Turnstile widget in the form and keep its token fresh.
 * Managed mode: most people see nothing, and the ones Cloudflare is unsure
 * about get a single checkbox rather than a street-sign puzzle.
 */
async function mountTurnstile(form) {
  if (form.__turnstile) return form.__turnstile;

  const host = document.createElement('div');
  host.className = 'cf-turnstile';
  // above the button, below the last field — where a person looks last
  const submit = form.querySelector('[type="submit"]');
  submit ? submit.before(host) : form.appendChild(host);

  const api = await loadTurnstile();
  const id = api.render(host, {
    sitekey: CFG.turnstileSiteKey,
    theme: 'auto',
    size: 'flexible',
    action: form.id || 'form',
  });
  form.__turnstile = { api, id, host };
  return form.__turnstile;
}

/**
 * Load Cloudflare the moment someone starts filling a form in, not on page
 * load and not at submit: by page load it is a third-party script on every
 * view for no reason, and by submit the person is left waiting on a checkbox
 * after they already pressed Send.
 */
export function armForms(root = document) {
  if (!backendReady) return;
  for (const form of root.querySelectorAll('form')) {
    form.addEventListener('focusin', () => mountTurnstile(form).catch(() => {}), { once: true });
  }
}

/** A token is good for one submission; after a failure it has to be reset. */
async function token(form) {
  const w = await mountTurnstile(form);
  const existing = w.api.getResponse(w.id);
  if (existing) return existing;
  // not solved yet (or already spent) — run it and wait
  w.api.reset(w.id);
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = setInterval(() => {
      const r = w.api.getResponse(w.id);
      if (r) { clearInterval(poll); resolve(r); }
      else if (Date.now() - started > 30000) { clearInterval(poll); reject(new Error('turnstile timed out')); }
    }, 250);
  });
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
    if (k in out) out[k] = Array.isArray(out[k]) ? [...out[k], v] : [out[k], v];
    else out[k] = v;
  }
  return out;
}

async function post(path, body) {
  const res = await fetch(`${CFG.apiBaseUrl}${path}`, {
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

  const button = form.querySelector('[type="submit"]');
  const fields = { ...readForm(form), ...extra };
  const marketing = Boolean(fields.marketing);
  delete fields.marketing;

  button?.setAttribute('disabled', '');
  say(t('Sending…'), 'busy');

  try {
    const cfToken = await token(form);
    const { id } = await post('/submit', {
      form: formId,
      fields,
      token: cfToken,
      marketing,
      page: location.pathname,
    });
    form.reset();
    form.__turnstile?.api.reset(form.__turnstile.id);

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
    form.__turnstile?.api.reset(form.__turnstile.id);
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
  say(t('Uploading your CV…'), 'busy');
  const cfToken = await token(form);
  const { url, key } = await post('/cv-upload-url', {
    filename: file.name,
    contentType: file.type,
    size: file.size,
    role,
    token: cfToken,
  });
  const put = await fetch(url, { method: 'PUT', headers: { 'content-type': file.type }, body: file });
  if (!put.ok) throw new Error(t('We could not upload that file. Please try again.'));
  // the token was spent on the presign; the application POST needs a fresh one
  form.__turnstile?.api.reset(form.__turnstile.id);
  return { key, name: file.name };
}
