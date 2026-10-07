import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders={
 'Access-Control-Allow-Origin':'https://nextgendevsecops.in',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST') return json({error:'Method not allowed.'},405);
 try{
  const supabaseUrl=Deno.env.get('SUPABASE_URL'), anonKey=Deno.env.get('SUPABASE_ANON_KEY'), serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), turnstileSecret=Deno.env.get('TURNSTILE_SECRET_KEY');
  if(!supabaseUrl||!anonKey||!serviceRoleKey||!turnstileSecret) return json({error:'Secure login is not configured on the server.'},500);
  const body=await req.json().catch(()=>null); const email=String(body?.email||'').trim().toLowerCase(); const password=String(body?.password||''); const token=String(body?.turnstile_token||'');
  if(!email||!password||!token) return json({error:'Email, password and security verification are required.'},400);
  const v=new URLSearchParams({secret:turnstileSecret,response:token}); const ip=req.headers.get('CF-Connecting-IP')||req.headers.get('X-Forwarded-For'); if(ip)v.set('remoteip',ip.split(',')[0].trim());
  const tr=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:v}); const tv=await tr.json().catch(()=>({}));
  if(!tr.ok||!tv.success) return json({error:'Security verification failed. Please refresh and try again.'},403);
  const authClient=createClient(supabaseUrl,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:a,error:ae}=await authClient.auth.signInWithPassword({email,password}); if(ae||!a.session||!a.user)return json({error:'Invalid email or password.'},401);
  const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile,error:pe}=await admin.from('profiles').select('role,status').eq('id',a.user.id).maybeSingle();
  if(pe)return json({error:'Unable to verify student account.'},500);
  if(!profile||profile.role!=='student'||profile.status!=='active'){await authClient.auth.signOut();return json({error:'This account is not an active student account.'},403);}
  return json({access_token:a.session.access_token,refresh_token:a.session.refresh_token,expires_in:a.session.expires_in,expires_at:a.session.expires_at,user:a.user});
 }catch(e){console.error('secure-login error:',e);return json({error:'Unable to sign in right now. Please try again.'},500);}
});
