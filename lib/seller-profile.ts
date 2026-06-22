// Seller profile completion helpers.
// Returns a 0–100 completion percentage and a checklist of remaining items.

type SellerLite = {
  businessName?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  story?: string | null;
  logoImage?: string | null;
  coverImage?: string | null;
  portfolio?: string[];
  pan?: string | null;
  gstin?: string | null;
  bankAccount?: string | null;
  ifsc?: string | null;
  bankName?: string | null;
  region?: string | null;
  craft?: string | null;
};

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  // Where to go to fix it
  href: string;
};

/** Returns a 0–100 completion %. Identical buckets for everyone. */
export function computeSellerCompletion(seller: SellerLite, approvedDocTypes: Set<string>): number {
  const checks: boolean[] = [
    !!seller.businessName,
    !!seller.contactName,
    !!seller.email,
    !!seller.phone,
    !!seller.story && seller.story.length > 50,
    !!seller.logoImage,
    !!seller.craft || !!seller.region,
    (seller.portfolio?.length || 0) >= 3,
    !!seller.pan,
    !!seller.gstin,
    !!seller.bankAccount && !!seller.ifsc,
    approvedDocTypes.has('PAN_CARD'),
    approvedDocTypes.has('GST_CERTIFICATE') || approvedDocTypes.has('MSME_CERTIFICATE'),
    approvedDocTypes.has('CANCELLED_CHEQUE') || approvedDocTypes.has('BANK_STATEMENT'),
    approvedDocTypes.has('SELLER_AGREEMENT'),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

/** Detailed checklist for the dashboard "things to do" widget. */
export function sellerChecklist(seller: SellerLite, approvedDocTypes: Set<string>): ChecklistItem[] {
  return [
    { key: 'story',      label: 'Tell your craft story',           done: !!seller.story && seller.story.length > 50, href: '/seller/profile' },
    { key: 'logo',       label: 'Upload your studio logo',          done: !!seller.logoImage,                         href: '/seller/profile' },
    { key: 'portfolio',  label: 'Add at least 3 portfolio images',  done: (seller.portfolio?.length || 0) >= 3,       href: '/seller/profile' },
    { key: 'pan',        label: 'Enter PAN number',                 done: !!seller.pan,                               href: '/seller/profile' },
    { key: 'gstin',      label: 'Enter GSTIN (or MSME)',            done: !!seller.gstin,                             href: '/seller/profile' },
    { key: 'bank',       label: 'Add bank account',                 done: !!seller.bankAccount && !!seller.ifsc,      href: '/seller/bank' },
    { key: 'pan_doc',    label: 'Upload PAN card',                  done: approvedDocTypes.has('PAN_CARD'),           href: '/seller/documents' },
    { key: 'gst_doc',    label: 'Upload GST/MSME certificate',      done: approvedDocTypes.has('GST_CERTIFICATE') || approvedDocTypes.has('MSME_CERTIFICATE'), href: '/seller/documents' },
    { key: 'cheque_doc', label: 'Upload cancelled cheque',          done: approvedDocTypes.has('CANCELLED_CHEQUE') || approvedDocTypes.has('BANK_STATEMENT'), href: '/seller/documents' },
    { key: 'agreement',  label: 'Upload signed seller agreement',   done: approvedDocTypes.has('SELLER_AGREEMENT'),   href: '/seller/documents' },
  ];
}

// Fields that require admin approval after first save.
// First-time save = direct write. Subsequent edits → SellerChangeRequest queue.
export const APPROVAL_GATED_FIELDS = new Set([
  'businessName',
  'pan',
  'gstin',
  'bankAccount', 'ifsc', 'bankName',
  'region',         // address-linked for GST
]);

export const DIRECT_EDIT_FIELDS = new Set([
  'contactName', 'phone', 'story', 'logoImage', 'coverImage',
  'portfolio', 'craft', 'cluster', 'yearsOfPractice',
]);
