import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { stories } from '@/lib/data';

export const metadata = {
  title: 'Journal · NEEJEE',
  description: 'Stories from the looms, the founder\'s desk, and the kitchens of India.',
};

export default function JournalPage() {
  return (
    <>
      <Header />
      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-16 text-center">
        <p className="label text-madder mb-4">FROM THE LOOM</p>
        <h1 className="font-display text-5xl md:text-6xl text-kohl">The Journal</h1>
        <p className="font-italic italic text-xl text-mitti mt-4 max-w-2xl mx-auto">
          Stories from the looms, the founder&apos;s desk, the kitchens where attar is still distilled by hand.
        </p>
        <div className="madder-divider mx-auto mt-8"></div>
      </section>

      <section className="max-w-8xl mx-auto px-6 lg:px-12 pb-20 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {stories.map(s => (
          <Link key={s.slug} href={`/journal/${s.slug}`} className="group">
            <div className="aspect-[4/5] bg-beige relative overflow-hidden">
              <Image src={s.image} alt={s.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
              <span className="absolute top-4 left-4 badge-founder">{s.category}</span>
            </div>
            <h2 className="font-display text-2xl text-kohl mt-4 group-hover:text-madder transition-colors">{s.title}</h2>
            <p className="font-italic italic text-mitti mt-2">{s.excerpt}</p>
            <p className="label mt-3">{new Date(s.publishedAt).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </Link>
        ))}
      </section>
      <Footer />
    </>
  );
}
