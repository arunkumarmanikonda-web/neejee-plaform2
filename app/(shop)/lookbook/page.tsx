// Lookbook landing — lists all PUBLISHED CmsPage rows where pageType = 'lookbook'.
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Lookbooks · NEEJEE',
  description: 'How to wear it. Lookbook spreads from our seasons.',
};

async function loadLookbooks() {
  try {
    return await prisma.cmsPage.findMany({
      where: { pageType: 'lookbook', status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 30,
      select: {
        id: true, slug: true, title: true, excerpt: true, coverImage: true,
        tags: true, publishedAt: true, updatedAt: true,
      },
    });
  } catch {
    return [];
  }
}

export default async function LookbookLanding() {
  const lookbooks = await loadLookbooks();

  return (
    <>
      <Header />

      <section className="bg-kohl text-ivory py-20 px-6 text-center">
        <p className="label text-banarasi">HOW TO WEAR IT</p>
        <h1 className="font-display text-5xl md:text-6xl mt-4">Lookbooks</h1>
        <p className="font-italic italic text-ivory/80 text-lg mt-4 max-w-xl mx-auto">
          Seasonal spreads. Curated styling. One piece, three ways.
        </p>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-16">
        {lookbooks.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-2xl text-kohl">Lookbooks coming this season.</p>
            <p className="font-italic italic text-mitti mt-2">Our editorial team is shooting now.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-16">
            {lookbooks.map(l => (
              <Link key={l.id} href={`/p/${l.slug}`} className="group block">
                <div className="aspect-[3/4] bg-mitti/10 overflow-hidden">
                  {l.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.coverImage} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-madder/30 to-kohl/40" />
                  )}
                </div>
                <h2 className="font-display text-3xl text-kohl mt-6 group-hover:text-madder transition-colors">
                  {l.title}
                </h2>
                {l.excerpt && (
                  <p className="font-italic italic text-mitti mt-2 leading-relaxed">
                    {l.excerpt}
                  </p>
                )}
                <p className="font-display text-madder mt-4">VIEW LOOKBOOK →</p>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
