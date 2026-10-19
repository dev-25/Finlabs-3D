# Going live on the company's AWS

> **Prefer clicking to typing?** [deploy-prod-console.md](deploy-prod-console.md)
> is the same setup done entirely in the AWS console, with no CLI and no
> CloudShell. This page keeps the CLI commands and the reference material.

Push to `main` → GitHub Actions builds → `aws s3 sync` to `finlabs-prod-website`.
No manual step in between.

Everything below is one-time setup. After it, deploying is `git push`.

> **Read the "What HTTPS costs you until CloudFront exists" section before
> announcing the URL to anyone.** S3 on its own cannot serve a custom domain
> over HTTPS, and that has consequences beyond the padlock.

---

## 1. Move the code into the company repo

A fresh single commit, as decided. Run this from the current working copy:

```bash
# a clean copy with no git history
cd /tmp && rm -rf finlabs-prod
git clone --depth 1 file:///Users/dev/Developer/3D/my-three-site finlabs-prod
cd finlabs-prod && rm -rf .git

git init -b main
git add -A
git commit -m "Finlabs website

Three.js multi-page site, built with Vite. English, Hindi and Marathi.
Deploys to S3 through .github/workflows/deploy-prod.yml."

git remote add origin https://github.com/<ORG>/<PROD-REPO>.git
git push -u origin main
```

Nothing in this codebase holds a secret — `backend.config.json` carries names
and addresses only, by design, and the Turnstile secret lives in AWS SSM. It is
still worth one look at `git show --stat HEAD` before the push.

---

## 2. A role GitHub can assume

No access keys in GitHub. GitHub Actions presents a short-lived OIDC token and
AWS trades it for temporary credentials.

**If the account has never trusted GitHub before**, add the provider once:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

**Trust policy** — save as `trust.json`, replacing `<ACCOUNT>`, `<ORG>` and
`<PROD-REPO>`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<ACCOUNT>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike":   { "token.actions.githubusercontent.com:sub": "repo:<ORG>/<PROD-REPO>:ref:refs/heads/main" }
    }
  }]
}
```

That `sub` condition is the whole security of this setup: only workflows
running on `main` **of that one repository** can assume the role. Do not
loosen it to `repo:<ORG>/<PROD-REPO>:*` — that would let a pull request from a
fork deploy to production.

**Permission policy** — `deploy-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::finlabs-prod-website"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::finlabs-prod-website/*"
    },
    {
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "*"
    }
  ]
}
```

```bash
aws iam create-role --role-name finlabs-site-deploy \
  --assume-role-policy-document file://trust.json

aws iam put-role-policy --role-name finlabs-site-deploy \
  --policy-name deploy --policy-document file://deploy-policy.json

aws iam get-role --role-name finlabs-site-deploy --query Role.Arn --output text
```

That ARN goes into GitHub as a secret in the next step.

---

## 3. Tell GitHub where production is

**Settings → Secrets and variables → Actions**

| | Name | Value |
|---|---|---|
| Secret | `AWS_DEPLOY_ROLE_ARN` | the ARN printed above |
| Variable | `S3_BUCKET` | `finlabs-prod-website` |
| Variable | `SITE_URL` | `https://finlabsindia.com` |
| Variable | `AWS_REGION` | the bucket's region, e.g. `ap-south-1` |
| Variable | `CLOUDFRONT_ID` | leave empty for now |

Until `S3_BUCKET` exists the workflow ends green with a notice, so nothing
goes red while you are still setting up.

> **`SITE_URL` is not cosmetic.** It is written into every canonical tag, the
> sitemap, Open Graph tags and `llms.txt`. Set it to the address the public
> will actually use. If you point it at the S3 website endpoint now and move to
> `finlabsindia.com` later, every one of those has to be regenerated — which
> is just another deploy, but Google will have indexed the wrong host in the
> meantime. **Decide the final domain before the first public deploy.**
>
> **Decided: the site launches on `finlabsindia.com`.** That settles the one
> contradiction in the audit workbook, which said `.com` in four places and
> `.org` in one. `finlabsindia.org` stays registered and 301-redirects to
> `.com` page by page — that is what carries ten years of search ranking
> across, and it needs CloudFront, so it happens at the same time as HTTPS.

---

## 4. Bucket settings

The bucket exists; it needs two things set on it.

**Static website hosting** — Properties → Static website hosting → Enable:

