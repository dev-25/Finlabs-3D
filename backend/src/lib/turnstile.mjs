/* =====================================================
 * CLOUDFLARE TURNSTILE
 * =====================================================
 * The CAPTCHA. Free with no request cap, and unlike the
 * alternatives it does not profile the visitor to decide
 * whether they are human — which matters here, because
 * the Privacy Notice we just published says analytics and
 * advertising only run on consent.
 *
 * The secret key is read once per container from SSM, not
 * baked into the function, so rotating it is a parameter
 * edit rather than a deploy.
 * ===================================================== */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});
let cached = null;

async function secret() {
  if (cached) return cached;
  const inline = process.env.TURNSTILE_SECRET;
  if (inline) return (cached = inline);

  const Name = process.env.TURNSTILE_SECRET_PARAMETER;
  if (!Name) throw new Error('No Turnstile secret configured.');
  const out = await ssm.send(new GetParameterCommand({ Name, WithDecryption: true }));
  cached = out.Parameter?.Value;
  if (!cached) throw new Error(`Turnstile secret is empty at ${Name}.`);
  return cached;
}

/**
 * Ask Cloudflare whether this token is good.
 * @param {string} token  the value of cf-turnstile-response
 * @param {string} [ip]   the visitor's IP, which sharpens Cloudflare's scoring
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function verifyTurnstile(token, ip) {
  if (!token) return { ok: false, reason: 'missing-token' };

  const body = new URLSearchParams({ secret: await secret(), response: token });
  if (ip) body.set('remoteip', ip);

  let res;
  try {
    res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Cloudflare unreachable. Fail closed: a form that accepts anything when
    // the check is down is a form with no check at all.
    return { ok: false, reason: 'verify-unreachable' };
  }

  const data = await res.json().catch(() => ({}));
  if (data.success) return { ok: true };
  return { ok: false, reason: (data['error-codes'] || ['failed']).join(',') };
}
