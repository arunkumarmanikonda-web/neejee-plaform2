import { NextResponse } from 'next/server';
import { getSession,requireRole } from '@/lib/auth';
import { getSellerContext,canEditInventory,canEditFinance } from '@/lib/seller-auth-helpers';
import { prisma } from '@/lib/prisma';
import { privateSellerDocumentPathFromUrl } from '@/lib/storage';
import { privateSellerDownload,sellerInventoryPath,sellerFileUrl } from '@/lib/seller-private-files';

export async function GET(_req:Request,{params}:{params:Promise<{token:string}>}) {
  const user=await getSession();
  if (!user) return NextResponse.json({error:'Sign in to open this file.'},{status:401});
  const {token}=await params,missing=()=>NextResponse.json({error:'File not found'},{status:404});
  if (!/^[A-Za-z0-9_-]{1,800}$/.test(token)) return missing();
  const admin=requireRole(user,['SUPER_ADMIN','ADMIN']);
  const seller=admin?null:await getSellerContext(user);
  if (!admin&&(!seller || seller.seller.kycStatus !== 'APPROVED')) return missing();
  const fileUrl='/api/seller/files/'+token;
  if (admin || (seller && canEditInventory(seller))) {
    const row=await prisma.sellerInventorySubmission.findFirst({where:{sourceFileUrl:fileUrl,...(seller?{sellerId:seller.seller.id}:{})},select:{sellerId:true,sourceFileName:true}});
    const path=row&&sellerInventoryPath(fileUrl,row.sellerId);
    if (path) return privateSellerDownload(path,row.sourceFileName||'inventory.csv');
  }
  if (!admin && (!seller||!canEditFinance(seller))) return missing();
  const storedUrl='/api/admin/seller-documents/'+token;
  const row=await prisma.sellerDocument.findFirst({where:{fileUrl:storedUrl,...(seller?{sellerId:seller.seller.id}:{})},select:{sellerId:true,fileName:true}});
  const path=row&&privateSellerDocumentPathFromUrl(storedUrl);
  if (!row||!path||sellerFileUrl(path)!==fileUrl ||
      !(path.startsWith('seller-documents/'+row.sellerId+'/')||path.startsWith('seller-applications/intake/'))) return missing();
  return privateSellerDownload(path,row.fileName);
}
