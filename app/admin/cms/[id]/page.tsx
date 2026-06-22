'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronUp, ChevronDown, Trash2, Plus, Eye, Save, ArrowLeft, Sparkles, GripVertical, EyeOff, Monitor, Smartphone } from 'lucide-react';
import { SECTION_TYPES, defaultData, SectionRenderer, type Section, type SectionType } from '@/components/cms/SectionRenderer';
import { SingleImageInput } from '@/components/admin/SingleImageInput';
import { AiImageButton } from '@/components/admin/AiImageButton';

export const dynamic = 'force-dynamic';

export default function CMSEditor() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [page, setPage] = useState<any>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [editorialOpen, setEditorialOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/admin/cms/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setPage(d.page);
        setSections(Array.isArray(d.page?.sections) ? d.page.sections : []);
        setLoading(false);
      });
  }, [id]);

  const update = (idx: number, data: Record<string, any>) => {
    const next = [...sections];
    next[idx] = { ...next[idx], data: { ...next[idx].data, ...data } };
    setSections(next);
  };

  const updateMeta = (idx: number, meta: Partial<Section>) => {
    const next = [...sections];
    next[idx] = { ...next[idx], ...meta };
    setSections(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...sections];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setSections(next);
  };

  const moveTo = (from: number, to: number) => {
    if (from === to) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSections(next);
  };

  const remove = (idx: number) => {
    if (!confirm('Remove this section?')) return;
    setSections(sections.filter((_, i) => i !== idx));
  };

  const duplicate = (idx: number) => {
    const orig = sections[idx];
    const copy: Section = { ...orig, id: `s_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, data: JSON.parse(JSON.stringify(orig.data)) };
    const next = [...sections];
    next.splice(idx + 1, 0, copy);
    setSections(next);
  };

  const addSection = (type: SectionType) => {
    setSections([...sections, { id: `s_${Date.now()}`, type, data: defaultData(type) }]);
    setShowAdd(false);
  };

  const save = async (newStatus?: string) => {
    setSaving(true);
    const body: any = { sections };
    if (newStatus) body.status = newStatus;
    const res = await fetch(`/api/admin/cms/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (j.page) {
      setPage(j.page);
    }
    setSaving(false);
  };

  const saveMeta = async (changes: Record<string, any>) => {
    setSaving(true);
    const res = await fetch(`/api/admin/cms/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    const j = await res.json();
    if (j.page) setPage(j.page);
    setSaving(false);
  };

  if (loading) return <p className="text-mitti p-12 text-center font-italic italic">Loading…</p>;
  if (!page) return <p className="text-madder p-12 text-center">Page not found.</p>;

  // Group section types for the picker
  const groupedSectionTypes = SECTION_TYPES.reduce((acc: Record<string, typeof SECTION_TYPES[number][]>, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/cms" className="text-xs tracking-wider text-mitti hover:text-kohl flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> ALL PAGES
          </Link>
          <h1 className="font-display text-3xl text-kohl mt-2">{page.title}</h1>
          <p className="text-mitti text-sm mt-1 font-mono">/p/{page.slug}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-1 tracking-wider ${
            page.status === 'PUBLISHED' ? 'bg-neem/20 text-neem' : 'bg-mitti/20 text-mitti'
          }`}>{page.status}</span>
          {page.status === 'PUBLISHED' && (
            <Link href={`/p/${page.slug}`} target="_blank" className="text-xs px-3 py-2 border border-mitti/30 hover:bg-beige flex items-center gap-1">
              <Eye className="w-3 h-3" /> VIEW LIVE
            </Link>
          )}
          <button onClick={() => save()} disabled={saving} className="text-xs px-3 py-2 border border-kohl hover:bg-kohl hover:text-ivory flex items-center gap-1 disabled:opacity-50">
            <Save className="w-3 h-3" /> {saving ? 'SAVING' : 'SAVE DRAFT'}
          </button>
          {page.status !== 'PUBLISHED' ? (
            <button onClick={() => save('PUBLISHED')} disabled={saving} className="text-xs px-4 py-2 bg-madder text-ivory hover:bg-madder/90 disabled:opacity-50 tracking-wider">PUBLISH</button>
          ) : (
            <button onClick={() => save('DRAFT')} disabled={saving} className="text-xs px-4 py-2 bg-mitti/20 text-kohl hover:bg-mitti/30 disabled:opacity-50 tracking-wider">UNPUBLISH</button>
          )}
        </div>
      </div>
      <div className="madder-divider mt-4"></div>

      {/* Editorial panel */}
      <div className="mt-4">
        <button onClick={() => setEditorialOpen(!editorialOpen)} className="text-xs tracking-wider text-mitti hover:text-kohl mr-6">
          {editorialOpen ? '− HIDE' : '+ SHOW'} EDITORIAL
        </button>
        <button onClick={() => setSeoOpen(!seoOpen)} className="text-xs tracking-wider text-mitti hover:text-kohl">
          {seoOpen ? '− HIDE' : '+ SHOW'} SEO & META
        </button>
        {editorialOpen && (
          <div className="bg-beige/40 p-4 mt-2 space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="label text-mitti">PAGE TYPE</label>
                <select
                  defaultValue={page.pageType || 'page'}
                  onChange={(e) => saveMeta({ pageType: e.target.value })}
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
                >
                  <option value="page">Standard page</option>
                  <option value="journal">Journal entry</option>
                  <option value="lookbook">Lookbook</option>
                </select>
                <p className="text-[10px] text-mitti mt-1">Journal entries show on /journal. Lookbooks show on /lookbook.</p>
              </div>
              <div>
                <label className="label text-mitti">AUTHOR (journal only)</label>
                <input
                  defaultValue={page.author || ''}
                  onBlur={(e) => saveMeta({ author: e.target.value })}
                  placeholder="Nidhi"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
                />
              </div>
              <div>
                <label className="label text-mitti">FEATURED</label>
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    defaultChecked={page.featured}
                    onChange={(e) => saveMeta({ featured: e.target.checked })}
                  />
                  <span className="text-sm">Pin to top of listing</span>
                </label>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="label text-mitti">COVER IMAGE URL (for listings)</label>
                  <AiImageButton
                    onApply={(url) => { saveMeta({ coverImage: url }); setPage({ ...page, coverImage: url }); }}
                    initialPrompt={`A NEEJEE editorial cover image for ${page.pageType || 'article'} titled "${page.title}". ${page.excerpt || ''}`}
                    aspectRatio="4:3"
                    folder="cms/cover"
                    filenameHint={(page.title || 'cover').toLowerCase().replace(/\s+/g, '-').slice(0, 30)}
                    label="AI"
                    className="text-[10px] tracking-widest text-banarasi hover:text-kohl border border-banarasi/40 hover:bg-banarasi/10 px-2 py-0.5 inline-flex items-center gap-1"
                  />
                </div>
                <input
                  value={page.coverImage || ''}
                  onChange={(e) => setPage({ ...page, coverImage: e.target.value })}
                  onBlur={(e) => saveMeta({ coverImage: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
                />
              </div>
              <div>
                <label className="label text-mitti">TAGS (comma-separated)</label>
                <input
                  defaultValue={(page.tags || []).join(', ')}
                  onBlur={(e) => saveMeta({ tags: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean) })}
                  placeholder="banaras, weaving, founder"
                  className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
                />
              </div>
            </div>
            <div>
              <label className="label text-mitti">EXCERPT (shown on /journal listings, 1-2 sentences)</label>
              <textarea
                defaultValue={page.excerpt || ''}
                onBlur={(e) => saveMeta({ excerpt: e.target.value })}
                rows={2}
                placeholder="A short sensory opening that invites the reader in."
                className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
              />
            </div>
          </div>
        )}
        {seoOpen && (
          <div className="bg-beige/40 p-4 mt-2 grid md:grid-cols-2 gap-3">
            <div>
              <label className="label text-mitti">SEO TITLE</label>
              <input
                defaultValue={page.seoTitle || ''}
                onBlur={(e) => saveMeta({ seoTitle: e.target.value })}
                className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label text-mitti">OG IMAGE URL (social share preview)</label>
                <AiImageButton
                  onApply={(url) => { saveMeta({ ogImage: url }); setPage({ ...page, ogImage: url }); }}
                  initialPrompt={`A social-share preview image for NEEJEE page "${page.title}". ${page.seoDesc || page.excerpt || ''}`}
                  aspectRatio="16:9"
                  folder="cms/og"
                  filenameHint={(page.title || 'og').toLowerCase().replace(/\s+/g, '-').slice(0, 30)}
                  label="AI"
                  className="text-[10px] tracking-widest text-banarasi hover:text-kohl border border-banarasi/40 hover:bg-banarasi/10 px-2 py-0.5 inline-flex items-center gap-1"
                />
              </div>
              <input
                value={page.ogImage || ''}
                onChange={(e) => setPage({ ...page, ogImage: e.target.value })}
                onBlur={(e) => saveMeta({ ogImage: e.target.value })}
                className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label text-mitti">SEO DESCRIPTION</label>
              <textarea
                defaultValue={page.seoDesc || ''}
                onBlur={(e) => saveMeta({ seoDesc: e.target.value })}
                className="w-full p-2 bg-ivory border border-mitti/20 text-sm mt-1"
                rows={2}
              />
            </div>
          </div>
        )}
      </div>

      {/* Section editor + live preview */}
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        {/* Editor column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="label text-madder">SECTIONS ({sections.length})</p>
            <p className="font-italic italic text-mitti text-xs">drag ⠿ to reorder</p>
          </div>
          {sections.length === 0 && (
            <div className="border border-dashed border-mitti/30 p-8 text-center">
              <p className="text-mitti">No sections yet. Add your first block below.</p>
            </div>
          )}
          {sections.map((s, idx) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) moveTo(dragIdx, idx); setDragIdx(null); }}
              onDragEnd={() => setDragIdx(null)}
              className={dragIdx === idx ? 'opacity-40' : ''}
            >
              <SectionEditor
                section={s}
                onChange={(d: Record<string, any>) => update(idx, d)}
                onMetaChange={(m) => updateMeta(idx, m)}
                onMoveUp={() => move(idx, -1)}
                onMoveDown={() => move(idx, 1)}
                onRemove={() => remove(idx)}
                onDuplicate={() => duplicate(idx)}
                isFirst={idx === 0}
                isLast={idx === sections.length - 1}
                pageTitle={page.title}
              />
            </div>
          ))}

          {showAdd ? (
            <div className="bg-beige p-4">
              <p className="label text-madder mb-3">CHOOSE A BLOCK</p>
              <div className="space-y-4">
                {Object.entries(groupedSectionTypes).map(([group, types]) => (
                  <div key={group}>
                    <p className="text-[10px] tracking-[0.25em] text-mitti uppercase mb-2">{group}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {types.map(t => (
                        <button key={t.type} onClick={() => addSection(t.type)} className="text-left p-3 bg-ivory border border-mitti/20 hover:border-kohl text-sm">
                          <span className="text-madder mr-2">{t.icon}</span>{t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowAdd(false)} className="text-xs tracking-wider mt-3 text-mitti">CANCEL</button>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full p-4 border border-dashed border-kohl/30 hover:border-kohl text-kohl/60 hover:text-kohl flex items-center justify-center gap-2 text-sm tracking-wider"
            >
              <Plus className="w-4 h-4" /> ADD SECTION
            </button>
          )}
        </div>

        {/* Preview column */}
        <div className="bg-ivory border border-mitti/20 overflow-hidden lg:sticky lg:top-4 lg:self-start lg:h-[calc(100vh-2rem)]">
          <div className="bg-kohl text-ivory text-xs tracking-[0.3em] px-4 py-2 flex items-center justify-between">
            <span>LIVE PREVIEW</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPreviewMode('desktop')}
                className={`p-1 ${previewMode === 'desktop' ? 'bg-ivory text-kohl' : 'text-ivory/60 hover:text-ivory'}`}
                title="Desktop"
              >
                <Monitor className="w-3 h-3" />
              </button>
              <button
                onClick={() => setPreviewMode('mobile')}
                className={`p-1 ${previewMode === 'mobile' ? 'bg-ivory text-kohl' : 'text-ivory/60 hover:text-ivory'}`}
                title="Mobile"
              >
                <Smartphone className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto bg-mitti/5" style={{ height: 'calc(100% - 32px)' }}>
            <div className={`mx-auto bg-ivory ${previewMode === 'mobile' ? 'max-w-[375px]' : ''}`}>
              {sections.length === 0 ? (
                <p className="p-12 text-center text-mitti font-italic italic">Preview will appear here as you add sections.</p>
              ) : (
                sections.map(s => <SectionRenderer key={s.id} section={s} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

interface SectionEditorProps {
  section: Section;
  onChange: (d: Record<string, any>) => void;
  onMetaChange: (m: Partial<Section>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  isFirst: boolean;
  isLast: boolean;
  pageTitle: string;
}

function SectionEditor({ section, onChange, onMetaChange, onMoveUp, onMoveDown, onRemove, onDuplicate, isFirst, isLast, pageTitle }: SectionEditorProps) {
  const [open, setOpen] = useState(true);
  const t = SECTION_TYPES.find(x => x.type === section.type);

  return (
    <div className={`border ${section.hidden ? 'border-mitti/30 opacity-60' : 'border-mitti/20'} bg-ivory`}>
      <div className="flex items-center justify-between p-3 bg-beige/40 border-b border-mitti/20">
        <div className="flex items-center gap-2 flex-1">
          <GripVertical className="w-4 h-4 text-mitti/50 cursor-move" />
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-left flex-1">
            <span className="text-madder">{t?.icon}</span>
            <span className="text-sm tracking-wider text-kohl">{t?.label}</span>
            {section.hidden && <span className="text-xs text-mitti italic">(hidden)</span>}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onMetaChange({ hidden: !section.hidden })} className="p-1 hover:bg-mitti/10" title={section.hidden ? 'Show' : 'Hide'}>
            {section.hidden ? <EyeOff className="w-4 h-4 text-mitti" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={onDuplicate} className="p-1 hover:bg-mitti/10 text-xs" title="Duplicate">⎘</button>
          <button onClick={onMoveUp} disabled={isFirst} className="p-1 hover:bg-mitti/10 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
          <button onClick={onMoveDown} disabled={isLast} className="p-1 hover:bg-mitti/10 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
          <button onClick={onRemove} className="p-1 hover:bg-madder/10 text-madder"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {open && (
        <div className="p-4 space-y-3">
          <FieldsForType type={section.type} data={section.data} onChange={onChange} pageTitle={pageTitle} />
          <VisibilityRulesEditor
            visibility={section.visibility}
            onChange={(v) => onMetaChange({ visibility: v })}
          />
        </div>
      )}
    </div>
  );
}

// ───── Visibility Rules Editor (collapsible) ─────
function VisibilityRulesEditor({ visibility, onChange }: {
  visibility?: { startsAt?: string | null; endsAt?: string | null; showOn?: 'all' | 'desktop' | 'mobile'; audience?: 'all' | 'guest' | 'signed-in' };
  onChange: (v: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const v = visibility || {};
  const hasRules = !!(v.startsAt || v.endsAt || (v.showOn && v.showOn !== 'all') || (v.audience && v.audience !== 'all'));

  return (
    <div className="border-t border-mitti/10 pt-3 mt-3">
      <button
        onClick={() => setOpen(!open)}
        type="button"
        className="text-[10px] tracking-[0.2em] text-mitti hover:text-kohl flex items-center gap-2"
      >
        {open ? '−' : '+'} VISIBILITY RULES
        {hasRules && <span className="text-madder">●</span>}
      </button>
      {open && (
        <div className="bg-beige/30 p-3 mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-mitti">SHOW FROM</label>
              <input
                type="date"
                defaultValue={v.startsAt ? v.startsAt.slice(0, 10) : ''}
                onBlur={(e) => onChange({ ...v, startsAt: e.target.value || null })}
                className="w-full mt-1 p-2 bg-ivory border border-mitti/20 text-sm"
              />
            </div>
            <div>
              <label className="label text-mitti">SHOW UNTIL</label>
              <input
                type="date"
                defaultValue={v.endsAt ? v.endsAt.slice(0, 10) : ''}
                onBlur={(e) => onChange({ ...v, endsAt: e.target.value || null })}
                className="w-full mt-1 p-2 bg-ivory border border-mitti/20 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-mitti">DEVICE</label>
              <select
                value={v.showOn || 'all'}
                onChange={(e) => onChange({ ...v, showOn: e.target.value as any })}
                className="w-full mt-1 p-2 bg-ivory border border-mitti/20 text-sm"
              >
                <option value="all">All devices</option>
                <option value="desktop">Desktop only</option>
                <option value="mobile">Mobile only</option>
              </select>
            </div>
            <div>
              <label className="label text-mitti">AUDIENCE</label>
              <select
                value={v.audience || 'all'}
                onChange={(e) => onChange({ ...v, audience: e.target.value as any })}
                className="w-full mt-1 p-2 bg-ivory border border-mitti/20 text-sm"
              >
                <option value="all">Everyone</option>
                <option value="guest">Logged-out only</option>
                <option value="signed-in">Signed-in only</option>
              </select>
            </div>
          </div>
          <p className="text-[10px] text-mitti italic">
            Empty fields mean no restriction. Server-rendered pages enforce date rules; device/audience are enforced on the client.
          </p>
        </div>
      )}
    </div>
  );
}

// ───── AI draft helper for an entire section data block ─────
async function aiDraftSection(field: string, brief: { campaign?: string; notes?: string }): Promise<any> {
  const res = await fetch('/api/ai/content', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, ...brief }),
  });
  const d = await res.json();
  if (!res.ok || !d.ok) throw new Error(d.error || d.message || 'AI failed');
  return d.json || (d.text ? { text: d.text } : null);
}

function AiButton({ onDraft, label = 'DRAFT WITH AI' }: { onDraft: () => Promise<void>; label?: string }) {
  const [drafting, setDrafting] = useState(false);
  const handle = async () => {
    setDrafting(true);
    try { await onDraft(); } catch (e: any) { alert(e.message); }
    finally { setDrafting(false); }
  };
  return (
    <button
      onClick={handle}
      disabled={drafting}
      type="button"
      className="text-[10px] tracking-[0.2em] text-madder hover:text-kohl flex items-center gap-1 disabled:opacity-50"
    >
      <Sparkles className="w-3 h-3" />
      {drafting ? 'DRAFTING…' : `✦ ${label}`}
    </button>
  );
}

function FieldsForType({ type, data, onChange, pageTitle }: { type: string; data: any; onChange: (d: Record<string, any>) => void; pageTitle: string }) {

  // ============ HERO ============
  if (type === 'hero') return (
    <>
      <div className="flex justify-end">
        <AiButton onDraft={async () => {
          const r = await aiDraftSection('cmsHero', { campaign: pageTitle, notes: data.eyebrow || data.title });
          if (r) onChange({ eyebrow: r.eyebrow || data.eyebrow, title: r.title || data.title, subtitle: r.subtitle || data.subtitle, ctaText: r.ctaText || data.ctaText });
        }} label="DRAFT HERO" />
      </div>
      <Field label="Eyebrow" v={data.eyebrow} onChange={(v) => onChange({ eyebrow: v })} />
      <Field label="Title" v={data.title} onChange={(v) => onChange({ title: v })} />
      <Field label="Subtitle" v={data.subtitle} onChange={(v) => onChange({ subtitle: v })} />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="label text-mitti">BACKGROUND IMAGE</label>
          <AiImageButton
            onApply={(url) => onChange({ image: url })}
            initialPrompt={`A wide cinematic NEEJEE hero background: ${data.title || pageTitle}. ${data.subtitle || ''}. ${data.eyebrow || ''}`}
            aspectRatio="16:9"
            folder="cms/hero"
            filenameHint={(data.title || 'cms-hero').toLowerCase().replace(/\s+/g, '-').slice(0, 30)}
            label="GENERATE WITH AI"
          />
        </div>
        <SingleImageInput
          value={data.image || ''}
          onChange={(url) => onChange({ image: url })}
          folder="cms/hero"
          label=""
          recommendedSize="2400 × 1200 px"
          recommendedAspect="2:1 landscape (desktop hero)"
        />
      </div>
      <Field label="CTA text" v={data.ctaText} onChange={(v) => onChange({ ctaText: v })} />
      <Field label="CTA URL" v={data.ctaUrl} onChange={(v) => onChange({ ctaUrl: v })} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!data.dark} onChange={(e) => onChange({ dark: e.target.checked })} /> Dark background</label>
    </>
  );

  // ============ VIDEO HERO ============
  if (type === 'videoHero') return (
    <>
      <div className="flex justify-end">
        <AiButton onDraft={async () => {
          const r = await aiDraftSection('cmsHero', { campaign: pageTitle, notes: 'video hero, evocative' });
          if (r) onChange({ eyebrow: r.eyebrow, title: r.title, subtitle: r.subtitle, ctaText: r.ctaText });
        }} label="DRAFT TEXT" />
      </div>
      <Field label="Eyebrow" v={data.eyebrow} onChange={(v) => onChange({ eyebrow: v })} />
      <Field label="Title" v={data.title} onChange={(v) => onChange({ title: v })} />
      <Field label="Subtitle" v={data.subtitle} onChange={(v) => onChange({ subtitle: v })} />
      <Field label="Video URL (mp4)" v={data.videoUrl} onChange={(v) => onChange({ videoUrl: v })} />
      <SingleImageInput
        value={data.poster || ''}
        onChange={(url) => onChange({ poster: url })}
        folder="cms/video-poster"
        label="POSTER IMAGE (shown while loading)"
        recommendedSize="2400 × 1200 px"
        recommendedAspect="2:1 landscape"
      />
      <Field label="CTA text" v={data.ctaText} onChange={(v) => onChange({ ctaText: v })} />
      <Field label="CTA URL" v={data.ctaUrl} onChange={(v) => onChange({ ctaUrl: v })} />
    </>
  );

  // ============ TEXT ============
  if (type === 'text') return (
    <>
      <div className="flex justify-end">
        <AiButton onDraft={async () => {
          const r = await aiDraftSection('cmsText', { campaign: pageTitle, notes: data.title });
          if (r) onChange({ title: r.title || data.title, body: r.body || data.body });
        }} label="DRAFT TEXT" />
      </div>
      <Field label="Title" v={data.title} onChange={(v) => onChange({ title: v })} />
      <Field label="Body" v={data.body} onChange={(v) => onChange({ body: v })} multiline />
      <Select label="Align" v={data.align || 'center'} options={['left','center','right','justify']} onChange={(v) => onChange({ align: v })} />
    </>
  );

  // ============ IMAGE ============
  if (type === 'image') return (
    <>
      <SingleImageInput
        value={data.url || ''}
        onChange={(url) => onChange({ url })}
        folder="cms/images"
        label="IMAGE"
        recommendedSize="1600 × 900 px"
        recommendedAspect="16:9 landscape"
      />
      <Field label="Alt text" v={data.alt} onChange={(v) => onChange({ alt: v })} />
      <Field label="Caption" v={data.caption} onChange={(v) => onChange({ caption: v })} />
    </>
  );

  // ============ IMAGE GRID ============
  if (type === 'imageGrid') return (
    <>
      <Select label="Columns" v={String(data.columns || 3)} options={['2','3','4']} onChange={(v) => onChange({ columns: parseInt(v) })} />
      <p className="text-[10px] tracking-wider text-mitti/70">Recommended: 1200 × 1200 px · 1:1 square · &lt;5 MB each</p>
      {(data.items || []).map((it: any, i: number) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1">
            <SingleImageInput
              value={it.url || ''}
              onChange={(url) => { const next = [...data.items]; next[i] = { ...it, url }; onChange({ items: next }); }}
              folder="cms/grid"
              label={`IMAGE #${i + 1}`}
              recommendedSize="1200 × 1200 px"
              recommendedAspect="1:1 square"
            />
          </div>
          <button onClick={() => { const next = data.items.filter((_: any, k: number) => k !== i); onChange({ items: next }); }} className="p-1 mt-6 text-madder" title="Remove"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button onClick={() => onChange({ items: [...(data.items || []), { url: '', alt: '' }] })} className="text-xs tracking-wider text-madder">+ ADD IMAGE</button>
    </>
  );

  // ============ LOOKBOOK ============
  if (type === 'lookbook') return (
    <>
      <Field label="Title" v={data.title} onChange={(v) => onChange({ title: v })} />
      <Select label="Layout" v={data.layout || 'asymmetric'} options={['asymmetric', 'grid', 'stacked']} onChange={(v) => onChange({ layout: v })} />
      {(data.items || []).map((it: any, i: number) => (
        <div key={i} className="bg-beige/40 p-3 space-y-2">
          <div className="flex justify-between">
            <p className="text-[10px] tracking-wider text-mitti uppercase">Image #{i + 1}</p>
            <button onClick={() => { const next = data.items.filter((_: any, k: number) => k !== i); onChange({ items: next }); }} className="text-madder text-xs">REMOVE</button>
          </div>
          <SingleImageInput
            value={it.url || ''}
            onChange={(url) => { const next = [...data.items]; next[i] = { ...it, url }; onChange({ items: next }); }}
            folder="cms/lookbook"
            label=""
            recommendedSize="1200 × 1600 px"
            recommendedAspect="3:4 portrait"
          />
          <Field label="Caption" v={it.caption} onChange={(v) => { const next = [...data.items]; next[i] = { ...it, caption: v }; onChange({ items: next }); }} />
        </div>
      ))}
      <button onClick={() => onChange({ items: [...(data.items || []), { url: '', caption: '' }] })} className="text-xs tracking-wider text-madder">+ ADD IMAGE</button>
    </>
  );

  // ============ FOUNDER NOTE ============
  if (type === 'founderNote') return (
    <>
      <div className="flex justify-end">
        <AiButton onDraft={async () => {
          const r = await aiDraftSection('cmsFounderNote', { campaign: pageTitle });
          if (r) onChange({ body: r.text || (typeof r === 'string' ? r : data.body) });
        }} label="DRAFT NOTE" />
      </div>
      <Field label="Name" v={data.name} onChange={(v) => onChange({ name: v })} />
      <Field label="Title" v={data.title} onChange={(v) => onChange({ title: v })} />
      <Field label="Body" v={data.body} onChange={(v) => onChange({ body: v })} multiline />
    </>
  );

  // ============ JOURNAL ENTRY ============
  if (type === 'journalEntry') return (
    <>
      <div className="flex justify-end">
        <AiButton onDraft={async () => {
          const r = await aiDraftSection('cmsJournal', { campaign: pageTitle, notes: data.title });
          if (r) onChange({ title: r.title || data.title, excerpt: r.excerpt || data.excerpt, body: r.body || data.body });
        }} label="DRAFT JOURNAL" />
      </div>
      <Field label="Title" v={data.title} onChange={(v) => onChange({ title: v })} />
      <Field label="Author" v={data.author} onChange={(v) => onChange({ author: v })} />
      <Field label="Date" v={data.date} onChange={(v) => onChange({ date: v })} placeholder="2026-01-01" />
      <SingleImageInput
        value={data.heroImage || ''}
        onChange={(url) => onChange({ heroImage: url })}
        folder="cms/journal"
        label="HERO IMAGE"
        recommendedSize="1600 × 900 px"
        recommendedAspect="16:9 landscape"
      />
      <Field label="Excerpt" v={data.excerpt} onChange={(v) => onChange({ excerpt: v })} multiline />
      <Field label="Body" v={data.body} onChange={(v) => onChange({ body: v })} multiline rows={8} />
    </>
  );

  // ============ SPLIT SECTION ============
  if (type === 'splitSection') return (
    <>
      <div className="flex justify-end">
        <AiButton onDraft={async () => {
          const r = await aiDraftSection('cmsText', { campaign: pageTitle, notes: 'short split section copy' });
          if (r) onChange({ title: r.title || data.title, body: r.body || data.body });
        }} label="DRAFT TEXT" />
      </div>
      <SingleImageInput
        value={data.image || ''}
        onChange={(url) => onChange({ image: url })}
        folder="cms/split"
        label="IMAGE"
        recommendedSize="1200 × 1500 px"
        recommendedAspect="4:5 portrait"
      />
      <Select label="Image position" v={data.imagePosition || 'left'} options={['left', 'right']} onChange={(v) => onChange({ imagePosition: v })} />
      <Field label="Title" v={data.title} onChange={(v) => onChange({ title: v })} />
      <Field label="Body" v={data.body} onChange={(v) => onChange({ body: v })} multiline />
      <Field label="CTA text" v={data.ctaText} onChange={(v) => onChange({ ctaText: v })} />
      <Field label="CTA URL" v={data.ctaUrl} onChange={(v) => onChange({ ctaUrl: v })} />
    </>
  );

  // ============ FEATURE GRID ============
  if (type === 'featureGrid') return (
    <>
      <div className="flex justify-end">
        <AiButton onDraft={async () => {
          const r = await aiDraftSection('cmsFeatures', { campaign: pageTitle });
          if (r) onChange({ title: r.title || data.title, items: Array.isArray(r.items) ? r.items : data.items });
        }} label="DRAFT FEATURES" />
      </div>
      <Field label="Title" v={data.title} onChange={(v) => onChange({ title: v })} />
      <Select label="Columns" v={String(data.columns || 3)} options={['2','3','4']} onChange={(v) => onChange({ columns: parseInt(v) })} />
      {(data.items || []).map((it: any, i: number) => (
        <div key={i} className="bg-beige/40 p-3 space-y-2">
          <div className="flex justify-between">
            <p className="text-[10px] tracking-wider text-mitti uppercase">Feature #{i + 1}</p>
            <button onClick={() => { const next = data.items.filter((_: any, k: number) => k !== i); onChange({ items: next }); }} className="text-madder text-xs">REMOVE</button>
          </div>
          <Field label="Icon (single character)" v={it.icon} onChange={(v) => { const next = [...data.items]; next[i] = { ...it, icon: v }; onChange({ items: next }); }} />
          <Field label="Title" v={it.title} onChange={(v) => { const next = [...data.items]; next[i] = { ...it, title: v }; onChange({ items: next }); }} />
          <Field label="Body" v={it.body} onChange={(v) => { const next = [...data.items]; next[i] = { ...it, body: v }; onChange({ items: next }); }} multiline />
        </div>
      ))}
      <button onClick={() => onChange({ items: [...(data.items || []), { icon: '✦', title: '', body: '' }] })} className="text-xs tracking-wider text-madder">+ ADD FEATURE</button>
    </>
  );

  // ============ TESTIMONIAL ============
  if (type === 'testimonial') return (
    <>
      <div className="flex justify-end">
        <AiButton onDraft={async () => {
          const r = await aiDraftSection('cmsTestimonial', { campaign: pageTitle });
          if (r) onChange({ text: r.text || data.text, author: r.author || data.author, location: r.location || data.location });
        }} label="DRAFT TESTIMONIAL" />
      </div>
      <Field label="Quote text" v={data.text} onChange={(v) => onChange({ text: v })} multiline />
      <Field label="Author" v={data.author} onChange={(v) => onChange({ author: v })} />
      <Field label="Location" v={data.location} onChange={(v) => onChange({ location: v })} />
      <SingleImageInput
        value={data.photo || ''}
        onChange={(url) => onChange({ photo: url })}
        folder="cms/testimonial"
        label="CUSTOMER PHOTO (optional)"
        recommendedSize="400 × 400 px"
        recommendedAspect="1:1 square"
      />
      <Select label="Rating" v={String(data.rating || 5)} options={['0','3','4','5']} onChange={(v) => onChange({ rating: parseInt(v) })} />
    </>
  );

  // ============ ACCORDION ============
  if (type === 'accordion') return (
    <>
      <div className="flex justify-end">
        <AiButton onDraft={async () => {
          const r = await aiDraftSection('cmsFaq', { campaign: pageTitle });
          if (r && Array.isArray(r.items)) onChange({ items: r.items });
        }} label="DRAFT FAQ" />
      </div>
      <Field label="Section title" v={data.title} onChange={(v) => onChange({ title: v })} />
      {(data.items || []).map((it: any, i: number) => (
        <div key={i} className="bg-beige/40 p-3 space-y-2">
          <div className="flex justify-between">
            <p className="text-[10px] tracking-wider text-mitti uppercase">Q&amp;A #{i + 1}</p>
            <button onClick={() => { const next = data.items.filter((_: any, k: number) => k !== i); onChange({ items: next }); }} className="text-madder text-xs">REMOVE</button>
          </div>
          <Field label="Question" v={it.question} onChange={(v) => { const next = [...data.items]; next[i] = { ...it, question: v }; onChange({ items: next }); }} />
          <Field label="Answer" v={it.answer} onChange={(v) => { const next = [...data.items]; next[i] = { ...it, answer: v }; onChange({ items: next }); }} multiline />
        </div>
      ))}
      <button onClick={() => onChange({ items: [...(data.items || []), { question: '', answer: '' }] })} className="text-xs tracking-wider text-madder">+ ADD Q&amp;A</button>
    </>
  );

  // ============ PRODUCT CAROUSEL ============
  if (type === 'productCarousel') return (
    <>
      <Field label="Section title" v={data.title} onChange={(v) => onChange({ title: v })} />
      <Select label="Source" v={data.source || 'founder'} options={['founder','sale','new','featured']} onChange={(v) => onChange({ source: v })} />
      <Field label="Limit" v={String(data.limit || 6)} onChange={(v) => onChange({ limit: parseInt(v) || 6 })} />
    </>
  );

  // ============ QUOTE ============
  if (type === 'quote') return (
    <>
      <div className="flex justify-end">
        <AiButton onDraft={async () => {
          const r = await aiDraftSection('cmsQuote', { campaign: pageTitle });
          if (r) onChange({ text: typeof r === 'string' ? r : (r.text || data.text) });
        }} label="DRAFT QUOTE" />
      </div>
      <Field label="Quote text" v={data.text} onChange={(v) => onChange({ text: v })} multiline />
      <Field label="Attribution" v={data.attribution} onChange={(v) => onChange({ attribution: v })} />
    </>
  );

  // ============ MARQUEE ============
  if (type === 'marquee') return (
    <>
      <Field label="Text (single line, repeats)" v={data.text} onChange={(v) => onChange({ text: v })} />
      <Field label="Speed (seconds per loop)" v={String(data.speed || 30)} onChange={(v) => onChange({ speed: parseInt(v) || 30 })} />
    </>
  );

  // ============ CTA ============
  if (type === 'cta') return (
    <>
      <div className="flex justify-end">
        <AiButton onDraft={async () => {
          const r = await aiDraftSection('cmsCta', { campaign: pageTitle });
          if (r) onChange({ eyebrow: r.eyebrow || data.eyebrow, title: r.title || data.title, body: r.body || data.body, ctaText: r.ctaText || data.ctaText });
        }} label="DRAFT CTA" />
      </div>
      <Field label="Eyebrow" v={data.eyebrow} onChange={(v) => onChange({ eyebrow: v })} />
      <Field label="Title" v={data.title} onChange={(v) => onChange({ title: v })} />
      <Field label="Body" v={data.body} onChange={(v) => onChange({ body: v })} />
      <Field label="CTA text" v={data.ctaText} onChange={(v) => onChange({ ctaText: v })} />
      <Field label="CTA URL" v={data.ctaUrl} onChange={(v) => onChange({ ctaUrl: v })} />
    </>
  );

  // ============ DIVIDER ============
  if (type === 'divider') return <p className="text-xs text-mitti">No options. A simple madder rule.</p>;

  return null;
}

function Field({ label, v, onChange, multiline, rows, placeholder }: { label: string; v: any; onChange: (val: string) => void; multiline?: boolean; rows?: number; placeholder?: string }) {
  return (
    <div>
      <label className="label text-mitti">{label}</label>
      {multiline ? (
        <textarea defaultValue={v || ''} onBlur={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full p-2 bg-beige/40 border border-mitti/20 text-sm mt-1" rows={rows || 3} />
      ) : (
        <input defaultValue={v || ''} onBlur={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full p-2 bg-beige/40 border border-mitti/20 text-sm mt-1" />
      )}
    </div>
  );
}

function Select({ label, v, options, onChange }: { label: string; v: string; options: string[]; onChange: (val: string) => void }) {
  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <select value={v} onChange={(e) => onChange(e.target.value)} className="w-full p-2 bg-beige/40 border border-mitti/20 text-sm mt-1">
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
