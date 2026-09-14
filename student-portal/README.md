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

## Current student flow

Login → Student Dashboard → My Courses → Course Material → 🎥 Class Recordings → Cloud Lab → My Progress → Certificate

The student-facing portal does not expose Assignments or My Projects.

## Planned next

AWS Lab API → EC2 provisioning → SSM browser terminal → 2/4/6 hour auto-stop


## Zoom LMS Recordings
The LMS supports trainer-published Zoom Cloud Recording links. Recordings are stored as metadata in the `recordings` table; the video itself remains hosted by Zoom. Students can see only recordings belonging to courses in which they are actively or previously enrolled. Run `supabase/lms-recordings.sql` once in Supabase SQL Editor.


## Student welcome

The dashboard displays the generic heading `Welcome Student`. It does not display the logged-in student's full name in the welcome heading.
