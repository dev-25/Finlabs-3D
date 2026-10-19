# Form submissions — AWS console walkthrough

Gets the contact, solutions, services and Learngenie forms writing to
DynamoDB and emailing the team. Point-and-click, no CLI, no zip, no npm.

CV uploads come later; they need a second function and an S3 bucket.

What you end up with:

```
form (+honeypot, +clock) → Lambda Function URL → Lambda ─┬→ DynamoDB  (the record)
                                                        └→ SNS       (the email)
```

**No API Gateway.** A Lambda Function URL does the same job here, is free,
and is three clicks instead of a wizard. If you later need request throttling
or a custom domain on the API, that is the moment to move to API Gateway —
not before.

About 25 minutes. Nothing here waits on anyone — no verification, no approval.

---

## A. SNS — where the notification lands

SNS carries the email. Nothing to verify and nothing to wait for: the topic
works the moment you create it.

### A1 · Create the topic

1. Console → **Amazon SNS** → check the region is **ap-south-1** (top right)
2. **Topics** → **Create topic**
3. Type: **Standard**
4. Name:
   ```
   finlabs-form-submissions
   ```
5. Leave everything else alone → **Create topic**
6. **Copy the Topic ARN.** It looks like:
   ```
   arn:aws:sns:ap-south-1:883891414144:finlabs-form-submissions
   ```
   It goes into the Lambda in step C3 and the IAM policy in C4.

### A2 · Subscribe the people who should get enquiries

1. On the topic page → **Create subscription**
2. Protocol: **Email**
3. Endpoint:
   ```
   info@finlabsindia.biz
   ```
4. **Create subscription**
5. Repeat for any other address — `hr@finlabsindia.biz`, a personal address
   while testing, whatever you need

> **Every subscriber gets a "Subscription Confirmation" email and somebody has
> to click the link in it.** Until that happens the subscription sits at
> *PendingConfirmation* and **nothing is delivered** — with a completely clean
> Lambda log, because as far as the Lambda is concerned the publish succeeded.
> This is the single most likely reason for "I submitted the form and no email
> came". Check the topic's Subscriptions tab says **Confirmed**.

### A3 · What SNS does not do

Worth knowing now rather than discovering in front of a customer:

- **Mail arrives from `no-reply@sns.amazonaws.com`** with an unsubscribe
  footer, so it reads as a system alert rather than a business email.
- **There is no Reply-To.** Hitting reply in your inbox answers Amazon, not
  the person who filled the form — you copy their address out of the message
  body instead.
- **Everyone on the topic gets everything.** SNS publishes to the topic, so
  `MAIL_ROUTES` is ignored: a job application reaches whoever is subscribed,
  same as an enquiry. Per-form routing needs SES, or a second topic.

**SES fixes all three**, and this account is already set up for it:
`info@finlabsindia.biz` is a verified identity in `ap-south-1` with DKIM
passing, and the account is out of the sandbox — 193,300 emails a day against
a sandboxed account's 200.

Switching later is two environment variables and one line of the IAM policy;
see *Moving to SES* at the end. Nothing in the code changes.

## B. DynamoDB — where enquiries are kept

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

## C. The Lambda

### C1 · Create it

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

### C2 · Paste the code

1. On the function page, scroll to **Code source**
2. Open `index.mjs` in the editor
3. Delete everything in it
4. Paste the whole of [`backend/console/submit.mjs`](../backend/console/submit.mjs)
5. **Deploy** (the button above the editor)

> The file is one piece on purpose. The only two AWS clients it uses ship
> inside the Node runtime, so there is nothing to install and nothing to zip.

### C3 · Configuration

**Configuration** tab → **General configuration** → **Edit**

- Timeout: **15 seconds** (the default 3 is not enough — it writes to DynamoDB twice, then sends)
- Memory: **512 MB**
- **Save**

**Configuration** → **Environment variables** → **Edit** → add six:

