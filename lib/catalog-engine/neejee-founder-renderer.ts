import type { PremiumCatalogueEngineOutput } from './contracts';
import type { PremiumCatalogueTemplateRenderResult } from './templates/contracts';
import {
  buildContentsLabels,
  buildFounderEndingNote,
  buildFounderEndingQuote,
  buildFounderPreNote,
  buildFounderPreQuote,
  buildFounderSignature,
  buildNeejeeInsight,
  buildProductMetaNarrative,
  buildProductNarrative,
  buildSectionIntro,
  formatInr,
  getBadgeLabels,
  getGalleryImages,
  getPrimaryImage,
} from './neejee-founder-copy';

interface RenderOptions {
  founderName?: string;
  brandName?: string;
  includeFounderNotes?: boolean;
  template?: PremiumCatalogueTemplateRenderResult | null;
}

type ProductLike = PremiumCatalogueEngineOutput['products'][number];

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function productName(product: ProductLike | null | undefined): string {
  return text((product as any)?.identity?.name || (product as any)?.name, 'Signature Object');
}

function productShortLine(product: ProductLike | null | undefined): string {
  return text(
    (product as any)?.identity?.poeticLine ||
      (product as any)?.poeticLine ||
      (product as any)?.identity?.description ||
      (product as any)?.description ||
      'Crafted for rooms that reward restraint.'
  );
}

