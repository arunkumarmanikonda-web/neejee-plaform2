import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { get, put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { readCredential } from '@/lib/payments/razorpay-credentials';
import { recoveryAuthorized } from '@/lib/recovery/authorization';
import { dumpDatabase, rehearseDatabase } from '@/lib/recovery/postgres-archive';
import { restoreFiles, sealFiles } from '@/lib/recovery/storage-archive';

export const runtime='nodejs';
export const preferredRegion='sin1';
export const dynamic='force-dynamic';
export const maxDuration=480;
const headers = {'Cache-Control':'private, no-store'};

export async function GET(request: Request) {
  if (!recoveryAuthorized(request)) return NextResponse.json({error:'Unauthorized'},{status:401,headers});
  const storeId=process.env.RECOVERY_STORE_ID, key=readCredential(process.env.RECOVERY_ARCHIVE_KEY);
  const missing = [readCredential(process.env.VERCEL_ENV) !== 'production' && 'production target',
    !storeId && 'store connection', !key && 'encryption key'].filter(Boolean);
  if (missing.length) return NextResponse.json({verified:false,stage:'configuration',reason:missing.join(', ')},{status:503,headers});
  const time=new Date().toISOString(), day=time.slice(0,10);
  const path='database/'+day+'.njbackup';
  const opts = {storeId,access:'private' as const,useCache:false};
  const write = {storeId,access:'private' as const,ttlDays:14,addRandomSuffix:false,allowOverwrite:false};
  let dir: string | undefined;
  let stage='receipt';
  try {
    const receipt=await get(path+'.verified',opts);
    if (receipt?.statusCode===200) return NextResponse.json(await new Response(receipt.stream).json(),{headers});
    stage='archive lookup';
    let existing=await get(path,opts);
    dir=await mkdtemp(join(tmpdir(),'neejee-db-'));
    if (!existing) {
      stage='database dump';
      const dump=await dumpDatabase(dir);
      const encrypted=sealFiles([{bucket:'database',name:'application.dump',contentType:'application/octet-stream',bytes:dump}],key,time);
      stage='archive write';
      await put(path,encrypted,{...write,contentType:'application/octet-stream'});
      existing=await get(path,opts);
    }
    stage='archive read-back';
    if (!existing || existing.statusCode!==200) throw new Error('No archive returned');
    const manifest=restoreFiles(Buffer.from(await new Response(existing.stream).arrayBuffer()),key);
    if (manifest.files.length!==1 || manifest.files[0].name!=='application.dump') throw new Error('Unexpected archive content');
    stage='isolated database restore';
    const counts=await rehearseDatabase(manifest.files[0].bytes,dir);
    const result={verified:true,date:manifest.createdAt,bytes:manifest.bytes,...counts};
    stage='receipt write';
    await put(path+'.verified',JSON.stringify(result),{...write,contentType:'application/json'});
    console.info('[database-recovery] Verified restore',counts.tables,'public tables');
    return NextResponse.json(result,{headers});
  } catch (e) {
    const err=e as {name?:string;code?:string;message?:string};
    const safeCode=err.code && /^[A-Z0-9_]{2,25}$/.test(err.code)?err.code:undefined;
    const reason=stage==='database dump' && err.message?.startsWith('Database ')?err.message
      : /^Failed to fetch blob: ([1-5][0-9]{2})/.exec(err.message || '')?.[1];
    console.error('[database-recovery] Incomplete',stage,err.name,safeCode,reason);
    return NextResponse.json({verified:false,stage,error:err.name,code:safeCode,reason},{status:503,headers});
  } finally { if (dir) await rm(dir,{recursive:true,force:true}); }
}
