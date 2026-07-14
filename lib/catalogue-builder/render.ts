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
  return (
    product.image ||
    product.images[0] ||
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80'
  );
}

function resolveNarrative(project: CatalogueProject, product: CatalogueBuilderProduct): string {
  return (
    project.sections.copy.productNarratives[product.id] ||
    project.sections.copy.productNarratives[product.slug || ''] ||
    product.story ||
    product.description ||
    product.poeticLine ||
    'A considered piece chosen for its material presence, craft clarity, and the quiet confidence it brings into a room.'
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

function productMeta(product: CatalogueBuilderProduct): string {
  return [product.categoryName, product.craft, product.region].filter(Boolean).join(' · ');
}

function productCard(project: CatalogueProject, product: CatalogueBuilderProduct, index: number) {
  const narrative = resolveNarrative(project, product);
  const quote = resolveQuote(project, product);
  const image = firstImage(product);
  const price = money(effectivePrice(product));
  const compare =
    product.mrp && effectivePrice(product) && product.mrp > (effectivePrice(product) || 0)
      ? money(product.mrp)
      : null;

  return `
    <section class="sheet">
      <div class="page-frame">
        <div class="page-header">
          <div class="brand-lockup">
            <div class="brand-name">${escapeHtml(project.sections.config.brandName || 'NEEJEE')}</div>
            <div class="brand-rule"></div>
          </div>
          <div class="page-label">Selection ${String(index + 1).padStart(2, '0')}</div>
        </div>

        <div class="product-image-box">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" />
        </div>

        <div class="product-content">
          <div class="product-topline">${escapeHtml(productMeta(product) || 'Neejee Catalogue Selection')}</div>

          <h2 class="product-title">${escapeHtml(product.name)}</h2>

          <div class="price-row">
            <span class="price-current">${escapeHtml(price)}</span>
            ${compare ? `<span class="price-compare">${escapeHtml(compare)}</span>` : ''}
          </div>

          <blockquote class="pull-quote">“${escapeHtml(quote)}”</blockquote>

          <p class="body-copy">${escapeHtml(narrative)}</p>

          <div class="spec-table">
            <div class="spec-row"><span class="spec-key">Material</span><span class="spec-value">${escapeHtml(product.material || '—')}</span></div>
            <div class="spec-row"><span class="spec-key">Technique</span><span class="spec-value">${escapeHtml(product.technique || '—')}</span></div>
            <div class="spec-row"><span class="spec-key">Occasion</span><span class="spec-value">${escapeHtml(product.occasion || '—')}</span></div>
            <div class="spec-row"><span class="spec-key">Inventory</span><span class="spec-value">${escapeHtml(String(product.totalInventory || 0))}</span></div>
          </div>

          <div class="signature-block">
            <div class="signature-line"></div>
            <div class="signature-name">${escapeHtml(project.sections.copy.founderName)}</div>
          </div>
        </div>
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
      @page { size: A4 portrait; margin: 0; }

      * { box-sizing: border-box; }

      html, body {
        margin: 0;
        padding: 0;
        background: #ece6dc;
        color: #1f1c18;
        font-family: Inter, Arial, sans-serif;
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .sheet {
        width: 210mm;
        min-height: 297mm;
        height: 297mm;
        padding: 10mm;
        page-break-after: always;
        background: #ece6dc;
      }

      .sheet:last-child {
        page-break-after: auto;
      }

      .page-frame {
        height: 100%;
        border: 1.2px solid #2a241e;
        background: #fffdf8;
        padding: 12mm;
        position: relative;
        overflow: hidden;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8mm;
      }

      .brand-lockup {
        display: flex;
        flex-direction: column;
        gap: 2mm;
      }

      .brand-name {
        font-size: 10px;
        letter-spacing: .36em;
        text-transform: uppercase;
        color: #1f1c18;
      }

      .brand-rule {
        width: 34mm;
        height: 1px;
        background: #8a7a67;
      }

      .page-label {
        font-size: 9.5px;
        letter-spacing: .24em;
        text-transform: uppercase;
        color: #6f6255;
      }

      .cover-grid {
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        gap: 7mm;
        height: calc(100% - 15mm);
      }

      .cover-kicker {
        font-size: 10px;
        letter-spacing: .28em;
        text-transform: uppercase;
        color: #7f6d5d;
      }

      .cover-title {
        margin: 0;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 31px;
        line-height: 1.12;
        color: #171411;
      }

      .cover-sub {
        margin: 0;
        font-size: 12.4px;
        line-height: 1.85;
        color: #40372f;
        text-align: justify;
        text-justify: inter-word;
      }

      .cover-image-box {
        border: 1px solid #bba996;
        background: #f3ede3;
        overflow: hidden;
        min-height: 126mm;
      }

      .cover-image-box img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .cover-footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        border-top: 1px solid #c9bbac;
        padding-top: 4mm;
      }

      .cover-footer-label {
        font-size: 9.5px;
        letter-spacing: .22em;
        text-transform: uppercase;
        color: #6f6255;
      }

      .cover-footer-value {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 12px;
        color: #171411;
      }

      .section-kicker {
        font-size: 10px;
        letter-spacing: .32em;
        text-transform: uppercase;
        color: #7f6d5d;
        margin-bottom: 6mm;
      }

      .section-title {
        margin: 0 0 7mm;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 27px;
        line-height: 1.18;
        color: #171411;
      }

      .body-copy, .lead-copy, .closing-copy {
        margin: 0;
        font-size: 12.4px;
        line-height: 1.88;
        color: #302923;
        text-align: justify;
        text-justify: inter-word;
        white-space: pre-wrap;
      }

      .founder-signoff {
        margin-top: auto;
        padding-top: 10mm;
      }

      .founder-signoff .name {
        font-size: 10px;
        letter-spacing: .26em;
        text-transform: uppercase;
        color: #171411;
      }

      .toc-grid {
        display: grid;
        grid-template-columns: 1.35fr .85fr;
        gap: 10mm;
        margin-top: 4mm;
      }

      .toc-card,
      .meta-card {
        border: 1px solid #c9bbac;
        padding: 6mm;
        background: #fffaf3;
      }

      .toc-item,
      .meta-item {
        display: flex;
        justify-content: space-between;
        gap: 6mm;
        padding: 3mm 0;
        border-bottom: 1px solid #e2d8cb;
        font-size: 11.5px;
      }

      .toc-item:last-child,
      .meta-item:last-child {
        border-bottom: 0;
      }

      .toc-item strong,
      .meta-item strong {
        font-weight: 600;
        color: #171411;
      }

      .toc-item span,
      .meta-item span {
        color: #5f5449;
        text-align: right;
      }

      .product-image-box {
        width: 100%;
        height: 108mm;
        border: 1px solid #bba996;
        background: #f3ede3;
        overflow: hidden;
        margin-bottom: 8mm;
      }

      .product-image-box img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .product-content {
        display: flex;
        flex-direction: column;
        min-height: calc(100% - 126mm);
      }

      .product-topline {
        font-size: 10px;
        letter-spacing: .2em;
        text-transform: uppercase;
        color: #6f6255;
        margin-bottom: 3mm;
      }

      .product-title {
        margin: 0 0 4mm;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 24px;
        line-height: 1.16;
        color: #171411;
      }

      .price-row {
        display: flex;
        align-items: baseline;
        gap: 4mm;
        margin-bottom: 6mm;
      }

      .price-current {
        font-size: 20px;
        font-weight: 600;
        color: #171411;
      }

      .price-compare {
        font-size: 11px;
        color: #7e7064;
        text-decoration: line-through;
      }

      .pull-quote {
        margin: 0 0 6mm;
        padding: 4mm 0 4mm 5mm;
        border-left: 2px solid #a58b73;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 15.5px;
        line-height: 1.6;
        color: #59483a;
      }

      .spec-table {
        margin-top: auto;
        border: 1px solid #c9bbac;
        background: #fffaf3;
      }

      .spec-row {
        display: grid;
        grid-template-columns: 38mm 1fr;
        gap: 5mm;
        padding: 3.4mm 4mm;
        border-bottom: 1px solid #e2d8cb;
      }

      .spec-row:last-child {
        border-bottom: 0;
      }

      .spec-key {
        font-size: 9px;
        letter-spacing: .22em;
        text-transform: uppercase;
        color: #6f6255;
      }

      .spec-value {
        font-size: 11.5px;
        color: #171411;
      }

      .signature-block {
        margin-top: 7mm;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2mm;
      }

      .signature-line {
        width: 32mm;
        height: 1px;
        background: #8a7a67;
      }

      .signature-name {
        font-size: 10px;
        letter-spacing: .24em;
        text-transform: uppercase;
        color: #171411;
      }

      .closing-layout {
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        gap: 8mm;
        height: calc(100% - 15mm);
      }

      .closing-box {
        border: 1px solid #c9bbac;
        padding: 8mm;
        background: #fffaf3;
      }
    </style>
  </head>
  <body>
    <section class="sheet">
      <div class="page-frame">
        <div class="page-header">
          <div class="brand-lockup">
            <div class="brand-name">${escapeHtml(project.sections.config.brandName || 'NEEJEE')}</div>
            <div class="brand-rule"></div>
          </div>
          <div class="page-label">Founder-Led Catalogue</div>
        </div>

        <div class="cover-grid">
          <div class="cover-kicker">Curated Inventory Dossier</div>

          <div>
            <h1 class="cover-title">${escapeHtml(project.sections.copy.heroHeading)}</h1>
            <p class="cover-sub">${escapeHtml(project.sections.copy.heroSubheading)}</p>
          </div>

          <div class="cover-image-box">
            ${coverImage ? `<img src="${escapeHtml(coverImage)}" alt="${escapeHtml(project.sections.copy.title)}" />` : ''}
          </div>

          <div class="cover-footer">
            <div>
              <div class="cover-footer-label">Founder</div>
              <div class="cover-footer-value">${escapeHtml(project.sections.copy.founderName)}</div>
            </div>
            <div style="text-align:right">
              <div class="cover-footer-label">Issue Date</div>
              <div class="cover-footer-value">${escapeHtml(now)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="sheet">
      <div class="page-frame" style="display:flex; flex-direction:column;">
        <div class="page-header">
          <div class="brand-lockup">
            <div class="brand-name">${escapeHtml(project.sections.config.brandName || 'NEEJEE')}</div>
            <div class="brand-rule"></div>
          </div>
          <div class="page-label">Founder Note</div>
        </div>

        <div class="section-kicker">Founder Pre-Note</div>
        <h2 class="section-title">${escapeHtml(project.sections.copy.title)}</h2>
        <p class="lead-copy">${escapeHtml(project.sections.copy.preNote)}</p>

        <div class="founder-signoff">
          <div class="signature-line"></div>
          <div class="name">${escapeHtml(project.sections.copy.founderName)}</div>
        </div>
      </div>
    </section>

    <section class="sheet">
      <div class="page-frame">
        <div class="page-header">
          <div class="brand-lockup">
            <div class="brand-name">${escapeHtml(project.sections.config.brandName || 'NEEJEE')}</div>
            <div class="brand-rule"></div>
          </div>
          <div class="page-label">Overview</div>
        </div>

        <div class="section-kicker">Catalogue Summary</div>
        <h2 class="section-title">Selected from live Neejee inventory</h2>
        <p class="lead-copy">${escapeHtml(project.sections.copy.sectionIntro)}</p>

        <div class="toc-grid">
          <div class="toc-card">
            ${project.products.map((product, index) => `
              <div class="toc-item">
                <strong>${String(index + 1).padStart(2, '0')} · ${escapeHtml(product.name)}</strong>
                <span>${escapeHtml(product.categoryName || 'Selection')}</span>
              </div>
            `).join('')}
          </div>

          <div class="meta-card">
            <div class="meta-item"><strong>Founder</strong><span>${escapeHtml(project.sections.copy.founderName)}</span></div>
            <div class="meta-item"><strong>Template</strong><span>${escapeHtml(project.sections.config.templateKey)}</span></div>
            <div class="meta-item"><strong>Products</strong><span>${escapeHtml(String(project.products.length))}</span></div>
            <div class="meta-item"><strong>Status</strong><span>${escapeHtml(project.status)}</span></div>
          </div>
        </div>
      </div>
    </section>

    ${project.products.map((product, index) => productCard(project, product, index)).join('')}

    ${project.sections.config.includeClosingPage ? `
      <section class="sheet">
        <div class="page-frame">
          <div class="page-header">
            <div class="brand-lockup">
              <div class="brand-name">${escapeHtml(project.sections.config.brandName || 'NEEJEE')}</div>
              <div class="brand-rule"></div>
            </div>
            <div class="page-label">Closing Note</div>
          </div>

          <div class="closing-layout">
            <div class="section-kicker">Closing Reflection</div>
            <h2 class="section-title">Objects that stay should earn their place.</h2>
            <div class="closing-box">
              <p class="closing-copy">${escapeHtml(project.sections.copy.endingNote)}</p>
            </div>
            <div class="founder-signoff">
              <div class="signature-line"></div>
              <div class="name">${escapeHtml(project.sections.copy.founderName)}</div>
            </div>
          </div>
        </div>
      </section>
    ` : ''}
  </body>
</html>`;
}