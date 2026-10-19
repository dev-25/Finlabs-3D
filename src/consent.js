/* =====================================================
 * COOKIE CONSENT
 * =====================================================
 * Under the DPDP Act an online identifier is personal
 * data, so analytics and advertising cannot run until
 * the visitor has said yes. This asks once, remembers
 * the answer, and lets them change it from the footer
 * or from the Privacy Notice.
 *
 * Nothing but strictly necessary cookies runs by
 * default, and declining costs the visitor nothing.
 *
 * No tags are installed on this site yet. When GA4,
 * the LinkedIn Insight Tag or the Meta pixel are added,
 * they must read `window.finlabsConsent` or listen for
 * the `finlabs:consent` event below rather than firing
 * on load — and the Consent Mode defaults set here have
 * to move into <head>, ahead of the gtag loader.
 * ===================================================== */

import './consent.css';
import { t } from './i18n.js';

const KEY = 'finlabs-consent';
const VERSION = 2; // bump when the categories or the notice change materially

/** What the visitor has agreed to. Denied until they say otherwise. */
let state = { v: VERSION, analytics: false, ads: false, ts: null };
let decided = false;

try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    // a stored answer to an older set of categories is not an answer to this one
    if (saved && saved.v === VERSION) {
      state = { ...state, ...saved };
      decided = true;
    }
  }
} catch {
  /* private window, blocked storage: ask again, store nothing */
}

window.finlabsConsent = { get: () => ({ ...state }) };

/** Google Consent Mode v2 — denied by default, updated when the visitor answers. */
function gtagConsent(mode) {
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('consent', mode, {
    ad_storage: state.ads ? 'granted' : 'denied',
    ad_user_data: state.ads ? 'granted' : 'denied',
    ad_personalization: state.ads ? 'granted' : 'denied',
    analytics_storage: state.analytics ? 'granted' : 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
  });
}
gtagConsent('default');

function save(next) {
  state = { ...state, ...next, v: VERSION, ts: new Date().toISOString() };
  decided = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* nothing we can do; the choice holds for this page view only */
  }
  gtagConsent('update');
  window.dispatchEvent(new CustomEvent('finlabs:consent', { detail: { ...state } }));
}

// -----------------------------------------------------
// the banner
// -----------------------------------------------------
let el = null;

function close() {
  el?.remove();
  el = null;
}

function build(openOnChoices) {
  close();
  el = document.createElement('div');
  el.className = 'cc';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');
  el.setAttribute('aria-labelledby', 'ccTitle');
  el.innerHTML = `
    <div class="cc__card">
      <h2 class="cc__title" id="ccTitle">${t('Cookies on this site')}</h2>
      <p class="cc__body">${t(
        'We use essential cookies to run this site. With your permission we would also like to use analytics cookies to understand how it is used, and advertising cookies to show you relevant ads.'
      )}</p>
      <div class="cc__choices" hidden>
        <label class="cc__opt">
          <input type="checkbox" data-cc="essential" checked disabled />
          <span><b>${t('Strictly necessary')}</b>${t('Remembers your language and theme. The site cannot work without them.')}</span>
        </label>
        <label class="cc__opt">
          <input type="checkbox" data-cc="analytics" />
          <span><b>${t('Analytics')}</b>${t('How many people visit, and which pages they read.')}</span>
        </label>
        <label class="cc__opt">
          <input type="checkbox" data-cc="ads" />
          <span><b>${t('Advertising')}</b>${t('Lets us measure our ads and show you relevant ones elsewhere.')}</span>
        </label>
      </div>
      <div class="cc__acts">
        <button class="cc__btn cc__btn--primary" type="button" data-cc-act="all">${t('Accept all')}</button>
        <button class="cc__btn" type="button" data-cc-act="none">${t('Reject non-essential')}</button>
        <button class="cc__btn cc__btn--quiet" type="button" data-cc-act="choose">${t('Choose')}</button>
        <button class="cc__btn cc__btn--primary" type="button" data-cc-act="save" hidden>${t('Save my choices')}</button>
      </div>
      <p class="cc__note">${t('Read our')} <a href="${root()}privacy.html#cookies">${t('Privacy Notice')}</a>.</p>
    </div>`;
  document.body.appendChild(el);

  const choices = el.querySelector('.cc__choices');
  const boxes = {
    analytics: el.querySelector('[data-cc="analytics"]'),
    ads: el.querySelector('[data-cc="ads"]'),
  };
  boxes.analytics.checked = state.analytics;
  boxes.ads.checked = state.ads;

  function showChoices() {
    choices.hidden = false;
    el.querySelector('[data-cc-act="choose"]').hidden = true;
    el.querySelector('[data-cc-act="save"]').hidden = false;
  }
  if (openOnChoices) showChoices();

  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-cc-act]')?.dataset.ccAct;
    if (!act) return;
    if (act === 'choose') return showChoices();
    if (act === 'all') save({ analytics: true, ads: true });
    if (act === 'none') save({ analytics: false, ads: false });
    if (act === 'save') save({ analytics: boxes.analytics.checked, ads: boxes.ads.checked });
    close();
  });
}

/** Pages sit at the root and one level down, so links need the right prefix. */
function root() {
  const depth = window.location.pathname.replace(/^\/|\/$/g, '').split('/').length - 1;
  return '../'.repeat(Math.max(0, depth));
}

// anything with [data-cookie-settings] reopens the panel, wherever it is
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-cookie-settings]')) return;
  e.preventDefault();
  build(true);
});

if (!decided) build(false);
