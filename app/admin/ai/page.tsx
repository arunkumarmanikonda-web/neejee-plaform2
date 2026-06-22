import { Sparkles, Check, X } from 'lucide-react';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    return { total: 0, mirror: 0, space: 0, recent: [] };
  }
}

export default async function AdminAI() {
  const falOn = !!process.env.FAL_KEY;
  const replicateOn = !!process.env.REPLICATE_API_TOKEN;
  const imageOn = falOn || replicateOn;
  const openaiOn = !!process.env.OPENAI_API_KEY;
  const stats = await getStats();

  return (
    <>
      <p className="label text-madder">AI COMMERCE</p>
      <h1 className="font-display text-4xl text-kohl mt-2 flex items-center gap-3">
        <Sparkles className="w-8 h-8 text-madder" /> AI Manager
      </h1>
      <p className="font-italic italic text-mitti mt-2">Mirror · Space · Gift Concierge · Content Assistant</p>
      <div className="madder-divider mt-4"></div>

      {/* Surface status grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
        <SurfaceCard name="AI Mirror" desc="Virtual try-on" provider="fal.ai / FASHN v1.5" active={imageOn} count={stats.mirror} />
        <SurfaceCard name="AI Space" desc="Room placement" provider="fal.ai / Flux Kontext" active={imageOn} count={stats.space} />
        <SurfaceCard name="Gift Concierge" desc="Recommendations" provider="OpenAI" active={openaiOn} />
        <SurfaceCard name="Content Assistant" desc="Copy generation" provider="OpenAI" active={openaiOn} />
      </div>

      {/* Quick config */}
      {(!imageOn || !openaiOn) && (
        <section className="bg-beige p-8 mt-12 border-l-4 border-haldi">
          <p className="label text-mitti mb-3">⚠ ACTIVATE AI SURFACES</p>
          <p className="font-italic italic text-mitti mb-4">
            Add these env vars at Vercel → Settings → Environment Variables, then redeploy.
          </p>
          <div className="bg-ivory p-4 font-mono text-xs space-y-1">
            {!imageOn && <p><span className="text-madder">FAL_KEY</span> = xxxxxxxxxx (https://fal.ai/dashboard/keys) — powers Mirror & Space</p>}
            {!openaiOn && <p><span className="text-madder">OPENAI_API_KEY</span> = sk-xxxxxxxx (https://platform.openai.com/api-keys) — powers Gift Concierge & Content Assistant</p>}
          </div>
        </section>
      )}

      {/* Recent generations */}
      <section className="mt-12">
        <p className="label text-madder mb-4">RECENT GENERATIONS ({stats.total} total)</p>
        {stats.recent.length === 0 ? (
          <p className="text-mitti text-sm">No AI previews yet. Customers must opt-in before any generation.</p>
        ) : (
          <table className="w-full">
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
              {stats.recent.map(r => (
                <tr key={r.id} className="border-b border-mitti/10">
                  <td className="p-3 text-sm text-kohl">{new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="p-3 text-sm text-mitti">{r.user?.email || '—'}</td>
                  <td className="p-3 text-sm text-kohl">{r.type}</td>
                  <td className="p-3 text-sm">{r.consentLogged ? <Check className="w-4 h-4 text-neem" /> : <X className="w-4 h-4 text-madder" />}</td>
                  <td className="p-3 text-sm text-mitti">{new Date(r.deleteAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function SurfaceCard({ name, desc, provider, active, count }: { name: string; desc: string; provider: string; active: boolean; count?: number }) {
  return (
    <div className={`p-6 border ${active ? 'border-neem/40 bg-neem/5' : 'border-mitti/20 bg-beige/40'}`}>
      <div className="flex items-start justify-between">
        <p className="font-display text-xl text-kohl">{name}</p>
        {active ? <Check className="w-4 h-4 text-neem" /> : <X className="w-4 h-4 text-mitti/40" />}
      </div>
      <p className="text-xs text-mitti mt-1">{desc}</p>
      <p className="text-[10px] tracking-wider text-mitti mt-4">{provider}</p>
      <p className={`text-xs tracking-wider mt-1 ${active ? 'text-neem' : 'text-mitti/60'}`}>
        {active ? 'ACTIVE' : 'NOT CONFIGURED'}
      </p>
      {count !== undefined && (
        <p className="text-xs text-mitti mt-3">{count} generations</p>
      )}
    </div>
  );
}
