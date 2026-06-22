'use client';
// Vendor portal: request AI-generated product photos.
// Upload raw phone shots + description; admin picks up the request and runs
// the AI Photo Studio. When complete, vendor can view the variants.

import { useEffect, useState } from 'react';
import { Loader2, Camera, X, Sparkles } from 'lucide-react';

type Request = {
  id: string;
  description: string;
  proposedCategory: string | null;
  sourceImageUrls: string[];
  status: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
  adminNote: string | null;
  resultingJobId: string | null;
  createdAt: string;
  product: { id: string; name: string; slug: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-charcoal/10 text-charcoal/50',
};

export default function VendorAiPhotosPage() {
  const [rows, setRows] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  // New request form
  const [description, setDescription] = useState('');
  const [proposedCategory, setProposedCategory] = useState('');
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/vendor/ai-photo-requests');
      const data = await res.json();
      setRows(data.rows || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function uploadRawImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/vendor/upload', { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Upload failed — please ensure file is under 15 MB.');
        return;
      }
      const data = await res.json();
      if (data?.url) setSourceUrls(prev => [...prev, data.url]);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (sourceUrls.length === 0) {
      alert('Upload at least one phone shot.');
      return;
    }
    if (!description.trim()) {
      alert('Add a short description of the product.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/vendor/ai-photo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          proposedCategory: proposedCategory || undefined,
          sourceImageUrls: sourceUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to submit');
        return;
      }
      setDescription('');
      setProposedCategory('');
      setSourceUrls([]);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(id: string) {
    if (!confirm('Cancel this request? Once accepted by admin it cannot be cancelled.')) return;
    const res = await fetch(`/api/vendor/ai-photo-requests/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Request AI Photo Studio</h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Upload phone shots of a product and we&apos;ll generate studio-grade imagery for your listing. No professional photo shoot needed. The AI strictly preserves your product&apos;s exact design — colour, weave, motif, hardware.
        </p>
      </header>

      <section className="border border-mitti/20 bg-ivory p-5 mb-8">
        <h2 className="font-display text-lg uppercase tracking-wider mb-3 text-kohl">New request</h2>

        <label className="text-xs uppercase block mb-3">
          Product description (mandatory)
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. Pure Banarasi katan silk saree, indigo body with antique-zari pallu, 6.3m, hand-loom from Varanasi cluster"
            className="w-full mt-1 p-2 border border-mitti/20 text-sm normal-case bg-beige"
          />
        </label>

        <label className="text-xs uppercase block mb-3">
          Category hint (optional)
          <input
            value={proposedCategory}
            onChange={e => setProposedCategory(e.target.value)}
            placeholder="e.g. saree, lamp, jewellery-necklace, furniture, pottery"
            className="w-full mt-1 p-2 border border-mitti/20 text-sm normal-case bg-beige"
          />
        </label>

        <div className="mb-3">
          <div className="text-xs uppercase text-charcoal/60 mb-2">Raw phone shots (mandatory — 1 to 4 images)</div>
          <div className="grid grid-cols-4 gap-2">
            {sourceUrls.map((url, i) => (
              <div key={i} className="relative group">
                <img src={url} alt="" className="w-full aspect-square object-cover border border-mitti/20" />
                <button
                  onClick={() => setSourceUrls(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 bg-black/60 text-white p-1 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {sourceUrls.length < 4 && (
              <label className="aspect-square border-2 border-dashed border-mitti/30 flex flex-col items-center justify-center text-xs text-mitti hover:border-madder cursor-pointer">
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-4 h-4 mb-1" />
                    <span>Add</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) uploadRawImage(f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
          <p className="text-[11px] text-charcoal/50 mt-2">
            Best results from: well-lit (natural daylight), in-focus, full product visible, plain neutral background.
          </p>
        </div>

        <button
          onClick={submit}
          disabled={submitting || sourceUrls.length === 0 || !description.trim()}
          className="btn-primary inline-flex items-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {submitting ? 'Submitting…' : 'SUBMIT REQUEST'}
        </button>
      </section>

      <section>
        <h2 className="font-display text-lg uppercase tracking-wider mb-3 text-kohl">My requests</h2>
        {loading && <div className="text-sm text-charcoal/50">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="bg-beige/40 p-6 text-sm text-charcoal/60">
            No requests yet. Submit your first above.
          </div>
        )}
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.id} className="border border-charcoal/10 p-4 bg-ivory">
              <div className="flex justify-between items-start gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                    <span className="text-xs text-charcoal/50">
                      {new Date(r.createdAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {r.product && (
                    <div className="text-xs text-charcoal/60 mt-1">Linked to product: {r.product.name}</div>
                  )}
                </div>
                {r.status === 'SUBMITTED' && (
                  <button onClick={() => cancel(r.id)} className="text-xs underline text-rose-700">
                    Cancel
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap mb-2">{r.description}</p>
              {r.adminNote && (
                <div className="bg-beige/40 p-2 text-xs mt-2">
                  <strong>NEEJEE note:</strong> {r.adminNote}
                </div>
              )}
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mt-2">
                {r.sourceImageUrls.map((u, i) => (
                  <img key={i} src={u} alt="" className="w-full aspect-square object-cover border border-mitti/15" />
                ))}
              </div>
              {r.status === 'COMPLETED' && r.resultingJobId && (
                <VendorViewVariants requestId={r.id} />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function VendorViewVariants({ requestId }: { requestId: string }) {
  const [variants, setVariants] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/vendor/ai-photo-requests/${requestId}`)
      .then(r => r.json())
      .then(d => setVariants(d.job?.variants || []));
  }, [open, requestId]);

  return (
    <div className="mt-3">
      <button onClick={() => setOpen(o => !o)} className="text-xs underline">
        {open ? 'Hide variants' : 'View AI variants'}
      </button>
      {open && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          {variants.map(v => (
            <div key={v.id} className="relative">
              <img src={v.url} alt="" className="w-full aspect-square object-cover border border-mitti/15" />
              <div className="absolute top-1 left-1 bg-kohl/80 text-ivory text-[10px] tracking-widest px-2 py-0.5 uppercase">
                {v.sceneType}
              </div>
              {v.decision === 'APPROVED' && (
                <div className="absolute top-1 right-1 text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.5">
                  USED
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
