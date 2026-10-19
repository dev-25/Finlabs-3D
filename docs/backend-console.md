# Form submissions — AWS console walkthrough

Gets the contact, solutions, services and Learngenie forms writing to
DynamoDB and emailing the team. Point-and-click, no CLI, no zip, no npm.

CV uploads come later; they need a second function and an S3 bucket.

What you end up with:

```
form → Turnstile token → Lambda Function URL → Lambda ─┬→ DynamoDB  (the record)
                                                        └→ SES       (the email)
```

**No API Gateway.** A Lambda Function URL does the same job here, is free,
and is three clicks instead of a wizard. If you later need request throttling
or a custom domain on the API, that is the moment to move to API Gateway —
not before.

About 40 minutes, most of it waiting for SES.

---

## A. Cloudflare Turnstile — the bot check

Free, no request cap. Do this first; the keys are needed in step D.

1. <https://dash.cloudflare.com> → **Turnstile** → **Add widget**
2. Widget name: `Finlabs website`
3. Hostnames — add **all** of these:
   ```
   finlabs-prod-website.s3-website.ap-south-1.amazonaws.com
   finlabsindia.com
   www.finlabsindia.com
   localhost
   ```
   A hostname missing here means the widget refuses to load there, and the
   form cannot be submitted at all.
4. Widget mode: **Managed**
5. **Create**
6. Copy both keys. The **site key** is public and goes in the repo; the
   **secret key** goes into the Lambda in step D and nowhere else.

---

## B. SES — start this now, it has a waiting period

SES begins in **sandbox mode**, where it will only send to addresses you have
verified. That is fine for testing and useless in production, so request
production access on the same day.

1. Console → **Amazon SES** → check the region is **ap-south-1** (top right)
2. **Identities** → **Create identity**
3. Choose **Domain**, enter `finlabsindia.com`
4. Leave **Easy DKIM** enabled — mail from a new domain without DKIM lands in
   spam, which is the problem we are trying to solve
5. **Create identity**
6. It shows CNAME records. Add them to the DNS for `finlabsindia.com`.
   Verification completes minutes to hours later.

**While the domain verifies**, add the recipients so you can test:

7. **Create identity** → **Email address** → `info@finlabsindia.com` → create
8. Repeat for `hr@finlabsindia.com`
9. Each address gets a confirmation email. Click the link in both.

**Then request production access:**

10. SES → **Account dashboard** → **Request production access**
11. Mail type: **Transactional**. Website URL: your site. Describe it as
    *"Enquiry and demo-request forms on our company website. Recipients are
    our own staff addresses. Volume under 100 emails a month."*

Approval usually takes a day. **Until it is granted, the Lambda can only
email verified addresses** — which is enough to test end to end.

> If the domain is not yet verified, set `MAIL_FROM` in step D to a verified
> *email address* instead. It works the same; it just looks less polished.

---

## C. DynamoDB — where enquiries are kept

1. Console → **DynamoDB** → **Tables** → **Create table**
2. Table name:
   ```
   finlabs-submissions
   ```
3. Partition key: `pk`, type **String**
4. No sort key
5. Table settings: **Customize settings**
6. Capacity mode: **On-demand** — a low-traffic site stays inside the free tier
7. **Create table**

Then two things on the table once it is Active:

**Time to live** — this is what makes the Privacy Notice's 24 months true
rather than aspirational:

8. Click the table → **Additional settings** tab → **Time to Live** → **Turn on**
9. TTL attribute name:
   ```
   expiresAt
   ```
10. **Save changes**

**An index, so a dashboard can list one form's enquiries newest first:**

11. Same table → **Indexes** tab → **Create index**
12. Partition key `form` (String), sort key `createdAt` (String)
13. Index name: `by-form`, projection **All**
14. **Create index**

> The index is not used by the Lambda. It is there so the dashboard you asked
> about a while back has something efficient to read, instead of scanning the
> whole table.

---

## D. The Lambda

### D1 · Create it

1. Console → **Lambda** → **Create function**
2. **Author from scratch**
3. Function name:
   ```
   finlabs-form-submit
   ```
4. Runtime: **Node.js 22.x**
5. Architecture: **arm64** — cheaper per millisecond, and these are tiny
6. Expand **Change default execution role** → leave **Create a new role with
   basic Lambda permissions**
7. **Create function**

### D2 · Paste the code

1. On the function page, scroll to **Code source**
2. Open `index.mjs` in the editor
3. Delete everything in it
4. Paste the whole of [`backend/console/submit.mjs`](../backend/console/submit.mjs)
5. **Deploy** (the button above the editor)

> The file is one piece on purpose. The only two AWS clients it uses ship
> inside the Node runtime, so there is nothing to install and nothing to zip.

### D3 · Configuration

**Configuration** tab → **General configuration** → **Edit**

- Timeout: **15 seconds** (the default 3 is not enough — it calls Cloudflare, DynamoDB and SES in sequence)
- Memory: **512 MB**
- **Save**

**Configuration** → **Environment variables** → **Edit** → add eight:

