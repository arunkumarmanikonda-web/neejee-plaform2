'use client';

import { useEffect, useState } from 'react';
import { formatPrice } from '@/lib/utils';

const TIER_COLOR: Record<string, string> = {
  PLATINUM: 'bg-kohl',
  GOLD: 'bg-haldi',
  SILVER: 'bg-monsoon',
  BRONZE: 'bg-mitti',
  NEW: 'bg-banarasi',
};

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  orderCount: number;
  ltv: number;
  lastOrder?: string | null;
  tier: string;
  joined?: string | null;
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [viewerRole, setViewerRole] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError('');

        const [customersRes, meRes] = await Promise.all([
          fetch('/api/admin/customers', { cache: 'no-store' }),
          fetch('/api/me', { cache: 'no-store' }),
        ]);

        const [customersData, meData] = await Promise.all([
          customersRes.json().catch(() => ({})),
          meRes.json().catch(() => ({})),
        ]);

        if (cancelled) return;

        if (customersData.error) {
          setError(customersData.error);
        }

        setCustomers(customersData.customers || []);
        setStats(customersData.stats || {});
        setViewerRole(meData?.role || meData?.user?.role || '');
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load customers');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const canDeleteCustomers = viewerRole === 'SUPER_ADMIN';

  const filtered = search
    ? customers.filter((c) =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  async function handleDelete(customer: CustomerRow) {
    if (!canDeleteCustomers) return;

    const confirmed = window.confirm(
      `Delete customer "${customer.email}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(customer.id);
      setError('');

      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'DELETE',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete customer');
      }

      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      setStats((prev: any) => ({
        ...prev,
        totalCustomers: Math.max((prev?.totalCustomers ?? 1) - 1, 0),
      }));
    } catch (e: any) {
      setError(e?.message || 'Failed to delete customer');
    } finally {
      setDeletingId('');
    }
  }

  const columnCount = canDeleteCustomers && deleteMode ? 8 : 7;

  return (
    <>
      <p className="label text-madder">PEOPLE</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Customers</h1>
      <p className="font-italic italic text-mitti mt-2">
        {loading ? 'Loading...' : `${customers.length} members`}
      </p>
      <div className="madder-divider mt-4"></div>

      {error && (
        <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">
          {error}
        </p>
      )}

      <div className="grid grid-cols-4 gap-4 mt-8">
        <Stat label="TOTAL CUSTOMERS" value={stats.totalCustomers ?? '—'} />
        <Stat label="NEW THIS MONTH" value={`+${stats.newThisMonth ?? 0}`} color="text-neem" />
        <Stat label="REPEAT RATE" value={`${stats.repeatRate ?? 0}%`} />
        <Stat label="AVG LTV" value={stats.avgLtv ? formatPrice(stats.avgLtv) : '—'} />
      </div>

      <div className="mt-12 flex items-center justify-between gap-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-72 p-3 bg-beige border border-mitti/20 font-ui text-sm"
        />

        <div className="flex items-center gap-4">
          {canDeleteCustomers && (
            <label className="flex items-center gap-2 font-ui text-xs text-madder">
              <input
                type="checkbox"
                checked={deleteMode}
                onChange={(e) => setDeleteMode(e.target.checked)}
              />
              <span>Delete mode (SUPER_ADMIN)</span>
            </label>
          )}
          <p className="font-ui text-xs text-mitti">{filtered.length} shown</p>
        </div>
      </div>

      <table className="w-full mt-4 bg-beige font-ui text-sm">
        <thead>
          <tr className="border-b border-mitti/20 text-left text-xs tracking-widest text-mitti">
            <th className="p-4">NAME</th>
            <th className="p-4">EMAIL</th>
            <th className="p-4">PHONE</th>
            <th className="p-4">ORDERS</th>
            <th className="p-4">LIFETIME VALUE</th>
            <th className="p-4">LAST ORDER</th>
            <th className="p-4">TIER</th>
            {canDeleteCustomers && deleteMode && <th className="p-4">ACTIONS</th>}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columnCount} className="p-8 text-center text-mitti">
                Loading customers...
              </td>
            </tr>
          )}

          {!loading && filtered.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="p-8 text-center text-mitti">
                No customers found
              </td>
            </tr>
          )}

          {filtered.map((c) => {
            const hasOrders = c.orderCount > 0;
            const isDeleting = deletingId === c.id;

            return (
              <tr key={c.id} className="border-b border-mitti/10 hover:bg-ivory/50">
                <td className="p-4 font-medium">{c.name}</td>
                <td className="p-4 text-monsoon">{c.email}</td>
                <td className="p-4 text-monsoon text-xs">{c.phone || '—'}</td>
                <td className="p-4">{c.orderCount}</td>
                <td className="p-4 font-medium">{formatPrice(c.ltv)}</td>
                <td className="p-4 text-xs">
                  {c.lastOrder ? new Date(c.lastOrder).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="p-4">
                  <span className={`badge-founder ${TIER_COLOR[c.tier] || 'bg-mitti'}`}>
                    {c.tier}
                  </span>
                </td>

                {canDeleteCustomers && deleteMode && (
                  <td className="p-4">
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={hasOrders || isDeleting}
                      title={hasOrders ? 'Customers with orders cannot be deleted' : 'Delete customer'}
                      className="px-3 py-2 text-xs font-ui border border-madder text-madder disabled:opacity-40 disabled:cursor-not-allowed hover:bg-madder hover:text-white"
                    >
                      {isDeleting ? 'Deleting...' : hasOrders ? 'Protected' : 'Delete'}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function Stat({ label, value, color = 'text-kohl' }: any) {
  return (
    <div className="bg-beige p-5">
      <p className="label">{label}</p>
      <p className={`font-display text-3xl mt-2 ${color}`}>{value}</p>
    </div>
  );
}

