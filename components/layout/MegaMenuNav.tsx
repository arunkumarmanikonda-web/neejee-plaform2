'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ScanFace } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getCategoryTree, type CategoryTreeNode } from '@/lib/client/category-tree';
import { houseNavigation, editHref } from '@/lib/shop-edits';
import styles from './ShopUtilities.module.css';

export function stockedDepartments(tree: CategoryTreeNode[]) {
  return tree.filter(node => !['women', 'home'].includes(node.slug) && node.active !== false && !node.hidden
    && Number(node.descendantSellableCount || node.directSellableCount || 0) > 0);
}

const discoverLinks = [
  ['Shop all pieces', '/products'], ['Saree styling ideas', '/looks'], ['Compare sarees', '/counter'],
  ['See décor in my room', '/ai/imagine'], ['Furniture', '/edits/furniture'], ['Nidhi’s story', '/about'], ['The journal', '/journal'],
];

export default function MegaMenuNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const [more, setMore] = useState<CategoryTreeNode[]>([]);
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);

  const [discoverOpened, setDiscoverOpened] = useState(false);
  useEffect(() => {
    if (!discoverOpened) return;
    let active = true;
    getCategoryTree().then(tree => { if (active) setMore(stockedDepartments(tree)); }).catch(() => {});
    return () => { active = false; };
  }, [discoverOpened]);

  useEffect(() => {
    if (menu.current) menu.current.open = false;
    const dismiss = (event: PointerEvent) => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [pathname]);

  function closeMenu() {
    if (menu.current) menu.current.open = false;
    onNavigate?.();
  }

  return <nav className={styles.ribbon} aria-label="Shop navigation">
    <div className={styles.navigation}>
      {houseNavigation.map(item => {
        const href = editHref(item.slug);
        return <Link key={href} className={styles.department} href={href} onClick={closeMenu}
          aria-current={pathname === href ? 'page' : undefined}>{item.name}</Link>;
      })}
      <details className={styles.discover} ref={menu} onToggle={event => { if (event.currentTarget.open) setDiscoverOpened(true); }} onKeyDown={event => {
        if (event.key === 'Escape' && menu.current?.open) {
          event.preventDefault();
          closeMenu();
          summary.current?.focus();
        }
      }} onBlur={event=>{
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && menu.current) menu.current.open=false;
      }}>
        <summary ref={summary}>Discover <ChevronDown size={14} aria-hidden="true"/></summary>
        <div className={styles.discoverPanel}>
          {discoverLinks.map(([label, href]) => <Link href={href} key={href} onClick={closeMenu}>{label}</Link>)}
          {more.map(item => <Link href={'/categories/' + encodeURIComponent(item.slug)} key={item.id} onClick={closeMenu}>{item.name}</Link>)}

        </div>
      </details>
      <Link className={styles.fitting} href="/ai/mirror" onClick={closeMenu} aria-label="Try on a saree with Aaina"
        aria-current={pathname === '/ai/mirror' ? 'page' : undefined}><ScanFace aria-hidden="true"/>Aaina <span>try-on</span></Link>
      <button type="button" className={styles.department} aria-haspopup="dialog" aria-label="Ask Sakhi" onClick={() => {
        closeMenu();
        window.dispatchEvent(new CustomEvent('neejee:ask-pitari'));
      }}>Sakhi</button>
    </div>
  </nav>;
}
