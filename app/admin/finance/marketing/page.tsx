'use client';
import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/money';
import { Loader2, Plus, Trash2 } from 'lucide-react';

type Category = { id: string; code: string; label: string; isMarketingChannel: boolean };
type Budget = { id: string; expenseCategoryId: string; periodYear: number; periodMonth: number; budgetPaise: number };
type Map = { id: string; couponId: string; expenseCategoryId: string; coupon: any; category: any };
type Coupon = { id: string; code: string; name?: string };

export default function MarketingPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [maps, setMaps] = useState<Map[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const load = async () => {
    setLoading(true);
    const [cR, bR, mR, couR] = await Promise.all([
      fetch('/api/admin/finance/categories'),
      fetch(`/api/admin/finance/marketing/budgets?year=${year}&month=${month}`),
      fetch('/api/admin/finance/marketing/channel-map'),
      fetch('/api/admin/coupons').catch(() => null),
    ]);
    const cJ = await cR.json();
    const bJ = await bR.json();
    const mJ = await mR.json();
    setCats((cJ.categories || []).filter((c: Category) => c.isMarketingChannel));
    setBudgets(bJ.budgets || []);
    setMaps(mJ.maps || []);
    if (couR) {
      const couJ = await couR.json();
      setCoupons(couJ.coupons || couJ || []);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const saveBudget = async (catId: string, rupees: string) => {
    const r = await fetch('/api/admin/finance/marketing/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseCategoryId: catId,
        periodYear: year, periodMonth: month,
        budgetPaise: Math.round(parseFloat(rupees || '0') * 100),
      }),
    });
    if (r.ok) load();
  };

  const addMap = async (couponId: string, catId: string) => {
    if (!couponId || !catId) return;
    const r = await fetch('/api/admin/finance/marketing/channel-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couponId, expenseCategoryId: catId }),
    });
    if (r.ok) load();
  };

  const deleteMap = async (id: string) => {
    if (!confirm('Remove this attribution?')) return;
    const r = await fetch(`/api/admin/finance/marketing/channel-map?id=${id}`, { method: 'DELETE' });
    if (r.ok) load();
  };

  if (loading) return <div className="text-mitti py-12 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-kohl">Marketing</h2>
        <p className="text-mitti text-sm">Budgets per channel & coupon → channel attribution map</p>
      </div>

      {/* Budgets */}
      <section className="bg-ivory border border-mitti/20 rounded p-5">
        <h3 className="font-display text-lg text-kohl mb-1">Monthly budgets</h3>
        <p className="text-mitti text-xs mb-4">
          For {new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
        {cats.length === 0 ? (
          <p className="text-mitti text-sm">No marketing-channel categories. Mark some in Chart of Accounts first.</p>
        ) : (
          <table className="w-full font-ui text-sm">
            <thead className="text-mitti text-xs label">
              <tr className="border-b border-mitti/10">
                <th className="text-left p-2">CHANNEL</th>
                <th className="text-right p-2">BUDGET (₹)</th>
              </tr>
            </thead>
            <tbody>
              {cats.map(c => {
                const b = budgets.find(x => x.expenseCategoryId === c.id);
                return <BudgetRow key={c.id} category={c} budget={b} onSave={(v) => saveBudget(c.id, v)} />;
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Channel map */}
      <section className="bg-ivory border border-mitti/20 rounded p-5">
        <h3 className="font-display text-lg text-kohl mb-1">Coupon → channel attribution</h3>
        <p className="text-mitti text-xs mb-4">
          When a customer uses a mapped coupon, revenue is credited to that channel for CAC/ROMI calculation.
        </p>
        <AddMap coupons={coupons} categories={cats} existing={maps} onAdd={addMap} />
        {maps.length > 0 && (
          <table className="w-full font-ui text-sm mt-4">
            <thead className="text-mitti text-xs label">
              <tr className="border-b border-mitti/10">
                <th className="text-left p-2">COUPON</th>
                <th className="text-left p-2">CHANNEL</th>
                <th className="text-right p-2"></th>
              </tr>
            </thead>
            <tbody>
              {maps.map(m => (
                <tr key={m.id} className="border-t border-mitti/5">
                  <td className="p-2 text-kohl">{m.coupon?.code || m.couponId.slice(0, 8)}</td>
                  <td className="p-2 text-mitti">{m.category?.label || m.expenseCategoryId.slice(0, 8)}</td>
                  <td className="p-2 text-right">
                    <button onClick={() => deleteMap(m.id)} className="text-madder hover:opacity-70">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function BudgetRow({ category, budget, onSave }: { category: Category; budget: Budget | undefined; onSave: (v: string) => void }) {
  const [val, setVal] = useState(budget ? String(budget.budgetPaise / 100) : '');
  return (
    <tr className="border-t border-mitti/5">
      <td className="p-2 text-kohl">{category.label}</td>
      <td className="p-2 text-right">
        <div className="flex justify-end gap-2 items-center">
          <input type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)}
            placeholder={budget ? '' : 'set'}
            className="border border-mitti/30 px-3 py-1 text-sm w-32 text-right" />
          <button onClick={() => onSave(val)}
            className="bg-kohl text-ivory px-3 py-1 font-ui text-xs tracking-widest">
            SAVE
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddMap({ coupons, categories, existing, onAdd }: { coupons: Coupon[]; categories: Category[]; existing: Map[]; onAdd: (couponId: string, catId: string) => void }) {
  const [coupon, setCoupon] = useState('');
  const [cat, setCat] = useState('');
  const usedCoupons = new Set(existing.map(m => m.couponId));
  const available = coupons.filter(c => !usedCoupons.has(c.id));

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <p className="label text-banarasi mb-1 text-[10px]">COUPON</p>
        <select value={coupon} onChange={e => setCoupon(e.target.value)}
          className="w-full border border-mitti/30 px-3 py-2 text-sm bg-ivory">
          <option value="">Pick a coupon…</option>
          {available.map(c => <option key={c.id} value={c.id}>{c.code} {c.name ? `— ${c.name}` : ''}</option>)}
        </select>
      </div>
      <div className="flex-1">
        <p className="label text-banarasi mb-1 text-[10px]">CHANNEL</p>
        <select value={cat} onChange={e => setCat(e.target.value)}
          className="w-full border border-mitti/30 px-3 py-2 text-sm bg-ivory">
          <option value="">Pick a channel…</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <button onClick={() => { onAdd(coupon, cat); setCoupon(''); setCat(''); }}
        disabled={!coupon || !cat}
        className="bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest disabled:opacity-50 flex items-center gap-1">
        <Plus className="w-3 h-3" /> ADD
      </button>
    </div>
  );
}
