# NextGen DevSecOps AI — LMS

A lightweight training LMS for **NextGen DevSecOps AI**, built for DevOps, DevSecOps, AppSec, Cloud Security, GenAI and AI Security training.

The LMS uses:

- GitHub Pages for the frontend
- Supabase Authentication and PostgreSQL
- Supabase Row Level Security (RLS)
- Supabase Edge Functions for secure admin operations
- Zoom Cloud Recording links for class recordings

---

## 1. Architecture

```text
                         GitHub Pages
                              |
             +----------------+----------------+
             |                                 |
        Admin Portal                       Student LMS
             |                                 |
             +---------------+-----------------+
                             |
                          Supabase
                             |
          +------------------+------------------+
          |                  |                  |
        Auth             PostgreSQL        Edge Functions
          |                  |                  |
     Admin/Student      LMS data          Invite Student
                         + RLS
```

The browser must **never contain the Supabase service-role key**.

---

# 2. Repository Structure

```text
mmukul.github.io/
|
├── admin-portal/
│   ├── index.html
│   ├── login.html
│   └── js/
│       └── supabase-config.js
|
├── student-portal/
│   ├── index.html
│   ├── login.html
│   ├── reset-password.html
│   └── js/
│       └── supabase-config.js
|
├── supabase/
│   ├── schema.sql
│   └── functions/
│       └── invite-student/
│           └── index.ts
|
└── README.md
```

---

# 3. Supabase Project

The frontend uses the Supabase project configured in:

```text
admin-portal/js/supabase-config.js
student-portal/js/supabase-config.js
```

Use the **publishable/anon key only** in frontend code.

Example:

```javascript
window.NEXTGEN_SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
window.NEXTGEN_SUPABASE_ANON_KEY = "YOUR-PUBLISHABLE-KEY";
```

Do not commit:

```text
SUPABASE_SERVICE_ROLE_KEY
```

to GitHub.

---

# 4. Database Setup

Open:

**Supabase → SQL Editor**

Run:

```text
supabase/schema.sql
```

The production schema provides the core LMS tables, authentication/profile model, enrollments, progress, assignments, submissions, certificates and class recordings.

## Important

If the Supabase project already contains production data, take a backup before applying a major schema change.

---

# 5. User Roles

The LMS uses two roles:

```text
student
admin
```

Profiles also have an account status:

```text
active
inactive
```

## Student access

A student must satisfy:

```text
role   = student
status = active
```

Otherwise the LMS denies access.

## Admin access

An administrator must satisfy:

```text
role   = admin
status = active
```

This is checked after Supabase Authentication.

---

# 6. Admin Account Setup

Create the administrator through:

**Supabase → Authentication → Users**

After the Auth user exists, make sure a matching profile exists.

Example:

```sql
UPDATE public.profiles
SET
    role = 'admin',
    status = 'active'
WHERE id = 'AUTH-USER-UUID';
```

Verify:

```sql
SELECT
    id,
    full_name,
    role,
    status
FROM public.profiles
WHERE id = 'AUTH-USER-UUID';
```

Expected:

```text
role   = admin
status = active
```

---

# 7. Admin Portal

Open:

```text
/admin-portal/login.html
```

The Admin Portal provides:

- Dashboard
- Students
- Courses
- Batches
- Assignments
- Session Recordings
- Settings

Only active administrator accounts can enter the Admin Portal.

---

# 8. Add / Invite Student

The intended student onboarding flow is:

```text
Admin
  |
  v
Invite Student
  |
  +-- Full Name
  +-- Email
  +-- Phone
  +-- Student ID
  +-- Course
  +-- Batch (optional)
  |
  v
Supabase Edge Function
  |
  +-- Create/reuse Auth user
  +-- Create/update profile
  +-- role = student
  +-- status = active
  +-- Create enrollment
  +-- Optional batch assignment
  +-- Send invitation
  |
  v
Student receives invitation email
  |
  v
Student sets password
  |
  v
Student Login
```

This avoids public student self-registration.

---

# 9. Deploy the Invite Student Edge Function

Install and authenticate the Supabase CLI.

```bash
supabase login
```

From the repository root:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Deploy:

```bash
supabase functions deploy invite-student
```

Verify in:

**Supabase → Edge Functions**

You should see:

```text
invite-student
ACTIVE
```

---

# 10. Edge Function Secrets

The invitation function performs privileged Auth operations server-side.

The service-role key must remain in Supabase Edge Function secrets.

Never put it in:

```text
admin-portal/index.html
student-portal/index.html
GitHub
README.md
```

If required by your deployment, configure the function's server-side secrets through:

**Supabase → Edge Functions → Secrets**

---

# 11. Student Login

Open:

```text
/student-portal/login.html
```

The login process is:

```text
Supabase Authentication
        |
        v
Current Auth User
        |
        v
profiles lookup
        |
        +-- role = student?
        |
        +-- status = active?
        |
        v
      LMS
```

An inactive student is rejected even if authentication succeeds.

---

# 12. Class Recordings

The student-facing name is:

```text
🎥 Class Recordings
```

The admin-facing name is:

```text
🎥 Session Recordings
```

Zoom is only the recording provider; the LMS does not depend on the name "Zoom Recordings".

## Admin

Go to:

```text
Admin → Session Recordings
```

Add:

- Session title
- Course
- Session date
- Duration
- Recording URL
- Optional passcode
- Description
- Published/unpublished state

## Student

Students see:

```text
Student LMS
    |
    +-- Class Recordings
```

Only active students enrolled in the relevant course should receive access to that course's recordings.