- Index document: `index.html`
- Error document: `404.html`

The branded 404 only appears if that second field is filled in. Without it
visitors get S3's XML error document, which is worse than GitHub's default was.

**Public read access.** Without CloudFront this is the only way the site is
readable, so Block Public Access has to come off and a bucket policy added:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadForWebsite",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::finlabs-prod-website/*"
  }]
}
```

> This is a step backwards that CloudFront undoes. Once the distribution
> exists, switch to Origin Access Control, turn Block Public Access back on
> and delete this policy — the bucket then serves CloudFront only, and nobody
> can reach it directly. Put a reminder on it.

---

## 5. Deploy

```bash
git commit --allow-empty -m "Trigger first production deploy"
git push
```

Watch it in the repo's Actions tab. Then:

```
http://finlabs-prod-website.s3-website.<region>.amazonaws.com
```

Check in this order, because each failure looks different:

1. **The page loads but is unstyled** → the build used the wrong `SITE_BASE`.
   The workflow sets `/`; the guard step should have caught it.
2. **404 on every page but the home page** → the index/error documents are not
   set on the bucket.
3. **An XML error instead of the branded 404** → the error document field.
4. **A stale page after a deploy** → cache headers; HTML is sent
   `max-age=0, must-revalidate`, so this should not happen without CloudFront.

---

## What HTTPS costs you until CloudFront exists

The S3 website endpoint is **HTTP only**. That is not just a padlock:

- **Do not point `finlabsindia.com` at it.** A production domain served over
  plain HTTP will be flagged by browsers, and once people have loaded it that
  way it is hard to undo.
- **The forms cannot go live.** Cloudflare Turnstile and the API both expect a
  secure origin, and asking anyone for a name and email over HTTP is not
  defensible a fortnight after publishing a DPDP privacy notice that promises
  HTTPS. The forms still fall back to `mailto`, so nothing breaks — they just
  stay on the fallback.
- **Leave it unindexed** until the real domain is live, or Google will index
  the S3 endpoint and you will be competing with yourself.

Treat the S3 endpoint as a staging URL you can show people internally. It is
the right thing to have ready, and it is not a public launch.

### When the account is activated

1. Create the distribution with the bucket as origin, using **Origin Access
   Control**, not the website endpoint.
2. Attach the ACM certificate for the domain — **in `us-east-1`**, which is
   the only region CloudFront reads certificates from.
3. Default root object `index.html`; custom error response 404 → `/404.html`
   with response code 404 (not 200 — a soft 404 is an SEO problem).
4. Set `CLOUDFRONT_ID` in the repo variables. The workflow starts invalidating
   on its own; no code change.
5. Lock the bucket back down (see step 4).
6. Then, and only then, point DNS at CloudFront and do the `.org` → `.com`
   redirects. Those 301s are what carries ten years of search ranking across,
   and they need CloudFront Functions or a redirect rule set — see roadmap
   items #45 and #46.

---

## Old assets

The sync deliberately does not delete old hashed assets: someone who loaded a
page a minute before the deploy is still asking for the previous build's
files. They accumulate at a few hundred KB per deploy, which is nothing for a
year and worth a sweep eventually:

```bash
# what would go — anything under assets/ untouched for 90 days
aws s3 ls s3://finlabs-prod-website/assets/ --recursive \
  | awk -v cutoff="$(date -u -v-90d +%Y-%m-%d 2>/dev/null || date -u -d '90 days ago' +%Y-%m-%d)" \
        '$1 < cutoff {print $4}'
```

Check the list before deleting anything. An asset still referenced by a page
in the current build must not be removed, and the date is only a proxy for
that — a file that has not changed in 90 days may well still be in use.

## Two repos, one codebase

`deploy.yml` (GitHub Pages) now runs only when the repository is
`dev-25/Finlabs-3D`, so it stays out of the way in the company repo.
`deploy-prod.yml` runs anywhere `S3_BUCKET` is set, which is nowhere but
production.

Keeping both in the same tree means a change made in one place reaches the
other, instead of the two drifting apart — which is how a staging site ends up
not testing what production runs.

To carry later changes across, the simplest route is a second remote in the
personal repo:

```bash
git remote add prod https://github.com/<ORG>/<PROD-REPO>.git
git push prod main
```

Once UAT exists, give it the same workflow with its own `S3_BUCKET` and
`SITE_URL`, and merge into it before `main`.
