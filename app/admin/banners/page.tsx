'use client';
import { useEffect, useState } from 'react';
import { AiDraftButton } from '@/components/admin/AiDraftButton';
import { AiImageButton } from '@/components/admin/AiImageButton';
import { BannerLinkPicker } from '@/components/admin/BannerLinkPicker';
import { Plus, Trash2, X, Power, Calendar, Image as ImageIcon, Sparkles } from 'lucide-react';
import { SingleImageInput } from '@/components/admin/SingleImageInput';

export const dynamic = 'force-dynamic';

interface Banner {
  id: string;
  position: string;
  title: string | null;
  subtitle: string | null;
  image: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  // v23.40.23 link target fields
  linkType?: string | null;
  linkProductId?: string | null;
  linkCategoryId?: string | null;
  linkCollectionTag?: string | null;
  linkDropSlug?: string | null;
  linkPageSlug?: string | null;
  textColor: string | null;
  bgColor: string | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  order: number;
}

const POSITIONS = [
  { key: 'announcement', label: 'Announcement Bar (top of every page)', icon: '⚐', description: 'Rotating text strip above the header' },
  { key: 'hero', label: 'Homepage Hero (below header)', icon: '◆', description: 'Large image banner with CTA' },
  { key: 'footer', label: 'Footer Banner (above footer)', icon: '▼', description: 'Newsletter / promo strip at page bottom' },
];

