export type StudioMode = 'imagine' | 'mirror';
export function studioHref(mode: StudioMode, product?: string, variant?: string | null, page?: number) {
  const query = new URLSearchParams();
  if (product) query.set('product',product);
  if (variant) query.set('variant',variant);
  if (page && page>1) query.set('page',String(page));
  return '/ai/'+mode+(query.size?'?'+query.toString():'');
}

export function localReturn(value: string | null | undefined, fallback = '') {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
