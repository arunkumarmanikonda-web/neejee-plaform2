import Link from 'next/link';
import { NeejeeLogo } from '@/components/brand/Logo';

export const metadata = { title: 'Neejee on your phone' };
export default function InstallNeejee() {
  return <main className="mx-auto max-w-2xl px-6 py-12 text-kohl">
    <NeejeeLogo size="lg" showTagline />
    <h1 className="font-display text-3xl mt-9">Neejee on your phone</h1>
    <p className="font-ui text-sm leading-relaxed mt-3">Keep the shop, your bag and Aaina together on your home screen.</p>
    <h2 className="font-display text-2xl mt-9">iPhone and iPad</h2>
    <p className="font-ui text-sm leading-relaxed mt-2">Open this site in Safari. Tap Share, choose Add to Home Screen, turn on Open as Web App if offered, then tap Add.</p>
    <h2 className="font-display text-2xl mt-7">Android</h2>
    <p className="font-ui text-sm leading-relaxed mt-2">Open this site in Chrome. Open the browser menu, choose Add to home screen or Install app, then confirm.</p>
    <Link href="/" className="inline-block mt-8 px-5 py-3 font-ui text-sm bg-madder text-ivory">Back to the shop</Link>
  </main>;
}
