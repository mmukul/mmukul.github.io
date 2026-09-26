import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const ORIGIN='https://mmukul.github.io'; const VERSION='v72';
const CORS={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
function json(s:number,b:Record<string,unknown>){return new Response(JSON.stringify({...b,function_version:VERSION}),{status:s,headers:CORS})}
function hex(buf:ArrayBuffer){return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function hmac(secret:string,msg:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(msg)))}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS}); if(req.method==='GET')return json(200,{ok:true,service:'verify-razorpay-payment'}); if(req.method!=='POST')return json(405,{error:'Method not allowed.'});
 const origin=req.headers.get('origin');if(origin&&origin!==ORIGIN)return json(403,{error:'Origin not allowed.'});
 try{
  const url=Deno.env.get('SUPABASE_URL'), sr=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), secret=Deno.env.get('RAZORPAY_KEY_SECRET'); if(!url||!sr||!secret)return json(500,{error:'Payment service is not configured.'});
  const p=await req.json(); const orderId=String(p?.order_id||'').trim(), paymentId=String(p?.payment_id||'').trim(), sig=String(p?.signature||'').trim(); if(!orderId||!paymentId||!sig)return json(400,{error:'Incomplete payment confirmation.'});
  const expected=await hmac(secret,`${orderId}|${paymentId}`); if(expected!==sig)return json(403,{error:'Payment signature verification failed.'});
  const admin=createClient(url,sr,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:row,error:re}=await admin.from('gateway_payment_orders').select('*').eq('gateway_order_id',orderId).maybeSingle(); if(re)throw re; if(!row)return json(404,{error:'Payment order not found.'});
  if(row.status==='paid')return json(200,{ok:true,status:'paid',reference:row.reference});
  const auth=btoa(`${Deno.env.get('RAZORPAY_KEY_ID')}:${secret}`); const rr=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,{headers:{Authorization:`Basic ${auth}`}}); const pd=await rr.json().catch(()=>({}));
  if(!rr.ok)return json(502,{error:'Unable to confirm payment status with the gateway.'});
  if(pd.status!=='captured')return json(202,{ok:true,status:pd.status||'processing',reference:row.reference});
  const {error:ue}=await admin.from('gateway_payment_orders').update({gateway_payment_id:paymentId,status:'paid',paid_at:new Date().toISOString()}).eq('id',row.id); if(ue)throw ue;
  return json(200,{ok:true,status:'paid',reference:row.reference,amount:row.amount,plan:row.plan});
 }catch(e){console.error('verify-razorpay-payment',e);return json(500,{error:'Unable to verify the payment. Please contact the administrator.',error_code:'GATEWAY_VERIFY_ERROR'});}
});
