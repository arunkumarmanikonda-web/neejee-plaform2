// Default chart of accounts for NEEJEE. Run once via /api/admin/finance/seed-categories
// (idempotent — skips categories with existing `code`).
import { prisma } from '@/lib/prisma';

type SeedRow = {
  code: string;
  label: string;
  group:
    | 'COGS_DIRECT' | 'OPEX_MARKETING' | 'OPEX_COMMUNICATION' | 'OPEX_SHIPPING'
    | 'OPEX_PAYMENT' | 'OPEX_PLATFORM' | 'OPEX_PEOPLE' | 'OPEX_OFFICE'
    | 'OPEX_PROFESSIONAL' | 'OPEX_TAX_OTHER' | 'OPEX_OTHER' | 'WRITE_OFF';
  isMarketingChannel?: boolean;
  approvalThresholdPaise?: number | null;
  gstInputClaimable?: boolean;
};

// Defaults: most categories auto-approve up to ₹10,000; sensitive ones always need approval.
const T_AUTO = 10_000_00;     // ₹10,000
const T_NONE = null;          // null = always auto-approve
const T_ALWAYS = 0;           // 0 = always pending

export const DEFAULT_CATEGORIES: SeedRow[] = [
  // ── COGS ────────────────────────────────────────────────────
  { code: 'COGS_INBOUND_SHIPPING', label: 'Inbound shipping (vendor → us)',  group: 'COGS_DIRECT',        approvalThresholdPaise: T_AUTO },
  { code: 'COGS_PACKAGING',        label: 'Packaging materials',              group: 'COGS_DIRECT',        approvalThresholdPaise: T_AUTO },
  { code: 'COGS_QC',               label: 'Quality control / inspection',     group: 'COGS_DIRECT',        approvalThresholdPaise: T_AUTO },

  // ── Marketing ───────────────────────────────────────────────
  { code: 'MKT_META_ADS',          label: 'Meta Ads (Facebook + Instagram)',  group: 'OPEX_MARKETING',     isMarketingChannel: true, approvalThresholdPaise: T_ALWAYS },
  { code: 'MKT_GOOGLE_ADS',        label: 'Google Ads',                       group: 'OPEX_MARKETING',     isMarketingChannel: true, approvalThresholdPaise: T_ALWAYS },
  { code: 'MKT_INFLUENCER',        label: 'Influencer marketing',             group: 'OPEX_MARKETING',     isMarketingChannel: true, approvalThresholdPaise: T_ALWAYS },
  { code: 'MKT_AFFILIATE',         label: 'Affiliate / referral payouts',     group: 'OPEX_MARKETING',     isMarketingChannel: true, approvalThresholdPaise: T_AUTO },
  { code: 'MKT_CONTENT',           label: 'Content production (photo, video)',group: 'OPEX_MARKETING',     approvalThresholdPaise: T_AUTO },
  { code: 'MKT_PR_EVENTS',         label: 'PR & events',                      group: 'OPEX_MARKETING',     approvalThresholdPaise: T_ALWAYS },
  { code: 'MKT_OTHER',             label: 'Other marketing',                  group: 'OPEX_MARKETING',     isMarketingChannel: true, approvalThresholdPaise: T_AUTO },

  // ── Communication ───────────────────────────────────────────
  { code: 'COMM_SMS',              label: 'SMS (Fast2SMS)',                   group: 'OPEX_COMMUNICATION', approvalThresholdPaise: T_NONE },
  { code: 'COMM_WHATSAPP',         label: 'WhatsApp Business',                group: 'OPEX_COMMUNICATION', approvalThresholdPaise: T_NONE },
  { code: 'COMM_EMAIL',            label: 'Transactional email (Resend)',     group: 'OPEX_COMMUNICATION', approvalThresholdPaise: T_NONE },

  // ── Shipping ────────────────────────────────────────────────
  { code: 'SHIP_OUTBOUND',         label: 'Outbound courier (Shiprocket etc.)', group: 'OPEX_SHIPPING',    approvalThresholdPaise: T_AUTO },
  { code: 'SHIP_REVERSE',          label: 'Reverse shipping (returns)',       group: 'OPEX_SHIPPING',      approvalThresholdPaise: T_AUTO },
  { code: 'SHIP_INTERNATIONAL',    label: 'International courier',            group: 'OPEX_SHIPPING',      approvalThresholdPaise: T_AUTO },

  // ── Payment ─────────────────────────────────────────────────
  { code: 'PAY_RAZORPAY',          label: 'Razorpay gateway fees',            group: 'OPEX_PAYMENT',       approvalThresholdPaise: T_NONE },
  { code: 'PAY_BANK_CHARGES',      label: 'Bank charges',                     group: 'OPEX_PAYMENT',       approvalThresholdPaise: T_AUTO },

  // ── Platform & SaaS ─────────────────────────────────────────
  { code: 'PLAT_HOSTING',          label: 'Hosting (Vercel)',                 group: 'OPEX_PLATFORM',      approvalThresholdPaise: T_AUTO },
  { code: 'PLAT_DATABASE',         label: 'Database (Supabase)',              group: 'OPEX_PLATFORM',      approvalThresholdPaise: T_AUTO },
  { code: 'PLAT_AI',               label: 'AI services (Fal.ai, OpenAI)',     group: 'OPEX_PLATFORM',      approvalThresholdPaise: T_AUTO },
  { code: 'PLAT_DOMAIN',           label: 'Domain & DNS',                     group: 'OPEX_PLATFORM',      approvalThresholdPaise: T_NONE },
  { code: 'PLAT_OTHER_SAAS',       label: 'Other SaaS subscriptions',         group: 'OPEX_PLATFORM',      approvalThresholdPaise: T_AUTO },

  // ── People ──────────────────────────────────────────────────
  { code: 'PEOPLE_SALARIES',       label: 'Payroll — Salaries',                group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_ALWAYS },
  { code: 'PEOPLE_PAYROLL_NET',    label: 'Payroll — Net pay disbursed',       group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_ALWAYS },
  { code: 'PEOPLE_PAYROLL_PF',     label: 'Payroll — PF employer contribution',group: 'OPEX_PEOPLE',       approvalThresholdPaise: T_AUTO },
  { code: 'PEOPLE_PAYROLL_ESI',    label: 'Payroll — ESI employer contribution',group: 'OPEX_PEOPLE',      approvalThresholdPaise: T_AUTO },
  { code: 'PEOPLE_PAYROLL_TDS',    label: 'Payroll — TDS deposited',           group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_AUTO, gstInputClaimable: false },
  { code: 'PEOPLE_PT',             label: 'Payroll — Professional Tax',        group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_AUTO, gstInputClaimable: false },
  { code: 'PEOPLE_BONUS',          label: 'Bonus / incentive payouts',         group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_ALWAYS },
  { code: 'PEOPLE_CONTRACTORS',    label: 'Contractors / freelance',           group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_ALWAYS },
  { code: 'PEOPLE_BENEFITS',       label: 'Benefits & reimbursements',         group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_AUTO },
  { code: 'PEOPLE_TRAVEL',         label: 'Employee travel & lodging',         group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_AUTO },
  { code: 'PEOPLE_TRAINING',       label: 'Training & upskilling',             group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_AUTO },
  { code: 'PEOPLE_RECRUITMENT',    label: 'Recruitment & hiring',              group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_AUTO },
  { code: 'PEOPLE_INSURANCE',      label: 'Group health insurance',            group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_AUTO },
  { code: 'PEOPLE_GIFTS',          label: 'Staff gifts & welfare',             group: 'OPEX_PEOPLE',        approvalThresholdPaise: T_AUTO },

  // ── Office ──────────────────────────────────────────────────
  { code: 'OFFICE_RENT',           label: 'Office rent',                       group: 'OPEX_OFFICE',        approvalThresholdPaise: T_ALWAYS },
  { code: 'OFFICE_MAINTENANCE',    label: 'Office maintenance & repairs',      group: 'OPEX_OFFICE',        approvalThresholdPaise: T_AUTO },
  { code: 'OFFICE_ELECTRICITY',    label: 'Electricity',                       group: 'OPEX_OFFICE',        approvalThresholdPaise: T_AUTO },
  { code: 'OFFICE_INTERNET',       label: 'Internet & broadband',              group: 'OPEX_OFFICE',        approvalThresholdPaise: T_AUTO },
  { code: 'OFFICE_WATER',          label: 'Water & municipal',                 group: 'OPEX_OFFICE',        approvalThresholdPaise: T_AUTO },
  { code: 'OFFICE_UTILITIES',      label: 'Other utilities (legacy)',          group: 'OPEX_OFFICE',        approvalThresholdPaise: T_AUTO },
  { code: 'OFFICE_SUPPLIES',       label: 'Office supplies & stationery',      group: 'OPEX_OFFICE',        approvalThresholdPaise: T_AUTO },
  { code: 'OFFICE_HOUSEKEEPING',   label: 'Housekeeping & cleaning',           group: 'OPEX_OFFICE',        approvalThresholdPaise: T_AUTO },
  { code: 'OFFICE_PRINTING',       label: 'Printing & photocopy',              group: 'OPEX_OFFICE',        approvalThresholdPaise: T_AUTO },
  { code: 'OFFICE_SECURITY',       label: 'Security services',                 group: 'OPEX_OFFICE',        approvalThresholdPaise: T_AUTO },
  { code: 'OFFICE_FURNITURE',      label: 'Furniture & fixtures',              group: 'OPEX_OFFICE',        approvalThresholdPaise: T_ALWAYS },
  { code: 'OFFICE_IT_EQUIPMENT',   label: 'IT equipment (laptops, monitors)',  group: 'OPEX_OFFICE',        approvalThresholdPaise: T_ALWAYS },
  { code: 'OFFICE_TELEPHONE',      label: 'Telephone / mobile bills',          group: 'OPEX_OFFICE',        approvalThresholdPaise: T_AUTO },

  // ── Professional ────────────────────────────────────────────
  { code: 'PROF_CA',               label: 'Chartered Accountant fees',         group: 'OPEX_PROFESSIONAL',  approvalThresholdPaise: T_AUTO },
  { code: 'PROF_LEGAL',            label: 'Legal fees',                        group: 'OPEX_PROFESSIONAL',  approvalThresholdPaise: T_ALWAYS },
  { code: 'PROF_CS',               label: 'Company Secretary fees',            group: 'OPEX_PROFESSIONAL',  approvalThresholdPaise: T_AUTO },
  { code: 'PROF_AUDIT',            label: 'Statutory audit fees',              group: 'OPEX_PROFESSIONAL',  approvalThresholdPaise: T_ALWAYS },
  { code: 'PROF_CONSULTANTS',      label: 'Business / strategy consultants',   group: 'OPEX_PROFESSIONAL',  approvalThresholdPaise: T_ALWAYS },
  { code: 'PROF_TAX_FILING',       label: 'Tax filing & ROC fees',             group: 'OPEX_PROFESSIONAL',  approvalThresholdPaise: T_AUTO },
  { code: 'PROF_TRADEMARK',        label: 'Trademark / IP registration',       group: 'OPEX_PROFESSIONAL',  approvalThresholdPaise: T_ALWAYS },
  { code: 'PROF_LICENSES',         label: 'Licenses & permits',                group: 'OPEX_PROFESSIONAL',  approvalThresholdPaise: T_AUTO },
  { code: 'PROF_INSURANCE_BIZ',    label: 'Business insurance',                group: 'OPEX_PROFESSIONAL',  approvalThresholdPaise: T_AUTO },

  // ── Tax / Other ─────────────────────────────────────────────
  { code: 'TRAVEL_AIRFARE',        label: 'Air travel',                        group: 'OPEX_OTHER',         approvalThresholdPaise: T_AUTO },
  { code: 'TRAVEL_HOTEL',          label: 'Hotel & lodging',                   group: 'OPEX_OTHER',         approvalThresholdPaise: T_AUTO },
  { code: 'TRAVEL_CAB',            label: 'Cab / Uber / Ola',                  group: 'OPEX_OTHER',         approvalThresholdPaise: T_AUTO },
  { code: 'TRAVEL_FUEL',           label: 'Fuel & vehicle expense',            group: 'OPEX_OTHER',         approvalThresholdPaise: T_AUTO },
  { code: 'TRAVEL_FOOD',           label: 'Business meals & entertainment',    group: 'OPEX_OTHER',         approvalThresholdPaise: T_AUTO },
  { code: 'FIN_INTEREST',          label: 'Interest on loans',                 group: 'OPEX_OTHER',         approvalThresholdPaise: T_AUTO, gstInputClaimable: false },
  { code: 'FIN_LOAN_PRINCIPAL',    label: 'Loan principal repayment',          group: 'OPEX_OTHER',         approvalThresholdPaise: T_ALWAYS, gstInputClaimable: false },
  { code: 'FIN_FX_LOSS',           label: 'Foreign exchange loss',             group: 'OPEX_OTHER',         approvalThresholdPaise: T_AUTO, gstInputClaimable: false },
  { code: 'RND_SAMPLES',           label: 'Product samples & prototypes',      group: 'COGS_DIRECT',        approvalThresholdPaise: T_AUTO },
  { code: 'RND_DESIGN',            label: 'Design & R&D',                      group: 'OPEX_OTHER',         approvalThresholdPaise: T_AUTO },
  { code: 'TAX_GST',               label: 'GST paid (output net of input)',    group: 'OPEX_TAX_OTHER',     approvalThresholdPaise: T_NONE, gstInputClaimable: false },
  { code: 'TAX_TDS',               label: 'TDS deposits',                      group: 'OPEX_TAX_OTHER',     approvalThresholdPaise: T_NONE, gstInputClaimable: false },
  { code: 'TAX_INCOME',            label: 'Income tax provision',              group: 'OPEX_TAX_OTHER',     approvalThresholdPaise: T_ALWAYS, gstInputClaimable: false },
  { code: 'TAX_LATE_FEES',         label: 'Late fees / penalties',             group: 'OPEX_TAX_OTHER',     approvalThresholdPaise: T_AUTO, gstInputClaimable: false },
  { code: 'OTHER_MISC',            label: 'Miscellaneous',                     group: 'OPEX_OTHER',         approvalThresholdPaise: T_AUTO },
  { code: 'OTHER_DONATIONS',       label: 'Donations & CSR',                   group: 'OPEX_OTHER',         approvalThresholdPaise: T_ALWAYS },
  { code: 'OTHER_SUBSCRIPTIONS',   label: 'Subscriptions (non-SaaS)',          group: 'OPEX_OTHER',         approvalThresholdPaise: T_AUTO },

  // ── Write-offs ──────────────────────────────────────────────
  { code: 'WO_DAMAGED',            label: 'Damaged inventory',                group: 'WRITE_OFF',          approvalThresholdPaise: T_ALWAYS, gstInputClaimable: false },
  { code: 'WO_LOST_SHIPMENT',      label: 'Lost in shipment',                 group: 'WRITE_OFF',          approvalThresholdPaise: T_ALWAYS, gstInputClaimable: false },
  { code: 'WO_OTHER',              label: 'Other write-offs',                 group: 'WRITE_OFF',          approvalThresholdPaise: T_ALWAYS, gstInputClaimable: false },
];

// Idempotent seed — skips rows whose `code` already exists.
export async function seedExpenseCategories(): Promise<{ created: number; skipped: number }> {
  let created = 0, skipped = 0;
  for (const row of DEFAULT_CATEGORIES) {
    const existing = await prisma.expenseCategory.findUnique({ where: { code: row.code } });
    if (existing) { skipped++; continue; }
    await prisma.expenseCategory.create({
      data: {
        code: row.code,
        label: row.label,
        group: row.group as any,
        isMarketingChannel: row.isMarketingChannel || false,
        approvalThresholdPaise: row.approvalThresholdPaise ?? null,
        gstInputClaimable: row.gstInputClaimable !== false,
      },
    });
    created++;
  }
  return { created, skipped };
}
