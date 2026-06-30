'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckSquare,
  Square,
  X,
  Archive,
  CheckCircle2,
  Clock,
  FileEdit,
  Trash2,
} from 'lucide-react';
import { formatINR, effectivePricePaise } from '@/lib/money';

const FILTERS = ['ALL', 'ACTIVE', 'DRAFT', 'PENDING_QC', 'ARCHIVED'] as const;
const EXCLUDED_FILTERS = ['ALL', 'INCLUDED_ONLY', 'EXCLUDED_ONLY'] as const;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-neem',
  DRAFT: 'bg-mitti',
  PENDING_QC: 'bg-haldi',
  ARCHIVED: 'bg-monsoon',
  REJECTED: 'bg-madder',
};

function MerchBadge({
  show,
  label,
  tone = 'default',
}: {
  show: boolean;
  label: string;
  tone?: 'default' | 'hero' | 'good' | 'warn' | 'muted';
}) {
  if (!show) return null;

  const toneClass =
    tone === 'hero'
      ? 'bg-kohl text-ivory border-kohl'
      : tone === 'good'
      ? 'bg-neem/10 text-neem border-neem/30'
      : tone === 'warn'
      ? 'bg-haldi/15 text-kohl border-haldi/40'
      : tone === 'muted'
      ? 'bg-monsoon/10 text-monsoon border-monsoon/30'
      : 'bg-madder/10 text-madder border-madder/30';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-widest border ${toneClass}`}
    >
      {label}
    </span>
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [audience, setAudience] = useState('');
  const [excludedMode, setExcludedMode] = useState<string>('ALL');
  const [heroOnly, setHeroOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [bulkMsg, setBulkMsg] = useState('');

  const load = async (
    status: string,
    nextAudience: string,
    nextExcludedMode: string,
    nextHeroOnly: boolean
  ) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (status !== 'ALL') qs.set('status', status);
      if (nextAudience.trim()) qs.set('audience', nextAudience.trim());
      if (nextExcludedMode === 'INCLUDED_ONLY') qs.set('excluded', 'false');
      if (nextExcludedMode === 'EXCLUDED_ONLY') qs.set('excluded', 'true');
      if (nextHeroOnly) qs.set('hero', 'true');

      const url = qs.toString() ? `/api/admin/products?${qs.toString()}` : '/api/admin/products';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setProducts(data.products || []);
      setCounts(data.statusCounts || {});
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filter, audience, excludedMode, heroOnly);
  }, [filter, audience, excludedMode, heroOnly]);

  useEffect(() => {
    setSelected(new Set());
    setBulkMsg('');
  }, [filter, search, audience, excludedMode, heroOnly]);

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p: any) => {
      return [
        p.name,
        p.shortName,
        p.sku,
        p.slug,
        p.craft,
        p.region,
        p.material,
        p.catalogueAudienceTag,
      ]
        .filter(Boolean)
        .some((v: any) => String(v).toLowerCase().includes(q));
    });
  }, [products, search]);

  const audienceOptions = useMemo(() => {
    const vals = Array.from(
      new Set(
        products
          .map((p: any) => p.catalogueAudienceTag)
          .filter(Boolean)
          .map((v: any) => String(v).trim())
      )
    ).sort((a, b) => a.localeCompare(b));
    return vals;
  }, [products]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((p: any) => selected.has(p.id));
  const someVisibleSelected = filtered.some((p: any) => selected.has(p.id));

  const toggleSelectAll = () => {
    setBulkMsg('');
    if (allVisibleSelected) {
      const next = new Set(selected);
      filtered.forEach((p: any) => next.delete(p.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((p: any) => next.add(p.id));
      setSelected(next);
    }
  };

  const toggleOne = (id: string) => {
    setBulkMsg('');
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const runBulk = async (action: string, confirmMsg?: string) => {
    if (selected.size === 0) return;
    if (confirmMsg && !confirm(confirmMsg)) return;

    setBulkBusy(action);
    setBulkMsg('');
    setError('');

    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);

      const count = data.updated ?? data.deleted ?? 0;
      const skipped = data.skipped
        ? ` — skipped ${data.skipped} (${data.skippedReason || 'ineligible'})`
        : '';

      setBulkMsg(`✓ ${action.toLowerCase()}: ${count} product${count === 1 ? '' : 's'}${skipped}`);
      setSelected(new Set());
      await load(filter, audience, excludedMode, heroOnly);
      setTimeout(() => setBulkMsg(''), 6000);
    } catch (e: any) {
      setError(`Bulk ${action.toLowerCase()} failed: ${e.message}`);
    } finally {
      setBulkBusy(null);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <p className="label text-madder">CATALOG</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Products</h1>
          <p className="font-italic italic text-mitti mt-2">
            {filtered.length} of {total} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BulkPanel onImported={() => load(filter, audience, excludedMode, heroOnly)} statusFilter={filter} />
          <Link href="/admin/products/new" className="btn-primary">
            + ADD PRODUCT
          </Link>
        </div>
      </div>

      <div className="madder-divider mt-4"></div>

      {error && (
        <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">
          {error}
        </p>
      )}

      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2 font-ui text-xs tracking-widest flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 transition-colors ${
                  filter === f ? 'bg-kohl text-ivory' : 'bg-beige text-kohl hover:bg-mitti/20'
                }`}
              >
                {f.replace(/_/g, ' ')} {f === 'ALL' ? `(${total})` : counts[f] ? `(${counts[f]})` : ''}
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, slug, craft, audience..."
            className="w-80 max-w-full p-3 bg-beige border border-mitti/20 font-ui text-sm"
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="label text-mitti block mb-1">AUDIENCE</label>
            <input
              list="admin-products-audience-list"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="BRIDE / FESTIVE / GIFTING..."
              className="w-full p-2 bg-beige border border-mitti/20 font-ui text-sm"
            />
            <datalist id="admin-products-audience-list">
              {audienceOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="label text-mitti block mb-1">EXCLUDED</label>
            <select
              value={excludedMode}
              onChange={(e) => setExcludedMode(e.target.value)}
              className="w-full p-2 bg-beige border border-mitti/20 font-ui text-sm"
            >
              {EXCLUDED_FILTERS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'ALL' ? 'ALL' : opt === 'INCLUDED_ONLY' ? 'INCLUDED ONLY' : 'EXCLUDED ONLY'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 font-ui text-sm p-2 bg-beige border border-mitti/20 w-full min-h-[42px]">
              <input
                type="checkbox"
                checked={heroOnly}
                onChange={(e) => setHeroOnly(e.target.checked)}
              />
              Hero pinned only
            </label>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setAudience('');
                setExcludedMode('ALL');
                setHeroOnly(false);
              }}
              className="w-full p-2 border border-mitti/30 text-mitti text-xs uppercase tracking-widest hover:bg-mitti/10"
            >
              Reset catalogue filters
            </button>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-0 z-20 mt-6 bg-kohl text-ivory p-3 flex flex-wrap items-center gap-2 shadow">
          <span className="text-xs tracking-wider mr-2">
            <strong>{selected.size}</strong> selected
          </span>

          <button
            onClick={() => runBulk('ACTIVATE')}
            disabled={!!bulkBusy}
            className="px-3 py-1.5 bg-neem/90 hover:bg-neem text-ivory text-[11px] tracking-wider uppercase inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {bulkBusy === 'ACTIVATE' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Activate
          </button>

          <button
            onClick={() => runBulk('DRAFT')}
            disabled={!!bulkBusy}
            className="px-3 py-1.5 bg-mitti/60 hover:bg-mitti text-ivory text-[11px] tracking-wider uppercase inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {bulkBusy === 'DRAFT' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileEdit className="w-3 h-3" />} Set as Draft
          </button>

          <button
            onClick={() => runBulk('PENDING_QC')}
            disabled={!!bulkBusy}
            className="px-3 py-1.5 bg-haldi/80 hover:bg-haldi text-kohl text-[11px] tracking-wider uppercase inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {bulkBusy === 'PENDING_QC' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />} Send to QC
          </button>

          <button
            onClick={() =>
              runBulk(
                'ARCHIVE',
                `Archive ${selected.size} product${selected.size === 1 ? '' : 's'}? They will be hidden from customers but existing orders still fulfil.`
              )
            }
            disabled={!!bulkBusy}
            className="px-3 py-1.5 bg-monsoon/80 hover:bg-monsoon text-ivory text-[11px] tracking-wider uppercase inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {bulkBusy === 'ARCHIVE' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />} Archive
          </button>

          <button
            onClick={() =>
              runBulk(
                'DELETE',
                `DELETE ${selected.size} product${selected.size === 1 ? '' : 's'} permanently? Only products with NO order history will be deleted. This cannot be undone.`
              )
            }
            disabled={!!bulkBusy}
            className="px-3 py-1.5 bg-madder/80 hover:bg-madder text-ivory text-[11px] tracking-wider uppercase inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {bulkBusy === 'DELETE' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Delete (SUPER_ADMIN)
          </button>

          <div className="flex-1" />

          <button
            onClick={() => {
              setSelected(new Set());
              setBulkMsg('');
            }}
            className="px-3 py-1.5 border border-ivory/30 text-ivory text-[11px] tracking-wider uppercase inline-flex items-center gap-1.5 hover:bg-ivory/10"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}

      {bulkMsg && (
        <p className="mt-3 text-sm text-neem bg-neem/10 px-3 py-2">{bulkMsg}</p>
      )}

      <table className="w-full mt-6 font-ui text-sm bg-beige">
        <thead>
          <tr className="border-b border-mitti/20 text-left text-xs tracking-widest text-mitti">
            <th className="p-4 w-10">
              <button
                onClick={toggleSelectAll}
                title={allVisibleSelected ? 'Deselect visible' : 'Select all visible'}
                className="text-mitti hover:text-kohl"
              >
                {allVisibleSelected ? (
                  <CheckSquare className="w-4 h-4" />
                ) : someVisibleSelected ? (
                  <CheckSquare className="w-4 h-4 opacity-50" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
            </th>
            <th className="p-4">IMAGE</th>
            <th className="p-4">PRODUCT</th>
            <th className="p-4">SKU</th>
            <th className="p-4">PRICE</th>
            <th className="p-4">STOCK</th>
            <th className="p-4">MERCH</th>
            <th className="p-4">STATUS</th>
            <th className="p-4"></th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={9} className="p-8 text-center text-mitti">Loading...</td>
            </tr>
          )}

          {!loading && filtered.length === 0 && (
            <tr>
              <td colSpan={9} className="p-8 text-center text-mitti italic">No products found</td>
            </tr>
          )}

          {filtered.map((p: any) => {
            const eff = effectivePricePaise(p.sellingPrice, p.salePrice, p.saleStartsAt, p.saleEndsAt);
            const isSelected = selected.has(p.id);

            return (
              <tr
                key={p.id}
                className={`border-b border-mitti/10 hover:bg-ivory/50 ${isSelected ? 'bg-madder/5' : ''}`}
              >
                <td className="p-4 align-top">
                  <button
                    onClick={() => toggleOne(p.id)}
                    className={isSelected ? 'text-madder' : 'text-mitti hover:text-kohl'}
                    title={isSelected ? 'Deselect' : 'Select'}
                  >
                    {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </td>

                <td className="p-4 align-top">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="w-12 h-14 object-cover" />
                  ) : (
                    <div className="w-12 h-14 bg-ivory border border-mitti/20" />
                  )}
                </td>

                <td className="p-4 align-top">
                  <p className="font-display text-base">{p.name}</p>
                  {p.shortName && (
                    <p className="font-ui text-xs text-mitti mt-1">{p.shortName}</p>
                  )}
                  <p className="font-ui text-xs text-mitti mt-1">
                    {[p.craft, p.region, p.material].filter(Boolean).join(' · ')}
                  </p>
                  {p.catalogueAudienceTag && (
                    <p className="font-ui text-[11px] text-kohl mt-1">
                      Audience: <span className="font-mono">{p.catalogueAudienceTag}</span>
                    </p>
                  )}
                </td>

                <td className="p-4 align-top text-monsoon text-xs font-mono">
                  <div>{p.sku}</div>
                  {p.slug && <div className="mt-1">/{p.slug}</div>}
                </td>

                <td className="p-4 align-top">
                  {eff.onSale ? (
                    <>
                      <p className="font-medium text-madder">{formatINR(eff.price)}</p>
                      <p className="font-ui text-[11px] text-mitti line-through">{formatINR(p.sellingPrice)}</p>
                      <span className="inline-block mt-1 text-[10px] bg-madder text-ivory px-1.5 py-0.5">
                        SALE
                      </span>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">{formatINR(p.sellingPrice)}</p>
                      {p.mrp > p.sellingPrice && (
                        <p className="font-ui text-[11px] text-mitti line-through">{formatINR(p.mrp)}</p>
                      )}
                    </>
                  )}
                </td>

                <td className="p-4 align-top">
                  <span className={p.totalInventory === 0 ? 'text-madder' : p.lowStock ? 'text-haldi' : 'text-neem'}>
                    {p.totalInventory}
                  </span>
                  {p.totalInventory === 0 && <span className="ml-2 text-[10px] text-madder">OUT</span>}
                  {p.lowStock && p.totalInventory > 0 && <span className="ml-2 text-[10px] text-haldi">LOW</span>}
                  <div className="mt-1 text-[10px] text-mitti">
                    {p.catalogueStockVisibility || 'IN_STOCK_ONLY'}
                  </div>
                </td>

                <td className="p-4 align-top">
                  <div className="flex flex-wrap gap-1.5 max-w-[210px]">
                    <MerchBadge show={!!p.cataloguePinHero} label="Hero" tone="hero" />
                    <MerchBadge show={!!p.catalogueFeatured} label="Featured" tone="default" />
                    <MerchBadge show={!!p.catalogueBestseller} label="Bestseller" tone="good" />
                    <MerchBadge show={!!p.catalogueEditorial} label="Editorial" tone="warn" />
                    <MerchBadge show={!!p.catalogueExclude} label="Excluded" tone="muted" />
                    <MerchBadge show={!!p.catalogueImageApproved} label="Img OK" tone="good" />
                  </div>

                  {(p.catalogueImageQualityScore !== null && p.catalogueImageQualityScore !== undefined) && (
                    <p className="text-[10px] text-mitti mt-2">
                      Img score: <span className="font-mono">{p.catalogueImageQualityScore}</span>
                    </p>
                  )}

                  {p.catalogueCtaMode && (
                    <p className="text-[10px] text-mitti mt-1">
                      CTA: <span className="font-mono">{p.catalogueCtaMode}</span>
                    </p>
                  )}
                </td>

                <td className="p-4 align-top">
                  <span className={`badge-founder ${STATUS_COLOR[p.status] || 'bg-mitti'}`}>
                    {String(p.status || '').replace(/_/g, ' ')}
                  </span>
                </td>

                <td className="p-4 text-right align-top">
                  <Link href={`/admin/products/${p.id}`} className="text-madder text-xs hover:underline">
                    EDIT →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

interface ImportResult {
  rowIndex: number;
  rowType: 'PRODUCT' | 'VARIANT';
  status: 'created' | 'skipped' | 'error';
  message?: string;
  sku?: string;
  variantSku?: string;
}

function BulkPanel({ onImported, statusFilter }: { onImported: () => void; statusFilter: string }) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{
    summary: { total: number; productsCreated: number; variantsCreated: number; errored: number };
    results: ImportResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || 'Import failed');
      } else {
        setResult(d);
        onImported();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadExport = async () => {
    setExporting(true);
    try {
      const url =
        statusFilter === 'ALL'
          ? '/api/admin/products/export'
          : `/api/admin/products/export?status=${statusFilter}`;

      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const txt = await res.text();
        setError(`Export failed: ${txt}`);
        return;
      }

      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);

      const cd = res.headers.get('content-disposition') || '';
      const fname = (cd.match(/filename="([^"]+)"/) || [])[1] || 'neejee-inventory.xlsx';

      link.download = fname;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 border border-mitti/30 text-mitti text-xs uppercase tracking-wider hover:bg-mitti/10 inline-flex items-center gap-2"
      >
        <FileSpreadsheet className="w-4 h-4" /> Bulk
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-kohl/60 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-ivory border border-mitti/30 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display text-2xl text-kohl">Bulk inventory</h2>
                <p className="text-sm text-mitti mt-1">
                  Import draft products from Excel, or export the catalog with embedded images.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-mitti hover:text-kohl text-xl">×</button>
            </div>

            <div className="p-4 border border-mitti/20 bg-beige/20 mb-3">
              <div className="font-display text-lg text-kohl mb-1">1. Download blank template</div>
              <p className="text-xs text-mitti mb-3">
                One workbook, two sheets: <em>Products</em> and <em>How to use</em>.
                Mandatory: Name, Category slug, MRP, Selling Price. SKUs auto-generate.
              </p>
              <a
                href="/api/admin/products/template"
                className="inline-flex items-center gap-2 px-3 py-2 bg-kohl text-ivory text-xs uppercase tracking-wider hover:bg-madder"
              >
                <Download className="w-4 h-4" /> Download template (.xlsx)
              </a>
            </div>

            <div className="p-4 border border-mitti/20 bg-beige/20 mb-3">
              <div className="font-display text-lg text-kohl mb-1">2. Upload filled template</div>
              <p className="text-xs text-mitti mb-3">
                Every row becomes a DRAFT product. Add images, story, badges, AI-drafted copy from the editor afterwards, then publish.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onFile}
                disabled={importing}
                className="block w-full text-xs font-ui text-kohl
                  file:mr-3 file:py-2 file:px-3 file:border-0
                  file:bg-madder file:text-ivory file:text-xs file:uppercase file:tracking-wider
                  file:hover:opacity-90 file:cursor-pointer
                  disabled:opacity-50"
              />
              {importing && (
                <p className="text-xs text-mitti mt-2 inline-flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Reading workbook and creating drafts…
                </p>
              )}
            </div>

            <div className="p-4 border border-mitti/20 bg-beige/20">
              <div className="font-display text-lg text-kohl mb-1">3. Export current catalog</div>
              <p className="text-xs text-mitti mb-3">
                Downloads <strong>{statusFilter === 'ALL' ? 'all products' : `products in ${statusFilter} status`}</strong> with the first product image embedded in each row.
              </p>
              <button
                onClick={downloadExport}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-3 py-2 bg-kohl text-ivory text-xs uppercase tracking-wider hover:bg-madder disabled:opacity-50"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Building workbook…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 rotate-180" /> Export current view (.xlsx)
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-madder/10 border border-madder text-madder text-sm">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-4 p-3 bg-neem/10 border border-neem text-kohl text-sm">
                <div className="font-display text-base mb-1">
                  Imported {result.summary.productsCreated} product{result.summary.productsCreated === 1 ? '' : 's'}
                  {result.summary.variantsCreated > 0 &&
                    ` and ${result.summary.variantsCreated} variant${result.summary.variantsCreated === 1 ? '' : 's'}`} of {result.summary.total} rows
                </div>

                {result.summary.errored > 0 && (
                  <div className="text-madder text-xs mb-2">{result.summary.errored} row(s) had errors:</div>
                )}

                <div className="max-h-48 overflow-y-auto text-xs space-y-1 mt-2">
                  {result.results.map((r) => (
                    <div key={r.rowIndex} className={r.status === 'error' ? 'text-madder' : 'text-mitti'}>
                      Row {r.rowIndex} ({r.rowType}):{' '}
                      {r.status === 'created' && r.rowType === 'PRODUCT' && <>✓ product · SKU <strong>{r.sku}</strong></>}
                      {r.status === 'created' && r.rowType === 'VARIANT' && <>✓ variant <strong>{r.variantSku}</strong> on {r.sku}</>}
                      {r.status === 'error' && <>✗ {r.message}</>}
                      {r.status === 'skipped' && <>— {r.message || 'skipped'}</>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
