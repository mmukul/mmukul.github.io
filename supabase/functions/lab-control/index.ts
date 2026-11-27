// NextGen Lab Control — v322 (built from supplied v308 source)
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
  let stage = "request_received";
  const requestId = crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({success:false,error:"Method not allowed"},405);
  try {
    stage = "supabase_configuration";
    const url=Deno.env.get("SUPABASE_URL");
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!serviceKey) return json({success:false,error:"Server configuration is incomplete."},503);
    stage = "request_authentication";
    const auth=req.headers.get("Authorization")||"";
    if(!auth.startsWith("Bearer ")) return json({success:false,error:"Authentication required."},401);
    const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
    const token=auth.slice(7);
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user) return json({success:false,error:"Invalid or expired Supabase session."},401);
    stage = "admin_role_check";
    const {data:profile,error:profileError}=await admin.from("profiles").select("role").eq("id",user.id).maybeSingle();
    if(profileError) throw new Error(`Admin role lookup failed: ${profileError.message}`);
    if(profile?.role!=="admin") return json({success:false,error:"Administrator access required."},403);
    stage = "request_body";
    let body: any;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({success:false,error:"Request body must be a JSON object."},400);
      body = parsed;
    } catch {
      return json({success:false,error:"Request body contains invalid JSON."},400);
    }
    const action=String(body.action||"");

    // E2E Networks read-only API integration. This allowlist contains GET calls only.
    stage = "action_dispatch";
    const e2eConfig = () => ({
      base: (Deno.env.get("E2E_API_BASE_URL") || "https://api.e2enetworks.com/myaccount").replace(/\/$/, ""),
      apiKey: Deno.env.get("E2E_API_KEY") || "",
      apiToken: Deno.env.get("E2E_API_TOKEN") || "",
      projectId: Deno.env.get("E2E_PROJECT_ID") || "62333",
      location: Deno.env.get("E2E_LOCATION") || "Chennai",
    });
    const e2eReady = (c: ReturnType<typeof e2eConfig>) => Boolean(c.apiKey && c.apiToken && c.projectId && c.location);
    const e2eGet = async (path: string) => {
      const c=e2eConfig();
      if(!e2eReady(c)) throw new Error("E2E API credentials are incomplete. Add E2E_API_KEY and E2E_API_TOKEN in Supabase Edge Function Secrets.");
      const u=new URL(c.base+path);
      u.searchParams.set("project_id",c.projectId);
      u.searchParams.set("apikey",c.apiKey);
      u.searchParams.set("location",c.location);
      const response=await fetch(u.toString(),{method:"GET",headers:{"Authorization":`Bearer ${c.apiToken}`,"Accept":"application/json"},signal:AbortSignal.timeout(15000)});
      const raw=await response.text();
      let parsed:unknown; try{parsed=raw?JSON.parse(raw):{};}catch{parsed={message:"Provider returned a non-JSON response."};}
      if(!response.ok) throw new Error(`E2E API returned HTTP ${response.status}. Verify the API token, project ID and location in Supabase Secrets.`);
      return parsed;
    };
    if(action==="e2e_api_status") {
      stage = "e2e_api_status";
      const c=e2eConfig();
      return json({success:true,configured:e2eReady(c),project_id:c.projectId,location:c.location,
        has_api_key:Boolean(c.apiKey),has_api_token:Boolean(c.apiToken),read_only:true,
        message:e2eReady(c)?"E2E API secrets are present. Run a read-only connection test.":"Authentication required. Add E2E_API_KEY and E2E_API_TOKEN to Supabase Edge Function Secrets."});
    }
    if(action==="e2e_connection_test") {
      stage = "e2e_connection_test";
      // Reuse the already documented/read-only node-list call as a real API
      // connectivity test. Secret presence alone is not treated as connectivity.
      const data:any=await e2eGet("/api/v1/nodes/");
      const nodes=Array.isArray(data)?data:(Array.isArray(data?.data)?data.data:(Array.isArray(data?.results)?data.results:null));
      return json({success:true,connected:true,read_only:true,
        node_count:nodes?nodes.length:null,
        message:"E2E authenticated read-only API request succeeded. No infrastructure was changed."});
    }
    if(action==="e2e_list_nodes") {
      stage = "e2e_list_nodes";
      const data=await e2eGet("/api/v1/nodes/");
      return json({success:true,read_only:true,data});
    }
    if(action==="e2e_node_details") {
      stage = "e2e_node_details";
      const nodeId=String(body.node_id||"").trim();
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(nodeId)) return json({success:false,error:"Enter a valid E2E node ID."},400);
      const data=await e2eGet(`/api/v1/nodes/${encodeURIComponent(nodeId)}/`);
      return json({success:true,read_only:true,data});
    }
    if(action==="e2e_node_health") {
      stage = "e2e_node_health";
      const nodeId=String(body.node_id||"").trim();
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(nodeId)) return json({success:false,error:"Enter a valid E2E node ID."},400);
      const [health,info]=await Promise.all([
        e2eGet(`/api/v1/nodes/${encodeURIComponent(nodeId)}/monitor/server-health/`),
        e2eGet(`/api/v1/nodes/${encodeURIComponent(nodeId)}/monitor/server-health-info/`)
      ]);
      return json({success:true,read_only:true,health,health_info:info});
    }
    if(action==="provider_config_status") {
      const {data,error}=await admin.from("lab_provider_settings").select("provider,mode,instance_name,region,public_ip,private_ip,cpu,ram_gb,disk_gb,max_workspaces,monthly_budget_inr,updated_at").eq("provider","e2e").maybeSingle();
      if(error) throw error;
      return json({success:true,config:data||null,provisioning_enabled:false,
        message:data?"Existing E2E VPS metadata is registered. Connectivity and provider API provisioning are not yet validated.":"No E2E VPS configuration has been saved."});
    }
    if(action==="save_provider_config") {
      if(body.provider!=="e2e" || body.mode!=="existing") return json({success:false,error:"Only existing E2E VPS mode is enabled for this pilot."},400);
      const ipOk=(v:string)=>{try{return new URL(`http://${v}`).hostname===v && /^[0-9a-fA-F:.]+$/.test(v);}catch{return false;}};
      const values={
        provider:"e2e",mode:"existing",
        instance_name:String(body.instance_name||"").trim().slice(0,100),
        region:String(body.region||"").trim().slice(0,100),
        public_ip:String(body.public_ip||"").trim(),
        private_ip:String(body.private_ip||"").trim(),
        cpu:Number(body.cpu),ram_gb:Number(body.ram_gb),disk_gb:Number(body.disk_gb),
        max_workspaces:Number(body.max_workspaces),monthly_budget_inr:Number(body.monthly_budget_inr),
        updated_at:new Date().toISOString()
      };
      if(!values.instance_name||!values.region||!ipOk(values.public_ip)||!ipOk(values.private_ip)||
        ![values.cpu,values.ram_gb,values.disk_gb,values.max_workspaces,values.monthly_budget_inr].every(v=>Number.isFinite(v)&&v>0))
        return json({success:false,error:"Enter valid VPS details, IP addresses and positive resource limits."},400);
      const {data,error}=await admin.from("lab_provider_settings").upsert(values,{onConflict:"provider"}).select("provider,mode,instance_name,region,public_ip,private_ip,cpu,ram_gb,disk_gb,max_workspaces,monthly_budget_inr,updated_at").single();
      if(error) throw error;
      return json({success:true,config:data,provisioning_enabled:false,message:"E2E VPS metadata saved. This registers the existing node only; it does not verify network reachability or enable API provisioning."});
    }
    if(action==="status") {
      const providerReady=Boolean(Deno.env.get("VPS_PROVIDER") && Deno.env.get("VPS_PROVIDER_API_KEY"));
      return json({success:true,health:providerReady?"Credentials present — adapter not validated":"Manual workspace mode",
        provider_configured:providerReady,provisioning_enabled:false,
        message:providerReady?"Provider credentials are present, but no validated provider adapter is installed. Automated VPS provisioning remains disabled.":"Manual workspace mode is active. Admins can queue and track student workspaces; no VPS is created automatically."});
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
    if(action==="extend") {
      const deploymentId=String(body.deployment_id||""),days=Number(body.days);
      if(!deploymentId||!Number.isInteger(days)||days<1||days>365) return json({success:false,error:"Deployment ID and extension between 1 and 365 days are required."},400);
      const {data:deployment,error:loadError}=await admin.from("lab_deployments").select("id,expires_at,duration_days").eq("id",deploymentId).single();
      if(loadError||!deployment) return json({success:false,error:"Deployment not found."},404);
      const newDuration=Number(deployment.duration_days)+days;
      if(newDuration>730) return json({success:false,error:"Total deployment duration cannot exceed 730 days."},400);
      const oldExpiry=deployment.expires_at?new Date(deployment.expires_at):new Date();
      const base=oldExpiry.getTime()>Date.now()?oldExpiry:new Date();
      const expiry=new Date(base.getTime()+days*86400000).toISOString();
      const {error:updateDeploymentError}=await admin.from("lab_deployments").update({duration_days:newDuration,expires_at:expiry,updated_at:new Date().toISOString()}).eq("id",deploymentId);
      if(updateDeploymentError) throw updateDeploymentError;
      const {error:updateWorkspacesError}=await admin.from("lab_workspaces").update({expires_at:expiry,updated_at:new Date().toISOString()}).eq("deployment_id",deploymentId).in("status",["queued","provisioning","ready"]);
      if(updateWorkspacesError) throw updateWorkspacesError;
      const {error:auditError}=await admin.from("lab_extension_requests").insert({deployment_id:deploymentId,requested_by:user.id,approved_by:user.id,requested_days:days,approved_days:days,status:"approved",requested_at:new Date().toISOString(),approved_at:new Date().toISOString(),expires_at:expiry,notes:"Admin-approved deployment extension"});
      if(auditError) throw auditError;
      return json({success:true,message:`Lab access extended by ${days} days for the deployment and its active workspaces.`});
    }
    if(action==="workspace_update") {
      const workspaceId=String(body.workspace_id||"");
      const nextStatus=String(body.status||"");
      if(!workspaceId) return json({success:false,error:"Workspace ID is required."},400);
      if(!["provisioning","ready","failed"].includes(nextStatus)) return json({success:false,error:"Unsupported workspace status."},400);
      const {data:current,error:loadError}=await admin.from("lab_workspaces").select("id,status").eq("id",workspaceId).single();
      if(loadError||!current) return json({success:false,error:"Workspace record not found."},404);
      const allowed:Record<string,string[]>={queued:["provisioning"],failed:["provisioning"],provisioning:["ready","failed"]};
      if(!(allowed[current.status]||[]).includes(nextStatus)) return json({success:false,error:`Cannot change workspace from ${current.status} to ${nextStatus}.`},409);
      let workspaceUrl:string|null=null;
      if(nextStatus==="ready") {
        const candidate=String(body.workspace_url||"").trim();
        let parsed:URL; try{parsed=new URL(candidate);}catch{return json({success:false,error:"Enter a valid HTTPS workspace URL."},400);}
        if(parsed.protocol!=="https:"||!parsed.hostname||parsed.username||parsed.password) return json({success:false,error:"Workspace URL must be a valid HTTPS URL without embedded credentials."},400);
        workspaceUrl=parsed.toString();
      }
      const patch:Record<string,unknown>={status:nextStatus,updated_at:new Date().toISOString()};
      if(nextStatus==="ready") {patch.workspace_url=workspaceUrl;patch.error_message=null;patch.ready_at=new Date().toISOString();}
      if(nextStatus==="failed") patch.error_message=String(body.error_message||"Workspace setup failed").slice(0,500);
      if(nextStatus==="provisioning") {patch.error_message=null;patch.workspace_url=null;}
      const {data:updated,error:updateError}=await admin.from("lab_workspaces").update(patch).eq("id",workspaceId).select("id,status,workspace_url").single();
      if(updateError) throw updateError;
      return json({success:true,workspace:updated,message:nextStatus==="ready"?"Workspace marked ready. The student can now launch the verified HTTPS URL.":`Workspace status updated to ${nextStatus}.`});
    }
    if(action==="approve"||action==="reject") {
      const id=String(body.deployment_id||"");
      const {data:deployment,error:loadError}=await admin.from("lab_deployments").select("*").eq("id",id).single();
      if(loadError||!deployment) return json({success:false,error:"Deployment request not found."},404);
      if(deployment.deployment_type!=="internal") return json({success:false,error:"Legacy external-partner deployments are no longer managed by NextGen. Use the independent External Labs service; no NextGen account lookup or provisioning was attempted."},409);
      if(deployment.status!=="quoted" && deployment.status!=="requested")
        return json({success:false,error:"Only pending deployment requests can be reviewed."},409);
      if(action==="reject") {
        const {error}=await admin.from("lab_deployments").update({status:"rejected",updated_at:new Date().toISOString()}).eq("id",id);
        if(error) throw error;
        return json({success:true,message:"Deployment request rejected. No infrastructure was provisioned."});
      }
      const {data:approved,error}=await admin.from("lab_deployments").update({status:"approved",updated_at:new Date().toISOString()}).eq("id",id).select("id,status").single();
      if(error) throw error;
      // NextGen Internal Labs are course-linked and use NextGen enrolments only.
      const startAt=deployment.starts_at?new Date(deployment.starts_at):new Date();
      const expiresAt=new Date(startAt.getTime()+Number(deployment.duration_days)*86400000).toISOString();
      const {data:enrollments,error:enrollError}=await admin.from("enrollments").select("student_id,enrolled_at").eq("course_id",deployment.course_id).eq("status","active").order("enrolled_at",{ascending:true}).limit(deployment.student_count);
      if(enrollError) throw enrollError;
      const rows=(enrollments||[]).filter(x=>x.student_id).map(x=>({deployment_id:id,student_id:x.student_id,access_type:"internal",workspace_persistence:"persistent",expires_at:expiresAt,status:"queued"}));
      let allocated=0;
      if(rows.length){const {data:inserted,error:insertError}=await admin.from("lab_workspaces").upsert(rows,{onConflict:"deployment_id,student_id"}).select("id");if(insertError) throw insertError;allocated=inserted?.length||0;}
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
      if(body.deployment_type!=="internal") return json({success:false,error:"External Labs is an independent service and cannot be created through NextGen Lab Management."},409);
      const external=false;
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
      const emails=Array.isArray(body.external_user_emails)?[...new Set(body.external_user_emails.map((x:unknown)=>String(x).trim().toLowerCase()).filter(Boolean))]:[];
      if(external&&(emails.length<1||emails.length>200||emails.some((x:string)=>! /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(x)))) return json({success:false,error:"Enter 1–200 valid external/vendor account emails."},400);
      if(!external&&emails.length) return json({success:false,error:"External account emails are only allowed for external deployments."},400);
      const accessModel=String(body.access_model||"hybrid");
      if(!["hybrid","persistent","ephemeral"].includes(accessModel)) return json({success:false,error:"Invalid workspace model."},400);
      const duration=Number(body.duration_days);
      if(!Number.isInteger(duration)||duration<1||duration>365) return json({success:false,error:"Total lab duration must be between 1 and 365 days."},400);
      const startAt=body.starts_at?new Date(String(body.starts_at)):new Date();
      if(Number.isNaN(startAt.getTime())) return json({success:false,error:"Invalid lab start date."},400);
      const {data,error}=await admin.from("lab_deployments").insert({
        deployment_type:body.deployment_type,partner_name:external?String(body.partner_name).trim():null,
        external_user_emails:emails,access_model:accessModel,starts_at:startAt.toISOString(),
        trainer_name:body.trainer_name||null,batch_name:body.batch_name||null,course_id:course.id,course_name:course.name,
        template_key:course.slug,toc:body.toc||null,student_count:Number(body.student_count),
        duration_days:duration,status:external?"quoted":"requested",estimate,created_by:user.id,
        expires_at:new Date(startAt.getTime()+duration*86400000).toISOString()
      }).select("id,status").single();
      if(error) throw error;
      return json({success:true,deployment:data,message:external?"Partner estimate saved for admin review. No VPS has been rented or provisioned.":"Internal lab request saved. No VPS has been rented or provisioned."});
    }
    if(["provision","extend","destroy"].includes(action))
      return json({success:false,error:"VPS lifecycle adapter is not installed. No infrastructure was changed. Configure and validate the provider adapter before enabling this action."},503);
    return json({success:false,error:"Unsupported lab action."},400);
  } catch(e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected lab-control exception.";
    const name = e instanceof Error ? e.name : "UnknownError";
    // Include a correlation ID and processing stage so failures can be diagnosed without
    // exposing credentials, request headers, or provider response bodies.
    console.error("lab-control failure", JSON.stringify({request_id:requestId,stage,error_name:name,message}));
    return json({success:false,error:message,stage,request_id:requestId},500);
  }
});