function productCategoryPath(product: ProductLike | null | undefined): string {
  return text((product as any)?.hierarchy?.path || (product as any)?.category?.path).replace(/\//g, ' / ');
}

function productPrice(product: ProductLike | null | undefined): string {
  return formatInr(
    (product as any)?.pricing?.effectivePrice ??
      (product as any)?.sellingPrice ??
      (product as any)?.pricing?.sellingPrice ??
      null
  );
}

function productMrp(product: ProductLike | null | undefined): string {
  return formatInr((product as any)?.pricing?.mrp ?? (product as any)?.mrp ?? null);
}

function specRow(label: string, value: string): string {
  if (!value) return '';
  return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
}

function imageTag(src: string | null, alt: string, className: string): string {
  if (!src) return `<div class="img-placeholder ${className}">${escapeHtml(alt)}</div>`;
  return `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;
}

function renderCover(
  engineOutput: PremiumCatalogueEngineOutput,
  brandName: string,
  title: string,
  product: ProductLike | null
): string {
  const coverImage = getPrimaryImage(product);
  const subtitle = productShortLine(product);

  return `<section class="page cover-page">
    <div class="page-border"></div>
    <div class="page-pad cover-grid">
      <div class="cover-copy">
        <div>
          <div class="eyebrow">${escapeHtml(brandName)} · Luxury Founder Catalogue</div>
          <h1 class="display-title">A quieter kind of grandeur.</h1>
          <div class="rule"></div>
          <p class="subtitle">Earthy Indian luxury, editorial rhythm, and founder-led storytelling — generated directly from the live catalogue engine.</p>
          <p class="body body-large">${escapeHtml(title)} is designed to feel less like a product dump and more like a composed object: one that moves between provenance, atmosphere, and considered commerce.</p>
        </div>
        <div class="cover-stats">
          <div class="stat-card"><span class="stat-label">Products</span><strong>${engineOutput.products.length}</strong></div>
          <div class="stat-card"><span class="stat-label">Tone</span><strong>${escapeHtml(engineOutput.brief.tone)}</strong></div>
          <div class="stat-card"><span class="stat-label">Selection</span><strong>${escapeHtml(engineOutput.selection.selectionKey)}</strong></div>
          <div class="stat-card"><span class="stat-label">Lead</span><strong>${escapeHtml(productName(product))}</strong></div>
        </div>
      </div>
      <div class="cover-visual">
        ${imageTag(coverImage, productName(product), 'cover-image')}
        <div class="cover-caption">
          <div class="smallcaps">Signature object</div>
          <div class="caption-title">${escapeHtml(productName(product))}</div>
          <div class="caption-line">${escapeHtml(subtitle)}</div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderFounderPreNote(
  engineOutput: PremiumCatalogueEngineOutput,
  founderName: string,
  brandName: string
): string {
  return `<section class="page founder-page">
    <div class="page-border"></div>
    <div class="page-pad founder-layout">
      <div class="founder-panel">
        <div class="eyebrow">Founder Pre-Note</div>
        <h2 class="section-title">A note from ${escapeHtml(founderName)}</h2>
        <div class="rule"></div>
        <p class="body body-large">${escapeHtml(buildFounderPreNote(engineOutput, founderName))}</p>
        <div class="quote-block">
          <span class="quote-label">Founder Quote</span>
          <p>${escapeHtml(buildFounderPreQuote(engineOutput, founderName))}</p>
        </div>
        <div class="signature">${escapeHtml(buildFounderSignature(founderName))}</div>
      </div>
      <div class="founder-accent">
        <div class="smallcaps">${escapeHtml(brandName)} editorial mode</div>
        <p class="body body-small">The founder voice is intentionally woven into the catalogue rather than appended as a token letter: it frames the opening mood, punctuates select product moments, and closes the document with a position on beauty, craft, and permanence.</p>
      </div>
    </div>
  </section>`;
}

function renderContents(engineOutput: PremiumCatalogueEngineOutput, brandName: string): string {
  const labels = buildContentsLabels(engineOutput);
  return `<section class="page toc-page">
    <div class="page-border"></div>
    <div class="page-pad">
      <div class="eyebrow">Table of Contents</div>
      <h2 class="section-title">Catalogue map</h2>
      <div class="rule"></div>
      <div class="toc-grid">
        ${labels
          .map(
            (label, index) => `<div class="toc-item"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(label)}</strong></div>`
          )
          .join('')}
      </div>
      <div class="toc-footer">${escapeHtml(brandName)} · Generated editorial sequence from live product data and founder-note automation.</div>
    </div>
  </section>`;
}

function renderHeroSpread(
  product: ProductLike,
  founderName: string,
  templateTitle: string
): string {
  const primary = getPrimaryImage(product);
  const badges = getBadgeLabels(product);
  return `<section class="page hero-page">
    <div class="page-border"></div>
    <div class="page-pad hero-grid">
      <div class="hero-image-wrap">${imageTag(primary, productName(product), 'hero-image')}</div>
      <div class="hero-copy">
        <div class="eyebrow">Signature Product Spread</div>
        <h2 class="section-title">${escapeHtml(productName(product))}</h2>
        <p class="subtitle">${escapeHtml(productShortLine(product))}</p>
        <div class="rule"></div>
        <p class="body">${escapeHtml(buildProductNarrative(product))}</p>
        <div class="quote-block compact">
          <span class="quote-label">Neejee Insight</span>
          <p>${escapeHtml(buildNeejeeInsight(product))}</p>
        </div>
        <div class="quote-block compact sand">
          <span class="quote-label">Founder Voice · ${escapeHtml(founderName)}</span>
          <p>${escapeHtml(`For ${templateTitle}, I wanted the lead object to establish stillness before it introduced detail.`)}</p>
        </div>
        <div class="price-row">
          <span class="price">${escapeHtml(productPrice(product))}</span>
          <span class="mrp">${escapeHtml(productMrp(product))}</span>
        </div>
        <div class="badge-row">${badges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join('')}</div>
      </div>
    </div>
  </section>`;
}

function renderSectionDivider(title: string, body: string, count: number): string {
  return `<section class="page divider-page">
    <div class="page-border"></div>
    <div class="page-pad divider-layout">
      <div class="eyebrow">Section Transition</div>
      <h2 class="display-title small">${escapeHtml(title)}</h2>
      <div class="rule"></div>
      <p class="body body-large">${escapeHtml(body)}</p>
      <div class="divider-meta">${count} ${count === 1 ? 'product' : 'products'}</div>
    </div>
  </section>`;
}

function renderProductSpread(
  product: ProductLike,
  founderName: string,
  index: number
): string {
  const primary = getPrimaryImage(product);
  const gallery = getGalleryImages(product, 3);
  const categoryPath = productCategoryPath(product);
  const craft = text((product as any)?.craft);
  const region = text((product as any)?.region || (product as any)?.state || (product as any)?.sellerProfile?.region);
  const material = text((product as any)?.material);
  const technique = text((product as any)?.technique);
  const occasion = text((product as any)?.occasion);
  const care = text((product as any)?.careInstructions, 'Clean with a soft, dry cloth and handle with care.');
  const sustainability = text(
    (product as any)?.sustainabilityNote,
    'Craft-led production keeps material meaning and regional knowledge visible within the finished object.'
  );
  const stockLabel = text((product as any)?.stock?.label);
  const inventory = Number.isFinite((product as any)?.stock?.totalInventory)
    ? String((product as any).stock.totalInventory)
    : '';

  return `<section class="page product-page ${index % 2 === 0 ? 'alt' : ''}">
    <div class="page-border"></div>
    <div class="page-pad product-grid">
      <div class="product-main-image">${imageTag(primary, productName(product), 'spread-image')}</div>
      <div class="product-main-copy">
        <div class="eyebrow">Product ${String(index + 1).padStart(2, '0')}</div>
        <h2 class="section-title">${escapeHtml(productName(product))}</h2>
        <p class="subtitle">${escapeHtml(productShortLine(product))}</p>
        <div class="rule"></div>
        <p class="body">${escapeHtml(buildProductNarrative(product))}</p>
        <div class="quote-block compact">
          <span class="quote-label">Nidhi Insight</span>
          <p>${escapeHtml(buildNeejeeInsight(product))}</p>
        </div>
        <div class="quote-block compact sand">
          <span class="quote-label">Founder Quote · ${escapeHtml(founderName)}</span>
          <p>${escapeHtml(`I am drawn to objects like ${productName(product)} because they hold attention without asking for noise.`)}</p>
        </div>
      </div>
    </div>
    <div class="page-pad product-lower-grid">
      <div class="gallery-stack">
        ${imageTag(gallery[0] || primary, `${productName(product)} detail`, 'gallery-tall')}
        <div class="gallery-row">
          ${imageTag(gallery[1] || gallery[0] || primary, `${productName(product)} detail two`, 'gallery-small')}
          ${imageTag(gallery[2] || gallery[1] || primary, `${productName(product)} detail three`, 'gallery-small')}
        </div>
      </div>
      <div class="spec-panel">
        <div class="smallcaps">Collected Details</div>
        <p class="body body-small">${escapeHtml(buildProductMetaNarrative(product))}</p>
        <table class="spec-table">
          ${specRow('Price', productPrice(product))}
          ${specRow('MRP', productMrp(product))}
          ${specRow('Category', categoryPath)}
          ${specRow('Craft', craft)}
          ${specRow('Region', region)}
          ${specRow('Material', material)}
          ${specRow('Technique', technique)}
          ${specRow('Occasion', occasion)}
          ${specRow('Stock', [stockLabel, inventory ? `${inventory} units` : ''].filter(Boolean).join(' · '))}
          ${specRow('Care', care)}
          ${specRow('Sustainability', sustainability)}
        </table>
      </div>
    </div>
  </section>`;
}

function renderFounderClosing(
  engineOutput: PremiumCatalogueEngineOutput,
  founderName: string,
  brandName: string
): string {
  return `<section class="page closing-page">
    <div class="page-border"></div>
    <div class="page-pad founder-layout closing-layout">
      <div class="founder-panel">
        <div class="eyebrow">Founder Ending Note</div>
        <h2 class="section-title">A closing note from ${escapeHtml(founderName)}</h2>
        <div class="rule"></div>
        <p class="body body-large">${escapeHtml(buildFounderEndingNote(engineOutput, founderName))}</p>
        <div class="quote-block">
          <span class="quote-label">Closing Quote</span>
          <p>${escapeHtml(buildFounderEndingQuote(engineOutput, founderName))}</p>
        </div>
        <div class="signature">${escapeHtml(buildFounderSignature(founderName))}</div>
      </div>
      <div class="founder-accent">
        <div class="smallcaps">${escapeHtml(brandName)} closing frame</div>
        <p class="body body-small">The document closes in the same voice with which it opened: founder-led, craft-forward, and deliberate about the emotional language of luxury.</p>
      </div>
    </div>
  </section>`;
}

export function renderNeejeeFounderLuxuryCatalogueHtmlDocument(
  engineOutput: PremiumCatalogueEngineOutput,
  options: RenderOptions = {}
): string {
  const founderName = options.founderName || 'Nidhi Chauhan';
  const brandName = options.brandName || 'Neejee';
  const includeFounderNotes = options.includeFounderNotes !== false;
  const hero = engineOutput.heroProduct || engineOutput.products[0] || null;
  const title = text(options.template?.title || engineOutput.brief.title, `${brandName} Luxury Catalogue`);
  const sections = (options.template?.blocks || []).filter((block) => block.products.length > 0);

  const productPages = engineOutput.products
    .map((product, index) => renderProductSpread(product, founderName, index))
    .join('');

  const sectionDividers = sections
    .map((block) => renderSectionDivider(block.title, buildSectionIntro(block.title, block.products.length), block.products.length))
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --paper: #f5efe6;
      --card: rgba(255, 251, 245, 0.84);
      --ink: #1f1914;
      --muted: #5e5145;
      --earth: #6f4b2f;
      --rust: #8d3f2f;
      --gold: #a87f3a;
      --line: rgba(91, 63, 40, 0.28);
      --sand: rgba(232, 220, 203, 0.55);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: Georgia, 'Times New Roman', serif;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    .page {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      background: var(--paper);
      overflow: hidden;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .page-border {
      position: absolute;
      inset: 10mm;
      border: 1px solid var(--line);
      pointer-events: none;
    }
    .page-pad {
      position: relative;
      z-index: 2;
      padding: 17mm 18mm;
    }
    .eyebrow, .smallcaps, .quote-label, .stat-label {
      font-family: Arial, sans-serif;
      text-transform: uppercase;
      letter-spacing: .2em;
    }
    .eyebrow {
      font-size: 9px;
      color: var(--rust);
      margin-bottom: 4mm;
    }
    .smallcaps, .stat-label {
      font-size: 8px;
      color: #6d6156;
    }
    .display-title, .section-title, .subtitle, .body, p, h1, h2, h3, h4 { margin: 0; }
    .display-title {
      font-size: 42pt;
      line-height: .96;
      letter-spacing: -.035em;
      font-weight: 600;
    }
    .display-title.small { font-size: 30pt; }
    .section-title {
      font-size: 28pt;
      line-height: 1.02;
      letter-spacing: -.02em;
      font-weight: 600;
    }
    .subtitle {
      margin-top: 2mm;
      color: var(--muted);
      font-style: italic;
      font-size: 14pt;
      line-height: 1.35;
    }
    .body {
      color: #2f2721;
      font-size: 12.5pt;
      line-height: 1.6;
      text-align: justify;
    }
    .body-large { font-size: 13.7pt; }
    .body-small { font-size: 10.7pt; }
    .rule {
      width: 28mm;
      height: 1px;
      background: rgba(141, 63, 47, .38);
      margin: 4mm 0 5mm;
    }
    .cover-grid {
      min-height: 262mm;
      display: grid;
      grid-template-columns: 1.02fr .98fr;
      gap: 9mm;
      align-items: stretch;
    }
    .cover-copy, .cover-visual, .founder-panel, .founder-accent, .spec-panel, .toc-item, .stat-card {
      background: var(--card);
      border: 1px solid rgba(111, 75, 47, 0.14);
      backdrop-filter: blur(3px);
    }
    .cover-copy {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 7mm;
    }
    .cover-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm;
      margin-top: 6mm;
    }
    .stat-card {
      padding: 4mm;
      min-height: 22mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .cover-visual {
      display: grid;
      grid-template-rows: 1fr auto;
      padding: 4mm;
      gap: 3mm;
    }
    .cover-image {
      width: 100%;
      height: 202mm;
      object-fit: cover;
      display: block;
      border-radius: 22mm 22mm 5mm 5mm;
      box-shadow: 0 20px 52px rgba(33, 23, 17, 0.22);
    }
    .cover-caption {
      padding: 3mm 2mm 1mm;
    }
    .caption-title { font-size: 15pt; margin-top: 1.5mm; }
    .caption-line { color: var(--muted); font-size: 11.5pt; margin-top: 1mm; }
    .founder-layout {
      min-height: 262mm;
      display: grid;
      grid-template-columns: 1.18fr .82fr;
      gap: 8mm;
      align-items: stretch;
    }
    .founder-panel, .founder-accent {
      padding: 8mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .founder-accent {
      background: linear-gradient(180deg, rgba(168, 127, 58, 0.08), rgba(141, 63, 47, 0.08));
    }
    .quote-block {
      margin-top: 6mm;
      padding: 5mm;
      border-left: 2px solid rgba(141, 63, 47, 0.45);
      background: rgba(255, 250, 244, 0.5);
    }
    .quote-block.compact { margin-top: 5mm; }
    .quote-block.sand { background: var(--sand); }
    .quote-label {
      display: block;
      margin-bottom: 2mm;
      font-size: 8px;
      color: var(--rust);
    }
    .quote-block p {
      font-size: 11.4pt;
      line-height: 1.5;
      color: #473b31;
      font-style: italic;
    }
    .signature {
      margin-top: 8mm;
      font-family: Arial, sans-serif;
      text-transform: uppercase;
      letter-spacing: .18em;
      color: #6d6156;
      font-size: 10px;
    }
    .toc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm;
      margin-top: 7mm;
    }
    .toc-item {
      display: flex;
      gap: 4mm;
      align-items: baseline;
      padding: 4mm;
      min-height: 17mm;
    }
    .toc-item span {
      font-family: Arial, sans-serif;
      font-size: 10px;
      letter-spacing: .18em;
      color: var(--rust);
      min-width: 12mm;
    }
    .toc-item strong {
      font-size: 11pt;
      line-height: 1.35;
      color: #312821;
    }
    .toc-footer {
      margin-top: 8mm;
      color: #65584b;
      font-family: Arial, sans-serif;
      font-size: 9px;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    .hero-grid, .product-grid {
      display: grid;
      grid-template-columns: .96fr 1.04fr;
      gap: 10mm;
      align-items: center;
    }
    .hero-image-wrap, .product-main-image {
      background: rgba(255, 251, 245, 0.58);
      border: 1px solid rgba(111, 75, 47, 0.18);
      padding: 4mm;
    }
    .hero-image, .spread-image {
      width: 100%;
      height: 162mm;
      object-fit: cover;
      display: block;
    }
    .product-page.alt .product-grid { grid-template-columns: 1.04fr .96fr; }
    .product-page.alt .product-main-image { order: 2; }
    .product-page.alt .product-main-copy { order: 1; }
    .price-row {
      display: flex;
      gap: 4mm;
      align-items: baseline;
      margin-top: 5mm;
    }
    .price {
      font-size: 22pt;
      font-weight: 600;
      color: var(--ink);
    }
    .mrp {
      font-size: 10.5pt;
      color: #7b6f63;
      text-decoration: line-through;
      font-family: Arial, sans-serif;
    }
    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 2.5mm;
      margin-top: 4mm;
    }
    .badge {
      border: 1px solid rgba(168, 127, 58, .34);
      color: #6f542d;
      background: rgba(255, 251, 245, .72);
      padding: 1.8mm 2.3mm;
      font-family: Arial, sans-serif;
      font-size: 8px;
      letter-spacing: .15em;
      text-transform: uppercase;
    }
    .product-lower-grid {
      padding-top: 0;
      display: grid;
      grid-template-columns: 1.02fr .98fr;
      gap: 8mm;
      align-items: stretch;
    }
    .gallery-stack {
      display: grid;
      grid-template-rows: 1fr auto;
      gap: 4mm;
    }
    .gallery-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm;
    }
    .gallery-tall {
      width: 100%;
      height: 94mm;
      object-fit: cover;
      display: block;
      border: 1px solid rgba(111, 75, 47, 0.14);
    }
    .gallery-small {
      width: 100%;
      height: 44mm;
      object-fit: cover;
      display: block;
      border: 1px solid rgba(111, 75, 47, 0.14);
    }
    .spec-panel {
      padding: 5mm;
    }
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4mm;
      font-family: Arial, sans-serif;
      font-size: 9pt;
      color: #40362d;
    }
    .spec-table td {
      padding: 2.2mm 0;
      border-bottom: 1px solid rgba(111, 75, 47, 0.14);
      vertical-align: top;
    }
    .spec-table td:first-child {
      width: 31%;
      text-transform: uppercase;
      letter-spacing: .12em;
      color: #7a6959;
      font-size: 7.6pt;
    }
    .divider-layout {
      min-height: 262mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      max-width: 135mm;
    }
    .divider-meta {
      margin-top: 6mm;
      font-family: Arial, sans-serif;
      font-size: 10px;
      letter-spacing: .2em;
      text-transform: uppercase;
      color: #6d6156;
    }
    .closing-layout .founder-accent {
      justify-content: flex-end;
    }
    .img-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      background: #efe6d9;
      color: #6f6154;
      border: 1px dashed rgba(111, 75, 47, 0.2);
      text-align: center;
      padding: 6mm;
    }
    .cover-image.img-placeholder { height: 202mm; border-radius: 22mm 22mm 5mm 5mm; }
    .hero-image.img-placeholder, .spread-image.img-placeholder { height: 162mm; }
    .gallery-tall.img-placeholder { height: 94mm; }
    .gallery-small.img-placeholder { height: 44mm; }
    @media print {
      body { background: white; }
      .page { margin: 0; }
    }
  </style>
</head>
<body>
  ${renderCover(engineOutput, brandName, title, hero)}
  ${includeFounderNotes ? renderFounderPreNote(engineOutput, founderName, brandName) : ''}
  ${renderContents(engineOutput, brandName)}
  ${hero ? renderHeroSpread(hero, founderName, title) : ''}
  ${sectionDividers}
  ${productPages}
  ${includeFounderNotes ? renderFounderClosing(engineOutput, founderName, brandName) : ''}
</body>
</html>`;
}
