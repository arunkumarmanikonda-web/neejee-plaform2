'use client';
// v23.40.25 — Reads contact info + top categories from the public site-config
// endpoint so admin edits in /admin/legal-entity propagate without redeploy.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CurrencySwitcher } from '@/components/i18n/CurrencySwitcher';
import { Instagram } from 'lucide-react';
import { NewsletterForm } from '@/components/ui/NewsletterForm';
import { NeejeeLogo } from '@/components/brand/Logo';

interface PublicContact {
  email: string;
  phone: string;
  whatsappUrl: string;
  telUrl: string;
  mailUrl: string;
  brandName: string;
  socialInstagram?: string;
}

interface FooterCategory { slug: string; name: string }

const FALLBACK_CONTACT: PublicContact = {
  email: 'hello@neejee.com',
  phone: '+91 98765 12345',
  whatsappUrl: 'https://wa.me/919876512345',
  telUrl: 'tel:+919876512345',
  mailUrl: 'mailto:hello@neejee.com',
  brandName: 'NEEJEE',
  socialInstagram: 'https://instagram.com/neejee',
};

const FALLBACK_CATEGORIES: FooterCategory[] = [
  { slug: 'sarees', name: 'Sarees' },
  { slug: 'jewellery', name: 'Jewellery' },
  { slug: 'fragrance', name: 'Fragrance' },
  { slug: 'home', name: 'Home' },
  { slug: 'gifting', name: 'Gifting' },
];

export function Footer() {
  const [contact, setContact] = useState<PublicContact>(FALLBACK_CONTACT);
  const [categories, setCategories] = useState<FooterCategory[]>(FALLBACK_CATEGORIES);

  useEffect(() => {
    fetch('/api/public/site-config', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.contact) setContact({ ...FALLBACK_CONTACT, ...d.contact });
        if (Array.isArray(d.categories) && d.categories.length > 0) setCategories(d.categories);
      })
      .catch(() => { /* keep fallbacks */ });
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer className="bg-kohl text-ivory mt-24">
      <div className="max-w-8xl mx-auto px-6 lg:px-12 py-16 grid lg:grid-cols-5 gap-12">
        <div className="lg:col-span-2">
          <NeejeeLogo size="lg" variant="ivory" showTagline />
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
            {categories.map(c => (
              <li key={c.slug}><Link href={`/categories/${c.slug}`} className="hover:text-ivory">{c.name}</Link></li>
            ))}
            <li className="pt-2 border-t border-mitti/20 mt-2">
              <Link href="/collections/wedding" className="hover:text-ivory">The Wedding Edit</Link>
            </li>
            <li><Link href="/collections/founders-edit" className="hover:text-ivory">Founder&apos;s Edit</Link></li>
            <li><Link href="/collections/gifting" className="hover:text-ivory">Gifting</Link></li>
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
            <li><Link href="/vendor" className="hover:text-ivory">Vendor portal</Link></li>
            <li><Link href="/seller" className="hover:text-ivory">Seller studio</Link></li>
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
            <li><a href={contact.whatsappUrl} className="hover:text-ivory" target="_blank" rel="noopener">WhatsApp Support</a></li>
            <li className="pt-2 border-t border-mitti/20 mt-2 text-beige/60">
              <a href={contact.mailUrl} className="hover:text-ivory">{contact.email}</a>
            </li>
            <li className="text-beige/60">
              <a href={contact.telUrl} className="hover:text-ivory">{contact.phone}</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-mitti/30 py-6">
        <div className="max-w-8xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-ui text-[10px] tracking-widest text-beige/60">
            © {year} {contact.brandName.toUpperCase()} · NEEJEE.COM · INDIA, PERSONALLY CHOSEN.
          </p>
          <div className="flex items-center gap-6 font-ui text-[10px] tracking-widest text-beige/60">
            <CurrencySwitcher compact />
            {contact.socialInstagram && (
              <a href={contact.socialInstagram} aria-label="Instagram" className="hover:text-ivory" target="_blank" rel="noopener"><Instagram className="w-4 h-4" /></a>
            )}
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