The actual video remains hosted by Zoom. The LMS stores recording metadata and the recording URL.

---

# 13. Enrollment Model

A student should normally be enrolled from the Admin Portal.

```text
Student
   |
   +---- Course A
   |       |
   |       +-- Modules
   |       +-- Lessons
   |       +-- Recordings
   |       +-- Assignments
   |
   +---- Course B
           |
           +-- Modules
           +-- Lessons
           +-- Recordings
           +-- Assignments
```

Course access should be controlled through enrollment and RLS rather than only hiding UI elements.

---

# 14. Security Model

Frontend checks are for user experience.

**Supabase RLS is the security boundary.**

The database should enforce:

- Students can read their own profile
- Students cannot promote themselves to admin
- Students cannot change their own active/inactive status
- Students can access only enrolled course content
- Students can access only their own progress
- Students can access only their own submissions
- Students can access only their own certificates
- Active students can access published recordings for enrolled courses
- Admins can manage LMS data according to admin policies

---

# 15. Troubleshooting

## A. "Supabase is not configured"

Check:

```text
student-portal/js/supabase-config.js
```

Confirm that both are populated:

```javascript
NEXTGEN_SUPABASE_URL
NEXTGEN_SUPABASE_ANON_KEY
```

Also confirm that the configuration script is loaded before LMS initialization.

---

## B. "Supabase library failed to load"

Confirm the Supabase JavaScript library is loaded before the LMS calls:

```javascript
supabase.createClient(...)
```

Check browser Developer Tools:

```text
F12 → Console
```

and:

```text
F12 → Network
```

Look for the Supabase CDN request.

---

## C. "LMS access is available only to active student accounts"

Authentication succeeded, but the profile authorization check failed.

Run:

```sql
SELECT
    p.id,
    p.full_name,
    p.role,
    p.status,
    u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.full_name;
```

The student must have:

```text
role   = student
status = active
```

---

## D. "Failed to send a request to the Edge Function"

This normally means the browser could not successfully reach the deployed function.

Check:

1. Supabase → Edge Functions
2. Confirm `invite-student` exists
3. Confirm it is deployed
4. Check Edge Function logs
5. Confirm the frontend uses the same Supabase project
6. Confirm the function name is exactly:

```text
invite-student
```

Redeploy if necessary:

```bash
supabase functions deploy invite-student
```

---

## E. Invitation email not received

Check:

- Supabase Authentication users
- Email address
- Spam/Junk folder
- Supabase Auth email configuration
- Edge Function logs
- Redirect URL configuration

A successful Auth user creation does not by itself guarantee that a production email provider is configured correctly.

---

# 16. GitHub Pages Deployment

Push the repository to:

```text
https://github.com/mmukul/mmukul.github.io
```

GitHub Pages should publish the repository.

After deployment, test:

```text
https://mmukul.github.io/
https://mmukul.github.io/admin-portal/login.html
https://mmukul.github.io/student-portal/login.html
```

After updating JavaScript, use a hard refresh:

```text
Ctrl + Shift + R
```

This helps avoid an old browser/CDN cached version.

---

# 17. Recommended Testing Sequence

Always test in this order.

### Test 1 — Admin

```text
Admin Login
   ↓
Admin Dashboard
```

### Test 2 — Student invitation

```text
Admin
   ↓
Students
   ↓
Invite Student
   ↓
Select Course
   ↓
Optional Batch
   ↓
Send Invitation
```

### Test 3 — Student

```text
Invitation Email
   ↓
Set Password
   ↓
Student Login
   ↓
LMS
```

### Test 4 — Course access

Confirm the student sees only the enrolled course.

### Test 5 — Recording

```text
Admin → Session Recordings
       ↓
Publish recording
       ↓
Student → Class Recordings
```

### Test 6 — Inactive student

Change:

```sql
status = 'inactive'
```

The student should no longer be allowed into the LMS.

Restore:

```sql
status = 'active'
```

and verify access returns.

---

# 18. Future Enhancements

Recommended roadmap:

### V10
- Enrollment management
- Batch management
- Course progress
- Recording edit/delete/publish controls

### V11
- Assignments
- Student submissions
- Trainer evaluation
- Certificates
- Certificate verification

### V12
- Admin analytics
- Student activity
- Course completion reports
- Notifications

### V13
- AI Learning Assistant
- RAG-based course Q&A
- Quiz generation
- Interview preparation
- Secure AI/LLM architecture demonstrations

---

# 19. Important Security Rules

Never commit:

```text
SUPABASE_SERVICE_ROLE_KEY
private API keys
SMTP passwords
Zoom account credentials
```

The GitHub Pages frontend is public.

Use:

```text
Publishable/Anon key → Browser
Service Role Key     → Supabase server-side only
```

---

# 20. Production Checklist

Before going live:

- [ ] Supabase project configured
- [ ] `schema.sql` applied
- [ ] RLS enabled
- [ ] Admin profile = `admin / active`
- [ ] Student profile = `student / active`
- [ ] `invite-student` Edge Function deployed
- [ ] Edge Function secrets configured
- [ ] Auth email/invitation configured
- [ ] GitHub Pages deployed
- [ ] Admin login tested
- [ ] Student invitation tested
- [ ] Student login tested
- [ ] Course enrollment tested
- [ ] Class recording tested
- [ ] Inactive student access tested
- [ ] No service-role key committed to GitHub

---

## NextGen DevSecOps AI

**Engineer the Future. Secure the AI Era.**

Website: https://mmukul.github.io

YouTube: https://www.youtube.com/@DevSecOps-Experts

GitHub: https://github.com/mmukul
