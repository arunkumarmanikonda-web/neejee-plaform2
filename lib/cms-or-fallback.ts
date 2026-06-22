// v23.40.25 — Helper that lets any static page be admin-overridable via CMS.
//
// Pattern:
//   const cmsPage = await loadCmsOrNull('about-sustainability');
//   if (cmsPage) return <RenderCmsPage page={cmsPage} />;
//   // else render hard-coded fallback below
//
// This way the page never 404s (hard-coded fallback always works), AND admin
// can publish a CMS page with matching slug to override without redeploying.

import { prisma } from '@/lib/prisma';

export interface MinimalCmsPage {
  id: string;
  slug: string;
  title: string;
  template: string;
  sections: any;
  seoTitle: string | null;
  seoDesc: string | null;
  ogImage: string | null;
}

/** Returns the CMS page for `slug` if it exists AND is PUBLISHED, else null. */
export async function loadCmsOrNull(slug: string): Promise<MinimalCmsPage | null> {
  try {
    const page = await prisma.cmsPage.findUnique({ where: { slug } });
    if (!page || page.status !== 'PUBLISHED') return null;
    return page as any;
  } catch {
    return null;
  }
}
