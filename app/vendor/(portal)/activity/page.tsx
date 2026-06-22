'use client';
import { useEffect, useState } from 'react';
import { Loader2, Activity, User, ShieldCheck, KeyRound, FileText, Clock, CheckCircle2, XCircle } from 'lucide-react';

const ACTION_LABELS: Record<string, { label: string; Icon: any; color: string }> = {
  LOGIN:                   { label: 'Signed in',               Icon: User,        color: 'text-mitti' },
  PASSWORD_SET:            { label: 'Password set',            Icon: KeyRound,    color: 'text-green-700' },
  PASSWORD_CHANGED:        { label: 'Password changed',        Icon: KeyRound,    color: 'text-green-700' },
  PROFILE_DIRECT_EDIT:     { label: 'Profile edited',          Icon: User,        color: 'text-mitti' },
  CHANGE_REQUESTED:        { label: 'Change request submitted',Icon: Clock,       color: 'text-mitti' },
  CHANGE_APPROVED:         { label: 'Change approved',         Icon: CheckCircle2, color: 'text-green-700' },
  CHANGE_REJECTED:         { label: 'Change rejected',         Icon: XCircle,     color: 'text-madder' },
  CHANGE_CANCELLED:        { label: 'Change cancelled',        Icon: XCircle,     color: 'text-mitti' },
  DOC_UPLOADED:            { label: 'Document uploaded',       Icon: FileText,    color: 'text-mitti' },
  DOC_UPLOADED_ON_BEHALF:  { label: 'Document uploaded by NEEJEE admin', Icon: FileText, color: 'text-mitti' },
  DOC_UPLOADED_AND_APPROVED_ON_BEHALF: { label: 'Document uploaded & approved by NEEJEE', Icon: ShieldCheck, color: 'text-green-700' },
  DOC_APPROVED:            { label: 'Document approved',       Icon: ShieldCheck, color: 'text-green-700' },
  DOC_REJECTED:            { label: 'Document rejected',       Icon: XCircle,     color: 'text-madder' },
  DOC_DELETED:             { label: 'Document deleted',        Icon: FileText,    color: 'text-mitti' },
  INVOICE_UPLOADED:        { label: 'Invoice uploaded',        Icon: FileText,    color: 'text-mitti' },
  TEAM_MEMBER_INVITED:     { label: 'Team member invited',     Icon: User,        color: 'text-mitti' },
  TEAM_MEMBER_UPDATED:     { label: 'Team member updated',     Icon: User,        color: 'text-mitti' },
  TEAM_MEMBER_REMOVED:     { label: 'Team member removed',     Icon: User,        color: 'text-madder' },
};

export default function VendorActivityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/vendor/activity?limit=100', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { logs: [] })
      .then(d => { setLogs(d.logs || []); setLoading(false); });
  }, []);

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>;

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-8 space-y-5">
      <header>
        <h1 className="font-display text-3xl text-kohl flex items-center gap-2">
          <Activity className="w-6 h-6 text-madder" /> Activity log
        </h1>
        <p className="text-sm text-mitti mt-1">A record of every meaningful action on your account. We keep this for security and audit.</p>
      </header>

      {logs.length === 0 ? (
        <div className="bg-ivory border border-mitti/15 p-8 text-center text-sm text-mitti italic">No activity yet.</div>
      ) : (
        <ol className="bg-ivory border border-mitti/15 divide-y divide-mitti/10">
          {logs.map(l => {
            const meta = ACTION_LABELS[l.action] || { label: l.action.replace(/_/g, ' ').toLowerCase(), Icon: Activity, color: 'text-mitti' };
            const Icon = meta.Icon;
            return (
              <li key={l.id} className="px-5 py-3 flex items-start gap-3">
                <Icon className={`w-4 h-4 ${meta.color} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-kohl">{meta.label}</p>
                  <p className="text-[11px] text-mitti">
                    {new Date(l.createdAt).toLocaleString()} · {l.actorRole === 'VENDOR' ? 'you' : l.actorRole === 'VENDOR_STAFF' ? 'team member' : `NEEJEE ${l.actorRole?.toLowerCase().replace('_', ' ') || 'system'}`}
                  </p>
                  {l.details && Object.keys(l.details).length > 0 && (
                    <details className="mt-1">
                      <summary className="text-[11px] text-mitti hover:text-madder cursor-pointer">Details</summary>
                      <pre className="text-[10px] text-mitti bg-beige p-2 mt-1 overflow-x-auto">{JSON.stringify(l.details, null, 2)}</pre>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
