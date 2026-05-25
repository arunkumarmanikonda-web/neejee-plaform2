'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Search, Heart, ShoppingBag, User, Menu, X } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { SearchBar } from '@/components/ui/SearchBar';
import { AnnouncementBar } from '@/components/ui/AnnouncementBar';

export function Header() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const count = useCart(s => s.itemCount());

  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-40 bg-ivory border-b border-beige">
        <div className="max-w-8xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          <button onClick={() => setOpen(!open)} className="lg:hidden" aria-label="Menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/" className="brand-wordmark text-2xl lg:text-3xl text-kohl">
            NE<span className="bindi"></span>JEE
          </Link>

          <nav className="hidden lg:flex gap-8 items-center font-ui text-xs tracking-widest text-kohl">
            <Link href="/categories/women" className="hover:text-madder transition-colors">WOMEN</Link>
            <Link href="/categories/men" className="hover:text-madder transition-colors">MEN</Link>
            <Link href="/categories/jewellery" className="hover:text-madder transition-colors">JEWELLERY</Link>
            <Link href="/categories/home" className="hover:text-madder transition-colors">HOME</Link>
            <Link href="/categories/fragrance" className="hover:text-madder transition-colors">FRAGRANCE</Link>
            <Link href="/categories/gifting" className="hover:text-madder transition-colors">GIFTING</Link>
            <Link href="/journal" className="hover:text-madder transition-colors">STORIES</Link>
            <Link href="/ai/mirror" className="hover:text-madder transition-colors text-madder font-medium">AI ✦</Link>
          </nav>

          <div className="flex items-center gap-5">
            <button onClick={() => setSearchOpen(true)} aria-label="Search" className="hover:text-madder transition-colors"><Search className="w-5 h-5" /></button>
            <Link href="/account" aria-label="Account" className="hidden sm:block hover:text-madder transition-colors"><User className="w-5 h-5" /></Link>
            <Link href="/account?tab=wishlist" aria-label="Wishlist" className="hidden sm:block hover:text-madder transition-colors"><Heart className="w-5 h-5" /></Link>
            <Link href="/cart" aria-label="Cart" className="relative hover:text-madder transition-colors">
              <ShoppingBag className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-madder text-ivory text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-ui">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>

        {open && (
          <div className="lg:hidden border-t border-beige bg-ivory">
            <nav className="flex flex-col py-4 font-ui text-sm tracking-wide">
              {['Women','Men','Jewellery','Home','Fragrance','Gifting','Stories','AI'].map(item => (
                <Link
                  key={item}
                  href={item === 'AI' ? '/ai/mirror' : item === 'Stories' ? '/journal' : `/categories/${item.toLowerCase()}`}
                  onClick={() => setOpen(false)}
                  className="px-6 py-3 hover:bg-beige text-kohl"
                >
                  {item.toUpperCase()}
                </Link>
              ))}
              <div className="border-t border-beige mt-4 pt-4 px-6 space-y-3">
                <Link href="/login" onClick={() => setOpen(false)} className="block py-2 text-mitti">SIGN IN</Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="block py-2 text-madder">CREATE TRUNK</Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} />}
    </>
  );
}
