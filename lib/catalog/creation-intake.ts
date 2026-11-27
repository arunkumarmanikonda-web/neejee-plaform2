import { createHash } from 'node:crypto';

export const intakePrefix = 'intake-';

export function creationProductId(actor: string, key?: unknown) {
  if (typeof key !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(key)) return null;
  return 'njp_' + createHash('sha256').update(actor + ':' + key.toLowerCase()).digest('hex').slice(0, 32);
}

export function intakeJobId(productId: string) { return intakePrefix + productId; }

export function intakeReferences(images: unknown, getPath: (value: string) => string | null) {
  if (!Array.isArray(images)) return [];
  const refs = images.filter((url): url is string => typeof url === 'string' && !!getPath(url)?.startsWith('products/'));
  return Array.from(new Set(refs)).slice(0, 10);
}

export function reviewedImages(jobId: string, generated: string[], originals: string[]) {
  return jobId.startsWith(intakePrefix) ? Array.from(new Set([...generated, ...originals])) : generated;
}
