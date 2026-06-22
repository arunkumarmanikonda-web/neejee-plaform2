'use client';
/**
 * Admin → Taxonomy → Migrate Products
 *
 * Runs the AI-driven migration for products whose category is missing or
 * shallow (level < 3). Supports a Dry Run preview before committing.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

type Item = {
  productId: string;
  sku: string;
  oldCategory: string | null;
  newCategory?: string;
  newCategoryName?: string;
  newSku?: string | null;
  matchedBy?: string;
  createdHere?: string[];
  error?: string;
};

export default function MigrateProductsPage() {
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [regenerateSku, setRegenerateSku] = useState(false);
  const [limit, setLimit] = useState(25);
  const [result, setResult] = useState<{
    processed: number;
    updated: number;
    skipped: number;
    createdCategories: string[];
    items: Item[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/taxonomy/migrate-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, limit, regenerateSku, onlyMissingLeaf: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Migration failed');
      setResult(json);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/taxonomy"
        className="inline-flex items-center gap-1 text-xs text-mitti hover:text-kohl"
      >
        <ArrowLeft className="w-3 h-3" /> BACK TO TAXONOMY
      </Link>

      <div>
        <h1 className="font-display text-3xl text-kohl">Migrate products to new taxonomy</h1>
        <p className="font-italic italic text-mitti mt-1">
          AI re-points existing products to the right 3-level category. Missing
          sub-categories or leaves are auto-created from the product&apos;s name, craft and
          material.
        </p>
      </div>

      <div className="madder-divider"></div>

      <div className="bg-beige p-6 space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          <span>
            <strong>Dry run</strong> — preview the changes without writing to the database
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={regenerateSku}
            onChange={(e) => setRegenerateSku(e.target.checked)}
          />
          <span>Regenerate SKU to match new category (NEE-MAIN-SUB-LEAF-####)</span>
        </label>

        <div className="flex items-center gap-2 text-sm">
          <label>Batch size:</label>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-20 p-1 border border-mitti/30 bg-ivory"
          />
          <span className="text-xs text-mitti">(max 200 per run)</span>
        </div>

        <button
          onClick={run}
          disabled={running}
          className="px-4 py-2 bg-madder text-ivory text-xs tracking-widest inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles className="w-3 h-3" />
          {running ? 'RUNNING…' : dryRun ? 'PREVIEW MIGRATION' : 'RUN MIGRATION'}
        </button>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 p-4 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {err}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-ivory border border-mitti/20 p-4 grid grid-cols-4 gap-4 text-center">
            <Stat label="Processed" value={result.processed} />
            <Stat label="Will update" value={result.updated} />
            <Stat label="Skipped" value={result.skipped} />
            <Stat label="Categories created" value={result.createdCategories.length} />
          </div>

          {result.createdCategories.length > 0 && (
            <div className="bg-beige p-4 text-xs">
              <p className="label text-madder mb-2">NEW CATEGORIES CREATED BY AI</p>
              <div className="flex flex-wrap gap-2">
                {result.createdCategories.map((s) => (
                  <span key={s} className="px-2 py-1 bg-ivory border border-mitti/20 font-mono">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-ivory border border-mitti/10 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-beige text-mitti">
                <tr>
                  <th className="text-left p-2">SKU</th>
                  <th className="text-left p-2">Old</th>
                  <th className="text-left p-2">→ New</th>
                  <th className="text-left p-2">Via</th>
                  <th className="text-left p-2">New SKU</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((it) => (
                  <tr key={it.productId} className="border-t border-mitti/10">
                    <td className="p-2 font-mono">{it.sku}</td>
                    <td className="p-2 text-mitti">{it.oldCategory || '—'}</td>
                    <td className="p-2">
                      {it.newCategoryName ? (
                        <>
                          <span className="text-kohl">{it.newCategoryName}</span>
                          {it.createdHere && it.createdHere.length > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 bg-madder/10 text-madder text-[10px] rounded">
                              ✨ created
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-red-600">{it.error || 'No match'}</span>
                      )}
                    </td>
                    <td className="p-2 text-mitti">{it.matchedBy || '—'}</td>
                    <td className="p-2 font-mono">{it.newSku || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {dryRun && result.updated > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-4 text-sm flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-amber-700" />
              <span>
                Dry run looks good. Uncheck <strong>Dry run</strong> and click{' '}
                <strong>Run Migration</strong> to commit these changes.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-display text-3xl text-kohl">{value}</p>
      <p className="label text-mitti">{label}</p>
    </div>
  );
}
