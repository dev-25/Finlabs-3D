# Website backend

Every form on the site posts here. The enquiry is stored in DynamoDB and emailed
on; CVs go straight to S3. Cloudflare Turnstile keeps bots out.

```
browser ──Turnstile token──▶ POST /submit ──▶ Lambda ──┬──▶ DynamoDB  (the record)
                                                        └──▶ SES       (the email)

careers ──▶ POST /cv-upload-url ──▶ presigned URL ──▶ browser PUTs the CV ──▶ S3
         └─▶ then POST /submit with the S3 key
```

**Everything you edit lives in one file: [`../backend.config.json`](../backend.config.json).**
Resource names, recipients, limits and retention all come from there — the
template, the Lambdas and the browser bundle read it so nothing is typed twice.

`npm run backend:check` tells you what is still blank.

---

## One-time setup

### 1. Cloudflare Turnstile (the CAPTCHA — free, no request cap)

1. <https://dash.cloudflare.com> → **Turnstile** → **Add widget**.
2. Hostnames: `finlabsindia.com`, `www.finlabsindia.com`, and `localhost` for testing.
3. Widget mode: **Managed**.
4. Copy the **site key** into `backend.config.json` → `public.turnstileSiteKey`.
5. Put the **secret key** in AWS, never in this repo:

```bash
aws ssm put-parameter \
  --name /finlabs/web/turnstile-secret \
  --type SecureString \
  --value 'PASTE_THE_SECRET_KEY' \
  --region ap-south-1
```

### 2. SES — so the mail actually sends

SES starts in **sandbox mode**, where it will only send to addresses you have
verified. That is fine for testing and useless in production, so request
production access on day one — approval takes a day or so.

```bash
# verify the domain you send as (then add the DNS records it prints)
aws sesv2 create-email-identity --email-identity finlabsindia.com --region ap-south-1

# while in the sandbox, verify each recipient too
aws sesv2 create-email-identity --email-identity info@finlabsindia.com --region ap-south-1
aws sesv2 create-email-identity --email-identity hr@finlabsindia.com   --region ap-south-1
```

Then: SES console → **Account dashboard** → **Request production access**.

> Set up DKIM when you verify the domain. Mail from a new domain with no DKIM
> lands in spam, and an enquiry in the spam folder is the problem we started with.

### 3. Fill in the config

| Field | Where it comes from |
|---|---|
| `aws.cvBucketName` | pick a globally unique name, e.g. `finlabs-applications-prod` |
| `public.turnstileSiteKey` | the Cloudflare dashboard, step 1 |
| `public.apiBaseUrl` | the stack output, after the first deploy |

### 4. Deploy

```bash
cd backend && npm install && cd ..
npm run backend:check     # must pass apart from apiBaseUrl on the first run
npm run backend:deploy
```

First run only, to set the region and stack name:

```bash
cd backend && sam deploy --guided
```

The stack prints `ApiBaseUrl`. Paste it into `backend.config.json` →
`public.apiBaseUrl`, then rebuild the site so the browser knows where to post:

```bash
npm run build
```

> **Using a bucket that already exists?** Set `CreateCvBucket=no` in the deploy
> parameters. The stack will use it, but it will not get the CORS rule or the
> 12-month expiry automatically — set both by hand, or the browser upload fails
> and the retention promise in the Privacy Notice goes unkept.

---

## What gets stored

One row per submission in `finlabs-submissions`:

```jsonc
{
  "pk": "contact#0f0c…",          // partition key
  "form": "contact",               // GSI by-form, newest first
  "createdAt": "2026-10-19T…Z",
  "expiresAt": 1792…,              // DynamoDB TTL — deletes itself at 24 months
  "fields": { "name": "…", "email": "…", "message": "…" },
  "marketingConsent": false,
  "consentRecord": { "at": "…", "page": "/contact.html", "noticeVersion": "2.0", "ip": "…" }
}
```

`consentRecord` is there because the DPDP Act wants consent to be demonstrable:
what was agreed, on which page, against which version of the notice, and when.

**Retention enforces itself.** The TTL on the table is the Privacy Notice's
24 months; the bucket's lifecycle rule is its 12 months for CVs. Neither
depends on anyone remembering.

---

## Costs

At this traffic the whole thing is inside the AWS free tier except SES, which
has no perpetual free tier outside EC2:

| | Free allowance | Realistic use |
|---|---|---|
| Lambda | 1M requests/month, always free | a few hundred |
| API Gateway (HTTP) | 1M requests/month, 12 months | a few hundred |
| DynamoDB on-demand | 25 GB storage, always free | megabytes |
| S3 | 5 GB, 12 months | CVs only |
| SES | — | $0.10 per 1,000 emails |
| Turnstile | unlimited, always free | — |

Expect under a dollar a month before WAF.

---

## Checking it works

```bash
# should be rejected: no Turnstile token
curl -i -X POST "$API/submit" -H 'content-type: application/json' \
  -d '{"form":"contact","fields":{"name":"Test","email":"t@example.com"}}'
# → 400  "We could not confirm you are human."
```

That 400 is the check passing, not failing. To exercise the whole path, use the
form in a browser.

Logs: `sam logs -n finlabs-form-submit --stack-name finlabs-web-backend --tail`

The line to watch for is `ses send failed, submission is stored` — it means an
enquiry was saved but nobody was told. The CloudWatch alarm in the template
fires on function errors; point it at an email or a Slack webhook.
