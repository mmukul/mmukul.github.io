import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: cors });
const required = (name: string) => { const v = Deno.env.get(name); if (!v) throw new Error(`Missing Edge Function secret: ${name}`); return v; };
const clean = (v: unknown, max=180) => String(v ?? "").replace(/[<>\r\n]/g, " ").replace(/\s+/g," ").trim().slice(0,max);

async function makePdf(student: string, course: string, number: string, date: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 22, y: 22, width: 798, height: 551, borderWidth: 5, borderColor: rgb(.20,.48,.78) });
  page.drawRectangle({ x: 34, y: 34, width: 774, height: 527, borderWidth: 1, borderColor: rgb(.55,.72,.9) });
  const center = (text: string, y: number, size: number, font=regular, color=rgb(.12,.22,.36)) => {
    const w=font.widthOfTextAtSize(text,size); page.drawText(text,{x:(842-w)/2,y,size,font,color});
  };
  center("NEXTGEN DEVSECOPS AI", 500, 18, bold, rgb(.12,.35,.62));
  center("CERTIFICATE OF ACHIEVEMENT", 445, 13, bold, rgb(.18,.48,.72));
  center("Certificate of Completion", 395, 32, bold);
  center("This certificate is proudly presented to", 345, 15);
  center(student, 292, 27, bold, rgb(.18,.35,.62));
  center("for successfully completing", 250, 15);
  center(course, 210, 22, bold, rgb(.10,.43,.60));
  page.drawText(`Certificate ID: ${number}`, {x:70,y:105,size:11,font:bold,color:rgb(.2,.28,.38)});
  page.drawText(`Issue Date: ${date}`, {x:620,y:105,size:11,font:bold,color:rgb(.2,.28,.38)});
  page.drawText("NextGen DevSecOps AI | https://nextgendevsecops.in", {x:245,y:65,size:10,font:regular,color:rgb(.35,.42,.52)});
  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405,{error:"Method not allowed"});
  try {
    const url=required("SUPABASE_URL"), anon=required("SUPABASE_ANON_KEY"), service=required("SUPABASE_SERVICE_ROLE_KEY");
    const auth=req.headers.get("Authorization")||"";
    const token=auth.replace(/^Bearer\s+/i,""); if(!token) return json(401,{error:"Authentication required"});
    const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userErr}=await userClient.auth.getUser(token);
    if(userErr||!user) return json(401,{error:"Invalid session"});
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    // Match the Admin Portal's authoritative authorization rule, including MFA AAL2.
    const { data: assurance, error: assuranceErr } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceErr) return json(403,{error:`Administrator MFA verification failed: ${assuranceErr.message}`});
    if (assurance?.currentLevel !== "aal2") return json(403,{error:"Administrator access requires MFA step-up (AAL2). Complete your configured MFA challenge, then retry."});
    const {data:isAdmin,error:adminErr}=await userClient.rpc("is_admin");
    if(adminErr) return json(403,{error:`Administrator authorization check failed: ${adminErr.message}`});
    if(isAdmin !== true) {
      const {data:profile}=await admin.from("profiles").select("id,role,status").eq("id",user.id).maybeSingle();
      return json(403,{error:`Administrator access required. Auth user ${user.id}; profile ${profile?.id || "not found"}; role ${profile?.role || "unknown"}; status ${profile?.status || "unknown"}. Confirm this is the active admin account and complete MFA step-up.`});
    }
    const body=await req.json(); const action=clean(body.action,30);
    if(action==="retry_email") {
      const id=clean(body.certificate_id,80); if(!id) return json(400,{error:"certificate_id required"});
      const {data:cert,error:cErr}=await admin.from("certificates").select("id,student_id,course_id,certificate_number,file_path,issued_at,email_status").eq("id",id).maybeSingle();
      if(cErr||!cert) return json(404,{error:"Certificate not found"});
      return await sendNotification(admin,cert);
    }
    if(action!=="issue") return json(400,{error:"Unsupported action"});
    if(body.approved!==true) return json(400,{error:"Explicit administrator approval is required"});
    const studentId=clean(body.student_id,80), courseId=clean(body.course_id,80), number=clean(body.certificate_number,80), issueDate=clean(body.issued_at,40);
    if(!studentId||!courseId||!number||!issueDate) return json(400,{error:"Student, course, certificate number and issue date are required"});
    if(!/^NGDAI-[0-9]{4}-[A-Za-z0-9-]{4,20}$/.test(number)) return json(400,{error:"Invalid certificate number format"});
    const {data:student,error:sErr}=await admin.from("profiles").select("id,full_name,role,status").eq("id",studentId).maybeSingle();
    if(sErr||!student||student.role!=="student"||student.status!=="active") return json(400,{error:"Selected student profile is invalid or inactive"});
    const {data:course,error:coErr}=await admin.from("courses").select("id,name").eq("id",courseId).maybeSingle();
    if(coErr||!course) return json(400,{error:"Selected course does not exist"});
    const {data:enrollment,error:eErr}=await admin.from("enrollments").select("id,status").eq("student_id",studentId).eq("course_id",courseId).in("status",["active","completed"]).limit(1).maybeSingle();
    if(eErr||!enrollment) return json(400,{error:"No eligible active/completed enrollment exists. Verify course completion before approval."});
    const {data:existing,error:xErr}=await admin.from("certificates").select("id,certificate_number,file_path,email_status").eq("student_id",studentId).eq("course_id",courseId).maybeSingle();
    if(xErr) return json(500,{error:xErr.message});
    if(existing) return json(409,{error:`A certificate already exists for this student and course (${existing.certificate_number}). Use notification retry if needed.`,certificate:existing});
    const {data:dup,error:dErr}=await admin.from("certificates").select("id").eq("certificate_number",number).maybeSingle();
    if(dErr) return json(500,{error:dErr.message}); if(dup) return json(409,{error:"Certificate number already exists"});
    const {data:authData,error:authErr}=await admin.auth.admin.getUserById(studentId);
    const email=authData?.user?.email; if(authErr||!email) return json(400,{error:"Student email address could not be resolved"});
    const date=new Date(issueDate); if(Number.isNaN(date.getTime())) return json(400,{error:"Invalid issue date"});
    const {data:created,error:insErr}=await admin.from("certificates").insert({student_id:studentId,course_id:courseId,certificate_number:number,issued_at:date.toISOString(),email_status:"not_sent",approved_by:user.id,approved_at:new Date().toISOString()}).select("id,student_id,course_id,certificate_number,issued_at,email_status").single();
    if(insErr) return json(500,{error:insErr.message});
    const pdf=await makePdf(clean(student.full_name||"Student"),clean(course.name||"Course"),number,date.toLocaleDateString("en-IN"));
    const path=`${studentId}/${created.id}.pdf`;
    const {error:upErr}=await admin.storage.from("certificates").upload(path,pdf,{contentType:"application/pdf",upsert:false});
    if(upErr) { await admin.from("certificates").delete().eq("id",created.id); return json(500,{error:`PDF upload failed: ${upErr.message}`}); }
    const {error:updateErr}=await admin.from("certificates").update({file_path:path}).eq("id",created.id);
    if(updateErr) return json(500,{error:`PDF saved but certificate record update failed: ${updateErr.message}`,certificate_id:created.id});
    const result=await sendNotification(admin,{...created,file_path:path});
    return result;
  } catch(e) { console.error("certificate-issue:",e); return json(500,{error:e instanceof Error?e.message:"Certificate operation failed"}); }
});

