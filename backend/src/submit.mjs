/* =====================================================
 * POST /submit
 * =====================================================
 * Every form on the website ends up here. The order
 * matters:
 *
 *   1. verify the Turnstile token   (cheap, rejects bots
 *      before we spend anything on them)
 *   2. validate against the schema
 *   3. write to DynamoDB            (the record of truth)
 *   4. send the email               (the notification)
 *
 * Three before four on purpose: if SES is throttled or
 * the address bounces, the enquiry is still saved and
 * the visitor still gets a yes. Losing a lead to a mail
 * hiccup is the failure this whole exercise exists to
 * stop.
 * ===================================================== */

import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

import { validate, render, FORMS } from './lib/forms.mjs';
import { verifyTurnstile } from './lib/turnstile.mjs';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const ses = new SESv2Client({});

const TABLE = process.env.TABLE_NAME;
const FROM = process.env.MAIL_FROM;
const FROM_NAME = process.env.MAIL_FROM_NAME || 'Finlabs website';
const ROUTES = JSON.parse(process.env.MAIL_ROUTES || '{}');
const MAX_FIELD = Number(process.env.MAX_FIELD_CHARS || 4000);
const RETAIN_MONTHS = Number(process.env.ENQUIRY_RETENTION_MONTHS || 24);

const CORS = {
  'access-control-allow-origin': process.env.ALLOWED_ORIGIN || '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST,OPTIONS',
  'content-type': 'application/json',
};

const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.requestContext?.http?.method === 'OPTIONS') return reply(204, {});

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { ok: false, error: 'That request was not readable.' });
  }

  const { form, fields, token, marketing, page } = payload;
  if (!FORMS[form]) return reply(400, { ok: false, error: 'Unknown form.' });

  // ---- 1. is this a person?
  const ip = event.headers?.['cf-connecting-ip'] || event.requestContext?.http?.sourceIp;
  const human = await verifyTurnstile(token, ip);
  if (!human.ok) {
    console.warn('turnstile rejected', { form, reason: human.reason });
    return reply(400, {
      ok: false,
      error: 'We could not confirm you are human. Please reload the page and try again.',
    });
  }

  // ---- 2. is it well formed?
  const checked = validate(form, fields, MAX_FIELD);
  if (!checked.ok) return reply(400, { ok: false, error: checked.error });

  const id = randomUUID();
  const at = new Date().toISOString();
  const meta = { id, at, marketing: Boolean(marketing), page };

  // ---- 3. keep it
  // The TTL is the Privacy Notice's 24 months, expressed as something the
  // database enforces on its own. A retention promise nobody automates is a
  // retention promise nobody keeps.
  const expiresAt = Math.floor(Date.parse(at) / 1000) + RETAIN_MONTHS * 30 * 24 * 3600;

  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: `${form}#${id}`,
          form,
          id,
          createdAt: at,
          expiresAt,
          fields: checked.clean,
          marketingConsent: Boolean(marketing),
          // DPDP: a consent record is only useful if it says what was agreed, when
          consentRecord: {
            at,
            page: page || null,
            noticeVersion: process.env.NOTICE_VERSION || '2.0',
            ip: ip || null,
          },
        },
      })
    );
  } catch (err) {
    console.error('dynamodb put failed', err);
    return reply(500, { ok: false, error: 'We could not save that. Please try again in a moment.' });
  }

  // ---- 4. tell someone
  const to = ROUTES[FORMS[form].route] || ROUTES.contact || [];
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
      // stand it did work — the enquiry is safe. This line is what the alarm
      // watches for.
      console.error('ses send failed, submission is stored', { id, form, err });
    }
  }

  return reply(200, { ok: true, id });
}
