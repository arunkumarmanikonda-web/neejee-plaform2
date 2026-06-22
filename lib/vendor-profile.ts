// Vendor profile field policy: which fields require admin approval on edit,
// which can be updated directly, and which documents support which changes.

// Fields that route through VendorChangeRequest on edit (not first save).
// "Sensitive" = anything that affects money flow, taxation, or legal identity.
export const APPROVAL_GATED_FIELDS = [
  'legalName',
  'gstin',
  'pan',
  'msmeNumber',
  // Bank
  'bankAccountName',
  'bankAccountNumber',
  'bankIfsc',
  'bankName',
  // Business address (GST-linked)
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'pincode',
  'country',
] as const;

// Fields the vendor can change directly without approval.
export const DIRECT_EDIT_FIELDS = [
  'displayName',
  'contactPerson',
  'contactPhone',
  // contactEmail is locked: it's the login identifier (admin must change)
] as const;

export type ApprovalGatedField = typeof APPROVAL_GATED_FIELDS[number];

// Map each gated field to the doc type(s) that can justify a change.
// At least one matching doc must be attached to the change request.
export const FIELD_TO_REQUIRED_DOC_TYPES: Record<ApprovalGatedField, string[]> = {
  legalName:         ['GST_CERTIFICATE', 'PAN_CARD', 'VENDOR_AGREEMENT'],
  gstin:             ['GST_CERTIFICATE'],
  pan:               ['PAN_CARD'],
  msmeNumber:        ['MSME_CERTIFICATE'],
  bankAccountName:   ['CANCELLED_CHEQUE', 'BANK_STATEMENT'],
  bankAccountNumber: ['CANCELLED_CHEQUE', 'BANK_STATEMENT'],
  bankIfsc:          ['CANCELLED_CHEQUE', 'BANK_STATEMENT'],
  bankName:          ['CANCELLED_CHEQUE', 'BANK_STATEMENT'],
  addressLine1:      ['ADDRESS_PROOF', 'GST_CERTIFICATE'],
  addressLine2:      ['ADDRESS_PROOF', 'GST_CERTIFICATE'],
  city:              ['ADDRESS_PROOF', 'GST_CERTIFICATE'],
  state:             ['ADDRESS_PROOF', 'GST_CERTIFICATE'],
  pincode:           ['ADDRESS_PROOF', 'GST_CERTIFICATE'],
  country:           ['ADDRESS_PROOF', 'GST_CERTIFICATE'],
};

// Determine if a value is "empty" — null, undefined, or empty string.
// Used to distinguish first-time-fill (no approval needed) from edits.
export function isEmptyValue(v: any): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

// Compute a profile completion percentage 0-100.
// Buckets (weights):
//   Identity (legalName, gstin, pan) — 30%
//   Address (line1, city, state, pincode) — 20%
//   Bank (4 fields) — 25%
//   Contact (person, phone) — 10%
//   Docs (PAN + GST + cancelled cheque, all APPROVED) — 15%
export function computeProfileCompletion(vendor: any, approvedDocTypes: Set<string>): number {
  let score = 0;
  // Identity
  if (!isEmptyValue(vendor.legalName)) score += 10;
  if (!isEmptyValue(vendor.gstin))     score += 10;
  if (!isEmptyValue(vendor.pan))       score += 10;
  // Address
  if (!isEmptyValue(vendor.addressLine1)) score += 5;
  if (!isEmptyValue(vendor.city))         score += 5;
  if (!isEmptyValue(vendor.state))        score += 5;
  if (!isEmptyValue(vendor.pincode))      score += 5;
  // Bank
  if (!isEmptyValue(vendor.bankAccountName))   score += 6;
  if (!isEmptyValue(vendor.bankAccountNumber)) score += 7;
  if (!isEmptyValue(vendor.bankIfsc))          score += 6;
  if (!isEmptyValue(vendor.bankName))          score += 6;
  // Contact
  if (!isEmptyValue(vendor.contactPerson)) score += 5;
  if (!isEmptyValue(vendor.contactPhone))  score += 5;
  // Docs (approved only)
  if (approvedDocTypes.has('PAN_CARD'))         score += 5;
  if (approvedDocTypes.has('GST_CERTIFICATE'))  score += 5;
  if (approvedDocTypes.has('CANCELLED_CHEQUE')) score += 5;
  return Math.min(100, score);
}

// What's missing — used to render the checklist on the dashboard.
export function profileChecklist(vendor: any, approvedDocTypes: Set<string>): Array<{
  key: string; label: string; done: boolean; href: string;
}> {
  return [
    { key: 'identity',      label: 'Add GSTIN, PAN, legal name', href: '/vendor/profile', done: !isEmptyValue(vendor.gstin) && !isEmptyValue(vendor.pan) && !isEmptyValue(vendor.legalName) },
    { key: 'address',       label: 'Add registered business address', href: '/vendor/profile', done: !isEmptyValue(vendor.addressLine1) && !isEmptyValue(vendor.city) && !isEmptyValue(vendor.pincode) },
    { key: 'contact',       label: 'Add contact person & phone', href: '/vendor/profile', done: !isEmptyValue(vendor.contactPerson) && !isEmptyValue(vendor.contactPhone) },
    { key: 'bank',          label: 'Add bank account for payouts', href: '/vendor/bank',    done: !isEmptyValue(vendor.bankAccountNumber) && !isEmptyValue(vendor.bankIfsc) },
    { key: 'docs-pan',      label: 'Upload PAN card', href: '/vendor/documents', done: approvedDocTypes.has('PAN_CARD') },
    { key: 'docs-gst',      label: 'Upload GST certificate', href: '/vendor/documents', done: approvedDocTypes.has('GST_CERTIFICATE') },
    { key: 'docs-cheque',   label: 'Upload cancelled cheque', href: '/vendor/documents', done: approvedDocTypes.has('CANCELLED_CHEQUE') },
  ];
}

// Human-readable doc type labels for the UI.
export const DOC_TYPE_LABELS: Record<string, string> = {
  PAN_CARD:          'PAN card',
  GST_CERTIFICATE:   'GST certificate',
  MSME_CERTIFICATE:  'MSME / Udyam certificate',
  CANCELLED_CHEQUE:  'Cancelled cheque',
  BANK_STATEMENT:    'Bank statement (last 3 months)',
  ADDRESS_PROOF:     'Address proof',
  AADHAAR_SIGNATORY: 'Aadhaar of authorised signatory',
  SIGNATORY_PHOTO:   'Photo of signatory',
  VENDOR_AGREEMENT:  'Signed vendor agreement',
  INVOICE:           'Invoice',
  GRN_DISPUTE:       'GRN / Quantity dispute proof',
  OTHER:             'Other',
};
