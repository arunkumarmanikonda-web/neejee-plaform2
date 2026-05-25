import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getStoryBySlug, stories } from '@/lib/data';

export default function StoryPage({ params }: { params: { slug: string } }) {
  const story = getStoryBySlug(params.slug);
  if (!story) notFound();

  return (
    <>
      <Header />
      <article className="max-w-3xl mx-auto px-6 lg:px-0 py-16">
        <Link href="/journal" className="label text-mitti hover:text-madder">← BACK TO JOURNAL</Link>
        <p className="label text-madder mt-8">{story.category}</p>
        <h1 className="font-display text-4xl md:text-5xl text-kohl mt-4 leading-tight">{story.title}</h1>
        <p className="font-italic italic text-xl text-mitti mt-4">{story.excerpt}</p>
        <p className="label mt-3 text-monsoon">{new Date(story.publishedAt).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <div className="madder-divider mt-8"></div>

        <div className="aspect-[16/10] bg-beige relative my-12">
          <Image src={story.image} alt={story.title} fill className="object-cover" />
        </div>

        <div className="font-body text-lg text-kohl/85 leading-relaxed space-y-6">
          <p>{story.body}</p>
          <p>The looms are wooden, deep-pit, and older than most of the men who weave on them. Master Mohammed Salim sits cross-legged from 5:30 am, weighs the silk yarn before he weighs the day, and never weaves on a Friday after Jumma. A single saree of his takes fourteen days. Sometimes twenty-eight. The zari is real, the silk is mulberry, the pattern is in his head.</p>
          <p>This is what we mean by &ldquo;found, personal&rdquo;. There is no shortcut. There is no algorithm. There is only the hand, the loom, the patience, and now — through NEEJEE — a way for you to find it.</p>
        </div>

        <div className="madder-divider mt-16"></div>
        <p className="font-italic italic text-mitti mt-8 text-lg">— The NEEJEE Team</p>
      </article>

      <section className="max-w-8xl mx-auto px-6 lg:px-12 pb-20">
        <h2 className="font-display text-3xl text-kohl mb-8">Continue reading</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {stories.filter(s => s.slug !== story.slug).map(s => (
            <Link key={s.slug} href={`/journal/${s.slug}`} className="group">
              <div className="aspect-[4/3] bg-beige relative overflow-hidden">
                <Image src={s.image} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <h3 className="font-display text-lg mt-3 group-hover:text-madder">{s.title}</h3>
            </Link>
          ))}
        </div>
      </section>
      <Footer />
    </>
  );
}

export function generateStaticParams() {
  return stories.map(s => ({ slug: s.slug }));
}
