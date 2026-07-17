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
    id: "1",
    title: "1. Drafting, AI-Assisted Edits, Admin Review and Finalisation Control",
    heading: "1. Drafting, AI-Assisted Edits, Admin Review and Finalisation Control",
    paragraphs: [
      "This Agreement is generated as a controlled contractual draft for review by Oye Imagine Private Limited. Until the Agreement is expressly finalised by an authorised admin of Oye Imagine, every clause, paragraph, schedule, annexure, recital, commercial term, policy reference, compliance representation, and operational term may be edited, revised, expanded, condensed, reformatted, renumbered, redrafted, or regenerated only by authorised admins of Oye Imagine, whether manually or with the assistance of artificial intelligence tools used under admin supervision.",
      "The Seller acknowledges and agrees that it has no unilateral right to edit, approve, freeze, lock, finalise, or override the legal text of this Agreement. Any comments, requests, or negotiated changes proposed by the Seller shall have effect only if reviewed and incorporated by an authorised admin of Oye Imagine before finalisation.",
      "Once this Agreement is marked or treated by Oye Imagine as finalised, approved, executed, accepted, or otherwise locked for operational use, the legal text shall be treated as frozen and may thereafter be amended only by a written amendment, updated final version, or admin-approved regenerated agreement issued or accepted by an authorised admin of Oye Imagine."
    ]
  },
  {
    id: "2",
    title: "2. Appointment and Nature of Marketplace Relationship",
    heading: "2. Appointment and Nature of Marketplace Relationship",
    paragraphs: [
      "The Seller appoints Oye Imagine Private Limited and Oye Imagine accepts such appointment, on a non-exclusive, revocable, and conditional basis, to list, display, promote, facilitate the sale of, collect consideration for, and provide marketplace-related services in respect of the Seller's products through Oye Imagine's digital properties, campaigns, and associated channels, subject always to this Agreement, platform policies, and applicable law.",
      "Unless expressly agreed otherwise in writing for a specific transaction or business model, Oye Imagine acts as a marketplace or facilitating platform and not as the manufacturer, principal seller, or warrantor of the Seller's products. Responsibility for product quality, merchantability, conformity with listing claims, safety, packaging adequacy, statutory declarations, genuineness, and post-sale liabilities shall remain with the Seller.",
      "Nothing in this Agreement shall prevent Oye Imagine from onboarding competing sellers, reordering visibility, changing merchandising strategy, prioritising categories, restricting campaigns, or introducing new commercial, quality, or operational standards from time to time."
    ]
  },
  {
    id: "3",
    title: "3. Seller Representations, Authority, KYC and Statutory Compliance",
    heading: "3. Seller Representations, Authority, KYC and Statutory Compliance",
    paragraphs: [
      "The Seller represents and warrants that it is duly organised, validly existing, and legally competent to enter into this Agreement; that the signatory has full authority to bind the Seller; and that all KYC, registration, ownership, address, tax, bank, and contact information supplied to Oye Imagine is true, complete, current, and not misleading in any respect.",
      "The Seller shall maintain at all times all registrations, approvals, declarations, licences, permits, and tax credentials necessary for the lawful manufacture, storage, advertisement, listing, offer for sale, and sale of its products, including GST registration where applicable, PAN, bank validation details, and all category-specific approvals required by Indian law.",
      "Any false declaration, concealment of material information, expired registration, mismatch in tax or bank identity, or refusal to furnish compliance documents upon request shall constitute a material breach and shall entitle Oye Imagine to suspend listings, withhold payouts, block orders, cancel participation in campaigns, or terminate the Seller account."
    ]
  },
  {
    id: "4",
    title: "4. Product Legality, Listing Accuracy, Labelling and Mandatory Disclosures",
    heading: "4. Product Legality, Listing Accuracy, Labelling and Mandatory Disclosures",
    paragraphs: [
      "The Seller shall ensure that each listing, image, product name, specification, material composition, dimensions, quantity, origin statement, care instruction, usage direction, warning, price, discount claim, and every other consumer-facing disclosure is accurate, complete, legally compliant, and fully supported by documentary or operational evidence maintained by the Seller.",
      "For packaged goods and other regulated goods, the Seller shall ensure compliance with all applicable labelling and declaration obligations, including Legal Metrology and packaged-commodity requirements, mandatory declarations, MRP and quantity disclosures, manufacturer or packer details, and any other product-specific consumer information required to lawfully sell through e-commerce channels.",
      "Any discrepancy between the listing and the delivered product, including wrong material, wrong colour, wrong dimension, wrong count, missing accessory, misleading image, false premium claim, false handmade claim, wrong care instruction, undeclared defect, or any other misdescription, shall be treated as a Seller-fault event and Oye Imagine may issue a refund, replacement, return approval, listing block, recovery debit, or other corrective action at the Seller's cost."
    ]
  },
  {
    id: "5",
    title: "5. Quality Standards, Inspection Rights and Product Acceptance",
    heading: "5. Quality Standards, Inspection Rights and Product Acceptance",
    paragraphs: [
      "The Seller shall supply products that are fit for sale, durable for their intended use, free from material defects, free from unsafe conditions, and consistent in workmanship, finish, functionality, and presentation. Oye Imagine may prescribe additional quality, packaging, photography, or content standards from time to time and the Seller shall comply with such standards within the timelines notified by Oye Imagine.",
      "Oye Imagine shall have the right, at any time and without prior notice where urgency so requires, to conduct sampling, image review, catalogue review, mystery purchase, batch review, document verification, complaint-based inspection, or post-return forensic review in relation to any product or SKU listed by the Seller.",
      "Where Oye Imagine determines, in its reasonable discretion, that a product does not meet required quality standards or presents reputational, legal, customer-experience, or safety risk, Oye Imagine may reject, delist, quarantine, suspend, or permanently block the affected SKU or the Seller account, require corrective action plans, or impose enhanced monitoring before allowing continued sale."
    ]
  },
  {
    id: "6",
    title: "6. Packaging, Dispatch, Fulfilment, Service Levels and Order Conduct",
    heading: "6. Packaging, Dispatch, Fulfilment, Service Levels and Order Conduct",
    paragraphs: [
      "The Seller shall pack all products in a secure, transit-worthy, clean, appropriately labelled, and category-appropriate manner so as to minimise breakage, deformation, leakage, soiling, moisture damage, accessory loss, and other avoidable transit or handling failures. Inadequate packaging shall be treated as a Seller-fault defect.",
      "The Seller shall dispatch accepted orders within the turnaround times prescribed by Oye Imagine and shall not mark orders as shipped, ready, or fulfilled unless such status is truthful and supported by actual operational readiness. Repeated late dispatch, unserviceability, false shipment status, or avoidable cancellations shall constitute operational breach.",
      "Oye Imagine may impose service-level thresholds, including order acceptance rate, dispatch SLA, cancellation rate, fill rate, delivery success rate, packaging failure rate, and response-time standards, and may use such thresholds for ranking, campaign eligibility, reserve-setting, payout timing, and disciplinary action."
    ]
  },
  {
    id: "7",
    title: "7. Returns, Refunds, Replacements and Reverse Logistics",
    heading: "7. Returns, Refunds, Replacements and Reverse Logistics",
    paragraphs: [
      "The Seller acknowledges that under applicable consumer and e-commerce standards, customers may be entitled to return, replacement, repair, refund, or other relief where goods are defective, deficient, damaged, counterfeit, unsafe, late beyond promised timelines, materially different from description, or otherwise non-compliant. The Seller shall not refuse legitimate take-back or refund obligations arising from such circumstances.",
      "Oye Imagine may, acting in its reasonable discretion and subject to applicable law, decide customer-facing outcomes including return approval, refund issuance, replacement approval, partial refund, goodwill resolution, or complaint closure, and may do so before or after obtaining the Seller's input where operational urgency, customer protection, or legal compliance so requires.",
      "Where a return, refund, replacement, or complaint is attributable in whole or in part to Seller fault, Oye Imagine may recover from the Seller the refund amount, reverse logistics cost, forward logistics cost, packaging loss, payment processing cost where contractually permissible, complaint handling cost, promotional subsidy reversal, and any other direct loss reasonably linked to the incident."
    ]
  },
  {
    id: "8",
    title: "8. Ratings, Reviews, Complaint Ratio, Quality Score and Performance Enforcement",
    heading: "8. Ratings, Reviews, Complaint Ratio, Quality Score and Performance Enforcement",
    paragraphs: [
      "The Seller agrees that Oye Imagine may measure and monitor the Seller's performance through ratings, reviews, defect rate, return rate, complaint rate, late dispatch rate, cancellation rate, non-delivery rate, quality score, customer dissatisfaction score, dispute rate, repeat-complaint rate, and other internal or external quality metrics determined by Oye Imagine from time to time.",
      "If the Seller's performance falls below platform thresholds or trend lines prescribed by Oye Imagine, whether across the entire account or any particular category, cluster, or SKU set, Oye Imagine may issue warnings, require corrective action, reduce visibility, suspend participation in campaigns, hold reserves, delay payouts, disable affected listings, impose enhanced quality review, or suspend or terminate the Seller account.",
      "The Seller shall not directly or indirectly post, solicit, procure, manipulate, suppress, incentivise, fabricate, or distort consumer reviews, ratings, testimonials, or complaint outcomes. Any such conduct, or any attempt to interfere with the integrity of marketplace feedback systems, shall constitute material breach and may trigger immediate suspension and indemnity obligations."
    ]
  },
  {
    id: "9",
    title: "9. Counterfeit, Restricted, Unsafe, Non-Compliant and Infringing Products",
    heading: "9. Counterfeit, Restricted, Unsafe, Non-Compliant and Infringing Products",
    paragraphs: [
      "The Seller shall not list, store, advertise, or sell any counterfeit, pirated, stolen, prohibited, unsafe, restricted, recalled, expired, adulterated, deceptively labelled, unlicensed, or otherwise unlawful product through Oye Imagine. The Seller further warrants that all products are genuine and that their sale, packaging, and description do not infringe any trademark, copyright, design, patent, trade dress, publicity, privacy, or other proprietary or personality right.",
      "Upon receiving any complaint, notice, suspicion, market intelligence, customer escalation, regulator query, or internal red flag concerning authenticity, safety, legality, infringement, or restricted-product status, Oye Imagine may immediately delist, block, suspend, quarantine, investigate, or disclose relevant information to competent authorities or affected customers, without prior notice where urgency so requires.",
      "The Seller shall, upon demand, promptly furnish purchase invoices, authorisation letters, test reports, batch records, product origin records, brand-use permissions, and any other evidence requested by Oye Imagine to verify legality, authenticity, and compliance. Failure to furnish such material shall itself be grounds for adverse action."
    ]
  },
  {
    id: "10",
    title: "10. Pricing, Commission, Taxes, TCS, Set-Off, Reserves and Recoveries",
    heading: "10. Pricing, Commission, Taxes, TCS, Set-Off, Reserves and Recoveries",
    paragraphs: [
      "The commercial terms applicable to the Seller, including commission, payment cycle, incentives, promotions, campaign participation, markdown support, quality-linked consequences, and reserves or holdbacks, shall be as agreed in the relevant commercial schedule, dashboard settings, admin configuration, or other written record maintained by Oye Imagine and may be updated from time to time in accordance with this Agreement.",
      "The Seller shall be solely responsible for correct tax classification, invoice accuracy, GST compliance, and statutory reporting on its supplies. Oye Imagine may deduct or collect taxes, tax at source, or tax collection at source where required by applicable law, including GST TCS mechanics applicable to e-commerce operators, and may make reconciliations for returns, reversals, and debit adjustments in accordance with law and platform records.",
      "Oye Imagine may at any time set off, debit, retain, reverse, net, or otherwise recover any amount due from the Seller against current or future payouts, reserves, promotional receivables, reimbursements, or any other sums otherwise payable to the Seller, including refunds, claims, damages, indemnity amounts, penalties, excess payments, tax mismatches, chargebacks, or losses arising from Seller breach."
    ]
  },
  {
    id: "11",
    title: "11. Customer Claims, Product Liability, Recall and Regulatory Cooperation",
    heading: "11. Customer Claims, Product Liability, Recall and Regulatory Cooperation",
    paragraphs: [
      "The Seller shall bear sole and primary responsibility for all customer injury, defect claims, safety complaints, quality complaints, warranty failures, product-performance failures, misleading-description claims, statutory non-compliance, and product-liability exposure arising from or relating to the Seller's products, packaging, instructions, warnings, or omissions.",
      "If any product listed by the Seller is or may be defective, unsafe, hazardous, non-compliant, or liable to attract a recall, stop-sale, takedown, warning, public notice, or regulatory action, the Seller shall immediately notify Oye Imagine in writing with full particulars and shall cooperate fully in any investigation, recall, customer communication, refund programme, replacement programme, withdrawal, or regulator response.",
      "Oye Imagine may, where it considers necessary for legal compliance, customer safety, or brand protection, suspend sales, block payouts, contact affected customers, process refunds, issue warnings, demand corrective action, or cooperate with regulators, and all reasonable costs and liabilities arising from such steps to the extent attributable to the Seller or its products shall be borne by the Seller."
    ]
  },
  {
    id: "12",
    title: "12. Intellectual Property, Brand Assets, Marketing and Platform Content",
    heading: "12. Intellectual Property, Brand Assets, Marketing and Platform Content",
    paragraphs: [
      "The Seller grants Oye Imagine a non-exclusive, worldwide, royalty-free, sublicensable licence during the term of this Agreement to host, reproduce, adapt, resize, display, distribute, translate, and use the Seller's trade names, marks, logos, product images, product videos, specifications, descriptive content, and associated material for listing, promotion, cataloguing, customer support, and marketplace operations.",
      "The Seller warrants that it has all rights necessary to grant the foregoing licence and that the use of such content by Oye Imagine in accordance with this Agreement shall not infringe any third-party right. Oye Imagine may edit format, placement, layout, image treatment, keywording, and merchandising presentation for operational and marketing purposes, provided that such edits do not knowingly create false material claims.",
      "Oye Imagine may reject or remove content that it considers low-quality, misleading, unlawful, brand-damaging, infringing, or non-compliant with its marketplace standards."
    ]
  },
  {
    id: "13",
    title: "13. Data Protection, Confidentiality, Restricted Use and Non-Circumvention",
    heading: "13. Data Protection, Confidentiality, Restricted Use and Non-Circumvention",
    paragraphs: [
      "The Seller shall use customer, transaction, and marketplace data only to the limited extent necessary to fulfil orders, provide lawful after-sales support, comply with tax and regulatory obligations, and meet obligations expressly permitted by Oye Imagine. The Seller shall not use such data for unauthorised marketing, profiling, resale, scraping, contact harvesting, or off-platform solicitation.",
      "All non-public commercial, technical, operational, policy, pricing, complaint, and platform-performance information disclosed by Oye Imagine or derived from the Seller's use of the platform shall be treated as confidential and shall not be disclosed except to personnel or advisors with a genuine need to know and who are bound by confidentiality obligations no less protective than those contained herein.",
      "The Seller shall not circumvent the marketplace relationship by inducing customers, vendors, service providers, or employees introduced through Oye Imagine to transact outside the platform in a manner intended to defeat commissions, platform controls, quality standards, or customer-protection mechanisms."
    ]
  },
  {
    id: "14",
    title: "14. Audit Rights, Records, Evidence and Information Access",
    heading: "14. Audit Rights, Records, Evidence and Information Access",
    paragraphs: [
      "The Seller shall maintain accurate and retrievable books, invoices, stock records, batch or lot details where relevant, procurement records, warranty records, tax invoices, compliance certificates, customer-complaint records, return analysis, and all other records reasonably necessary to verify the Seller's compliance with this Agreement and applicable law.",
      "Upon request by Oye Imagine, the Seller shall promptly furnish such records, explanations, samples, photographs, test results, and other evidence as Oye Imagine may reasonably require for quality verification, tax reconciliation, product-authenticity review, customer dispute handling, regulatory response, fraud review, or enforcement of this Agreement.",
      "If the Seller fails to maintain or produce adequate records, Oye Imagine may draw reasonable adverse inferences, restrict listings, hold payouts, reverse credits, or take other protective action pending satisfactory verification."
    ]
  },
  {
    id: "15",
    title: "15. Suspension, Delisting, Termination and Post-Term Survival",
    heading: "15. Suspension, Delisting, Termination and Post-Term Survival",
    paragraphs: [
      "Oye Imagine may, with immediate effect and without liability to the Seller, suspend any listing, SKU, category, campaign, payment, or Seller account, or terminate this Agreement, if it believes that the Seller has breached this Agreement, violated law, supplied defective or unsafe goods, attracted abnormal complaints or returns, submitted false KYC or tax details, manipulated reviews, infringed rights, caused reputational harm, or otherwise created risk for customers or the platform.",
      "The Seller may cease use of the platform subject to completing all pending obligations, including fulfilment of accepted orders, resolution of customer complaints, return processing, refund liabilities, tax reconciliations, and settlement of all dues to Oye Imagine.",
      "Termination, suspension, or delisting shall not affect any accrued rights, set-off rights, audit rights, confidentiality obligations, indemnities, return liabilities, product-liability obligations, recovery rights, survival clauses, or any other provision intended by its nature to survive."
    ]
  },
  {
    id: "16",
    title: "16. Indemnity, Limitation of Liability and Dispute Resolution",
    heading: "16. Indemnity, Limitation of Liability and Dispute Resolution",
    paragraphs: [
      "The Seller shall defend, indemnify, and hold harmless Oye Imagine, its affiliates, directors, officers, employees, agents, service providers, and representatives from and against all claims, complaints, proceedings, losses, damages, costs, penalties, interest, settlements, and expenses, including reasonable legal fees, arising from or relating to the Seller's products, listings, warranties, misrepresentations, regulatory non-compliance, product defects, product-liability claims, tax defaults, infringement claims, review manipulation, breach of law, or breach of this Agreement.",
      "To the maximum extent permissible under applicable law, Oye Imagine shall not be liable to the Seller for indirect, incidental, consequential, special, punitive, or loss-of-profit damages arising from or relating to this Agreement, platform use, ranking changes, campaign exclusions, suspension actions, or customer-resolution decisions undertaken in good faith for platform protection, customer safety, or legal compliance.",
      "This Agreement shall be governed by the laws of India. Subject to any arbitration or dispute-resolution mechanism separately incorporated by Oye Imagine, courts at the location specified by Oye Imagine in the final agreement version shall have jurisdiction, and Oye Imagine shall additionally be entitled to seek urgent injunctive or interim relief for protection of confidential information, intellectual property, platform integrity, recovery rights, or misuse of marketplace systems."
    ]
  }
];

    const annexure = [
      { label: 'Seller legal name / business name', value: sellerBlock.businessName || 'â€”' },
      { label: 'Primary contact', value: sellerBlock.contactName || 'â€”' },
      { label: 'Email', value: sellerBlock.email || 'â€”' },
      { label: 'Phone', value: sellerBlock.phone || 'â€”' },
      { label: 'Craft / category', value: compact([sellerBlock.craft, sellerBlock.region]).join(' â€¢ ') || 'â€”' },
      { label: 'Commission %', value: `${commercialTerms.commissionPct ?? 20}%` },
      { label: 'Payout cycle', value: safeString(commercialTerms.payoutCycle, 'MONTHLY') || 'â€”' },
      { label: 'Neejee Select', value: commercialTerms.isNeejeeSelect ? 'Yes' : 'No' },
      { label: 'Quality score', value: String(commercialTerms.qualityScore ?? 0) },
      { label: 'Years of practice', value: commercialTerms.yearsOfPractice != null ? String(commercialTerms.yearsOfPractice) : 'â€”' },
      { label: 'Cluster', value: commercialTerms.cluster || 'â€”' },
      { label: 'PAN', value: sellerBlock.pan || 'â€”' },
      { label: 'GSTIN', value: sellerBlock.gstin || 'â€”' },
      { label: 'Bank', value: compact([sellerBlock.bankName, sellerBlock.ifsc, sellerBlock.bankAccountMasked]).join(' â€¢ ') || 'â€”' },
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