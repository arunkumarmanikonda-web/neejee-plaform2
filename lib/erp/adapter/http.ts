import { z } from 'zod';
import { ERP_ADAPTER_VERSION, type ErpAdapter } from './contracts';

const text = z.string().trim().min(1).max(500);
const number = z.number().int().nonnegative().safe();
const date = z.string().datetime({offset:true});
const common = {id:text, updatedAt:date};
const priceBase = {sku:text,currency:z.string().regex(/^[A-Z]{3}$/),updatedAt:date};
const product = z.object({...common,...priceBase,slug:text,name:text,sellerId:text.nullable(),
  status:z.enum(['ACTIVE','INACTIVE','DRAFT']),pricePaise:number});
const seller = z.object({...common,code:text,name:text,status:z.enum(['ACTIVE','INACTIVE'])});
const stock = z.object({sku:text,updatedAt:date,availableQuantity:number,reservedQuantity:number,inStock:z.boolean()});
const price = z.object({...priceBase,mrpPaise:number,sellingPricePaise:number,effectivePricePaise:number,onSale:z.boolean()});
const orderBase = {...common,currency:priceBase.currency,totalPaise:number};
const line = {sku:text,quantity:number.positive()};
const sales = z.object({...orderBase,orderNumber:text,sellerId:text.nullable(),placedAt:date,
  status:z.enum(['DRAFT','PLACED','CONFIRMED','FULFILLED','CANCELLED']),
  lines:z.array(z.object({...line,unitPricePaise:number,totalPricePaise:number})).max(1000)});
const purchase = z.object({...orderBase,poNumber:text,vendorCode:text,issuedAt:date,
  status:z.enum(['DRAFT','SENT','CONFIRMED','RECEIVED','CANCELLED']),
  lines:z.array(z.object({...line,unitCostPaise:number,totalCostPaise:number})).max(1000)});

export class ErpReadError extends Error {
  constructor(message: string, readonly retryable = false, readonly status?: number) { super(message); }
}
const invalid = () => new ErpReadError('The ERP bridge returned an invalid or incomplete response.');

export function bridgeConfig(origin?: string,token?: string) {
  if (!origin || !token?.trim()) throw new ErpReadError('Set ERP_API_ORIGIN and ERP_API_TOKEN to enable the ERP bridge.');
  let url:URL;
  try { url=new URL(origin); } catch { throw new ErpReadError('ERP_API_ORIGIN must be an HTTPS origin.'); }
  if (url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash) {
    throw new ErpReadError('ERP_API_ORIGIN must be an HTTPS origin without a path, query or credentials.');
  }
  if (/[\u0000-\u001f\u007f]/.test(token)) throw new ErpReadError('ERP_API_TOKEN contains invalid characters.');
  return {origin:url.origin,token:token.trim()};
}

async function jsonBody(response: Response):Promise<unknown> {
  if (!response.body || !response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw invalid();
  const reader=response.body.getReader(), decoder=new TextDecoder();
  let length=0, body='';
  try {
    while (true) {
      const part=await reader.read();
      if (part.done) break;
      length+=part.value.byteLength;
      if (length>2_000_000) { await reader.cancel(); throw invalid(); }
      body+=decoder.decode(part.value,{stream:true});
    }
    body+=decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(body); } catch { throw invalid(); }
}

export function createHttpAdapter(origin?: string, token?: string, transport:typeof fetch=fetch): ErpAdapter {
  const config=bridgeConfig(origin,token);
  const missing=Symbol('missing ERP record');
  async function read(path:string, query:URLSearchParams, allowMissing:boolean):Promise<unknown> {
    const url=new URL('/v1/'+path,config.origin);url.search=query.toString();
    try {
      const response=await transport(url,{method:'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000),
        headers:{Accept:'application/json',Authorization:'Bearer '+config.token}});
      if (response.status===404 && allowMissing) return missing;
      if (!response.ok) {
        const transient=[408,425,429].includes(response.status) || response.status>=500;
        throw new ErpReadError('ERP bridge returned HTTP '+response.status+'.',transient,response.status);
      }
      return await jsonBody(response);
    } catch (e) {
      if (e instanceof ErpReadError) throw e;
      throw new ErpReadError('The ERP bridge could not be reached.',true);
    }
  }
  async function one<T>(path:string,key:string,value:string,schema:z.ZodType<T>,identity:(row:T)=>string) {
    const normalized=value.trim().toUpperCase();
    if (!normalized || normalized.length>500) return null;
    const body=await read(path,new URLSearchParams({[key]:normalized}),true);
    if (body===missing) return null;
    const parsed=schema.safeParse(body);
    if (!parsed.success || identity(parsed.data).trim().toUpperCase()!==normalized) throw invalid();
    return parsed.data;
  }
  async function pageList<T>(path:string, query:URLSearchParams, schema:z.ZodType<T>,identity:(row:T)=>string, limit?:number) {
    const shape=z.object({items:z.array(schema).max(250),nextCursor:z.string().min(1).max(1000).nullable()});
    const items:T[]=[], cursors=new Set<string>(), ids=new Set<string>();
    for (let page=0;page<100;page++) {
      query.set('limit',String(Math.min(250,limit===undefined ? 250 : limit-items.length)));
      const parsed=shape.safeParse(await read(path,query,false));
      if (!parsed.success) throw invalid();
      for (const item of parsed.data.items) {
        const id=identity(item).trim().toUpperCase();
        if (ids.has(id)) throw invalid();
        ids.add(id); items.push(item);
        if (limit!==undefined && items.length===limit) return items;
      }
      const cursor=parsed.data.nextCursor;
      if (cursor===null) return items;
      if (cursors.has(cursor)) throw invalid();
      cursors.add(cursor); query.set('cursor',cursor);
    }
    throw new ErpReadError('ERP bridge catalogue exceeds the maximum response size. Use the complete stock feed for reconciliation.');
  }
  return {
    version:ERP_ADAPTER_VERSION,kind:'real',
    async listProducts(params={}) {
      const q=new URLSearchParams();
      if (params.sellerId?.trim()) q.set('sellerId',params.sellerId.trim());
      if (params.status && params.status!=='ALL') q.set('status',params.status);
      const limit=params.limit && Number.isFinite(params.limit) && params.limit>=1 ? Math.floor(params.limit):undefined;
      const rows=await pageList('products',q,product,row=>row.sku,limit);
      if (rows.some(r=>(q.has('sellerId') && r.sellerId!==q.get('sellerId')) || (q.has('status') && r.status!==q.get('status')))) throw invalid();
      return rows;
    },
    listSellers:()=>pageList('sellers',new URLSearchParams(),seller,row=>row.id),
    getProductBySku:sku=>one('product','sku',sku,product,row=>row.sku),
    getStockBySku:sku=>one('stock','sku',sku,stock,row=>row.sku),
    getPriceBySku:sku=>one('price','sku',sku,price,row=>row.sku),
    getSalesOrder:key=>one('sales-order','orderNumber',key,sales,row=>row.orderNumber),
    getPurchaseOrder:key=>one('purchase-order','poNumber',key,purchase,row=>row.poNumber),
  };
}
