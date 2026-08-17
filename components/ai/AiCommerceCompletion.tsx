'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { effectivePricePaise, formatINR } from '@/lib/money';

type Variant = {
  id: string;
  size?: string | null;
  color?: string | null;
  inventory?: number | null;
};

export type AiSourceProduct = {
  id: string;
  slug: string;
  name: string;
  sellingPrice: number;
  mrp?: number | null;
  salePrice?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  images?: string[] | null;
  inventory?: number | null;
  variants?: Variant[] | null;
};

type Recommendation = {
  id: string;
  slug: string;
  name: string;
  sellingPrice: number;
  mrp?: number | null;
  salePrice?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  images?: string[];
  inventory: number;
  requiresChoice?: boolean;
  quickAddVariant?: {
    id: string;
    size?: string | null;
    color?: string | null;
    label?: string | null;
  } | null;
};

export function AiCommerceCompletion({
  mode,
  sourceProduct,
  sourceVariantId,
}: {
  mode: 'mirror' | 'space';
  sourceProduct: AiSourceProduct;
  sourceVariantId?: string | null;
}) {
  const router = useRouter();
  const addItem = useCart(state => state.addItem);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/recommendations?productId=${encodeURIComponent(sourceProduct.id)}&limit=6`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (cancelled) return;
        setRecommendations(Array.isArray(data?.products) ? data.products : []);
        setLabel(data?.label || 'Complete your edit');
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sourceProduct.id]);

  const inStockSourceVariants = useMemo(
    () => (sourceProduct.variants || []).filter(variant => Number(variant.inventory || 0) > 0),
    [sourceProduct.variants],
  );

  const sourceVariant = useMemo(() => {
    if (sourceVariantId) {
      return inStockSourceVariants.find(variant => variant.id === sourceVariantId) || null;
    }
    return inStockSourceVariants.length === 1 ? inStockSourceVariants[0] : null;
  }, [inStockSourceVariants, sourceVariantId]);

  const sourceNeedsChoice = inStockSourceVariants.length > 1 && !sourceVariant;
  const selectedRecommendations = recommendations.filter(item => selected.has(item.id) && item.quickAddVariant && !item.requiresChoice);

  const sourcePrice = effectivePricePaise(
    sourceProduct.sellingPrice,
    sourceProduct.salePrice ?? null,
    sourceProduct.saleStartsAt ?? null,
    sourceProduct.saleEndsAt ?? null,
  ).price;

  const selectedTotal = selectedRecommendations.reduce((sum, item) => {
    return sum + effectivePricePaise(
      item.sellingPrice,
      item.salePrice ?? null,
      item.saleStartsAt ?? null,
      item.saleEndsAt ?? null,
    ).price;
  }, sourcePrice);

  const toggle = (id: string) => {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelection = () => {
    if (sourceNeedsChoice || adding) return;
    setAdding(true);

    addItem({
      id: sourceProduct.id,
      slug: sourceProduct.slug,
      name: sourceProduct.name,
      sellingPrice: sourcePrice,
      mrp: sourceProduct.mrp ?? undefined,
      images: sourceProduct.images || [],
      inventory: sourceVariant?.inventory ?? sourceProduct.inventory ?? undefined,
      variantId: sourceVariant?.id || null,
      variantLabel: sourceVariant
        ? [sourceVariant.size, sourceVariant.color].filter(Boolean).join(' · ') || null
        : null,
    }, 1);

    for (const item of selectedRecommendations) {
      const variant = item.quickAddVariant!;
      const price = effectivePricePaise(
        item.sellingPrice,
        item.salePrice ?? null,
        item.saleStartsAt ?? null,
        item.saleEndsAt ?? null,
      ).price;
      addItem({
        id: item.id,
        slug: item.slug,
        name: item.name,
        sellingPrice: price,
        mrp: item.mrp ?? undefined,
        images: item.images || [],
        inventory: item.inventory,
        variantId: variant.id,
        variantLabel: variant.label || null,
      }, 1);
    }

    router.push('/cart');
  };

  const heading = mode === 'mirror' ? 'Make it yours.' : 'Complete the space.';
  const eyebrow = mode === 'mirror' ? 'STYLE THIS LOOK' : 'SHOP THIS ROOM';

  return (
    <section className="mt-10 border-t border-mitti/20 pt-8 text-left">
      <p className="label text-madder">{eyebrow}</p>
      <h2 className="font-display text-3xl text-kohl mt-2">{heading}</h2>
      <p className="font-italic italic text-mitti text-sm mt-2">
        {mode === 'mirror'
          ? 'Choose only what feels like you. NEEJEE will keep the original piece at the centre.'
          : 'Layer the room gently. Add only the objects that belong.'}
      </p>

      {sourceNeedsChoice && (
        <div className="mt-6 border border-madder/30 bg-beige/40 p-4">
          <p className="font-display text-lg text-kohl">One detail before we add it.</p>
          <p className="font-ui text-xs text-mitti mt-1">This piece has more than one available colour or size. Choose the exact variant first.</p>
          <Link href={`/products/${sourceProduct.slug}`} className="btn-outline inline-block mt-3 text-xs">
            CHOOSE OPTIONS
          </Link>
        </div>
      )}

      {!loading && recommendations.length > 0 && (
        <div className="mt-7">
          <p className="font-display text-xl text-kohl">{label}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {recommendations.map(item => {
              const canQuickAdd = !!item.quickAddVariant && !item.requiresChoice;
              const chosen = selected.has(item.id);
              const price = effectivePricePaise(
                item.sellingPrice,
                item.salePrice ?? null,
                item.saleStartsAt ?? null,
                item.saleEndsAt ?? null,
              ).price;

              return (
                <div key={item.id} className={`border bg-ivory ${chosen ? 'border-madder' : 'border-mitti/20'}`}>
                  {item.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.images[0]} alt={item.name} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-beige" />
                  )}
                  <div className="p-3">
                    <p className="font-display text-sm text-kohl line-clamp-2">{item.name}</p>
                    <p className="font-ui text-xs text-mitti mt-1">{formatINR(price)}</p>
                    {canQuickAdd ? (
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        className={`mt-3 w-full py-2 px-3 text-[10px] tracking-widest border flex items-center justify-center gap-1.5 ${chosen ? 'bg-madder border-madder text-ivory' : 'border-mitti/30 text-kohl hover:border-madder'}`}
                      >
                        {chosen ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {chosen ? 'SELECTED' : 'ADD TO EDIT'}
                      </button>
                    ) : (
                      <Link href={`/products/${item.slug}`} className="mt-3 block text-center py-2 px-3 text-[10px] tracking-widest border border-mitti/30 text-kohl hover:border-madder">
                        CHOOSE OPTIONS
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!sourceNeedsChoice && (
        <button
          type="button"
          onClick={addSelection}
          disabled={adding}
          className="btn-primary w-full mt-7 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ShoppingBag className="w-4 h-4" />
          {adding
            ? 'ADDING…'
            : `${selectedRecommendations.length ? 'ADD SELECTED EDIT TO MY TRUNK' : 'ADD THIS PIECE TO MY TRUNK'} · ${formatINR(selectedTotal)}`}
        </button>
      )}
    </section>
  );
}
