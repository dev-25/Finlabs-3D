# Going live — AWS console walkthrough

Every step here is point-and-click. No CLI, no CloudShell.

You need: an AWS account with IAM permissions, the bucket
`finlabs-prod-website` already created, and admin on
`Finlabsindia-Codebase/Prod-Finlabs-website`.

About 25 minutes. Parts A–D are AWS, E is the bucket, F is GitHub, G deploys.

---

## A. Let AWS trust GitHub

This is what lets a GitHub Actions run prove who it is without any AWS
access key existing anywhere.

**Do this once per AWS account.** If someone has already set up GitHub Actions
on this account, skip to part B — you will see
`token.actions.githubusercontent.com` already listed.

1. Console → search **IAM** → open it
2. Left sidebar → **Identity providers**
3. **Add provider**
4. Provider type: **OpenID Connect**
5. Provider URL:
   ```
   https://token.actions.githubusercontent.com
   ```
   Click **Get thumbprint** if the button appears. Newer accounts skip this —
   AWS verifies the certificate itself.
6. Audience:
   ```
   sts.amazonaws.com
   ```
7. **Add provider**

> If it says the provider already exists, that is fine. Carry on.

---

## B. Create the permission policy

What the deploy is allowed to touch — the one bucket, and nothing else.

1. IAM → left sidebar → **Policies** → **Create policy**
2. Click the **JSON** tab and replace everything with:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListTheBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::finlabs-prod-website"
    },
    {
      "Sid": "WriteTheSite",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::finlabs-prod-website/*"
    },
    {
      "Sid": "ClearTheCacheLater",
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "*"
    }
  ]
}
```

3. **Next**
4. Policy name:
   ```
   finlabs-site-deploy
   ```
   Description: `Lets GitHub Actions publish the website to S3.`
5. **Create policy**

> The CloudFront line does nothing today and errors on nothing — it is there so
> that when the distribution exists you do not have to come back and edit the
> policy mid-launch.

---

## C. Create the role

1. IAM → **Roles** → **Create role**
2. Trusted entity type: **Web identity**
3. Identity provider: **token.actions.githubusercontent.com**
4. Audience: **sts.amazonaws.com**
5. Three GitHub fields appear. Fill all three:

   | Field | Value |
   |---|---|
   | GitHub organization | `Finlabsindia-Codebase` |
   | GitHub repository | `Prod-Finlabs-website` |
   | GitHub branch | `main` |

   **Fill in all three.** Leaving repository or branch blank means any
   repository in the org — or any branch, including one from a pull request —
   could assume this role and write to production. That is the whole security
   of this setup.

6. **Next**
7. Search for **`finlabs-site-deploy`** (the policy from part B), tick it
8. **Next**
9. Role name:
   ```
   finlabs-site-deploy
   ```
10. Before creating, scroll to **Step 1: Select trusted entities** and check the
    JSON shows a line like:

    ```
    "token.actions.githubusercontent.com:sub": "repo:Finlabsindia-Codebase/Prod-Finlabs-website:ref:refs/heads/main"
    ```

    If it says `:*` at the end instead, go back and fill in the branch field.

11. **Create role**

---

## D. Copy the role ARN

1. IAM → **Roles** → click **finlabs-site-deploy**
2. At the top, copy the **ARN**. It looks like:

   ```
   arn:aws:iam::123456789012:role/finlabs-site-deploy
   ```

Keep it on the clipboard — it goes into GitHub in part F.

---

## E. The bucket

Three changes, all on `finlabs-prod-website`.

**First, note the region.** S3 → Buckets → the region is in the row next to the
bucket name (e.g. `ap-south-1`). Write it down; GitHub needs it.

### E1 · Turn on website hosting

1. S3 → **finlabs-prod-website** → **Properties** tab
2. Scroll to the bottom: **Static website hosting** → **Edit**
3. **Enable**
4. Hosting type: **Host a static website**
5. Index document:
   ```
   index.html
   ```
6. Error document:
   ```
   404.html
   ```
7. **Save changes**
8. Scroll back to **Static website hosting** and copy the
   **Bucket website endpoint**. It looks like:

   ```
   http://finlabs-prod-website.s3-website.ap-south-1.amazonaws.com
   ```

   That is the address you will test on.

> The error document field is what makes the branded 404 page appear. Leave it
> blank and visitors get S3's raw XML error instead.

### E2 · Allow public reads

Without CloudFront this is the only way anyone can read the site.

1. Same bucket → **Permissions** tab
2. **Block public access (bucket settings)** → **Edit**
3. Untick **Block all public access**
4. **Save changes**
5. Type `confirm` in the box → **Confirm**

### E3 · Add the bucket policy

Still on the **Permissions** tab:

1. **Bucket policy** → **Edit**
2. Paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForWebsite",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::finlabs-prod-website/*"
    }
  ]
}
```

3. **Save changes**

> **This is temporary and worth a calendar reminder.** It makes the bucket
> world-readable, which is the price of having no CloudFront. When the
> distribution exists, switch the bucket to Origin Access Control, turn Block
> Public Access back on, and delete this policy. The bucket then serves
> CloudFront alone and nobody can reach it directly.

---

## F. Tell GitHub

Go to the repository → **Settings** → **Secrets and variables** → **Actions**.

### F1 · The secret

**Secrets** tab → **New repository secret**

| | |
|---|---|
| Name | `AWS_DEPLOY_ROLE_ARN` |
| Secret | the ARN from part D |

**Add secret**

### F2 · The variables

**Variables** tab → **New repository variable**, four times:

| Name | Value |
|---|---|
| `S3_BUCKET` | `finlabs-prod-website` |
| `SITE_URL` | `https://finlabsindia.com` |
| `AWS_REGION` | the region from part E (e.g. `ap-south-1`) |
| `CLOUDFRONT_ID` | *leave this one out entirely for now* |

> Variables and secrets are different tabs on the same page. The ARN is not
> secret in any real sense, but it names your account number, so it goes in
> Secrets. The rest are Variables so you can read them back later.

---

## G. Deploy

Nothing to run locally. In the repository:

**Actions** tab → **Deploy to production** (left sidebar) → **Run workflow** →
branch `main` → **Run workflow**

It takes about two minutes. Watch the steps:

| Step | What it means |
|---|---|
| Is production configured? | should **not** print the "nothing to deploy" notice now |
| Build | compiles 66 pages in three languages |
| Check the build looks right | fails the deploy rather than shipping a broken one |
| configure-aws-credentials | the OIDC handshake — the moment parts A–D are tested |
| Upload immutable assets | the hashed JS and CSS |
| Upload everything else | HTML, with `--delete` |
| Where it went | a summary with the bucket and origin |

Then open the bucket website endpoint from step E1.

---

## If something fails

| What you see | What it is |
|---|---|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | The role's trust does not match. Check part C step 10 — org, repo and branch must match exactly, and the branch must be `main`. |
| `Could not assume role ... no identity-based policy` | Part A's provider is missing, or the audience is not `sts.amazonaws.com`. |
| `AccessDenied` on PutObject | The policy in part B was not attached to the role in part C step 7. |
| The job skips with "No S3_BUCKET variable set" | The variable went into the **Secrets** tab by mistake. It belongs in **Variables**. |
| Page loads but has no styling | The build used the wrong base path. The guard step should have caught it — send me the log. |
| 404 on every page but the home page | E1's index/error documents are not saved. |
| Raw XML error instead of the branded 404 | E1 step 6, the error document field. |
| `403 Forbidden` on everything | E2 or E3 — public access block, or the bucket policy. |

---

## After it works

The site is now on an **HTTP-only** endpoint. Before anyone outside the company
sees it:

- **Do not point `finlabsindia.com` at this address.** A production domain on
  plain HTTP gets flagged by browsers, and it is hard to undo once people have
  loaded it that way.
- **The forms stay on their mailto fallback.** Turnstile and the API both
  expect a secure origin, and collecting names and emails over HTTP is not
  defensible alongside the privacy notice we published.
- Treat it as an internal staging URL. It is the right thing to have ready; it
  is not a launch.

When the account activation clears and you can create CloudFront, the steps are
in [deploy-prod.md](deploy-prod.md) under *When the account is activated* —
including switching the bucket back to private, which is the step most easily
forgotten.
