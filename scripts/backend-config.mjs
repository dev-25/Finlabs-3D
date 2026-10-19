#!/usr/bin/env node
/* =====================================================
 * backend.config.json  →  everything that needs it
 * =====================================================
 *   node scripts/backend-config.mjs check    validate it
 *   node scripts/backend-config.mjs params   SAM parameter overrides
 *
 * The point of the single file is that a table name
 * exists in exactly one place. This is what reads it, so
 * the template, the Lambdas and the browser bundle all
 * agree without anyone retyping anything.
 * ===================================================== */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_PATH = resolve(ROOT, 'backend.config.json');

export function loadConfig() {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  // strip the $comment keys so they never reach a bundle or a parameter
  const strip = (v) =>
    Array.isArray(v)
      ? v.map(strip)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== '$comment').map(([k, x]) => [k, strip(x)]))
        : v;
  return strip(raw);
}

/** What the browser is allowed to know. Everything else stays server-side. */
export function publicConfig(cfg = loadConfig()) {
  return { apiBaseUrl: cfg.public.apiBaseUrl || '', turnstileSiteKey: cfg.public.turnstileSiteKey || '' };
}

/* What the stack needs before it can be deployed. */
const REQUIRED_DEPLOY = [
  ['aws.region', 'the AWS region'],
  ['aws.stackName', 'the CloudFormation stack name'],
  ['aws.submissionsTableName', 'the DynamoDB table name'],
  ['aws.cvBucketName', 'the S3 bucket CVs go to'],
  ['email.from', 'the SES-verified From address'],
];

/* What the browser needs before the forms stop falling back to mailto.
   apiBaseUrl is not in the deploy list because it comes OUT of the first
   deploy — requiring it to deploy would be circular. */
const REQUIRED_SITE = [
  ['public.apiBaseUrl', 'the API URL from the stack output'],
  ['public.turnstileSiteKey', 'the Turnstile site key from the Cloudflare dashboard'],
];

const REQUIRED = [...REQUIRED_SITE, ...REQUIRED_DEPLOY];

/** Has anyone started? The bucket name has to be chosen by hand, so it is the
 *  honest sentinel for "this has been set up" versus "this is still the
 *  template as committed". */
export const isStarted = (cfg = loadConfig()) => Boolean(cfg.aws?.cvBucketName);

const dig = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

export function check(cfg = loadConfig(), scope = 'all') {
  const list = scope === 'deploy' ? REQUIRED_DEPLOY : scope === 'site' ? REQUIRED_SITE : REQUIRED;
  const missing = list.filter(([p]) => {
    const v = dig(cfg, p);
    return v === undefined || v === null || v === '';
  });
  if (scope !== 'site') {
    const routes = Object.entries(cfg.email?.routes || {});
    if (!routes.length) missing.push(['email.routes', 'at least one recipient list']);
  }
  return missing;
}

/** `sam deploy --parameter-overrides` wants Key=Value pairs. */
export function params(cfg = loadConfig()) {
  const months = cfg.retention?.cvMonths ?? 12;
  return {
    SubmitFunctionName: cfg.aws.submitFunctionName,
    CvUploadUrlFunctionName: cfg.aws.cvUploadUrlFunctionName,
    SubmissionsTableName: cfg.aws.submissionsTableName,
    CvBucketName: cfg.aws.cvBucketName,
    CvPrefix: cfg.aws.cvPrefix,
    TurnstileSecretParameter: cfg.aws.turnstileSecretParameter,
    MailFrom: cfg.email.from,
    MailFromName: cfg.email.fromName,
    MailRoutes: JSON.stringify(cfg.email.routes),
    AllowedOrigin: cfg.public.siteOrigin || process.env.SITE_ORIGIN || 'https://finlabsindia.com',
    MaxFieldChars: cfg.limits.maxFieldChars,
    MaxCvBytes: cfg.limits.maxCvBytes,
    CvContentTypes: cfg.limits.cvContentTypes.join(','),
    EnquiryRetentionMonths: cfg.retention?.enquiryMonths ?? 24,
    // the template wants days; the config is written in months, like the notice
    CvRetentionDays: Math.round(months * 30.44),
  };
}

// --------------------------------------------------------------------- CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const cmd = process.argv[2] || 'check';
  const cfg = loadConfig();

  if (cmd === 'started') {
    // exit 0 when there is something to deploy, 1 when the file is untouched
    process.exit(isStarted(cfg) ? 0 : 1);
  }

  if (cmd === 'check') {
    const scope = process.argv[3]?.replace(/^--/, '') || 'all';
    const missing = check(cfg, scope);
    if (!missing.length) {
      console.log('backend.config.json looks complete.');
      process.exit(0);
    }
    console.error('backend.config.json still needs:\n');
    for (const [path, what] of missing) console.error(`  ${path.padEnd(28)} ${what}`);
    console.error('\nSee backend/README.md for where each value comes from.');
    process.exit(1);
  }

  if (cmd === 'params') {
    console.log(
      Object.entries(params(cfg))
        .map(([k, v]) => `${k}='${String(v).replace(/'/g, `'\\''`)}'`)
        .join(' ')
    );
    process.exit(0);
  }

  console.error(`Unknown command '${cmd}'. Try: check [--deploy|--site] | params | started`);
  process.exit(1);
}
