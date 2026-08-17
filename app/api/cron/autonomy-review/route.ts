import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type Proposal = {
  title?: string;
  domain?: string;
  riskClass?: string;
  summary?: string;
  rationale?: string;
  evidence?: any[];
  proposedChange?: any;
  testPlan?: any[];
  rollbackPlan?: any;
  metrics?: any;
};

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && (req.headers.get('authorization') || '') === `Bearer ${secret}`;
}

function extractOutputText(response: any): string {
  if (typeof response?.output_text === 'string') return response.output_text;
  const out = Array.isArray(response?.output) ? response.output : [];
  for (const item of out) {
    if (!Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if (part?.type === 'output_text' && typeof part?.text === 'string') return part.text;
    }
  }
  return '';
}

function parseJsonArray(text: string): Proposal[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.proposals) ? parsed.proposals : [];
}

function normalizeRisk(value: unknown): 'A' | 'B' | 'C' {
  const risk = String(value || '').toUpperCase();
  return risk === 'A' || risk === 'B' || risk === 'C' ? risk : 'B';
}

function proposalHash(p: Proposal) {
  const stable = JSON.stringify({
    title: String(p.title || '').trim().toLowerCase(),
    domain: String(p.domain || '').trim().toLowerCase(),
    summary: String(p.summary || '').trim().toLowerCase(),
  });
  return createHash('sha256').update(stable).digest('hex');
}

async function snapshot() {
  const [catalogue, recentOrders, pendingProposals] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(`
      select
        (select count(*)::int from "Product" where status = 'ACTIVE') as "activeProducts",
        (select count(*)::int from "Category" where active = true) as "activeCategories",
        (select count(*)::int from "Variant" where inventory > 0) as "stockedVariants"
    `).catch(() => [{}]),
    prisma.$queryRawUnsafe<any[]>(`
      select count(*)::int as count
      from "Order"
      where "createdAt" >= now() - interval '30 days'
    `).catch(() => [{ count: 0 }]),
    prisma.$queryRawUnsafe<any[]>(`
      select count(*)::int as count
      from private.autonomy_proposal
      where status in ('PROPOSED','APPROVED')
    `).catch(() => [{ count: 0 }]),
  ]);

  return {
    catalogue: catalogue[0] || {},
    ordersLast30Days: Number(recentOrders[0]?.count || 0),
    pendingReleaseProposals: Number(pendingProposals[0]?.count || 0),
    runtime: {
      database: !!process.env.DATABASE_URL,
      razorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      resend: !!process.env.RESEND_API_KEY,
      aiText: !!process.env.OPENAI_API_KEY,
      storage: !!(process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)),
    },
  };
}

async function run() {
  const policyRows = await prisma.$queryRawUnsafe<any[]>(`
    select enabled, web_research_enabled as "webResearchEnabled",
           max_proposals_per_run as "maxProposalsPerRun"
      from private.autonomy_policy where id = 1
  `);
  const policy = policyRows[0];
  if (!policy?.enabled) return NextResponse.json({ ok: true, skipped: 'autonomy_disabled' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: true, skipped: 'openai_not_configured' });

  const state = await snapshot();
  const maxProposals = Math.max(1, Math.min(10, Number(policy.maxProposalsPerRun || 5)));
  const model = process.env.AUTONOMY_RESEARCH_MODEL || 'gpt-5';

  const instructions = `You are NEEJEE's autonomous ecommerce improvement researcher. NEEJEE is a premium Indian craft commerce brand. Permanent brand line: FOUND. PERSONAL.

Research CURRENT primary-source best practices and propose only evidence-backed improvements. Use web search when available. Prefer primary sources such as Google Search Central / Merchant Center, web.dev, OWASP/CISA, Next.js/Vercel, OpenAI, payment/shipping provider documentation, and applicable Indian regulatory sources. Do not use SEO folklore or fabricate benchmarks.

Return STRICT JSON only as an array with at most ${maxProposals} objects. Each object must have:
{"title":"short release title","domain":"SEO|SEM|CONTENT|MERCHANDISING|PERFORMANCE|ACCESSIBILITY|SECURITY|AI|OPERATIONS|ANALYTICS|CONVERSION","riskClass":"A|B|C","summary":"what should improve","rationale":"why this matters for NEEJEE now","evidence":[{"source":"publisher/title","url":"https://...","finding":"concise evidence"}],"proposedChange":{"scope":"...","implementation":"..."},"testPlan":["specific pre-release check","specific post-release check"],"rollbackPlan":{"trigger":"...","action":"..."},"metrics":{"primary":"...","guardrails":["..."]}}

Risk policy: A = reversible content/metadata/merchandising. B = UX, analytics, caching, automation or integration behaviour. C = auth, payments, inventory, privacy/security, schema, core platform or infrastructure.

Never recommend silent auto-deployment. All proposals are Super Admin review items. Preserve existing working commerce behaviour. Do not suggest changing the approved logo or tagline. Do not propose keyword stuffing or mass low-value AI content. Focus on user value, crawlability, product data quality, conversion quality, performance, accessibility, security, measurement and operational resilience.`;

  const input = `Current NEEJEE operational snapshot:\n${JSON.stringify(state, null, 2)}\n\nResearch current best practices and return only the highest-value proposals materially applicable to this platform. Avoid generic or duplicate advice.`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      instructions,
      input,
      tools: policy.webResearchEnabled ? [{ type: 'web_search' }] : [],
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    console.error('[autonomy-review] OpenAI request failed', { status: response.status });
    return NextResponse.json({ error: 'research provider failed' }, { status: 502 });
  }

  const payload = await response.json();
  let proposals: Proposal[] = [];
  try {
    proposals = parseJsonArray(extractOutputText(payload)).slice(0, maxProposals);
  } catch {
    console.error('[autonomy-review] invalid research JSON');
    return NextResponse.json({ error: 'invalid research output' }, { status: 502 });
  }

  let inserted = 0;
  for (const p of proposals) {
    const title = String(p.title || '').trim().slice(0, 240);
    const summary = String(p.summary || '').trim().slice(0, 4000);
    const domain = String(p.domain || 'OPERATIONS').trim().toUpperCase().slice(0, 40);
    if (!title || !summary) continue;
    const hash = proposalHash(p);
    const risk = normalizeRisk(p.riskClass);

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      insert into private.autonomy_proposal
        (title, domain, risk_class, summary, rationale, evidence, proposed_change,
         test_plan, rollback_plan, metrics, source, model, proposal_hash, created_by)
      values
        ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,
         'autonomous-web-research',$11,$12,'neejee-autonomy')
      on conflict (proposal_hash) do nothing
      returning id
    `,
      title,
      domain,
      risk,
      summary,
      String(p.rationale || '').slice(0, 6000),
      JSON.stringify(Array.isArray(p.evidence) ? p.evidence : []),
      JSON.stringify(p.proposedChange || {}),
      JSON.stringify(Array.isArray(p.testPlan) ? p.testPlan : []),
      JSON.stringify(p.rollbackPlan || {}),
      JSON.stringify(p.metrics || {}),
      model,
      hash,
    );

    if (rows[0]?.id) {
      inserted += 1;
      await prisma.$executeRawUnsafe(`
        insert into private.autonomy_event (proposal_id, action, actor_id, payload)
        values ($1::uuid, 'PROPOSED', 'neejee-autonomy', jsonb_build_object('model',$2,'riskClass',$3))
      `, rows[0].id, model, risk);
    }
  }

  return NextResponse.json({ ok: true, researched: proposals.length, inserted, pendingBefore: state.pendingReleaseProposals });
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return run();
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return run();
}
