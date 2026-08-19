'use client';
import MegaMenuNav from './MegaMenuNav';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search, Heart, ShoppingBag, User, Menu, X, LogOut } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { SearchBar } from '@/components/ui/SearchBar';
import { AnnouncementBar } from '@/components/ui/AnnouncementBar';
import { NeejeeLogo } from '@/components/brand/Logo';
import { getCategoryTree } from '@/lib/client/category-tree';

interface Me { id: string; email: string; name?: string | null; role?: string }
type MobileMain = { slug: string; name: string; subs: any[] };

export function Header() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [mobileMains, setMobileMains] = useState<MobileMain[]>([]);
  const [mobileOpenMain, setMobileOpenMain] = useState<string | null>(null);
  const count = useCart(s => s.itemCount());

  useEffect(() => {
    let alive = true;
    getCategoryTree(false)
      .then((tree) => {
        if (!alive) return;
        const mains = tree
          .filter((c: any) => c.level === 1)
          .map((c: any) => ({
            slug: c.slug,
            name: c.name,
            subs: (c.children || []).filter((s: any) => s.active !== false && !s.hidden),
          }));
        if (mains.length > 0) setMobileMains(mains);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    fetch('/api/me', { credentials: 'include', cache: 'no-store' })
      .then(async r => {
        if (r.ok) return r.json();
        if (r.status === 401) setMe(null);
        return null;
      })
      .then(d => { if (d?.email) setMe(d); })
      .catch(() => setMe(null));
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setMe(null);
    setAccountMenu(false);
    location.reload();
  };

  const firstName = me?.name?.split(' ')[0] || '';
  const isAdmin = !!me && ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'].includes(me.role || '');

  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-40 bg-[#f7f1e7]/95 backdrop-blur-md border-b border-mitti/[0.18] shadow-[0_1px_0_rgba(255,255,255,0.35)]">
        <div className="mx-auto max-w-[1680px] px-5 sm:px-7 lg:px-10 xl:px-12 min-h-[78px] lg:min-h-[96px] grid grid-cols-[44px_1fr_auto] lg:grid-cols-[240px_1fr_240px] items-center gap-3 lg:gap-7">
          <button
            onClick={() => setOpen(!open)}
            className="lg:hidden w-10 h-10 flex items-center justify-start text-kohl"
            aria-label="Menu"
          >
            {open ? <X className="w-6 h-6" strokeWidth={1.25} /> : <Menu className="w-6 h-6" strokeWidth={1.25} />}
          </button>

          <Link href="/" aria-label="NEEJEE Home" className="justify-self-center lg:justify-self-start flex items-center">
            <NeejeeLogo size="md" className="sm:hidden !w-[118px]" />
            <NeejeeLogo size="xl" className="hidden sm:block !w-[220px] lg:!w-[228px]" />
          </Link>

          <div className="hidden lg:flex justify-center min-w-0">
            <MegaMenuNav />
          </div>

          <div className="flex items-center justify-self-end gap-3.5 sm:gap-4 lg:gap-5 text-kohl">
            <button onClick={() => setSearchOpen(true)} aria-label="Search" className="hover:text-madder transition-colors">
              <Search className="w-[21px] h-[21px]" strokeWidth={1.25} />
            </button>

            {me ? (
              <div className="hidden sm:block relative">
                <button onClick={() => setAccountMenu(!accountMenu)} className="flex items-center gap-1.5 hover:text-madder transition-colors" aria-label="Account menu">
                  <User className="w-[21px] h-[21px]" strokeWidth={1.2} />
                  <span className="font-ui text-[9px] tracking-[0.16em] hidden xl:inline">{firstName ? firstName.toUpperCase() : 'ACCOUNT'}</span>
                </button>
                {accountMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setAccountMenu(false)} />
                    <div className="absolute right-0 top-full mt-5 w-60 bg-[#f7f1e7] border border-mitti/20 shadow-[0_18px_50px_rgba(26,22,19,0.12)] z-40">
                      <div className="px-4 py-3 border-b border-mitti/10">
                        <p className="font-ui text-[8px] tracking-[0.18em] text-mitti">SIGNED IN AS</p>
                        <p className="font-display text-[15px] text-kohl mt-1 truncate">{me.email}</p>
                        {isAdmin && <p className="font-ui text-[8px] tracking-wider text-madder mt-1">{me.role?.replace(/_/g, ' ')}</p>}
                      </div>
                      <Link href={isAdmin ? '/admin' : '/account'} className="block px-4 py-2.5 font-display text-[15px] hover:bg-beige/60 text-kohl" onClick={() => setAccountMenu(false)}>
                        {isAdmin ? 'Admin dashboard' : 'My account'}
                      </Link>
                      {!isAdmin && (
                        <>
                          <Link href="/account?tab=orders" className="block px-4 py-2.5 font-display text-[15px] hover:bg-beige/60 text-kohl" onClick={() => setAccountMenu(false)}>My orders</Link>
                          <Link href="/account?tab=wishlist" className="block px-4 py-2.5 font-display text-[15px] hover:bg-beige/60 text-kohl" onClick={() => setAccountMenu(false)}>Wishlist</Link>
                          <Link href="/account?tab=addresses" className="block px-4 py-2.5 font-display text-[15px] hover:bg-beige/60 text-kohl" onClick={() => setAccountMenu(false)}>Addresses</Link>
                        </>
                      )}
                      <button onClick={logout} className="w-full text-left px-4 py-2.5 font-display text-[15px] hover:bg-madder/5 text-madder border-t border-mitti/10 flex items-center gap-2">
                        <LogOut className="w-3.5 h-3.5" /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link href="/login" aria-label="Sign in" className="hidden sm:block hover:text-madder transition-colors">
                <User className="w-[21px] h-[21px]" strokeWidth={1.2} />
              </Link>
            )}

            {!isAdmin && (
              <Link href={me ? '/account?tab=wishlist' : '/login?next=%2Faccount%3Ftab%3Dwishlist'} aria-label="Wishlist" className="hidden md:block hover:text-madder transition-colors">
                <Heart className="w-[21px] h-[21px]" strokeWidth={1.2} />
              </Link>
            )}

            <Link href="/cart" aria-label="Cart" className="relative hover:text-madder transition-colors">
              <ShoppingBag className="w-[21px] h-[21px]" strokeWidth={1.2} />
              {count > 0 && (
                <span className="absolute -top-2.5 -right-2.5 bg-madder text-ivory text-[8px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-ui">{count}</span>
              )}
            </Link>
          </div>
        </div>

        {open && (
          <div className="lg:hidden border-t border-mitti/[0.12] bg-[#f7f1e7] max-h-[calc(100vh-110px)] overflow-y-auto">
            <nav className="flex flex-col py-2 font-display text-[17px] tracking-[0.02em]">
              {(mobileMains.length > 0 ? mobileMains : [
                { slug: 'women', name: 'Women', subs: [] },
                { slug: 'men', name: 'Men', subs: [] },
                { slug: 'accessories', name: 'Accessories', subs: [] },
                { slug: 'home', name: 'Home', subs: [] },
                { slug: 'fragrance', name: 'Fragrance', subs: [] },
                { slug: 'gifting', name: 'Gifting', subs: [] },
              ]).map(main => {
                const isOpen = mobileOpenMain === main.slug;
                const hasSubs = main.subs.length > 0;
                return (
                  <div key={main.slug} className="border-b border-mitti/10 last:border-0">
                    <div className="flex items-stretch">
                      <Link href={`/categories/${encodeURIComponent(main.slug)}`} onClick={() => setOpen(false)} className="flex-1 px-6 py-4 hover:bg-beige/55 hover:text-madder transition-colors">
                        {main.name.toUpperCase()}
                      </Link>
                      {hasSubs && (
                        <button type="button" onClick={() => setMobileOpenMain(isOpen ? null : main.slug)} aria-label={isOpen ? `Collapse ${main.name}` : `Expand ${main.name}`} className="px-5 text-mitti hover:text-madder text-lg">
                          {isOpen ? '−' : '+'}
                        </button>
                      )}
                    </div>
                    {isOpen && hasSubs && (
                      <div className="bg-beige/35 px-6 py-2 pb-3">
                        {main.subs.map((sub: any) => (
                          <Link key={sub.id} href={`/categories/${encodeURIComponent(sub.slug)}`} onClick={() => setOpen(false)} className="block py-2.5 text-[14px] text-mitti hover:text-madder font-display tracking-[0.015em]">
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <Link href="/journal" onClick={() => setOpen(false)} className="px-6 py-4 border-b border-mitti/10 hover:bg-beige/60 hover:text-madder transition-colors">STORIES</Link>
              <Link href="/ai" onClick={() => setOpen(false)} className="px-6 py-4 text-madder hover:bg-beige/60 transition-colors">NEEJEE AI ✦</Link>
              <div className="border-t border-mitti/10 mt-2 pt-2 font-ui text-[10px] tracking-[0.14em]">
                {me ? (
                  <>
                    <p className="px-6 py-2 text-[9px] tracking-wider text-mitti">SIGNED IN · {firstName?.toUpperCase()}</p>
                    <Link href={isAdmin ? '/admin' : '/account'} className="px-6 py-3 block hover:bg-beige/60" onClick={() => setOpen(false)}>{isAdmin ? 'ADMIN DASHBOARD' : 'MY ACCOUNT'}</Link>
                    <button onClick={logout} className="px-6 py-3 block text-left text-madder w-full">SIGN OUT</button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="px-6 py-3 block hover:bg-beige/60" onClick={() => setOpen(false)}>SIGN IN</Link>
                    <Link href="/signup" className="px-6 py-3 block hover:bg-beige/60" onClick={() => setOpen(false)}>CREATE ACCOUNT</Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}

        {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} />}
      </header>
    </>
  );
}
