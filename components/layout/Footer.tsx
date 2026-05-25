import Link from 'next/link';
import { Instagram } from 'lucide-react';
import { NewsletterForm } from '@/components/ui/NewsletterForm';

export function Footer() {
  return (
    <footer className="bg-kohl text-ivory mt-24">
      <div className="max-w-8xl mx-auto px-6 lg:px-12 py-16 grid lg:grid-cols-5 gap-12">
        <div className="lg:col-span-2">
          <div className="brand-wordmark text-3xl">NE<span className="bindi"></span>JEE</div>
          <p className="font-italic italic text-beige mt-3 text-lg">Found. Personal.</p>
          <div className="madder-divider mt-6"></div>
          <p className="font-body text-sm text-beige/80 mt-6 max-w-xs leading-relaxed">
            India&apos;s finest craft, gathered with the patience of a founder who searched for years and found nothing good enough. So she built it.
          </p>
          <p className="font-italic italic text-beige/70 mt-4 text-sm">— Nidhi Chauhan, Founder</p>

          <div className="mt-8">
            <p className="label text-madder mb-3">JOIN THE TRUNK</p>
            <p className="font-italic italic text-beige/70 text-sm mb-3">Founder&apos;s edits, craft stories, early access.</p>
            <NewsletterForm darkMode />
          </div>
        </div>

        <div>
          <div className="label text-madder mb-4">SHOP</div>
          <ul className="space-y-2 font-ui text-xs text-beige/80">
            <li><Link href="/categories/sarees" className="hover:text-ivory">Sarees</Link></li>
            <li><Link href="/categories/jewellery" className="hover:text-ivory">Jewellery</Link></li>
            <li><Link href="/categories/fragrance" className="hover:text-ivory">Fragrance</Link></li>
            <li><Link href="/categories/home" className="hover:text-ivory">Home</Link></li>
            <li><Link href="/categories/gifting" className="hover:text-ivory">Gifting</Link></li>
            <li><Link href="/ai/mirror" className="hover:text-ivory text-madder">AI Mirror ✦</Link></li>
            <li><Link href="/ai/gift" className="hover:text-ivory text-madder">Gift Concierge ✦</Link></li>
          </ul>
        </div>

        <div>
          <div className="label text-madder mb-4">ABOUT</div>
          <ul className="space-y-2 font-ui text-xs text-beige/80">
            <li><Link href="/about" className="hover:text-ivory">Our story</Link></li>
            <li><Link href="/journal" className="hover:text-ivory">The Journal</Link></li>
            <li><Link href="/about/select" className="hover:text-ivory">NEEJEE Select</Link></li>
            <li><Link href="/about/sustainability" className="hover:text-ivory">Sustainability</Link></li>
            <li><Link href="/sellers" className="hover:text-ivory">Sell with us</Link></li>
            <li><Link href="/careers" className="hover:text-ivory">Careers</Link></li>
          </ul>
        </div>

        <div>
          <div className="label text-madder mb-4">SUPPORT</div>
          <ul className="space-y-2 font-ui text-xs text-beige/80">
            <li><Link href="/help/shipping" className="hover:text-ivory">Shipping</Link></li>
            <li><Link href="/help/returns" className="hover:text-ivory">Returns</Link></li>
            <li><Link href="/help/track" className="hover:text-ivory">Track Order</Link></li>
            <li><Link href="/help/faq" className="hover:text-ivory">FAQ</Link></li>
            <li><Link href="/help/contact" className="hover:text-ivory">Contact</Link></li>
            <li><a href="https://wa.me/919876512345" className="hover:text-ivory">WhatsApp Support</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-mitti/30 py-6">
        <div className="max-w-8xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-ui text-[10px] tracking-widest text-beige/60">
            © 2026 NEEJEE · NEEJEE.COM · INDIA, PERSONALLY CHOSEN.
          </p>
          <div className="flex items-center gap-6 font-ui text-[10px] tracking-widest text-beige/60">
            <a href="https://instagram.com/neejee" aria-label="Instagram" className="hover:text-ivory"><Instagram className="w-4 h-4" /></a>
            <Link href="/legal/privacy">PRIVACY</Link>
            <Link href="/legal/terms">TERMS</Link>
            <Link href="/legal/dpdp">DPDP</Link>
            <Link href="/legal/cookie">COOKIES</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
