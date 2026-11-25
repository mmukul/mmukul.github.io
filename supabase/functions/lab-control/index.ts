// NextGen Lab Control — v308
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never expose these to the browser.
// Provider adapter is intentionally fail-closed until a VPS API is configured and tested.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({success:false,error:"Method not allowed"},405);
  try {
    const url=Deno.env.get("SUPABASE_URL");
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!serviceKey) return json({success:false,error:"Server configuration is incomplete."},503);
    const auth=req.headers.get("Authorization")||"";
    if(!auth.startsWith("Bearer ")) return json({success:false,error:"Authentication required."},401);
    const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
    const token=auth.slice(7);
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user) return json({success:false,error:"Invalid session."},401);
    const {data:profile}=await admin.from("profiles").select("role").eq("id",user.id).maybeSingle();
    if(profile?.role!=="admin") return json({success:false,error:"Administrator access required."},403);
    const body=await req.json();
    const action=String(body.action||"");
    if(action==="status") {
      const providerReady=Boolean(Deno.env.get("VPS_PROVIDER") && Deno.env.get("VPS_PROVIDER_API_KEY"));
      return json({success:true,health:providerReady?"Configured — adapter health check pending":"Not connected",
        message:providerReady?"Provider credentials found. Complete adapter health validation before provisioning.":"VPS provider is not configured. No infrastructure action can run."});
    }
    if(action==="save_cost_profile") {
      const courseId=String(body.course_id||"");
      const {data:course,error:courseError}=await admin.from("courses").select("id,slug").eq("id",courseId).single();
      if(courseError||!course) return json({success:false,error:"Select a valid curriculum."},400);
      const values={
        course_id:course.id,template_key:String(body.template_key||course.slug||"default"),
        currency:String(body.currency||"INR").toUpperCase(),
        base_vps_daily:Number(body.base_vps_daily),worker_vps_daily:Number(body.worker_vps_daily),
        storage_daily_per_student:Number(body.storage_daily_per_student),backup_daily:Number(body.backup_daily),
        estimated_students_per_worker:Number(body.estimated_students_per_worker)
      };
      if(!values.currency||![values.base_vps_daily,values.worker_vps_daily,values.storage_daily_per_student,values.backup_daily].every(v=>Number.isFinite(v)&&v>=0)||
        !Number.isInteger(values.estimated_students_per_worker)||values.estimated_students_per_worker<1)
        return json({success:false,error:"Enter valid non-negative daily rates and students-per-worker."},400);
      const {data,error}=await admin.from("lab_cost_profiles").upsert(values,{onConflict:"course_id,template_key"}).select("*").single();
      if(error) throw error;
      return json({success:true,cost_profile:data,message:"Monthly lab rental saved. Estimates use the monthly amount divided by 30."});
    }
    if(action==="approve"||action==="reject") {
      const id=String(body.deployment_id||"");
      const {data:deployment,error:loadError}=await admin.from("lab_deployments").select("*").eq("id",id).single();
      if(loadError||!deployment) return json({success:false,error:"Deployment request not found."},404);
      if(deployment.status!=="quoted" && deployment.status!=="requested")
        return json({success:false,error:"Only pending deployment requests can be reviewed."},409);
      if(action==="reject") {
        const {error}=await admin.from("lab_deployments").update({status:"rejected",updated_at:new Date().toISOString()}).eq("id",id);
        if(error) throw error;
        return json({success:true,message:"Deployment request rejected. No infrastructure was provisioned."});
      }
      const {data:approved,error}=await admin.from("lab_deployments").update({status:"approved",updated_at:new Date().toISOString()}).eq("id",id).select("id,status").single();
      if(error) throw error;
      // Allocate one isolated workspace record per active enrolled student. Provider creation
      // remains a separate, fail-closed operation until a provider adapter is installed.
      const {data:enrollments,error:enrollError}=await admin.from("enrollments").select("student_id,enrolled_at").eq("course_id",deployment.course_id).eq("status","active").order("enrolled_at",{ascending:true}).limit(deployment.student_count);
      if(enrollError) throw enrollError;
      const rows=(enrollments||[]).filter(x=>x.student_id).map(x=>({deployment_id:id,student_id:x.student_id,expires_at:new Date(Date.now()+deployment.duration_days*86400000).toISOString(),status:"queued"}));
      let allocated=0;
      if(rows.length){
        const {data:inserted,error:insertError}=await admin.from("lab_workspaces").upsert(rows,{onConflict:"deployment_id,student_id"}).select("id");
        if(insertError) throw insertError;
        allocated=inserted?.length||0;
      }
      return json({success:true,deployment:approved,workspaces_allocated:allocated,provider_provisioning:false,
        message:`Deployment approved. ${allocated} individual workspace record(s) queued. VPS provisioning remains disabled until the provider adapter is configured.`});
    }
    if(action==="estimate") {
      const students=Number(body.student_count), days=Number(body.duration_days);
      if(!Number.isInteger(students)||students<1||students>500||!Number.isInteger(days)||days<1||days>365)
        return json({success:false,error:"Student count or duration is outside the allowed range."},400);
      const {data:course,error:courseError}=await admin.from("courses").select("id,slug").eq("id",body.course_id).single();
      if(courseError||!course) return json({success:false,error:"Selected curriculum was not found."},400);
      const {data:profile,error}=await admin.from("lab_cost_profiles").select("*").eq("course_id",body.course_id).eq("template_key",course.slug||"default").maybeSingle();
      if(error) throw error;
      if(!profile) return json({success:false,error:"No approved cost profile exists for this curriculum. Configure provider and template rates first."},409);
      const workers=Math.ceil(students/profile.estimated_students_per_worker);
      const total=(Number(profile.base_vps_daily)+workers*Number(profile.worker_vps_daily)+students*Number(profile.storage_daily_per_student)+Number(profile.backup_daily))*days;
      return json({success:true,estimate:{currency:profile.currency,total:Number(total.toFixed(2)),per_student:Number((total/students).toFixed(2)),students,days,workers,assumptions:"Uses admin-configured daily VPS, worker, storage and backup rates. Excludes taxes and unconfigured provider charges."}});
    }
    if(action==="request") {
      const external=body.deployment_type==="external";
      if(!["internal","external"].includes(body.deployment_type)) return json({success:false,error:"Invalid deployment type."},400);
      if(external&&!String(body.partner_name||"").trim()) return json({success:false,error:"Partner name is required."},400);
      const {data:course,error:courseError}=await admin.from("courses").select("id,name,slug").eq("id",body.course_id).single();
      if(courseError||!course) return json({success:false,error:"Selected curriculum was not found."},400);
      let estimate=null;
      if(external){
        const {data:cp}=await admin.from("lab_cost_profiles").select("*").eq("course_id",body.course_id).eq("template_key",course.slug||"default").maybeSingle();
        if(!cp) return json({success:false,error:"Configure a cost profile before requesting an external deployment."},409);
        const students=Number(body.student_count),days=Number(body.duration_days);
        if(!Number.isInteger(students)||students<1||students>500||!Number.isInteger(days)||days<1||days>365) return json({success:false,error:"Student count or total lab duration is outside the allowed range."},400);
        const workers=Math.ceil(students/Number(cp.estimated_students_per_worker));
        const total=(Number(cp.base_vps_daily)+workers*Number(cp.worker_vps_daily)+students*Number(cp.storage_daily_per_student)+Number(cp.backup_daily))*days;
        estimate={currency:cp.currency,total:Number(total.toFixed(2)),per_student:Number((total/students).toFixed(2)),students,days,workers};
        if(!body.estimate||Number(body.estimate.total)!==estimate.total) return json({success:false,error:"Recalculate the partner estimate before submitting."},409);
      }
      const {data,error}=await admin.from("lab_deployments").insert({
        deployment_type:body.deployment_type,partner_name:external?String(body.partner_name).trim():null,
        trainer_name:body.trainer_name||null,batch_name:body.batch_name||null,course_id:course.id,course_name:course.name,
        template_key:course.slug,toc:body.toc||null,student_count:Number(body.student_count),
        duration_days:Number(body.duration_days),status:external?"quoted":"requested",estimate,created_by:user.id
      }).select("id,status").single();
      if(error) throw error;
      return json({success:true,deployment:data,message:external?"Partner estimate saved for admin review. No VPS has been rented or provisioned.":"Internal lab request saved. No VPS has been rented or provisioned."});
    }
    if(["provision","extend","destroy"].includes(action))
      return json({success:false,error:"VPS lifecycle adapter is not installed. No infrastructure was changed. Configure and validate the provider adapter before enabling this action."},503);
    return json({success:false,error:"Unsupported lab action."},400);
  } catch(e) {
    console.error("lab-control error",e);
    return json({success:false,error:e?.message||"Lab operation failed."},500);
  }
});
