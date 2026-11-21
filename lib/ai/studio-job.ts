import { createHmac,timingSafeEqual } from 'node:crypto';

function signature(owner:string,query:URLSearchParams):string {
  const secret=process.env.AI_MEDIA_SIGNING_SECRET || process.env.AUTH_SECRET || '';
  if(secret.length<32) throw Error('Photo studio signing is unavailable');
  const fields=['id','previewId','endpoint','statusUrl','responseUrl','until'].map(key=>query.get(key)||'');
  return createHmac('sha256',secret).update(JSON.stringify(['studio-job/v1',owner,...fields])).digest('hex');
}
export function signStudioJob(owner:string,query:URLSearchParams) {
  query.set('until',String(Date.now()+60*60*1000));
  query.set('proof',signature(owner,query));
}
export function verifyStudioJob(owner:string,query:URLSearchParams) {
  const until=Number(query.get('until'));
  const proof=query.get('proof') || '';
  if(!Number.isFinite(until)||until<Date.now()||!/^[a-f0-9]{64}$/.test(proof)) return false;
  return timingSafeEqual(Buffer.from(proof,'hex'),Buffer.from(signature(owner,query),'hex'));
}
