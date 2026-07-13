import { CatalogueBuilderProduct, CatalogueProject } from '@/lib/catalogue-builder/contracts';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Price on request';
  return `₹${(value / 100).toLocaleString('en-IN')}`;
}

function effectivePrice(product: CatalogueBuilderProduct): number | null {
  return product.salePrice ?? product.sellingPrice ?? product.mrp ?? null;
}

function firstImage(product: CatalogueBuilderProduct): string {
  return product.image || product.images[0] || 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80';
}

function resolveNarrative(project: CatalogueProject, product: CatalogueBuilderProduct): string {
  return (
    project.sections.copy.productNarratives[product.id] ||
    project.sections.copy.productNarratives[product.slug || ''] ||
    product.story ||
    product.description ||
    product.poeticLine ||
    `A considered piece chosen for its material presence, craft clarity, and the quiet confidence it brings into a room.`
  );
}

function resolveQuote(project: CatalogueProject, product: CatalogueBuilderProduct): string {
  return (
    project.sections.copy.productPullQuotes[product.id] ||
    project.sections.copy.productPullQuotes[product.slug || ''] ||
    product.poeticLine ||
    `${product.name} carries the kind of detail that rewards a slower gaze.`
  );
}

function productCard(project: CatalogueProject, product: CatalogueBuilderProduct, index: number) {
  const narrative = resolveNarrative(project, product);
  const quote = resolveQuote(project, product);
  const image = firstImage(product);
  const price = money(effectivePrice(product));
  const compare = product.mrp && effectivePrice(product) && product.mrp > (effectivePrice(product) || 0)
    ? money(product.mrp)
    : null;

  return `
    <section class="sheet product-sheet">
      <div class="product-hero media-fill">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" />
        <div class="overlay"></div>
      </div>
      <div class="product-layout">
        <div class="product-kicker">Selection ${String(index + 1).padStart(2, '0')}</div>
        <h2 class="product-title">${escapeHtml(product.name)}</h2>
        <p class="product-meta">${escapeHtml([product.categoryName, product.craft, product.region].filter(Boolean).join(' · '))}</p>
        <div class="product-price-row">
          <span class="product-price">${escapeHtml(price)}</span>
          ${compare ? `<span class="product-compare">${escapeHtml(compare)}</span>` : ''}
        </div>
        <blockquote class="product-quote">“${escapeHtml(quote)}”</blockquote>
        <p class="product-copy">${escapeHtml(narrative)}</p>
        <div class="spec-grid">
          <div><span>Material</span><strong>${escapeHtml(product.material || '—')}</strong></div>
          <div><span>Technique</span><strong>${escapeHtml(product.technique || '—')}</strong></div>
          <div><span>Occasion</span><strong>${escapeHtml(product.occasion || '—')}</strong></div>
          <div><span>Inventory</span><strong>${escapeHtml(String(product.totalInventory || 0))}</strong></div>
        </div>
        <p class="signature">${escapeHtml(project.sections.copy.founderName)}</p>
      </div>
    </section>
  `;
}

