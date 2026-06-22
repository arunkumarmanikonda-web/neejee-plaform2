'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload, Loader2, FileText, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react';

const DOC_TYPES = [
  { key: 'PAN_CARD',          label: 'PAN card' },
  { key: 'GST_CERTIFICATE',   label: 'GST certificate' },
  { key: 'MSME_CERTIFICATE',  label: 'MSME / Udyam certificate' },
  { key: 'CANCELLED_CHEQUE',  label: 'Cancelled cheque' },
  { key: 'BANK_STATEMENT',    label: 'Bank statement (last 3 months)' },
  { key: 'ADDRESS_PROOF',     label: 'Address proof' },
  { key: 'AADHAAR_SIGNATORY', label: 'Aadhaar of authorised signatory' },
  { key: 'SIGNATORY_PHOTO',   label: 'Signatory photo' },
  { key: 'VENDOR_AGREEMENT',  label: 'Signed vendor agreement' },
  { key: 'OTHER',             label: 'Other' },
];

export default function VendorDocumentsPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeType, setActiveType] = useState<string>('PAN_CARD');
  const [dragging, setDragging] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/vendor/documents', { cache: 'no-store' });
    const d = await r.json();
    setDocs(d.documents || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (file: File) => {
    setMsg(null); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', activeType);
      const r = await fetch('/api/vendor/documents', { method: 'POST', body: fd, credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Upload failed');
      setMsg({ kind: 'ok', text: `Uploaded: ${file.name}. Awaiting NEEJEE finance review.` });
      await load();
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message });
    } finally { setUploading(false); }
  };

  const deleteDoc = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    const r = await fetch(`/api/vendor/documents/${id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) { setMsg({ kind: 'err', text: d?.error || 'Delete failed' }); return; }
    await load();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8 space-y-5">
      <header>
        <h1 className="font-display text-3xl text-kohl">Documents</h1>
        <p className="text-sm text-mitti mt-1">
          Upload your business documents. Drag &amp; drop or click to browse. Accepted: JPG, PNG, WebP, PDF (max 15 MB).
        </p>
      </header>

      {/* Upload box */}
      <section className="bg-ivory border border-mitti/15 p-5 space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-mitti">Document type</span>
          <select value={activeType} onChange={e => setActiveType(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm font-ui">
            {DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleUpload(f);
          }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragging ? 'border-madder bg-haldi/15' : 'border-mitti/30 hover:border-madder/60 bg-beige/50'
          }`}
        >
          <Upload className="w-8 h-8 mx-auto text-mitti mb-2" />
          <p className="text-sm text-kohl">
            {uploading ? 'Uploading…' : <>Drop a file here, or <span className="text-madder underline">browse</span></>}
          </p>
          <p className="text-[10px] text-mitti mt-1">JPG · PNG · WebP · PDF · max 15 MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
          />
        </div>

        {msg && (
          <div className={`p-3 text-sm border ${msg.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-madder/5 border-madder/30 text-madder'}`}>
            {msg.text}
          </div>
        )}
      </section>

      {/* Document list */}
      <section className="bg-ivory border border-mitti/15">
        <div className="px-5 py-3 border-b border-mitti/15">
          <h2 className="font-display text-lg text-kohl">Uploaded documents ({docs.length})</h2>
        </div>
        {loading ? (
          <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>
        ) : docs.length === 0 ? (
          <div className="p-8 text-center text-sm text-mitti italic">No documents uploaded yet.</div>
        ) : (
          <ul>
            {docs.map(d => (
              <li key={d.id} className="border-t border-mitti/10 px-5 py-4 flex items-center gap-3">
                <FileText className="w-5 h-5 text-mitti shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-kohl hover:text-madder truncate">{d.fileName}</a>
                    {d.uploadedOnBehalf && <span className="text-[9px] uppercase tracking-widest text-mitti">uploaded by admin</span>}
                  </div>
                  <p className="text-[11px] text-mitti">{labelForType(d.docType)} · {(d.fileSize / 1024).toFixed(0)} KB · {new Date(d.createdAt).toLocaleDateString()}</p>
                  {d.reviewNote && <p className="text-[11px] text-mitti italic mt-1">Reviewer note: {d.reviewNote}</p>}
                </div>
                <DocStatusBadge status={d.status} />
                {d.status !== 'APPROVED' && (
                  <button onClick={() => deleteDoc(d.id)} className="text-mitti hover:text-madder" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function labelForType(t: string): string {
  return DOC_TYPES.find(x => x.key === t)?.label || t;
}

function DocStatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED')  return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-green-800 bg-green-100 px-2 py-1"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
  if (status === 'REJECTED')  return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-madder bg-madder/10 px-2 py-1"><XCircle className="w-3 h-3" /> Rejected</span>;
  if (status === 'SUPERSEDED')return <span className="text-[10px] uppercase tracking-widest text-mitti">Replaced</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-mitti bg-haldi/20 px-2 py-1"><Clock className="w-3 h-3" /> Under review</span>;
}
