# NextGen Student Portal v1

Static LMS front-end for GitHub Pages. This MVP is intentionally backend-neutral and currently uses demo data.

## Deploy

The folder can be published at:

`https://mmukul.github.io/student-portal/`

Because GitHub Pages is static, do not put AWS credentials, service-role keys, or other secrets in this folder.

## Next backend step — Supabase

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `../supabase/schema.sql`.
4. Create private Storage buckets: `course-materials`, `assignments`, `certificates`.
5. Add the Supabase project URL and public anon key to the portal JavaScript in the next integration step.
6. Replace demo dashboard values with authenticated queries.

## Planned v1 flow

Login → Student Dashboard → My Courses → Course Material → Killercoda Lab → Progress

## Planned v2

Assignments → Submissions → Admin Dashboard → Certificates

## Planned v3

AWS Lab API → EC2 provisioning → SSM browser terminal → 2/4/6 hour auto-stop
