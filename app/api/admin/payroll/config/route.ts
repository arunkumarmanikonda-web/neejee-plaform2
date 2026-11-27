// v23.40 — Payroll configuration (singleton)
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const config = await prisma.payrollConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', updatedAt: new Date() },
  });
  return NextResponse.json({ config });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const before = await prisma.payrollConfig.findUnique({ where: { id: 'singleton' } });
  const rate = z.number().min(0).max(100);
  const money = z.number().int().min(0).max(2147483647);
  const slab = z.object({minPaise:money,maxPaise:money,taxPaise:money}).refine(v=>v.maxPaise>=v.minPaise);
  const slabs = z.string().max(20000).refine(value=>{
    try {return z.array(slab).safeParse(JSON.parse(value)).success;} catch {return false;}
  });
  const schema = z.object({
    pfEnabled:z.boolean(),esiEnabled:z.boolean(),ptEnabled:z.boolean(),tdsEnabled:z.boolean(),
    pfEmployeeRate:rate,pfEmployerRate:rate,esiEmployeeRate:rate,esiEmployerRate:rate,tdsDefaultRate:rate,
    pfWageCeilingPaise:money,esiGrossCeilingPaise:money,ptSlabsJson:slabs,
    payCycleDay:z.number().int().min(1).max(31),workingDaysPerMonth:z.number().int().min(1).max(31),
    notes:z.string().max(8000).nullable(),
  }).partial();
  const input=schema.safeParse(await req.json().catch(()=>null));
  if (!input.success) return NextResponse.json({error:'Check the payroll rates, dates and professional tax slabs.'},{status:400});
  const data=input.data;

  const updated = await prisma.payrollConfig.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data, updatedAt: new Date() },
  });
  await recordAudit({
    action: 'UPDATE', entityType: 'PayrollConfig', entityId: 'singleton',
    before, after: updated, session, req,
  });
  return NextResponse.json({ config: updated });
}
