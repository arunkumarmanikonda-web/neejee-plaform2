import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, requireRole } from '@/lib/auth';
import { inspectShop, keeperChecks } from '@/lib/keeper';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export default async function KeeperPage() {
  const user=await getSession();
  if (!requireRole(user,['ADMIN','SUPER_ADMIN'])) redirect('/login');
  const now=new Date();
  const counts=await inspectShop(prisma,now);
  const history=await prisma.financeAuditLog.findMany({where:{entityType:'StoreKeeper'},orderBy:{createdAt:'desc'},take:24,select:{id:true,createdAt:true,fullSnapshot:true}});
  return <main className="max-w-5xl p-6 space-y-6">
    <div><p className="font-ui text-madder">बही खाता · Shop operations</p><h1 className="font-display text-4xl">Bahi Khata</h1>
    <p className="mt-2">Review stock, photography, dispatch, returns, customer messages and invoice totals. Select a row to open the corresponding staff workspace.</p></div>
    <div className="divide-y border-y">{keeperChecks.map(c=><Link href={c.href} key={c.key} className="flex justify-between gap-4 py-4"><span>{c.name}</span><strong className={counts[c.key]?'text-madder':'text-kohl'}>{counts[c.key]}</strong></Link>)}</div>
    <h2 className="font-display text-2xl">Hourly audit history</h2>
    <p>The scheduled check records exceptions and releases overdue journal entries that an editor already scheduled. A staff member reviews stock, prices and ERP failures.</p>
    {!history.length && <p>No scheduled run has been recorded yet.</p>}
    <ul>{history.map(h=>{const s=h.fullSnapshot?JSON.parse(h.fullSnapshot):null;return <li key={h.id} className="border-b py-3"><strong>{h.createdAt.toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</strong>{s&&<span> · {Object.values(s.checks).reduce<number>((sum,n)=>sum+Number(n),0)} exceptions at check time · {s.repairs} publications recovered</span>}</li>;})}</ul>
  </main>;
}
