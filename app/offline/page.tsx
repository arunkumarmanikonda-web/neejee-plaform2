import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <section className="min-h-screen bg-ivory flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <WifiOff className="w-16 h-16 text-madder mx-auto mb-6" />
        <p className="label text-madder">OFFLINE</p>
        <h1 className="font-display text-4xl text-kohl mt-4">A quiet moment.</h1>
        <p className="font-italic italic text-mitti mt-4">
          You appear to be offline. Some pages are saved and will load — others will return when you do.
        </p>
        <div className="mt-8 space-y-2">
          <Link href="/" className="block underline text-madder">Return home</Link>
          <Link href="/cart" className="block underline text-madder">View your trunk</Link>
          <Link href="/account" className="block underline text-madder">Your account</Link>
        </div>
      </div>
    </section>
  );
}
