import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
export const keeperChecks = [
  {key:'price',name:'Live pieces with a missing price',href:'/admin/products'},
  {key:'media',name:'Live pieces awaiting image approval',href:'/admin/products'},
  {key:'stock',name:'Variants with negative stock',href:'/admin/products'},
  {key:'failures',name:'Open ERP failures',href:'/admin/erp/failures'},
  {key:'stalled',name:'ERP work over an hour behind',href:'/admin/erp/dashboard'},
  {key:'journal',name:'Journal publications over ten minutes late',href:'/admin/cms'},
] as const;
const live = {status:'ACTIVE' as const,takedownAt:null,catalogueExclude:false};
const lateJournal = (now:Date) => ({pageType:'journal',status:'PREVIEW' as const,scheduledAt:{lt:new Date(now.getTime()-600000)}});
export async function inspectShop(db: Prisma.TransactionClient, now: Date) {
  const hourAgo = new Date(now.getTime()-3600000);
  const price = await db.product.count({where:{...live,sellingPrice:{lte:0}}});
  const media = await db.product.count({where:{...live,catalogueImageApproved:false}});
  const stock = await db.variant.count({where:{inventory:{lt:0}}});
  const failures = await db.erpDeadLetter.count({where:{status:'OPEN'}});
  const stalled = await db.erpSyncAttempt.count({where:{OR:[{status:'QUEUED',runAfter:{lt:hourAgo}},{status:'PROCESSING',updatedAt:{lt:hourAgo}}]}});
  const journal = await db.cmsPage.count({where:lateJournal(now)});
  return {price,media,stock,failures,stalled,journal};
}

export async function runKeeper(now = new Date()) {
  const hour = now.toISOString().slice(0,13);
  const id = 'store-keeper:'+hour;
  return prisma.$transaction(async tx=>{
    const claimed = await tx.financeAuditLog.createMany({data:[{id,action:'CHECK',entityType:'StoreKeeper',entityId:hour}],skipDuplicates:true});
    if (!claimed.count) return {repeated:true,repairs:0};
    const checks = await inspectShop(tx,now);
    const repaired = checks.journal ? await tx.cmsPage.updateMany({where:lateJournal(now),data:{status:'PUBLISHED',publishedAt:now,scheduledAt:null}}) : {count:0};
    await tx.financeAuditLog.update({where:{id},data:{fullSnapshot:JSON.stringify({checks,repairs:repaired.count,checkedAt:now.toISOString()})}});
    return {repeated:false,checks,repairs:repaired.count};
  },{timeout:20000});
}
