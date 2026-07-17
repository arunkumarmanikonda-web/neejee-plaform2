import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeString(v: any, fallback = '') {
  return typeof v === 'string' ? v : fallback;
}

function compact(values: Array<string | null | undefined>) {
  return values.map(v => String(v || '').trim()).filter(Boolean);
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'QC_TEAM', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const seller = await prisma.seller.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        email: true,
        phone: true,
        craft: true,
        region: true,
        pan: true,
        gstin: true,
        bankAccount: true,
        ifsc: true,
        bankName: true,
      },
    });

    if (!seller) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let commercialTerms: any = {
      commissionPct: 20,
      qualityScore: 0,
      payoutCycle: '',
      isNeejeeSelect: false,
      yearsOfPractice: null,
      cluster: null,
    };

    try {
      const terms = await prisma.seller.findUnique({
        where: { id: params.id },
        select: {
          commissionPct: true,
          qualityScore: true,
          payoutCycle: true,
          isNeejeeSelect: true,
          yearsOfPractice: true,
          cluster: true,
        },
      });

      if (terms) {
        commercialTerms = {
          commissionPct: typeof terms.commissionPct === 'number' ? terms.commissionPct : 20,
          qualityScore: typeof terms.qualityScore === 'number' ? terms.qualityScore : 0,
          payoutCycle: safeString(terms.payoutCycle),
          isNeejeeSelect: !!terms.isNeejeeSelect,
          yearsOfPractice: terms.yearsOfPractice ?? null,
          cluster: terms.cluster ?? null,
        };
      }
    } catch {
      // fallback defaults for schema-drift safety
    }

    let entity: any = null;
    try {
      entity = await prisma.legalEntity.findUnique({
        where: { key: 'default' },
      });
    } catch {
      entity = null;
    }

    let documents: any[] = [];
    try {
      documents = await prisma.sellerDocument.findMany({
        where: { sellerId: params.id },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      documents = [];
    }

    const agreementDoc = documents.find((d: any) => {
      const kind = String(d?.docType ?? d?.type ?? '').trim().toUpperCase();
      return kind === 'SELLER_AGREEMENT';
    });

    const companyAddress = compact([
      entity?.addressLine1,
      entity?.addressLine2,
      entity?.city,
      entity?.state,
      entity?.pincode,
      entity?.country,
    ]).join(', ');

    const company = {
      legalName: safeString(entity?.legalName, 'Oye Imagine Private Limited'),
      brandName: safeString(entity?.brandName, 'NEEJEE'),
      gstin: safeString(entity?.gstin),
      pan: safeString(entity?.pan),
      cinNumber: safeString(entity?.cinNumber),
      msmeNumber: safeString(entity?.msmeNumber),
      address: companyAddress,
      contactEmail: safeString(entity?.contactEmail),
      contactPhone: safeString(entity?.contactPhone),
      authorisedSignatory: safeString(entity?.authorisedSignatory, 'Authorised Signatory'),
      signatoryTitle: safeString(entity?.signatoryTitle, 'Authorised Signatory'),
      signatureUrl: safeString(entity?.signatureUrl),
      logoUrl: safeString(entity?.logoUrl),
    };

    const clauses = [
      {
        title: 'Appointment',
        text: `${company.legalName} appoints ${seller.businessName} as a marketplace seller for products approved for the NEEJEE platform.`,
      },
      {
        title: 'Commercial terms',
        text: `Commission is ${commercialTerms.commissionPct}% unless separately revised in writing. Current payout cycle: ${commercialTerms.payoutCycle || 'to be finalised'}. Neejee Select status: ${commercialTerms.isNeejeeSelect ? 'enabled' : 'not enabled'}.`,
      },
      {
        title: 'KYC and compliance',
        text: 'Seller must maintain valid identity, tax, banking, and business-supporting documents, and promptly update any expired or changed records.',
      },
      {
        title: 'Payments',
        text: 'Payouts are processed subject to returns, cancellations, recoveries, taxes, platform deductions, and reconciliation rules applicable under platform policy.',
      },
      {
        title: 'Product and content responsibility',
        text: 'Seller warrants that product descriptions, images, inventory, quality, authenticity, IP rights, and fulfilment commitments are accurate and compliant.',
      },
      {
        title: 'Term and termination',
        text: 'The agreement continues until terminated by either party or suspended/ended for compliance, performance, fraud, policy, or legal reasons.',
      },
    ];

    return NextResponse.json({
      agreement: {
        generatedAt: new Date().toISOString(),
        title: 'Standard Seller Agreement',
        subtitle: 'Standard company agreement with seller-specific commercial terms',
        company,
        seller: {
          id: seller.id,
          businessName: seller.businessName,
          contactName: seller.contactName,
          email: seller.email,
          phone: seller.phone,
          craft: seller.craft,
          region: seller.region,
          pan: seller.pan,
          gstin: seller.gstin,
          bankAccount: seller.bankAccount,
          ifsc: seller.ifsc,
          bankName: seller.bankName,
        },
        commercialTerms,
        clauses,
        existingAgreementDocument: agreementDoc
          ? {
              id: agreementDoc.id,
              docType: agreementDoc.docType ?? agreementDoc.type ?? 'SELLER_AGREEMENT',
              title: agreementDoc.title ?? agreementDoc.name ?? agreementDoc.fileName ?? 'Seller Agreement',
              fileName: agreementDoc.fileName ?? agreementDoc.name ?? null,
              fileUrl: agreementDoc.fileUrl ?? agreementDoc.url ?? null,
              status: agreementDoc.status ?? 'SUBMITTED',
              createdAt: agreementDoc.createdAt ?? null,
            }
          : null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to load agreement preview' },
      { status: 500 }
    );
  }
}