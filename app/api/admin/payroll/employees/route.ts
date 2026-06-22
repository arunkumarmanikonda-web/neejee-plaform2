// v23.40 — Employees CRUD
// GET  /api/admin/payroll/employees           — list
// POST /api/admin/payroll/employees           — create

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;
  const department = url.searchParams.get('department') || undefined;

  const where: any = {};
  if (status) where.status = status as any;
  if (department) where.department = department;

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ status: 'asc' }, { employeeCode: 'asc' }],
    include: {
      salaryAssignments: {
        where: { OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        include: { structure: { select: { id: true, name: true, monthlyCtcPaise: true } } },
      },
    },
  });
  return NextResponse.json({ employees });
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const {
      employeeCode, firstName, lastName, email, phone, pan, aadhaarLast4, dob,
      designation, department, joiningDate, employmentType, status,
      bankAccountName, bankAccountNumber, bankIfsc, uanNumber, esicNumber,
      taxRegime, address, emergencyContact, notes,
      // v23.40.1 — personal file
      documents, photoUrl, noticePeriodDays,
    } = body;
    const docs: string[] = Array.isArray(documents) ? documents.filter(Boolean) : [];

    if (!firstName || !joiningDate) {
      return NextResponse.json({
        error: 'firstName and joiningDate are required',
      }, { status: 400 });
    }

    // v23.40.3 — Auto-allot employee code if not provided.
    // Pattern: EMP-YYMM-NNN where YY = 2-digit year of joining, MM = month of joining,
    // and NNN is the next sequence within that YYMM.
    // Backwards-compatible: also scans legacy EMP### codes when looking for max.
    let finalCode = employeeCode ? String(employeeCode).trim().toUpperCase() : '';
    if (!finalCode) {
      const dojDate = new Date(joiningDate);
      const yy = String(dojDate.getFullYear()).slice(-2);
      const mm = String(dojDate.getMonth() + 1).padStart(2, '0');
      const prefix = `EMP-${yy}${mm}-`;

      // Find max sequence for this YYMM
      const sameMonth = await prisma.employee.findMany({
        where: { employeeCode: { startsWith: prefix } },
        select: { employeeCode: true },
      });
      let maxNum = 0;
      for (const row of sameMonth) {
        const m = row.employeeCode.match(/^EMP-\d{4}-(\d+)$/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      }
      finalCode = `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    }

    const created = await prisma.employee.create({
      data: {
        id: 'emp_' + randomBytes(10).toString('hex'),
        employeeCode: finalCode,
        firstName: String(firstName).trim(),
        lastName: lastName?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        phone: phone?.trim() || null,
        pan: pan?.trim().toUpperCase() || null,
        aadhaarLast4: aadhaarLast4?.trim().slice(-4) || null,
        dob: dob ? new Date(dob) : null,
        designation: designation?.trim() || null,
        department: department?.trim() || null,
        joiningDate: new Date(joiningDate),
        employmentType: employmentType || 'FULL_TIME',
        status: status || 'ACTIVE',
        bankAccountName: bankAccountName?.trim() || null,
        bankAccountNumber: bankAccountNumber?.trim() || null,
        bankIfsc: bankIfsc?.trim().toUpperCase() || null,
        uanNumber: uanNumber?.trim() || null,
        esicNumber: esicNumber?.trim() || null,
        taxRegime: taxRegime || 'NEW',
        address: address?.trim() || null,
        emergencyContact: emergencyContact?.trim() || null,
        notes: notes?.trim() || null,
        // v23.40.1 — personal file
        documents: docs,
        photoUrl: photoUrl || null,
        noticePeriodDays: noticePeriodDays || 30,
        createdByUserId: session!.id,
      },
    });

    await recordAudit({
      action: 'CREATE',
      entityType: 'Employee',
      entityId: created.id,
      after: created,
      session,
      req,
    });

    return NextResponse.json({ employee: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create employee' }, { status: 500 });
  }
}
