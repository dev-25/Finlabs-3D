/* =====================================================
 * THE FORM SCHEMAS
 * =====================================================
 * One entry per form on the website. The browser sends a
 * form id and a bag of fields; this decides what is
 * allowed, what is required, what the email says, and
 * who it goes to.
 *
 * Anything not listed here is dropped rather than
 * stored. A form that grows a field in the HTML and not
 * here will silently lose it — which is the safe way
 * round, because the alternative is storing whatever a
 * stranger chooses to POST.
 * ===================================================== */

/** @typedef {{label: string, required?: boolean, email?: boolean, max?: number}} Field */

const email = { email: true, required: true, max: 200 };
const name = { required: true, max: 120 };
const phone = { max: 40 };
const message = { max: 4000 };

/** Checkbox groups arrive as arrays; everything else as a string. */
const list = { list: true, max: 1000 };

export const FORMS = {
  contact: {
    route: 'contact',
    subject: (f) => `Enquiry from ${f.name}${f.company ? ` — ${f.company}` : ''}`,
    fields: {
      name: { ...name, label: 'Name' },
      email: { ...email, label: 'Email' },
      phone: { ...phone, label: 'Phone' },
      company: { max: 200, label: 'Company' },
      product: { ...list, label: 'Products' },
      solution: { ...list, label: 'Solutions' },
      service: { ...list, label: 'Services' },
      message: { ...message, label: 'Message' },
    },
  },

  solutions: {
    route: 'solutions',
    subject: (f) => `Demo request — ${f.solution || 'Solutions'}`,
    fields: {
      first: { ...name, label: 'First name' },
      last: { max: 120, label: 'Last name' },
      email: { ...email, label: 'Work email' },
      phone: { ...phone, label: 'Phone' },
      org: { max: 200, label: 'Organisation' },
      solution: { max: 200, label: 'Solution' },
      message: { ...message, label: 'Message' },
    },
  },

  services: {
    route: 'services',
    subject: (f) => `Services enquiry — ${f.service || 'General'}`,
    fields: {
      name: { ...name, label: 'Name' },
      email: { ...email, label: 'Work email' },
      company: { max: 200, label: 'Company' },
      service: { max: 200, label: 'Service' },
      message: { ...message, label: 'Message' },
    },
  },

  'learngenie-demo': {
    route: 'learngenie-demo',
    subject: (f) => `Learngenie live demo — ${f.name}`,
    fields: {
      name: { ...name, label: 'Name' },
      email: { ...email, label: 'Work email' },
      phone: { ...phone, label: 'Phone' },
      size: { max: 100, label: 'Expected users' },
      note: { ...message, label: 'Message' },
    },
  },

  careers: {
    route: 'careers',
    subject: (f) => `Application: ${f.role || 'General'} — ${f.name}`,
    fields: {
      name: { ...name, label: 'Name' },
      email: { ...email, label: 'Email' },
      phone: { ...phone, label: 'Phone' },
      role: { required: true, max: 200, label: 'Role' },
      note: { ...message, label: 'Note' },
      // written by the presign step, not typed by the applicant
      cvKey: { max: 500, label: 'CV' },
      cvName: { max: 300, label: 'CV filename' },
    },
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Keep only what the schema allows, and say why if it cannot be accepted.
 * @returns {{ok: true, clean: object} | {ok: false, error: string}}
 */
export function validate(formId, raw, maxFieldChars) {
  const form = FORMS[formId];
  if (!form) return { ok: false, error: 'Unknown form.' };
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'No fields were sent.' };

  const clean = {};
  for (const [key, rule] of Object.entries(form.fields)) {
    let value = raw[key];

    if (rule.list) {
      if (value == null) value = [];
      if (!Array.isArray(value)) value = [value];
      value = value.map((v) => String(v).trim()).filter(Boolean).slice(0, 40);
      if (value.join(', ').length > rule.max) return { ok: false, error: `${rule.label} is too long.` };
      if (value.length) clean[key] = value;
      continue;
    }

    value = value == null ? '' : String(value).trim();
    if (!value) {
      if (rule.required) return { ok: false, error: `${rule.label} is required.` };
      continue;
    }
    const cap = Math.min(rule.max ?? maxFieldChars, maxFieldChars);
    if (value.length > cap) return { ok: false, error: `${rule.label} is too long.` };
    if (rule.email && !EMAIL_RE.test(value)) return { ok: false, error: 'That email address does not look right.' };
    clean[key] = value;
  }
  return { ok: true, clean };
}

/** The email body: plain text, because that is what gets read on a phone. */
export function render(formId, clean, meta) {
  const form = FORMS[formId];
  const lines = [];
  for (const [key, rule] of Object.entries(form.fields)) {
    const v = clean[key];
    if (v == null || (Array.isArray(v) && !v.length)) continue;
    lines.push(`${rule.label}: ${Array.isArray(v) ? v.join(', ') : v}`);
  }
  lines.push('');
  lines.push(`Marketing consent: ${meta.marketing ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('—');
  lines.push(`Sent from ${meta.page || 'the website'} at ${meta.at}`);
  lines.push(`Reference: ${meta.id}`);
  return lines.join('\n');
}
