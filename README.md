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


## v36 validation/fixes
- Student recordings aligned with canonical Supabase columns.
- Canonical lab_assignments table added and shared by Admin/Student portals.
- Certificate issuance now requires active/completed enrollment.
- Certificate view validates current enrollment.
- Existing database migration: `supabase/lms-compatibility-v36.sql`.

### Secure UPI + UTR payments
The website now submits UPI/UTR payment references to the Supabase `submit-payment` Edge Function. The browser does not write payment records directly and cannot set a payment to verified/paid. Run `supabase/payment-security-v41.sql` (also included at the end of `supabase/schema.sql`) and configure the server-only `TURNSTILE_SECRET_KEY` Edge Function secret before enabling payment submission.

### v59 updates
- Tightened Services and Start Where You Are section spacing.
- Compact Hands-on Learning cards with clear recommended use cases.
- Added server-side request-size and origin checks to public UPI/UTR submission while retaining Turnstile, server-side pricing, duplicate UTR protection and pending-only payment state.

## v60 payment UX/security refinement
- Added compact in-modal payment status: Payment Submitted → Awaiting Verification.
- Displays server-returned reference and amount without treating submission as payment success.
- Added copy-reference action.
- Locks submitted payment form fields after successful submission to reduce duplicate submissions.
- Existing server-side amount/catalog validation, Turnstile, duplicate UTR protection, pending-only workflow, and Admin verification remain unchanged.


## v61 authentication fix
- Admin and Student login Turnstile rendering now waits for the Cloudflare API instead of relying on a fixed startup delay.
- Login buttons remain disabled until a valid Turnstile token is available.
- Turnstile token is retrieved from the widget as a fallback immediately before authentication.
- Supabase password-grant request continues to send `gotrue_meta_security.captcha_token`.
- Main-page Admin/Student login links are cache-busted to v61.

## v62 Student Portal consolidation
- Combined **My Courses** and **Course Material** into a single **My Courses** area; curriculum access is now part of each course card.
- Corrected DevSecOps curriculum mapping so **Foundational** opens the foundational PDF and **Advanced** opens the advanced PDF instead of both opening the same curriculum.
- Hardened assigned-lab launching: valid trainer-provisioned URLs are launched through a validated HTTPS/HTTP handler; the site homepage is rejected as a lab destination; local labs without a provisioned URL open the local lab guide; browser labs use the verified browser-lab destination; AWS remains pending until provisioned.

## v63 updates
- Student Portal maps both DevSecOps/Application Security course variants to the single canonical DevSecOps curriculum.
- Local assigned lab now launches the one-click setup guide instead of attempting to open a nonexistent remote URL.
- Added `nextgen-devsecops-setup.sh` as the verified local lab installer referenced by the portal.
- Browser labs still use their assigned/verified browser URL; AWS labs require an Admin-provisioned URL.


## v64 changes
- Removed Activities from Student Portal navigation, UI, and data loading.
- Consolidated DevSecOps/Application Security curriculum to the single canonical curriculum.
- Local assigned lab now uses a verified one-command installer hosted at the same GitHub Pages site, with Copy and Download actions.
- Removed the prior multi-step local lab setup wording.


## v65 lab installer update

- The Local Lab is presented accurately as a one-command installer; a browser cannot execute shell commands directly on a student's OS.
- `student-portal/lab-guide.html` provides a copy-and-run command that downloads `nextgen-devsecops-setup.sh`, verifies its SHA-256, then executes it with sudo.
- Installer updated to Java 21 and the current Jenkins LTS RPM repository/signing key.
- Student Portal no longer contains Activities UI or activity messaging.
- Installer completion message now directs students back to My Assigned Labs.
- Installer SHA-256: `3d10bf3b5518b81a69bd197a76783c1a1a206d78b965fb7dbceded5afaa29766`


## v66 local lab fix
Local lab assignments always route to student-portal/lab-guide.html, regardless of stale access_url. Deploy installer and guide in the same commit. Test published script URL before running on a disposable VM. The browser cannot remotely install software on a student's machine.
