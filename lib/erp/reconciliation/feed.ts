import { parseStockSheet } from './stock-sheet';

export async function readStockFeed(endpoint:string, token?:string) {
  const target = new URL(endpoint);
  if (target.protocol !== 'https:' || target.username || target.password) throw Error('The stock feed must use HTTPS and server-configured credentials.');
  const response = await fetch(target,{headers:{Accept:'text/csv',...(token?{Authorization:'Bearer '+token}:{})},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
  if (!response.ok || !response.body) throw Error('The configured ERP stock feed is unavailable.');
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let size=0, csv='';
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      size+=value.byteLength;
      if (size>1500000) {await reader.cancel();throw Error('The ERP stock feed exceeds 1.5 MB.');}
      csv+=decoder.decode(value,{stream:true});
    }
    csv+=decoder.decode();
  } finally {reader.releaseLock();}
  const header=response.headers.get('last-modified');
  const modified=header?new Date(header):null;
  const verifiedAt = modified && !Number.isNaN(modified.getTime()) ? modified.toISOString() : new Date().toISOString();
  return parseStockSheet(csv,verifiedAt);
}
