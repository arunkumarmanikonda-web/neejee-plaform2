export type SendingDomain = { name?: string; status?: string; capabilities?: { sending?: string } };

export function senderAddress(): string {
  return (process.env.EMAIL_FROM || 'NEEJEE <hello@neejee.com>').trim().replace(/^["']|["']$/g,'').replace(/(?:\\r)?\\n$/,'').trim();
}

export function senderDomain(from: string): string {
  return from.match(/@([a-z\d.-]+)(?:>|$)/i)?.[1]?.toLowerCase() || '';
}

export function verifiedSender(domains: SendingDomain[], preferred: string): string | undefined {
  const eligible=domains.filter(d=>['verified','partially_verified'].includes(d.status?.toLowerCase() || '') && (!d.capabilities?.sending || d.capabilities.sending==='enabled')).map(d=>d.name?.toLowerCase()).filter((s):s is string=>!!s);
  if(eligible.includes(preferred)) return preferred;
  return eligible.find(s=>s==='neejee.com') || eligible.find(s=>s.endsWith('.neejee.com'));
}

export function sendingState(domains: SendingDomain[], preferred: string): string {
  const match = domains.find(d=>d.name?.toLowerCase()===preferred);
  const verified = verifiedSender(domains,preferred);
  if (verified === preferred && verified) return 'Sending verified for '+verified;
  if (verified) return 'Verified Neejee sender available on '+verified+'. Current sender domain: '+(preferred || 'unknown');
  return match ? (preferred+' · '+(match.status || 'unconfirmed')+' · sending '+(match.capabilities?.sending || 'unconfirmed')) : 'Sender domain '+(preferred || 'unknown')+' is absent from this Resend account';
}
