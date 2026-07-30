import Link from 'next/link';
import { Sparkles, Check, X, Wand2, PenSquare, Megaphone, Link2, Settings2, ArrowRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import TaxonomyAiPlannerPage from '../taxonomy/ai/page';
import AdminMetaIntegrationsPage from '../integrations/meta/page';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SurfaceKey = 'taxonomy' | 'meta' | null;

async function getStats() {
  try {
    const [total, mirror, space, recent] = await Promise.all([
      prisma.aiPreview.count(),
      prisma.aiPreview.count({ where: { type: 'MIRROR' } }),
      prisma.aiPreview.count({ where: { type: 'SPACE' } }),
      prisma.aiPreview.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } },
      }),
    ]);
    return { total, mirror, space, recent };
  } catch {
    return { total: 0, mirror: 0, space: 0, recent: [] as any[] };
  }
}

function StatusPill({ active, onText, offText }: { active: boolean; onText: string; offText: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${active ? 'bg-neem/15 text-neem' : 'bg-mitti/15 text-mitti'}`}>
      {active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {active ? onText : offText}
    </span>
  );
}

function SurfaceCard({
  title,
  desc,
  href,
  eyebrow,
  status,
}: {
  title: string;
  desc: string;
  href: string;
  eyebrow: string;
  status: string;
}) {
  return (
    <Link href={href} className="block rounded-2xl border border-mitti/15 bg-white p-5 hover:border-kohl/30 hover:bg-beige/30 transition-colors">
      <p className="label text-madder">{eyebrow}</p>
      <div className="flex items-start justify-between gap-3 mt-2">
        <h3 className="font-display text-2xl text-kohl">{title}</h3>
        <ArrowRight className="w-4 h-4 text-mitti mt-1 shrink-0" />
      </div>
      <p className="font-ui text-sm text-mitti mt-3 leading-6">{desc}</p>
      <p className="font-ui text-xs text-kohl mt-4 tracking-[0.18em]">{status}</p>
    </Link>
  );
}

function resolveSurface(raw: string | string[] | undefined): SurfaceKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'taxonomy') return 'taxonomy';
  if (value === 'meta') return 'meta';
  return null;
}

export default async function AdminAI({
  searchParams,
}: {
  searchParams?: Promise<{ surface?: string | string[] }> | { surface?: string | string[] };
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const surface = resolveSurface(resolvedSearchParams?.surface);

  const taxonomyHref = '/admin/ai?surface=taxonomy';
  const metaHref = '/admin/ai?surface=meta';

  const falOn = !!process.env.FAL_KEY;
  const replicateOn = !!process.env.REPLICATE_API_TOKEN;
  const imageOn = falOn || replicateOn;
  const openaiOn = !!process.env.OPENAI_API_KEY;
  const stats = await getStats();

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label text-madder">AI OPS CENTER</p>
          <h1 className="font-display text-4xl text-kohl mt-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-madder" /> AI Manager
          </h1>
          <p className="font-ui text-sm text-mitti mt-3 max-w-4xl leading-7">
            One place to monitor the live AI stack and jump straight into the admin surfaces that already use AI:
            SEO drafting, campaign planning, CMS scaffolding, creative generation, taxonomy planning, and Meta-linked marketing operations.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill active={openaiOn} onText="OpenAI ready" offText="OpenAI missing" />
          <StatusPill active={imageOn} onText="Image stack ready" offText="Image stack missing" />
        </div>
      </div>

      {surface ? (
        <section className="rounded-2xl border border-madder/20 bg-madder/5 p-6">
          <p className="label text-madder">RECOVERY ACCESS SURFACE</p>
          <h2 className="font-display text-3xl text-kohl mt-2">
            {surface === 'taxonomy' ? 'Taxonomy AI Planner' : 'Meta Account Center'}
          </h2>
          <p className="font-ui text-sm text-mitti mt-3 leading-7 max-w-4xl">
            This surface is being served through the known-live AI Manager route so admin users can keep operating while direct route exposure is verified in production.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link href="/admin/ai" className="bg-kohl text-ivory px-4 py-2 rounded-sm text-sm font-medium">
              AI MANAGER HOME
            </Link>
            <Link href={taxonomyHref} className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white">
              OPEN TAXONOMY PLANNER
            </Link>
            <Link href={metaHref} className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white">
              OPEN META CENTER
            </Link>
            <Link href="/admin/taxonomy" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white">
              OPEN TAXONOMY ROOT
            </Link>
            <Link href="/admin/marketing-studio" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white">
              OPEN MARKETING STUDIO
            </Link>
          </div>
        </section>
      ) : null}

      {surface === 'taxonomy' ? (
        <section className="rounded-2xl border border-mitti/15 bg-white p-4">
          <TaxonomyAiPlannerPage />
        </section>
      ) : null}

      {surface === 'meta' ? (
        <section className="rounded-2xl border border-mitti/15 bg-white p-4">
          <AdminMetaIntegrationsPage />
        </section>
      ) : null}

      <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-mitti/15 bg-beige p-5">
          <p className="label text-madder">TEXT AI</p>
          <p className="font-display text-kohl text-3xl mt-2">{openaiOn ? 'ON' : 'OFF'}</p>
          <p className="font-ui text-xs text-mitti mt-2">Used by SEO draft, SEO audit, campaign planning, taxonomy planning, and CMS scaffold.</p>
        </div>
        <div className="rounded-2xl border border-mitti/15 bg-beige p-5">
          <p className="label text-madder">IMAGE AI</p>
          <p className="font-display text-kohl text-3xl mt-2">{imageOn ? 'ON' : 'OFF'}</p>
          <p className="font-ui text-xs text-mitti mt-2">Used by AI Mirror, AI Space, and creative image workflows.</p>
        </div>
        <div className="rounded-2xl border border-mitti/15 bg-white p-5">
          <p className="label text-madder">TOTAL GENERATIONS</p>
          <p className="font-display text-kohl text-3xl mt-2">{stats.total}</p>
          <p className="font-ui text-xs text-mitti mt-2">Recent AI preview records stored in the platform.</p>
        </div>
        <div className="rounded-2xl border border-mitti/15 bg-white p-5">
          <p className="label text-madder">IMAGE BREAKDOWN</p>
          <p className="font-display text-kohl text-3xl mt-2">{stats.mirror + stats.space}</p>
          <p className="font-ui text-xs text-mitti mt-2">Mirror: {stats.mirror}  Space: {stats.space}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-mitti/15 bg-gradient-to-br from-madder/10 to-banarasi/10 p-6">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-madder" />
          <p className="label text-madder">AI-ENABLED ADMIN SURFACES</p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mt-5">
          <SurfaceCard
            eyebrow="SEARCH"
            title="SEO Control Plane"
            desc="Run AI draft and AI audit for default metadata, social preview copy, canonical base, and robots rules."
            href="/admin/seo"
            status="LIVE AI DRAFT + AUDIT"
          />
          <SurfaceCard
            eyebrow="GROWTH"
            title="Campaign Planner"
            desc="Generate a founder-led offer plan, code structure, timing, and channel copy before creating coupons."
            href="/admin/campaigns"
            status="LIVE AI PLANNER"
          />
          <SurfaceCard
            eyebrow="CONTENT"
            title="CMS AI Workbench"
            desc="Create one or many AI-drafted CMS pages from structured briefs, then open each draft in CMS editing."
            href="/admin/cms/ai"
            status="LIVE AI BATCH WORKBENCH"
          />
          <SurfaceCard
            eyebrow="CONTENT"
            title="Taxonomy AI Workbench"
            desc="Batch-plan taxonomy nodes, review parent placement and starter SEO, then approve and create only the categories you want."
            href={taxonomyHref}
            status="LIVE WORKBENCH VIA AI MANAGER"
          />
          <SurfaceCard
            eyebrow="CREATIVE"
            title="Marketing Studio"
            desc="Generate campaign-ready creative outputs and copy variants across Instagram, email, and web formats."
            href="/admin/marketing-studio"
            status="LIVE AI GENERATION"
          />
          <SurfaceCard
            eyebrow="SOCIAL"
            title="Meta Account Center"
            desc="Review connected Facebook Pages and Instagram business accounts, posting readiness, and operating links."
            href={metaHref}
            status="LIVE WORKBENCH VIA AI MANAGER"
          />
          <SurfaceCard
            eyebrow="CONFIG"
            title="Settings"
            desc="Manage OPENAI, FAL, Replicate, and other runtime keys that switch AI surfaces on or off."
            href="/admin/settings"
            status="RUNTIME CONTROL"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-mitti/15 bg-white p-6">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-madder" />
          <p className="label text-madder">LIVE CONFIGURATION</p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
          <div className={`rounded-xl border p-4 ${openaiOn ? 'border-neem/30 bg-neem/5' : 'border-mitti/20 bg-beige/40'}`}>
            <p className="font-display text-xl text-kohl">OpenAI</p>
            <p className="text-xs text-mitti mt-2">SEO draft/audit, campaign planning, taxonomy planning, CMS scaffold</p>
            <p className={`text-xs mt-3 tracking-[0.18em] ${openaiOn ? 'text-neem' : 'text-mitti'}`}>{openaiOn ? 'CONFIGURED' : 'MISSING'}</p>
          </div>
          <div className={`rounded-xl border p-4 ${falOn ? 'border-neem/30 bg-neem/5' : 'border-mitti/20 bg-beige/40'}`}>
            <p className="font-display text-xl text-kohl">FAL</p>
            <p className="text-xs text-mitti mt-2">Mirror, Space, creative imaging</p>
            <p className={`text-xs mt-3 tracking-[0.18em] ${falOn ? 'text-neem' : 'text-mitti'}`}>{falOn ? 'CONFIGURED' : 'MISSING'}</p>
          </div>
          <div className={`rounded-xl border p-4 ${replicateOn ? 'border-neem/30 bg-neem/5' : 'border-mitti/20 bg-beige/40'}`}>
            <p className="font-display text-xl text-kohl">Replicate</p>
            <p className="text-xs text-mitti mt-2">Legacy image fallback where supported</p>
            <p className={`text-xs mt-3 tracking-[0.18em] ${replicateOn ? 'text-neem' : 'text-mitti'}`}>{replicateOn ? 'CONFIGURED' : 'MISSING'}</p>
          </div>
          <Link href="/admin/settings" className="rounded-xl border border-kohl/15 bg-white p-4 hover:bg-beige/30">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-madder" />
              <p className="font-display text-xl text-kohl">Open Settings</p>
            </div>
            <p className="text-xs text-mitti mt-2">Review env keys and runtime health in one place.</p>
            <p className="text-xs mt-3 tracking-[0.18em] text-kohl">CONFIG SURFACE</p>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-mitti/15 bg-white p-6">
        <div className="flex items-center gap-2">
          <PenSquare className="w-5 h-5 text-madder" />
          <p className="label text-madder">RECENT AI GENERATIONS</p>
        </div>

        {stats.recent.length === 0 ? (
          <p className="text-sm text-mitti mt-4">No AI previews yet.</p>
        ) : (
          <div className="overflow-x-auto mt-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mitti/20">
                  <th className="text-left p-3 label text-mitti">WHEN</th>
                  <th className="text-left p-3 label text-mitti">USER</th>
                  <th className="text-left p-3 label text-mitti">SURFACE</th>
                  <th className="text-left p-3 label text-mitti">CONSENT</th>
                  <th className="text-left p-3 label text-mitti">AUTO-DELETE</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((r: any) => (
                  <tr key={r.id} className="border-b border-mitti/10">
                    <td className="p-3 text-sm text-kohl">{new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="p-3 text-sm text-mitti">{r.user?.email || r.user?.name || ''}</td>
                    <td className="p-3 text-sm text-kohl">{r.type}</td>
                    <td className="p-3 text-sm">{r.consentLogged ? <Check className="w-4 h-4 text-neem" /> : <X className="w-4 h-4 text-madder" />}</td>
                    <td className="p-3 text-sm text-mitti">{new Date(r.deleteAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-mitti/15 bg-beige p-6">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-madder" />
          <p className="label text-madder">CURRENT AI STACK</p>
        </div>
        <p className="font-ui text-sm text-mitti mt-3 leading-7">
          SEO draft and audit, campaign planner, CMS scaffold, taxonomy planning, and Meta account operations are grouped behind one AI operations entrypoint.
          Settings remains the runtime source of truth for keys and service health.
        </p>
      </section>
    </div>
  );
}