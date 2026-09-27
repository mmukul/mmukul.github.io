import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const VERSION='v92';
async function hmac(secret:string,msg:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(msg)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
Deno.serve(async req=>{
 if(req.method==='GET')return new Response(JSON.stringify({ok:true,service:'razorpay-webhook',function_version:VERSION}),{status:200,headers:{'Content-Type':'application/json'}});
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 try{
  const secret=Deno.env.get('RAZORPAY_WEBHOOK_SECRET'),url=Deno.env.get('SUPABASE_URL'),sr=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!secret||!url||!sr)return new Response('Webhook not configured',{status:500});
  const raw=await req.text();if(raw.length>200000)return new Response('Payload too large',{status:413});
  const sig=req.headers.get('x-razorpay-signature')||'';const expected=await hmac(secret,raw);if(!sig||expected!==sig)return new Response('Invalid signature',{status:401});
  const event=JSON.parse(raw);const payment=event?.payload?.payment?.entity;const order=event?.payload?.order?.entity;const orderId=String(payment?.order_id||order?.id||'').trim();const paymentId=String(payment?.id||'').trim();if(!orderId)return new Response(JSON.stringify({ok:true,ignored:true}),{status:200,headers:{'Content-Type':'application/json'}});
  const admin=createClient(url,sr,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:row,error:findError}=await admin.from('gateway_payment_orders').select('id,amount,status').eq('gateway_order_id',orderId).maybeSingle();if(findError)throw findError;if(!row)return new Response(JSON.stringify({ok:true,ignored:true,reason:'unknown_order'}),{status:200,headers:{'Content-Type':'application/json'}});
  if(event.event==='payment.captured'||event.event==='order.paid'){
    if(payment?.status && payment.status!=='captured')return new Response(JSON.stringify({ok:true,ignored:true}),{status:200,headers:{'Content-Type':'application/json'}});
    if(payment?.currency && payment.currency!=='INR')return new Response('Unexpected currency',{status:400});
    if(payment?.amount!=null && Number(payment.amount)!==Math.round(Number(row.amount)*100))return new Response('Amount mismatch',{status:400});
    const {error}=await admin.from('gateway_payment_orders').update({gateway_payment_id:paymentId||null,status:'paid',paid_at:new Date().toISOString()}).eq('id',row.id).neq('status','paid');if(error)throw error;
  } else if(event.event==='payment.failed'){
    const {error}=await admin.from('gateway_payment_orders').update({gateway_payment_id:paymentId||null,status:'failed',failure_reason:String(payment?.error_description||payment?.error_reason||'Payment failed').slice(0,500)}).eq('id',row.id).neq('status','paid');if(error)throw error;
  }
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
 }catch(e){console.error('razorpay-webhook',e);return new Response('Webhook processing failed',{status:500});}
});
