const RESEND_API = 'https://api.resend.com';

type DeliveryResult = {
  ok: true;
  id: string | null;
  from: string;
};

type ResendDomain = {
  name?: string;
  status?: string;
  capabilities?: {
    sending?: string;
  };
};

function normalizeSecret(value: unknown): string {
  let normalized = String(value ?? '').trim();

  // Vercel values are occasionally pasted with surrounding quotes, an env-var
  // assignment prefix, or even the word `Bearer`. Any of those make an otherwise
  // valid Resend key fail with "API key is invalid".
  normalized = normalized.replace(/^RESEND_API_KEY\s*=\s*/i, '').trim();
  normalized = normalized.replace(/^Bearer\s+/i, '').trim();

  for (let i = 0; i < 2; i += 1) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (
      normalized.length >= 2 &&
      ((first === '"' && last === '"') ||
        (first === "'" && last === "'") ||
        (first === '`' && last === '`'))
    ) {
      normalized = normalized.slice(1, -1).trim();
    }
  }

  return normalized.replace(/[\r\n\t]/g, '').trim();
}

function resolveResendKey(): string {
  const candidates = [
    process.env.RESEND_API_KEY,
    process.env.RESEND_KEY,
    process.env.RESEND_API_TOKEN,
    process.env.EMAIL_RESEND_API_KEY,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSecret(candidate);
    if (normalized) return normalized;
  }

  return '';
}

function normalizeFrom(value: unknown): string {
  let from = String(value ?? '').trim();
  const first = from[0];
  const last = from[from.length - 1];
  if (
    from.length >= 2 &&
    ((first === '"' && last === '"') ||
      (first === "'" && last === "'") ||
      (first === '`' && last === '`'))
  ) {
    from = from.slice(1, -1).trim();
  }
  return from;
}

function fromDomain(from: string): string | null {
  const match = String(from || '').match(/<([^<>\s]+@[^<>\s]+)>/);
  const address = match?.[1] || String(from || '').trim();
  const at = address.lastIndexOf('@');
  return at >= 0 ? address.slice(at + 1).toLowerCase() : null;
}

async function postEmail(input: {
  key: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const response = await fetch(`${RESEND_API}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function findVerifiedSendingDomain(key: string, preferredDomain: string | null) {
  try {
    const response = await fetch(`${RESEND_API}/domains`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);
    const domains: ResendDomain[] = Array.isArray(payload?.data) ? payload.data : [];
    const verified = domains.filter((domain) => {
      const status = String(domain?.status || '').toLowerCase();
      const sending = String(domain?.capabilities?.sending || '').toLowerCase();
      return Boolean(domain?.name) &&
        (status === 'verified' || status === 'partially_verified') &&
        (sending === 'enabled' || sending === '');
    });

    if (!verified.length) return null;

    if (preferredDomain) {
      const exact = verified.find((domain) => String(domain.name).toLowerCase() === preferredDomain);
      if (exact?.name) return exact.name;

      const related = verified.find((domain) =>
        preferredDomain.endsWith(`.${String(domain.name).toLowerCase()}`) ||
        String(domain.name).toLowerCase().endsWith(`.${preferredDomain}`),
      );
      if (related?.name) return related.name;
    }

    const neejee = verified.find((domain) => String(domain.name).toLowerCase().endsWith('neejee.com'));
    return neejee?.name || verified[0]?.name || null;
  } catch {
    return null;
  }
}

export async function sendSellerTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<DeliveryResult> {
  const key = resolveResendKey();
  if (!key) {
    throw new Error('Seller email service is not configured. Please contact NEEJEE support.');
  }

  // Never print the key. This diagnostic is intentionally limited to safe shape
  // information so production logs can distinguish a malformed env value from
  // a provider-side revoked credential.
  if (!key.startsWith('re_')) {
    console.warn('[seller-email] Resend credential has unexpected format', {
      length: key.length,
      prefixLength: key.slice(0, 3).length,
    });
  }

  const configuredFrom = normalizeFrom(process.env.EMAIL_FROM || 'NEEJEE <hello@neejee.com>');
  const first = await postEmail({
    key,
    from: configuredFrom,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (first.response.ok) {
    console.info('[seller-email] sent', {
      id: first.data?.id || null,
      fromDomain: fromDomain(configuredFrom),
      subject: input.subject.slice(0, 160),
    });
    return { ok: true, id: first.data?.id || null, from: configuredFrom };
  }

  const firstMessage = String(first.data?.message || first.data?.error?.message || '').slice(0, 300);
  const firstCode = String(first.data?.name || first.data?.error?.name || '').toLowerCase();
  console.warn('[seller-email] primary sender rejected', {
    status: first.response.status,
    code: firstCode || null,
    message: firstMessage || null,
    fromDomain: fromDomain(configuredFrom),
    subject: input.subject.slice(0, 160),
  });

  // A common Resend 400 occurs when EMAIL_FROM points at a domain that is not
  // verified for this API key. If another verified sending domain exists on the
  // same Resend account, retry from that domain instead of falsely reporting
  // success to the seller.
  if (first.response.status === 400 || firstCode === 'validation_error') {
    const verifiedDomain = await findVerifiedSendingDomain(key, fromDomain(configuredFrom));
    if (verifiedDomain && verifiedDomain !== fromDomain(configuredFrom)) {
      const fallbackFrom = `NEEJEE <hello@${verifiedDomain}>`;
      const retry = await postEmail({
        key,
        from: fallbackFrom,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });

      if (retry.response.ok) {
        console.info('[seller-email] sent via verified fallback domain', {
          id: retry.data?.id || null,
          fromDomain: verifiedDomain,
          subject: input.subject.slice(0, 160),
        });
        return { ok: true, id: retry.data?.id || null, from: fallbackFrom };
      }

      console.warn('[seller-email] fallback sender rejected', {
        status: retry.response.status,
        code: retry.data?.name || retry.data?.error?.name || null,
        message: String(retry.data?.message || retry.data?.error?.message || '').slice(0, 300) || null,
        fromDomain: verifiedDomain,
        subject: input.subject.slice(0, 160),
      });
    }
  }

  throw new Error(
    firstMessage
      ? `Email provider rejected the verification email: ${firstMessage}`
      : 'Email provider rejected the verification email. Please contact NEEJEE support.',
  );
}
