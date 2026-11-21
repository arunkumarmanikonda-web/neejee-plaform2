'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { getCategoryTree,type CategoryTreeNode } from '@/lib/client/category-tree';
import { shopEdits,editHref } from '@/lib/shop-edits';

export function stockedDepartments(tree:CategoryTreeNode[]) {
  return tree.filter(node=>!['women','home'].includes(node.slug) && node.active!==false && !node.hidden && Number(node.descendantSellableCount||node.directSellableCount||0)>0);
}
export default function MegaMenuNav() {
  const [more,setMore]=useState<CategoryTreeNode[]>([]);
  useEffect(()=>{let active=true;getCategoryTree().then(tree=>{if(active)setMore(stockedDepartments(tree));}).catch(()=>{});return ()=>{active=false;};},[]);
  return <nav aria-label="Shop navigation" className="hidden lg:flex items-center gap-4 xl:gap-7 font-ui text-[.9rem]">
    {shopEdits.map(e=><Link key={e.slug} className="font-medium hover:underline underline-offset-4" href={editHref(e.slug)}>{e.name}</Link>)}
    <Link href="/ai/mirror" className="text-madder hover:underline">AI Mirror</Link><Link href="/ai/imagine" className="text-madder hover:underline">AI Imagine</Link>
    <details className="relative"><summary className="cursor-pointer">Explore</summary><div className="absolute top-full right-0 z-50 mt-2 w-48 border border-mitti/20 bg-ivory shadow-md p-4 grid gap-3">
      <Link href="/products">Shop all pieces</Link><Link href="/journal">The Journal</Link>{more.map(node=><Link key={node.id} href={'/categories/'+node.slug}>{node.name}</Link>)}</div></details>
  </nav>;
}