async function sendNotification(admin:any, cert:any) {
  const apiKey=required("RESEND_API_KEY"), from=required("CERTIFICATE_FROM_EMAIL"), site=(Deno.env.get("SITE_URL")||"https://nextgendevsecops.in").replace(/\/$/,"");
  const {data:student}=await admin.from("profiles").select("full_name").eq("id",cert.student_id).maybeSingle();
  const {data:authData,error:authErr}=await admin.auth.admin.getUserById(cert.student_id); const email=authData?.user?.email;
  if(authErr||!email) { await admin.from("certificates").update({email_status:"failed",email_error:"Student email unavailable"}).eq("id",cert.id); return json(200,{ok:true,certificate_id:cert.id,email_status:"failed",message:"Certificate issued, but student email is unavailable."}); }
  const {data:course}=await admin.from("courses").select("name").eq("id",cert.course_id).maybeSingle();
  const {data:signed,error:signedErr}=await admin.storage.from("certificates").createSignedUrl(cert.file_path,60*60*24*7);
  if(signedErr||!signed?.signedUrl) throw new Error("Could not create secure certificate download link");
  const name=clean(student?.full_name||"Student"), courseName=clean(course?.name||"your course");
  const html=`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17243b"><h2 style="color:#174a7b">Congratulations, ${name.replace(/&/g,"&amp;").replace(/</g,"&lt;")}!</h2><p>Your certificate for <strong>${courseName.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</strong> has been approved and issued by NextGen DevSecOps AI.</p><p><strong>Certificate ID:</strong> ${clean(cert.certificate_number)}</p><p><a href="${signed.signedUrl}" style="display:inline-block;padding:12px 18px;background:#155e9a;color:#fff;text-decoration:none;border-radius:6px">Download Certificate PDF</a></p><p>This secure download link expires in 7 days. You can also access your certificate from your Student Portal.</p><p>Regards,<br>NextGen DevSecOps AI</p><p><a href="${site}">${site}</a></p></div>`;
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],subject:`Your NextGen DevSecOps AI certificate — ${courseName}`,html})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) { const reason=clean(payload?.message||payload?.error||`Resend HTTP ${response.status}`,500); await admin.from("certificates").update({email_status:"failed",email_error:reason}).eq("id",cert.id); return json(200,{ok:true,certificate_id:cert.id,email_status:"failed",message:"Certificate issued and PDF stored; email notification failed and can be retried.",email_error:reason}); }
  await admin.from("certificates").update({email_status:"sent",email_sent_at:new Date().toISOString(),email_error:null}).eq("id",cert.id);
  return json(200,{ok:true,certificate_id:cert.id,certificate_number:cert.certificate_number,email_status:"sent",message:"Certificate issued, PDF generated and student notified."});
}
