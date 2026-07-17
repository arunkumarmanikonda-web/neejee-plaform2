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

function digitsOnly(v: any) {
  return String(v || '').replace(/\D/g, '');
}

function last4(v: any) {
  const d = digitsOnly(v);
  return d ? d.slice(-4) : '';
}

function maskBankAccount(v: any) {
  const tail = last4(v);
  return tail ? `XXXX${tail}` : '';
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
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
        story: true,
      },
    });

    if (!seller) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let commercialTerms: any = {
      commissionPct: 20,
      qualityScore: 0,
      payoutCycle: 'MONTHLY',
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
          payoutCycle: safeString(terms.payoutCycle, 'MONTHLY'),
          isNeejeeSelect: !!terms.isNeejeeSelect,
          yearsOfPractice: terms.yearsOfPractice ?? null,
          cluster: terms.cluster ?? null,
        };
      }
    } catch {
      // schema drift safe fallback
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
      authorisedSignatory: safeString(entity?.authorisedSignatory, 'Nidhi'),
      signatoryTitle: safeString(entity?.signatoryTitle, 'Authorised Signatory'),
      signatureUrl: safeString(entity?.signatureUrl),
      logoUrl: safeString(entity?.logoUrl),
    };

    const sellerBlock = {
      id: seller.id,
      businessName: safeString(seller.businessName),
      contactName: safeString(seller.contactName),
      email: safeString(seller.email),
      phone: safeString(seller.phone),
      craft: safeString(seller.craft),
      region: safeString(seller.region),
      pan: safeString(seller.pan),
      gstin: safeString(seller.gstin),
      bankAccountMasked: maskBankAccount(seller.bankAccount),
      ifsc: safeString(seller.ifsc),
      bankName: safeString(seller.bankName),
      story: safeString(seller.story),
    };

    const clauses = [
      {
        no: '1',
        title: 'Parties and Appointment',
        text: `${company.legalName} appoints ${sellerBlock.businessName || 'the Seller'} as a non-exclusive marketplace seller for approved products on the NEEJEE platform, subject to platform policy, KYC validation, and operational compliance.`,
      },
      {
        no: '2',
        title: 'Seller Representations',
        text: 'The Seller confirms that all onboarding information, KYC records, tax identifiers, banking details, business claims, catalogue content, and supporting documents are true, complete, and kept updated at all times.',
      },
      {
        no: '3',
        title: 'Product, Quality, and Authenticity',
        text: 'The Seller is solely responsible for authenticity, lawful sourcing, craftsmanship quality, pricing accuracy, inventory accuracy, product safety, packaging standards, and compliance with all applicable laws and marketplace rules.',
      },
      {
        no: '4',
        title: 'Commercial Terms',
        text: `Marketplace commission is ${commercialTerms.commissionPct}% unless separately revised in writing. Payout cycle is ${safeString(commercialTerms.payoutCycle, 'MONTHLY')}. Neejee Select status is ${commercialTerms.isNeejeeSelect ? 'enabled' : 'not enabled'}.`,
      },
      {
        no: '5',
        title: 'Payments, Adjustments, and Recoveries',
        text: 'Payouts remain subject to returns, cancellations, disputes, promotional support, penalties, taxes, TDS/TCS, shipping deductions, reconciliations, chargebacks, fraud reviews, and any other lawful deductions applicable under company policy.',
      },
      {
        no: '6',
        title: 'Tax and Regulatory Compliance',
        text: 'The Seller is responsible for maintaining valid PAN, GST, banking, and statutory business documentation. The Seller must immediately notify the company of any suspension, expiry, inaccuracy, notice, or legal proceeding affecting its eligibility.',
      },
      {
        no: '7',
        title: 'Order Fulfilment and Customer Experience',
        text: 'The Seller must fulfil orders within the committed timelines, maintain service quality, support returns and replacements as applicable, and cooperate in customer service, investigations, and dispute resolution.',
      },
      {
        no: '8',
        title: 'Intellectual Property and Content Usage',
        text: 'The Seller grants the company the right to use product names, photographs, descriptions, trademarks, and brand assets solely for catalogue display, marketing, merchandising, customer support, and marketplace operations.',
      },
      {
        no: '9',
        title: 'Confidentiality and Data Handling',
        text: 'Both parties shall keep non-public commercial, financial, customer, policy, and operational information confidential except where disclosure is required by law, regulatory process, or legitimate marketplace operations.',
      },
      {
        no: '10',
        title: 'Suspension and Termination',
        text: 'The company may suspend listings, payouts, or the seller account for policy breaches, fraud risk, customer harm, KYC issues, legal exposure, repeated quality failures, or non-cooperation. Either party may terminate the relationship subject to pending obligations.',
      },
      {
        no: '11',
        title: 'Indemnity and Liability',
        text: 'The Seller shall indemnify the company against losses, claims, penalties, customer complaints, IP disputes, or regulatory action arising from the Seller’s products, content, fulfilment, non-compliance, or breach of this agreement.',
      },
      {
        no: '12',
        title: 'Governing Law and Jurisdiction',
        text: 'This agreement shall be governed by the laws of India. Courts having jurisdiction over the company’s registered office shall have exclusive jurisdiction, subject to any mandatory legal forum that cannot be contractually excluded.',
      },
    ];

    const annexure = [
      { label: 'Seller legal name / business name', value: sellerBlock.businessName || '—' },
      { label: 'Primary contact', value: sellerBlock.contactName || '—' },
      { label: 'Email', value: sellerBlock.email || '—' },
      { label: 'Phone', value: sellerBlock.phone || '—' },
      { label: 'Craft / category', value: compact([sellerBlock.craft, sellerBlock.region]).join(' • ') || '—' },
      { label: 'Commission %', value: `${commercialTerms.commissionPct ?? 20}%` },
      { label: 'Payout cycle', value: safeString(commercialTerms.payoutCycle, 'MONTHLY') || '—' },
      { label: 'Neejee Select', value: commercialTerms.isNeejeeSelect ? 'Yes' : 'No' },
      { label: 'Quality score', value: String(commercialTerms.qualityScore ?? 0) },
      { label: 'Years of practice', value: commercialTerms.yearsOfPractice != null ? String(commercialTerms.yearsOfPractice) : '—' },
      { label: 'Cluster', value: commercialTerms.cluster || '—' },
      { label: 'PAN', value: sellerBlock.pan || '—' },
      { label: 'GSTIN', value: sellerBlock.gstin || '—' },
      { label: 'Bank', value: compact([sellerBlock.bankName, sellerBlock.ifsc, sellerBlock.bankAccountMasked]).join(' • ') || '—' },
    ];

    return NextResponse.json({
      agreement: {
        generatedAt: new Date().toISOString(),
        templateVersion: 'phase-2a-v1',
        title: 'Marketplace Seller Agreement',
        subtitle: 'Standard company agreement with seller-specific commercial terms',
        printablePath: `/admin/sellers/${seller.id}/agreement`,
        company,
        seller: sellerBlock,
        commercialTerms,
        clauses,
        annexure,
        execution: {
          companySignatoryName: company.authorisedSignatory || 'Authorised Signatory',
          companySignatoryTitle: company.signatoryTitle || 'Authorised Signatory',
          companySignatureUrl: company.signatureUrl || '',
          sellerSignatureRequired: true,
          placeOfExecution: companyAddress || 'India',
        },
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