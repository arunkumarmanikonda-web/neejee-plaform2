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
    title: "1. Parties and Contract Formation",
    heading: "1. Parties and Contract Formation",
    paragraphs: [
      "This Marketplace Seller Agreement (\"Agreement\") is made between Oye Imagine Private Limited, a company incorporated under the laws of India and operating the Neejee marketplace platform (\"Oye Imagine\", \"Neejee\", \"Company\", or \"Marketplace\"), and the seller identified in the commercial schedule and seller particulars forming part of this Agreement (\"Seller\").",
      "This Agreement governs the Seller's onboarding, listing, sale, fulfilment, return handling, customer support obligations, quality obligations, and all other activities undertaken by or through the Seller on the Neejee marketplace.",
      "This Agreement becomes binding when accepted, approved, digitally acknowledged, operationally activated, or otherwise finalised by an authorised admin of Oye Imagine."
    ]
  },
  {
    id: "2",
    title: "2. Recitals and Whereas",
    heading: "2. Recitals and Whereas",
    paragraphs: [
      "WHEREAS Oye Imagine Private Limited owns, manages, licenses, operates, or controls the Neejee marketplace and related digital, operational, and promotional infrastructure for facilitating commerce between sellers and customers;",
      "WHEREAS the Seller represents that it is engaged in the lawful business of manufacturing, sourcing, distributing, branding, marketing, or selling products and wishes to list and sell such products through the Neejee marketplace;",
      "WHEREAS Oye Imagine is willing to permit the Seller to use the marketplace on a non-exclusive, revocable, conditional, and compliance-based basis, subject to this Agreement, platform policies, applicable law, and quality-control standards;",
      "NOW, THEREFORE, in consideration of the mutual covenants and promises set out herein, the Parties agree as follows."
    ]
  },
  {
    id: "3",
    title: "3. Drafting Control, AI-Assisted Editing and Finalisation Authority",
    heading: "3. Drafting Control, AI-Assisted Editing and Finalisation Authority",
    paragraphs: [
      "Until finalisation by an authorised admin of Oye Imagine, every clause, recital, definition, paragraph, annexure, schedule, commercial term, operational term, and compliance statement in this Agreement may be edited, revised, restructured, reformatted, expanded, condensed, redrafted, or regenerated only by authorised admins of Oye Imagine, whether manually or with the assistance of artificial intelligence tools used under such admin supervision.",
      "The Seller shall have no unilateral right to finalise, freeze, lock, edit, override, or treat the legal text of this Agreement as binding in any particular form unless and until such form is approved by an authorised admin of Oye Imagine.",
      "After finalisation, this Agreement may be amended only through a written amendment, updated approved version, or regenerated replacement agreement expressly approved by an authorised admin of Oye Imagine."
    ]
  },
  {
    id: "4",
    title: "4. Definitions and Interpretation",
    heading: "4. Definitions and Interpretation",
    paragraphs: [
      "\"Applicable Law\" means all laws, rules, regulations, circulars, notifications, orders, standards, advisories, and judicial or regulatory requirements applicable to the Parties, the products, the marketplace, or the transactions contemplated under this Agreement.",
      "\"Customer Complaint\" includes any complaint, grievance, chargeback, dispute, return request, refund request, replacement request, product safety concern, quality concern, authenticity concern, regulatory escalation, or negative customer claim relating to a product or transaction.",
      "\"Seller-Fault Event\" includes any case involving defective goods, damaged goods due to inadequate packaging, wrong item, missing item, material mismatch, false claim, listing misdescription, counterfeit suspicion, safety issue, non-compliance, avoidable delay, avoidable cancellation, or any other event attributable in whole or in part to the Seller.",
      "\"Marketplace Policies\" means all current and future seller rules, quality policies, returns policies, packaging norms, restricted product rules, payout rules, complaint-handling protocols, and admin or platform standards issued by Oye Imagine from time to time.",
      "References to the singular include the plural and vice versa; headings are for convenience and do not limit interpretation; and where any schedule or annexure conflicts with the main body, Oye Imagine's final approved version shall prevail unless expressly stated otherwise."
    ]
  },
  {
    id: "5",
    title: "5. Appointment and Nature of Relationship",
    heading: "5. Appointment and Nature of Relationship",
    paragraphs: [
      "The Seller appoints Oye Imagine, and Oye Imagine accepts such appointment, to provide marketplace facilitation, listing, discovery, promotion, payment collection support, order-routing, and related services in respect of the Seller's products.",
      "Unless expressly agreed otherwise in writing for a specific business model, Oye Imagine acts as a marketplace or facilitating platform and not as the manufacturer or principal seller of the Seller's products.",
      "Responsibility for product quality, conformity, legality, authenticity, packaging sufficiency, statutory declarations, and seller-side after-sales liabilities shall remain with the Seller."
    ]
  },
  {
    id: "6",
    title: "6. Seller Representations, KYC and Eligibility",
    heading: "6. Seller Representations, KYC and Eligibility",
    paragraphs: [
      "The Seller represents and warrants that it is duly organised, validly existing, authorised to enter into this Agreement, and fully empowered to sell the products listed through the marketplace.",
      "The Seller further represents that all KYC, tax, bank, ownership, signatory, address, and identity details submitted to Oye Imagine are true, complete, current, and not misleading.",
      "Any false declaration, document mismatch, concealed beneficial ownership, invalid banking data, expired compliance, or other material inaccuracy shall constitute a material breach."
    ]
  },
  {
    id: "7",
    title: "7. Product Legality, Listing Accuracy and Mandatory Disclosures",
    heading: "7. Product Legality, Listing Accuracy and Mandatory Disclosures",
    paragraphs: [
      "The Seller shall ensure that every product listed through the marketplace is lawful to sell, properly sourced, accurately described, and compliant with all applicable laws and category-specific norms.",
      "The Seller shall be solely responsible for listing accuracy, including title, description, images, composition, dimensions, quantity, country of origin where applicable, warnings, care instructions, claims, features, and any consumer-facing or regulator-facing statement.",
      "The Seller shall ensure all mandatory declarations required under applicable packaged-commodity, labelling, consumer-protection, and e-commerce laws are correctly made and kept current."
    ]
  },
  {
    id: "8",
    title: "8. Quality Standards, Inspection and Acceptance Rights",
    heading: "8. Quality Standards, Inspection and Acceptance Rights",
    paragraphs: [
      "The Seller shall supply products that are fit for sale, merchantable to the extent applicable, properly finished, reasonably durable for intended use, and free from material defect, unsafe condition, contamination, damage, and avoidable inconsistency.",
      "Oye Imagine may prescribe quality-control standards, sampling standards, packaging standards, content standards, and category-specific acceptance criteria from time to time.",
      "Oye Imagine may conduct sampling, mystery purchase, content review, return analysis, complaint-based inspection, and documentary verification at any time, and may reject, suspend, delist, quarantine, or block products or seller accounts that fail quality or compliance expectations."
    ]
  },
  {
    id: "9",
    title: "9. Packaging, Fulfilment, Dispatch and Operational Service Levels",
    heading: "9. Packaging, Fulfilment, Dispatch and Operational Service Levels",
    paragraphs: [
      "The Seller shall pack all products in a safe, clean, secure, transit-worthy, and category-appropriate manner sufficient to minimise damage, leakage, breakage, deformation, accessory loss, and avoidable customer dissatisfaction.",
      "The Seller shall dispatch accepted orders within prescribed service levels and shall not falsely mark orders as ready, shipped, or fulfilled.",
      "Repeated late dispatch, avoidable cancellations, packaging failures, false operational status, or repeated operational non-performance shall entitle Oye Imagine to reduce visibility, hold payouts, remove SKUs, or suspend the Seller."
    ]
  },
  {
    id: "10",
    title: "10. Returns, Refunds, Replacements and Reverse Logistics",
    heading: "10. Returns, Refunds, Replacements and Reverse Logistics",
    paragraphs: [
      "Where products are defective, damaged, counterfeit, unsafe, materially misdescribed, delayed beyond promised timelines, or otherwise non-compliant, the Seller shall honour all legitimate return, replacement, refund, and take-back obligations arising under law, platform policy, or customer resolution standards.",
      "Oye Imagine may decide the customer-facing remedy, including return approval, refund, replacement, or other closure, before or after consulting the Seller where operational urgency, customer trust, legal compliance, or brand protection so requires.",
      "In every Seller-Fault Event, Oye Imagine may recover from the Seller the refund amount, forward shipping cost, reverse logistics cost, packaging loss, complaint handling cost, promotional subsidy reversal, and other reasonably attributable losses."
    ]
  },
  {
    id: "11",
    title: "11. Ratings, Reviews, Complaint Thresholds and Quality Score",
    heading: "11. Ratings, Reviews, Complaint Thresholds and Quality Score",
    paragraphs: [
      "Oye Imagine may measure the Seller's performance using ratings, reviews, complaint ratio, defect ratio, return ratio, cancellation ratio, dispatch performance, dispute rate, customer dissatisfaction trends, and quality score or similar internal metrics.",
      "If the Seller falls below thresholds set by Oye Imagine, whether on a rolling basis or in any review window, Oye Imagine may issue warnings, require corrective action, reduce visibility, withhold reserves, disable affected listings, remove campaign participation, suspend the account, or terminate this Agreement.",
      "The Seller shall not manipulate, procure, suppress, fabricate, distort, incentivise, or interfere with ratings, reviews, testimonials, or complaint outcomes."
    ]
  },
  {
    id: "12",
    title: "12. Counterfeit, Restricted, Infringing or Unsafe Products",
    heading: "12. Counterfeit, Restricted, Infringing or Unsafe Products",
    paragraphs: [
      "The Seller shall not list or sell counterfeit, pirated, prohibited, recalled, expired, adulterated, unsafe, restricted, stolen, or infringing products on the marketplace.",
      "Oye Imagine may immediately delist, suspend, disclose information, block payouts, contact affected customers, or cooperate with authorities if it suspects authenticity issues, safety concerns, legal restrictions, or intellectual-property infringement.",
      "The Seller shall promptly provide invoices, authorisations, certificates, test reports, batch records, and source records requested by Oye Imagine."
    ]
  },
  {
    id: "13",
    title: "13. Commercial Terms, Commission, Taxes, Set-Off and Recoveries",
    heading: "13. Commercial Terms, Commission, Taxes, Set-Off and Recoveries",
    paragraphs: [
      "The Seller's commercial terms, including commission, payout cycle, reserve, holdback, campaign participation, incentives, and category-specific adjustments, shall be governed by the applicable commercial schedule or admin-approved configuration.",
      "The Seller shall remain responsible for tax classification, GST compliance, and invoice accuracy. Oye Imagine may apply tax deductions, TCS, reversals, and reconciliations to the extent required by applicable law or platform settlement logic.",
      "Oye Imagine may set off and recover any amount due from the Seller against any current or future payout, reserve, adjustment, subsidy, reimbursement, or other sum payable to the Seller."
    ]
  },
  {
    id: "14",
    title: "14. Product Liability, Recall, Customer Safety and Regulatory Cooperation",
    heading: "14. Product Liability, Recall, Customer Safety and Regulatory Cooperation",
    paragraphs: [
      "The Seller shall bear sole and primary responsibility for defect claims, warranty failures, product-performance issues, safety incidents, misleading-description claims, and product-liability exposure arising from the Seller's products.",
      "If any product may be defective, unsafe, hazardous, recalled, or non-compliant, the Seller shall immediately notify Oye Imagine and cooperate in any stop-sale, withdrawal, recall, customer communication, replacement programme, refund programme, or regulator response.",
      "All reasonable costs and liabilities arising from a Seller-attributable safety, defect, or recall event shall be borne by the Seller."
    ]
  },
  {
    id: "15",
    title: "15. Intellectual Property, Content Licence and Marketplace Use",
    heading: "15. Intellectual Property, Content Licence and Marketplace Use",
    paragraphs: [
      "The Seller grants Oye Imagine a non-exclusive, royalty-free licence during the term to use the Seller's product images, descriptions, logos, marks, videos, and content for listing, promotion, cataloguing, merchandising, and support purposes.",
      "The Seller warrants that it has all rights necessary to provide such material and that the use of such material by Oye Imagine under this Agreement shall not infringe third-party rights.",
      "Oye Imagine may edit display format, layout, image treatment, and merchandising presentation for marketplace operations, provided it does not knowingly create a false material claim."
    ]
  },
  {
    id: "16",
    title: "16. Confidentiality, Data Use and Non-Circumvention",
    heading: "16. Confidentiality, Data Use and Non-Circumvention",
    paragraphs: [
      "The Seller shall use customer and marketplace data only for lawful fulfilment, after-sales service, tax compliance, and obligations expressly permitted by Oye Imagine.",
      "The Seller shall not scrape, harvest, remarket to, solicit, divert, or independently exploit marketplace-derived customer relationships in a manner intended to circumvent platform controls or commercial arrangements.",
      "All non-public commercial, technical, operational, and policy information of Oye Imagine shall be treated as confidential."
    ]
  },
  {
    id: "17",
    title: "17. Audit Rights, Evidence Preservation and Record Maintenance",
    heading: "17. Audit Rights, Evidence Preservation and Record Maintenance",
    paragraphs: [
      "The Seller shall maintain accurate books, invoices, stock records, compliance records, complaint records, batch records where applicable, return analysis, and support evidence reasonably necessary to verify compliance with this Agreement.",
      "Upon request, the Seller shall promptly furnish records, samples, invoices, photographs, test reports, certificates, and explanations required by Oye Imagine.",
      "Failure to maintain or furnish such records may result in adverse inference, payout hold, listing restrictions, or other protective action by Oye Imagine."
    ]
  },
  {
    id: "18",
    title: "18. Suspension, Delisting and Termination",
    heading: "18. Suspension, Delisting and Termination",
    paragraphs: [
      "Oye Imagine may immediately suspend or terminate listings, categories, campaigns, payouts, or the Seller account if the Seller breaches this Agreement, violates law, triggers abnormal complaints or returns, manipulates reviews, provides false KYC, infringes rights, or creates customer, legal, or reputational risk.",
      "The Seller may cease marketplace use only after satisfying all pending obligations, including order completion, returns handling, refund liabilities, tax reconciliation, and payment of all dues.",
      "Suspension or termination shall not affect accrued rights, indemnities, recovery rights, confidentiality obligations, or survival clauses."
    ]
  },
  {
    id: "19",
    title: "19. Non-Solicit, Non-Circumvention and Non-Compete",
    heading: "19. Non-Solicit, Non-Circumvention and Non-Compete",
    paragraphs: [
      "During the term of this Agreement, the Seller shall not directly or indirectly use the marketplace relationship to bypass Oye Imagine for the purpose of diverting marketplace customers, defeating commissions, undermining platform controls, or moving protected marketplace transactions off-platform.",
      "The Seller shall not, during the term and for any validly enforceable period permitted by applicable law, solicit or induce customers, service providers, or personnel introduced through Oye Imagine in a manner harmful to Oye Imagine's legitimate business interests, confidential information, goodwill, or marketplace integrity.",
      "Any non-compete or restraint language in this Agreement shall be interpreted only to the maximum extent enforceable under applicable Indian law, and where any portion is held unenforceable, the surviving protections on confidentiality, non-solicit, non-circumvention, misuse restriction, and platform-protection covenants shall continue to apply."
    ]
  },
  {
    id: "20",
    title: "20. Indemnity, Limitation of Liability and Jurisdiction",
    heading: "20. Indemnity, Limitation of Liability and Jurisdiction",
    paragraphs: [
      "The Seller shall defend, indemnify, and hold harmless Oye Imagine, its affiliates, directors, officers, employees, agents, and service providers from and against all claims, complaints, proceedings, losses, damages, costs, penalties, settlements, and expenses arising from the Seller's products, listings, conduct, breach, misrepresentation, non-compliance, defects, returns, infringement, tax defaults, or product-liability events.",
      "To the maximum extent permitted by law, Oye Imagine shall not be liable for indirect, incidental, special, punitive, consequential, or loss-of-profit damages arising from platform use, visibility decisions, suspensions, complaint resolutions, or lawful enforcement actions taken in good faith.",
      "This Agreement shall be governed by the laws of India, and subject to any arbitration mechanism separately specified by Oye Imagine in the final approved version, the courts at Noida, Uttar Pradesh shall have exclusive jurisdiction, provided that Oye Imagine may seek interim or injunctive relief before any competent court as necessary to protect confidential information, recovery rights, platform integrity, or intellectual property."
    ]
  }
];

    const annexure = [
      { label: 'Seller legal name / business name', value: sellerBlock.businessName || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
      { label: 'Primary contact', value: sellerBlock.contactName || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
      { label: 'Email', value: sellerBlock.email || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
      { label: 'Phone', value: sellerBlock.phone || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
      { label: 'Craft / category', value: compact([sellerBlock.craft, sellerBlock.region]).join(' ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ') || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
      { label: 'Commission %', value: `${commercialTerms.commissionPct ?? 20}%` },
      { label: 'Payout cycle', value: safeString(commercialTerms.payoutCycle, 'MONTHLY') || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
      { label: 'Neejee Select', value: commercialTerms.isNeejeeSelect ? 'Yes' : 'No' },
      { label: 'Quality score', value: String(commercialTerms.qualityScore ?? 0) },
      { label: 'Years of practice', value: commercialTerms.yearsOfPractice != null ? String(commercialTerms.yearsOfPractice) : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
      { label: 'Cluster', value: commercialTerms.cluster || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
      { label: 'PAN', value: sellerBlock.pan || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
      { label: 'GSTIN', value: sellerBlock.gstin || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
      { label: 'Bank', value: compact([sellerBlock.bankName, sellerBlock.ifsc, sellerBlock.bankAccountMasked]).join(' ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ') || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' },
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