| Key | Value |
|---|---|
| `TABLE_NAME` | `finlabs-submissions` |
| `MAIL_FROM` | `website@finlabsindia.com` (or a verified address — see B) |
| `MAIL_FROM_NAME` | `Finlabs website` |
| `MAIL_ROUTES` | `{"contact":["info@finlabsindia.com"],"solutions":["info@finlabsindia.com"],"services":["info@finlabsindia.com"],"learngenie-demo":["info@finlabsindia.com"],"careers":["hr@finlabsindia.com"]}` |
| `TURNSTILE_SECRET` | the secret key from step A |
| `ALLOWED_ORIGIN` | `http://finlabs-prod-website.s3-website.ap-south-1.amazonaws.com` |
| `ENQUIRY_RETENTION_MONTHS` | `24` |
| `NOTICE_VERSION` | `2.0` |

`MAIL_ROUTES` must be on one line, valid JSON. Paste it exactly as above.

> `ALLOWED_ORIGIN` must match the address in the browser's bar **exactly** —
> scheme included, no trailing slash. Get it wrong and the browser blocks the
> response with a CORS error even though the Lambda ran fine. **When you move
> to `https://finlabsindia.com`, this has to change with it.**

### D4 · Let it write to DynamoDB and send mail

The execution role can currently only write logs.

1. **Configuration** → **Permissions** → click the **Role name** link (opens IAM)
2. **Add permissions** → **Create inline policy**
3. **JSON** tab, paste — replacing `<ACCOUNT>` with `883891414144`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "StoreTheEnquiry",
      "Effect": "Allow",
      "Action": "dynamodb:PutItem",
      "Resource": "arn:aws:dynamodb:ap-south-1:<ACCOUNT>:table/finlabs-submissions"
    },
    {
      "Sid": "SendTheEmail",
      "Effect": "Allow",
      "Action": ["ses:SendEmail"],
      "Resource": "*"
    }
  ]
}
```

4. **Next** → name it `finlabs-form-submit` → **Create policy**

> `PutItem` only. The function has no reason to read, update or delete an
> enquiry, so it cannot.

### D5 · Give it a URL

1. Back on the function → **Configuration** → **Function URL** → **Create function URL**
2. Auth type: **NONE**

   That is correct here and worth understanding: the endpoint is public
   because a public website posts to it. What stops abuse is the Turnstile
   check inside the function, not a credential the browser would have to
   carry — and anything the browser carries is not a secret.

3. Tick **Configure cross-origin resource sharing (CORS)**
   - Allow origin: `http://finlabs-prod-website.s3-website.ap-south-1.amazonaws.com`
   - Allow headers: `content-type`
   - Allow methods: `POST`
   - Max age: `600`
4. **Save**
5. **Copy the Function URL.** It looks like:
   ```
   https://abc123xyz.lambda-url.ap-south-1.on.aws/
   ```

---

## E. Point the website at it

Two values go into [`backend.config.json`](../backend.config.json), in the
repository:

```jsonc
"public": {
  "apiBaseUrl": "https://abc123xyz.lambda-url.ap-south-1.on.aws",
  "turnstileSiteKey": "0x4AAAAAAA..."
}
```

**Drop the trailing slash from the Function URL.** The site posts to
`${apiBaseUrl}/submit`, and leaving the slash on makes that `//submit`.

Commit and push. The deploy runs on its own, and from then on the forms post
to the Lambda instead of opening a mail client.

```bash
git add backend.config.json
git commit -m "Point the forms at the Lambda"
git push
```

---

## F. Test it

Open the contact page, fill it in, submit.

**What should happen:** a brief pause, then the thank-you page. An email in
`info@finlabsindia.com`. A row in DynamoDB.

**Check the row:** DynamoDB → Tables → `finlabs-submissions` → **Explore
table items**. You should see `pk`, `fields`, `marketingConsent`,
`consentRecord` and an `expiresAt` 24 months out.

**If something is wrong**, the Lambda's log says which part:
**Lambda → Monitor → View CloudWatch logs**.

| Symptom | Cause |
|---|---|
| Browser console: CORS error | `ALLOWED_ORIGIN` or the Function URL CORS origin does not match the address bar exactly |
| "We could not confirm you are human" | `TURNSTILE_SECRET` wrong, or the hostname is missing from the widget in step A |
| "We could not save that" | D4's DynamoDB permission, or the table name |
| Thank-you page appears but no email | Expected while SES is in sandbox and the recipient is unverified. The log says `ses send failed, submission is stored` — the enquiry **is** in DynamoDB. This is the order working as intended. |
| `Task timed out after 3.00 seconds` | D3's timeout was not raised |
| The form still opens a mail client | `backend.config.json` has not deployed, or `apiBaseUrl` is empty |

---

## One thing to be straight about

The site is on `http://`. The form posts over HTTPS, so what visitors type is
encrypted in transit — but the page carrying the form is not, which means it
can be tampered with on the way to them, and the padlock a visitor looks for
is not there.

It is fine for internal testing. Before you send this address to anyone
outside the company, or point `finlabsindia.com` at it, CloudFront needs to
exist. The Privacy Notice we published says HTTPS, and it should be true
before the forms are collecting real names and email addresses.

When that happens, remember to update `ALLOWED_ORIGIN` in D3 and the CORS
origin in D5 — the forms stop working the moment the address changes, and the
error in the browser console will say CORS rather than anything about the move.
