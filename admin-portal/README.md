# NextGen DevSecOps AI — Admin Portal

Admin portal for managing the LMS from GitHub Pages with Supabase Auth + PostgreSQL + RLS.

## URL

`https://mmukul.github.io/admin-portal/`

## Supabase setup

1. Create/configure your Supabase project.
2. Run `../supabase/schema.sql` in Supabase SQL Editor.
3. Configure `admin-portal/js/supabase-config.js` with the Supabase project URL and anon/publishable key.
4. Create an administrator account using Supabase Auth (Dashboard → Authentication → Users).
5. Copy that user's UUID and run:

```sql
update public.profiles
set role = 'admin', status = 'active'
where id = 'AUTH-USER-UUID';
```

The public student signup flow always creates `role='student'`; it cannot self-promote to admin.

## Admin capabilities in v1

- Secure admin login / logout
- Dashboard statistics
- Student profile search
- Edit student profile, ID, phone and status
- View courses
- Create/edit batches
- Create/edit assignments
- AWS Cloud Lab architecture/status view

## Important security rule

Never put the Supabase `service_role` key in GitHub Pages or browser JavaScript. The browser should only use the Supabase anon/publishable key. Any privileged operation that requires a service key should be implemented as a secured server-side Edge Function/API later.

## Student account creation

The current admin portal manages profiles for users who already exist in Supabase Auth. Creating Auth users from an admin UI requires a server-side Edge Function using a protected service-role credential; this is intentionally not placed in the static site.


## Zoom LMS Recordings
1. Record/upload the class in Zoom Cloud Recording.
2. Copy the Zoom recording share URL and passcode (if enabled).
3. Open **Zoom Recordings** in the Admin Portal.
4. Select the course, add the session date/title, paste the URL and optional passcode.
5. Publish the recording.

Students only see recordings for courses they are enrolled in, subject to active student status and Supabase RLS.
