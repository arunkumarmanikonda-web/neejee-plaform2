import type { PremiumCatalogueTemplateBlock } from '../templates';
import type { PremiumCatalogueRenderContext } from './contracts';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'premium-catalogue';
}

function money(value: number | null | undefined, currency: string | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Price on request';
  const code = currency || 'INR';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${code} ${value}`;
  }
}

function renderProductCard(product: PremiumCatalogueTemplateBlock['products'][number]): string {
  const image = product.primaryImage
    ? `<img src="${escapeHtml(product.primaryImage)}" alt="${escapeHtml(product.name)}" />`
    : `<div class="image-placeholder">No image</div>`;

  const badges = product.badges.length
    ? `<div class="badges">${product.badges
        .map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`)
        .join('')}</div>`
    : '';

  const line = product.poeticLine || product.description || '';
  const price = money(product.pricing.effectivePrice, product.pricing.currency);
  const compareAt =
    typeof product.pricing.mrp === 'number' &&
    product.pricing.mrp > (product.pricing.effectivePrice ?? 0)
      ? `<span class="compare">${escapeHtml(money(product.pricing.mrp, product.pricing.currency))}</span>`
      : '';

  return `<article class="product-card">
    <div class="product-image">${image}</div>
    <div class="product-copy">
      <div class="eyebrow">${escapeHtml(product.categoryPath || 'Neejee edit')}</div>
      <h4>${escapeHtml(product.name)}</h4>
      ${line ? `<p>${escapeHtml(line)}</p>` : ''}
      ${badges}
      <div class="price-row">
        <span class="price">${escapeHtml(price)}</span>
        ${compareAt}
      </div>
    </div>
  </article>`;
}

function renderBlock(block: PremiumCatalogueTemplateBlock, index: number): string {
  const products = block.products.map(renderProductCard).join('');
  const meta = Object.entries(block.meta || {})
    .filter(([, value]) => value !== null && value !== '' && value !== false)
    .map(([key, value]) => `<li><strong>${escapeHtml(key)}</strong>: ${escapeHtml(Array.isArray(value) ? value.join(', ') : value)}</li>`)
    .join('');

  return `<section id="section-${index + 1}" class="block block-${escapeHtml(block.kind)}">
    <div class="block-head">
      <div class="block-kicker">${escapeHtml(block.kind.replace(/-/g, ' '))}</div>
      <h2>${escapeHtml(block.title)}</h2>
      ${block.subtitle ? `<h3>${escapeHtml(block.subtitle)}</h3>` : ''}
      ${block.body ? `<p class="lead">${escapeHtml(block.body)}</p>` : ''}
    </div>
    ${meta ? `<ul class="meta-list">${meta}</ul>` : ''}
    ${products ? `<div class="product-grid">${products}</div>` : ''}
  </section>`;
}

export function buildPremiumCatalogueFileBaseName(context: PremiumCatalogueRenderContext): string {
  return slugify(`${context.template.slug}-${context.template.templateKey}`);
}

export function renderPremiumCatalogueHtmlDocument(context: PremiumCatalogueRenderContext): string {
  const { engineOutput, template } = context;
  const title = template.title || engineOutput.brief.title || 'Premium Catalogue';
  const coverImage = engineOutput.heroProduct?.media?.preferredImage
    ?? engineOutput.heroProduct?.media?.approvedPrimaryImage
    ?? engineOutput.heroProduct?.media?.primaryImage
    ?? null;

  const toc = template.blocks
    .map((block, index) => `<li><a href="#section-${index + 1}">${index + 1}. ${escapeHtml(block.title)}</a></li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --paper: #f8f2e8;
      --ink: #2b211b;
      --muted: #6e6258;
      --accent: #8b4b3e;
      --line: #dbcdbd;
      --panel: #fffaf3;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      color: var(--ink);
      background: var(--paper);
      line-height: 1.6;
    }
    .page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 48px 32px 64px;
    }
    .cover {
      min-height: 72vh;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 28px;
      align-items: stretch;
      border-bottom: 1px solid var(--line);
      padding-bottom: 28px;
    }
    .cover-copy, .cover-image {
      background: rgba(255,255,255,0.55);
      border: 1px solid var(--line);
      padding: 28px;
    }
    .cover-kicker, .block-kicker, .toc-kicker {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 11px;
      color: var(--accent);
      margin-bottom: 14px;
    }
    .cover h1 {
      font-size: clamp(36px, 6vw, 64px);
      line-height: 1.05;
      margin: 0 0 18px;
    }
    .cover p, .lead { color: var(--muted); }
    .cover-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 24px;
    }
    .stat { border-top: 1px solid var(--line); padding-top: 10px; }
    .cover-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      min-height: 420px;
    }
    .image-placeholder {
      display: grid;
      place-items: center;
      min-height: 180px;
      background: #efe5d7;
      color: var(--muted);
      border: 1px dashed var(--line);
    }
    .toc {
      margin: 36px 0 18px;
      background: rgba(255,255,255,0.65);
      border: 1px solid var(--line);
      padding: 24px 28px;
    }
    .toc ol { margin: 0; padding-left: 18px; }
    .toc li { margin: 8px 0; }
    .toc a { color: var(--ink); text-decoration: none; }
    .block {
      background: rgba(255,255,255,0.65);
      border: 1px solid var(--line);
      margin: 24px 0;
      padding: 28px;
    }
    .block h2 { margin: 0 0 8px; font-size: 34px; }
    .block h3 { margin: 0 0 14px; color: var(--accent); font-size: 16px; }
    .meta-list {
      margin: 16px 0 0;
      padding-left: 18px;
      color: var(--muted);
    }
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 18px;
      margin-top: 22px;
    }
    .product-card {
      border: 1px solid var(--line);
      background: var(--panel);
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }
    .product-image img, .product-image .image-placeholder {
      width: 100%;
      height: 220px;
      object-fit: cover;
      display: block;
      background: #efe5d7;
    }
    .product-copy { padding: 16px; }
    .product-copy h4 { margin: 6px 0 10px; font-size: 20px; }
    .product-copy p { margin: 0 0 12px; color: var(--muted); }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 11px;
      color: var(--accent);
    }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 14px; }
    .badge {
      border: 1px solid var(--line);
      padding: 3px 8px;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .price-row { display: flex; gap: 10px; align-items: baseline; }
    .price { font-weight: 700; }
    .compare { color: var(--muted); text-decoration: line-through; }
    @media print {
      body { background: white; }
      .page { max-width: none; padding: 0; }
      .block, .toc, .cover-copy, .cover-image { break-inside: avoid; }
    }
    @media (max-width: 820px) {
      .cover { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="cover">
      <div class="cover-copy">
        <div class="cover-kicker">Neejee premium catalogue export</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(engineOutput.heroProduct?.catalogue?.storyBlock || template.blocks[0]?.body || 'A deterministic premium catalogue assembled from the live read model and template engine.')}</p>
        <div class="cover-stats">
          <div class="stat"><strong>Generated</strong><br/>${escapeHtml(template.generatedAt)}</div>
          <div class="stat"><strong>Template</strong><br/>${escapeHtml(template.templateKey)}</div>
          <div class="stat"><strong>Products</strong><br/>${engineOutput.products.length}</div>
          <div class="stat"><strong>Selection Key</strong><br/>${escapeHtml(template.selectionKey)}</div>
        </div>
      </div>
      <div class="cover-image">
        ${coverImage ? `<img src="${escapeHtml(coverImage)}" alt="${escapeHtml(title)}" />` : '<div class="image-placeholder">No cover image resolved</div>'}
      </div>
    </section>

    <section class="toc">
      <div class="toc-kicker">Table of contents</div>
      <ol>${toc}</ol>
    </section>

    ${template.blocks.map(renderBlock).join('')}
  </main>
</body>
</html>`;
}
