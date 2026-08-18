'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function SellerCommunicationsPage() {
  const params = useParams();
  const id = params?.id as string;
  const [seller, setSeller] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('A clarification is needed for your NEEJEE seller application');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activationSending, setActivationSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const response = await fetch(`/api/admin/sellers/${id}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'Failed to load seller.');
        setSeller(data?.seller || null);
      } catch (e: any) {
        setError(e?.message || 'Failed to load seller.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function sendQuery() {
    if (!query.trim()) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/sellers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestInfo: true,
          subject: subject.trim(),
          query: query.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to send clarification request.');
      setNotice(`Clarification request sent to ${data?.recipient || seller?.email || 'the seller'}.`);
      setQuery('');
    } catch (e: any) {
      setError(e?.message || 'Failed to send clarification request.');
    } finally {
      setSending(false);
    }
  }

  async function reissueActivation() {
    setActivationSending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/sellers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resendActivationEmail: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to issue Seller Studio activation.');
      setNotice(`Secure Seller Studio activation sent to ${seller?.email || 'the seller'}.`);
    } catch (e: any) {
      setError(e?.message || 'Failed to issue Seller Studio activation.');
    } finally {
      setActivationSending(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-mitti">Loading seller communication workspace…</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="label text-madder">SELLER REVIEW</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Seller communications</h1>
          <p className="font-body text-sm text-mitti mt-2">
            Request clarification without rejecting an application, or securely reissue Seller Studio activation after approval.
          </p>
        </div>
        <Link href={`/admin/sellers/${id}`} className="text-xs tracking-wider text-kohl underline underline-offset-4">
          BACK TO SELLER
        </Link>
      </div>

      {seller ? (
        <div className="mt-8 bg-beige border border-mitti/15 p-5">
          <p className="font-display text-xl text-kohl">{seller.businessName}</p>
          <p className="text-sm text-mitti mt-1">Communication email: <strong className="text-kohl">{seller.email}</strong></p>
          <p className="text-xs text-mitti mt-1">Current status: {String(seller.kycStatus || '').replace(/_/g, ' ')}</p>

          {String(seller.kycStatus || '') === 'APPROVED' ? (
            <div className="mt-5 border-t border-mitti/15 pt-5">
              <p className="text-sm text-kohl">Seller Studio access</p>
              <p className="text-xs text-mitti mt-1">Send a fresh 72-hour secure activation link. No password is generated or emailed.</p>
              <button
                type="button"
                onClick={() => void reissueActivation()}
                disabled={activationSending}
                className="mt-3 border border-kohl/25 px-4 py-2 text-[10px] tracking-widest text-kohl hover:bg-white disabled:opacity-40"
              >
                {activationSending ? 'SENDING…' : 'REISSUE SECURE ACTIVATION'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="mt-6 border-l-4 border-madder bg-madder/10 p-4 text-sm text-madder">{error}</div> : null}
      {notice ? <div className="mt-6 border-l-4 border-neem bg-neem/10 p-4 text-sm text-kohl">{notice}</div> : null}

      <div className="mt-8 bg-white border border-mitti/20 p-6">
        <p className="label text-madder">REQUEST INFORMATION</p>
        <p className="text-sm text-mitti mt-2">Use this for missing, unclear or additional information. It keeps the application under review rather than rejecting it.</p>

        <label className="label text-mitti mt-6 block" htmlFor="subject">SUBJECT</label>
        <input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 w-full border border-mitti/25 bg-ivory p-3 text-sm outline-none focus:border-madder"
        />

        <label className="label text-mitti mt-6 block" htmlFor="query">CLARIFICATION / INFORMATION REQUIRED</label>
        <textarea
          id="query"
          rows={8}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Clearly state what is required, for example: Please share a clearer cancelled-cheque image showing the account holder name and IFSC."
          className="mt-1 w-full border border-mitti/25 bg-ivory p-3 text-sm leading-7 outline-none focus:border-madder"
        />

        <p className="mt-3 text-xs text-mitti">
          The seller is told that the existing application and uploaded documents remain on file and that there is no need to apply again.
        </p>

        <button
          type="button"
          onClick={() => void sendQuery()}
          disabled={sending || !query.trim() || !seller}
          className="mt-6 bg-kohl text-ivory px-5 py-3 text-xs tracking-widest disabled:opacity-40"
        >
          {sending ? 'SENDING…' : 'SEND CLARIFICATION REQUEST'}
        </button>
      </div>
    </div>
  );
}