| Key | Value |
|---|---|
| `TABLE_NAME` | `finlabs-submissions` |
| `NOTIFY` | `sns` |
| `SNS_TOPIC_ARN` | the Topic ARN from step A1 |
| `MAX_PER_IP_PER_HOUR` | `5` |
| `ENQUIRY_RETENTION_MONTHS` | `24` |
| `NOTICE_VERSION` | `2.0` |

> `MAIL_FROM`, `MAIL_FROM_NAME` and `MAIL_ROUTES` do nothing while `NOTIFY`
> is `sns`, because SNS delivers to whoever subscribed to the topic. Set them
> now if you like — they are what *Moving to SES* needs — or leave them out
> until then.

> **CORS lives in exactly one place: the Function URL (C5).** The function
> deliberately sends no CORS headers of its own. If both did, the response
> would carry `access-control-allow-origin` twice, the browser would reject it
> as malformed, and `fetch` would throw — while the enquiry was stored and the
> email sent perfectly well. The symptom is "Load failed" in Safari or "Failed
> to fetch" in Chrome, on a request that actually succeeded.
>
> If you have an older copy of `submit.mjs` pasted in, re-paste the current
> one from the repository.

### C4 · Let it write to DynamoDB and publish

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
      "Sid": "PublishTheNotification",
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:ap-south-1:<ACCOUNT>:finlabs-form-submissions"
    }
  ]
}
```

4. **Next** → name it `finlabs-form-submit` → **Create policy**

> `PutItem` writes the enquiry; `UpdateItem` is only for the per-IP counter.
> Neither reads nor deletes, so a bug here cannot expose or destroy enquiries.
> `sns:Publish` names the one topic rather than `*`, so this role cannot
> publish anywhere else in the account.

### C5 · Give it a URL

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

> This CORS block is the only place CORS is configured — the function sends
> none of its own, on purpose. Setting it in both places sends the header
> twice and the browser rejects the response.
>
> **This origin changes when the site moves to `https://finlabsindia.com`,**
> and the forms stop working the moment it does not match the address bar.

---

## D. Point the website at it

Two values go into [`backend.config.json`](../backend.config.json), in the
repository:

```jsonc
"public": {
  "apiBaseUrl": "https://abc123xyz.lambda-url.ap-south-1.on.aws"
}
```

**Drop the trailing slash from the Function URL.** The site posts to
`${apiBaseUrl}/submit`; the code strips a trailing slash defensively, so one
left on will not break anything, but the config reads better without it.

Commit and push. The deploy runs on its own, and from then on the forms post
to the Lambda instead of opening a mail client.

```bash
git add backend.config.json
git commit -m "Point the forms at the Lambda"
git push
```

---

## E. Test it

Open the contact page, fill it in, submit.

**What should happen:** a brief pause, then **the thank-you page at
`/thank-you.html`**. An email to
every confirmed subscriber on the topic, from `no-reply@sns.amazonaws.com`. A
row in DynamoDB.

**Take more than three seconds filling it in.** Submit faster than that and
the clock check treats you as a script: you get the thank-you page, nothing is
stored, and the log says `dropped as automated`.

**Check the row:** DynamoDB → Tables → `finlabs-submissions` → **Explore
table items**. You should see `pk`, `fields`, `marketingConsent`,
`consentRecord` and an `expiresAt` 24 months out.

**If something is wrong**, the Lambda's log says which part:
**Lambda → Monitor → View CloudWatch logs**.

