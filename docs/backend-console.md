# Form submissions — AWS console walkthrough

Gets the contact, solutions, services and Learngenie forms writing to
DynamoDB and emailing the team. Point-and-click, no CLI, no zip, no npm.

CV uploads come later; they need a second function and an S3 bucket.

What you end up with:

```
form (+honeypot, +clock) → Lambda Function URL → Lambda ─┬→ DynamoDB  (the record)
                                                        └→ SES       (the email)
```

**No API Gateway.** A Lambda Function URL does the same job here, is free,
and is three clicks instead of a wizard. If you later need request throttling
or a custom domain on the API, that is the moment to move to API Gateway —
not before.

About 40 minutes, most of it waiting for SES.

---

## A. SNS — where the notification goes

SNS sends the email. It works the moment the topic exists: no domain
verification, no sandbox, no waiting. SES is the better long-term answer and
step B sets it up, but this gets you receiving enquiries today.

1. Console → **Amazon SNS** → check the region is **ap-south-1** (top right)
2. **Topics** → **Create topic**
3. Type: **Standard**
4. Name:
   ```
   finlabs-form-submissions
   ```
5. **Create topic**
6. **Copy the Topic ARN.** It looks like:
   ```
   arn:aws:sns:ap-south-1:883891414144:finlabs-form-submissions
   ```

Then subscribe the people who should receive enquiries:

7. On the topic → **Create subscription**
8. Protocol: **Email**, Endpoint: `info@finlabsindia.com`
9. **Create subscription**
10. Repeat for `hr@finlabsindia.com`
11. **Both addresses get a "Subscription Confirmation" email — somebody has to
    click the link in each.** Until they do, the status stays
    *PendingConfirmation* and nothing is delivered. This is the step most
    likely to be missed.

> **What SNS costs you compared with SES.** Mail arrives from
> `no-reply@sns.amazonaws.com` with an unsubscribe footer, so it reads as a
> system alert rather than a business email. More importantly **there is no
> Reply-To**: hitting reply answers Amazon, not the customer, so you copy
> their address out of the message body. SES fixes both, which is why step B
> is worth starting now even though SNS is what runs first.

## B. SES — the upgrade, worth starting now

Optional for today; SNS from step A already works. Do it anyway, because SES
sets **Reply-To to the person who wrote in** and sends from your own domain.
Once it is ready, switching is one environment variable.

SES begins in **sandbox mode**, where it will only send to addresses you have
verified, and production access takes about a day to approve.

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

- Timeout: **15 seconds** (the default 3 is not enough — it writes to DynamoDB twice and then publishes)
- Memory: **512 MB**
- **Save**

**Configuration** → **Environment variables** → **Edit** → add eight:

| Key | Value |
|---|---|
| `TABLE_NAME` | `finlabs-submissions` |
| `MAIL_FROM` | `website@finlabsindia.com` (or a verified address — see B) |
| `MAIL_FROM_NAME` | `Finlabs website` |
| `MAIL_ROUTES` | `{"contact":["info@finlabsindia.com"],"solutions":["info@finlabsindia.com"],"services":["info@finlabsindia.com"],"learngenie-demo":["info@finlabsindia.com"],"careers":["hr@finlabsindia.com"]}` |
| `ALLOWED_ORIGIN` | `http://finlabs-prod-website.s3-website.ap-south-1.amazonaws.com` |
| `NOTIFY` | `sns` — change to `ses` once step B is verified |
| `SNS_TOPIC_ARN` | the Topic ARN from step A |
| `MAX_PER_IP_PER_HOUR` | `5` |
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
      "Sid": "CountSubmissionsPerIp",
      "Effect": "Allow",
      "Action": "dynamodb:UpdateItem",
      "Resource": "arn:aws:dynamodb:ap-south-1:<ACCOUNT>:table/finlabs-submissions"
    },
    {
      "Sid": "SendTheNotification",
      "Effect": "Allow",
      "Action": ["sns:Publish", "ses:SendEmail"],
      "Resource": "*"
    }
  ]
}
```

4. **Next** → name it `finlabs-form-submit` → **Create policy**

> `PutItem` writes the enquiry; `UpdateItem` is only for the per-IP counter.
> Neither reads or deletes, so a bug here cannot expose or destroy enquiries.
> Both `sns:Publish` and `ses:SendEmail` are granted so switching `NOTIFY`
> later needs no permission change.

### D5 · Give it a URL

1. Back on the function → **Configuration** → **Function URL** → **Create function URL**
2. Auth type: **NONE**

   That is correct here and worth understanding: the endpoint is public
   because a public website posts to it. What stops abuse is the three
   checks inside the function, not a credential the browser would have to
   carry — anything the browser carries is not a secret.

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
  "apiBaseUrl": "https://abc123xyz.lambda-url.ap-south-1.on.aws"
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
| Your own test submission vanishes with no error | You filled it in under 3 seconds, so the clock check dropped it. The log says `dropped as automated`. Take your time, or lower `MIN_FILL_SECONDS` in the code while testing. |
| "That is several messages in a short time" | The per-IP limit. Six submissions in an hour from one address. Raise `MAX_PER_IP_PER_HOUR` or wait. |
| Nothing arrives and the log is clean | The SNS subscription was never confirmed — check the topic shows *Confirmed*, not *PendingConfirmation*. |
| "We could not save that" | D4's DynamoDB permission, or the table name |
| Thank-you page appears but no email | The log says `notification failed, submission is stored` — the enquiry **is** in DynamoDB. With SNS this means the subscription is unconfirmed; with SES it means the sandbox. Either way the order is working as intended. |
| `Task timed out after 3.00 seconds` | D3's timeout was not raised |
| The form still opens a mail client | `backend.config.json` has not deployed, or `apiBaseUrl` is empty |

---

## About the bot defence

There is no CAPTCHA here. Three checks inside the Lambda do the work: a
honeypot field a person never sees, a minimum time between the form rendering
and being submitted, and a per-IP hourly limit. Bots that fail the first two
get a cheerful 200 and an id that leads nowhere, because a bot told why it was
rejected is a bot that gets fixed.

**That stops ordinary form spam, which is nearly all of it. It will not stop
someone who targets this form deliberately.** If that starts happening, the
AWS-native answer is WAF with its CAPTCHA action — but WAF cannot attach to a
Lambda Function URL, so it needs CloudFront or an API Gateway REST API in
front first. Worth knowing before it is urgent rather than after.

The rate limit is also what protects the bill: without it a script can invoke
this function as fast as it likes, and Lambda charges per invocation.

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
