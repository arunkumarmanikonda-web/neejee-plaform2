import { prisma } from '@/lib/prisma';

export const ADMIN_AGREEMENT_READ_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'LEGAL',
  'FINANCE',
  'QC_TEAM',
  'CONTENT_EDITOR',
] as const;

export const ADMIN_AGREEMENT_EDIT_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'LEGAL',
] as const;

export function canAdminReadAgreement(role: string | null | undefined) {
  return !!role && ADMIN_AGREEMENT_READ_ROLES.includes(role as any);
}

export function canAdminEditAgreement(role: string | null | undefined) {
  return !!role && ADMIN_AGREEMENT_EDIT_ROLES.includes(role as any);
}

export function normalizeParagraphKey(value: unknown, fallback: string) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
}

export function normalizeAgreementDocument(input: any) {
  const company = input?.company && typeof input.company === 'object' ? input.company : {};
  const seller = input?.seller && typeof input.seller === 'object' ? input.seller : {};
  const commercialTerms =
    input?.commercialTerms && typeof input.commercialTerms === 'object'
      ? input.commercialTerms
      : {};
  const annexure = Array.isArray(input?.annexure) ? input.annexure : [];
  const recitals = Array.isArray(input?.recitals) ? input.recitals : [];
  const clausesInput = Array.isArray(input?.clauses) ? input.clauses : [];

  const clauses = clausesInput.map((clause: any, index: number) => {
    const paragraphsInput = Array.isArray(clause?.paragraphs)
      ? clause.paragraphs
      : (typeof clause?.text === 'string' && clause.text.trim()
          ? [clause.text.trim()]
          : []);

    const paragraphs = paragraphsInput.map((paragraph: any, paragraphIndex: number) => ({
      key:
        normalizeParagraphKey(
          paragraph?.key,
          `c${index + 1}_p${paragraphIndex + 1}`,
        ),
      text:
        typeof paragraph === 'string'
          ? paragraph
          : String(paragraph?.text ?? '').trim(),
    }));

    return {
      id: String(clause?.id ?? `${index + 1}`),
      title: String(clause?.title ?? clause?.heading ?? `Clause ${index + 1}`),
      heading: String(clause?.heading ?? clause?.title ?? `Clause ${index + 1}`),
      paragraphs: paragraphs.filter((p: any) => p.text),
    };
  });

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      versionLabel: String(input?.meta?.versionLabel ?? 'v1'),
      locked: !!input?.meta?.locked,
    },
    company,
    seller,
    commercialTerms,
    recitals,
    annexure,
    clauses,
  };
}

export function getParagraphTextFromDocument(
  documentJson: any,
  clauseId: string,
  paragraphKey: string,
) {
  const clauses = Array.isArray(documentJson?.clauses) ? documentJson.clauses : [];
  const clause = clauses.find((c: any) => String(c?.id) === String(clauseId));
  if (!clause) return null;
  const paragraphs = Array.isArray(clause?.paragraphs) ? clause.paragraphs : [];
  const paragraph = paragraphs.find(
    (p: any) => String(p?.key) === String(paragraphKey),
  );
  return paragraph ? String(paragraph?.text ?? '') : null;
}

export async function ensureSellerAgreementSeeded(args: {
  sellerId: string;
  request: Request;
}) {
  const existing = await prisma.sellerAgreement.findFirst({
    where: { sellerId: args.sellerId },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) return existing;

  const seedUrl = new URL(
    `/api/admin/sellers/${args.sellerId}/agreement`,
    args.request.url,
  );

  const seedResponse = await fetch(seedUrl.toString(), {
    method: 'GET',
    headers: {
      cookie: args.request.headers.get('cookie') || '',
    },
    cache: 'no-store',
  });

  if (!seedResponse.ok) {
    throw new Error(`Unable to seed agreement preview (${seedResponse.status})`);
  }

  const previewJson = await seedResponse.json().catch(() => null);
  const documentJson = normalizeAgreementDocument(
    previewJson?.agreement || previewJson || {},
  );

  const created = await prisma.sellerAgreement.create({
    data: {
      sellerId: args.sellerId,
      status: 'DRAFT' as any,
      currentVersionNo: 1,
      currentDocumentJson: documentJson as any,
    },
  });

  await prisma.sellerAgreementVersion.create({
    data: {
      agreementId: created.id,
      versionNo: 1,
      documentJson: documentJson as any,
      changeSummary: 'Initial agreement seeded from printable preview',
    },
  });

  return created;
}