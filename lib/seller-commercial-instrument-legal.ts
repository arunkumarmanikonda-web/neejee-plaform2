export type SellerCommercialLegalInstrumentType = 'INITIAL' | 'ADDENDUM' | 'RENEWAL' | 'TERMINATION';

export type CommercialTermsForLegalInstrument = {
  commissionPct?: number | null;
  qualityScore?: number | null;
  payoutCycle?: string | null;
  isNeejeeSelect?: boolean | null;
  paymentTerms?: string | null;
  settlementBasis?: string | null;
  returnsCommercialTreatment?: string | null;
  marketingContribution?: string | null;
  logisticsCommercialTerms?: string | null;
  taxTreatment?: string | null;
  otherTerms?: Record<string, unknown> | null;
};

type BuildInput = {
  type: SellerCommercialLegalInstrumentType;
  instrumentNumber: string;
  instrumentTitle: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  parentInstrumentNumber?: string | null;
  rootInstrumentNumber?: string | null;
  changeReason?: string | null;
  terms?: CommercialTermsForLegalInstrument | null;
};

type LegalClause = {
  id: string;
  title: string;
  heading: string;
  paragraphs: string[];
};

function clause(id: number, title: string, paragraphs: string[]): LegalClause {
  const heading = `${id}. ${title}`;
  return { id: String(id), title: heading, heading, paragraphs };
}

