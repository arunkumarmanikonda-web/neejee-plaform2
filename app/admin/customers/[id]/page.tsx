'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatPrice } from '@/lib/utils';

type CustomerOrder = {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
};

type CustomerStats = {
  orderCount: number;
  addressCount: number;
  wishlistCount: number;
  paidOrderCount: number;
  ltv: number;
  tier: string;
  lastOrder?: string | null;
};

type CustomerDetail = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  marketingConsent?: boolean;
  smsOptIn?: boolean;
  whatsappOptIn?: boolean;
  emailOptIn?: boolean;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string | null;
  primaryAuthMethod?: string | null;
  dateOfBirth?: string | null;
  anniversaryAt?: string | null;
  orders: CustomerOrder[];
  stats: CustomerStats;
};

type Permissions = {
  canView: boolean;
  canFullEdit: boolean;
  canCrmEdit: boolean;
  canDelete: boolean;
};

const TIER_COLOR: Record<string, string> = {
  PLATINUM: 'bg-kohl text-white',
  GOLD: 'bg-haldi text-kohl',
  SILVER: 'bg-monsoon text-white',
  BRONZE: 'bg-mitti text-white',
  NEW: 'bg-banarasi text-white',
};

function toDateInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN');
}

export default function AdminCustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const customerId = params?.id;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({
    canView: false,
    canFullEdit: false,
    canCrmEdit: false,
    canDelete: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    anniversaryAt: '',
    marketingConsent: false,
    smsOptIn: false,
    whatsappOptIn: false,
    emailOptIn: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError('');
        setSuccess('');

        const res = await fetch(`/api/admin/customers/${customerId}`, {
          cache: 'no-store',
        });

        const data = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load customer');
        }

        const nextCustomer = data?.customer || null;
        const nextPermissions = data?.permissions || {
          canView: false,
          canFullEdit: false,
          canCrmEdit: false,
          canDelete: false,
        };

        setCustomer(nextCustomer);
        setPermissions(nextPermissions);
        setForm({
          name: nextCustomer?.name || '',
          email: nextCustomer?.email || '',
          phone: nextCustomer?.phone || '',
          dateOfBirth: toDateInput(nextCustomer?.dateOfBirth),
          anniversaryAt: toDateInput(nextCustomer?.anniversaryAt),
          marketingConsent: !!nextCustomer?.marketingConsent,
          smsOptIn: !!nextCustomer?.smsOptIn,
          whatsappOptIn: !!nextCustomer?.whatsappOptIn,
          emailOptIn: !!nextCustomer?.emailOptIn,
        });
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load customer');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (customerId) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const canEdit = permissions.canFullEdit || permissions.canCrmEdit;
  const crmOnly = permissions.canCrmEdit && !permissions.canFullEdit;

  const changed = useMemo(() => {
    if (!customer) return false;

    return (
      form.name !== (customer.name || '') ||
      form.email !== (customer.email || '') ||
      form.phone !== (customer.phone || '') ||
      form.dateOfBirth !== toDateInput(customer.dateOfBirth) ||
      form.anniversaryAt !== toDateInput(customer.anniversaryAt) ||
      form.marketingConsent !== !!customer.marketingConsent ||
      form.smsOptIn !== !!customer.smsOptIn ||
      form.whatsappOptIn !== !!customer.whatsappOptIn ||
      form.emailOptIn !== !!customer.emailOptIn
    );
  }, [form, customer]);

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!canEdit || !customer) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const payload: Record<string, any> = {
        name: form.name,
        phone: form.phone,
        dateOfBirth: form.dateOfBirth || null,
        anniversaryAt: form.anniversaryAt || null,
        marketingConsent: form.marketingConsent,
        smsOptIn: form.smsOptIn,
        whatsappOptIn: form.whatsappOptIn,
        emailOptIn: form.emailOptIn,
      };

      if (permissions.canFullEdit) {
        payload.email = form.email;
      }

      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save customer');
      }

      const nextCustomer = data?.customer || customer;
      const nextPermissions = data?.permissions || permissions;

      setCustomer(nextCustomer);
      setPermissions(nextPermissions);
      setForm({
        name: nextCustomer?.name || '',
        email: nextCustomer?.email || '',
        phone: nextCustomer?.phone || '',
        dateOfBirth: toDateInput(nextCustomer?.dateOfBirth),
        anniversaryAt: toDateInput(nextCustomer?.anniversaryAt),
        marketingConsent: !!nextCustomer?.marketingConsent,
        smsOptIn: !!nextCustomer?.smsOptIn,
        whatsappOptIn: !!nextCustomer?.whatsappOptIn,
        emailOptIn: !!nextCustomer?.emailOptIn,
      });

      setSuccess('Customer updated successfully.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <p className="label text-madder">PEOPLE</p>
        <h1 className="font-display text-4xl text-kohl mt-2">Customer Detail</h1>
        <p className="font-italic italic text-mitti mt-2">Loading...</p>
      </>
    );
  }

  if (error && !customer) {
    return (
      <>
        <p className="label text-madder">PEOPLE</p>
        <h1 className="font-display text-4xl text-kohl mt-2">Customer Detail</h1>
        <div className="mt-6 border border-madder bg-rose-50 text-madder px-4 py-3">
          {error}
        </div>
        <div className="mt-6">
          <Link href="/admin/customers" className="underline text-kohl">
            ← Back to customers
          </Link>
        </div>
      </>
    );
  }

  if (!customer) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="label text-madder">PEOPLE</p>
          <h1 className="font-display text-4xl text-kohl mt-2">
            {customer.name || customer.email}
          </h1>
          <p className="font-italic italic text-mitti mt-2">
            Customer detail and CRM controls
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-3 py-2 text-xs font-ui ${TIER_COLOR[customer.stats?.tier] || 'bg-mitti text-white'}`}>
            {customer.stats?.tier || 'NEW'}
          </span>
          <Link href="/admin/customers" className="px-4 py-2 border border-kohl text-kohl hover:bg-kohl hover:text-white">
            Back
          </Link>
        </div>
      </div>

      <div className="madder-divider mt-4" />

      {error && (
        <div className="mt-6 border border-madder bg-rose-50 text-madder px-4 py-3">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-6 border border-emerald-600 bg-emerald-50 text-emerald-700 px-4 py-3">
          {success}
        </div>
      )}

      <div className="mt-6 grid md:grid-cols-4 gap-4">
        <Stat label="Tier" value={customer.stats?.tier || 'NEW'} />
        <Stat label="Orders" value={String(customer.stats?.orderCount || 0)} />
        <Stat label="LTV" value={formatPrice(customer.stats?.ltv || 0)} />
        <Stat
          label="Last order"
          value={customer.stats?.lastOrder ? formatDate(customer.stats.lastOrder) : '—'}
        />
      </div>

      <div className="mt-8 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white border border-stone-200 p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-display text-2xl text-kohl">Profile</h2>
                <p className="text-sm text-mitti mt-1">
                  {permissions.canFullEdit
                    ? 'Full edit access'
                    : permissions.canCrmEdit
                    ? 'CRM-only edit access'
                    : 'View only'}
                </p>
              </div>

              {crmOnly && (
                <span className="px-3 py-2 text-xs border border-banarasi text-banarasi">
                  CRM-only mode
                </span>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <Field label="Name">
                <input
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  disabled={!canEdit}
                  className="w-full border border-stone-300 px-3 py-2 bg-white disabled:bg-stone-100"
                />
              </Field>

              <Field label="Email">
                <input
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  disabled={!permissions.canFullEdit}
                  className="w-full border border-stone-300 px-3 py-2 bg-white disabled:bg-stone-100"
                />
              </Field>

              <Field label="Phone">
                <input
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  disabled={!canEdit}
                  className="w-full border border-stone-300 px-3 py-2 bg-white disabled:bg-stone-100"
                />
              </Field>

              <Field label="Primary auth method">
                <div className="border border-stone-200 px-3 py-2 bg-stone-50">
                  {customer.primaryAuthMethod || '—'}
                </div>
              </Field>

              <Field label="Date of birth">
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => updateField('dateOfBirth', e.target.value)}
                  disabled={!canEdit}
                  className="w-full border border-stone-300 px-3 py-2 bg-white disabled:bg-stone-100"
                />
              </Field>

              <Field label="Anniversary">
                <input
                  type="date"
                  value={form.anniversaryAt}
                  onChange={(e) => updateField('anniversaryAt', e.target.value)}
                  disabled={!canEdit}
                  className="w-full border border-stone-300 px-3 py-2 bg-white disabled:bg-stone-100"
                />
              </Field>

              <Field label="Joined">
                <div className="border border-stone-200 px-3 py-2 bg-stone-50">
                  {formatDate(customer.createdAt)}
                </div>
              </Field>

              <Field label="Updated">
                <div className="border border-stone-200 px-3 py-2 bg-stone-50">
                  {formatDate(customer.updatedAt)}
                </div>
              </Field>
            </div>

            <div className="mt-6 grid md:grid-cols-2 gap-3">
              <Toggle
                label="Marketing consent"
                checked={form.marketingConsent}
                onChange={(v) => updateField('marketingConsent', v)}
                disabled={!canEdit}
              />
              <Toggle
                label="SMS opt-in"
                checked={form.smsOptIn}
                onChange={(v) => updateField('smsOptIn', v)}
                disabled={!canEdit}
              />
              <Toggle
                label="WhatsApp opt-in"
                checked={form.whatsappOptIn}
                onChange={(v) => updateField('whatsappOptIn', v)}
                disabled={!canEdit}
              />
              <Toggle
                label="Email opt-in"
                checked={form.emailOptIn}
                onChange={(v) => updateField('emailOptIn', v)}
                disabled={!canEdit}
              />
            </div>

            {canEdit && (
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving || !changed}
                  className="px-4 py-2 bg-kohl text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>

                {!permissions.canFullEdit && (
                  <span className="text-sm text-mitti">
                    Email is locked for CRM-only roles.
                  </span>
                )}
              </div>
            )}
          </section>

          <section className="bg-white border border-stone-200 p-6">
            <h2 className="font-display text-2xl text-kohl">Recent orders</h2>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left border-b border-stone-200">
                    <th className="p-3">Order</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders?.length ? (
                    customer.orders.map((order) => (
                      <tr key={order.id} className="border-b border-stone-100">
                        <td className="p-3">{order.orderNumber}</td>
                        <td className="p-3">{formatDate(order.createdAt)}</td>
                        <td className="p-3">{order.status}</td>
                        <td className="p-3">{order.paymentStatus}</td>
                        <td className="p-3 text-right">{formatPrice(order.total || 0)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-3 text-mitti" colSpan={5}>
                        No orders found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-beige p-6">
            <h2 className="font-display text-2xl text-kohl">Status</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Role" value={customer.role} />
              <Row label="Phone verified" value={customer.phoneVerified ? 'Yes' : 'No'} />
              <Row label="Phone verified at" value={formatDate(customer.phoneVerifiedAt)} />
              <Row label="Addresses" value={String(customer.stats?.addressCount || 0)} />
              <Row label="Wishlist items" value={String(customer.stats?.wishlistCount || 0)} />
              <Row label="Paid orders" value={String(customer.stats?.paidOrderCount || 0)} />
            </div>
          </section>

          <section className="bg-beige p-6">
            <h2 className="font-display text-2xl text-kohl">Edit policy</h2>
            <ul className="mt-4 text-sm text-kohl space-y-2 list-disc pl-5">
              <li>SUPER_ADMIN can update all supported fields.</li>
              <li>ADMIN can view customer detail but cannot edit.</li>
              <li>Telecaller and marketing roles can update CRM fields only.</li>
              <li>Email updates are restricted to SUPER_ADMIN.</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-mitti mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 border border-stone-200 px-4 py-3">
      <span className="text-sm text-kohl">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-beige p-5">
      <p className="label">{label}</p>
      <p className="font-display text-3xl mt-2 text-kohl">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-mitti">{label}</span>
      <span className="text-kohl text-right">{value}</span>
    </div>
  );
}