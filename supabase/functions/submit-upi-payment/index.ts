import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://nextgendevsecops.in','https://www.nextgendevsecops.in']);
const VERSION = 'v105-submit-upi-payment-turnstile';
const COURSE_KEYS = new Set(['devops','devsecops-foundational','devsecops-advanced','genai']);
const PLANS = new Set(['full','part1','part2']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9()\-\s]{7,20}$/;
const UTR_RE = /^[A-Za-z0-9\-]{6,40}$/;
function cors(origin?: string|null){return {'Access-Control-Allow-Origin':ALLOWED_ORIGINS.has(origin||'')?origin!:'https://nextgendevsecops.in','Vary':'Origin','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};}
function json(status:number,body:Record<string,unknown>,origin?:string|null){return new Response(JSON.stringify({...body,function_version:VERSION}),{status,headers:cors(origin)});}
function norm(v:unknown,max:number){return String(v??'').trim().replace(/\s+/g,' ').slice(0,max)}
async function verifyTurnstile(token: string, remoteIp?: string | null) {
 const secret=Deno.env.get('TURNSTILE_SECRET_KEY');
 if(!secret) throw new Error('Turnstile secret is not configured.');
 const body=new URLSearchParams({secret,response:token});
 if(remoteIp) body.set('remoteip',remoteIp);
 const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data?.success!==true) throw new Error(`Turnstile verification failed: ${Array.isArray(data?.['error-codes'])?data['error-codes'].join(','):'invalid-token'}`);
}
function reference(){const b=crypto.getRandomValues(new Uint8Array(8));return `UPI-${Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()}`;}
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=='POST') return json(405,{error:'Method not allowed.'},origin);
 if(origin&&!ALLOWED_ORIGINS.has(origin)) return json(403,{error:'Origin not allowed.'},origin);
 try{
  const url=Deno.env.get('SUPABASE_URL'),sr=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const turnstileSecret=Deno.env.get('TURNSTILE_SECRET_KEY');
  if(!url||!sr||!turnstileSecret) return json(500,{error:'Payment service configuration is incomplete.',error_code:'CONFIG_ERROR'},origin);
  const p=await req.json();
  const courseKey=norm(p?.course_key,60).toLowerCase();
  const plan=norm(p?.plan,10).toLowerCase();
  const name=norm(p?.name,100),email=norm(p?.email,254).toLowerCase(),phone=norm(p?.phone,20),utr=norm(p?.utr,40),turnstileToken=norm(p?.turnstile_token,2048);
  if(!turnstileToken) return json(400,{error:'Please complete the security check.',error_code:'TURNSTILE_REQUIRED'},origin);
  if(!COURSE_KEYS.has(courseKey)||!PLANS.has(plan)) return json(400,{error:'Invalid course or payment plan.',error_code:'VALIDATION_ERROR'},origin);
  if(name.length<2||!EMAIL_RE.test(email)||!PHONE_RE.test(phone)||!UTR_RE.test(utr)) return json(400,{error:'Please provide valid payment details and UPI transaction/reference ID.',error_code:'VALIDATION_ERROR'},origin);
  await verifyTurnstile(turnstileToken,req.headers.get('cf-connecting-ip'));
  const admin=createClient(url,sr,{auth:{persistSession:false,autoRefreshToken:false}});
  const hourAgo=new Date(Date.now()-60*60*1000).toISOString();
  const {count,error:rateError}=await admin.from('gateway_payment_orders').select('id',{count:'exact',head:true}).eq('payer_email',email).gte('created_at',hourAgo);
  if(rateError) throw new Error(`gateway_payment_orders rate-limit query failed: ${rateError.message}`);
  if((count??0)>=8) return json(429,{error:'Too many payment submissions for this email. Please try again later.',error_code:'RATE_LIMIT_ERROR'},origin);
  const {data:course,error:ce}=await admin.from('payment_catalog').select('course_key,course_name,full_amount,part_amount,active').eq('course_key',courseKey).eq('active',true).maybeSingle();
  if(ce) throw new Error(`payment_catalog lookup failed: ${ce.message}`);
  if(!course) return json(400,{error:'This course is not currently available for payment.',error_code:'COURSE_UNAVAILABLE'},origin);
  if(plan==='part2'){
   const {data:prior,error:pe}=await admin.from('gateway_payment_orders').select('id').eq('course_key',courseKey).eq('payer_email',email).eq('plan','part1').eq('status','paid').limit(1).maybeSingle();
   if(pe) throw new Error(`part1 verification lookup failed: ${pe.message}`);
   if(!prior) return json(400,{error:'Part 2 can be submitted after Part 1 has been verified as paid.',error_code:'PART1_REQUIRED'},origin);
  }
  const amount=Number(plan==='full'?course.full_amount:course.part_amount);
  if(!Number.isSafeInteger(amount)||amount<=0) return json(500,{error:'Course payment configuration is invalid.',error_code:'CATALOG_ERROR'},origin);
  const {data:existing,error:ee}=await admin.from('gateway_payment_orders').select('id,reference,status').eq('gateway','upi').eq('gateway_payment_id',utr).maybeSingle();
  if(ee) throw new Error(`duplicate UTR lookup failed: ${ee.message}`);
  if(existing) return json(409,{error:'This UPI transaction/reference ID has already been submitted.',error_code:'DUPLICATE_UTR',reference:existing.reference,status:existing.status},origin);
  const ref=reference();
  const {error:ie}=await admin.from('gateway_payment_orders').insert({reference:ref,gateway:'upi',gateway_order_id:null,gateway_payment_id:utr,course_key:course.course_key,course_name:course.course_name,payer_name:name,payer_email:email,payer_phone:phone,plan,amount,currency:'INR',status:'pending_verification'});
  if(ie) throw new Error(`gateway_payment_orders insert failed: ${ie.message}`);
  return json(201,{ok:true,status:'pending_verification',reference:ref,plan,amount,message:'UPI payment details submitted for verification. Do not make another payment unless instructed.'},origin);
 }catch(error){
  console.error('submit-upi-payment failure',{version:VERSION,message:String((error as any)?.message||error)});
  return json(500,{error:'Unable to submit the UPI payment details. Please try again.',error_code:'UPI_SUBMISSION_ERROR'},origin);
 }
});
