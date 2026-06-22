'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Eye, Edit, Trash2, Sparkles, X, Wand2, LayoutTemplate } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Page {
  id: string;
  slug: string;
  title: string;
  status: 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'ARCHIVED';
  updatedAt: string;
  publishedAt: string | null;
}

export default function AdminCMSPage() {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [templateMode, setTemplateMode] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [newPage, setNewPage] = useState({ title: '', slug: '' });
  const [aiBrief, setAiBrief] = useState({ brief: '', audience: '', goal: '' });
  const [aiSubmitting, setAiSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/cms', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setPages(d.pages || []); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch('/api/admin/cms/templates', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.templates) setTemplates(d.templates); })
      .catch(() => {});
  }, []);

  const createFromTemplate = async (templateKey: string) => {
    setError('');
    try {
      const res = await fetch('/api/admin/cms/templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.push(`/admin/cms/${j.page.id}`);
    } catch (e: any) { setError(e.message); }
  };

  const create = async () => {
    setError('');
    if (!newPage.title.trim()) { setError('Title required'); return; }
    const res = await fetch('/api/admin/cms', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPage),
    });
    const j = await res.json();
    if (!res.ok) { setError(j.error || 'Failed'); return; }
    setCreating(false);
    setNewPage({ title: '', slug: '' });
    router.push(`/admin/cms/${j.page.id}`);
  };

  const generateWithAi = async () => {
    setError('');
    if (!aiBrief.brief.trim()) { setError('Tell us what page to create'); return; }
    setAiSubmitting(true);
    try {
      // Step 1: ask AI to scaffold
      const scaffoldRes = await fetch('/api/ai/cms-scaffold', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiBrief),
      });
      const scaffold = await scaffoldRes.json();
      if (!scaffoldRes.ok) throw new Error(scaffold.error || 'AI scaffold failed');

      // Step 2: create CMS page with the scaffolded content
      const createRes = await fetch('/api/admin/cms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: scaffold.page.title,
          slug: scaffold.page.slug,
          sections: scaffold.page.sections,
          seoTitle: scaffold.page.seoTitle,
          seoDesc: scaffold.page.seoDesc,
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) throw new Error(createJson.error || 'Could not create page');

      setAiMode(false); setCreating(false);
      router.push(`/admin/cms/${createJson.page.id}`);
    } catch (e: any) { setError(e.message); }
    finally { setAiSubmitting(false); }
  };

  const del = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    await fetch(`/api/admin/cms/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="label text-madder">CONTENT</p>
          <h1 className="font-display text-4xl text-kohl mt-2">CMS Pages</h1>
          <p className="font-italic italic text-mitti mt-2">Build editorial pages, journal entries, and craft stories.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setAiMode(true); setTemplateMode(false); setCreating(false); }}
            className="flex items-center gap-2 bg-madder text-ivory px-4 py-2 text-sm tracking-wider hover:bg-madder/90"
          >
            <Sparkles className="w-4 h-4" /> ✦ AI PAGE
          </button>
          <button
            onClick={() => { setTemplateMode(true); setAiMode(false); setCreating(false); }}
            className="flex items-center gap-2 bg-banarasi text-kohl px-4 py-2 text-sm tracking-wider hover:bg-banarasi/80"
          >
            <LayoutTemplate className="w-4 h-4" /> FROM TEMPLATE
          </button>
          <button
            onClick={() => { setCreating(true); setAiMode(false); setTemplateMode(false); }}
            className="flex items-center gap-2 bg-kohl text-ivory px-4 py-2 text-sm tracking-wider hover:bg-kohl/90"
          >
            <Plus className="w-4 h-4" /> BLANK PAGE
          </button>
        </div>
      </div>
      <div className="madder-divider mt-4"></div>

      {/* Template picker panel */}
      {templateMode && (
        <div className="bg-banarasi/10 border border-banarasi/40 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-madder" />
              <p className="font-display text-xl text-kohl">Start from a template</p>
            </div>
            <button onClick={() => { setTemplateMode(false); setError(''); }} className="p-1 hover:bg-mitti/10">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="font-italic italic text-mitti text-sm mb-4">
            Pre-built page layouts with NEEJEE-voice placeholder content. Click any template to create it.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map(t => (
              <button
                key={t.key}
                onClick={() => createFromTemplate(t.key)}
                className="bg-ivory border border-mitti/20 hover:border-kohl p-5 text-left transition-colors"
              >
                <div className="font-display text-4xl text-madder mb-2">{t.preview}</div>
                <p className="font-display text-lg text-kohl">{t.name}</p>
                <p className="font-italic italic text-mitti text-xs mt-1">{t.description}</p>
                {t.sectionCount > 0 && (
                  <p className="text-[10px] tracking-wider text-mitti mt-2">{t.sectionCount} sections</p>
                )}
              </button>
            ))}
          </div>
          {error && <p className="text-madder text-sm mt-4">{error}</p>}
        </div>
      )}

      {/* AI page generator panel */}
      {aiMode && (
        <div className="bg-gradient-to-br from-madder/10 to-banarasi/10 border border-madder/30 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-madder" />
              <p className="font-display text-xl text-kohl">Draft a page with AI</p>
            </div>
            <button onClick={() => { setAiMode(false); setError(''); }} className="p-1 hover:bg-mitti/10">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="font-italic italic text-mitti text-sm mb-4">
            Describe the page in plain English. AI scaffolds 4-7 sections with NEEJEE-voice content; you refine the rest.
          </p>
          <div className="space-y-3">
            <div>
              <label className="label text-mitti">WHAT IS THIS PAGE</label>
              <textarea
                value={aiBrief.brief}
                onChange={e => setAiBrief({ ...aiBrief, brief: e.target.value })}
                rows={3}
                placeholder="e.g. A Diwali landing page introducing our 2026 collection — handwoven Banarasis, oxidised silver, mitti attars. Include a founder note and FAQ."
                className="w-full mt-1 p-3 bg-ivory border border-mitti/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-mitti">AUDIENCE</label>
                <input
                  value={aiBrief.audience}
                  onChange={e => setAiBrief({ ...aiBrief, audience: e.target.value })}
                  placeholder="e.g. returning customers, gift buyers"
                  className="w-full mt-1 p-3 bg-ivory border border-mitti/20"
                />
              </div>
              <div>
                <label className="label text-mitti">GOAL</label>
                <input
                  value={aiBrief.goal}
                  onChange={e => setAiBrief({ ...aiBrief, goal: e.target.value })}
                  placeholder="e.g. inspire, drive collection views"
                  className="w-full mt-1 p-3 bg-ivory border border-mitti/20"
                />
              </div>
            </div>
            {error && <p className="text-madder text-sm">{error}</p>}
            <button
              onClick={generateWithAi}
              disabled={aiSubmitting}
              className="bg-madder text-ivory px-6 py-3 text-sm tracking-wider hover:bg-madder/90 disabled:opacity-50 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {aiSubmitting ? 'DRAFTING... (15-30s)' : '✦ GENERATE PAGE'}
            </button>
          </div>
        </div>
      )}

      {/* Blank-slate new page */}
      {creating && (
        <div className="bg-beige p-6 mt-6 max-w-xl">
          <p className="label text-madder mb-3">NEW BLANK PAGE</p>
          <input
            value={newPage.title}
            onChange={e => setNewPage({ ...newPage, title: e.target.value })}
            placeholder="Page title (e.g. About Our Craft)"
            className="w-full p-3 bg-ivory border border-mitti/20 mb-3"
          />
          <input
            value={newPage.slug}
            onChange={e => setNewPage({ ...newPage, slug: e.target.value })}
            placeholder="Slug (auto from title if blank)"
            className="w-full p-3 bg-ivory border border-mitti/20 mb-3 font-mono text-sm"
          />
          {error && <p className="text-madder text-sm mb-3">{error}</p>}
          <div className="flex gap-2">
            <button onClick={create} className="btn-primary text-xs">CREATE</button>
            <button onClick={() => { setCreating(false); setError(''); }} className="text-xs tracking-wider px-4 py-2 border border-mitti/30">CANCEL</button>
          </div>
        </div>
      )}

      <div className="mt-8">
        {loading ? (
          <p className="text-mitti">Loading...</p>
        ) : pages.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-mitti/30">
            <FileText className="w-12 h-12 text-mitti/40 mx-auto mb-4" />
            <p className="font-display text-2xl text-kohl">No pages yet</p>
            <p className="text-mitti mt-2">Try the <strong>✦ AI PAGE</strong> button above — describe what you want in plain English.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-mitti/20">
                <th className="text-left p-3 label text-mitti">TITLE</th>
                <th className="text-left p-3 label text-mitti">SLUG</th>
                <th className="text-left p-3 label text-mitti">STATUS</th>
                <th className="text-left p-3 label text-mitti">UPDATED</th>
                <th className="text-right p-3 label text-mitti">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {pages.map(p => (
                <tr key={p.id} className="border-b border-mitti/10 hover:bg-beige/40">
                  <td className="p-3 font-display text-kohl">{p.title}</td>
                  <td className="p-3 font-mono text-sm text-mitti">/p/{p.slug}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 tracking-wider ${
                      p.status === 'PUBLISHED' ? 'bg-neem/20 text-neem' :
                      p.status === 'DRAFT' ? 'bg-mitti/20 text-mitti' :
                      'bg-haldi/20 text-mitti'
                    }`}>{p.status}</span>
                  </td>
                  <td className="p-3 text-sm text-mitti">{new Date(p.updatedAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {p.status === 'PUBLISHED' && (
                        <Link href={`/p/${p.slug}`} target="_blank" className="p-1.5 hover:bg-mitti/10" title="View"><Eye className="w-4 h-4" /></Link>
                      )}
                      <Link href={`/admin/cms/${p.id}`} className="p-1.5 hover:bg-mitti/10" title="Edit"><Edit className="w-4 h-4" /></Link>
                      <button onClick={() => del(p.id, p.title)} className="p-1.5 hover:bg-madder/10 text-madder" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
