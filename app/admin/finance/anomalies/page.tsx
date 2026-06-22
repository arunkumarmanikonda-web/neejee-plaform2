'use client';
import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, TrendingUp, Target, Check } from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function AnomaliesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [persisting, setPersisting] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/admin/finance/anomalies');
    setData(await r.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const persist = async () => {
    setPersisting(true);
    const r = await fetch('/api/admin/finance/anomalies', { method: 'POST' });
    const j = await r.json();
    setMsg(`Persisted ${j.inserted || 0} new alert(s)`);
    setPersisting(false);
    load();
  };

  const acknowledge = async (id: string) => {
    await fetch(`/api/admin/finance/anomalies/${id}`, { method: 'POST' });
    load();
  };

  if (loading) return <div className="text-mitti py-12 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>;
  if (!data) return null;

  const severityCls = (sev: string) =>
    sev === 'HIGH' ? 'bg-madder/20 text-madder border-madder/40' :
    sev === 'MED'  ? 'bg-banarasi/20 text-banarasi border-banarasi/40' :
                      'bg-mitti/10 text-mitti border-mitti/30';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-kohl">Spend Anomaly Detection</h2>
          <p className="text-mitti text-sm">4-week rolling z-score on category spend · monthly budget alerts</p>
        </div>
        <button onClick={persist} disabled={persisting}
          className="bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest disabled:opacity-50">
          {persisting ? 'PERSISTING…' : 'SNAPSHOT NOW'}
        </button>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm">{msg}</div>}

      <section>
        <h3 className="font-display text-lg text-kohl mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-banarasi" /> Live detections
        </h3>
        {(data.live || []).length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 p-6 rounded text-center text-emerald-800">
            <Check className="w-6 h-6 inline" /> No anomalies. Spending looks normal.
          </div>
        ) : (
          <div className="space-y-2">
            {data.live.map((a: any) => (
              <div key={a.categoryId} className={`border-l-4 p-4 rounded ${severityCls(a.severity)}`}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-display text-base text-kohl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> {a.categoryLabel}
                      <span className="text-[10px] tracking-widest bg-ivory px-1.5 py-0.5 rounded">{a.severity}</span>
                    </p>
                    <p className="text-sm mt-1 text-kohl">
                      This week: <strong>{formatINR(a.actualPaise)}</strong>
                      {' '}vs 4-week mean <strong>{formatINR(a.meanPaise)}</strong> (z={a.zScore})
                    </p>
                    {a.budgetAlert && (
                      <p className="text-sm mt-1 flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {a.budgetAlert === 'OVER_BUDGET' ? 'Over budget' : 'Near budget'}:
                        {' '}{formatINR(a.monthSpendPaise || 0)} / {formatINR(a.budgetPaise || 0)} ({a.budgetPctUsed}%)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {(data.recent || []).length > 0 && (
        <section>
          <h3 className="font-display text-lg text-kohl mb-3">Recent snapshots</h3>
          <div className="bg-ivory border border-mitti/20 rounded overflow-hidden">
            <table className="w-full font-ui text-sm">
              <thead className="bg-beige/50 text-mitti text-xs label">
                <tr>
                  <th className="text-left p-3">WEEK</th>
                  <th className="text-left p-3">SEVERITY</th>
                  <th className="text-right p-3">ACTUAL</th>
                  <th className="text-right p-3">MEAN</th>
                  <th className="text-right p-3">Z-SCORE</th>
                  <th className="text-center p-3">ACK?</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r: any) => (
                  <tr key={r.id} className="border-t border-mitti/10">
                    <td className="p-3 text-mitti text-xs">{new Date(r.periodStart).toLocaleDateString('en-IN')}</td>
                    <td className="p-3"><span className={`text-[10px] tracking-widest px-2 py-0.5 rounded ${severityCls(r.severity)}`}>{r.severity}</span></td>
                    <td className="p-3 text-right tabular-nums">{formatINR(r.actualPaise)}</td>
                    <td className="p-3 text-right tabular-nums text-mitti">{formatINR(r.meanPaise)}</td>
                    <td className="p-3 text-right">{r.zScore}</td>
                    <td className="p-3 text-center">
                      {r.acknowledgedAt ? (
                        <span className="text-emerald-700 text-xs">✓</span>
                      ) : (
                        <button onClick={() => acknowledge(r.id)} className="text-xs text-banarasi hover:underline">
                          acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
