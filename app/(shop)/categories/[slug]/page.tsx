import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/product/ProductCard';
import { categories, getProductsByCategory } from '@/lib/data';

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const category = categories.find(c => c.slug === params.slug);
  if (!category) notFound();
  const products = getProductsByCategory(params.slug);

  return (
    <>
      <Header />
      <nav className="max-w-8xl mx-auto px-6 lg:px-12 pt-8 font-ui text-xs tracking-widest text-monsoon">
        <a href="/">HOME</a> / <span className="text-kohl">{category.name.toUpperCase()}</span>
      </nav>

      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-12 text-center">
        <p className="label text-madder mb-4">THE EDIT</p>
        <h1 className="font-display text-5xl md:text-6xl text-kohl">{category.name}</h1>
        <p className="font-italic italic text-xl text-mitti mt-4 max-w-2xl mx-auto">{category.description}</p>
        <div className="madder-divider mx-auto mt-8"></div>
      </section>

      <section className="max-w-8xl mx-auto px-6 lg:px-12 pb-20">
        <div className="flex justify-between items-baseline mb-8 font-ui text-xs tracking-widest">
          <p className="text-monsoon">{products.length} PIECES · FOUND, PERSONALLY</p>
          <div className="flex gap-4 text-monsoon">
            <button className="hover:text-kohl">FILTER</button>
            <button className="hover:text-kohl">SORT: FOUNDER&apos;S PICK</button>
          </div>
        </div>
        {products.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-italic italic text-2xl text-mitti">More pieces coming personally.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      <Footer />
    </>
  );
}
