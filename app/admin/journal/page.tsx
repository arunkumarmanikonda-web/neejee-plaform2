'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Loader2, FileText, CheckCircle2, XCircle, Archive, Eye } from 'lucide-react';

interface DraftRow {
  id: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  tags: string[];
  seedTheme: string | null;
  seedRef: string | null;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  createdByCron: boolean;
  createdAt: string;
  reviewedAt: string | null;
  publishedPageId: string | null;
}

const THEMES = [
  '', // = auto pick
  'artisan-spotlight',
  'craft-technique',
  'product-spotlight',
  'regional-dispatch',
  'material-meditation',
  'founder-letter',
];

const STATUS_COLOURS: Record<DraftRow['status'], string> = {
  DRAFT: 'bg-mitti/10 text-mitti',
  PENDING_REVIEW: 'bg-madder/15 text-madder',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-stone-200 text-stone-700',
  PUBLISHED: 'bg-kohl text-ivory',
};

export default function AdminJournalPage() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [theme, setTheme] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/journal/drafts', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setDrafts(data.drafts || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function generateNow() {
    setGenerating(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/admin/journal/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(theme ? { theme } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generate failed');
      setInfo(`✓ New draft created: "${data.draft.title}". Email sent to ${data.email?.sent ?? 0} reviewer(s).`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="label text-madder mb-1">CONTENT · WEEKLY JOURNAL</p>
          <h1 className="font-serif text-3xl text-kohl">The Journal · auto-curation</h1>
          <p className="font-italic italic text-mitti mt-1">
            A new draft is generated every Monday at 09:00 IST and emailed to Nidhi and admins for review.
            Nothing publishes without approval.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <select
              value={theme}
              onChange={e => setTheme(e.target.value)}
              disabled={generating}
              className="border border-mitti/30 bg-ivory p-2 text-sm font-ui"
            >
              {THEMES.map(t => (
                <option key={t} value={t}>{t || '(auto-pick theme)'}</option>
              ))}
            </select>
            <button
              onClick={generateNow}
              disabled={generating}
              className="bg-madder text-ivory px-5 py-2 font-ui text-xs tracking-widest hover:bg-kohl transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'GENERATING...' : 'GENERATE NOW'}
            </button>
          </div>
          <p className="text-[11px] text-mitti">Manual trigger · ~$0.02 · ~60–120 s</p>
        </div>
      </div>

      {error && <div className="border border-madder bg-madder/10 text-madder p-3 mb-4 font-ui text-sm">{error}</div>}
      {info && <div className="border border-emerald-500 bg-emerald-50 text-emerald-700 p-3 mb-4 font-ui text-sm">{info}</div>}

      {loading ? (
        <p className="text-mitti italic">Loading drafts...</p>
      ) : drafts.length === 0 ? (
        <div className="border border-mitti/20 bg-beige p-8 text-center">
          <FileText className="w-10 h-10 text-mitti mx-auto mb-3" />
          <p className="text-kohl">No drafts yet. Click <strong>GENERATE NOW</strong> to create the first one.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {drafts.map(d => (
            <div key={d.id} className="border border-mitti/20 bg-ivory">
              <div className="flex gap-4 p-4">
                {d.coverImage ? (
                  <img src={d.coverImage} alt="" className="w-32 h-32 object-cover flex-shrink-0 border border-mitti/10" />
                ) : (
                  <div className="w-32 h-32 bg-beige flex-shrink-0 flex items-center justify-center text-mitti italic text-xs">no cover</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-[10px] font-ui tracking-widest ${STATUS_COLOURS[d.status]}`}>{d.status}</span>
                    {d.createdByCron && <span className="text-[10px] text-mitti font-ui tracking-widest">CRON</span>}
                    {d.seedTheme && <span className="text-[10px] text-mitti font-ui">· {d.seedTheme}</span>}
                  </div>
                  <h3 className="font-serif text-lg text-kohl truncate">{d.title}</h3>
                  {d.excerpt && <p className="text-sm text-mitti mt-1 line-clamp-2">{d.excerpt}</p>}
                  <p className="text-[11px] text-mitti mt-2">
                    Created {new Date(d.createdAt).toLocaleDateString()}
                    {d.reviewedAt && ` · Reviewed ${new Date(d.reviewedAt).toLocaleDateString()}`}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Link href={`/admin/journal/${d.id}`} className="text-xs font-ui text-madder hover:underline inline-flex items-center gap-1">
                      <Eye className="w-3 h-3" /> OPEN
                    </Link>
                    {d.publishedPageId && (
                      <a href={`/journal`} target="_blank" rel="noreferrer" className="text-xs font-ui text-kohl hover:underline inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> VIEW LIVE
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
