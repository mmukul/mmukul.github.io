// NextGen Lab Control — v308.1
// Provider provisioning remains fail-closed until a tested VPS adapter is installed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const validCount=(n:number)=>Number.isInteger(n)&&n>=1&&n<=500;
const validDays=(n:number)=>Number.isInteger(n)&&n>=1&&n<=365;
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({success:false,error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return json({success:false,error:"Server configuration is incomplete."},503);
  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))return json({success:false,error:"Authentication required."},401);
  const db=createClient(url,key,{auth:{persistSession:false}});
  const {data:{user},error:ue}=await db.auth.getUser(auth.slice(7));
  if(ue||!user)return json({success:false,error:"Invalid session."},401);
  const {data:admin}=await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(admin?.role!=="admin")return json({success:false,error:"Administrator access required."},403);
  const b=await req.json(),action=String(b.action||"");
  if(action==="status"){
   const configured=Boolean(Deno.env.get("VPS_PROVIDER")&&Deno.env.get("VPS_PROVIDER_API_KEY"));
   return json({success:true,health:configured?"Credentials present; adapter validation required":"Not connected",
    message:configured?"VPS credentials are present, but provisioning remains disabled until the provider adapter passes health checks.":"VPS provider is not configured. No infrastructure action can run."});
  }
  if(action==="estimate"||action==="request"){
   if(!validCount(Number(b.student_count))||!validDays(Number(b.duration_days)))return json({success:false,error:"Enter 1–500 students and 1–365 days."},400);
   const templateKey=String(b.template_key||"");
   const {data:course,error:ce}=await db.from("courses").select("id,name,slug").eq("id",b.course_id).maybeSingle();
   if(ce||!course)return json({success:false,error:"Selected website course was not found."},400);
   const {data:template}=await db.from("lab_course_templates").select("id,course_name,level,lab_category").eq("id",templateKey).maybeSingle();
   if(!template)return json({success:false,error:"Selected lab template is not registered. Apply the lab template migration."},409);
   const {data:map}=await db.from("lab_course_course_map").select("course_id").eq("template_key",templateKey).maybeSingle();
   if(!map||map.course_id!==course.id)return json({success:false,error:"This lab template is not mapped to the selected live website course. Review course mapping in Supabase."},409);
   let estimate=null;
   if(action==="estimate"||b.deployment_type==="external"){
    const monthly=Number(b.monthly_vps_price);
    if(action==="estimate"){
     if(!Number.isFinite(monthly)||monthly<=0)return json({success:false,error:"Enter the monthly VPS cost in INR."},400);
     const {error:saveRateError}=await db.from("lab_cost_profiles").upsert({
      template_key:templateKey,currency:"INR",monthly_vps_price:monthly,
      worker_monthly_price:0,storage_monthly_per_student:0,
      estimated_students_per_worker:Math.max(1,Number(b.student_count)),updated_at:new Date().toISOString()
     },{onConflict:"template_key"});
     if(saveRateError)throw saveRateError;
    }
    const {data:cp,error:pe}=await db.from("lab_cost_profiles").select("*").eq("template_key",templateKey).maybeSingle();
    if(pe)throw pe;
    if(!cp||Number(cp.monthly_vps_price)<=0)return json({success:false,error:"Enter the monthly VPS cost before calculating."},409);
    const students=Number(b.student_count),days=Number(b.duration_days);
    const total=Number(cp.monthly_vps_price)/30*days;
    estimate={currency:cp.currency||"INR",total:Number(total.toFixed(2)),per_student:Number((total/students).toFixed(2)),students,days,
     assumptions:`Monthly VPS cost ₹${Number(cp.monthly_vps_price).toLocaleString("en-IN")} ÷ 30 × ${days} days = ₹${total.toFixed(2)} total. ₹${total.toFixed(2)} ÷ ${students} students = ₹${(total/students).toFixed(2)} per student. Excludes GST and provider add-ons. No backup charge included.`};
   if(action==="estimate")return json({success:true,estimate});
   const external=b.deployment_type==="external";
   if(!["internal","external"].includes(b.deployment_type))return json({success:false,error:"Invalid deployment type."},400);
   if(external&&!String(b.partner_name||"").trim())return json({success:false,error:"Partner name is required."},400);
   if(external&&(!estimate||!b.estimate||Number(b.estimate.total)!==estimate.total))return json({success:false,error:"Recalculate the estimate after the latest changes before submitting."},409);
   const {data:deployment,error:de}=await db.from("lab_deployments").insert({
    deployment_type:b.deployment_type,partner_name:external?String(b.partner_name).trim():null,
    trainer_name:b.trainer_name||null,batch_name:b.batch_name||null,course_id:course.id,course_name:course.name,
    template_key:templateKey,toc:b.toc||null,student_count:Number(b.student_count),duration_days:Number(b.duration_days),
    status:external?"quoted":"requested",estimate,created_by:user.id
   }).select("id,status").single();
   if(de)throw de;
   return json({success:true,deployment,message:external?"Partner lab request and reviewed estimate saved. Awaiting admin approval.":"Internal lab request saved. Awaiting admin approval."});
  }
  if(["approve","provision","extend","destroy"].includes(action))return json({success:false,error:"VPS lifecycle adapter is not installed. No infrastructure was changed."},503);
  return json({success:false,error:"Unsupported lab action."},400);
 }catch(e){console.error("lab-control error",e);return json({success:false,error:e?.message||"Lab operation failed."},500);}
});
