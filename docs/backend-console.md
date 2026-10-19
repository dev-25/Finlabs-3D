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

About 25 minutes. SES is already verified and unrestricted, so nothing here waits on anyone.

---

## A. SES — already verified and out of the sandbox

`info@finlabsindia.biz` is **already a verified identity** in `ap-south-1`
with DKIM passing, and the account is out of the sandbox, so there is nothing
to set up and nothing to wait for. SES rather than SNS also means **Reply-To
is set to the person who filled the form**, so hitting reply in the inbox
answers them. SNS cannot do that.

### A1 · The account is already out of the sandbox

Checked on 19 Oct 2026: **193,300 emails a day, 48 a second.** A sandboxed
account gets 200 a day and 1 a second, so there is nothing to request and no
restriction on who can receive. If you ever need to confirm this again, those
two numbers on **SES → Account dashboard** are the tell — a sandbox banner is
not always shown.

### A2 · A configuration set, because the account is shared

The same dashboard showed **420 emails already sent that day** by something
else. That matters for one reason: bounces and spam complaints are scored
against the whole account, so a form that starts attracting junk would drag
down whatever else sends from here — and you would have no way to see that it
was us.

A configuration set separates the reporting. Five minutes, and much harder to
retrofit once there is history to untangle.

1. Console → **Amazon SES** → **Configuration sets** → **Create set**
2. Name:
   ```
   finlabs-website
   ```
3. Leave the defaults → **Create set**

That alone separates the metrics. If you also want bounces handled rather than
merely counted:

4. Open the set → **Event destinations** → **Add destination**
5. Event types: **Bounce**, **Complaint**, **Reject**
6. Destination: **Amazon SNS** → create or pick a topic → subscribe your address

Then set `SES_CONFIGURATION_SET=finlabs-website` in step C3. Leave the variable
out and sending still works — it just gets counted with everything else.

> **Why bother.** A hard bounce or a complaint on a shared account is a cost
> the other system pays without knowing why. This keeps the blast radius of
> the website's email where it belongs.

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

**Configuration** → **Environment variables** → **Edit** → add nine (ten with the optional one):

| Key | Value |
|---|---|
| `TABLE_NAME` | `finlabs-submissions` |
| `MAIL_FROM` | `info@finlabsindia.biz` |
| `MAIL_FROM_NAME` | `Finlabs website` |
| `MAIL_ROUTES` | `{"contact":["info@finlabsindia.biz"],"solutions":["info@finlabsindia.biz"],"services":["info@finlabsindia.biz"],"learngenie-demo":["info@finlabsindia.biz"],"careers":["hr@finlabsindia.biz"]}` |
| `ALLOWED_ORIGIN` | `http://finlabs-prod-website.s3-website.ap-south-1.amazonaws.com` |
| `NOTIFY` | `ses` |
| `MAX_PER_IP_PER_HOUR` | `5` |
| `SES_CONFIGURATION_SET` | `finlabs-website` — optional, see A2 |
| `ENQUIRY_RETENTION_MONTHS` | `24` |
| `NOTICE_VERSION` | `2.0` |

`MAIL_ROUTES` must be on one line, valid JSON. Paste it exactly as above.

> `MAIL_FROM` has to be an identity **verified in SES**, which is why it is
> `.biz` rather than the `.com` addresses the website shows visitors. Those
> are a separate question — SES verification is about sending, not receiving,
> so it says nothing about whether `finlabsindia.com` accepts mail. Worth
> settling before launch; it does not block this.

> `ALLOWED_ORIGIN` must match the address in the browser's bar **exactly** —
> scheme included, no trailing slash. Get it wrong and the browser blocks the
> response with a CORS error even though the Lambda ran fine. **When you move
> to `https://finlabsindia.com`, this has to change with it.**

### C4 · Let it write to DynamoDB and send mail

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
`${apiBaseUrl}/submit`, and leaving the slash on makes that `//submit`.

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
| `MessageRejected: Email address is not verified` | Only `MAIL_FROM` needs verifying, and it must be an SES identity — `info@finlabsindia.biz`. Recipients do not, since the account is out of the sandbox. |
| "We could not save that" | C4's DynamoDB permission, or the table name |
| Thank-you page appears but no email | The log says `notification failed, submission is stored` — the enquiry **is** in DynamoDB. Check the log for the real reason; the enquiry is safe either way. Either way the order is working as intended. |
| `Task timed out after 3.00 seconds` | C3's timeout was not raised |
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

When that happens, remember to update `ALLOWED_ORIGIN` in C3 and the CORS
origin in C5 — the forms stop working the moment the address changes, and the
error in the browser console will say CORS rather than anything about the move.
