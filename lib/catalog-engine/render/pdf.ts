import { renderPremiumCatalogueHtmlDocument } from './html';
import type { PremiumCatalogueRenderContext } from './contracts';
import { renderHtmlToPdfBuffer } from '@/lib/catalogue-builder/pdf';

export async function renderPremiumCataloguePdfBuffer(context: PremiumCatalogueRenderContext): Promise<Buffer> {
  const html = renderPremiumCatalogueHtmlDocument(context);
  return renderHtmlToPdfBuffer(html);
}
