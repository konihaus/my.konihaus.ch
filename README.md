# my.konihaus.ch — Konihaus customer portal

Passwordless login (email magic link) → customers see their **setup**, **subscription/invoices** and can send **support messages**.
Express app, data as JSON in a private S3 bucket, hosted on Vercel. No database.

```
index.js            Express app (auth, API, static files) — exported for Vercel
lib/s3.js           S3 JSON store with optimistic concurrency (If-Match / If-None-Match)
lib/auth.js         magic-link tokens (single use, in S3) + signed session cookie
lib/store.js        customers, threads, messages
lib/mail.js         email via Resend REST API (swap for Postmark/SES if you prefer)
public/             dashboard (plain HTML/CSS/JS, DE/EN)
scripts/            sync (Obsidian → S3), threads (list), reply
examples/customers  example customer JSON to copy into your vault
test/               end-to-end test against an in-memory fake S3 (`npm test`)
```

## S3 layout

```
customers/{id}/profile.json        name, email, language ("de"|"en"), status ("active"|"disabled")
customers/{id}/setup.json          rooms[] → devices[], alertContacts[], notes, updatedAt
customers/{id}/subscription.json   status, tier, priceChfPerMonth, supportResponseHours, dates, invoices[]
customers/{id}/threads/{tid}/meta.json
customers/{id}/threads/{tid}/msgs/{timestamp}-{rand}.json   one object per message, never edited
index/email/{sha256(email)}.json   → customerId   (created by `npm run sync`)
auth/tokens/{sha256(token)}.json   login tokens (15 min, single use)
```

Customer ids: lowercase letters/digits/`-`/`_`, 3–41 chars (e.g. `c-anna-m`).

## Setup

### 1. AWS

1. Create a **new private bucket** for the portal (not your signup/promo bucket), e.g. `konihaus-portal`, in an EU region
   (Zurich is `eu-central-2` — confirm it is available to your account). Turn on **Block all public access**, **versioning** and default encryption.
2. Create an IAM role for Vercel (OIDC federation, so no stored keys). Follow Vercel's AWS guide for the exact trust-policy claims:
   <https://vercel.com/docs/oidc/aws>. Attach this permission policy (replace the bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"], "Resource": "arn:aws:s3:::konihaus-portal/*" },
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::konihaus-portal" }
  ]
}
```

   `If-Match` writes need both `GetObject` and `PutObject`. The portal never deletes objects.
3. For **your own machine** (running `npm run sync/reply/threads`) use a separate IAM user or SSO profile with the same policy.

### 2. Email (Resend)

Emails go through Brevo (`BREVO_API_KEY`, sender on the authenticated `konihaus.ch` domain) or Resend (`RESEND_API_KEY`). With neither key the app prints emails to the log, which is handy locally.

### 3. Vercel

1. Import this repo as a **new project**. **Plan note:** Vercel's free Hobby plan is restricted to personal, non-commercial use
   ([Hobby plan](https://vercel.com/docs/plans/hobby), [fair use](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)) — a paid customer portal needs Pro (or another host).
2. Storage is **Safe Swiss Cloud** (S3-compatible, same account as the konihaus.ch dashboard): no OIDC needed. Only use OIDC (Settings → Security) if you move back to AWS.
3. Environment variables (see `.env.example`): `BASE_URL`, `SESSION_SECRET`, `S3_ENDPOINT` (`https://s3.ewstorage.ch`), `S3_REGION` (`ch-zh1`), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `BREVO_API_KEY`, `MAIL_FROM`, `ADMIN_EMAIL`. Tick **Sensitive** on the keys and the secrets.
   Before going live run `npm run s3check` once: it tests the conditional writes (create-only-if-new, update-only-if-unchanged) that the login links and messages depend on.
4. `vercel.json` pins functions to `fra1` (Frankfurt). Vercel's default is Washington, D.C.
5. Settings → Domains: add `my.konihaus.ch`, then create the DNS record Vercel shows (usually a CNAME).
   The `CNAME` file in this repo is a GitHub Pages leftover; Vercel ignores it and you can delete it.
6. Add a Vercel Firewall rate-limit rule for `POST /api/auth/request` (the in-app limiter is only best-effort per instance).

### 4. Local development

```bash
cp .env.example .env     # fill in values (use your own AWS profile; leave BREVO_API_KEY empty)
npm install
npm run dev              # http://localhost:3000 — login emails are printed in the terminal
npm test                 # no AWS needed
```

## Day-to-day

**Add or change a customer** — keep the JSON in your Obsidian vault, one folder per customer
(copy `examples/customers/c-demo/`), then upload:

```bash
npm run sync -- "path/to/vault/Konihaus/Customers" --dry-run
npm run sync -- "path/to/vault/Konihaus/Customers"
```

Sync writes only `profile.json`, `setup.json`, `subscription.json` and the email index. It never touches messages.
There is no separate invitation step: tell the customer to open `my.konihaus.ch` and enter their email address.
To lock someone out immediately set `"status": "disabled"` in `profile.json` and sync.

**Support messages** — you get an email for every new customer message. Then:

```bash
npm run threads                              # open threads waiting for you
npm run threads -- c-anna t-xxxx-yyyy        # read one conversation
npm run reply -- c-anna t-xxxx-yyyy "Ihre Antwort"
npm run reply -- c-anna t-xxxx-yyyy --close
```

The customer receives an email saying there is a reply (not the text itself) and reads it after signing in.

## Security notes

- Same neutral answer for known and unknown emails; login links are single use, 15 minutes, and need a click on a confirmation page (mail scanners cannot burn them).
- Session = signed httpOnly cookie, 14 days, scoped to `my.konihaus.ch`. Setting a customer to `disabled` takes effect on their next request.
- State-changing requests must be same-origin; strict CSP; all customer text is rendered with `textContent`.
- Customers can only reach `customers/{their own id}/…`; ids from URLs are validated.
- Not included yet: admin web UI, attachments, QR-bill/invoice generation, live device status.
- You store personal data about customers' homes — add a short privacy notice (Swiss nDSG) and have it reviewed.
