'use client';
// Customer: view own disputes.

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Row = {
  id: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  resolutionNote: string | null;
  resolutionAmountPaise: number | null;
  resolvedAt: string | null;
  createdAt: string;
  order: { orderNumber: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  AWAITING_CUSTOMER: 'bg-blue-100 text-blue-700',
  AWAITING_VENDOR: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-charcoal/20 text-charcoal/60',
  WITHDRAWN: 'bg-charcoal/10 text-charcoal/50',
};

export default function CustomerDisputesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/disputes')
      .then(r => r.json())
      .then(d => {
        setRows(d.rows || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <Link href="/account" className="text-xs underline text-charcoal/60">
          ← Account
        </Link>
        <h1 className="font-display text-3xl mt-2">My disputes</h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Open issues you&apos;ve raised on past orders. We aim to respond within 3 days.
        </p>
      </header>

      {loading && <div className="text-sm text-charcoal/50">Loading…</div>}
      {!loading && rows.length === 0 && (
        <div className="bg-beige/40 p-6 text-sm text-charcoal/60">
          No disputes raised. Visit any past order and click <strong>Report an issue</strong> if you need help.
        </div>
      )}

      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className="border border-charcoal/10 p-4">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-display text-lg">{r.title}</div>
                <div className="text-xs text-charcoal/60 mt-1">
                  Order {r.order?.orderNumber} · {r.category.replace(/_/g, ' ')} · Raised{' '}
                  {new Date(r.createdAt).toLocaleDateString('en-IN')}
                </div>
              </div>
              <span className={`text-xs px-2 py-1 ${STATUS_STYLE[r.status]}`}>
                {r.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-sm mt-2 whitespace-pre-wrap">{r.description}</p>
            {r.status === 'RESOLVED' && r.resolutionNote && (
              <div className="mt-3 bg-emerald-50 border border-emerald-200 p-3 text-sm">
                <div className="text-xs text-emerald-700 uppercase">Resolution</div>
                <p>{r.resolutionNote}</p>
                {r.resolutionAmountPaise && (
                  <p className="mt-1">
                    <strong>Refund/credit:</strong> ₹
                    {(r.resolutionAmountPaise / 100).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
