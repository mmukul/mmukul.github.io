import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const VERSION='v72';
function hex(buf:ArrayBuffer){return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function hmac(secret:string,msg:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(msg)))}
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response(JSON.stringify({ok:req.method==='GET',service:'razorpay-webhook',function_version:VERSION}),{status:req.method==='GET'?200:405,headers:{'Content-Type':'application/json'}});
 try{
  const secret=Deno.env.get('RAZORPAY_WEBHOOK_SECRET'), url=Deno.env.get('SUPABASE_URL'), sr=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if(!secret||!url||!sr)return new Response('Webhook not configured',{status:500});
  const raw=await req.text(); const sig=req.headers.get('x-razorpay-signature')||''; const expected=await hmac(secret,raw); if(expected!==sig)return new Response('Invalid signature',{status:401});
  const event=JSON.parse(raw); const payment=event?.payload?.payment?.entity; const orderId=payment?.order_id; const paymentId=payment?.id; if(!orderId)return new Response(JSON.stringify({ok:true,ignored:true}),{status:200,headers:{'Content-Type':'application/json'}});
  const admin=createClient(url,sr,{auth:{persistSession:false,autoRefreshToken:false}});
  if(event.event==='payment.captured'||event.event==='order.paid'){
   const {error}=await admin.from('gateway_payment_orders').update({gateway_payment_id:paymentId,status:'paid',paid_at:new Date().toISOString()}).eq('gateway_order_id',orderId); if(error)throw error;
  } else if(event.event==='payment.failed'){
   await admin.from('gateway_payment_orders').update({gateway_payment_id:paymentId,status:'failed',failure_reason:String(payment?.error_description||payment?.error_reason||'Payment failed')}).eq('gateway_order_id',orderId);
  }
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}});
 }catch(e){console.error('razorpay-webhook',e);return new Response('Webhook processing failed',{status:500});}
});
