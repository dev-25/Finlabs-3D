/* =====================================================
 * FORM SUBMISSIONS — single file, console-pasteable
 * =====================================================
 * Paste this whole file into the Lambda console editor as
 * index.mjs. Nothing to npm install and nothing to zip:
 * the only two AWS clients it uses ship inside the Node
 * runtime, and Turnstile is checked with the built-in
 * fetch.
 *
 * This is the same job as ../src/submit.mjs, which is the
 * version SAM deploys once you have the CLI. Deploy one
 * or the other, not both.
 *
 * Order matters: the enquiry is written to DynamoDB
 * BEFORE the email is sent. If SES is throttled or an
 * address bounces, the enquiry is still saved and the
 * visitor still gets a yes. Losing a lead to a mail
 * hiccup is the failure this whole thing exists to stop.
 *
 * Environment variables (set in the console, see the
 * runbook — none of them belong in the repository):
 *
 *   TABLE_NAME                finlabs-submissions
 *   MAIL_FROM                 website@finlabsindia.com
 *   MAIL_FROM_NAME            Finlabs website
 *   MAIL_ROUTES               {"contact":["info@finlabsindia.com"], ...}
 *   TURNSTILE_SECRET          from the Cloudflare dashboard
 *   ALLOWED_ORIGIN            http://finlabs-prod-website.s3-website.ap-south-1.amazonaws.com
 *   ENQUIRY_RETENTION_MONTHS  24
 *   NOTICE_VERSION            2.0
 * ===================================================== */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ddb = new DynamoDBClient({});
const ses = new SESv2Client({});

const TABLE = process.env.TABLE_NAME;
const FROM = process.env.MAIL_FROM;
const FROM_NAME = process.env.MAIL_FROM_NAME || 'Finlabs website';
const ROUTES = JSON.parse(process.env.MAIL_ROUTES || '{}');
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const RETAIN_MONTHS = Number(process.env.ENQUIRY_RETENTION_MONTHS || 24);
const NOTICE_VERSION = process.env.NOTICE_VERSION || '2.0';
const MAX_FIELD = 4000;

// -----------------------------------------------------
// what each form is allowed to send
// -----------------------------------------------------
// Anything not listed here is dropped rather than stored. A form that
// grows a field in the HTML and not here silently loses it — which is the
// safe way round, because the alternative is storing whatever a stranger
// chooses to POST.
const req = { required: true, max: 120 };
const mail = { required: true, max: 200, email: true };
const text = { max: 4000 };
const list = { list: true, max: 1000 };

const FORMS = {
  contact: {
    subject: (f) => `Enquiry from ${f.name}${f.company ? ` — ${f.company}` : ''}`,
    fields: {
      name: { ...req, label: 'Name' },
      email: { ...mail, label: 'Email' },
      phone: { max: 40, label: 'Phone' },
      company: { max: 200, label: 'Company' },
      product: { ...list, label: 'Products' },
      solution: { ...list, label: 'Solutions' },
      service: { ...list, label: 'Services' },
      message: { ...text, label: 'Message' },
    },
  },
  solutions: {
    subject: (f) => `Demo request — ${f.solution || 'Solutions'}`,
    fields: {
      first: { ...req, label: 'First name' },
      last: { max: 120, label: 'Last name' },
      email: { ...mail, label: 'Work email' },
      phone: { max: 40, label: 'Phone' },
      org: { max: 200, label: 'Organisation' },
      solution: { max: 200, label: 'Solution' },
      message: { ...text, label: 'Message' },
    },
  },
  services: {
    subject: (f) => `Services enquiry — ${f.service || 'General'}`,
    fields: {
      name: { ...req, label: 'Name' },
      email: { ...mail, label: 'Work email' },
      company: { max: 200, label: 'Company' },
      service: { max: 200, label: 'Service' },
      message: { ...text, label: 'Message' },
    },
  },
  'learngenie-demo': {
    subject: (f) => `Learngenie live demo — ${f.name}`,
    fields: {
      name: { ...req, label: 'Name' },
      email: { ...mail, label: 'Work email' },
      phone: { max: 40, label: 'Phone' },
      size: { max: 100, label: 'Expected users' },
      note: { ...text, label: 'Message' },
    },
  },
  careers: {
    subject: (f) => `Application: ${f.role || 'General'} — ${f.name}`,
    fields: {
      name: { ...req, label: 'Name' },
      email: { ...mail, label: 'Email' },
      phone: { max: 40, label: 'Phone' },
      role: { required: true, max: 200, label: 'Role' },
      note: { ...text, label: 'Note' },
      cvKey: { max: 500, label: 'CV' },
      cvName: { max: 300, label: 'CV filename' },
    },
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(formId, raw) {
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
    if (value.length > Math.min(rule.max ?? MAX_FIELD, MAX_FIELD)) {
      return { ok: false, error: `${rule.label} is too long.` };
    }
    if (rule.email && !EMAIL_RE.test(value)) {
      return { ok: false, error: 'That email address does not look right.' };
    }
    clean[key] = value;
  }
  return { ok: true, clean };
}

/** Plain text, because that is what gets read on a phone. */
function render(formId, clean, meta) {
  const lines = [];
  for (const [key, rule] of Object.entries(FORMS[formId].fields)) {
    const v = clean[key];
    if (v == null || (Array.isArray(v) && !v.length)) continue;
    lines.push(`${rule.label}: ${Array.isArray(v) ? v.join(', ') : v}`);
  }
  lines.push('', `Marketing consent: ${meta.marketing ? 'yes' : 'no'}`, '', '—');
  lines.push(`Sent from ${meta.page || 'the website'} at ${meta.at}`);
  lines.push(`Reference: ${meta.id}`);
  return lines.join('\n');
}

// -----------------------------------------------------
// Cloudflare Turnstile
// -----------------------------------------------------
async function verifyTurnstile(token, ip) {
  if (!token) return { ok: false, reason: 'missing-token' };
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return { ok: false, reason: 'no-secret-configured' };

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);

  let res;
  try {
    res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Cloudflare unreachable. Fail closed — a form that accepts anything
    // when the check is down is a form with no check at all.
    return { ok: false, reason: 'verify-unreachable' };
  }
  const data = await res.json().catch(() => ({}));
  return data.success ? { ok: true } : { ok: false, reason: (data['error-codes'] || ['failed']).join(',') };
}

