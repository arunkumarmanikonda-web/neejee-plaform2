import { NextResponse } from 'next/server';
import { catalogImageType } from '@/lib/admin/image-format';
import { fetchPrivateSellerDocument } from '@/lib/storage';

export function sellerDocumentType(bytes:Buffer) {
  if (bytes.subarray(0,5).toString('ascii') === '%PDF-') return 'application/pdf';
  const type=catalogImageType(bytes);
  return type && ['image/jpeg','image/png','image/webp'].includes(type) ? type : null;
}
export const sellerFileUrl=(path:string)=>'/api/seller/files/'+Buffer.from(path,'utf8').toString('base64url');
export function sellerInventoryPath(url:string,sellerId:string) {
  if (!url.startsWith('/api/seller/files/')) return null;
  const token=url.slice('/api/seller/files/'.length);
  if (!/^[A-Za-z0-9_-]{1,800}$/.test(token)) return null;
  const path=Buffer.from(token,'base64url').toString('utf8');
  return path.startsWith('seller-inventory-files/'+sellerId+'/') && !path.includes('..') && sellerFileUrl(path)===url ? path : null;
}
export async function privateSellerDownload(path:string,filename:string) {
  const stored=await fetchPrivateSellerDocument(path);
  if (!stored.ok) return NextResponse.json({error:'File unavailable'},{status:stored.status===404?404:502});
  const safeName=filename.replace(/[^A-Za-z0-9_. -]/g,'_').slice(0,130)||'seller-file';
  return new NextResponse(stored.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="'+safeName+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
