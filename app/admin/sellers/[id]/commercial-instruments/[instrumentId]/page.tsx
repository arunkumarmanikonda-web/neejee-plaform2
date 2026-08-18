import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession, requireRole } from '@/lib/auth';
import { getInstrument, listCommercialInstruments } from '@/lib/seller-commercial-lifecycle';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function dateLabel(value?: Date | string | null) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function CommercialInstrumentRecordPage({
  params,
}: {
  params: { id: string; instrumentId: string };
}) {
  const user = await getSession();
  if (!user) redirect(`/login?next=/admin/sellers/${params.id}/commercial-instruments/${params.instrumentId}`);
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) redirect('/admin');

  const [instrument, seller, history] = await Promise.all([
    getInstrument(params.instrumentId),
    prisma.seller.findUnique({
      where: { id: params.id },
      select: { id: true, businessName: true, contactName: true, email: true, phone: true },
    }),
    listCommercialInstruments(params.id),
  ]);

  if (!instrument || instrument.sellerRef !== params.id) notFound();

  const snapshot = instrument.documentSnapshot && typeof instrument.documentSnapshot === 'object'
    ? instrument.documentSnapshot
    : {};
  const prior = [...history]
    .filter(item => item.sequence < instrument.sequence)
    .sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <Link href={`/admin/sellers/${params.id}`} className="text-xs tracking-wider text-mitti hover:text-kohl">
          ← SELLER RELATIONSHIP
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/admin/sellers/${params.id}/agreement-workbench`} className="px-3 py-2 bg-kohl text-ivory text-xs tracking-wider">
            AGREEMENT WORKBENCH
          </Link>
          <span className="px-3 py-2 border border-mitti/20 text-xs tracking-wider text-mitti">PRINT / SAVE PDF: CTRL+P</span>
        </div>
      </div>

      <article className="mt-5 bg-white border border-mitti/20 p-7 sm:p-10 print:border-0 print:p-0">
        <header className="border-b border-banarasi/30 pb-7">
          <p className="label text-madder">NEEJEE SELLER RELATIONSHIP — PERMANENT LEGAL RECORD</p>
          <h1 className="font-display text-4xl text-kohl mt-3">{instrument.title}</h1>
          <p className="text-sm text-mitti mt-2">{instrument.instrumentNumber}</p>
          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card label="STATUS" value={String(instrument.status).replace(/_/g, ' ')} />
            <Card label="VALID FROM" value={dateLabel(instrument.effectiveFrom)} />
            <Card label="VALID UNTIL" value={instrument.effectiveTo ? dateLabel(instrument.effectiveTo) : 'Until effective termination'} />
            <Card label="RELATIONSHIP SEQUENCE" value={`#${instrument.sequence}`} />
          </div>
        </header>

        <section className="mt-8 grid md:grid-cols-2 gap-5">
          <div className="bg-beige p-5">
            <p className="label text-madder">SELLER</p>
            <p className="font-display text-xl text-kohl mt-2">{seller?.businessName || snapshot?.seller?.businessName || 'Seller'}</p>
            <p className="text-sm text-mitti mt-2">{seller?.contactName || snapshot?.seller?.contactName || '—'}</p>
            <p className="text-xs text-mitti">{seller?.email || snapshot?.seller?.email || '—'}</p>
            <p className="text-xs text-mitti">{seller?.phone || snapshot?.seller?.phone || '—'}</p>
          </div>
          <div className="bg-beige p-5">
            <p className="label text-madder">COMMERCIAL TERMS SNAPSHOT</p>
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Commission" value={`${instrument.commissionPct ?? '—'}%`} />
              <Row label="Payout cycle" value={instrument.payoutCycle || '—'} />
              <Row label="NEEJEE Select" value={instrument.isNeejeeSelect ? 'Yes' : 'No'} />
              <Row label="Quality score" value={instrument.qualityScore ?? '—'} />
            </div>
          </div>
        </section>

        {instrument.changeReason ? (
          <section className="mt-6 border border-mitti/15 p-5">
            <p className="label text-madder">CHANGE / TERMINATION CONTEXT</p>
            <p className="mt-2 text-sm leading-relaxed text-kohl whitespace-pre-wrap">{instrument.changeReason}</p>
          </section>
        ) : null}

        <section className="mt-8">
          <p className="label text-madder">CONTRACTUAL LINEAGE & ANNEXED HISTORY</p>
          <p className="mt-2 text-xs leading-relaxed text-mitti">
            This record never replaces earlier instruments. The contractual chain below is retained as the relationship lineage referenced by this instrument.
          </p>

          {prior.length ? (
            <div className="mt-4 overflow-x-auto border border-mitti/15">
              <table className="min-w-[780px] w-full text-xs">
                <thead className="bg-beige text-mitti">
                  <tr>
                    <th className="p-3 text-left font-normal">SEQ.</th>
                    <th className="p-3 text-left font-normal">TYPE / REFERENCE</th>
                    <th className="p-3 text-left font-normal">VALIDITY</th>
                    <th className="p-3 text-left font-normal">STATUS</th>
                    <th className="p-3 text-left font-normal print:hidden">RECORD</th>
                  </tr>
                </thead>
                <tbody>
                  {prior.map(item => (
                    <tr key={item.id} className="border-t border-mitti/10">
                      <td className="p-3">{item.sequence}</td>
                      <td className="p-3">
                        <div className="text-kohl">{item.title}</div>
                        <div className="text-mitti mt-1">{item.instrumentNumber}</div>
                      </td>
                      <td className="p-3 text-mitti">{dateLabel(item.effectiveFrom)} to {dateLabel(item.effectiveTo)}</td>
                      <td className="p-3 text-mitti">{String(item.status).replace(/_/g, ' ')}</td>
                      <td className="p-3 print:hidden">
                        <Link href={`/admin/sellers/${params.id}/commercial-instruments/${item.id}`} className="text-madder">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 border border-dashed border-mitti/25 p-4 text-xs text-mitti">This is the first instrument in the relationship.</div>
          )}
        </section>

        <section className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <Card label="CREATED" value={dateLabel(instrument.createdAt)} />
          <Card label="ISSUED" value={dateLabel(instrument.issuedAt)} />
          <Card label="SELLER SIGNED" value={dateLabel(instrument.sellerSignedAt)} />
          <Card label="NEEJEE SIGNED / CLOSED" value={dateLabel(instrument.closedAt || instrument.companySignedAt)} />
        </section>

        <footer className="mt-10 border-t border-mitti/15 pt-5 text-[10px] tracking-wide text-mitti">
          Permanent NEEJEE commercial relationship record • Seller reference {params.id} • Instrument {instrument.instrumentNumber}
        </footer>
      </article>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-beige/60 border border-mitti/10 p-3">
      <p className="label text-mitti">{label}</p>
      <p className="mt-1 text-sm text-kohl break-words">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-mitti/10 pb-2 last:border-0">
      <span className="text-mitti">{label}</span>
      <span className="text-kohl text-right">{String(value)}</span>
    </div>
  );
}