export function renderCatalogueProjectHtml(project: CatalogueProject): string {
  const coverProduct = project.products.find((item) => item.cataloguePinHero) || project.products[0] || null;
  const coverImage = project.sections.config.coverImage || (coverProduct ? firstImage(coverProduct) : '');
  const now = new Date(project.updatedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(project.sections.copy.title)}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #111; color: #1a1613; font-family: Inter, Arial, sans-serif; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sheet { width: 210mm; min-height: 297mm; height: 297mm; page-break-after: always; position: relative; overflow: hidden; background: #f4efe6; }
      .media-fill, .media-fill img { position: absolute; inset: 0; width: 100%; height: 100%; }
      .media-fill img { object-fit: cover; }
      .overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(12,10,9,.18) 0%, rgba(12,10,9,.54) 55%, rgba(12,10,9,.82) 100%); }
      .cover-copy { position: absolute; inset: 0; padding: 22mm 18mm 18mm; display: flex; flex-direction: column; justify-content: space-between; color: #f8f2e8; }
      .brand-mark { font-size: 12px; letter-spacing: .38em; text-transform: uppercase; opacity: .95; }
      .cover-title { font-family: Georgia, 'Times New Roman', serif; font-size: 44px; line-height: 1.04; max-width: 120mm; margin: 0; }
      .cover-sub { max-width: 110mm; font-size: 12.5px; line-height: 1.7; color: rgba(248,242,232,.88); }
      .cover-foot { display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; }
      .sheet-inner { padding: 18mm 18mm 16mm; height: 100%; display: flex; flex-direction: column; }
      .eyebrow { font-size: 10px; letter-spacing: .35em; text-transform: uppercase; color: #8b2e2a; margin-bottom: 8mm; }
      .founder-title { font-family: Georgia, 'Times New Roman', serif; font-size: 28px; line-height: 1.18; margin: 0 0 10mm; max-width: 120mm; }
      .lead { font-size: 13px; line-height: 1.85; color: #352e29; white-space: pre-wrap; }
      .signature-line { margin-top: auto; padding-top: 12mm; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #8b2e2a; }
      .toc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; }
      .toc-list { border-top: 1px solid rgba(26,22,19,.16); padding-top: 6mm; }
      .toc-item { display: flex; justify-content: space-between; gap: 10mm; padding: 4mm 0; border-bottom: 1px solid rgba(26,22,19,.08); font-size: 12px; }
      .toc-item strong { font-weight: 600; }
      .product-sheet { background: #f4efe6; }
      .product-hero { left: 0; top: 0; width: 52%; height: 100%; }
      .product-layout { margin-left: 52%; height: 100%; padding: 18mm 16mm 16mm; display: flex; flex-direction: column; background: linear-gradient(180deg, rgba(244,239,230,.96) 0%, rgba(244,239,230,.98) 100%); }
      .product-kicker { font-size: 10px; letter-spacing: .35em; text-transform: uppercase; color: #8b2e2a; margin-bottom: 6mm; }
      .product-title { font-family: Georgia, 'Times New Roman', serif; font-size: 26px; line-height: 1.1; margin: 0 0 3mm; }
      .product-meta { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #6b5a52; margin: 0 0 8mm; }
      .product-price-row { display: flex; align-items: baseline; gap: 4mm; margin-bottom: 8mm; }
      .product-price { font-size: 24px; font-weight: 600; color: #1a1613; }
      .product-compare { font-size: 12px; color: #7f746e; text-decoration: line-through; }
      .product-quote { margin: 0 0 8mm; padding-left: 6mm; border-left: 2px solid rgba(139,46,42,.35); font-family: Georgia, 'Times New Roman', serif; font-size: 17px; line-height: 1.5; color: #8b2e2a; }
      .product-copy { font-size: 13px; line-height: 1.8; color: #352e29; white-space: pre-wrap; }
      .spec-grid { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; padding-top: 10mm; }
      .spec-grid div { border-top: 1px solid rgba(26,22,19,.12); padding-top: 3mm; }
      .spec-grid span { display: block; font-size: 9px; letter-spacing: .22em; text-transform: uppercase; color: #7a6d67; margin-bottom: 2mm; }
      .spec-grid strong { font-size: 12px; color: #1a1613; }
      .signature { margin-top: 8mm; font-size: 10px; letter-spacing: .28em; text-transform: uppercase; color: #8b2e2a; }
      .closing-sheet { background: #1a1613; color: #f4efe6; }
      .closing-sheet .sheet-inner { padding-top: 22mm; }
      .closing-sheet .eyebrow { color: #d5bba7; }
      .closing-sheet .founder-title { color: #f4efe6; max-width: 130mm; }
      .closing-sheet .lead { color: rgba(244,239,230,.86); }
      .closing-sheet .signature-line { color: #d5bba7; }
    </style>
  </head>
  <body>
    <section class="sheet">
      ${coverImage ? `<div class="media-fill"><img src="${escapeHtml(coverImage)}" alt="${escapeHtml(project.sections.copy.title)}" /></div><div class="overlay"></div>` : ''}
      <div class="cover-copy">
        <div>
          <div class="brand-mark">${escapeHtml(project.sections.config.brandName)}</div>
          <h1 class="cover-title">${escapeHtml(project.sections.copy.heroHeading)}</h1>
          <p class="cover-sub">${escapeHtml(project.sections.copy.heroSubheading)}</p>
        </div>
        <div class="cover-foot">
          <span>${escapeHtml(project.sections.copy.founderName)}</span>
          <span>${escapeHtml(now)}</span>
        </div>
      </div>
    </section>

    <section class="sheet">
      <div class="sheet-inner">
        <div class="eyebrow">Founder Pre-Note</div>
        <h2 class="founder-title">${escapeHtml(project.sections.copy.title)}</h2>
        <p class="lead">${escapeHtml(project.sections.copy.preNote)}</p>
        <div class="signature-line">${escapeHtml(project.sections.copy.founderName)}</div>
      </div>
    </section>

    <section class="sheet">
      <div class="sheet-inner">
        <div class="eyebrow">Catalogue Continuum</div>
        <h2 class="founder-title">Selected from live Neejee inventory</h2>
        <p class="lead">${escapeHtml(project.sections.copy.sectionIntro)}</p>
        <div class="toc-grid">
          <div class="toc-list">
            ${project.products.map((product, index) => `
              <div class="toc-item">
                <strong>${String(index + 1).padStart(2, '0')} · ${escapeHtml(product.name)}</strong>
                <span>${escapeHtml(product.categoryName || 'Selection')}</span>
              </div>
            `).join('')}
          </div>
          <div class="toc-list">
            <div class="toc-item"><strong>Founder</strong><span>${escapeHtml(project.sections.copy.founderName)}</span></div>
            <div class="toc-item"><strong>Template</strong><span>${escapeHtml(project.sections.config.templateKey)}</span></div>
            <div class="toc-item"><strong>Products</strong><span>${escapeHtml(String(project.products.length))}</span></div>
            <div class="toc-item"><strong>Status</strong><span>${escapeHtml(project.status)}</span></div>
          </div>
        </div>
      </div>
    </section>

    ${project.products.map((product, index) => productCard(project, product, index)).join('')}

    ${project.sections.config.includeClosingPage ? `
      <section class="sheet closing-sheet">
        <div class="sheet-inner">
          <div class="eyebrow">Ending Note</div>
          <h2 class="founder-title">Objects that stay should earn their place.</h2>
          <p class="lead">${escapeHtml(project.sections.copy.endingNote)}</p>
          <div class="signature-line">${escapeHtml(project.sections.copy.founderName)}</div>
        </div>
      </section>
    ` : ''}
  </body>
</html>`;
}
