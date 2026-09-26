import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const ALLOWED_ORIGINS=new Set(['https://nextgendevsecops.in','https://www.nextgendevsecops.in','https://mmukul.github.io']);
const VERSION='v73';
function originOf(req:Request){const o=req.headers.get('origin');return o&&ALLOWED_ORIGINS.has(o)?o:'https://nextgendevsecops.in';}
function cors(req:Request){return {'Access-Control-Allow-Origin':originOf(req),'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Vary':'Origin'};}
function json(req:Request,s:number,b:Record<string,unknown>){return new Response(JSON.stringify({...b,function_version:VERSION}),{status:s,headers:cors(req)});}
function hex(buf:ArrayBuffer){return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function hmac(secret:string,msg:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(msg)))}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
async function razorPayment(key:string,secret:string,paymentId:string){const auth=btoa(`${key}:${secret}`);const r=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,{headers:{Authorization:`Basic ${auth}`}});const data=await r.json().catch(()=>({}));return {ok:r.ok,data};}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 if(req.method==='GET')return json(req,200,{ok:true,service:'verify-razorpay-payment'});
 if(req.method!=='POST')return json(req,405,{error:'Method not allowed.'});
 const origin=req.headers.get('origin');if(origin&&!ALLOWED_ORIGINS.has(origin))return json(req,403,{error:'Origin not allowed.'});
 try{
  const url=Deno.env.get('SUPABASE_URL'),sr=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),secret=Deno.env.get('RAZORPAY_KEY_SECRET'),key=Deno.env.get('RAZORPAY_KEY_ID');
  if(!url||!sr||!secret||!key)return json(req,500,{error:'Payment service is not configured.'});
  const p=await req.json();const orderId=String(p?.order_id||'').trim(),paymentId=String(p?.payment_id||'').trim(),sig=String(p?.signature||'').trim();
  if(!/^order_[A-Za-z0-9]+$/.test(orderId)||!/^pay_[A-Za-z0-9]+$/.test(paymentId)||!/^[a-f0-9]{64}$/i.test(sig))return json(req,400,{error:'Incomplete or invalid payment confirmation.'});
  const expected=await hmac(secret,`${orderId}|${paymentId}`);if(!safeEqual(expected.toLowerCase(),sig.toLowerCase()))return json(req,403,{error:'Payment signature verification failed.'});
  const admin=createClient(url,sr,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:row,error:re}=await admin.from('gateway_payment_orders').select('*').eq('gateway_order_id',orderId).maybeSingle();if(re)throw re;if(!row)return json(req,404,{error:'Payment order not found.'});
  if(row.status==='paid')return json(req,200,{ok:true,status:'paid',reference:row.reference,amount:row.amount,plan:row.plan});
  const pay=await razorPayment(key,secret,paymentId);if(!pay.ok)return json(req,502,{error:'Unable to confirm payment status with the gateway.'});
  const pd=pay.data;
  const expectedPaise=Math.round(Number(row.amount)*100);
  if(String(pd.order_id||'')!==orderId)return json(req,400,{error:'Payment does not belong to this order.'});
  if(String(pd.currency||'')!=='INR'||Number(pd.amount)!==expectedPaise)return json(req,400,{error:'Payment amount or currency does not match the order.'});
  if(pd.status!=='captured')return json(req,202,{ok:true,status:pd.status||'processing',reference:row.reference});
  const {error:ue}=await admin.from('gateway_payment_orders').update({gateway_payment_id:paymentId,status:'paid',paid_at:new Date().toISOString()}).eq('id',row.id).neq('status','paid');if(ue)throw ue;
  return json(req,200,{ok:true,status:'paid',reference:row.reference,amount:row.amount,plan:row.plan});
 }catch(e){console.error('verify-razorpay-payment',e);return json(req,500,{error:'Unable to verify the payment. Please contact the administrator.',error_code:'GATEWAY_VERIFY_ERROR'});}
});