function clean(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function termsSummary(terms: CommercialTermsForLegalInstrument | null | undefined) {
  const t = terms || {};
  const parts = [
    typeof t.commissionPct === 'number' ? `commission ${t.commissionPct}%` : '',
    clean(t.payoutCycle) ? `payout cycle ${clean(t.payoutCycle)}` : '',
    typeof t.qualityScore === 'number' ? `quality score ${t.qualityScore}` : '',
    typeof t.isNeejeeSelect === 'boolean' ? `NEEJEE Select ${t.isNeejeeSelect ? 'enabled' : 'not enabled'}` : '',
    clean(t.paymentTerms),
    clean(t.settlementBasis),
    clean(t.returnsCommercialTreatment),
    clean(t.marketingContribution),
    clean(t.logisticsCommercialTerms),
    clean(t.taxTreatment),
  ].filter(Boolean);
  return parts.join('; ') || 'the commercial schedule annexed to this Instrument';
}

function commonElectronicExecutionParagraphs() {
  return [
    'The Parties expressly agree that this Instrument may be negotiated, issued, accepted and executed through electronic records and electronic communications. The electronic audit trail maintained by the Marketplace, including the instrument identifier, version, date and time stamps, verified mobile number, OTP events, access logs, acceptance records, uploaded signature image and related system records, may be relied upon as evidence of the Parties’ intention to execute and be bound by this Instrument.',
    'Nothing in this clause dispenses with any mandatory requirement of applicable law. If a prescribed electronic signature, digital signature, e-stamp, physical stamp, registration, notarisation, witness attestation or other formality is legally required for a particular document, transaction or jurisdiction, the Parties shall complete that additional formality and the Marketplace may withhold activation until such requirement is satisfied.',
    'This Instrument may be executed in counterparts and by electronic exchange. Each counterpart shall be treated as an original and all counterparts together shall constitute one instrument.'
  ];
}

function commonDisputeParagraphs() {
  return [
    'This Instrument and the contractual relationship to which it relates shall be governed by and construed in accordance with the laws of India.',
    'Any dispute, controversy or claim arising out of or in connection with this Instrument or the underlying seller agreement, including any question regarding its existence, validity, interpretation, performance, breach, suspension, termination or consequences, shall first be escalated by written notice to authorised representatives of both Parties for good-faith resolution. If the dispute is not resolved within fifteen (15) days of such notice, it shall be referred to arbitration under the Arbitration and Conciliation Act, 1996, as amended from time to time, by a sole arbitrator mutually appointed by the Parties. If the Parties do not agree on the arbitrator within thirty (30) days of a valid arbitration notice, the arbitrator shall be appointed in accordance with the statutory mechanism under the said Act.',
    'The seat and legal place of arbitration shall be Gautam Buddh Nagar, Uttar Pradesh, India, unless the Parties expressly agree otherwise in writing. The proceedings shall be conducted in English. Courts having supervisory jurisdiction over the arbitral seat shall have jurisdiction for interim, supervisory and enforcement relief to the extent permitted by law.'
  ];
}

function addendum(input: BuildInput) {
  const parent = clean(input.parentInstrumentNumber, 'the immediately preceding seller agreement/instrument');
  const reason = clean(input.changeReason, 'the commercial and operational changes recorded in this Addendum');
  const effective = clean(input.effectiveFrom, 'the Effective Date stated in the commercial schedule');
  const end = clean(input.effectiveTo, 'the expiry or earlier termination of the underlying Agreement');
  const commercial = termsSummary(input.terms);

  const recitals = [
    `A. The Parties are bound by ${parent} and the contractual documents incorporated into it (collectively, the “Original Agreement”).`,
    `B. The Parties now desire to amend, supplement and record certain agreed commercial and/or operational matters with effect from ${effective}, without unintentionally extinguishing accrued rights or replacing provisions not expressly amended.`,
    `C. The principal commercial context for this Addendum is: ${reason}.`,
    `D. The Parties therefore intend this ${input.instrumentNumber} to operate as a written addendum forming an integral part of the Original Agreement.`
  ];

  return {
    title: input.instrumentTitle || 'Addendum to Marketplace Seller Agreement',
    subtitle: `Detailed contractual addendum to ${parent}`,
    recitals,
    clauses: [
      clause(1, 'Background, Recitals and Incorporation', [
        ...recitals,
        'The foregoing recitals are material statements of background and contractual intention and are incorporated into the operative provisions of this Addendum. Unless expressly stated otherwise, capitalised terms not defined in this Addendum shall have the meanings assigned to them in the Original Agreement.'
      ]),
      clause(2, 'Definitions and Interpretation', [
        '“Addendum” means this instrument together with its commercial schedule, annexures, execution record and any document expressly incorporated by reference. “Effective Date” means the date from which the amendments recorded herein take contractual effect. “Original Agreement” means the agreement identified above together with all earlier valid addenda and amendments forming part of the same contractual lineage.',
        'References to the Original Agreement shall be construed as references to the Original Agreement as amended by this Addendum. Headings are for convenience only. The singular includes the plural and vice versa. References to law include amendments, re-enactments, subordinate legislation and binding regulatory requirements in force from time to time.'
      ]),
      clause(3, 'Purpose, Scope and Contractual Status of this Addendum', [
        'This Addendum records only the amendments, substitutions, supplements and confirmations expressly set out herein. It does not, by implication, amend any other provision of the Original Agreement.',
        'This Addendum shall be read together with the Original Agreement as one composite contractual arrangement. It is not intended to create a separate marketplace relationship independent of the Original Agreement.'
      ]),
      clause(4, 'Specific Amendments and Substituted Commercial Terms', [
        `With effect from ${effective}, the commercial terms applicable to the relationship shall include and, where inconsistent, be substituted by the commercial schedule recorded with this Addendum, including ${commercial}.`,
        'Any term expressly stated to replace, vary or supersede an earlier commercial term shall do so from the Effective Date. All amounts, percentages, payout mechanics, reserves, deductions, campaign contributions, logistics allocations and tax treatments shall be applied prospectively unless this Addendum expressly states that an adjustment is retrospective.',
        'No commercial field left blank or not expressly changed shall be construed as an amendment merely because a new Addendum has been issued.'
      ]),
      clause(5, 'Effective Date, Duration and Consideration', [
        `This Addendum shall take effect on ${effective} and shall remain operative together with the Original Agreement until ${end}, unless earlier superseded, renewed, terminated or otherwise lawfully brought to an end.`,
        'The mutual promises contained herein, the continuation of marketplace access and services, the continued opportunity to list and sell products, and the reciprocal obligations undertaken by the Parties constitute good and sufficient contractual consideration to the extent consideration is required by applicable law.'
      ]),
      clause(6, 'Order of Precedence and Conflict', [
        'If there is a direct and irreconcilable conflict between this Addendum and the Original Agreement, this Addendum shall prevail only to the extent of the subject matter expressly amended by it. For all other matters, the Original Agreement shall continue to prevail.',
        'Seller policies, operational standards and platform rules may supplement the contract but shall not be interpreted to contradict an expressly negotiated written commercial term in this Addendum unless the applicable law requires otherwise or the Parties subsequently agree in writing.'
      ]),
      clause(7, 'Reaffirmation of Authority, KYC and Representations', [
        'Each Party represents that it has full legal capacity and corporate or other authority to enter into this Addendum and that the person executing it on its behalf is duly authorised.',
        'The Seller reaffirms that all KYC, tax, bank, ownership, beneficial ownership, address, contact and regulatory information maintained with the Marketplace is true, current and complete. The Seller shall promptly notify the Marketplace of any change affecting its eligibility, tax treatment, bank settlement, legal status or authority to transact.'
      ]),
      clause(8, 'Operational Continuity and Pending Transactions', [
        'Except to the extent expressly varied, order acceptance, fulfilment, dispatch, packaging, customer support, returns, replacement, refund and complaint-handling obligations under the Original Agreement shall continue without interruption.',
        'Orders, returns, disputes, chargebacks, claims and reconciliations arising before the Effective Date shall continue to be governed by the contractual terms applicable when the underlying event occurred, except where this Addendum expressly provides a different transition treatment.'
      ]),
      clause(9, 'Payments, Settlement, Taxes and Set-Off', [
        'Settlement amounts shall remain subject to reconciliation, commissions, fees, taxes, statutory deductions, TCS or other legally required deductions, refunds, reversals, chargebacks, reserves, penalties lawfully chargeable under the contract and any agreed commercial adjustments.',
        'The Marketplace may exercise contractual rights of set-off and recovery against amounts otherwise payable to the Seller where sums are due under the Original Agreement or this Addendum. Such set-off shall not prejudice any independent recovery right available under contract or law.',
        'Each Party remains responsible for its own tax registrations, tax classification, invoicing and statutory compliance. Nothing in this Addendum shall be construed as tax advice or as shifting a statutory liability contrary to law.'
      ]),
      clause(10, 'Returns, Refunds, Customer Claims and Existing Liabilities', [
        'Nothing in this Addendum releases the Seller from liability for defective, unsafe, counterfeit, misdescribed, non-compliant or otherwise Seller-attributable products supplied before or after the Effective Date.',
        'Customer refunds, reverse logistics, replacement costs, chargebacks and complaint costs shall be allocated in accordance with the Original Agreement as modified by any express commercial treatment recorded in this Addendum. Accrued and contingent liabilities survive the amendment.'
      ]),
      clause(11, 'Compliance, Quality and Marketplace Controls', [
        'All product legality, labelling, packaged-commodity, consumer-protection, GST, intellectual-property, product-safety and category-specific obligations under the Original Agreement continue in full force unless a lawful written variation is expressly stated.',
        'The Marketplace retains its contractual rights to inspect, audit, delist, quarantine, suspend or require corrective action where quality, customer, safety, authenticity or regulatory risk is identified.'
      ]),
      clause(12, 'Confidentiality, Data and Intellectual Property', [
        'Confidentiality, data-use, customer-data restrictions, content licences and intellectual-property obligations under the Original Agreement continue to apply to this Addendum and to all information exchanged in connection with it.',
        'No amendment to ownership of intellectual property, customer data or confidential information shall be inferred from a change in commercial terms unless this Addendum expressly states such change.'
      ]),
      clause(13, 'No Waiver, No Release and No Unintended Novation', [
        'Execution of this Addendum does not waive any prior breach, claim, right, remedy, receivable, chargeback, indemnity or accrued liability unless a waiver or release is expressly identified in writing.',
        'The Parties intend amendment and continuation, not novation, unless this Addendum expressly states otherwise. The identity of the contracting parties and the contractual lineage remain unchanged.'
      ]),
      clause(14, 'Further Assurances, Records and Audit Trail', [
        'Each Party shall execute further documents and provide information reasonably necessary to give effect to this Addendum, complete statutory formalities, reconcile commercial consequences and preserve an intelligible contractual record.',
        'The Marketplace may retain the Original Agreement, this Addendum, associated approvals, communications, version history, signatures and audit logs as part of the permanent seller relationship record, subject to applicable law.'
      ]),
      clause(15, 'Notices and Communications', [
        'Formal notices under this Addendum shall be delivered using the notice mechanism in the Original Agreement or to the latest verified email, registered address or other authorised communication channel recorded for the relevant Party.',
        'Operational notifications, workflow messages, OTP communications and system alerts do not by themselves amend this Addendum unless they satisfy the contractual amendment requirements.'
      ]),
      clause(16, 'Electronic Execution, Counterparts and Evidence', commonElectronicExecutionParagraphs()),
      clause(17, 'Stamp Duty, Registration, Costs and Regulatory Formalities', [
        'The Parties shall comply with stamp-duty, e-stamping, registration and other documentary formalities applicable to this Addendum having regard to its nature, value, place of execution and the law in force in the relevant jurisdiction. No fixed stamp-duty amount is assumed by this document.',
        'Unless otherwise agreed in writing or required by law, each Party shall bear its own legal, advisory and execution costs. The Marketplace may require evidence of applicable stamping or other formalities before treating the instrument as operationally complete.'
      ]),
      clause(18, 'Governing Law, Dispute Resolution, Severability and Entire Addendum', [
        ...commonDisputeParagraphs(),
        'If any provision of this Addendum is held invalid or unenforceable, it shall be severed or read down to the minimum extent necessary without affecting the remaining provisions. This Addendum, together with the Original Agreement and documents expressly incorporated by reference, constitutes the complete agreement on the subject matter amended hereby.'
      ])
    ]
  };
}

function renewal(input: BuildInput) {
  const parent = clean(input.parentInstrumentNumber, 'the immediately preceding marketplace seller agreement/instrument');
  const effective = clean(input.effectiveFrom, 'the renewal commencement date stated in the schedule');
  const end = clean(input.effectiveTo, 'the renewal expiry date stated in the schedule');
  const commercial = termsSummary(input.terms);
  const reason = clean(input.changeReason, 'continuation of the approved seller relationship for a further contractual term');

  const recitals = [
    `A. The Parties have an existing marketplace seller relationship most recently governed by ${parent}.`,
    `B. The Parties wish to renew and continue that relationship for the period commencing ${effective} and ending ${end}, subject to the updated commercial schedule and this Renewal Agreement.`,
    `C. The renewal is being entered into in the context of ${reason}.`,
    'D. The Parties intend the contractual lineage, accrued rights, historical transactions and surviving obligations under the prior instruments to remain preserved while the renewed term is governed by this Renewal Agreement.'
  ];

  return {
    title: input.instrumentTitle || 'Renewal Agreement for Marketplace Seller Relationship',
    subtitle: `Renewal and continuation of ${parent}`,
    recitals,
    clauses: [
      clause(1, 'Background, Recitals and Contractual Lineage', [
        ...recitals,
        'The recitals form an integral part of this Renewal Agreement. The prior agreements, addenda, commercial schedules and execution records referenced in the relationship history remain part of the permanent contractual record.'
      ]),
      clause(2, 'Definitions and Interpretation', [
        '“Renewal Agreement” means this instrument together with its commercial schedule, annexures and execution record. “Prior Agreement” means the immediately preceding operative seller agreement together with valid addenda and amendments. “Renewal Term” means the period expressly stated in this instrument.',
        'Unless otherwise defined, terms used in this Renewal Agreement have the meanings given to them in the Prior Agreement. References to applicable law include amendments, subordinate legislation, regulatory directions and binding judicial interpretations in force from time to time.'
      ]),
      clause(3, 'Renewal Grant and Renewal Term', [
        `Subject to execution, required approvals and continuing eligibility, the marketplace seller relationship is renewed for the period from ${effective} to ${end}.`,
        'Renewal does not confer any perpetual right, minimum volume commitment, exclusivity or guaranteed listing visibility unless expressly stated in the commercial schedule. Any further continuation beyond the Renewal Term requires a subsequent valid renewal or other written instrument.'
      ]),
      clause(4, 'Continuity of Relationship and No Unintended Novation', [
        'The Renewal Agreement continues the existing contractual relationship and does not erase, discharge or novate historical obligations, claims, settlements, indemnities, customer liabilities, tax liabilities or audit rights unless expressly stated.',
        'References in operational policies or historical records to the prior seller agreement shall, where the context permits, be read as references to the continuing contractual relationship as renewed.'
      ]),
      clause(5, 'Renewed Commercial Schedule and Supersession', [
        `For the Renewal Term, the applicable commercial schedule shall include ${commercial}.`,
        'The renewed commercial schedule supersedes earlier commercial terms only for periods falling within the Renewal Term and only to the extent of an inconsistency. Historical settlements remain governed by the terms applicable to the relevant historical transaction or event.',
        'The Marketplace shall not infer a waiver or concession from a blank or omitted commercial field. Any special concession, rebate, marketing contribution, logistics allocation, reserve or payment exception must be expressly recorded.'
      ]),
      clause(6, 'Conditions Precedent and Continuing Seller Eligibility', [
        'Renewal is conditional upon the Seller maintaining valid KYC, tax registrations, banking information, legal capacity, authority, licences and category-specific approvals required for its business and products.',
        'The Marketplace may require updated documents, beneficial ownership information, bank verification, GST/PAN/CIN or equivalent entity verification, product certificates or additional due diligence before or during the Renewal Term.'
      ]),
      clause(7, 'Seller Representations and Warranties on Renewal', [
        'The Seller repeats and reaffirms, as of the renewal execution date and throughout the Renewal Term, its representations regarding lawful existence, authority, authenticity of documents, legal sourcing, product rights, tax compliance, product safety and accuracy of all information supplied to the Marketplace.',
        'The Seller shall immediately notify the Marketplace of insolvency, material litigation, regulatory action, change of control, cancellation or suspension of material registrations, bank-account changes or any circumstance reasonably likely to affect performance or customer protection.'
      ]),
      clause(8, 'Listings, Pricing, Product Information and Regulatory Disclosures', [
        'The Seller remains responsible for accurate listings, prices, specifications, dimensions, materials, country-of-origin declarations where applicable, labelling, warnings, warranties, care instructions and all mandatory consumer-facing disclosures.',
        'The Marketplace may edit presentation, merchandising placement and catalogue structure but shall not knowingly alter a material product fact in a misleading manner.'
      ]),
      clause(9, 'Order Fulfilment, Packaging, Dispatch and Service Levels', [
        'The Seller shall maintain adequate inventory, fulfil accepted orders within prescribed service levels, use transit-worthy packaging and provide accurate shipment status. False ready-to-ship or dispatch confirmations constitute material operational non-compliance.',
        'Repeated avoidable cancellations, late dispatch, packaging failure or inventory mismatch may result in reduced visibility, reserves, corrective action, suspension or termination in accordance with the contract.'
      ]),
      clause(10, 'Returns, Refunds, Replacements and Customer Resolution', [
        'The Seller shall honour legitimate return, replacement, refund, recall and customer-remedy obligations arising from defective, damaged, unsafe, counterfeit, materially misdescribed or otherwise non-compliant products.',
        'Where customer trust, safety, legal compliance or operational urgency requires, the Marketplace may determine and implement a customer-facing remedy and allocate the resulting cost in accordance with the contract and applicable law.'
      ]),
      clause(11, 'Payments, Reconciliation, Taxes, TCS and Set-Off', [
        'Payouts remain subject to the renewed commercial schedule, reconciliation, commissions, platform charges, taxes, statutory deductions, TCS where applicable, refunds, reversals, chargebacks, reserves, claims and valid set-offs.',
        'The Seller is responsible for correct GST classification, invoice issuance, tax rates and tax reporting applicable to its supplies. Each Party shall discharge statutory obligations imposed upon it by law and shall reasonably cooperate in reconciliation.'
      ]),
      clause(12, 'Quality, Audit, Compliance Monitoring and Corrective Action', [
        'The Marketplace may conduct quality review, sample inspection, mystery purchase, returns analysis, customer-complaint analysis, documentary audit and compliance review throughout the Renewal Term.',
        'The Seller shall preserve and produce invoices, source records, certificates, test reports, batch records where applicable, stock records, complaint records and other evidence reasonably necessary to demonstrate compliance.'
      ]),
      clause(13, 'Intellectual Property, Content Licence, Data and Confidentiality', [
        'The content licence, intellectual-property warranties, confidentiality duties and marketplace/customer-data restrictions in the contractual relationship continue throughout the Renewal Term.',
        'The Seller shall not use marketplace-derived customer data for unauthorised solicitation, profiling, resale or off-platform diversion. Data may be processed only for permitted fulfilment, service, compliance and other lawful purposes.'
      ]),
      clause(14, 'Customer Relationship Protection and Lawful Non-Circumvention', [
        'The Seller shall not deliberately divert marketplace-originated transactions off-platform for the purpose of defeating agreed commissions, platform controls or customer protections.',
        'Nothing in this Renewal Agreement imposes a post-termination restraint on lawful trade beyond the extent enforceable under Indian law. Confidentiality, protection of proprietary information, lawful non-solicitation and transaction-specific non-circumvention obligations shall be interpreted only to the extent legally enforceable.'
      ]),
      clause(15, 'Indemnity, Product Liability and Limitation of Liability', [
        'The Seller shall indemnify the Marketplace and protected persons against third-party claims, regulatory exposure, customer claims, losses and reasonable costs arising from Seller breach, defective or unsafe products, infringement, tax default, false declarations, counterfeit goods or unlawful conduct, subject to applicable law and the underlying agreement.',
        'Any contractual limitation or exclusion of liability in the Prior Agreement shall continue during the Renewal Term unless expressly modified. No provision excludes liability to the extent such exclusion is prohibited by law.'
      ]),
      clause(16, 'Suspension, Corrective Action and Early Termination During Renewal', [
        'The Marketplace may exercise contractual suspension, delisting, payout-hold, corrective-action or termination rights during the Renewal Term where the Seller breaches the contract, law or material platform standards, or creates significant customer, safety, authenticity, fraud, regulatory or reputational risk.',
        'Termination before expiry shall not extinguish accrued rights, completed transactions, pending customer remedies, recovery rights or survival obligations.'
      ]),
      clause(17, 'Historical Transactions, Accrued Rights and Prior Claims', [
        'Renewal does not reopen, waive or settle historical disputes, debit notes, reconciliations, chargebacks, claims or audit findings unless expressly stated. Such matters may continue to be enforced or resolved in accordance with the applicable contractual and legal framework.',
        'Any prior breach that remains uncured at renewal may be treated in accordance with the continuing contract unless expressly waived in writing by an authorised representative.'
      ]),
      clause(18, 'Notices, Contract Records and Further Assurances', [
        'The Parties shall maintain current notice details and shall use the agreed notice mechanism for formal contractual communications. The Marketplace may retain the entire contractual lineage, execution logs and supporting records as part of the permanent seller relationship file subject to applicable law.',
        'Each Party shall execute further documents and perform reasonable acts necessary to give effect to the Renewal Agreement and any applicable statutory formalities.'
      ]),
      clause(19, 'Electronic Execution, Counterparts, Stamp Duty and Formalities', [
        ...commonElectronicExecutionParagraphs(),
        'The Parties shall comply with stamp-duty, e-stamping, registration and other formalities applicable to this Renewal Agreement in the relevant jurisdiction. No fixed stamp-duty amount is assumed by the document and the Marketplace may require proof of compliance before activation.'
      ]),
      clause(20, 'Governing Law, Dispute Resolution, Severability and Entire Renewal', [
        ...commonDisputeParagraphs(),
        'If any term is invalid or unenforceable, it shall be read down or severed to the minimum extent required without invalidating the remainder. This Renewal Agreement, together with the Prior Agreement, valid addenda, schedules and documents expressly incorporated by reference, records the complete agreement governing the renewed relationship.'
      ])
    ]
  };
}

function termination(input: BuildInput) {
  const parent = clean(input.parentInstrumentNumber, 'the operative marketplace seller agreement/instrument');
  const effective = clean(input.effectiveFrom, 'the termination effective date stated in the schedule');
  const reason = clean(input.changeReason, 'the termination basis recorded in the relationship record');

  const recitals = [
    `A. The Parties are parties to ${parent} and the related contractual lineage governing the Seller’s participation on the NEEJEE marketplace.`,
    `B. The relationship is to be terminated with effect from ${effective}.`,
    `C. The recorded termination context is: ${reason}.`,
    'D. The Parties intend this Termination Agreement to record the consequences of termination, preserve accrued rights and liabilities, and establish an orderly post-termination process for pending transactions, customer obligations, reconciliations, records and surviving covenants.'
  ];

  return {
    title: input.instrumentTitle || 'Termination Agreement for Marketplace Seller Relationship',
    subtitle: `Termination of the contractual relationship governed by ${parent}`,
    recitals,
    clauses: [
      clause(1, 'Background, Recitals and Purpose', [
        ...recitals,
        'The recitals form part of this Termination Agreement. Unless expressly released or settled herein, termination shall not extinguish any accrued, contingent or surviving right or liability arising before the Termination Effective Date.'
      ]),
      clause(2, 'Definitions and Interpretation', [
        '“Termination Agreement” means this instrument together with its schedules, annexures, settlement records and execution record. “Underlying Agreement” means the contractual lineage identified above. “Termination Effective Date” means the date on which the contractual relationship ceases prospectively, subject to surviving obligations.',
        'References to termination include the operational disabling of marketplace rights where applicable, but do not imply that historical records, audit rights, payment rights, customer remedies or legal claims cease to exist.'
      ]),
      clause(3, 'Termination Effective Date and Prospective Effect', [
        `The seller relationship shall terminate prospectively with effect from ${effective}, subject to the transition and survival provisions of this Termination Agreement.`,
        'From the Termination Effective Date, neither Party shall represent that the Seller remains an active NEEJEE seller except to the limited extent necessary to complete pending orders, customer service, returns, reconciliation, legal compliance or archival disclosures.'
      ]),
      clause(4, 'Cessation of New Listings, Orders and Marketplace Access', [
        'The Marketplace may disable new listings, new order acceptance, promotional participation, seller dashboard functions, catalogue editing and other marketplace privileges on or before the Termination Effective Date to implement an orderly termination.',
        'Access necessary to complete prescribed wind-down tasks may be restricted, read-only, time-limited or otherwise controlled. No continued access right survives except as expressly granted for transition.'
      ]),
      clause(5, 'Pending Orders and Fulfilment Obligations', [
        'Orders accepted before the Termination Effective Date shall be fulfilled in accordance with the applicable contractual standards unless the Marketplace cancels or redirects fulfilment to protect customers, comply with law or address inventory, safety or fraud concerns.',
        'The Seller remains responsible for accurate dispatch, packaging, delivery support, proof of fulfilment and customer communications relating to pending orders.'
      ]),
      clause(6, 'Returns, Refunds, Replacements, Warranty and Customer Claims', [
        'Termination does not end the Seller’s responsibility for returns, refunds, replacements, warranties, defects, misdescription, counterfeit allegations, recalls or other customer claims attributable to products sold before termination.',
        'The Marketplace may continue to process customer remedies after termination and may recover Seller-attributable amounts, including forward and reverse logistics, refunds, chargebacks and reasonable complaint-handling costs, in accordance with the contract and applicable law.'
      ]),
      clause(7, 'Final Reconciliation and Settlement Statement', [
        'The Marketplace shall be entitled to conduct a final commercial reconciliation covering orders, commissions, platform fees, logistics, taxes, TCS or other statutory deductions, refunds, reversals, customer claims, chargebacks, promotional adjustments, reserves, credits, debit notes and other contractual entries.',
        'Any provisional settlement statement remains subject to correction for subsequently discovered returns, chargebacks, tax adjustments, fraud events, product claims or other matters that by their nature arise after the Termination Effective Date.'
      ]),
      clause(8, 'Reserves, Holdbacks, Set-Off and Recovery Rights', [
        'The Marketplace may retain a reasonable contractual reserve or holdback where pending returns, customer claims, chargebacks, warranties, tax exposures, suspected fraud, unresolved reconciliation or other contingent liabilities remain open, subject to the underlying agreement and applicable law.',
        'The Marketplace may set off amounts due from the Seller against sums otherwise payable to the Seller. Termination shall not prevent either Party from recovering a balance lawfully due after reconciliation.'
      ]),
      clause(9, 'Taxes, TCS, Invoices and Statutory Reconciliation', [
        'Each Party remains responsible for statutory tax obligations imposed upon it. The Seller shall issue or correct tax invoices, credit notes and other statutory documents required for transactions completed before termination.',
        'The Parties shall reasonably cooperate in GST, TCS and other tax reconciliations, including corrections required after the Termination Effective Date. Termination shall not be treated as cancelling statutory record-keeping obligations.'
      ]),
      clause(10, 'Inventory, Samples, Consigned Goods and Physical Property', [
        'Where any inventory, samples, packaging material, marketing collateral, equipment or other property of one Party is held by the other, the Parties shall identify, reconcile and return or otherwise dispose of such property in accordance with written instructions, subject to lawful lien, set-off, safety, recall or evidentiary requirements.',
        'Risk, logistics cost and responsibility for return or disposal shall be allocated in accordance with the underlying agreement or a written wind-down schedule.'
      ]),
      clause(11, 'Customer Communications and Brand Protection', [
        'Customer communications concerning pending orders, returns, complaints, warranty, recall or refund matters shall be accurate, coordinated where reasonably necessary and shall not misrepresent the status of the seller relationship.',
        'Neither Party shall use the other Party’s name, marks or branding after termination except for legally required references, historical records, customer-service communications or other uses expressly permitted in writing or by law.'
      ]),
      clause(12, 'Data Access, Return, Retention and Deletion', [
        'Marketplace-derived customer data may be retained and used by the Seller only to the extent necessary for lawful completion of pending orders, after-sales obligations, tax compliance, dispute handling or other legally permitted purposes. It shall not be used for unauthorised marketing or off-platform solicitation.',
        'Each Party may retain records that it is legally required or reasonably entitled to preserve for tax, audit, fraud prevention, legal claims, regulatory compliance, evidence or archival integrity. Subject to such retention rights, data shall be deleted, anonymised or returned in accordance with applicable law and contractual policy.'
      ]),
      clause(13, 'Confidentiality and Protected Information', [
        'Confidentiality obligations that by their nature are intended to survive shall continue after termination for the period stated in the underlying agreement or, if no period is stated, for so long as the information remains confidential and legally protectable.',
        'Trade secrets, security information, non-public commercial information, customer information and proprietary operational data shall continue to receive the protection available under contract and law.'
      ]),
      clause(14, 'Intellectual Property and Content Licence Cessation', [
        'Any licence granted solely for active marketplace listing and promotion shall cease prospectively when no longer required for pending transactions or lawful archival use, subject to any survival language in the underlying agreement.',
        'The Marketplace may retain historical copies of listings, communications and contractual records for audit, dispute, regulatory and evidentiary purposes without representing that the Seller remains active.'
      ]),
      clause(15, 'Product Liability, Safety Events and Recall Cooperation', [
        'Termination does not limit liability for products sold before termination. The Seller shall continue to cooperate in product-safety investigations, stop-sale directions, recalls, regulator enquiries, customer notifications and corrective actions concerning its products.',
        'Reasonable Seller-attributable costs of recalls, safety events, counterfeit findings, defects or regulatory non-compliance remain recoverable to the extent provided by contract or law.'
      ]),
      clause(16, 'Records, Audit Rights and Evidence Preservation', [
        'The Seller shall preserve invoices, sourcing records, tax records, product certificates, fulfilment evidence, complaint records, return records and other documents for the period required by law and any valid contractual retention obligation.',
        'Audit and inspection rights necessary to verify historical transactions, settlements, claims, authenticity, compliance or tax matters survive termination to the extent reasonably necessary and legally enforceable.'
      ]),
      clause(17, 'Surviving Provisions and Accrued Rights', [
        'Without limitation, provisions concerning payment and reconciliation, customer claims, returns, warranties, product liability, indemnity, confidentiality, data restrictions, intellectual property, audit, evidence preservation, tax, dispute resolution and any provision intended by its nature to survive shall continue after termination.',
        'Termination shall not affect rights, remedies, obligations or liabilities accrued before the Termination Effective Date, including rights arising from a breach occurring before termination even if discovered later.'
      ]),
      clause(18, 'No Admission, No Waiver and No Automatic Release', [
        'Unless expressly stated, execution of this Termination Agreement is not an admission of liability or wrongdoing by either Party and does not waive any disputed position.',
        'No final release, accord and satisfaction or settlement of monetary or legal claims shall arise merely from termination. A release shall exist only to the extent expressly stated in a separately identifiable settlement or release provision executed by authorised representatives.'
      ]),
      clause(19, 'Post-Termination Cooperation and Further Assurances', [
        'The Parties shall reasonably cooperate after termination to close pending orders, customer matters, tax reconciliations, recalls, disputes, regulatory requests and return of property.',
        'Each Party shall execute further documents and provide confirmations reasonably necessary to give practical and legal effect to this Termination Agreement and the completion of the wind-down.'
      ]),
      clause(20, 'Electronic Execution, Counterparts, Stamp Duty and Formalities', [
        ...commonElectronicExecutionParagraphs(),
        'The Parties shall comply with applicable stamp-duty, e-stamping, registration and other documentary formalities having regard to the nature and place of execution of this Termination Agreement. No fixed stamp-duty amount is assumed by this document.'
      ]),
      clause(21, 'Governing Law and Dispute Resolution', commonDisputeParagraphs()),
      clause(22, 'Entire Termination Instrument, Conflict, Severability and Continuing Record', [
        'This Termination Agreement governs the consequences of termination and shall be read with the underlying contractual lineage. If there is a conflict, this Termination Agreement prevails only in relation to termination and wind-down matters expressly addressed herein.',
        'If any provision is invalid or unenforceable, it shall be read down or severed to the minimum extent necessary without affecting the remaining provisions. The historical agreements, this Termination Agreement and associated execution records shall remain preserved as the permanent contractual history of the seller relationship.'
      ])
    ]
  };
}

export function buildSellerCommercialInstrumentLegalContent(input: BuildInput) {
  if (input.type === 'ADDENDUM') return addendum(input);
  if (input.type === 'RENEWAL') return renewal(input);
  if (input.type === 'TERMINATION') return termination(input);
  return null;
}
