# NEEJEE — Email Deliverability Setup

These DNS records make sure transactional emails from `*@neejee.com` (order confirmations,
Founder's Circle updates, abandoned cart recovery, password resets) land in the inbox
and not the spam folder.

You add these records **once** at your domain registrar (likely GoDaddy / Namecheap /
Hostinger / Cloudflare — wherever neejee.com's nameservers point). After they propagate
(usually 5-60 minutes), every email gets cryptographically signed and verified.

---

## Records to add at your DNS host

Assuming you're using **Resend** as the mail provider (which the codebase is set up for).
If you switch providers, the same three record types apply but values change.

### 1. SPF — "Who can send mail as @neejee.com"

| Field | Value |
|---|---|
| Type | `TXT` |
| Host / Name | `@` (or leave blank — means the root `neejee.com`) |
| Value | `v=spf1 include:amazonses.com ~all` |
| TTL | 3600 |

> If you already have an SPF record (e.g. for Google Workspace), **merge them** — you can only have one SPF record per domain. Example:
> `v=spf1 include:_spf.google.com include:amazonses.com ~all`

### 2. DKIM — "These emails are cryptographically signed by us"

Get the exact values from **Resend dashboard → Domains → neejee.com → DNS records**. You'll see three CNAME records that look like:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Host | `resend._domainkey` |
| Value | `resend._domainkey.<random-id>.amazonses.com` |

Add all three exactly as shown.

### 3. DMARC — "What to do if SPF/DKIM fails"

Start in monitoring mode for a week:

| Field | Value |
|---|---|
| Type | `TXT` |
| Host | `_dmarc` |
| Value | `v=DMARC1; p=none; rua=mailto:dmarc@neejee.com; pct=100; adkim=s; aspf=s` |
| TTL | 3600 |

After one week of monitoring (you'll get aggregate reports at `dmarc@neejee.com`), tighten:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@neejee.com; pct=100; adkim=s; aspf=s
```

After another two weeks with no false-positives, lock down:

```
v=DMARC1; p=reject; rua=mailto:dmarc@neejee.com; pct=100; adkim=s; aspf=s
```

---

## Verifying it worked

After 60 minutes of DNS propagation, test:

1. **MXToolbox** — https://mxtoolbox.com/SuperTool.aspx
   - Run `spf:neejee.com` → should show `v=spf1 include:amazonses.com ~all`
   - Run `dmarc:neejee.com` → should show your DMARC record

2. **Send a test email** to a Gmail account you own:
   - Open the email in Gmail
   - Click the three-dot menu → "Show original"
   - Look for: `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`
   - If all three say PASS, you're done.

3. **Mail-tester.com** — send a test email to the address it gives you, then check your score. Target: **9/10 or higher**.

---

## Resend account verification

In your **Resend dashboard**:

1. Domains → Add domain → `neejee.com`
2. Verify the records you just added — Resend will show ✅ next to each
3. Go to **Settings → API Keys** → confirm `RESEND_API_KEY` matches your Vercel env var
4. Send a test email from the dashboard

If any record still says ❌ after 60 min:
- Check exact spelling (case-sensitive, no trailing spaces)
- Some registrars require `@` to be blank in the Host field
- Cloudflare users: ensure DKIM CNAMEs are **DNS-only** (grey cloud), not proxied (orange)

---

## What this fixes

Without these records:
- Gmail flags `*@neejee.com` mails as "promotional" or "spam" 30-60% of the time
- Order confirmation emails land in spam → customer support tickets
- Apple Mail puts the sender in "Junk"
- Anyone can spoof `nidhi@neejee.com` and send phishing as you

With these records:
- ~99% inbox placement on Gmail / Outlook / Apple Mail
- Anti-spoofing — no one can impersonate the brand
- Aggregate DMARC reports so you can see who's trying to abuse the domain
