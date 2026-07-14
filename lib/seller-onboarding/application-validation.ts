import type { UploadedApplicationDocument } from '@/lib/seller-onboarding/document-intel';
import {
  evaluateSellerAutoKyc,
  gstMatchesPan,
} from '@/lib/seller-onboarding/validation';

type ProviderResult = {
  available: boolean;
  ok: boolean | null;
  data: any;
  error?: string | null;
};

function normalizeCompare(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesNormalized(haystack: unknown, needle: unknown): boolean {
  const h = normalizeCompare(haystack);
  const n = normalizeCompare(needle);
  if (!h || !n) return false;
  return h.includes(n) || n.includes(h);
}

async function callOptionalProvider(envName: string, payload: any): Promise<ProviderResult> {
  const url = process.env[envName];
  if (!url) return { available: false, ok: null, data: null };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    return {
      available: true,
      ok: res.ok,
      data,
      error: res.ok ? null : (data?.error || `Provider call failed: ${res.status}`),
    };
  } catch (e: any) {
    return {
      available: true,
      ok: false,
      data: null,
      error: e?.message || 'Provider call failed',
    };
  }
}

export async function validateSellerApplicationPackage(input: {
  businessName: string;
  pan: string;
  gstin?: string | null;
  cin?: string | null;
  msmeNumber?: string | null;
  bankAccount: string;
  ifsc: string;
  documents: UploadedApplicationDocument[];
}) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const manual = {
    businessName: String(input.businessName || '').trim(),
    pan: String(input.pan || '').trim().toUpperCase(),
    gstin: String(input.gstin || '').trim().toUpperCase(),
    cin: String(input.cin || '').trim().toUpperCase(),
    msmeNumber: String(input.msmeNumber || '').trim().toUpperCase(),
    bankAccount: String(input.bankAccount || '').trim(),
    ifsc: String(input.ifsc || '').trim().toUpperCase(),
  };

  const baseChecks = evaluateSellerAutoKyc({
    pan: manual.pan,
    gstin: manual.gstin || null,
    cin: manual.cin || null,
    ifsc: manual.ifsc,
    bankAccount: manual.bankAccount,
    msmeNumber: manual.msmeNumber || null,
  });

  errors.push(...baseChecks.errors);

  const docs = Array.isArray(input.documents) ? input.documents : [];
  const firstDoc = (docType: string) => docs.find((doc) => doc.docType === docType);
  const firstDocBy = (predicate: (doc: UploadedApplicationDocument) => boolean) => docs.find(predicate);

  const panDoc = firstDoc('PAN_CARD');
  const gstDoc = firstDoc('GST_CERTIFICATE');
  const msmeDoc = firstDoc('MSME_CERTIFICATE');
  const cinDoc =
    firstDocBy((doc) => doc.docType === 'CERTIFICATION' && normalizeCompare(doc.title).includes('CIN'))
    || firstDoc('CERTIFICATION');
  const chequeDoc = firstDoc('CANCELLED_CHEQUE');
  const bankDoc = firstDoc('BANK_STATEMENT');

  if (!panDoc) errors.push('PAN card upload is required');
  if (!chequeDoc) errors.push('Cancelled cheque upload is required');
  if (!bankDoc) errors.push('Bank statement / CSV / screenshot upload is required');
  if (manual.gstin && !gstDoc) errors.push('GST certificate upload is required when GSTIN is entered');
  if (manual.msmeNumber && !msmeDoc) errors.push('MSME certificate upload is required when MSME number is entered');
  if (manual.cin && !cinDoc) errors.push('CIN certificate upload is required when CIN is entered');

  const extracted = {
    pan: panDoc?.extractedFields?.pans?.[0] || null,
    gstin: gstDoc?.extractedFields?.gstins?.[0] || null,
    msmeNumber: msmeDoc?.extractedFields?.msmeNumbers?.[0] || null,
    cin: cinDoc?.extractedFields?.cins?.[0] || null,
    chequeIfsc: chequeDoc?.extractedFields?.ifscs?.[0] || null,
    chequeAccounts: chequeDoc?.extractedFields?.bankAccounts || [],
    bankIfsc: bankDoc?.extractedFields?.ifscs?.[0] || null,
    bankAccounts: bankDoc?.extractedFields?.bankAccounts || [],
  };

  if (manual.pan && extracted.pan && manual.pan !== extracted.pan) {
    errors.push('PAN mismatch between manual entry and uploaded PAN card');
  }

  if (manual.gstin && extracted.gstin && manual.gstin !== extracted.gstin) {
    errors.push('GSTIN mismatch between manual entry and uploaded GST certificate');
  }

  if (manual.gstin && manual.pan && !gstMatchesPan(manual.gstin, manual.pan)) {
    errors.push('Manual GSTIN and PAN do not match each other');
  }

  if (manual.gstin && gstDoc && !includesNormalized(gstDoc.extractedTextPreview, manual.businessName)) {
    warnings.push('Business name not confidently found in GST certificate OCR/text');
  }

  if (manual.msmeNumber && extracted.msmeNumber && manual.msmeNumber !== extracted.msmeNumber) {
    errors.push('MSME number mismatch between manual entry and uploaded MSME certificate');
  }

  if (manual.cin && extracted.cin && manual.cin !== extracted.cin) {
    errors.push('CIN mismatch between manual entry and uploaded CIN certificate');
  }

  const allAccountCandidates = Array.from(
    new Set([...(extracted.chequeAccounts || []), ...(extracted.bankAccounts || [])]),
  );

  const accountMatched = manual.bankAccount ? allAccountCandidates.includes(manual.bankAccount) : false;
  const ifscMatched = [extracted.chequeIfsc, extracted.bankIfsc]
    .filter(Boolean)
    .includes(manual.ifsc);

  if (!accountMatched) {
    errors.push('Bank account does not match uploaded cancelled cheque / statement');
  }

  if (!ifscMatched) {
    errors.push('IFSC does not match uploaded cancelled cheque / statement');
  }

  const provider = {
    gst: manual.gstin
      ? await callOptionalProvider('GST_VERIFY_API_URL', {
          gstin: manual.gstin,
          businessName: manual.businessName,
        })
      : { available: false, ok: null, data: null },
    pan: manual.pan
      ? await callOptionalProvider('PAN_VERIFY_API_URL', {
          pan: manual.pan,
          businessName: manual.businessName,
        })
      : { available: false, ok: null, data: null },
    cin: manual.cin
      ? await callOptionalProvider('CIN_VERIFY_API_URL', {
          cin: manual.cin,
          businessName: manual.businessName,
        })
      : { available: false, ok: null, data: null },
    bank: manual.bankAccount
      ? await callOptionalProvider('BANK_VERIFY_API_URL', {
          bankAccount: manual.bankAccount,
          ifsc: manual.ifsc,
          businessName: manual.businessName,
        })
      : { available: false, ok: null, data: null },
  };

  if (provider.gst.available && provider.gst.ok && provider.gst.data) {
    const remoteGstin = String(
      provider.gst.data.gstin || provider.gst.data.gstNumber || '',
    ).toUpperCase();
    const remoteName =
      provider.gst.data.legalName || provider.gst.data.tradeName || provider.gst.data.name || '';

    if (remoteGstin && manual.gstin && remoteGstin !== manual.gstin) {
      errors.push('GST provider response does not match entered GSTIN');
    }

    if (remoteName && !includesNormalized(remoteName, manual.businessName)) {
      errors.push('GST provider legal/trade name does not match manual business name');
    }
  }

  if (provider.pan.available && provider.pan.ok && provider.pan.data) {
    const remotePan = String(provider.pan.data.pan || '').toUpperCase();
    const remoteName = provider.pan.data.name || provider.pan.data.legalName || '';

    if (remotePan && manual.pan && remotePan !== manual.pan) {
      errors.push('PAN provider response does not match entered PAN');
    }

    if (remoteName && !includesNormalized(remoteName, manual.businessName)) {
      warnings.push('PAN provider name does not closely match manual business name');
    }
  }

  if (provider.cin.available && provider.cin.ok && provider.cin.data) {
    const remoteCin = String(provider.cin.data.cin || '').toUpperCase();
    const remoteName = provider.cin.data.companyName || provider.cin.data.name || '';

    if (remoteCin && manual.cin && remoteCin !== manual.cin) {
      errors.push('CIN provider response does not match entered CIN');
    }

    if (remoteName && !includesNormalized(remoteName, manual.businessName)) {
      errors.push('CIN provider company name does not match manual business name');
    }
  }

  if (provider.bank.available && provider.bank.ok && provider.bank.data) {
    const remoteIfsc = String(provider.bank.data.ifsc || '').toUpperCase();
    const remoteLast4 = String(
      provider.bank.data.accountLast4 || provider.bank.data.last4 || '',
    );

    if (remoteIfsc && manual.ifsc && remoteIfsc !== manual.ifsc) {
      errors.push('Bank provider response does not match entered IFSC');
    }

    if (remoteLast4 && manual.bankAccount && !manual.bankAccount.endsWith(remoteLast4)) {
      errors.push('Bank provider response does not match entered account number');
    }
  }

  return {
    overallPass: errors.length === 0,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
    checks: baseChecks.checks,
    extracted,
    documentsPresent: {
      panCard: !!panDoc,
      gstCertificate: !!gstDoc,
      msmeCertificate: !!msmeDoc,
      cinCertificate: !!cinDoc,
      cancelledCheque: !!chequeDoc,
      bankStatement: !!bankDoc,
    },
    provider,
  };
}