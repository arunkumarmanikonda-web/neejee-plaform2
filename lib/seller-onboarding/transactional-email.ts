import { senderAddress, senderDomain as fromDomain, verifiedSender, type SendingDomain } from '../resend-sender';
const RESEND_API = 'https://api.resend.com';

type DeliveryResult = {
  ok: true;
  id: string | null;
  from: string;
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

export function resolveResendKey(): string {
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

async function postEmail(input: {
  key: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
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
      ...(input.replyTo ? {reply_to:input.replyTo} : {}),
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
    const domains: SendingDomain[] = Array.isArray(payload?.data) ? payload.data : [];
    return verifiedSender(domains,preferredDomain || '') || null;
  } catch {
    return null;
  }
}

export async function sendResendEmail(input: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<DeliveryResult> {
  const key = resolveResendKey();
  if (!key) {
    throw new Error('Neejee email service needs a sending key.');
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

  const configuredFrom = senderAddress();
  const first = await postEmail({
    key,
    from: configuredFrom,
    to: input.to,
    subject: input.subject,
    html: input.html,
    replyTo:input.replyTo,
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
  // verified for this API key. If another verified Neejee sending domain exists on the
  // same Resend account, retry from that domain instead of falsely reporting
  // success to the seller.
  if ([400,403,422].includes(first.response.status) && /domain|sender|from address/i.test(firstMessage)) {
    const verifiedDomain = await findVerifiedSendingDomain(key, fromDomain(configuredFrom));
    if (verifiedDomain && verifiedDomain !== fromDomain(configuredFrom)) {
      const fallbackFrom = `NEEJEE <hello@${verifiedDomain}>`;
      const retry = await postEmail({
        key,
        from: fallbackFrom,
        to: input.to,
        subject: input.subject,
        html: input.html,
        replyTo:input.replyTo,
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

export const sendSellerTransactionalEmail = sendResendEmail;