| Symptom | Cause |
|---|---|
| "Load failed" (Safari) / "Failed to fetch" (Chrome), **but the email arrives and the row is in DynamoDB** | The response carries `access-control-allow-origin` twice — the Function URL adds it and an old copy of the function adds it too. Re-paste the current `submit.mjs`, which sends none. |
| Browser console: CORS error, nothing stored | The Function URL's allow-origin does not match the address bar exactly — scheme included, no trailing slash |
| Your own test submission vanishes with no error | You filled it in under 3 seconds, so the clock check dropped it. The log says `dropped as automated`. Take your time, or lower `MIN_FILL_SECONDS` in the code while testing. |
| "That is several messages in a short time" | The per-IP limit. Six submissions in an hour from one address. Raise `MAX_PER_IP_PER_HOUR` or wait. |
| Row in DynamoDB, no email, clean log | The subscription was never confirmed. SNS → the topic → **Subscriptions** must say *Confirmed*, not *PendingConfirmation*. This is the common one. |
| `AuthorizationError` on publish | C4's `sns:Publish`, or the ARN in `SNS_TOPIC_ARN` does not match the topic |
| "We could not save that" | C4's DynamoDB permission, or the table name |
| Log says `notification failed, submission is stored` | Only the email failed — the enquiry **is** safe in DynamoDB, and that line carries the reason. This is the write-before-send order doing its job. |
| `Task timed out after 3.00 seconds` | C3's timeout was not raised |
| The form still opens a mail client | `backend.config.json` has not deployed, or `apiBaseUrl` is empty |
| `no notification channel configured` | `NOTIFY` is `sns` but `SNS_TOPIC_ARN` is unset |

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

## Moving to SES later

SNS is the quick answer; SES is the better one. It sends from your own domain,
and it sets **Reply-To to the person who filled the form**, so hitting reply
answers them instead of Amazon. It also restores per-form routing, so job
applications can go to `hr@` while enquiries go to `info@`.

The groundwork is already done on this account: `info@finlabsindia.biz` is a
verified identity in `ap-south-1` with DKIM passing, and the account is out of
the sandbox — 193,300 emails a day against a sandboxed account's 200, so there
is no approval to wait for.

Three changes, no code:

**1. Environment variables** (C3) — change one, add three:

| Key | Value |
|---|---|
| `NOTIFY` | `ses` |
| `MAIL_FROM` | `info@finlabsindia.biz` — must be an SES-verified identity |
| `MAIL_FROM_NAME` | `Finlabs website` |
| `MAIL_ROUTES` | `{"contact":["info@finlabsindia.biz"],"solutions":["info@finlabsindia.biz"],"services":["info@finlabsindia.biz"],"learngenie-demo":["info@finlabsindia.biz"],"careers":["hr@finlabsindia.biz"]}` |

`SNS_TOPIC_ARN` can stay; it is ignored once `NOTIFY` is `ses`.

**2. IAM** (C4) — swap the publish statement for:

```json
{
  "Sid": "SendTheNotification",
  "Effect": "Allow",
  "Action": "ses:SendEmail",
  "Resource": "*"
}
```

**3. A configuration set — worth doing, because the account is shared.**

That dashboard showed 420 emails already sent that day by something else.
Bounces and spam complaints are scored against the whole account, so junk
arriving through the website's forms would drag down whatever else sends from
here, and nobody would be able to see it was us.

- SES → **Configuration sets** → **Create set** → name it `finlabs-website`
- Set `SES_CONFIGURATION_SET=finlabs-website` in C3

Leave it out and sending still works; it just gets counted with everything
else. Five minutes now, much harder to untangle once there is history.

> `MAIL_FROM` is `.biz` because that is what is verified in SES, while the
> website shows `.com` addresses to visitors. Those are separate questions —
> SES verification is about *sending*, not receiving, so it says nothing about
> whether `finlabsindia.com` accepts mail. Worth settling before launch,
> especially `privacy@`, which the Privacy Notice names as the route for data
> rights requests. It does not block any of this.

## One thing to be straight about

The site is on `http://`. The form posts over HTTPS, so what visitors type is
encrypted in transit — but the page carrying the form is not, which means it
can be tampered with on the way to them, and the padlock a visitor looks for
is not there.

It is fine for internal testing. Before you send this address to anyone
outside the company, or point `finlabsindia.com` at it, CloudFront needs to
exist. The Privacy Notice we published says HTTPS, and it should be true
before the forms are collecting real names and email addresses.

When that happens, remember to update the CORS origin on the Function URL
(C5) — the forms stop working the moment it stops matching the address bar,
and the browser's error will say CORS rather than anything about the move.
