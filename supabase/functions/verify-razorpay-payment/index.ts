import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const ALLOWED_ORIGINS=new Set(['https://nextgendevsecops.in','https://www.nextgendevsecops.in']); const VERSION='v92';
function headers(origin?:string|null){return {'Access-Control-Allow-Origin':ALLOWED_ORIGINS.has(origin||'')?origin!:'https://nextgendevsecops.in','Vary':'Origin','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'}}
function json(s:number,b:Record<string,unknown>,o?:string|null){return new Response(JSON.stringify({...b,function_version:VERSION}),{status:s,headers:headers(o)})}
async function hmac(secret:string,msg:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(msg)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function razorPayment(paymentId:string,key:string,secret:string){const auth=btoa(`${key}:${secret}`);const r=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,{headers:{Authorization:`Basic ${auth}`}});const d=await r.json().catch(()=>({}));return {ok:r.ok,data:d}}
Deno.serve(async req=>{
 const o=req.headers.get('origin'); if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(o)}); if(req.method==='GET')return json(200,{ok:true,service:'verify-razorpay-payment'},o); if(req.method!=='POST')return json(405,{error:'Method not allowed.'},o); if(o&&!ALLOWED_ORIGINS.has(o))return json(403,{error:'Origin not allowed.'},o);
 const len=Number(req.headers.get('content-length')||'0');if(len>10000)return json(413,{error:'Request is too large.'},o);
 try{
  const url=Deno.env.get('SUPABASE_URL'),sr=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),secret=Deno.env.get('RAZORPAY_KEY_SECRET'),key=Deno.env.get('RAZORPAY_KEY_ID'); if(!url||!sr||!secret||!key)return json(500,{error:'Payment service is not configured.'},o);
  const p=await req.json();const orderId=String(p?.order_id||'').trim(),paymentId=String(p?.payment_id||'').trim(),sig=String(p?.signature||'').trim();if(!orderId||!paymentId||!sig||orderId.length>80||paymentId.length>80||sig.length>128)return json(400,{error:'Incomplete payment confirmation.'},o);
  const expected=await hmac(secret,`${orderId}|${paymentId}`);if(expected!==sig)return json(403,{error:'Payment signature verification failed.'},o);
  const admin=createClient(url,sr,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:row,error:re}=await admin.from('gateway_payment_orders').select('*').eq('gateway_order_id',orderId).maybeSingle();if(re)throw re;if(!row)return json(404,{error:'Payment order not found.'},o);
  if(row.status==='paid')return json(200,{ok:true,status:'paid',reference:row.reference,amount:row.amount,plan:row.plan},o);
  const rp=await razorPayment(paymentId,key,secret);if(!rp.ok)return json(502,{error:'Unable to confirm payment status with the gateway.'},o);const pd=rp.data;
  if(String(pd?.order_id||'')!==orderId)return json(403,{error:'Payment does not belong to this order.'},o);
  if(String(pd?.currency||'')!=='INR')return json(400,{error:'Unexpected payment currency.'},o);
  if(Number(pd?.amount)!==Math.round(Number(row.amount)*100))return json(400,{error:'Payment amount does not match the server-created order.'},o);
  if(pd?.status!=='captured')return json(202,{ok:true,status:pd?.status||'processing',reference:row.reference},o);
  const {error:ue}=await admin.from('gateway_payment_orders').update({gateway_payment_id:paymentId,status:'paid',paid_at:new Date().toISOString()}).eq('id',row.id).neq('status','paid');if(ue)throw ue;
  return json(200,{ok:true,status:'paid',reference:row.reference,amount:row.amount,plan:row.plan},o);
 }catch(e){console.error('verify-razorpay-payment',e);return json(500,{error:'Unable to verify the payment. Please contact the administrator.',error_code:'GATEWAY_VERIFY_ERROR'},o)}
});
