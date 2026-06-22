'use client';
// v23.38 — File picker for finance documents (bills, receipts, statements).
// Supports images, PDFs, Excel, CSV. Larger size limit than image-only picker.
import { useRef, useState } from 'react';
import { Upload, Loader2, X, Link as LinkIcon, FileText, FileSpreadsheet, ImageIcon } from 'lucide-react';

interface Props {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  helpText?: string;
  maxSizeMB?: number;
  endpoint?: string;
  acceptTypes?: 'all' | 'docs' | 'images';
}

export function SingleFileInput({
  value,
  onChange,
  folder = 'finance',
  label = 'DOCUMENT',
  helpText = 'PDF, JPG, PNG, WebP, Excel, CSV',
  maxSizeMB = 20,
  endpoint = '/api/admin/finance/upload',
  acceptTypes = 'all',
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const acceptAttr =
    acceptTypes === 'images' ? 'image/*' :
    acceptTypes === 'docs'   ? 'application/pdf,.pdf,.csv,.xlsx,.xls,.doc,.docx' :
    'image/*,application/pdf,.pdf,.csv,.xlsx,.xls,.doc,.docx';

  const handleFiles = async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    setError('');
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File is larger than ${maxSizeMB} MB`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('folder', folder);
      fd.append('files', file);
      const res = await fetch(endpoint, { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const url: string = data.files?.[0]?.url;
      if (!url) throw new Error('No URL returned from upload');
      onChange(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const isImage = value && /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(value);
  const isPdf = value && /\.pdf(\?.*)?$/i.test(value);
  const isXlsx = value && /\.(xlsx?|csv)(\?.*)?$/i.test(value);

  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <p className="text-[10px] tracking-wider text-mitti/70 mt-0.5">
        {helpText} · &lt;{maxSizeMB} MB
      </p>

      {value ? (
        <div className="relative mt-2 group border border-mitti/20 bg-beige/30 p-3">
          <div className="flex items-center gap-3">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" className="w-16 h-16 object-cover border border-mitti/20" />
            ) : isPdf ? (
              <div className="w-16 h-16 flex items-center justify-center bg-madder/10 border border-madder/30">
                <FileText className="w-8 h-8 text-madder" />
              </div>
            ) : isXlsx ? (
              <div className="w-16 h-16 flex items-center justify-center bg-green-100 border border-green-300">
                <FileSpreadsheet className="w-8 h-8 text-green-700" />
              </div>
            ) : (
              <div className="w-16 h-16 flex items-center justify-center bg-mitti/10 border border-mitti/30">
                <FileText className="w-8 h-8 text-mitti" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <a href={value} target="_blank" rel="noreferrer" className="text-xs text-kohl hover:text-madder break-all underline">
                {value.split('/').pop()?.split('?')[0] || 'View file'}
              </a>
              <p className="text-[10px] text-mitti/70 mt-1">
                Click filename to open in new tab
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChange('')}
              className="bg-kohl/80 text-ivory p-1.5 hover:bg-madder"
              title="Remove file"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          className={`mt-2 border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
            dragging ? 'border-madder bg-madder/5' : 'border-mitti/30 hover:border-kohl bg-beige/30'
          }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-mitti">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Uploading…</span>
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-mitti/60 mx-auto mb-2" />
              <p className="text-xs tracking-wider text-kohl">DROP FILE OR CLICK TO BROWSE</p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={acceptAttr}
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[10px] tracking-wider text-mitti hover:text-kohl flex items-center gap-1"
        >
          <LinkIcon className="w-3 h-3" />
          {showUrlInput ? 'CLOSE URL INPUT' : 'OR PASTE A URL'}
        </button>
      </div>

      {showUrlInput && (
        <div className="flex gap-2 mt-2">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://…"
            className="flex-1 p-2 bg-ivory border border-mitti/20 text-sm"
          />
          <button
            type="button"
            onClick={() => { if (urlInput.trim()) { onChange(urlInput.trim()); setUrlInput(''); setShowUrlInput(false); } }}
            className="px-3 py-2 bg-kohl text-ivory text-xs tracking-wider"
          >
            USE
          </button>
        </div>
      )}

      {error && <p className="text-madder text-xs mt-2">{error}</p>}
    </div>
  );
}
