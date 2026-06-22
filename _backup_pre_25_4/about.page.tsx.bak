import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata = { title: 'About · NEEJEE', description: 'Why NEEJEE exists. Founded by Nidhi Chauhan.' };

export default function AboutPage() {
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="label text-madder mb-4">ABOUT</p>
        <h1 className="font-display text-5xl md:text-6xl text-kohl leading-tight">Why we exist.</h1>
        <div className="madder-divider mx-auto mt-8"></div>
        <p className="editorial-quote mt-12">
          &ldquo;The rarest things in India are rarely the hardest to make. They are simply the hardest to find.&rdquo;
        </p>
        <p className="font-italic italic text-mitti mt-6">— Nidhi Chauhan, Founder</p>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-12 font-body text-lg text-kohl/85 leading-relaxed space-y-6">
        <p>NEEJEE began with a question I could not answer for myself: where do I buy the things I know India makes?</p>
        <p>I knew there was a Banarasi being woven on a pit-loom by a man named Salim. I knew there was a Phulkari being stitched in muted vintage pink by a woman in Patiala. I knew there was a mitti attar distilled from the first monsoon rain in Kannauj. But every search led me to either: (1) a five-thousand-rupee mass-produced copy, or (2) a thirty-thousand-rupee designer interpretation. Never the thing itself.</p>
        <p>So I started travelling. Three years. Eighteen states. Two hundred and forty artisan clusters. And I found that the rare, the rooted, the personal — still exists. It is just hard to find.</p>
        <p>NEEJEE is my private trunk made public. Every piece is found, personal, and named. The weaver is named. The region is named. The technique is named. We do not own the artisans — we partner with them. We pay them in advance and on time. We never compromise on the thing itself.</p>
        <p className="font-display italic text-2xl text-mitti">If it is here, it is because I would wear it. Personally.</p>
      </section>

      <section className="max-w-8xl mx-auto px-6 py-20 grid lg:grid-cols-3 gap-8">
        {[
          { label: 'FOUNDED', value: '2026', note: 'Mumbai · Varanasi · Jaipur' },
          { label: 'ARTISAN PARTNERS', value: '240+', note: 'Across 18 states' },
          { label: 'FAIR-TRADE', value: '100%', note: 'Above MSP · Paid in advance' },
        ].map(s => (
          <div key={s.label} className="text-center p-8 bg-beige">
            <p className="label text-madder">{s.label}</p>
            <p className="font-display text-5xl text-kohl mt-3">{s.value}</p>
            <p className="font-italic italic text-mitti mt-2">{s.note}</p>
          </div>
        ))}
      </section>

      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <Link href="/" className="btn-primary inline-block">Begin Finding</Link>
      </section>
      <Footer />
    </>
  );
}
