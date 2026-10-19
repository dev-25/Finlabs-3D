/* =====================================================
 * FORM SUBMISSIONS — single file, console-pasteable
 * =====================================================
 * NO THIRD PARTY. No Cloudflare, no Google. The bot
 * defence is three checks inside this function:
 *
 *   1. a honeypot field a human never sees and a naive
 *      bot always fills
 *   2. a minimum time between the form rendering and
 *      being submitted — scripts post instantly
 *   3. a per-IP rate limit held in the same table
 *
 * Together these stop the overwhelming majority of form
 * spam. They are NOT a CAPTCHA and will not stop someone
 * who targets this form deliberately. The honest fix for
 * that is AWS WAF with its CAPTCHA action, which needs
 * CloudFront or an API Gateway REST API in front — see
 * the runbook. Until then this is the proportionate
 * answer, and it costs nothing.
 *
 * Paste this whole file into the Lambda console editor as
 * index.mjs. Nothing to npm install and nothing to zip:
 * the only two AWS clients it uses ship inside the Node
 * runtime.
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
 *   NOTIFY                    sns | ses   (how the email goes out)
 *   SNS_TOPIC_ARN             arn:aws:sns:ap-south-1:…:finlabs-form-submissions
 *   MAX_PER_IP_PER_HOUR       5
 *   SES_CONFIGURATION_SET     finlabs-website   (optional, see runbook)
 *   ENQUIRY_RETENTION_MONTHS  24
 *   NOTICE_VERSION            2.0
 * ===================================================== */

import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const ddb = new DynamoDBClient({});

// Both clients are created but only the configured one is ever called, so
// the unused one costs nothing but a few milliseconds of cold start.
const ses = new SESv2Client({});
const sns = new SNSClient({});

const TABLE = process.env.TABLE_NAME;
const FROM = process.env.MAIL_FROM;
const FROM_NAME = process.env.MAIL_FROM_NAME || 'Finlabs website';
const ROUTES = JSON.parse(process.env.MAIL_ROUTES || '{}');
const RETAIN_MONTHS = Number(process.env.ENQUIRY_RETENTION_MONTHS || 24);
const NOTIFY = (process.env.NOTIFY || 'sns').toLowerCase();
const SNS_TOPIC = process.env.SNS_TOPIC_ARN;
const MAX_PER_IP = Number(process.env.MAX_PER_IP_PER_HOUR || 5);
// Optional, and worth setting on a shared SES account: it keeps this site's
// bounces and complaints in their own bucket instead of mixed into whatever
// else the account sends.
const SES_CONFIG_SET = process.env.SES_CONFIGURATION_SET || undefined;
const MIN_FILL_SECONDS = 3;
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
// Bot defence, without a third party
// -----------------------------------------------------

/**
 * 1. The honeypot. The form carries a field positioned off-screen and
 *    marked so assistive technology ignores it. A person never sees it and
 *    so never fills it; a bot parsing the HTML fills every input it finds.
 *
 * 2. The clock. The form records when it rendered. A person takes seconds
 *    at least; a script posts the moment it has parsed the page.
 *
 * Both are silent on failure. A bot that is told why it was rejected is a
 * bot that gets fixed, so this returns the same cheerful 200 a real
 * submission gets and simply does not store or send anything.
 */
function looksAutomated({ trap, renderedAt }) {
  if (trap) return 'honeypot';
  const started = Number(renderedAt);
  if (!Number.isFinite(started)) return 'no-timestamp';
  const seconds = (Date.now() - started) / 1000;
  if (seconds < MIN_FILL_SECONDS) return `too-fast:${seconds.toFixed(1)}s`;
  if (seconds > 24 * 3600) return 'stale-page';
  return null;
}

/**
 * 3. The rate limit. A counter per IP per hour, in the same table, written
 *    with ADD so two simultaneous requests cannot both read zero. The row
 *    expires on the table's own TTL, so nothing has to clean it up.
 *
 * This is the check that protects the bill rather than the inbox: without
 * it one script can invoke this function as fast as it likes.
 */
