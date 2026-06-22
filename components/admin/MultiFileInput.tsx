'use client';
// v23.39.4 — Multi-file picker for finance documents (bills, expenses, receipts).
// Accepts MULTIPLE files: images (PNG/JPG/WebP), PDFs, Excel, CSV.
// Uses the finance upload endpoint (20 MB / file).
import { useRef, useState } from 'react';
import {
  Upload, Loader2, X, FileText, FileSpreadsheet, Image as ImageIcon, Plus, ExternalLink,
} from 'lucide-react';

interface Props {
  /** Array of uploaded file URLs (controlled). */
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  label?: string;
  helpText?: string;
  maxSizeMB?: number;
  maxFiles?: number;
  endpoint?: string;
  acceptTypes?: 'all' | 'docs' | 'images';
}

export function MultiFileInput({
  value,
  onChange,
  folder = 'finance',
  label = 'SUPPORTING FILES',
  helpText = 'Images (PNG/JPG/WebP), PDF, Excel, CSV — multiple files allowed',
  maxSizeMB = 20,
  maxFiles = 10,
  endpoint = '/api/admin/finance/upload',
  acceptTypes = 'all',
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Always treat value as an array, even if a single string was passed by older code.
  const urls: string[] = Array.isArray(value) ? value : (value ? [value as unknown as string] : []);

  const acceptAttr =
    acceptTypes === 'images' ? 'image/*' :
    acceptTypes === 'docs'   ? 'application/pdf,.pdf,.csv,.xlsx,.xls,.doc,.docx' :
    'image/*,application/pdf,.pdf,.csv,.xlsx,.xls,.doc,.docx';

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setError('');
    if (urls.length + list.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed (currently have ${urls.length}).`);
      return;
    }
    for (const f of list) {
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(`"${f.name}" is larger than ${maxSizeMB} MB.`);
        return;
      }
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of list) {
        const fd = new FormData();
        fd.append('folder', folder);
        fd.append('files', file);
        const res = await fetch(endpoint, { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to upload "${file.name}"`);
        const url: string = data.files?.[0]?.url;
        if (!url) throw new Error(`No URL returned for "${file.name}"`);
        uploaded.push(url);
      }
      onChange([...urls, ...uploaded]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAt = (idx: number) => {
    const next = urls.filter((_, i) => i !== idx);
    onChange(next);
  };

  const fileMeta = (url: string) => {
    const u = url.split('?')[0];
    const name = u.split('/').pop() || 'file';
    const isImage = /\.(png|jpe?g|webp|gif|avif)$/i.test(u);
    const isPdf = /\.pdf$/i.test(u);
    const isXlsx = /\.(xlsx?|csv)$/i.test(u);
    return { name, isImage, isPdf, isXlsx };
  };

  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <p className="text-[10px] tracking-wider text-mitti/70 mt-0.5">
        {helpText} · &lt;{maxSizeMB} MB each · up to {maxFiles} files
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
        className={`mt-2 border-2 border-dashed cursor-pointer transition-colors p-6 text-center
          ${dragging ? 'border-kohl bg-kohl/5' : 'border-mitti/30 bg-beige/30 hover:bg-beige/50'}`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-mitti text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-mitti">
            <Upload className="w-6 h-6" />
            <div className="font-ui text-xs tracking-widest">
              DRAG &amp; DROP FILES OR CLICK TO BROWSE
            </div>
            <div className="text-[10px] tracking-wider text-mitti/70">
              {helpText}
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={acceptAttr}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="mt-2 text-xs text-madder bg-madder/10 border border-madder/30 px-2 py-1">
          {error}
        </div>
      )}

      {/* Uploaded list */}
      {urls.length > 0 && (
        <ul className="mt-3 space-y-2">
          {urls.map((url, i) => {
            const m = fileMeta(url);
            return (
              <li key={url + i} className="flex items-center gap-3 border border-mitti/20 bg-ivory p-2">
                <div className="w-10 h-10 flex items-center justify-center bg-beige/40 border border-mitti/20 shrink-0">
                  {m.isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={m.name} className="w-full h-full object-cover" />
                  ) : m.isPdf ? (
                    <FileText className="w-5 h-5 text-madder" />
                  ) : m.isXlsx ? (
                    <FileSpreadsheet className="w-5 h-5 text-banarasi" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-mitti" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-ui truncate text-kohl">{m.name}</div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] tracking-wider text-banarasi hover:underline inline-flex items-center gap-1"
                  >
                    OPEN <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeAt(i); }}
                  className="p-1 text-mitti hover:text-madder"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {urls.length > 0 && urls.length < maxFiles && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-2 inline-flex items-center gap-1 text-xs font-ui tracking-widest text-banarasi hover:text-kohl"
        >
          <Plus className="w-3 h-3" /> ADD MORE
        </button>
      )}
    </div>
  );
}

export default MultiFileInput;
