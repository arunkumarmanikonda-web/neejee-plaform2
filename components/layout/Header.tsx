'use client';
import MegaMenuNav from './MegaMenuNav';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search, Heart, ShoppingBag, User, Menu, X, LogOut } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { SearchBar } from '@/components/ui/SearchBar';
import { AnnouncementBar } from '@/components/ui/AnnouncementBar';
import { NeejeeLogo } from '@/components/brand/Logo';

interface Me { id: string; email: string; name?: string | null; role?: string }

export function Header() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  // v26.2a — taxonomy-driven mobile drawer
  const [mobileMains, setMobileMains] = useState<{ slug: string; name: string; path: string | null; subs: any[] }[]>([]);
  const [mobileOpenMain, setMobileOpenMain] = useState<string | null>(null);
  const count = useCart(s => s.itemCount());

  useEffect(() => {
    fetch('/api/categories/tree?visible=true', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { tree: [] })
      .then(d => {
        const mains = (d.tree || []).filter((c: any) => c.level === 1).map((c: any) => ({
          slug: c.slug,
          name: c.name,
          path: c.path,
          subs: (c.children || []).filter((s: any) => s.active && !s.hidden),
        }));
        setMobileMains(mains);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/me', { credentials: 'include', cache: 'no-store' })
      .then(async r => {
        if (r.ok) return r.json();
        // 401 â€” either no session, or stale cookie was just cleared by getSession.
        // Force a hard logout state so UI doesn't show a fake signed-in header.
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
  const isAdmin = me && ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'].includes(me.role || '');

  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-40 bg-ivory border-b border-beige">
        <div className="max-w-8xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          <button onClick={() => setOpen(!open)} className="lg:hidden" aria-label="Menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/" aria-label="NEEJEE Home" className="flex items-center">
            <NeejeeLogo size="md" />
          </Link>

          {/* v23.40.26.1 â€” Mega-menu navigation, taxonomy-driven */}
          <MegaMenuNav />

          <div className="flex items-center gap-5">
            <button onClick={() => setSearchOpen(true)} aria-label="Search" className="hover:text-madder transition-colors"><Search className="w-5 h-5" /></button>

            {/* Account: dropdown when logged in, link when not */}
            {me ? (
              <div className="hidden sm:block relative">
                <button
                  onClick={() => setAccountMenu(!accountMenu)}
                  className="flex items-center gap-1.5 hover:text-madder transition-colors"
                  aria-label="Account menu"
                >
                  <User className="w-5 h-5" />
                  <span className="text-xs tracking-wider hidden md:inline">{firstName ? firstName.toUpperCase() : 'ACCOUNT'}</span>
                </button>
                {accountMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setAccountMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-ivory border border-mitti/20 shadow-lg z-40">
                      <div className="px-4 py-3 border-b border-mitti/10">
                        <p className="text-xs tracking-wider text-mitti">SIGNED IN AS</p>
                        <p className="text-sm text-kohl mt-1 truncate">{me.email}</p>
                        {isAdmin && <p className="text-[10px] tracking-wider text-madder mt-1">{me.role?.replace(/_/g, ' ')}</p>}
                      </div>
                      <Link href={isAdmin ? '/admin' : '/account'} className="block px-4 py-2.5 text-sm hover:bg-beige text-kohl" onClick={() => setAccountMenu(false)}>
                        {isAdmin ? 'Admin dashboard' : 'My account'}
                      </Link>
                      {!isAdmin && (
                        <>
                          <Link href="/account?tab=orders" className="block px-4 py-2.5 text-sm hover:bg-beige text-kohl" onClick={() => setAccountMenu(false)}>My orders</Link>
                          <Link href="/account?tab=wishlist" className="block px-4 py-2.5 text-sm hover:bg-beige text-kohl" onClick={() => setAccountMenu(false)}>Wishlist</Link>
                          <Link href="/account?tab=addresses" className="block px-4 py-2.5 text-sm hover:bg-beige text-kohl" onClick={() => setAccountMenu(false)}>Addresses</Link>
                        </>
                      )}
                      <button onClick={logout} className="w-full text-left px-4 py-2.5 text-sm hover:bg-madder/5 text-madder border-t border-mitti/10 flex items-center gap-2">
                        <LogOut className="w-3.5 h-3.5" /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link href="/login" aria-label="Sign in" className="hidden sm:block hover:text-madder transition-colors">
                <User className="w-5 h-5" />
              </Link>
            )}

            {!isAdmin && (
              <Link href={me ? '/account?tab=wishlist' : '/login?next=%2Faccount%3Ftab%3Dwishlist'} aria-label="Wishlist" className="hidden sm:block hover:text-madder transition-colors"><Heart className="w-5 h-5" /></Link>
            )}
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
          <div className="lg:hidden border-t border-beige bg-ivory max-h-[80vh] overflow-y-auto">
            <nav className="flex flex-col py-2 font-ui text-sm tracking-wide">
              {/* v26.2a — taxonomy-driven mobile drawer */}
              {(mobileMains.length > 0 ? mobileMains : [
                { slug: 'women', name: 'Women', path: 'women', subs: [] },
                { slug: 'men', name: 'Men', path: 'men', subs: [] },
                { slug: 'accessories', name: 'Accessories', path: 'accessories', subs: [] },
                { slug: 'home', name: 'Home', path: 'home', subs: [] },
                { slug: 'fragrance', name: 'Fragrance', path: 'fragrance', subs: [] },
                { slug: 'gifting', name: 'Gifting', path: 'gifting', subs: [] },
              ]).map(main => {
                const isOpen = mobileOpenMain === main.slug;
                const hasSubs = main.subs.length > 0;
                return (
                  <div key={main.slug} className="border-b border-beige/60 last:border-0">
                    <div className="flex items-stretch">
                      <Link
                        href={`/categories/${main.path || main.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex-1 px-6 py-3 hover:bg-beige hover:text-madder transition-colors"
                      >
                        {main.name.toUpperCase()}
                      </Link>
                      {hasSubs && (
                        <button
                          type="button"
                          onClick={() => setMobileOpenMain(isOpen ? null : main.slug)}
                          aria-label={isOpen ? `Collapse ${main.name}` : `Expand ${main.name}`}
                          className="px-5 text-mitti hover:text-madder text-lg"
                        >
                          {isOpen ? '−' : '+'}
                        </button>
                      )}
                    </div>
                    {isOpen && hasSubs && (
                      <div className="bg-beige/30 px-6 py-2 pb-3">
                        {main.subs.map((sub: any) => (
                          <Link
                            key={sub.id}
                            href={`/categories/${sub.path || sub.slug}`}
                            onClick={() => setOpen(false)}
                            className="block py-1.5 text-xs text-mitti hover:text-madder font-ui tracking-wider"
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <Link href="/journal" onClick={() => setOpen(false)} className="px-6 py-3 border-b border-beige/60 hover:bg-beige hover:text-madder transition-colors">
                STORIES
              </Link>
              <Link href="/ai" onClick={() => setOpen(false)} className="px-6 py-3 text-madder hover:bg-beige transition-colors">
                AI ✨
              </Link>
              <div className="border-t border-beige mt-2 pt-2">
                {me ? (
                  <>
                    <p className="px-6 py-2 text-xs tracking-wider text-mitti">SIGNED IN Â· {firstName?.toUpperCase()}</p>
                    <Link href={isAdmin ? '/admin' : '/account'} className="px-6 py-3 block hover:bg-beige" onClick={() => setOpen(false)}>
                      {isAdmin ? 'Admin dashboard' : 'My account'}
                    </Link>
                    <button onClick={logout} className="px-6 py-3 block text-left text-madder w-full">Sign out</button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="px-6 py-3 block hover:bg-beige" onClick={() => setOpen(false)}>SIGN IN</Link>
                    <Link href="/signup" className="px-6 py-3 block hover:bg-beige" onClick={() => setOpen(false)}>CREATE ACCOUNT</Link>
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
