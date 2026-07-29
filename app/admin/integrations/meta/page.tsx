'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, RefreshCcw, ShieldCheck, Unlink } from 'lucide-react';

type MetaPageRow = {
  id: string;
  pageId: string;
  pageName: string;
  category: string | null;
  tasks: string[];
  canPost: boolean;
  canRead: boolean;
  isPrimary: boolean;
  linkedInstagramId: string | null;
};

type InstagramRow = {
  id: string;
  instagramBusinessId: string;
  username: string | null;
  name: string | null;
  linkedPageId: string | null;
  isPublishReady: boolean;
  canCommentModerate: boolean;
  canPublish: boolean;
  followersCount: number | null;
  mediaCount: number | null;
};

type SocialConnection = {
  id: string;
  provider: string;
  displayName: string | null;
  metaUserName: string | null;
  metaUserEmail: string | null;
  status: string;
  scopes: string[];
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdByUser: {
    email: string | null;
    name: string | null;
    role: string;
  };
  pages: MetaPageRow[];
  instagramAccounts: InstagramRow[];
};

type Readiness = {
  facebookConnected: boolean;
  instagramConnected: boolean;
  pagesTotal: number;
  instagramTotal: number;
  facebookPostReady: boolean;
  instagramPublishReady: boolean;
  instagramCommentReady: boolean;
  warnings: string[];
};

