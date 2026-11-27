import { matchesShot, shotFileName, shotsFor } from '../product-capture/frames';

export type FabricDetail = { role: 'pallu' | 'border'; image: string };
const sareeShots = shotsFor('saree').map(shot => ({ id: shot.id, name: shotFileName('saree', shot) }));

/** Product-level images belong to the selected SKU only for a single-variant product.
 * Include out-of-stock siblings when deciding whether product media can be used. */
export function fittingReferences(variantImages: string[], productImages: string[], preferred: string | null, variantCount: number) {
  const images = [...new Set([...variantImages, ...(variantCount === 1 ? [preferred, ...productImages] : [])]
    .filter((image): image is string => !!image?.trim()))];
  const tagged = (id: string) => {
    const shot = sareeShots.find(s => s.id === id);
    return shot && images.find(image => matchesShot(image, shot.name));
  };
  // A close-up or an unstitched blouse alone cannot describe the whole saree.
  const primary = tagged('drape') || tagged('body') ||
    images.find(image => !sareeShots.some(shot => matchesShot(image, shot.name))) || null;
  const details: FabricDetail[] = [];
  if (primary) for (const role of ['pallu','border'] as const) {
    const image = tagged(role);
    if (image) details.push({role, image});
  }
  return {primary, details};
}

export function fabricInstructions(details: FabricDetail[]) {
  return details.map(({role}, i) => role === 'pallu'
    ? 'Image '+(i+3)+' is the actual pallu. Preserve its motif scale, panel layout, direction and end finish.'
    : 'Image '+(i+3)+' is the actual border. Preserve its relative width, colour, motifs and relation to the body. Ignore any ruler.');
}
