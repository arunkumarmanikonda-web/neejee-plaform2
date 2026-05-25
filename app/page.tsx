import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/product/ProductCard';
import { products, getFoundersEdit, categories } from '@/lib/data';

export default function HomePage() {
  const foundersEdit = getFoundersEdit();
  const topCategories = ['sarees', 'jewellery', 'home', 'fragrance', 'gifting'].map(s => categories.find(c => c.slug === s)!).filter(Boolean);

  return (
    <>
      <Header />

      {/* HERO */}
      <section className="relative min-h-[80vh] flex items-center bg-ivory overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="https://www.genspark.ai/api/files/s/5LVBbZtw?cache_control=3600"
            alt=""
            fill
            priority
            className="object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ivory via-ivory/60 to-transparent"></div>
        </div>
        <div className="relative z-10 max-w-8xl mx-auto px-6 lg:px-12 py-20">
          <div className="max-w-2xl fade-up">
            <p className="label text-madder mb-6">VOLUME 01 · 2026</p>
            <h1 className="font-display text-5xl md:text-7xl text-kohl leading-tight tracking-tight">
              The rare,<br />the rooted,<br />the personal.
            </h1>
            <p className="font-italic italic text-xl md:text-2xl text-mitti mt-6">
              Found. Personal.
            </p>
            <div className="madder-divider mt-8"></div>
            <p className="font-body text-lg text-kohl/80 mt-8 leading-relaxed max-w-prose">
              India&apos;s finest hands, weaves, metals, clays and fragrances — gathered with the patience of a founder who searched for years.
            </p>
            <div className="flex gap-3 mt-10">
              <Link href="/categories/sarees" className="btn-primary inline-block">Shop the First Edit</Link>
              <Link href="/about/founder" className="btn-outline inline-block">From the Founder</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDER MESSAGE */}
      <section className="bg-beige py-24">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <p className="label text-madder mb-8">FROM THE FOUNDER</p>
          <p className="editorial-quote mb-8">
            &ldquo;The rarest things in India are rarely the hardest to make.<br />
            They are simply the hardest to find.&rdquo;
          </p>
          <p className="font-italic italic text-mitti">— Nidhi Chauhan, Founder</p>
          <div className="madder-divider mx-auto mt-12"></div>
        </div>
      </section>

      {/* SHOP BY CATEGORY */}
      <section className="py-20">
        <div className="max-w-8xl mx-auto px-6 lg:px-12">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="label text-madder mb-3">EXPLORE</p>
              <h2 className="font-display text-4xl text-kohl">Shop by Category</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {topCategories.map(cat => (
              <Link key={cat.slug} href={`/categories/${cat.slug}`} className="group">
                <div className="aspect-[3/4] bg-beige relative overflow-hidden">
                  {cat.image ? (
                    <Image src={cat.image} alt={cat.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-mitti/10">
                      <span className="font-display text-2xl text-mitti">{cat.name}</span>
                    </div>
                  )}
                </div>
                <p className="font-display text-lg text-kohl mt-3 group-hover:text-madder transition-colors">{cat.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FOUNDER'S EDIT */}
      <section className="py-20 bg-beige/40">
        <div className="max-w-8xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <p className="label text-madder mb-3">PERSONALLY CHOSEN</p>
            <h2 className="font-display text-4xl text-kohl">The Founder&apos;s Edit</h2>
            <p className="font-italic italic text-mitti text-lg mt-3">Picks from Nidhi&apos;s desk.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {foundersEdit.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* AI INTRO */}
      <section className="py-20">
        <div className="max-w-8xl mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-12 items-center">
          <div className="aspect-square bg-beige relative overflow-hidden">
            <Image
              src="https://www.genspark.ai/api/files/s/DfhQiPZI?cache_control=3600"
              alt="NEEJEE Mirror — AI Try-On"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <p className="label text-madder mb-3">NEEJEE AI ✦</p>
            <h2 className="font-display text-5xl text-kohl leading-tight">The NEEJEE Mirror.</h2>
            <p className="font-italic italic text-xl text-mitti mt-4">See how it may live on you.</p>
            <div className="madder-divider mt-6"></div>
            <p className="font-body text-lg text-kohl/80 mt-6 leading-relaxed">
              Upload your photo. Preview a Banarasi, a Phulkari, a pair of oxidised jhumkas — on you, before you decide. Privacy-first. Deletable anytime.
            </p>
            <Link href="/ai/mirror" className="btn-primary inline-block mt-8">Try It Personally</Link>
          </div>
        </div>
      </section>

      {/* ALL PRODUCTS GRID */}
      <section className="py-20 bg-beige/40">
        <div className="max-w-8xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <p className="label text-madder mb-3">EVERYTHING IN ONE PLACE</p>
            <h2 className="font-display text-4xl text-kohl">The First Edit</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="py-12 bg-kohl text-ivory">
        <div className="max-w-8xl mx-auto px-6 lg:px-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            ['FOUNDER VERIFIED', 'Personally chosen by Nidhi'],
            ['HANDLOOM AUTHENTIC', 'Region · weave · weaver named'],
            ['SECURE PAYMENT', 'UPI · Cards · COD · GST invoice'],
            ['WHATSAPP UPDATES', 'Order to delivery, on your phone'],
          ].map(([title, sub]) => (
            <div key={title}>
              <p className="label text-madder mb-2">{title}</p>
              <p className="font-italic italic text-beige/80 text-sm">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}
