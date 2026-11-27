import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canReadFinance, canAdminFinance } from '@/lib/finance/roles';
import { prisma } from '@/lib/prisma';
import { PayrollConfiguration } from './form';

export const dynamic = 'force-dynamic';
export default async function ConfigPage() {
  const actor = await getSession();
  if (!canReadFinance(actor)) notFound();
  const config = await prisma.payrollConfig.upsert({where:{id:'singleton'},create:{id:'singleton'},update:{}});
  return <section className="max-w-3xl space-y-5"><Link href="/admin/payroll">Back to payroll</Link>
    <h1 className="font-display text-3xl">Payroll configuration</h1>
    <PayrollConfiguration initial={config} editable={canAdminFinance(actor)} /></section>;
}
