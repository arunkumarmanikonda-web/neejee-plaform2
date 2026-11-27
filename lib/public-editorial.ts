import type { Prisma } from '@prisma/client';
import { CMS_TEMPLATES } from '@/lib/cms-templates';
export const editorialTemplates = [...new Set(['default','page','lookbook','editorial',...CMS_TEMPLATES.map(t=>t.key)])];
export const publicEditorialWhere: Prisma.CmsPageWhereInput = {
  status:'PUBLISHED', pageType:{in:['page','journal','lookbook']},
  template:{in:editorialTemplates}, slug:{notIn:['about','about-page','home-founder-note']},
};
