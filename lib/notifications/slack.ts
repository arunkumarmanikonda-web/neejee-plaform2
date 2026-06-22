// v23.40.19 — Slack webhook delivery (incoming-webhook API).
//
// Set SLACK_FINANCE_WEBHOOK_URL in your env (Vercel project settings) to
// receive AR aging, overdue bills, weekly P&L digests.
//
// Multiple webhooks supported via env:
//   SLACK_FINANCE_WEBHOOK_URL   — finance alerts (AR/AP, P&L, GST)
//   SLACK_OPS_WEBHOOK_URL       — ops alerts (low stock, errors)
//
// Block-kit blocks are accepted via `blocks`; for plain messages pass `text`.

export interface SlackPayload {
  /** Plain-text fallback (also used by mobile notifications) */
  text: string;
  /** Block-kit rich layout (optional) */
  blocks?: any[];
  /** Channel override — usually configured at the webhook level */
  channel?: string;
  /** Username override */
  username?: string;
  /** Icon emoji override (e.g. ':moneybag:') */
  icon_emoji?: string;
}

export type SlackChannel = 'finance' | 'ops';

function webhookUrlFor(channel: SlackChannel): string | null {
  switch (channel) {
    case 'finance': return process.env.SLACK_FINANCE_WEBHOOK_URL || null;
    case 'ops':     return process.env.SLACK_OPS_WEBHOOK_URL     || null;
  }
}

/** Send a message to Slack. Fails soft — never throws upstream. */
export async function postSlack(channel: SlackChannel, payload: SlackPayload): Promise<{ ok: boolean; error?: string }> {
  const url = webhookUrlFor(channel);
  if (!url) {
    console.warn(`[slack] No webhook URL configured for channel '${channel}'. Set SLACK_${channel.toUpperCase()}_WEBHOOK_URL.`);
    return { ok: false, error: 'no-webhook-configured' };
  }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: payload.username || 'NEEJEE Finance Bot',
        icon_emoji: payload.icon_emoji || ':moneybag:',
        text: payload.text,
        ...(payload.blocks ? { blocks: payload.blocks } : {}),
        ...(payload.channel ? { channel: payload.channel } : {}),
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.warn('[slack] webhook failed:', r.status, body);
      return { ok: false, error: `HTTP ${r.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    console.warn('[slack] post error:', e?.message);
    return { ok: false, error: e?.message };
  }
}

/** Block-kit helpers */
export const slack = {
  header: (text: string) => ({ type: 'header', text: { type: 'plain_text', text, emoji: true } }),
  section: (text: string) => ({ type: 'section', text: { type: 'mrkdwn', text } }),
  divider: () => ({ type: 'divider' }),
  fields: (pairs: Array<[string, string]>) => ({
    type: 'section',
    fields: pairs.map(([k, v]) => ({ type: 'mrkdwn', text: `*${k}*\n${v}` })),
  }),
  context: (text: string) => ({ type: 'context', elements: [{ type: 'mrkdwn', text }] }),
  button: (text: string, url: string) => ({
    type: 'actions',
    elements: [{ type: 'button', text: { type: 'plain_text', text, emoji: true }, url, style: 'primary' }],
  }),
};
