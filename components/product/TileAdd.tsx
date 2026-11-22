'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import { buildPricing } from '@/lib/catalog/pricing-read';
import { isSoldOut, type FulfilmentProduct } from '@/lib/fulfilment';
import { formatINR } from '@/lib/money';

type Option = {
  id: string;
  sku: string;
  inStock: boolean;
  size?: string;
  color?: string;
  material?: string;
  images?: string[];
  inventory?: number | null;
  sellingPrice?: number | null;
};

type Piece = FulfilmentProduct & {
  id: string;
  name: string;
  slug: string;
  images: string[];
  mrp?: number;
  catalogueCtaMode?: string | null;
  variants: Option[];
};

const optionName = (option: Option) =>
  [option.color, option.size, option.material].filter(Boolean).join(' · ') || option.sku;

function optionPrice(piece: Piece, option: Option) {
  return option.sellingPrice ?? buildPricing(piece).effectivePrice;
}

export function TileAdd({ slug, name, soldOut = false }: { slug: string; name: string; soldOut?: boolean }) {
  const [piece, setPiece] = useState<Piece | null>(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [detailsRequired, setDetailsRequired] = useState(false);
  const locked = useRef(false);
  const router = useRouter();
  const add = useCart(store => store.addItem);

  async function choose() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    let added = false;
    try {
      const response = await fetch('/api/products/' + encodeURIComponent(slug), { cache: 'no-store' });
      if (!response.ok) throw Error('This piece could not be loaded. Please try again.');
      const { product }: { product: Piece } = await response.json();
      if (!product?.id) throw Error('This piece is currently unavailable.');
      if ((product.catalogueCtaMode && product.catalogueCtaMode !== 'SHOP_NOW') || product.fulfilmentMode === 'PREORDER') {
        setDetailsRequired(true);
        return;
      }
      if (isSoldOut(product)) throw Error('This edition has sold out.');

      const available = product.variants.filter(option => option.inStock);
      if (!available.length) throw Error('This piece is currently out of stock.');
      const selected = choice ? available.find(option => option.id === choice) : available.length === 1 ? available[0] : undefined;
      if (!selected) {
        setPiece({ ...product, variants: available });
        setChoice('');
        if (choice) setMessage('That option has sold out. Choose another.');
        return;
      }

      const price = optionPrice(product, selected);
      if (!(price > 0)) throw Error('The price is being updated. Please try again.');
      const line = useCart.getState().items.find(item => item.productId === product.id && item.variantId === selected.id);
      if (selected.inventory != null && (line?.quantity ?? 0) >= selected.inventory) {
        throw Error('All available pieces in this option are already in your bag.');
      }
      add({
        id: product.id, name: product.name, slug: product.slug, sellingPrice: price, mrp: product.mrp,
        variantId: selected.id, variantLabel: optionName(selected), inventory: selected.inventory ?? undefined,
        images: selected.images?.length ? selected.images : product.images,
      });
      added = true;
      router.push('/cart');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (!added) {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  if (detailsRequired) {
    return <Link className="nj-add-tile" href={'/products/' + encodeURIComponent(slug)}>See purchase options</Link>;
  }
  return <div className="nj-tile-purchase">
    {piece && <label className="nj-tile-options">Choose an option
      <select aria-label={'Option for ' + name} value={choice} onChange={event => setChoice(event.target.value)}>
        <option value="">Colour / size</option>
        {piece.variants.map(option => <option key={option.id} value={option.id}>
          {optionName(option)} · {formatINR(optionPrice(piece, option))}
        </option>)}
      </select>
    </label>}
    <button type="button" className="nj-add-tile" disabled={busy || soldOut || (!!piece && !choice)}
      aria-label={'Add ' + name + ' to bag'} onClick={choose}>
      <ShoppingBag size={15}/>{soldOut ? 'Sold out' : busy ? 'Checking…' : 'Add to bag'}
    </button>
    {message && <p role="status" className="nj-tile-message">{message}</p>}
  </div>;
}
