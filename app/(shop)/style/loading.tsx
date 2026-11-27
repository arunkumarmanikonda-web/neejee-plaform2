import Link from 'next/link';
export default function LoadingStyle(){
  return <main className="max-w-6xl mx-auto p-6"><div className="flex flex-wrap items-center justify-between gap-4">
    <Link className="btn-outline" href="/cart">Back to cart</Link><Link className="btn-primary" href="/checkout">Skip styling &amp; check out</Link></div>
    <p role="status" className="mt-8">Opening Aaina…</p></main>;
}
