'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type NavNode = {
  id: string;
  slug: string;
  name: string;
  level: number;
  path: string;
  parentId: string | null;
  children: NavNode[];
};

const MAIN_ORDER = ['women', 'men', 'accessories', 'home', 'fragrance', 'gifting'];

const FALLBACK_MAINS: NavNode[] = [
  { id: 'fallback-women', slug: 'women', name: 'WOMEN', level: 1, path: 'women', parentId: null, children: [] },
  { id: 'fallback-men', slug: 'men', name: 'MEN', level: 1, path: 'men', parentId: null, children: [] },
  { id: 'fallback-accessories', slug: 'accessories', name: 'ACCESSORIES', level: 1, path: 'accessories', parentId: null, children: [] },
  { id: 'fallback-home', slug: 'home', name: 'HOME', level: 1, path: 'home', parentId: null, children: [] },
  { id: 'fallback-fragrance', slug: 'fragrance', name: 'FRAGRANCE', level: 1, path: 'fragrance', parentId: null, children: [] },
  { id: 'fallback-gifting', slug: 'gifting', name: 'GIFTING', level: 1, path: 'gifting', parentId: null, children: [] },
];

function hrefFor(node: Pick<NavNode, 'path'>) {
  return '/categories/' + node.path;
}

function orderRoots(nodes: NavNode[]) {
  const rank = new Map(MAIN_ORDER.map((slug, i) => [slug, i]));
  return [...nodes].sort((a, b) => {
    const ai = rank.has(a.slug) ? rank.get(a.slug)! : 999;
    const bi = rank.has(b.slug) ? rank.get(b.slug)! : 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

function orderChildren(nodes: NavNode[]) {
  return [...nodes].sort((a, b) => a.name.localeCompare(b.name));
}

export default function MegaMenuNav() {
  const [mains, setMains] = useState<NavNode[]>(FALLBACK_MAINS);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadTree() {
      try {
        const menuPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('menuPreview') === '1'
        const treeUrl = menuPreview
          ? '/api/categories/tree?visible=preview&cb=' + Date.now()
          : '/api/categories/tree?visible=true&cb=' + Date.now()

        const res = await fetch(treeUrl, {
          cache: 'no-store',
        });
        if (!res.ok) return;

        const data = await res.json();
        const tree = Array.isArray(data?.tree) ? (data.tree as NavNode[]) : [];

        const fetchedBySlug = new Map(tree.map((n) => [n.slug, n]));
        const merged = MAIN_ORDER.map((slug) => fetchedBySlug.get(slug)).filter(Boolean) as NavNode[];

        if (alive && merged.length > 0) {
          setMains(orderRoots(merged));
        }
      } catch {
        // keep fallback mains silently
      }
    }

    loadTree();
    return () => {
      alive = false;
    };
  }, []);

  const orderedMains = useMemo(() => orderRoots(mains), [mains]);

  return (
    <nav className="hidden lg:flex items-center gap-6">
      {orderedMains.map((main) => {
        const children = Array.isArray(main.children) ? orderChildren(main.children) : [];
        const hasChildren = children.length > 0;

        return (
          <div
            key={main.id}
            className="relative"
            onMouseEnter={() => hasChildren && setOpenId(main.id)}
            onMouseLeave={() => setOpenId((curr) => (curr === main.id ? null : curr))}
          >
            <Link
              href={hrefFor(main)}
              className="inline-flex items-center text-[13px] font-medium uppercase tracking-[0.18em] text-neutral-900 hover:text-black"
            >
              {main.name}
            </Link>

            {hasChildren && openId === main.id && (
              <div className="absolute left-0 top-full z-[120] mt-4 min-w-[860px] rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
                <div className="grid grid-cols-4 gap-8">
                  {children.map((l2) => {
                    const l3s = Array.isArray(l2.children) ? orderChildren(l2.children) : [];

                    return (
                      <div key={l2.id} className="min-w-0">
                        <Link
                          href={hrefFor(l2)}
                          className="mb-3 block text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-900 hover:text-black"
                        >
                          {l2.name}
                        </Link>

                        <div className="space-y-2">
                          {l3s.length > 0 ? (
                            l3s.map((l3) => (
                              <Link
                                key={l3.id}
                                href={hrefFor(l3)}
                                className="block text-sm text-neutral-600 hover:text-black"
                              >
                                {l3.name}
                              </Link>
                            ))
                          ) : (
                            <Link
                              href={hrefFor(l2)}
                              className="block text-sm text-neutral-600 hover:text-black"
                            >
                              View all
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Link
        href="/stories"
        className="inline-flex items-center text-[13px] font-medium uppercase tracking-[0.18em] text-neutral-900 hover:text-black"
      >
        STORIES
      </Link>

      <Link
        href="/ai"
        className="inline-flex items-center text-[13px] font-medium uppercase tracking-[0.18em] text-neutral-900 hover:text-black"
      >
        AI ✦
      </Link>
    </nav>
  );
}