// -----------------------------------------------------
// DynamoDB without lib-dynamodb
// -----------------------------------------------------
// The DocumentClient is a separate npm package and is not guaranteed to be
// in the Lambda runtime, so the item is marshalled by hand. It is more
// typing and it means no npm install, which is the whole point here.
function av(value) {
  if (value === null || value === undefined) return { NULL: true };
  if (typeof value === 'string') return { S: value };
  if (typeof value === 'number') return { N: String(value) };
  if (typeof value === 'boolean') return { BOOL: value };
  if (Array.isArray(value)) return { L: value.map(av) };
  if (typeof value === 'object') {
    return { M: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, av(v)])) };
  }
  return { S: String(value) };
}

// -----------------------------------------------------
const headers = {
  'access-control-allow-origin': ORIGIN,
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST,OPTIONS',
  'content-type': 'application/json',
};
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod;
  if (method === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  let payload;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '{}';
    payload = JSON.parse(raw);
  } catch {
    return reply(400, { ok: false, error: 'That request was not readable.' });
  }

  const { form, fields, token, marketing, page } = payload;
  if (!FORMS[form]) return reply(400, { ok: false, error: 'Unknown form.' });

  // ---- 1. is this a person? cheap, and it rejects bots before we spend
  const ip =
    event.headers?.['cf-connecting-ip'] ||
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.requestContext?.http?.sourceIp;

  const human = await verifyTurnstile(token, ip);
  if (!human.ok) {
    console.warn('turnstile rejected', { form, reason: human.reason });
    return reply(400, {
      ok: false,
      error: 'We could not confirm you are human. Please reload the page and try again.',
    });
  }

  // ---- 2. is it well formed?
  const checked = validate(form, fields);
  if (!checked.ok) return reply(400, { ok: false, error: checked.error });

  const id = crypto.randomUUID();
  const at = new Date().toISOString();
  const meta = { id, at, marketing: Boolean(marketing), page };

  // ---- 3. keep it
  // The TTL is the Privacy Notice's 24 months, expressed as something the
  // database enforces on its own. A retention promise nobody automates is a
  // retention promise nobody keeps.
  const expiresAt = Math.floor(Date.parse(at) / 1000) + RETAIN_MONTHS * 30 * 24 * 3600;

  try {
    await ddb.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: {
          pk: { S: `${form}#${id}` },
          form: { S: form },
          id: { S: id },
          createdAt: { S: at },
          expiresAt: { N: String(expiresAt) },
          fields: av(checked.clean),
          marketingConsent: { BOOL: Boolean(marketing) },
          // DPDP: a consent record is only useful if it says what was agreed,
          // on which page, against which version of the notice, and when.
          consentRecord: av({
            at,
            page: page || null,
            noticeVersion: NOTICE_VERSION,
            ip: ip || null,
          }),
        },
      })
    );
  } catch (err) {
    console.error('dynamodb put failed', err);
    return reply(500, { ok: false, error: 'We could not save that. Please try again in a moment.' });
  }

  // ---- 4. tell someone
  const to = ROUTES[form] || ROUTES.contact || [];
  if (to.length) {
    try {
      await ses.send(
        new SendEmailCommand({
          FromEmailAddress: `${FROM_NAME} <${FROM}>`,
          Destination: { ToAddresses: to },
          ReplyToAddresses: checked.clean.email ? [checked.clean.email] : undefined,
          Content: {
            Simple: {
              Subject: { Data: FORMS[form].subject(checked.clean) },
              Body: { Text: { Data: render(form, checked.clean, meta) } },
            },
          },
        })
      );
    } catch (err) {
      // Saved but not sent. The visitor is not told, because from where they
      // stand it did work — the enquiry is safe. This line is what an alarm
      // should watch for.
      console.error('ses send failed, submission is stored', { id, form, error: String(err) });
    }
  }

  return reply(200, { ok: true, id });
};
