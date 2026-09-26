import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://nextgendevsecops.in','https://www.nextgendevsecops.in','https://mmukul.github.io']);
const FUNCTION_VERSION = 'v73';
const COURSE_KEYS = new Set(['devops','devsecops-foundational','devsecops-advanced','genai']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9()\-\s]{7,20}$/;
function originOf(req:Request){ const o=req.headers.get('origin'); return o&&ALLOWED_ORIGINS.has(o)?o:'https://nextgendevsecops.in'; }
function headers(req:Request){ return {'Access-Control-Allow-Origin':originOf(req),'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Vary':'Origin'}; }
function json(req:Request,status:number,body:Record<string,unknown>){return new Response(JSON.stringify({...body,function_version:FUNCTION_VERSION}),{status,headers:headers(req)});}
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
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:headers(req)});
  if(req.method==='GET') return json(req,200,{ok:true,service:'create-razorpay-order'});
  if(req.method!=='POST') return json(req,405,{error:'Method not allowed.'});
  const origin=req.headers.get('origin'); if(origin&&!ALLOWED_ORIGINS.has(origin))return json(req,403,{error:'Origin not allowed.'});
  try{
    const supabaseUrl=Deno.env.get('SUPABASE_URL'), serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!supabaseUrl||!serviceRole) return json(req,500,{error:'Payment service is not configured.'});
    const p=await req.json();
    const courseKey=norm(p?.course_key,60).toLowerCase();
    const plan0=norm(p?.plan,10).toLowerCase();
    const plan=plan0==='part'||plan0==='part1'?'part1':plan0;
    const name=norm(p?.name,100), email=norm(p?.email,254).toLowerCase(), phone=norm(p?.phone,20);
    if(!COURSE_KEYS.has(courseKey)||!['full','part1'].includes(plan))return json(req,400,{error:'Invalid course or payment plan.'});
    if(name.length<2||!EMAIL_RE.test(email)||(phone&&!PHONE_RE.test(phone)))return json(req,400,{error:'Please provide valid payment details.'});
    const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:course,error:ce}=await admin.from('payment_catalog').select('course_key,course_name,full_amount,part_amount,active').eq('course_key',courseKey).eq('active',true).maybeSingle();
    if(ce)throw ce;
    if(!course)return json(req,400,{error:'This course is not currently available for payment.'});
    const amount=Number(plan==='part1'?course.part_amount:course.full_amount);
    if(!Number.isFinite(amount)||amount<=0)return json(req,500,{error:'Payment amount is not configured correctly.'});
    const ref=reference();
    const order=await razor('/orders',{method:'POST',body:JSON.stringify({amount:Math.round(amount*100),currency:'INR',receipt:ref,notes:{reference:ref,course_key:courseKey,plan,payer_email:email}})});
    const {error:ie}=await admin.from('gateway_payment_orders').insert({reference:ref,gateway:'razorpay',gateway_order_id:order.id,course_key:course.course_key,course_name:course.course_name,payer_name:name,payer_email:email,payer_phone:phone||null,plan,amount,currency:'INR',status:'created'});
    if(ie)throw ie;
    return json(req,201,{ok:true,reference:ref,order_id:order.id,amount,currency:'INR',plan,key_id:Deno.env.get('RAZORPAY_KEY_ID')});
  }catch(e){console.error('create-razorpay-order',e);return json(req,500,{error:'Unable to start secure payment. Please try again.',error_code:'GATEWAY_ORDER_ERROR'});}
});
