'use client';
import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { formatINR } from '@/lib/money';

type Summary = {
  id: string;
  periodStart: string;
  periodEnd: string;
  narrative: string;
  headlineMetrics: any;
  generatedAt: string;
};

export default function AiSummaryPage() {
  const [list, setList] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/admin/finance/ai-summary');
    const j = await r.json();
    setList(j.summaries || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true); setMsg('');
    try {
      const r = await fetch('/api/admin/finance/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendEmail: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg(`Generated & emailed to ${j.recipients?.length || 0} recipient(s) — source: ${j.source}`);
      await load();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-display text-2xl text-kohl">AI Weekly Briefings</h2>
          <p className="text-mitti text-sm">Auto-generated every Monday 8 am IST · email to all ADMIN, SUPER_ADMIN, FINANCE users</p>
        </div>
        <button onClick={generate} disabled={generating}
          className="flex items-center gap-2 bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest disabled:opacity-50">
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {generating ? 'GENERATING…' : 'GENERATE NOW'}
        </button>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm">{msg}</div>}

      {loading ? (
        <div className="text-mitti py-12 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : list.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti">
          No briefings generated yet. Click <strong>Generate now</strong> to create one for last week, or wait for the cron to fire next Monday morning.
        </div>
      ) : (
        <div className="space-y-4">
          {list.map(s => (
            <div key={s.id} className="bg-ivory border border-mitti/20 p-6 rounded">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="label text-banarasi">
                    {new Date(s.periodStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(new Date(s.periodEnd).getTime() - 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-mitti/60 mt-0.5">
                    Generated {new Date(s.generatedAt).toLocaleString('en-IN')}
                  </p>
                </div>
                {s.headlineMetrics && (
                  <div className="text-right text-xs space-y-0.5">
                    <div>
                      <span className="text-mitti">revenue </span>
                      <span className="text-kohl font-display">{formatINR(s.headlineMetrics.revenue || 0)}</span>
                      <span className="text-mitti mx-1">·</span>
                      <span className="text-mitti">profit </span>
                      <span className="text-kohl font-display">{formatINR(s.headlineMetrics.netProfit || 0)}</span>
                    </div>
                    {(s.headlineMetrics.bankClosing != null || s.headlineMetrics.arOutstanding != null) && (
                      <div className="text-[10px] text-mitti/70">
                        {s.headlineMetrics.bankClosing != null && <>bank {formatINR(s.headlineMetrics.bankClosing)} </>}
                        {s.headlineMetrics.arOutstanding != null && <>· AR {formatINR(s.headlineMetrics.arOutstanding)} </>}
                        {s.headlineMetrics.apOutstanding != null && <>· AP {formatINR(s.headlineMetrics.apOutstanding)}</>}
                      </div>
                    )}
                    {(s.headlineMetrics.commissionIncome > 0 || s.headlineMetrics.marketplaceGmv > 0) && (
                      <div className="text-[10px] text-mitti/70">
                        {s.headlineMetrics.marketplaceGmv > 0 && <>marketplace GMV {formatINR(s.headlineMetrics.marketplaceGmv)} · </>}
                        commission {formatINR(s.headlineMetrics.commissionIncome || 0)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="prose prose-sm max-w-none text-mitti whitespace-pre-line">
                {s.narrative.split('\n\n').map((p, i) => (
                  <p key={i} className="my-2"
                    dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.+?)\*\*/g, '<strong class="text-kohl">$1</strong>') }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
