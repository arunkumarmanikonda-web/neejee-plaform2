'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { getCategoryTree,type CategoryTreeNode } from '@/lib/client/category-tree';
import { houseNavigation,editHref } from '@/lib/shop-edits';

export function stockedDepartments(tree:CategoryTreeNode[]) {
  return tree.filter(node=>!['women','home'].includes(node.slug) && node.active!==false && !node.hidden && Number(node.descendantSellableCount||node.directSellableCount||0)>0);
}
export default function MegaMenuNav() {
  const [more,setMore]=useState<CategoryTreeNode[]>([]);
  useEffect(()=>{let active=true;getCategoryTree().then(tree=>{if(active)setMore(stockedDepartments(tree));}).catch(()=>{});return ()=>{active=false;};},[]);
  return <nav aria-label="Shop navigation" className="house-shop-nav hidden lg:flex items-center font-ui">
    {houseNavigation.map(e=><Link key={e.slug} className="font-medium" href={editHref(e.slug)}>{e.name}</Link>)}

    <details className="relative"><summary className="cursor-pointer">Discover</summary><div className="absolute top-full right-0 z-50 mt-2 w-48 border border-mitti/20 bg-ivory shadow-md p-4 grid gap-3">
      <Link href="/looks">Saree styling ideas</Link><Link href="/ai/imagine">See décor in my room</Link><Link href="/counter">Compare sarees</Link><Link href="/edits/furniture">Furniture</Link><Link href="/products">Shop all pieces</Link><Link href="/about">Nidhi’s story</Link><Link href="/journal">The Journal</Link>{more.map(node=><Link key={node.id} href={'/categories/'+node.slug}>{node.name}</Link>)}</div></details>
  </nav>;
}
