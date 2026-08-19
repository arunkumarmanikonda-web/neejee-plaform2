// The NEEJEE Journal — editorial landing page.
// Lists only PUBLISHED CmsPage rows where pageType = 'journal'.
import { cache } from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const loadJournal = cache(async () => {
  try {
    return await prisma.cmsPage.findMany({
      where: { pageType: 'journal', status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 50,
      select: {
        id: true, slug: true, title: true, excerpt: true, coverImage: true,
        author: true, featured: true, tags: true, publishedAt: true, updatedAt: true,
      },
    });
  } catch {
    return [];
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const entries = await loadJournal();
  const indexable = entries.length > 0;
  return {
    title: 'The Journal',
    description: 'NEEJEE notes on craft, curation, provenance, care and the stories behind published pieces.',
    alternates: { canonical: '/journal' },
    robots: {
      index: indexable,
      follow: true,
      googleBot: { index: indexable, follow: true },
    },
  };
}

export default async function JournalLanding() {
  const entries = await loadJournal();
  const featured = entries.filter(e => e.featured)[0] || entries[0] || null;
  const rest = entries.filter(e => e.id !== featured?.id);

  const allTags = Array.from(new Set(entries.flatMap(e => e.tags || []))).sort();

  return (
    <>
      <Header />

      <section className="bg-beige py-20 px-6 text-center">
        <p className="label text-madder">QUIET DISPATCHES</p>
        <h1 className="font-display text-5xl md:text-6xl text-kohl mt-4">The Journal</h1>
        <p className="font-italic italic text-mitti text-lg mt-4 max-w-xl mx-auto">
          Notes on craft, curation, provenance, care, and the pieces we choose to publish.
        </p>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-16">
        {entries.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-2xl text-kohl">The journal is being written.</p>
            <p className="font-italic italic text-mitti mt-2">Published entries will appear here as they are ready.</p>
          </div>
        ) : (
          <>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-12 justify-center">
                {allTags.slice(0, 12).map(tag => (
                  <span key={tag} className="text-xs tracking-widest bg-beige text-mitti px-3 py-1.5 uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {featured && (
              <Link
                href={`/p/${featured.slug}`}
                className="block group mb-20 grid md:grid-cols-2 gap-8 items-center"
              >
                <div className="aspect-[4/3] bg-mitti/10 overflow-hidden">
                  {featured.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={featured.coverImage} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-banarasi/30 to-madder/20" />
                  )}
                </div>
                <div>
                  <p className="label text-madder">FEATURED</p>
                  <h2 className="font-display text-4xl text-kohl mt-3 group-hover:text-madder transition-colors">
                    {featured.title}
                  </h2>
                  {featured.excerpt && (
                    <p className="font-italic italic text-mitti text-lg mt-4 leading-relaxed">
                      {featured.excerpt}
                    </p>
                  )}
                  <p className="text-xs tracking-widest text-mitti mt-6">
                    BY {(featured.author || 'NEEJEE').toUpperCase()}
                    {' · '}
                    {(featured.publishedAt || featured.updatedAt) && new Date(featured.publishedAt || featured.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="font-display text-madder mt-4">READ →</p>
                </div>
              </Link>
            )}

            {rest.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                {rest.map(e => (
                  <Link key={e.id} href={`/p/${e.slug}`} className="group">
                    <div className="aspect-[4/5] bg-mitti/10 overflow-hidden mb-4">
                      {e.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.coverImage} alt={e.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-beige to-mitti/20" />
                      )}
                    </div>
                    <p className="text-xs tracking-widest text-mitti">
                      {(e.publishedAt || e.updatedAt) && new Date(e.publishedAt || e.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <h3 className="font-display text-2xl text-kohl mt-2 group-hover:text-madder transition-colors">
                      {e.title}
                    </h3>
                    {e.excerpt && (
                      <p className="font-italic italic text-mitti text-sm mt-2 line-clamp-3">
                        {e.excerpt}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </>
  );
}