function Card({ title, value, tone, helper }: { title: string; value: string; tone: 'good' | 'warn'; helper: string }) {
  return (
    <div className={`rounded-xl border p-5 ${tone === 'good' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <p className="label text-madder">{title}</p>
      <p className="font-display text-kohl text-2xl mt-2">{value}</p>
      <p className="font-ui text-xs text-mitti mt-2">{helper}</p>
    </div>
  );
}

function Flag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
      {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      <span>{label}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-mitti/15 bg-white px-4 py-3">
      <p className="label text-madder">{label}</p>
      <p className="font-ui text-sm text-kohl mt-2">{value}</p>
    </div>
  );
}

export default function AdminMetaIntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [statusRes, readinessRes] = await Promise.all([
        fetch('/api/admin/integrations/meta/status', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/integrations/meta/publish-readiness', { credentials: 'include', cache: 'no-store' }),
      ]);

      const statusJson = await statusRes.json().catch(() => ({}));
      const readinessJson = await readinessRes.json().catch(() => ({}));

      if (!statusRes.ok) throw new Error(statusJson?.error || 'Failed to load Meta connections');

      setConnections(statusJson.connections || []);
      setReadiness(readinessJson.summary || null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Meta integration status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      setNotice('Meta connection updated successfully.');
    }
    if (params.get('error')) {
      setError(params.get('error') || 'Meta integration error');
    }
    void load();
  }, []);

  const allPages = useMemo(() => connections.flatMap((item) => item.pages), [connections]);
  const allInstagram = useMemo(() => connections.flatMap((item) => item.instagramAccounts), [connections]);

  const disconnect = async (connectionId: string) => {
    setDisconnecting(connectionId);
    setError('');
    try {
      const res = await fetch('/api/admin/integrations/meta/disconnect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to disconnect');
      setNotice('Connection disconnected.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Disconnect failed');
    } finally {
      setDisconnecting(null);
    }
  };

  const startConnect = (kind: 'facebook' | 'instagram') => {
    window.location.href = `/api/admin/integrations/meta/connect/start?kind=${kind}`;
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="label text-madder">META-001 Â· ACCOUNT CENTER</p>
        <h1 className="font-display text-4xl text-kohl mt-2">Meta account center</h1>
        <p className="font-ui text-sm text-mitti mt-3 max-w-4xl leading-7">
          Connect Facebook business access and linked Instagram professional accounts so marketing surfaces can use one managed control plane for account health, publish readiness, and future content operations.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => startConnect('facebook')}
          className="px-4 py-3 rounded-xl bg-kohl text-white text-sm flex items-center gap-2"
        >
          <Link2 className="w-4 h-4" /> CONNECT FACEBOOK BUSINESS
        </button>
        <button
          type="button"
          onClick={() => startConnect('instagram')}
          className="px-4 py-3 rounded-xl border border-mitti/20 bg-white text-kohl text-sm flex items-center gap-2"
        >
          <Link2 className="w-4 h-4" /> CONNECT INSTAGRAM FALLBACK
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="px-4 py-3 rounded-xl border border-mitti/20 bg-white text-kohl text-sm flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" /> REFRESH STATUS
        </button>
        <Link href="/admin/marketing-studio" className="px-4 py-3 rounded-xl border border-mitti/20 bg-beige text-kohl text-sm">
          OPEN MARKETING STUDIO
        </Link>
        <Link href="/admin/seo" className="px-4 py-3 rounded-xl border border-mitti/20 bg-beige text-kohl text-sm">
          OPEN SEO
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      ) : null}

      <div className="grid lg:grid-cols-4 gap-4">
        <Card title="Facebook" value={readiness?.facebookConnected ? 'Connected' : 'Not linked'} tone={readiness?.facebookConnected ? 'good' : 'warn'} helper="Primary business connection" />
        <Card title="Instagram" value={readiness?.instagramConnected ? 'Connected' : 'Not linked'} tone={readiness?.instagramConnected ? 'good' : 'warn'} helper="Professional account linkage" />
        <Card title="Pages" value={String(readiness?.pagesTotal || 0)} tone={(readiness?.pagesTotal || 0) > 0 ? 'good' : 'warn'} helper="Discovered Facebook Pages" />
        <Card title="Publish readiness" value={readiness?.facebookPostReady || readiness?.instagramPublishReady ? 'Ready' : 'Not ready'} tone={readiness?.facebookPostReady || readiness?.instagramPublishReady ? 'good' : 'warn'} helper="Posting scaffolding status" />
      </div>

      {readiness ? (
        <section className="bg-white border border-mitti/15 rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-madder" />
            <p className="label text-madder">PUBLISH READINESS</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <Flag label="Facebook Pages discovered" ok={readiness.pagesTotal > 0} />
            <Flag label="Instagram professional discovered" ok={readiness.instagramTotal > 0} />
            <Flag label="Facebook posting scope ready" ok={readiness.facebookPostReady} />
            <Flag label="Instagram publish scope ready" ok={readiness.instagramPublishReady} />
            <Flag label="Instagram comment scope ready" ok={readiness.instagramCommentReady} />
          </div>

          {readiness.warnings?.length ? (
            <div className="mt-5 space-y-2">
              {readiness.warnings.map((warning) => (
                <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="bg-white border border-mitti/15 rounded-2xl p-6">
        <p className="label text-madder">CONNECTED ACCOUNTS</p>
        {loading ? (
          <p className="text-sm text-mitti mt-4">Loading connectionsâ€¦</p>
        ) : connections.length === 0 ? (
          <p className="text-sm text-mitti mt-4">No Meta accounts linked yet.</p>
        ) : (
          <div className="grid xl:grid-cols-2 gap-5 mt-4">
            {connections.map((connection) => (
              <div key={connection.id} className="rounded-2xl border border-mitti/15 bg-beige/40 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="label text-madder">{connection.provider}</p>
                    <p className="font-display text-kohl text-2xl mt-2">
                      {connection.displayName || connection.metaUserName || 'Unnamed connection'}
                    </p>
                    <p className="font-ui text-sm text-mitti mt-2">
                      {connection.metaUserEmail || 'No email returned'}
                    </p>
                    <p className="font-mono text-[11px] text-mitti/80 mt-3">
                      Linked by {connection.createdByUser?.name || connection.createdByUser?.email || 'admin'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void disconnect(connection.id)}
                    disabled={disconnecting === connection.id}
                    className="px-3 py-2 rounded-lg border border-mitti/20 bg-white text-kohl text-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    <Unlink className="w-3.5 h-3.5" /> {disconnecting === connection.id ? 'Disconnectingâ€¦' : 'Disconnect'}
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mt-5">
                  <MiniStat label="Status" value={connection.status} />
                  <MiniStat label="Pages" value={String(connection.pages.length)} />
                  <MiniStat label="Instagram accounts" value={String(connection.instagramAccounts.length)} />
                  <MiniStat label="Scopes" value={String(connection.scopes.length)} />
                </div>

                {connection.scopes?.length ? (
                  <div className="flex flex-wrap gap-2 mt-5">
                    {connection.scopes.map((scope) => (
                      <span key={scope} className="px-2 py-1 rounded-full border border-mitti/15 bg-white text-[10px] text-mitti">
                        {scope}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-mitti/15 rounded-2xl p-6">
        <p className="label text-madder">FACEBOOK PAGES</p>
        {allPages.length === 0 ? (
          <p className="text-sm text-mitti mt-4">No Pages discovered yet.</p>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="border-b border-mitti/15">
                <tr className="text-left">
                  <th className="py-3 pr-4">Page</th>
                  <th className="py-3 pr-4">Category</th>
                  <th className="py-3 pr-4">Tasks</th>
                  <th className="py-3 pr-4">Primary</th>
                  <th className="py-3 pr-4">Linked IG</th>
                </tr>
              </thead>
              <tbody>
                {allPages.map((page) => (
                  <tr key={page.id} className="border-b border-mitti/10">
                    <td className="py-3 pr-4 text-kohl">{page.pageName}</td>
                    <td className="py-3 pr-4 text-mitti">{page.category || 'â€”'}</td>
                    <td className="py-3 pr-4 text-mitti">{page.tasks?.join(', ') || 'â€”'}</td>
                    <td className="py-3 pr-4 text-mitti">{page.isPrimary ? 'Yes' : 'No'}</td>
                    <td className="py-3 pr-4 text-mitti">{page.linkedInstagramId || 'â€”'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white border border-mitti/15 rounded-2xl p-6">
        <p className="label text-madder">INSTAGRAM PROFESSIONAL ACCOUNTS</p>
        {allInstagram.length === 0 ? (
          <p className="text-sm text-mitti mt-4">No Instagram professional accounts discovered yet.</p>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="border-b border-mitti/15">
                <tr className="text-left">
                  <th className="py-3 pr-4">Username</th>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Linked Page</th>
                  <th className="py-3 pr-4">Publish</th>
                  <th className="py-3 pr-4">Comments</th>
                </tr>
              </thead>
              <tbody>
                {allInstagram.map((account) => (
                  <tr key={account.id} className="border-b border-mitti/10">
                    <td className="py-3 pr-4 text-kohl">{account.username || 'â€”'}</td>
                    <td className="py-3 pr-4 text-mitti">{account.name || 'â€”'}</td>
                    <td className="py-3 pr-4 text-mitti">{account.linkedPageId || 'â€”'}</td>
                    <td className="py-3 pr-4 text-mitti">{account.canPublish ? 'Ready' : 'Not ready'}</td>
                    <td className="py-3 pr-4 text-mitti">{account.canCommentModerate ? 'Ready' : 'Not ready'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}