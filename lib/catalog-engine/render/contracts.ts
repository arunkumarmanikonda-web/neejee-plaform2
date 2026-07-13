import type { PremiumCatalogueEngineOutput } from '../contracts';
import type { PremiumCatalogueTemplateRenderResult } from '../templates';

export const PREMIUM_CATALOGUE_EXPORT_VERSION = 'phase2.catalogue-export.v1';

export const PREMIUM_CATALOGUE_EXPORT_FORMATS = ['json', 'html', 'pdf'] as const;

export type PremiumCatalogueExportFormat =
  (typeof PREMIUM_CATALOGUE_EXPORT_FORMATS)[number];

export interface PremiumCatalogueRenderContext {
  engineOutput: PremiumCatalogueEngineOutput;
  template: PremiumCatalogueTemplateRenderResult;
}

export interface PremiumCatalogueExportManifest {
  version: typeof PREMIUM_CATALOGUE_EXPORT_VERSION;
  generatedAt: string;
  title: string;
  slug: string;
  templateKey: PremiumCatalogueTemplateRenderResult['templateKey'];
  selectionKey: string;
  productCount: number;
  sectionCount: number;
  htmlFileName: string;
  pdfFileName: string;
}
