import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const VERSION='v73';
function hex(buf:ArrayBuffer){return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function hmac(secret:string,msg:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(msg)))}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response(JSON.stringify({ok:req.method==='GET',service:'razorpay-webhook',function_version:VERSION}),{status:req.method==='GET'?200:405,headers:{'Content-Type':'application/json'}});
 try{
  const secret=Deno.env.get('RAZORPAY_WEBHOOK_SECRET'),url=Deno.env.get('SUPABASE_URL'),sr=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!secret||!url||!sr)return new Response('Webhook not configured',{status:500});
  const raw=await req.text(),sig=req.headers.get('x-razorpay-signature')||'',expected=await hmac(secret,raw);if(!safeEqual(expected.toLowerCase(),sig.toLowerCase()))return new Response('Invalid signature',{status:401});
  const event=JSON.parse(raw),payment=event?.payload?.payment?.entity,order=event?.payload?.order?.entity,orderId=String(payment?.order_id||order?.id||''),paymentId=String(payment?.id||'');if(!orderId)return new Response(JSON.stringify({ok:true,ignored:true}),{status:200,headers:{'Content-Type':'application/json'}});
  const admin=createClient(url,sr,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:row,error:re}=await admin.from('gateway_payment_orders').select('id,amount,status').eq('gateway_order_id',orderId).maybeSingle();if(re)throw re;if(!row)return new Response(JSON.stringify({ok:true,ignored:true}),{status:200,headers:{'Content-Type':'application/json'}});
  const eventIsPaid=event.event==='payment.captured'||event.event==='order.paid';
  if(eventIsPaid){
   const paidAmount=payment?Number(payment?.amount):Number(order?.amount_paid||order?.amount);
   const currency=String(payment?.currency||order?.currency||'');
   if(currency!=='INR'||paidAmount!==Math.round(Number(row.amount)*100))return new Response('Payment amount mismatch',{status:400});
   const {error}=await admin.from('gateway_payment_orders').update({gateway_payment_id:paymentId||null,status:'paid',paid_at:new Date().toISOString()}).eq('id',row.id).neq('status','paid');if(error)throw error;
  }else if(event.event==='payment.failed'){
   await admin.from('gateway_payment_orders').update({gateway_payment_id:paymentId,status:'failed',failure_reason:String(payment?.error_description||payment?.error_reason||'Payment failed')}).eq('id',row.id).neq('status','paid');
  }
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
 }catch(e){console.error('razorpay-webhook',e);return new Response('Webhook processing failed',{status:500});}
});
