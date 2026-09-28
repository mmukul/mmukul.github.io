import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://nextgendevsecops.in','https://www.nextgendevsecops.in']);
const VERSION = 'v102-secure-razorpay-order';
const cors = (origin?: string | null) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin || '') ? origin! : 'https://nextgendevsecops.in',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
});
const COURSE_KEYS = new Set(['devops','devsecops-foundational','devsecops-advanced','genai']);
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE=/^[+0-9()\-\s]{7,20}$/;
function json(status:number, body:Record<string,unknown>, origin?:string|null){return new Response(JSON.stringify({...body,function_version:VERSION}),{status,headers:cors(origin)});}
function norm(v:unknown,max:number){return String(v??'').trim().replace(/\s+/g,' ').slice(0,max)}
function reference(){const b=crypto.getRandomValues(new Uint8Array(8));return `RZ-${Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()}`}
async function razor(path:string, init:RequestInit){
  const key=Deno.env.get('RAZORPAY_KEY_ID'), secret=Deno.env.get('RAZORPAY_KEY_SECRET');
  if(!key||!secret) throw new Error('Payment gateway is not configured.');
  const auth=btoa(`${key}:${secret}`);
  const r=await fetch(`https://api.razorpay.com/v1${path}`,{...init,headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/json',...(init.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(String(data?.error?.description||'Razorpay request failed.'));
  return data;
}
Deno.serve(async req=>{
  const origin=req.headers.get('origin');
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
  if(req.method==='GET') return json(200,{ok:true,service:'create-razorpay-order'},origin);
  if(req.method!=='POST') return json(405,{error:'Method not allowed.'},origin);
  if(origin && !ALLOWED_ORIGINS.has(origin)) return json(403,{error:'Origin not allowed.'},origin);
  const len=Number(req.headers.get('content-length')||'0'); if(len>20000) return json(413,{error:'Request is too large.'},origin);
  try{
    const url=Deno.env.get('SUPABASE_URL'), sr=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!sr) return json(500,{error:'Payment service is not configured.'},origin);
    const p=await req.json();
    const courseKey=norm(p?.course_key,60).toLowerCase(); const plan0=norm(p?.plan,10).toLowerCase(); const plan=plan0==='part'?'part1':plan0;
    const name=norm(p?.name,100), email=norm(p?.email,254).toLowerCase(), phone=norm(p?.phone,20);
    if(!COURSE_KEYS.has(courseKey)||!['full','part1'].includes(plan)) return json(400,{error:'Invalid course or payment plan.'},origin);
    if(name.length<2||!EMAIL_RE.test(email)||(phone&&!PHONE_RE.test(phone))) return json(400,{error:'Please provide valid payment details.'},origin);
    const admin=createClient(url,sr,{auth:{persistSession:false,autoRefreshToken:false}});
    const hourAgo=new Date(Date.now()-60*60*1000).toISOString();
    const {count,error:rateError}=await admin.from('gateway_payment_orders').select('id',{count:'exact',head:true}).eq('payer_email',email).gte('created_at',hourAgo);
    if(rateError) throw rateError; if((count??0)>=5) return json(429,{error:'Too many payment attempts for this email. Please try again later.'},origin);
    const {data:course,error:ce}=await admin.from('payment_catalog').select('course_key,course_name,full_amount,part_amount,active').eq('course_key',courseKey).eq('active',true).maybeSingle();
    if(ce) throw ce; if(!course) return json(400,{error:'This course is not currently available for payment.'},origin);
    const amount=Number(plan==='part1'?course.part_amount:course.full_amount), full=Number(course.full_amount), part=Number(course.part_amount);
    if(!Number.isFinite(full)||!Number.isFinite(part)||part<=0||part>full||!Number.isFinite(amount)||amount<=0) return json(500,{error:'Course payment configuration is invalid.'},origin);
    const ref=reference();
    const order=await razor('/orders',{method:'POST',body:JSON.stringify({amount:Math.round(amount*100),currency:'INR',receipt:ref,notes:{reference:ref,course_key:courseKey,plan,payer_email:email},payment_capture:1})});
    const {error:ie}=await admin.from('gateway_payment_orders').insert({reference:ref,gateway:'razorpay',gateway_order_id:order.id,course_key:course.course_key,course_name:course.course_name,payer_name:name,payer_email:email,payer_phone:phone||null,plan,amount,currency:'INR',status:'created'});
    if(ie) throw ie;
    return json(201,{ok:true,reference:ref,order_id:order.id,amount:Number(order.amount),amount_rupees:amount,currency:order.currency||'INR',plan,key_id:Deno.env.get('RAZORPAY_KEY_ID')},origin);
  }catch(e){console.error('create-razorpay-order',e);return json(500,{error:'Unable to start secure payment. Please try again.',error_code:'GATEWAY_ORDER_ERROR'},origin);}
});
