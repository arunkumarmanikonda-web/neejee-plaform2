export type GalleryChange = {mode:'append'|'replace'|'remove'; images:string[]};

export function parseGalleryChange(value: unknown, remove = false): GalleryChange | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  const images = remove ? [body.image] : body.images;
  if (!Array.isArray(images) || images.some(image => typeof image !== 'string' || !image.trim())) return null;
  if (!remove && body.mode !== undefined && body.mode !== 'append' && body.mode !== 'replace') return null;
  return {mode:remove ? 'remove' : body.mode === 'replace' ? 'replace' : 'append', images};
}

export function applyGalleryChange(current: string[], change: GalleryChange): string[] {
  if (change.mode === 'remove') return current.filter(image => !change.images.includes(image));
  return [...new Set(change.mode === 'replace' ? change.images : [...current, ...change.images])];
}

// An append or removal must be recomputed from the winning transaction's state.
export async function retryGalleryWrite<T>(transaction: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await transaction(); }
    catch (error) {
      if (attempt >= 3 || !(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error;
    }
  }
}
