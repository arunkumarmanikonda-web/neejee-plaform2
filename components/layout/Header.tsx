'use client';
import MegaMenuNav, { stockedDepartments } from './MegaMenuNav';
import { houseNavigation, editHref } from '@/lib/shop-edits';
import { Pitari } from '@/components/home/Pitari';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import styles from './ShopUtilities.module.css';
import { useEffect, useRef, useState } from 'react';
import { Search, ShoppingBag, Menu, UserRound, X } from 'lucide-react';
import { useClientReady } from '@/lib/use-client-ready';
import { useSampleBag } from '@/lib/sample-bag';
import { useCart } from '@/lib/cart-store';
import { SearchBar } from '@/components/ui/SearchBar';
import { AnnouncementBar } from '@/components/ui/AnnouncementBar';
import { NeejeeLogo } from '@/components/brand/Logo';
import { getCategoryTree } from '@/lib/client/category-tree';

interface Me { id: string; email: string; name?: string | null; role?: string }

type MobileMain = { slug: string; name: string; subs: any[] };

export function Header({ shop = false }: { shop?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [mobileMains, setMobileMains] = useState<MobileMain[]>([]);
  const [mobileOpenMain, setMobileOpenMain] = useState<string | null>(null);
  const ready = useClientReady();
  const liveCount = useCart(s => s.itemCount());
  const sample = useSampleBag();
  const count = liveCount + Object.values(sample).reduce((n,qty)=>n+qty,0);

  useEffect(() => {
    let alive = true;
    getCategoryTree(false)
      .then((tree) => {
        if (!alive) return;
        const mains = stockedDepartments(tree)
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
    location.reload();
  };

  useEffect(() => {
    if (!open) return;
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        menuTrigger.current?.focus();
      }
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false);
    }
    window.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  function openSearch() {
    setOpen(false);
    setSearchOpen(true);
  }

  const firstName = me?.name?.split(' ')[0] || '';
  const isAdmin = me && ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'].includes(me.role || '');

  const savedHref = me ? '/account?tab=wishlist' : '/login?next=%2Faccount%3Ftab%3Dwishlist';
  const accountLinks = me
    ? isAdmin ? [['Admin dashboard', '/admin']] : [['My account', '/account'], ['Orders', '/account?tab=orders'], ['Addresses', '/account?tab=addresses']]
    : [['Sign in', '/login'], ['Create an account', '/signup']];

  return (
    <>
      {!shop && <AnnouncementBar />}
      <header ref={header} className={styles.masthead + " sticky top-0 z-40"} data-shop={shop}>
        <div className={styles.brandRow}>
          <div className={styles.find}>
            <button ref={menuTrigger} type="button" className={styles.menu} onClick={() => setOpen(!open)}
              aria-label={open ? "Close shop menu" : "Open shop menu"} aria-controls="neejee-shop-menu" aria-expanded={open}>
              {open ? <X size={20} aria-hidden="true"/> : <Menu size={20} aria-hidden="true"/>}
            </button>
            <button ref={searchTrigger} type="button" className={styles.search} onClick={openSearch}
              aria-label="Search the shop" aria-haspopup="dialog">
              <Search size={18} aria-hidden="true"/><span>Search the shop</span>
            </button>
          </div>

          <Link href="/" aria-label="NEEJEE Home, Found. Personal." className={styles.signature}>
            <NeejeeLogo size="xl" showTagline />
          </Link>

          <div className={styles.personal}>
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger className={styles.account} aria-label="Account options">
                <UserRound size={17} aria-hidden="true"/><span>Account</span>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className={styles.accountPanel} align="end" sideOffset={5} collisionPadding={12}>
                  {me && <DropdownMenu.Label className={styles.signedIn}>Signed in as {me.email}</DropdownMenu.Label>}
                  {accountLinks.map(([label, href]) => <DropdownMenu.Item asChild key={href}>
                    <Link className={styles.accountItem} href={href}>{label}</Link>
                  </DropdownMenu.Item>)}
                  {!isAdmin && <DropdownMenu.Item asChild><Link className={styles.accountItem} href={savedHref}>Saved pieces</Link></DropdownMenu.Item>}
                  {me && <DropdownMenu.Item className={styles.accountItem} onSelect={() => void logout()}>Sign out</DropdownMenu.Item>}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <Link href="/cart" className={styles.bag} aria-label={'Shopping bag' + (ready && count ? ', ' + count + (count===1 ? ' item' : ' items') : '')}>
              <ShoppingBag size={18} aria-hidden="true"/><span>Bag</span>
              {ready && count>0 && <b className={styles.count} aria-hidden="true">{count>99 ? '99+' : count}</b>}
            </Link>
          </div>
        </div>
        <MegaMenuNav onNavigate={()=>setOpen(false)}/>
        <Pitari showLauncher={false}/>

        {open && (
          <div id="neejee-shop-menu" className={styles.drawer + " border-t border-beige bg-ivory overflow-y-auto"}>
            <nav aria-label="Shop menu" className="flex flex-col py-2 font-ui text-sm tracking-wide">
              <div className={styles.drawerTools}>
                <button type="button" aria-haspopup="dialog" onClick={()=>{
                  setOpen(false);
                  menuTrigger.current?.focus();
                  window.dispatchEvent(new CustomEvent('neejee:ask-pitari'));
                }}>Ask Sakhi</button>
                {!isAdmin && <Link href={savedHref} onClick={()=>setOpen(false)}>Saved pieces</Link>}
                <Link href={me ? (isAdmin ? '/admin' : '/account') : '/login'} onClick={()=>setOpen(false)}>{me ? (isAdmin ? 'Admin' : 'Account') : 'Sign in'}</Link>
              </div>
              {houseNavigation.map(e=><Link key={e.slug} href={editHref(e.slug)} onClick={()=>setOpen(false)} className="px-6 py-3 border-b border-beige font-medium">{e.name}</Link>)}
              <Link href="/products" onClick={() => setOpen(false)} className="px-6 py-3 border-b border-beige">Shop all</Link>
              {mobileMains.map(main => {
                const isOpen = mobileOpenMain === main.slug;
                const hasSubs = main.subs.length > 0;
                return (
                  <div key={main.slug} className="border-b border-beige/60 last:border-0">
                    <div className="flex items-stretch">
                      <Link href={`/categories/${encodeURIComponent(main.slug)}`} onClick={() => setOpen(false)} className="flex-1 px-6 py-3 hover:bg-beige hover:text-madder transition-colors">
                        {main.name.toUpperCase()}
                      </Link>
                      {hasSubs && (
                        <button type="button" onClick={() => setMobileOpenMain(isOpen ? null : main.slug)} aria-label={isOpen ? `Collapse ${main.name}` : `Expand ${main.name}`} className="px-5 text-mitti hover:text-madder text-lg">
                          {isOpen ? '−' : '+'}
                        </button>
                      )}
                    </div>
                    {isOpen && hasSubs && (
                      <div className="bg-beige/30 px-6 py-2 pb-3">
                        {main.subs.map((sub: any) => (
                          <Link key={sub.id} href={`/categories/${encodeURIComponent(sub.slug)}`} onClick={() => setOpen(false)} className="block py-1.5 text-xs text-mitti hover:text-madder font-ui tracking-wider">
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <Link href="/looks" onClick={()=>setOpen(false)} className="px-6 py-3">Saree styling ideas</Link>
              <Link href="/counter" onClick={()=>setOpen(false)} className="px-6 py-3">Compare sarees</Link>
              <Link href="/about" onClick={()=>setOpen(false)} className="px-6 py-3">Nidhi’s story</Link>
              <Link href="/journal" onClick={() => setOpen(false)} className="px-6 py-3 border-b border-beige/60 hover:bg-beige hover:text-madder transition-colors">The journal</Link>
              <Link href="/ai/imagine" onClick={()=>setOpen(false)} className="px-6 py-3">See décor in my room</Link>
              <Link href="/ai/mirror" onClick={()=>setOpen(false)} className="px-6 py-3">Try on with Aaina</Link>
              <Link href="/ai/gift" onClick={()=>setOpen(false)} className="px-6 py-3">Find a gift</Link>
              <div className="border-t border-beige mt-2 pt-2">
                {me ? (
                  <>
                    <p className="px-6 py-2 text-xs tracking-wider text-mitti">SIGNED IN · {firstName?.toUpperCase()}</p>
                    {!isAdmin && accountLinks.slice(1).map(([label,href])=><Link key={href} href={href} className="px-6 py-3 block hover:bg-beige" onClick={() => setOpen(false)}>{label}</Link>)}
                    <button onClick={logout} className="px-6 py-3 block text-left text-madder w-full">Sign out</button>
                  </>
                ) : (
                  <>
                    <Link href="/signup" className="px-6 py-3 block hover:bg-beige" onClick={() => setOpen(false)}>Create an account</Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}

        {searchOpen && <SearchBar onClose={() => { setSearchOpen(false); searchTrigger.current?.focus(); }} />}
      </header>
    </>
  );
}