const COLOR_OPTIONS = ['kohl', 'mitti', 'madder', 'beige', 'ivory', 'haldi', 'neem', 'banarasi'];

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [creating, setCreating] = useState<string | null>(null); // position key
  const [activeTab, setActiveTab] = useState('announcement');
  // v23.40.23: surface AI config so editors know if generations will work
  const [aiStatus, setAiStatus] = useState<any>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/banners', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.banners) setBanners(d.banners); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    fetch('/api/admin/ai/status', { credentials: 'include' })
      .then(r => r.json())
      .then(setAiStatus)
      .catch(() => {});
  }, []);

  const toggle = async (id: string, active: boolean) => {
    await fetch('/api/admin/banners', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: !active }),
    });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    await fetch('/api/admin/banners', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const filtered = banners.filter(b => b.position === activeTab);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="label text-madder">CMS</p>
          <h1 className="font-display text-4xl text-kohl">Banners</h1>
          <p className="font-italic italic text-mitti mt-1">Quiet messages, placed with care.</p>
        </div>
      </div>

      {/* v23.40.23: AI status strip */}
      {aiStatus && (!aiStatus?.text?.configured || !aiStatus?.image?.configured) && (
        <div className="bg-haldi/15 border border-haldi p-3 text-xs text-kohl">
          <strong>AI not fully configured.</strong>{' '}
          {!aiStatus?.text?.configured && <span>OpenAI text generation is OFF (set <code>OPENAI_API_KEY</code> in Vercel env vars). </span>}
          {!aiStatus?.image?.configured && <span>fal.ai image generation is OFF (set <code>FAL_KEY</code> in Vercel env vars). </span>}
          {!aiStatus?.storage?.configured && <span>Supabase storage is OFF — generated images will use ephemeral URLs that expire after a few hours.</span>}
        </div>
      )}

      {/* Position tabs */}
      <div className="flex gap-2 flex-wrap border-b border-mitti/20">
        {POSITIONS.map(p => {
          const count = banners.filter(b => b.position === p.key).length;
          const isActive = activeTab === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setActiveTab(p.key)}
              className={`px-4 py-3 text-xs tracking-widest ${isActive ? 'bg-kohl text-ivory' : 'text-mitti hover:text-kohl'}`}
            >
              <span className="text-madder mr-2">{p.icon}</span>
              {p.label.split(' (')[0].toUpperCase()}
              {count > 0 && <span className="ml-2 text-[10px] opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Description for active tab */}
      <p className="font-italic italic text-mitti text-sm">
        {POSITIONS.find(p => p.key === activeTab)?.description}
      </p>

      {/* New banner button */}
      <button
        onClick={() => setCreating(activeTab)}
        className="btn-primary flex items-center gap-2"
      >
        <Plus className="w-4 h-4" /> NEW {activeTab.toUpperCase()} BANNER
      </button>

      {/* Banner list */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-center text-mitti font-italic italic py-12">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-mitti/30 p-12 text-center">
            <ImageIcon className="w-12 h-12 text-mitti/40 mx-auto mb-3" />
            <p className="font-display text-xl text-kohl">No {activeTab} banners yet</p>
            <p className="text-mitti text-sm mt-2">Click NEW above to add one.</p>
          </div>
        ) : filtered.map(b => (
          <BannerRow key={b.id} banner={b} onEdit={() => setEditing(b)} onToggle={() => toggle(b.id, b.active)} onDelete={() => del(b.id)} />
        ))}
      </div>

      {(editing || creating) && (
        <BannerEditor
          existing={editing}
          position={creating || editing?.position || 'announcement'}
          onClose={() => { setEditing(null); setCreating(null); load(); }}
        />
      )}
    </div>
  );
}

function BannerRow({ banner, onEdit, onToggle, onDelete }: { banner: Banner; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const scheduled = banner.startsAt || banner.endsAt;
  const inWindow = (() => {
    const now = Date.now();
    if (banner.startsAt && new Date(banner.startsAt).getTime() > now) return false;
    if (banner.endsAt && new Date(banner.endsAt).getTime() < now) return false;
    return true;
  })();
  const isLive = banner.active && inWindow;

  return (
    <div className={`bg-beige p-4 flex items-center gap-4 ${!isLive ? 'opacity-60' : ''}`}>
      {banner.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner.image} alt="" className="w-20 h-20 object-cover rounded" />
      ) : (
        <div className="w-20 h-20 bg-mitti/10 flex items-center justify-center text-mitti">
          <ImageIcon className="w-6 h-6" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-display text-lg text-kohl truncate">{banner.title || <span className="italic text-mitti">Untitled</span>}</p>
        {banner.subtitle && <p className="text-sm text-mitti truncate">{banner.subtitle}</p>}
        <div className="flex items-center gap-3 mt-1 text-xs">
          {banner.ctaText && (
            <span className="text-madder">{banner.ctaText} → {banner.ctaUrl?.slice(0, 30)}</span>
          )}
          {scheduled && (
            <span className="text-mitti flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {banner.startsAt ? new Date(banner.startsAt).toISOString().slice(0, 10) : '∞'}
              {' → '}
              {banner.endsAt ? new Date(banner.endsAt).toISOString().slice(0, 10) : '∞'}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 ${isLive ? 'bg-neem/20 text-neem' : 'bg-mitti/20 text-mitti'}`}>
          {isLive ? 'LIVE' : banner.active ? 'SCHEDULED' : 'PAUSED'}
        </span>
        <button onClick={onToggle} className="text-mitti hover:text-madder" title={banner.active ? 'Pause' : 'Activate'}>
          <Power className="w-4 h-4" />
        </button>
        <button onClick={onEdit} className="text-mitti hover:text-kohl text-xs tracking-widest">EDIT</button>
        <button onClick={onDelete} className="text-madder hover:bg-madder/10 p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function BannerEditor({ existing, position, onClose }: { existing: Banner | null; position: string; onClose: () => void }) {
  const [form, setForm] = useState({
    position: existing?.position || position,
    title: existing?.title || '',
    subtitle: existing?.subtitle || '',
    image: existing?.image || '',
    ctaText: existing?.ctaText || '',
    ctaUrl: existing?.ctaUrl || '',
    // v23.40.23 link target
    linkType: existing?.linkType || 'url',
    linkProductId: existing?.linkProductId || '',
    linkCategoryId: existing?.linkCategoryId || '',
    linkCollectionTag: existing?.linkCollectionTag || '',
    linkDropSlug: existing?.linkDropSlug || '',
    linkPageSlug: existing?.linkPageSlug || '',
    textColor: existing?.textColor || 'ivory',
    bgColor: existing?.bgColor || (position === 'announcement' ? 'mitti' : 'kohl'),
    startsAt: existing?.startsAt ? existing.startsAt.slice(0, 10) : '',
    endsAt: existing?.endsAt ? existing.endsAt.slice(0, 10) : '',
    active: existing?.active ?? true,
    order: existing?.order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // v23.40.22 — carry the imagePrompt AiDraftButton suggested, so AiImageButton can use it
  const [aiSuggestedImagePrompt, setAiSuggestedImagePrompt] = useState<string>('');
  // v23.40.24 — when banner is linked to a specific product, auto-adopt that product's
  // primary image. Locked, non-negotiable: editor cannot regenerate or upload a different image.
  const [linkedProduct, setLinkedProduct] = useState<{ id: string; name: string; sku?: string; image?: string } | null>(null);

  useEffect(() => {
    // Whenever the linked product changes, fetch its primary image and lock it in.
    if (form.linkType === 'product' && form.linkProductId) {
      fetch(`/api/admin/products/${form.linkProductId}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          const p = d.product;
          if (!p) return;
          const primary = (Array.isArray(p.images) && p.images[0])
            || (p.variants?.[0]?.images?.[0])
            || null;
          setLinkedProduct({ id: p.id, name: p.name, sku: p.sku, image: primary || undefined });
          if (primary) {
            // NON-NEGOTIABLE: adopt the product's raw image directly. No AI regen.
            setForm(f => ({ ...f, image: primary }));
          }
        })
        .catch(() => {});
    } else {
      setLinkedProduct(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.linkType, form.linkProductId]);

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const method = existing ? 'PATCH' : 'POST';
      const body = existing ? { id: existing.id, ...form } : form;
      const res = await fetch('/api/admin/banners', {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const isAnnouncement = form.position === 'announcement';
  const isHero = form.position === 'hero';

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-ivory max-w-2xl w-full p-8 my-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-kohl">
            {existing ? 'Edit' : 'New'} {form.position} banner
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label text-mitti">POSITION</label>
            <select
              value={form.position}
              onChange={e => setForm({ ...form, position: e.target.value })}
              className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui"
            >
              {POSITIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>

          <div className="flex justify-end">
            <AiDraftButton
              field="banner"
              context={{ position: form.position }}
              onApply={(d) => {
                setForm({
                  ...form,
                  title:    d.title    ?? form.title,
                  subtitle: d.subtitle ?? form.subtitle,
                  ctaText:  d.ctaText  ?? form.ctaText,
                  ctaUrl:   d.ctaUrl   ?? form.ctaUrl,
                });
                // v23.40.22 — stash the AI's image prompt so the editor can
                // one-click generate the banner image with the same brief.
                if (d.imagePrompt) setAiSuggestedImagePrompt(d.imagePrompt);
              }}
            />
          </div>

          <Field label="TITLE" value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder="e.g. Free shipping above ₹2,500" />
          <Field label="SUBTITLE (optional)" value={form.subtitle} onChange={v => setForm({ ...form, subtitle: v })} placeholder="A short supporting line" />

          {isHero && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="label text-mitti">
                  HERO IMAGE <span className="normal-case text-[10px] text-mitti/70">(optional — text-only banners are valid)</span>
                </label>
                {/* v23.40.24 — only show AI generate when NOT linked to a specific product */}
                {form.linkType !== 'product' && (
                  <AiImageButton
                    onApply={(url) => setForm({ ...form, image: url })}
                    initialPrompt={aiSuggestedImagePrompt || `A wide cinematic NEEJEE hero image for: ${form.title || 'a NEEJEE craft brand banner'}. ${form.subtitle || ''}. Full-bleed photographic composition. Leave the LEFT THIRD of the frame visually quiet (low contrast, soft shadow, or warm darkness) so overlay text remains legible. Subject placed on the right two-thirds. No text in the image.`}
                    aspectRatio="16:9"
                    folder="banners/hero"
                    filenameHint={form.title ? form.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30) : 'hero-banner'}
                    label="GENERATE WITH AI"
                    lockAspect
                  />
                )}
              </div>

              {/* v23.40.24 — Non-negotiable rule: product-linked banner uses raw product image */}
              {form.linkType === 'product' && (
                <div className="bg-madder/10 border-l-4 border-madder p-3 text-xs text-kohl flex items-start gap-2">
                  <Sparkles className="w-3 h-3 text-madder shrink-0 mt-0.5" />
                  <span>
                    <strong>Locked to product image.</strong> When a banner is linked to a specific product,
                    the product’s actual photograph is used as the hero image — we never alter or regenerate the
                    core product visual. Text overlays automatically for legibility.
                    {linkedProduct?.name && <> Current product: <strong>{linkedProduct.name}</strong>.</>}
                  </span>
                </div>
              )}

              {aiSuggestedImagePrompt && !form.image && form.linkType !== 'product' && (
                <div className="bg-banarasi/10 border border-banarasi/30 p-3 text-xs text-kohl flex items-start gap-2">
                  <Sparkles className="w-3 h-3 text-banarasi shrink-0 mt-0.5" />
                  <span>
                    AI also suggested an image prompt for this banner. Click <strong>GENERATE WITH AI</strong> above to create it in one go.
                  </span>
                </div>
              )}

              {form.linkType !== 'product' && (
                <SingleImageInput
                  value={form.image}
                  onChange={(url) => setForm({ ...form, image: url })}
                  folder="banners/hero"
                  label=""
                  recommendedSize="2400 × 900 px"
                  recommendedAspect="8:3 wide landscape"
                />
              )}

              {/* v23.40.24 — Live full-bleed preview so editor sees the actual customer view */}
              <BannerLivePreview
                image={form.image}
                title={form.title}
                subtitle={form.subtitle}
                ctaText={form.ctaText}
                bgColor={form.bgColor}
              />
            </div>
          )}

          <Field label="CTA TEXT" value={form.ctaText} onChange={v => setForm({ ...form, ctaText: v })} placeholder="e.g. SHOP NOW" />

          {/* v23.40.23 — structured link target instead of free-text URL */}
          <BannerLinkPicker
            value={form as any}
            onChange={(lv) => setForm({
              ...form,
              linkType: (lv.linkType as any) || 'url',
              linkProductId: lv.linkProductId || '',
              linkCategoryId: lv.linkCategoryId || '',
              linkCollectionTag: lv.linkCollectionTag || '',
              linkDropSlug: lv.linkDropSlug || '',
              linkPageSlug: lv.linkPageSlug || '',
              ctaUrl: lv.ctaUrl ?? form.ctaUrl,
            })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-mitti">BACKGROUND COLOR</label>
              <select
                value={form.bgColor}
                onChange={e => setForm({ ...form, bgColor: e.target.value })}
                className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui"
              >
                {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-mitti">PREVIEW</label>
              <div className={`mt-1 p-3 text-xs tracking-widest text-center bg-${form.bgColor} ${form.bgColor === 'ivory' || form.bgColor === 'beige' || form.bgColor === 'haldi' || form.bgColor === 'banarasi' ? 'text-kohl' : 'text-ivory'}`}>
                {form.title || 'Preview'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="STARTS AT (optional)" type="date" value={form.startsAt} onChange={v => setForm({ ...form, startsAt: v })} />
            <Field label="ENDS AT (optional)" type="date" value={form.endsAt} onChange={v => setForm({ ...form, endsAt: v })} />
          </div>

          {isAnnouncement && (
            <Field label="ORDER (lower shows first)" type="number" value={String(form.order)} onChange={v => setForm({ ...form, order: parseInt(v) || 0 })} />
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            <span>Active</span>
          </label>

          {err && <p className="text-madder text-sm">{err}</p>}

          <div className="flex gap-3 pt-4 border-t border-mitti/20">
            <button onClick={onClose} className="btn-outline flex-1">CANCEL</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? 'SAVING...' : existing ? 'SAVE CHANGES' : 'CREATE BANNER'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui"
      />
    </div>
  );
}

// v23.40.24 — Live full-bleed preview replicates the customer-facing HeroCarousel slide.
function BannerLivePreview({
  image, title, subtitle, ctaText, bgColor,
}: { image: string; title: string; subtitle: string; ctaText: string; bgColor: string }) {
  return (
    <div className="mt-2">
      <p className="label text-mitti mb-1.5">LIVE PREVIEW <span className="text-[10px] normal-case opacity-70">(how customers see it)</span></p>
      <div className={`relative aspect-[16/6] bg-${bgColor} text-ivory overflow-hidden border border-mitti/30`}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ivory/40 text-xs italic">
            No image — banner will show on solid {bgColor} background
          </div>
        )}
        {/* Dark left-to-right gradient overlay so overlaid text reads clearly even on bright images */}
        {image && (
          <div className="absolute inset-0 bg-gradient-to-r from-kohl/85 via-kohl/55 to-kohl/10" />
        )}
        <div className="relative h-full flex items-center px-6 md:px-10">
          <div className="max-w-md">
            <p className="text-[10px] tracking-widest text-banarasi">FOUND. PERSONAL.</p>
            <p className="font-display text-2xl md:text-3xl text-ivory mt-1 leading-tight">
              {title || 'Banner title here'}
            </p>
            {subtitle && (
              <p className="font-italic italic text-beige text-xs md:text-sm mt-1.5 line-clamp-2">{subtitle}</p>
            )}
            {ctaText && (
              <span className="inline-block mt-3 bg-madder text-ivory text-[10px] tracking-widest px-3 py-1.5">
                {ctaText}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
