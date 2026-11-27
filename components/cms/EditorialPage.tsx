import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SectionRenderer } from '@/components/cms/SectionRenderer';
import { SECTION_TYPES, isSectionVisibleNow, type Section } from '@/lib/cms-sections';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { publicEditorialWhere } from '@/lib/public-editorial';

type Kind = 'journal' | 'pages';
const loadStory = cache((slug: string, kind: Kind) => prisma.cmsPage.findFirst({
  where: { AND: [publicEditorialWhere, {slug, pageType: kind === 'journal' ? 'journal' : {in:['page','lookbook']}}] },
  select: { title: true, seoTitle: true, seoDesc: true, excerpt: true, sections: true, ogImage: true, coverImage: true },
}));

export async function editorialMetadata(slug:string, kind:Kind): Promise<Metadata> {
  const story = await loadStory(slug,kind);
  if (!story) return {title:'Page unavailable',robots:{index:false}};
  const cover = story.ogImage || story.coverImage;
  return {
    title:story.seoTitle || story.title, description:story.seoDesc || story.excerpt || undefined,
    alternates:{canonical:'/'+kind+'/'+encodeURIComponent(slug)},
    openGraph:{type:kind==='journal'?'article':'website',title:story.title,...(cover && {images:[cover]})},
  };
}

export async function EditorialPage({slug,kind}:{slug:string;kind:Kind}) {
  const story = await loadStory(slug,kind);
  if (!story) notFound();
  const blocks = (Array.isArray(story.sections) ? story.sections : []).filter((item): boolean => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    return SECTION_TYPES.some(s => s.type === item.type) && !!item.data && typeof item.data === 'object';
  }) as unknown as Section[];
  const signedIn = blocks.some(s => s.visibility?.audience && s.visibility.audience !== 'all') && !!(await getSession());
  const visible = blocks.filter(s => isSectionVisibleNow(s) &&
    (s.visibility?.audience !== 'signed-in' || signedIn) && (s.visibility?.audience !== 'guest' || !signedIn));
  const hasHeading = visible.some(s => ['journalEntry', 'hero', 'videoHero'].includes(s.type) && s.data.title && (!s.visibility?.showOn || s.visibility.showOn === 'all'));
  return (
    <>
      <Header />
      <main>
        <nav aria-label="Breadcrumb" className="max-w-3xl mx-auto px-6 pt-7">
          <Link href={kind === 'journal' ? '/journal' : '/'} className="font-ui text-sm text-madder underline underline-offset-4">{kind==='journal'?'The Journal':'Neejee home'}</Link>
        </nav>
        {!hasHeading && <h1 className="max-w-3xl mx-auto px-6 pt-10 font-display text-4xl">{story.title}</h1>}
        {visible.map((section, i) => (
          <div key={section.id || i} className={section.visibility?.showOn === 'mobile' ? 'md:hidden' : section.visibility?.showOn === 'desktop' ? 'hidden md:block' : undefined}>
            <SectionRenderer section={section} />
          </div>
        ))}
      </main>
      <Footer />
    </>
  );
}
