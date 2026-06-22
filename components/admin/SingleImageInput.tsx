'use client';
// Single-image picker for CMS blocks - upload, paste URL, or drag-drop.
// Shows recommended dimensions inline.
import { useRef, useState } from 'react';
import { Upload, Loader2, X, Link as LinkIcon } from 'lucide-react';

interface Props {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  recommendedSize?: string;     // e.g. "2400 × 1200 px"
  recommendedAspect?: string;   // e.g. "2:1 landscape"
  maxSizeMB?: number;
  endpoint?: string;            // override upload endpoint (default: /api/admin/upload)
}

export function SingleImageInput({
  value,
  onChange,
  folder = 'cms',
  label = 'IMAGE',
  recommendedSize = '2400 × 1200 px',
  recommendedAspect = '2:1 landscape',
  maxSizeMB = 5,
  endpoint = '/api/admin/upload',
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG / JPG / WebP)');
      return;
    }
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

  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <p className="text-[10px] tracking-wider text-mitti/70 mt-0.5">
        Recommended: {recommendedSize} · {recommendedAspect} · &lt;{maxSizeMB} MB · PNG / JPG / WebP
      </p>

      {value ? (
        <div className="relative mt-2 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-full h-40 object-cover border border-mitti/20" />
          <button
            onClick={() => onChange('')}
            className="absolute top-2 right-2 bg-kohl/80 text-ivory p-1.5 hover:bg-madder"
            title="Remove image"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
              <p className="text-xs tracking-wider text-kohl">DROP IMAGE OR CLICK TO BROWSE</p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
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
