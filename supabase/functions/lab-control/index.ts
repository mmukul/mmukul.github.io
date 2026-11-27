// NextGen Lab Control — Website v311 (built from supplied Website v310 source)
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
    const e2eRequest = async (method: string, path: string, payload?: unknown) => {
      const c=e2eConfig();
      if(!e2eReady(c)) throw new Error("E2E API credentials are incomplete. Configure E2E_API_KEY and E2E_API_TOKEN in Supabase Edge Function Secrets.");
      const u=new URL(c.base+path);
      u.searchParams.set("project_id",c.projectId);
      u.searchParams.set("apikey",c.apiKey);
      u.searchParams.set("location",c.location);
      const response=await fetch(u.toString(),{
        method,headers:{"Authorization":`Bearer ${c.apiToken}`,"Accept":"application/json","Content-Type":"application/json"},
        ...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(30000)
      });
      const raw=await response.text();
      let parsed:any; try{parsed=raw?JSON.parse(raw):{};}catch{parsed={message:"Provider returned a non-JSON response."};}
      if(!response.ok || (typeof parsed?.code==="number" && parsed.code>=400)) {
        const detail=String(parsed?.message||parsed?.error||`HTTP ${response.status}`).slice(0,240);
        throw new Error(`E2E ${method} ${path} failed: ${detail}`);
      }
      return parsed;
    };
    const e2eWriteAllowed = () => Deno.env.get("E2E_WRITE_ENABLED")==="true";
    const getInternalWorkspace = async (workspaceId:string) => {
      if(!/^[A-Za-z0-9_-]{8,100}$/.test(workspaceId)) throw new Error("Enter a valid workspace ID.");
      const {data:workspace,error}=await admin.from("lab_workspaces")
        .select("id,status,deployment_id,student_id,provider_instance_id,provider_status")
        .eq("id",workspaceId).single();
      if(error||!workspace) throw new Error("Internal student workspace was not found. Apply the v311 database migration first.");
      const {data:deployment,error:deploymentError}=await admin.from("lab_deployments")
        .select("id,deployment_type,status").eq("id",workspace.deployment_id).single();
      if(deploymentError||!deployment||deployment.deployment_type!=="internal") throw new Error("Only NextGen internal student workspaces can use this E2E integration.");
      return workspace;
    };
    if(action==="e2e_api_status") {
      stage = "e2e_api_status";
      const c=e2eConfig();
      return json({success:true,configured:e2eReady(c),project_id:c.projectId,location:c.location,
        has_api_key:Boolean(c.apiKey),has_api_token:Boolean(c.apiToken),read_only:!e2eWriteAllowed(),write_enabled:e2eWriteAllowed(),
        message:!e2eReady(c)?"Authentication required. Add E2E_API_KEY and E2E_API_TOKEN to Supabase Edge Function Secrets.":(e2eWriteAllowed()?"E2E credentials are present and write operations are feature-enabled.":"E2E read-only access is configured. Set E2E_WRITE_ENABLED=true only after installing an E2E token with READ and WRITE access.")});
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
    if(action==="e2e_list_os_plans") {
      stage="e2e_list_os_plans";
      const data:any=await e2eGet("/api/v1/images/");
      const plans=Array.isArray(data?.data)?data.data:(Array.isArray(data)?data:[]);
      return json({success:true,read_only:true,plans});
    }
    if(action==="e2e_create_workspace_node") {
      stage="e2e_create_workspace_node";
      if(!e2eWriteAllowed()) return json({success:false,error:"E2E write operations are disabled. Install a READ+WRITE API token, validate read-only access, then set E2E_WRITE_ENABLED=true."},409);
      const workspaceId=String(body.workspace_id||"").trim();
      const workspace=await getInternalWorkspace(workspaceId);
      if(workspace.provider_instance_id) return json({success:false,error:"This workspace already has an E2E instance. Refresh its provider status instead of creating a duplicate."},409);
      if(!["queued","failed","provisioning"].includes(String(workspace.status))) return json({success:false,error:`Workspace status ${workspace.status} is not eligible for VPS provisioning.`},409);
      const plan=String(body.plan||"").trim(), image=String(body.image||"").trim(), sshKey=String(body.ssh_public_key||"").trim();
      if(!plan||!/^[A-Za-z0-9._-]{3,255}$/.test(plan)||!image||!/^[A-Za-z0-9.-]{2,120}$/.test(image)) return json({success:false,error:"Select a valid E2E OS plan and image."},400);
      if(sshKey.length>4096||! /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+\S+/.test(sshKey)||/[\r\n]/.test(sshKey)) return json({success:false,error:"Provide one valid single-line OpenSSH public key (maximum 4096 characters)."},400);
      const c=e2eConfig();
      const plansResponse:any=await e2eGet("/api/v1/images/");
      const available=Array.isArray(plansResponse?.data)?plansResponse.data:[];
      const selected=available.find((p:any)=>p?.plan===plan&&p?.image===image&&String(p?.location||"").toLowerCase()===c.location.toLowerCase());
      if(!selected) return json({success:false,error:"The selected plan/image is not available in the configured E2E region. Reload OS plans and select a matching entry."},409);
      const {count:activeCount,error:countError}=await admin.from("lab_workspaces").select("id",{count:"exact",head:true})
        .not("provider_instance_id","is",null).neq("provider_status","deleted");
      if(countError) throw new Error(`Unable to validate the E2E node cap: ${countError.message}`);
      const maxNodes=Math.max(1,Math.min(100,Number(Deno.env.get("E2E_MAX_NODES")||3)));
      if((activeCount||0)>=maxNodes) return json({success:false,error:`E2E pilot node cap reached (${maxNodes}). Increase E2E_MAX_NODES only after reviewing capacity and budget.`},409);
      const {data:claimed,error:claimError}=await admin.from("lab_workspaces").update({status:"provisioning",provider_status:"creating",updated_at:new Date().toISOString()})
        .eq("id",workspaceId).is("provider_instance_id",null).in("status",["queued","failed","provisioning"])
        .or("provider_status.is.null,provider_status.eq.create_failed")
        .select("id").maybeSingle();
      if(claimError) throw claimError;
      if(!claimed) return json({success:false,error:"Workspace is already being provisioned or has an assigned provider instance. Refresh and retry."},409);
      const safeSuffix=workspaceId.replace(/[^A-Za-z0-9]/g,"").slice(0,12).toUpperCase();
      const nodeName=`NG-LAB-${safeSuffix}`.slice(0,50);
      const payload:any={label:"nextgen-student-labs",name:nodeName,plan,image,ssh_keys:[sshKey],number_of_instances:1,disable_password:true,default_public_ip:true,is_saved_image:false,saved_image_template_id:null,backups:false};
      if(Number.isInteger(Number(body.image_id))&&Number(body.image_id)>0) payload.image_id=Number(body.image_id);
      try {
        const created:any=await e2eRequest("POST","/api/v1/nodes/",payload);
        const node=created?.data||{};
        const nodeId=String(node.id||node.node_id||"");
        if(!/^\d+$/.test(nodeId)) throw new Error("E2E accepted the create request but did not return a numeric node ID. Check the E2E console before retrying to avoid duplicate billing.");
        const patch={provider_instance_id:nodeId,provider_status:String(node.status||"Creating"),provider_name:nodeName,provider_region:c.location,provider_plan:plan,provider_image:image,provider_public_ip:node.public_ip_address||null,provider_private_ip:node.private_ip_address||null,provider_provisioned_at:new Date().toISOString(),provider_last_synced_at:new Date().toISOString(),error_message:null};
        const {data:updated,error:updateError}=await admin.from("lab_workspaces").update(patch).eq("id",workspaceId).select("id,status,provider_instance_id,provider_status,provider_public_ip,provider_private_ip").single();
        if(updateError) {
          try{await e2eRequest("DELETE",`/api/v1/nodes/${encodeURIComponent(nodeId)}/`);}catch{}
          throw new Error(`E2E created node ${nodeId}, but workspace mapping failed. A cleanup attempt was made; verify the E2E console before retrying. ${updateError.message}`);
        }
        return json({success:true,workspace:updated,provider_response:created,message:`E2E VPS creation accepted for workspace ${workspaceId}. Provider status is ${patch.provider_status}; the student workspace remains unavailable until setup and access checks pass.`});
      } catch(error) {
        await admin.from("lab_workspaces").update({status:"failed",provider_status:"create_unknown",error_message:String(error instanceof Error?error.message:error).slice(0,500),updated_at:new Date().toISOString()}).eq("id",workspaceId).is("provider_instance_id",null);
        throw error;
      }
    }
    if(action==="e2e_workspace_action") {
      stage="e2e_workspace_action";
      if(!e2eWriteAllowed()) return json({success:false,error:"E2E write operations are disabled. Configure a READ+WRITE API token and explicitly enable E2E_WRITE_ENABLED."},409);
      const workspaceId=String(body.workspace_id||"").trim();
      const workspace=await getInternalWorkspace(workspaceId);
      const nodeId=String(workspace.provider_instance_id||"");
      if(!/^\d+$/.test(nodeId)) return json({success:false,error:"No E2E node is mapped to this workspace."},409);
      const operation=String(body.operation||"");
      if(operation==="terminate") {
        const deleted:any=await e2eRequest("DELETE",`/api/v1/nodes/${encodeURIComponent(nodeId)}/`);
        const {data:updated,error}=await admin.from("lab_workspaces").update({provider_status:"deleted",provider_public_ip:null,provider_private_ip:null,workspace_url:null,status:"failed",error_message:"E2E VPS terminated by administrator.",provider_last_synced_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",workspaceId).select("id,status,provider_status").single();
        if(error) throw error;
        return json({success:true,workspace:updated,provider_response:deleted,message:"E2E VPS deletion request succeeded. Student launch access has been disabled."});
      }
      if(operation==="add_ssh_key") {
        const sshKey=String(body.ssh_public_key||"").trim(), label=String(body.ssh_key_label||"").trim();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(label)) return json({success:false,error:"Enter an email address as the SSH key label."},400);
        if(sshKey.length>4096||! /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+\S+/.test(sshKey)||/[\r\n]/.test(sshKey)) return json({success:false,error:"Provide one valid single-line OpenSSH public key."},400);
        const result=await e2eRequest("PUT",`/api/v1/nodes/${encodeURIComponent(nodeId)}/actions/`,{type:"add_ssh_keys",ssh_keys:[{label,ssh_key:sshKey}]});
        return json({success:true,provider_response:result,message:"SSH public key add request accepted by E2E. Verify access using SSH before marking the workspace ready."});
      }
      const actionType:Record<string,string>={start:"power_on",stop:"power_off",restart:"reboot"};
      const type=actionType[operation];
      if(!type) return json({success:false,error:"Unsupported E2E workspace operation."},400);
      const result:any=await e2eRequest("PUT",`/api/v1/nodes/${encodeURIComponent(nodeId)}/actions/`,{type});
      let actualStatus=String(result?.data?.status||`${type}_requested`);
      let publicIp:string|null=null,privateIp:string|null=null;
      try {
        const details:any=await e2eGet(`/api/v1/nodes/${encodeURIComponent(nodeId)}/`);
        const n=details?.data||{}; actualStatus=String(n.status||actualStatus); publicIp=n.public_ip_address||null; privateIp=n.private_ip_address||null;
      } catch{}
      const patch:any={provider_status:actualStatus,provider_last_synced_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      if(publicIp) patch.provider_public_ip=publicIp;
      if(privateIp) patch.provider_private_ip=privateIp;
      const {data:updated,error}=await admin.from("lab_workspaces").update(patch).eq("id",workspaceId).select("id,status,provider_status,provider_public_ip,provider_private_ip").single();
      if(error) throw error;
      return json({success:true,workspace:updated,provider_response:result,message:`E2E ${operation} request accepted. Current provider status: ${actualStatus}.`});
    }
    if(action==="e2e_sync_workspace_node") {
      stage="e2e_sync_workspace_node";
      const workspaceId=String(body.workspace_id||"").trim();
      const workspace=await getInternalWorkspace(workspaceId);
      const nodeId=String(workspace.provider_instance_id||"");
      if(!/^\d+$/.test(nodeId)) return json({success:false,error:"No E2E node is mapped to this workspace."},409);
      const details:any=await e2eGet(`/api/v1/nodes/${encodeURIComponent(nodeId)}/`);
      const n=details?.data||{};
      const patch={provider_status:String(n.status||workspace.provider_status||"unknown"),provider_public_ip:n.public_ip_address||null,provider_private_ip:n.private_ip_address||null,provider_last_synced_at:new Date().toISOString()};
      const {data:updated,error}=await admin.from("lab_workspaces").update(patch).eq("id",workspaceId).select("id,status,provider_instance_id,provider_status,provider_public_ip,provider_private_ip").single();
      if(error) throw error;
      return json({success:true,workspace:updated,details,message:"Provider status synchronized. Student launch remains gated by the workspace-ready workflow."});
    }
    if(action==="provider_config_status") {
      const {data,error}=await admin.from("lab_provider_settings").select("provider,mode,instance_name,region,public_ip,private_ip,cpu,ram_gb,disk_gb,max_workspaces,monthly_budget_inr,updated_at").eq("provider","e2e").maybeSingle();
      if(error) throw error;
      return json({success:true,config:data||null,provisioning_enabled:e2eWriteAllowed(),
        message:data?"Existing E2E VPS metadata is registered. API-managed provisioning is controlled separately by the E2E write-access safety switch.":"No existing E2E VPS metadata has been saved. API-managed provisioning can still be configured through E2E secrets."});
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
      return json({success:true,config:data,provisioning_enabled:e2eWriteAllowed(),message:"E2E VPS metadata saved. API-managed provisioning remains controlled by the server-side E2E_WRITE_ENABLED safety switch."});
    }
    if(action==="status") {
      const c=e2eConfig(); const providerReady=e2eReady(c);
      const writeEnabled=providerReady&&e2eWriteAllowed();
      return json({success:true,health:writeEnabled?"E2E API configured — write actions feature-enabled":providerReady?"E2E read-only mode":"Manual workspace mode",
        provider_configured:providerReady,provisioning_enabled:writeEnabled,
        message:writeEnabled?"E2E API credentials are present and provider write actions are feature-enabled. Validate with one test workspace before rollout.":providerReady?"E2E read-only API is configured. Install a READ+WRITE token and explicitly enable E2E_WRITE_ENABLED to provision nodes.":"Manual workspace mode is active. Configure E2E API secrets to discover plans and provider resources."});
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
      return json({success:true,deployment:approved,workspaces_allocated:allocated,provider_provisioning:e2eWriteAllowed(),
        message:`Deployment approved. ${allocated} individual workspace record(s) queued. Admins can provision dedicated E2E VPS instances per workspace when the E2E write-access safety switch is enabled.`});
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
