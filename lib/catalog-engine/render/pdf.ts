import type { PremiumCatalogueTemplateBlock } from '../templates';
import type { PremiumCatalogueRenderContext } from './contracts';
import {
  buildFounderEndingNote,
  buildFounderEndingQuote,
  buildFounderPreNote,
  buildFounderPreQuote,
  buildNeejeeInsight,
} from '../neejee-founder-copy';

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(text: string, width = 90): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [''];

  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function blockLines(block: PremiumCatalogueTemplateBlock): string[] {
  const lines = [
    `${block.title}`,
    ...(block.subtitle ? wrapLine(block.subtitle) : []),
    ...(block.body ? wrapLine(block.body) : []),
  ];

  for (const product of block.products) {
    const price =
      typeof product.pricing.effectivePrice === 'number'
        ? `${product.pricing.currency || 'INR'} ${product.pricing.effectivePrice}`
        : 'Price on request';

    lines.push(`• ${product.name} — ${price}`);
    if (product.categoryPath) lines.push(`  Category: ${product.categoryPath}`);
    if (product.poeticLine) lines.push(...wrapLine(`  ${product.poeticLine}`));
    if (product.badges?.length) lines.push(...wrapLine(`  Badges: ${product.badges.join(', ')}`));
  }

  if (Object.keys(block.meta || {}).length > 0) {
    lines.push('  Metadata');
    for (const [key, value] of Object.entries(block.meta)) {
      if (value === null || value === '' || value === false) continue;
      const text = Array.isArray(value) ? value.join(', ') : String(value);
      lines.push(...wrapLine(`  ${key}: ${text}`));
    }
  }

  lines.push('');
  return lines;
}

function buildLuxuryFounderLines(context: PremiumCatalogueRenderContext): string[] {
  const { engineOutput, template } = context;
  const founderName = 'Nidhi Chauhan';
  const hero = engineOutput.heroProduct || engineOutput.products[0] || null;
  const lines: string[] = [];

  lines.push(template.title || 'Neejee Luxury Catalogue');
  lines.push(`Template: ${template.templateKey}`);
  lines.push(`Generated: ${template.generatedAt}`);
  lines.push(`Founder: ${founderName}`);
  lines.push(`Products: ${engineOutput.products.length}`);
  if (hero?.identity?.name) lines.push(`Lead product: ${hero.identity.name}`);
  lines.push('');

  lines.push('Founder Pre-Note');
  lines.push(...wrapLine(buildFounderPreNote(engineOutput, founderName)));
  lines.push(...wrapLine(buildFounderPreQuote(engineOutput, founderName)));
  lines.push('');

  engineOutput.products.forEach((product, index) => {
    lines.push(`Product ${index + 1}: ${product.identity.name}`);
    lines.push(...wrapLine(product.identity.poeticLine || product.identity.description || ''));
    lines.push(...wrapLine(buildNeejeeInsight(product)));
    lines.push('');
  });

  lines.push('Founder Ending Note');
  lines.push(...wrapLine(buildFounderEndingNote(engineOutput, founderName)));
  lines.push(...wrapLine(buildFounderEndingQuote(engineOutput, founderName)));
  lines.push('');

  template.blocks.forEach((block, index) => {
    lines.push(`${index + 1}. ${block.title}`);
    lines.push(...blockLines(block));
  });

  return lines;
}

function buildDefaultDocumentLines(context: PremiumCatalogueRenderContext): string[] {
  const { engineOutput, template } = context;
  const lines: string[] = [];

  lines.push(template.title || 'Premium Catalogue');
  lines.push(`Template: ${template.templateKey}`);
  lines.push(`Generated: ${template.generatedAt}`);
  lines.push(`Selection key: ${template.selectionKey}`);
  lines.push(`Products: ${engineOutput.products.length}`);
  if (engineOutput.heroProduct?.identity?.name) {
    lines.push(`Cover hero: ${engineOutput.heroProduct.identity.name}`);
  }
  if (engineOutput.heroProduct?.media?.preferredImage || engineOutput.heroProduct?.media?.primaryImage) {
    lines.push(
      `Cover image URL: ${
        engineOutput.heroProduct.media.preferredImage || engineOutput.heroProduct.media.primaryImage
      }`
    );
  }
  lines.push('');
  lines.push('Table of contents');
  template.blocks.forEach((block, index) => {
    lines.push(`${index + 1}. ${block.title}`);
  });
  lines.push('');

  template.blocks.forEach((block, index) => {
    lines.push(`${index + 1}. ${block.title}`);
    lines.push(...blockLines(block));
  });

  return lines;
}

function buildPdfBufferFromPages(pages: string[][]): Buffer {
  const objects: string[] = [];
  const fontObjectNumber = 3;

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const pageObjectNumbers: number[] = [];

  for (let i = 0; i < pages.length; i += 1) {
    const pageObjectNumber = 4 + i * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    pageObjectNumbers.push(pageObjectNumber);

    const page = pages[i];
    const streamLines: string[] = ['BT', '/F1 12 Tf', '50 760 Td'];
    page.forEach((line, index) => {
      if (index > 0) streamLines.push('0 -16 Td');
      streamLines.push(`(${escapePdfText(line)}) Tj`);
    });
    streamLines.push('ET');
    const stream = streamLines.join('\n');

    objects[pageObjectNumber - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber - 1] = `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`;
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers
    .map((n) => `${n} 0 R`)
    .join(' ')}] /Count ${pages.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

export function renderPremiumCataloguePdfBuffer(context: PremiumCatalogueRenderContext): Buffer {
  const allLines =
    context.template.templateKey === 'luxury_signature'
      ? buildLuxuryFounderLines(context)
      : buildDefaultDocumentLines(context);

  const pageSize = 42;
  const pages: string[][] = [];

  for (let i = 0; i < allLines.length; i += pageSize) {
    pages.push(allLines.slice(i, i + pageSize));
  }

  return buildPdfBufferFromPages(pages.length ? pages : [['Premium Catalogue']]);
}