async function withinRateLimit(ip) {
  if (!ip) return true;
  const hour = new Date().toISOString().slice(0, 13); // 2026-10-19T15
  try {
    const out = await ddb.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: { pk: { S: `rate#${ip}#${hour}` } },
        UpdateExpression: 'ADD #n :one SET expiresAt = :exp',
        ExpressionAttributeNames: { '#n': 'count' },
        ExpressionAttributeValues: {
          ':one': { N: '1' },
          ':exp': { N: String(Math.floor(Date.now() / 1000) + 7200) },
        },
        ReturnValues: 'UPDATED_NEW',
      })
    );
    return Number(out.Attributes?.count?.N || 0) <= MAX_PER_IP;
  } catch (err) {
    // The counter failing is not a reason to refuse a real customer.
    console.error('rate limit check failed, allowing', String(err));
    return true;
  }
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
// NO CORS HEADERS HERE, deliberately.
//
// The Function URL's own CORS configuration adds them. If this function
// adds them too, the response carries access-control-allow-origin twice,
// the browser rejects it as malformed, and fetch() throws — while the
// enquiry was stored and the email sent perfectly well. The symptom is
// "Load failed" in Safari, or a CORS error in Chrome, on a request the
// server handled successfully. It cost an evening once.
//
// CORS lives in one place: Lambda → Configuration → Function URL → CORS.
// That is also where it has to change when the site moves to
// https://finlabsindia.com.
const headers = { 'content-type': 'application/json' };
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

export const handler = async (event) => {
  // Preflight never reaches here: the Function URL answers OPTIONS itself
  // when CORS is configured on it. Kept only so a misconfigured URL fails
  // visibly rather than running the whole handler on an OPTIONS request.
  const method = event?.requestContext?.http?.method || event?.httpMethod;
  if (method === 'OPTIONS') return { statusCode: 204, headers: {}, body: '' };

  let payload;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '{}';
    payload = JSON.parse(raw);
  } catch {
    return reply(400, { ok: false, error: 'That request was not readable.' });
  }

  const { form, fields, trap, renderedAt, marketing, page } = payload;
  if (!FORMS[form]) return reply(400, { ok: false, error: 'Unknown form.' });

  const ip =
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.requestContext?.http?.sourceIp;

  // ---- 1a. does this look automated?
  // Answered with a 200 and an id that leads nowhere. Telling a bot why it
  // failed is how bots get fixed.
  const automated = looksAutomated({ trap, renderedAt });
  if (automated) {
    console.warn('dropped as automated', { form, reason: automated, ip });
    return reply(200, { ok: true, id: crypto.randomUUID() });
  }

  // ---- 1b. has this address had enough for one hour?
  // This one does say no, because a real person hitting the limit needs to
  // understand why nothing happened.
  if (!(await withinRateLimit(ip))) {
    console.warn('rate limited', { form, ip });
    return reply(429, {
      ok: false,
      error: 'That is several messages in a short time. Please try again in an hour, or email info@finlabsindia.com.',
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
  //
  // SNS works the moment the topic exists; SES needs a verified domain and
  // production access, which take a day. So SNS is the default and SES is
  // one environment variable away once it is ready.
  //
  // The difference that matters day to day: SES sets Reply-To to the person
  // who filled the form, so hitting reply in the inbox answers them. SNS
  // cannot, so with SNS you copy the address out of the message.
  const subject = FORMS[form].subject(checked.clean);
  const body = render(form, checked.clean, meta);

  try {
    if (NOTIFY === 'ses') {
      const to = ROUTES[form] || ROUTES.contact || [];
      if (to.length) {
        await ses.send(
          new SendEmailCommand({
            FromEmailAddress: `${FROM_NAME} <${FROM}>`,
            Destination: { ToAddresses: to },
            ReplyToAddresses: checked.clean.email ? [checked.clean.email] : undefined,
            ConfigurationSetName: SES_CONFIG_SET,
            Content: {
              Simple: {
                Subject: { Data: subject },
                Body: { Text: { Data: body } },
              },
            },
          })
        );
      }
    } else if (SNS_TOPIC) {
      await sns.send(
        new PublishCommand({
          TopicArn: SNS_TOPIC,
          // SNS truncates the subject at 100 characters and rejects newlines
          Subject: subject.replace(/\s+/g, ' ').slice(0, 99),
          Message: body,
        })
      );
    } else {
      console.error('no notification channel configured', { NOTIFY, hasTopic: Boolean(SNS_TOPIC) });
    }
  } catch (err) {
    // Saved but not sent. The visitor is not told, because from where they
    // stand it did work — the enquiry is safe. This line is what an alarm
    // should watch for.
    console.error('notification failed, submission is stored', { id, form, via: NOTIFY, error: String(err) });
  }

  return reply(200, { ok: true, id });
};
