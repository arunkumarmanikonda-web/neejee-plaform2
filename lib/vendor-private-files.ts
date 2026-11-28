import { randomUUID } from 'node:crypto';
import { uploadPrivateSellerDocument } from './storage';

export const vendorFilePrefix = '/api/vendor/files/';

export async function uploadVendorDocument(vendorId: string, data: Buffer, contentType: string) {
  const id = randomUUID();
  const path = 'vendor-docs/' + vendorId + '/' + id;
  await uploadPrivateSellerDocument(path, data, contentType);
  return { path, url: vendorFilePrefix + id };
}
