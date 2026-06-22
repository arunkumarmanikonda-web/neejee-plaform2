'use client';
import { useRef, useState } from 'react';
import { Upload, X, MoveUp, MoveDown, Loader2 } from 'lucide-react';

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  folder?: string;
  max?: number;
  label?: string;
  endpoint?: string;
}

export function ImageUploader({ images, onChange, folder = 'products', max = 10, label = 'PRODUCT IMAGES', endpoint = '/api/admin/upload' }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setError(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('folder', folder);
      Array.from(files).forEach(f => fd.append('files', f));
      const res = await fetch(endpoint, { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const urls: string[] = data.files.map((f: any) => f.url);
      const newList = [...images, ...urls].slice(0, max);
      onChange(newList);
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const remove = (i: number) => {
    const next = images.filter((_, idx) => idx !== i);
    onChange(next);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label text-mitti">{label}</p>
        <p className="font-ui text-xs text-mitti">{images.length}/{max}</p>
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {images.map((url, i) => (
            <div key={url + i} className="relative group bg-ivory border border-mitti/20 aspect-square overflow-hidden">
              <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 left-1 bg-madder text-ivory text-[10px] px-2 py-0.5 tracking-widest font-ui">
                  PRIMARY
                </span>
              )}
              <div className="absolute inset-0 bg-kohl/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  className="p-1.5 bg-ivory text-kohl rounded disabled:opacity-30" title="Move up">
                  <MoveUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1}
                  className="p-1.5 bg-ivory text-kohl rounded disabled:opacity-30" title="Move down">
                  <MoveDown className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => remove(i)}
                  className="p-1.5 bg-madder text-ivory rounded" title="Remove">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {images.length < max && (
        <div
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-mitti/30 hover:border-madder transition-colors cursor-pointer p-8 text-center bg-beige/50">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={e => e.target.files && upload(e.target.files)}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-mitti">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-ui text-sm">Uploading...</span>
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-mitti mx-auto" />
              <p className="font-ui text-sm text-kohl mt-2">Drop images here or click to upload</p>
              <p className="font-ui text-xs text-mitti mt-1">JPG, PNG, WEBP up to 10MB · first image is the primary</p>
            </>
          )}
        </div>
      )}

      {error && <p className="font-ui text-xs text-madder">{error}</p>}
    </div>
  );
}
