/* =====================================================
 * POST /cv-upload-url
 * =====================================================
 * Hands the browser a short-lived URL it can PUT a CV
 * straight to S3 with.
 *
 * The file never passes through API Gateway or Lambda,
 * which is not only cheaper but necessary: API Gateway
 * caps a request at 10 MB and Lambda at 6 MB, and a CV
 * with a portfolio in it clears both.
 *
 * Turnstile runs here too. Without it this endpoint is a
 * free, anonymous write handle on the bucket.
 * ===================================================== */

import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { verifyTurnstile } from './lib/turnstile.mjs';

const s3 = new S3Client({});

const BUCKET = process.env.CV_BUCKET;
const PREFIX = process.env.CV_PREFIX || 'applications/';
const MAX_BYTES = Number(process.env.MAX_CV_BYTES || 10 * 1024 * 1024);
const TYPES = (process.env.CV_CONTENT_TYPES || '').split(',').filter(Boolean);
const URL_TTL = 300; // five minutes is long enough to upload and short enough to matter

const CORS = {
  'access-control-allow-origin': process.env.ALLOWED_ORIGIN || '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST,OPTIONS',
  'content-type': 'application/json',
};
const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

/** Keep the applicant's filename recognisable without letting it steer the path. */
function safeName(raw) {
  return String(raw || 'cv')
    .split(/[\\/]/).pop()
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '-')
    .slice(-120) || 'cv';
}

export async function handler(event) {
  if (event.requestContext?.http?.method === 'OPTIONS') return reply(204, {});

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { ok: false, error: 'That request was not readable.' });
  }

  const { filename, contentType, size, token, role } = payload;

  const ip = event.headers?.['cf-connecting-ip'] || event.requestContext?.http?.sourceIp;
  const human = await verifyTurnstile(token, ip);
  if (!human.ok) {
    console.warn('turnstile rejected on cv-upload-url', { reason: human.reason });
    return reply(400, { ok: false, error: 'We could not confirm you are human. Please reload and try again.' });
  }

  if (TYPES.length && !TYPES.includes(contentType)) {
    return reply(400, { ok: false, error: 'Please upload a PDF or Word document.' });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return reply(400, { ok: false, error: `Please keep the file under ${Math.round(MAX_BYTES / 1048576)} MB.` });
  }

  // applications/2026/10/<uuid>/Priya-Sharma-CV.pdf — sorts by month, never collides
  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const key = `${PREFIX}${folder}/${randomUUID()}/${safeName(filename)}`;

  try {
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
        // signed into the URL, so the browser cannot swap it for something else
        ContentLength: size,
        Metadata: { role: String(role || '').slice(0, 200) },
      }),
      { expiresIn: URL_TTL }
    );
    return reply(200, { ok: true, url, key, expiresIn: URL_TTL });
  } catch (err) {
    console.error('presign failed', err);
    return reply(500, { ok: false, error: 'We could not start the upload. Please try again.' });
  }
}
