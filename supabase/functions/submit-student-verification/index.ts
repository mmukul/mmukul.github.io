import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const ORIGINS = new Set(['https://nextgendevsecops.in','https://www.nextgendevsecops.in']);
const COURSES = new Set(['devops','devsecops-foundational','devsecops-advanced','genai','ai-powered-devsecops']);
const cors=(origin:string|null)=>({'Access-Control-Allow-Origin':ORIGINS.has(origin||'')?origin!:'https://nextgendevsecops.in','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json'});
const reply=(status:number,body:Record<string,unknown>,origin:string|null)=>new Response(JSON.stringify(body),{status,headers:cors(origin)});
const clean=(v:unknown,max:number)=>String(v??'').trim().replace(/\s+/g,' ').slice(0,max);
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed.'},origin);
 if(origin&&!ORIGINS.has(origin))return reply(403,{error:'Origin not allowed.'},origin);
 const contentLength=Number(req.headers.get('content-length')||'0');if(contentLength>5.5*1024*1024)return reply(413,{error:'Upload request exceeds the 5 MB document limit.'},origin);
 try{
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),secret=Deno.env.get('TURNSTILE_SECRET_KEY');
  if(!url||!key||!secret)return reply(500,{error:'Verification service configuration is incomplete.'},origin);
  const ctype=req.headers.get('content-type')||'';
  if(ctype.includes('application/json')){const body=await req.json();if(body?.action!=='status')return reply(400,{error:'Unsupported action.'},origin);const ref=clean(body.application_reference,32),email=clean(body.student_email,160).toLowerCase(),course=clean(body.course_key,60);if(!ref||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!COURSES.has(course))return reply(400,{error:'Enter a valid application reference, email and course.'},origin);const admin=createClient(url,key,{auth:{persistSession:false}});const result=await admin.from('student_price_verifications').select('status,review_note,course_key').eq('application_reference',ref).eq('student_email',email).eq('course_key',course).maybeSingle();if(result.error)throw result.error;if(!result.data)return reply(404,{error:'No matching application was found. Check your reference, email and course.'},origin);return reply(200,{status:result.data.status,review_note:result.data.review_note||''},origin);}
  const form=await req.formData();
  const name=clean(form.get('student_name'),100),email=clean(form.get('student_email'),160).toLowerCase(),phone=clean(form.get('student_phone'),20),studentNumber=clean(form.get('student_number'),80),course=clean(form.get('course_key'),60),token=clean(form.get('turnstile_token'),2048);
  const proof=form.get('proof');
  if(name.length<3||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone.length<7||studentNumber.length<2||!COURSES.has(course)||!(proof instanceof File)||!token)return reply(400,{error:'Please complete all fields and attach valid student proof.'},origin);
  if(proof.size<1||proof.size>5*1024*1024)return reply(400,{error:'Proof document must be 5 MB or smaller.'},origin);
  const allowed=new Map([['application/pdf','pdf'],['image/jpeg','jpg'],['image/png','png']]);const ext=allowed.get(proof.type);if(!ext)return reply(400,{error:'Only PDF, JPG and PNG proof documents are accepted.'},origin);
  const captcha=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret,response:token,remoteip:req.headers.get('cf-connecting-ip')||''})});
  const captchaData=await captcha.json().catch(()=>({}));if(!captcha.ok||captchaData.success!==true)return reply(400,{error:'Security verification failed. Please complete the CAPTCHA again.'},origin);
  const admin=createClient(url,key,{auth:{persistSession:false}});
  const prior=await admin.from('student_price_verifications').select('id,status').eq('student_email',email).eq('course_key',course).in('status',['pending','verified']).limit(1).maybeSingle();
  if(prior.error)throw prior.error;if(prior.data)return reply(409,{error:prior.data.status==='verified'?'Your student eligibility is already approved for this course. Continue to course enrolment.':'A verification request for this course is already pending review.'},origin);
  const bytes=new Uint8Array(await proof.arrayBuffer());const ref='NGS-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase();const path=`pre-enrolment/${ref}.${ext}`;
  const upload=await admin.storage.from('student-verification-private').upload(path,bytes,{contentType:proof.type,upsert:false});if(upload.error)throw upload.error;
  const insert=await admin.from('student_price_verifications').insert({student_id:null,course_id:null,course_key:course,student_name:name,student_email:email,student_phone:phone,student_number:studentNumber,proof_path:path,application_reference:ref,status:'pending'}).select('id').single();
  if(insert.error){await admin.storage.from('student-verification-private').remove([path]);throw insert.error;}
  return reply(201,{ok:true,reference:ref,status:'pending',message:'Student verification submitted. Wait for approval before enrolment.'},origin);
 }catch(error){console.error('submit-student-verification failed:',error);return reply(500,{error:'Unable to submit student verification. Please retry or contact support.'},origin);}
});
