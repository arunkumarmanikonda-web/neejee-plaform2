'use client';
import { useEffect, useState, useRef } from 'react';
import { Loader2, Upload, FileText, Trash2 } from 'lucide-react';

const DOC_TYPES = [
  { v: 'PAN_CARD', l: 'PAN Card' },
  { v: 'GST_CERTIFICATE', l: 'GST Certificate' },
  { v: 'MSME_CERTIFICATE', l: 'MSME / Udyam Certificate' },
  { v: 'CANCELLED_CHEQUE', l: 'Cancelled Cheque' },
  { v: 'BANK_STATEMENT', l: 'Bank Statement (3 months)' },
  { v: 'ADDRESS_PROOF', l: 'Address Proof (utility / lease)' },
  { v: 'AADHAAR_SIGNATORY', l: 'Aadhaar of Signatory' },
  { v: 'SIGNATORY_PHOTO', l: 'Signatory Photo' },
  { v: 'SELLER_AGREEMENT', l: 'Signed Seller Agreement' },
  { v: 'PRODUCT_CATALOG', l: 'Product Catalog' },
  { v: 'CERTIFICATION', l: 'Craft Certification (GI / organic)' },
  { v: 'OTHER', l: 'Other' },
];

const STATUS = {
  SUBMITTED: { l: 'Under review', cls: 'bg-banarasi/20 text-banarasi' },
  APPROVED:  { l: 'Approved',     cls: 'bg-emerald-100 text-emerald-800' },
  REJECTED:  { l: 'Rejected',     cls: 'bg-madder/10 text-madder' },
  SUPERSEDED:{ l: 'Replaced',     cls: 'bg-mitti/20 text-mitti' },
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pickedType, setPickedType] = useState('');
  const [err, setErr] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/seller/documents');
    const j = await r.json();
    setDocs(j.documents || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const upload = async (file: File) => {
    setErr('');
    if (!pickedType) { setErr('Pick a document type first'); return; }
    if (file.size > 15 * 1024 * 1024) { setErr('Max file size 15 MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'sellers/documents');
      const uR = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const uJ = await uR.json();
      if (!uR.ok) throw new Error(uJ.error || 'Upload failed');
      const file0 = uJ.files?.[0] || uJ;
      const r = await fetch('/api/seller/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType: pickedType,
          fileName: file0.name || file.name,
          fileUrl: file0.url,
          fileSize: file0.size || file.size,
          mimeType: file.type,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setPickedType('');
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally { setUploading(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    const r = await fetch(`/api/seller/documents/${id}`, { method: 'DELETE' });
    if (!r.ok) { const j = await r.json(); alert(j.error); return; }
    load();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-3xl text-kohl">Documents</h1>
        <p className="text-mitti text-sm">PAN, GST, bank proof, agreements & certifications</p>
      </div>

      {/* Upload area */}
      <div className="bg-ivory border border-mitti/30 p-6 rounded">
        <h3 className="font-display text-lg text-kohl mb-3">Upload a document</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="label text-banarasi mb-1">DOCUMENT TYPE</p>
            <select value={pickedType} onChange={e => setPickedType(e.target.value)}
              className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory">
              <option value="">Choose…</option>
              {DOC_TYPES.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
            </select>
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault(); setDragging(false);
              const f = e.dataTransfer.files?.[0]; if (f) upload(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed cursor-pointer p-4 rounded text-center transition-colors ${
              dragging ? 'border-banarasi bg-banarasi/5' : 'border-mitti/30 hover:border-kohl'
            }`}>
            {uploading
              ? <><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Uploading…</>
              : <><Upload className="w-5 h-5 inline mr-2 text-banarasi" /><span className="text-sm">Drop file or click to browse</span></>
            }
            <input ref={inputRef} type="file" hidden accept="image/*,application/pdf"
              onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
        </div>
        <p className="text-xs text-mitti mt-3">JPG · PNG · WebP · PDF up to 15 MB. Drag-drop or browse — no URL fields.</p>
        {err && <div className="mt-3 bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}
      </div>

      {/* List */}
      <div className="bg-ivory border border-mitti/20 rounded overflow-hidden">
        {loading ? (
          <div className="text-mitti py-10 text-center"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</div>
        ) : docs.length === 0 ? (
          <div className="text-mitti py-10 text-center font-italic italic">No documents uploaded yet.</div>
        ) : (
          <table className="w-full font-ui text-sm">
            <thead className="bg-beige/50 text-mitti text-xs label">
              <tr>
                <th className="text-left p-3">TYPE</th>
                <th className="text-left p-3">FILE</th>
                <th className="text-center p-3">STATUS</th>
                <th className="text-left p-3">NOTE</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => {
                const s = (STATUS as any)[d.status] || { l: d.status, cls: 'bg-mitti/10 text-mitti' };
                return (
                  <tr key={d.id} className="border-t border-mitti/10">
                    <td className="p-3 text-kohl">{d.docType.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-mitti">
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-2">
                        <FileText className="w-3 h-3" /> {d.fileName}
                      </a>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] tracking-widest px-2 py-0.5 rounded ${s.cls}`}>{s.l}</span>
                    </td>
                    <td className="p-3 text-mitti text-xs">{d.reviewNote || '—'}</td>
                    <td className="p-3 text-right">
                      {d.status !== 'APPROVED' && (
                        <button onClick={() => del(d.id)} className="text-madder hover:opacity-70" title="Delete">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
