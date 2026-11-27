import type { CartItem, CartProduct } from './cart-store';
import { studyStyleHref, styleHref } from './pairing';
import { studies, type Study } from './shop-studies';
import { editorialOptions, editorialLooks } from './stylebook';
import type { PairPiece, PairSlot } from './pairing';

export const reviewCookie = 'neejee_collection_preview';
export const reviewSizes = ['S', 'M', 'L', 'XL'] as const;
export const reviewPrefix = 'collection-preview-';

export function inCollectionReview() {
  return typeof document !== 'undefined' && document.cookie.split(';').some(c => c.trim() === reviewCookie + '=1');
}
export function studyCartProduct(study: Study, size = ''): CartProduct {
  const id = reviewPrefix + study.id;
  return {id, slug:study.id, name:study.name, images:[study.image], sellingPrice:study.price,
    variantId:id + (size ? '-' + size : ''), variantLabel:[study.shade, size].filter(Boolean).join(' · ')};
}
export function reviewStudy(line: CartItem) {
  return studies.find(s => line.productId === reviewPrefix + s.id);
}
export function lineDetails(line: CartItem) {
  const study = reviewStudy(line);
  return study ? '/edits/' + study.group + '?piece=' + study.id : '/products/' + encodeURIComponent(line.product.slug);
}
export function lineStyling(line: CartItem) {
  const study = reviewStudy(line);
  return study ? studyStyleHref(study.id) + '&review=1&variant=' + encodeURIComponent(line.variantId || '') : styleHref(line.productId,line.variantId);
}
export function reviewMatches(study: Study, slot: PairSlot): PairPiece[] {
  const kinds: Partial<Record<PairSlot,string>> = {blouse:'blouse',jewellery:'jewel',footwear:'shoe'};
  const target = kinds[slot];
  if (!target) return [];
  const look = editorialLooks.find(s => s.id === study.id);
  const first = slot === 'blouse' ? (study.id === 'surkh' || study.id === 'haldi' ? 'blouse-wine' : 'blouse-ivory')
    : slot === 'footwear' ? look?.shoe || 'jutti-ivory' : look?.jewel || 'jewel-pearl';
  const prices:Record<string,number> = {'blouse-wine':180000,'blouse-ivory':160000,'blouse-teal':210000,'jutti-gold':220000,'jutti-ivory':200000,'jutti-tan':190000,'jewel-jhumka':150000,'jewel-pearl':120000,'jewel-silver':170000};
  return editorialOptions.filter(p => p.slot === target).sort((a,b)=>Number(b.id===first)-Number(a.id===first))
    .map(p => ({id:reviewPrefix+p.id, slug:p.id, variant:reviewPrefix+p.id, name:p.name, image:p.image, price:prices[p.id], option:'',
      reason:p.id === first ? study.pairing : undefined}));
}
