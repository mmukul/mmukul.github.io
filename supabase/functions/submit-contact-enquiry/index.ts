import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const ORIGINS=new Set(['https://nextgendevsecops.in','https://www.nextgendevsecops.in']);
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/; const PHONE=/^[+0-9()\-\s]{7,20}$/;
function headers(o?:string|null){return {'Access-Control-Allow-Origin':ORIGINS.has(o||'')?o!:'https://nextgendevsecops.in','Vary':'Origin','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'}}
function json(s:number,b:Record<string,unknown>,o?:string|null){return new Response(JSON.stringify(b),{status:s,headers:headers(o)})}
function norm(v:unknown,max:number){return String(v??'').trim().replace(/\s+/g,' ').slice(0,max)}
function ref(){const b=crypto.getRandomValues(new Uint8Array(7));return `ENQ-${Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()}`}
async function captcha(token:string,ip?:string){const secret=Deno.env.get('TURNSTILE_SECRET_KEY');if(!secret)throw new Error('Contact security is not configured.');const body=new URLSearchParams({secret,response:token});if(ip)body.set('remoteip',ip);const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body});if(!r.ok)return false;const d=await r.json();return d.success===true}
Deno.serve(async req=>{const o=req.headers.get('origin');if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(o)});if(req.method!=='POST')return json(405,{error:'Method not allowed.'},o);if(o&&!ORIGINS.has(o))return json(403,{error:'Origin not allowed.'},o);const len=Number(req.headers.get('content-length')||'0');if(len>20000)return json(413,{error:'Request is too large.'},o);
 try{const url=Deno.env.get('SUPABASE_URL'),sr=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!sr) return json(500,{error:'Contact service is not configured.'},o);const p=await req.json();
  const context=norm(p?.context,80),course=norm(p?.course,120),name=norm(p?.name,100),email=norm(p?.email,254).toLowerCase(),phone=norm(p?.phone,20),preferred=norm(p?.preferred_engagement,50),goal=norm(p?.goal,600),token=norm(p?.turnstile_token,4096);
  if(!context||name.length<2||!EMAIL.test(email)||!PHONE.test(phone)||!token)return json(400,{error:'Please complete the required enquiry fields and security check.'},o);
  if(!(await captcha(token,req.headers.get('cf-connecting-ip')||undefined)))return json(403,{error:'Security verification failed. Please try again.'},o);
  const admin=createClient(url,sr,{auth:{persistSession:false,autoRefreshToken:false}});const hourAgo=new Date(Date.now()-60*60*1000).toISOString();
  const {count,error:rateError}=await admin.from('contact_enquiries').select('id',{count:'exact',head:true}).eq('email',email).gte('created_at',hourAgo);if(rateError)throw rateError;if((count??0)>=5)return json(429,{error:'Too many enquiries from this email. Please try again later.'},o);
  const reference=ref();const {error}=await admin.from('contact_enquiries').insert({reference,context,course:course||null,name,email,phone,preferred_engagement:preferred||null,goal:goal||null,status:'new'});if(error)throw error;
  return json(201,{ok:true,reference,status:'new'},o);
 }catch(e){console.error('submit-contact-enquiry',e);return json(500,{error:'Unable to submit your enquiry. Please try again.'},o)}});
