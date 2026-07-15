'use client';
import { useEffect, useState } from 'react';
import { Plus, Send, X, Sparkles, Eye, Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

const SEGMENTS = [
  { value: 'OPTED_IN_ONLY', label: 'All opted-in subscribers' },
  { value: 'CUSTOMERS', label: 'Customers (1+ paid order)' },
  { value: 'VIP', label: 'VIP (3+ orders or â‚¹50k+)' },
  { value: 'LAPSED', label: 'Lapsed (no order in 120+ days)' },
  { value: 'WISHLIST', label: 'Wishlist holders' },
];

export default function AdminMarketing() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/marketing', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.campaigns) setCampaigns(d.campaigns); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="label text-madder">EMAIL BROADCASTS</p>
          <h1 className="font-display text-4xl text-kohl">Marketing</h1>
          <p className="font-italic italic text-mitti mt-1">A quiet letter, only to those who want one.</p>
        </div>
        <button onClick={() => { setCreating(true); setEditing(null); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> NEW BROADCAST
        </button>
      </div>

      {/* Compliance note */}
      <div className="bg-banarasi/10 border border-banarasi/30 p-4 text-sm text-kohl">
        <p className="font-display text-kohl">Honoring opt-ins, always.</p>
        <p className="font-italic italic text-mitti mt-1">
          Broadcasts are sent only to customers with both <strong>marketing consent</strong> and <strong>email opt-in</strong> active.
          Every email carries an unsubscribe link.
        </p>
      </div>

      {/* Table */}
      <section className="bg-beige overflow-x-auto">
        {loading ? (
          <p className="p-12 text-center font-italic italic text-mitti">Loading...</p>
        ) : campaigns.length === 0 ? (
          <p className="p-12 text-center font-italic italic text-mitti">No broadcasts yet. Compose your first letter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-kohl text-ivory">
              <tr className="text-left text-xs label">
                <th className="p-3">NAME</th>
                <th className="p-3">SEGMENT</th>
                <th className="p-3 text-right">AUDIENCE</th>
                <th className="p-3 text-right">SENT</th>
                <th className="p-3">STATUS</th>
                <th className="p-3">DATE</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} className="border-b border-mitti/10">
                  <td className="p-3">
                    <p className="font-ui text-kohl">{c.name}</p>
                    <p className="text-xs text-mitti italic">{c.subject}</p>
                  </td>
                  <td className="p-3 text-xs">{SEGMENTS.find(s => s.value === c.segment)?.label || c.segment}</td>
                  <td className="p-3 text-right">{c.recipientCount}</td>
                  <td className="p-3 text-right">{c.sentCount}{c.bounceCount > 0 ? <span className="text-madder text-xs"> ({c.bounceCount} failed)</span> : ''}</td>
                  <td className="p-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="p-3 text-xs text-mitti">
                    {c.sentAt ? `Sent ${new Date(c.sentAt).toISOString().slice(0, 10)}` : `Draft ${new Date(c.createdAt).toISOString().slice(0, 10)}`}
                  </td>
                  <td className="p-3">
                    <button onClick={() => { setEditing(c); setCreating(true); }} className="text-mitti hover:text-madder text-xs">
                      {c.status === 'SENT' ? 'VIEW' : 'EDIT'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {creating && (
        <CampaignEditor
          existing={editing}
          onClose={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'bg-mitti/20 text-mitti',
    SCHEDULED: 'bg-banarasi/20 text-banarasi',
    SENDING: 'bg-haldi/30 text-haldi',
    SENT: 'bg-neem/20 text-neem',
    CANCELLED: 'bg-madder/20 text-madder',
  };
  return <span className={`text-xs px-2 py-1 ${map[status] || 'bg-mitti/20'}`}>{status}</span>;
}

function CampaignEditor({ existing: initial, onClose }: { existing: any; onClose: () => void }) {
  const [existing, setExisting] = useState<any>(initial);
  const isReadOnly = existing?.status === 'SENT' || existing?.status === 'SENDING';
  const [form, setForm] = useState({
    name: existing?.name || '',
    subject: existing?.subject || '',
    bodyHtml: existing?.bodyHtml || '<p>Dear {{firstName}},</p>\n<p>We have something quiet to share...</p>\n<p><a href="https://www.neejee.com/categories/women">See what is new â†’</a></p>',
    segment: existing?.segment || 'OPTED_IN_ONLY',
    notes: existing?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(false);

  const save = async (): Promise<any> => {
    setSaving(true); setErr('');
    try {
      const method = existing ? 'PATCH' : 'POST';
      const body = existing ? { id: existing.id, ...form } : form;
      const res = await fetch('/api/admin/marketing', {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      // Update existing ref so next save patches and Send can fire
      if (d.campaign) setExisting(d.campaign);
      return d.campaign;
    } catch (e: any) { setErr(e.message); return null; }
    finally { setSaving(false); }
  };

  const send = async () => {
    // For ADMIN/SUPER_ADMIN â€” direct send (bypass). Otherwise the API will refuse and tell us to submit.
    if (!confirm(`Send this broadcast to all opted-in recipients in the "${form.segment}" segment? This cannot be undone.`)) return;
    setSending(true); setErr('');
    try {
      const saved = await save();
      const id = saved?.id || existing?.id;
      if (!id) throw new Error('Could not save campaign');
      const res = await fetch('/api/admin/marketing', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'SEND' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      alert(`Sent to ${d.sent} recipients. ${d.failed > 0 ? d.failed + ' failed.' : ''}`);
      onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSending(false); }
  };

  const submitForApproval = async () => {
    if (!confirm(`Submit this broadcast to a Marketing Manager for approval?`)) return;
    setSending(true); setErr('');
    try {
      const saved = await save();
      const id = saved?.id || existing?.id;
      if (!id) throw new Error('Could not save campaign');
      const res = await fetch('/api/admin/marketing', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'SUBMIT_FOR_APPROVAL' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      alert(d.message || 'Submitted for approval');
      onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSending(false); }
  };

  const aiDraft = async (kind: 'subject' | 'body') => {
    setDrafting(true);
    setErr('');
    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: kind === 'subject' ? 'emailSubject' : 'emailBody',
          brief: {
            campaign: form.name || 'NEEJEE update',
            segment: form.segment,
            notes: form.notes,
          },
        }),
      });

      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(d.error || 'AI drafting failed');
      }

      if (d.configured === false) {
        throw new Error(d.message || 'AI drafting is not configured yet.');
      }

      if (!d.text) {
        throw new Error('AI did not return any draft text.');
      }

      if (kind === 'subject') {
        setForm(f => ({ ...f, subject: String(d.text).replace(/^["']|["']$/g, '') }));
      } else {
        setForm(f => ({ ...f, bodyHtml: String(d.text) }));
      }
    } catch (e: any) {
      setErr(e.message || 'AI drafting failed');
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-ivory max-w-3xl w-full p-8 my-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-kohl">{existing ? (isReadOnly ? 'View Broadcast' : 'Edit Broadcast') : 'New Broadcast'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label text-mitti">CAMPAIGN NAME (internal)</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              disabled={isReadOnly}
              className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui"
              placeholder="Diwali Drop Â· Sept 2025"
            />
          </div>

          <div>
            <label className="label text-mitti">AUDIENCE SEGMENT</label>
            <select
              value={form.segment}
              onChange={e => setForm({ ...form, segment: e.target.value })}
              disabled={isReadOnly}
              className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui"
            >
              {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {existing && <p className="text-xs text-mitti mt-1 italic">{existing.recipientCount} opted-in recipients in this segment.</p>}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label text-mitti">SUBJECT LINE</label>
              {!isReadOnly && (
                <button onClick={() => aiDraft('subject')} disabled={drafting} className="text-xs text-madder hover:text-kohl flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> {drafting ? '...' : 'DRAFT WITH AI'}
                </button>
              )}
            </div>
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              disabled={isReadOnly}
              className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui"
              placeholder="A small letter from Mumbai..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label text-mitti">BODY (HTML supported Â· {`{{firstName}}, {{name}}, {{email}}`})</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setPreview(!preview)} className="text-xs text-mitti hover:text-kohl flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {preview ? 'EDIT' : 'PREVIEW'}
                </button>
                {!isReadOnly && (
                  <button onClick={() => aiDraft('body')} disabled={drafting} className="text-xs text-madder hover:text-kohl flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {drafting ? '...' : 'DRAFT WITH AI'}
                  </button>
                )}
              </div>
            </div>
            {preview ? (
              <div className="mt-1 p-4 bg-ivory border border-mitti/20 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: form.bodyHtml.replace(/\{\{firstName\}\}/g, 'Nidhi') }} />
            ) : (
              <textarea
                value={form.bodyHtml}
                onChange={e => setForm({ ...form, bodyHtml: e.target.value })}
                disabled={isReadOnly}
                rows={10}
                className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui text-sm"
              />
            )}
          </div>

          {!isReadOnly && (
            <div>
              <label className="label text-mitti">INTERNAL NOTES (optional)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui text-sm"
                placeholder="Promo context, A/B test variant, etc."
              />
            </div>
          )}

          {err && <p className="text-madder text-sm">{err}</p>}

          {!isReadOnly && (
            <div className="pt-4 border-t border-mitti/20 space-y-3">
              <p className="text-xs text-mitti italic">
                Marketing Operators submit for approval. Admins & Managers can send directly.
              </p>
              <div className="flex gap-3">
                <button onClick={save} disabled={saving || sending} className="btn-outline flex-1">
                  {saving ? 'SAVING...' : 'SAVE DRAFT'}
                </button>
                <button onClick={submitForApproval} disabled={saving || sending}
                  className="border border-banarasi text-banarasi px-4 py-2 font-ui text-xs tracking-widest flex items-center justify-center gap-2 flex-1">
                  <Shield className="w-4 h-4" /> SUBMIT FOR APPROVAL
                </button>
                <button onClick={send} disabled={saving || sending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> {sending ? 'SENDING...' : 'SEND NOW'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
