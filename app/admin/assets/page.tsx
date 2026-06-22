'use client';
import { useEffect, useState, useRef } from 'react';
import { Upload, Search, Trash2, Copy, Check, X, Image as ImageIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Asset {
  id: string;
  url: string;
  filename: string | null;
  folder: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  alt: string | null;
  caption: string | null;
  tags: string[];
  createdAt: string;
}

export default function AdminAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [selected, setSelected] = useState<Asset | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (folder) qs.set('folder', folder);
    if (search) qs.set('q', search);
    fetch(`/api/admin/assets?${qs.toString()}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.assets) setAssets(d.assets); if (d.folders) setFolders(d.folders); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [folder]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let success = 0, failed = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress(`Uploading ${i + 1} of ${files.length}: ${f.name}`);
      try {
        // Use existing /api/admin/upload (multipart) endpoint
        const fd = new FormData();
        fd.append('file', f);
        fd.append('folder', 'assets');
        const upRes = await fetch('/api/admin/upload', {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        const upJson = await upRes.json();
        if (!upRes.ok || !upJson.uploads?.[0]) throw new Error(upJson.error || 'Upload failed');
        const uploaded = upJson.uploads[0];

        // Get image dimensions
        const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
          const img = new window.Image();
          img.onload = () => resolve({ w: img.width, h: img.height });
          img.onerror = () => resolve(null);
          img.src = uploaded.url;
        });

        // Register in asset library
        await fetch('/api/admin/assets', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: uploaded.url,
            filename: f.name,
            folder: 'assets',
            width: dims?.w,
            height: dims?.h,
            size: f.size,
            contentType: f.type,
          }),
        });
        success++;
      } catch (e: any) {
        console.error('Upload failed:', e);
        failed++;
      }
    }
    setUploading(false);
    setProgress('');
    if (failed > 0) alert(`${success} uploaded, ${failed} failed`);
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this asset? (The image file in Supabase storage is NOT removed.)')) return;
    await fetch('/api/admin/assets', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setSelected(null);
    load();
  };

  const updateMeta = async (id: string, updates: any) => {
    await fetch('/api/admin/assets', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    load();
  };

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="label text-madder">MEDIA</p>
          <h1 className="font-display text-4xl text-kohl">Asset Library</h1>
          <p className="font-italic italic text-mitti mt-1">Every image, found and reused.</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-primary flex items-center gap-2"
        >
          <Upload className="w-4 h-4" /> {uploading ? 'UPLOADING...' : 'UPLOAD ASSETS'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={e => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {progress && (
        <div className="bg-banarasi/10 border border-banarasi/30 p-3 text-sm font-italic italic text-kohl">
          {progress}
        </div>
      )}

      {/* Search + folder filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mitti" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search filename, alt, caption..."
            className="w-full p-3 pl-10 bg-beige border border-mitti/20 font-ui"
          />
        </div>
        <select
          value={folder || ''}
          onChange={e => setFolder(e.target.value || null)}
          className="p-3 bg-beige border border-mitti/20 font-ui"
        >
          <option value="">All folders</option>
          {folders.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <span className="text-sm text-mitti">{assets.length} asset{assets.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-center text-mitti font-italic italic py-12">Gathering images...</p>
      ) : assets.length === 0 ? (
        <div className="border border-dashed border-mitti/30 p-16 text-center">
          <ImageIcon className="w-16 h-16 text-mitti/40 mx-auto mb-4" />
          <p className="font-display text-2xl text-kohl">No assets yet</p>
          <p className="text-mitti text-sm mt-2">Upload your first images using the button above.</p>
          <p className="font-italic italic text-mitti text-xs mt-4">
            Note: Existing product/CMS images aren&apos;t automatically catalogued. New uploads from now on appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {assets.map(a => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className="group relative aspect-square bg-mitti/10 overflow-hidden hover:ring-2 hover:ring-madder"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.alt || ''} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-kohl/0 group-hover:bg-kohl/40 transition-colors flex items-end p-2">
                <div className="text-xs text-ivory opacity-0 group-hover:opacity-100 truncate w-full text-left">
                  {a.filename || 'untitled'}
                </div>
              </div>
              {a.folder && (
                <span className="absolute top-2 left-2 text-[10px] tracking-wider bg-kohl/60 text-ivory px-1.5 py-0.5">
                  {a.folder}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <AssetDetail
          asset={selected}
          onClose={() => setSelected(null)}
          onDelete={() => del(selected.id)}
          onUpdate={(updates) => { updateMeta(selected.id, updates); setSelected({ ...selected, ...updates }); }}
          onCopy={() => copy(selected.url)}
          copied={copied === selected.url}
        />
      )}
    </div>
  );
}

function AssetDetail({ asset, onClose, onDelete, onUpdate, onCopy, copied }: {
  asset: Asset;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (updates: any) => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const [alt, setAlt] = useState(asset.alt || '');
  const [caption, setCaption] = useState(asset.caption || '');

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-ivory max-w-4xl w-full p-6 my-auto grid md:grid-cols-2 gap-6">
        <div className="bg-mitti/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.url} alt={asset.alt || ''} className="w-full h-auto" />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-xl text-kohl">{asset.filename || 'Untitled'}</p>
            <button onClick={onClose}><X className="w-5 h-5" /></button>
          </div>

          <div className="space-y-2 text-sm text-mitti">
            {asset.folder && <p><span className="label text-mitti">FOLDER:</span> {asset.folder}</p>}
            {(asset.width && asset.height) && <p><span className="label text-mitti">DIMENSIONS:</span> {asset.width} × {asset.height} px</p>}
            {asset.size && <p><span className="label text-mitti">SIZE:</span> {(asset.size / 1024).toFixed(1)} KB</p>}
            <p><span className="label text-mitti">UPLOADED:</span> {new Date(asset.createdAt).toLocaleDateString()}</p>
          </div>

          <div>
            <label className="label text-mitti">URL</label>
            <div className="flex gap-2 mt-1">
              <input
                readOnly
                value={asset.url}
                className="flex-1 p-2 bg-beige border border-mitti/20 font-mono text-xs"
              />
              <button onClick={onCopy} className="px-3 py-2 bg-kohl text-ivory hover:bg-kohl/90 text-xs flex items-center gap-1">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'COPIED' : 'COPY'}
              </button>
            </div>
          </div>

          <div>
            <label className="label text-mitti">ALT TEXT</label>
            <input
              value={alt}
              onChange={e => setAlt(e.target.value)}
              onBlur={() => alt !== (asset.alt || '') && onUpdate({ alt })}
              placeholder="Describe the image for accessibility"
              className="w-full mt-1 p-2 bg-beige border border-mitti/20"
            />
          </div>

          <div>
            <label className="label text-mitti">CAPTION</label>
            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              onBlur={() => caption !== (asset.caption || '') && onUpdate({ caption })}
              placeholder="Optional caption"
              className="w-full mt-1 p-2 bg-beige border border-mitti/20"
            />
          </div>

          <div className="pt-4 border-t border-mitti/20 flex gap-2">
            <button onClick={onClose} className="btn-outline flex-1">CLOSE</button>
            <button onClick={onDelete} className="px-4 py-2 bg-madder/20 text-madder hover:bg-madder/30 text-xs tracking-widest flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> REMOVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
