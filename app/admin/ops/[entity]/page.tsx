import { notFound } from 'next/navigation';
import { getCrudEntityBySlug } from '../_lib/entities';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    entity: string;
  };
};

export default function AdminOpsEntityPage({ params }: PageProps) {
  const entity = getCrudEntityBySlug(params.entity);

  if (!entity) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                CRUD Workspace
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {entity.title}
              </h1>
              <p className="mt-2 text-sm text-slate-400">{entity.subtitle}</p>
            </div>

            <div className="flex gap-2">
              <a
                href="/admin/ops"
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
              >
                Back to ops
              </a>
              <a
                href={entity.href}
                className="rounded-lg border border-cyan-700 px-3 py-2 text-sm text-cyan-300 hover:border-cyan-500 hover:text-cyan-200"
              >
                Open live surface
              </a>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-medium text-white">Operator summary</h2>
            <p className="mt-3 text-sm text-slate-400">{entity.description}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-sm font-medium text-white">Primary surface</div>
                <div className="mt-2 text-sm text-slate-400">{entity.href}</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-sm font-medium text-white">Domain</div>
                <div className="mt-2 text-sm text-slate-400">{entity.domain}</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm font-medium text-white">Available actions</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {entity.actions.map((action) => (
                  <a
                    key={`${entity.slug}-${action.id}`}
                    href={action.href}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500 hover:text-white"
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-medium text-white">UX consistency</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-400">
              <li>• Standard action layout for list, create, bulk, and review flows</li>
              <li>• Single workspace path for operator entry</li>
              <li>• Clear handoff from workspace shell to live admin surface</li>
              <li>• Searchable via command center and ops registry</li>
            </ul>

            <div className="mt-6 flex flex-wrap gap-2">
              {entity.badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300"
                >
                  {badge}
                </span>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}