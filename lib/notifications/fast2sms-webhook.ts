import {fast2smsEntityId} from '@/lib/fast2sms-config';
import {webhookSecretConfigured} from '@/lib/webhooks/auth';

const api = 'https://www.fast2sms.com/dev/webhook/v2/sms';
const url = 'https://www.neejee.com/api/webhooks/fast2sms';
const name = 'Neejee order SMS receipts';
type Hook = {id?:string;name?:string;url?:string;status?:string;identity_id?:string;event?:string};
export type HookResult = {state:string; http?:number; ok?:boolean};

export async function fast2smsWebhook(register = false): Promise<HookResult> {
  const credential = process.env.FAST2SMS_API_KEY?.trim();
  const entity = fast2smsEntityId();
  const secret = process.env.FAST2SMS_WEBHOOK_SECRET;
  if (!credential) return {state:'Missing SMS API credential'};
  const options = {headers:{authorization:credential,'Content-Type':'application/json'},redirect:'error' as const,cache:'no-store' as const};
  try {
    const list = await fetch(api,{...options,signal:AbortSignal.timeout(6500)});
    const inventory = await list.json().catch(()=>null);
    if (!list.ok || inventory?.return !== true || !Array.isArray(inventory?.data)) {
      const providerCode = Number(inventory?.status_code);
      return {state:'Fast2SMS did not allow access to the webhook list'+(Number.isInteger(providerCode) && providerCode > 0 ? ' (provider code '+providerCode+')' : ''),http:list.status};
    }
    const matches: Hook[] = inventory.data.filter((hook:Hook)=>hook.url === url || hook.name === name);
    if (matches.length) {
      const [hook] = matches;
      const paired = matches.length === 1 && hook.url === url && !!entity && String(hook.identity_id) === entity && hook.status === 'active' && hook.event === 'all';
      return {ok:paired,state:paired?'Entity-scoped SMS callback active at Fast2SMS':'An existing SMS callback needs review in the Fast2SMS dashboard',http:list.status};
    }
    if (!register) return {state:'API connected. Neejee SMS callback is not registered',http:list.status};
    if (!webhookSecretConfigured(secret) || !entity) return {state:'A production callback secret and DLT entity ID are required'};
    const payload = {name,url,template:'custom',event:'all',identity_id:entity,method:'POST',content_type:'application/json',status:'active',
      payload:{request_id:'{{request_id}}',status:'{{status}}',failure_reason:'{{failure_reason}}',delivered_at:'{{delivery_time}}'},
      header_key:['X-Neejee-Webhook-Token'],header_value:[secret]};
    const response=await fetch(api,{...options,method:'POST',body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
    const result=await response.json().catch(()=>null);
    if (!response.ok || result?.return !== true || !result?.data?.id) return {state:'Fast2SMS did not confirm registration. Check its webhook list before retrying',http:response.status};
    return {ok:true,state:'Fast2SMS accepted the Neejee SMS callback',http:response.status};
  } catch { return {state:'Fast2SMS did not confirm the request. Check the provider list before retrying'}; }
}
