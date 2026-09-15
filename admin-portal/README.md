# NextGen DevSecOps AI — Admin Portal README

## 1. Admin Account Requirements

The Admin Portal requires a Supabase Auth account with a matching profile:

- `role = 'admin'`
- `status = 'active'`

The browser should never contain the Supabase `service_role` key.

---

## 2. Student Data Structure

Student login email is stored in Supabase Auth:

- Table: `auth.users`
- Column: `email`

Student profile information is stored in:

- Table: `public.profiles`

Typical profile fields:

- `id`
- `full_name`
- `student_id`
- `phone`
- `role`
- `status`
- `created_at`

**Important:** `profiles.email` does not exist. To display a student's email, join `profiles` with `auth.users`.

---

## 3. Supabase Query — List All Students

Run this in:

**Supabase Dashboard → SQL Editor → New Query**

```sql
SELECT
    p.id,
    p.full_name,
    p.student_id,
    p.phone,
    u.email,
    p.role,
    p.status,
    p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'student'
ORDER BY p.created_at DESC;
```

This returns the students registered in the system together with their Auth email.

---

## 4. Recommended Admin RPC

For the Admin Portal, create the following secure RPC:

```sql
CREATE OR REPLACE FUNCTION public.admin_list_students_with_email()
RETURNS TABLE (
  id uuid,
  full_name text,
  student_id text,
  phone text,
  email text,
  role text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    p.id,
    p.full_name,
    p.student_id,
    p.phone,
    u.email,
    p.role,
    p.status,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE EXISTS (
    SELECT 1
    FROM public.profiles a
    WHERE a.id = auth.uid()
      AND a.role = 'admin'
      AND a.status = 'active'
  )
  AND p.role = 'student'
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL
ON FUNCTION public.admin_list_students_with_email()
FROM public;

GRANT EXECUTE
ON FUNCTION public.admin_list_students_with_email()
TO authenticated;
```

The Admin Portal can then call:

```javascript
const { data, error } =
  await client.rpc('admin_list_students_with_email');
```

---

## 5. Find a Student by Email

```sql
SELECT
    p.id,
    p.full_name,
    p.student_id,
    p.phone,
    p.role,
    p.status,
    u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE lower(u.email) = lower('STUDENT_EMAIL');
```

Replace `STUDENT_EMAIL` with the student's actual email.

---

## 6. Update Student Name

The student's name belongs in `public.profiles.full_name`.

Example:

```sql
UPDATE public.profiles p
SET full_name = 'ACTUAL STUDENT NAME'
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = lower('STUDENT_EMAIL');
```

Verify:

```sql
SELECT
    p.id,
    p.full_name,
    u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE lower(u.email) = lower('STUDENT_EMAIL');
```

The Admin Portal also provides an **Edit Name** action for updating `profiles.full_name`.

---

## 7. Activate / Deactivate Student

Activate:

```sql
UPDATE public.profiles
SET status = 'active'
WHERE id = 'STUDENT_PROFILE_UUID';
```

Deactivate:

```sql
UPDATE public.profiles
SET status = 'inactive'
WHERE id = 'STUDENT_PROFILE_UUID';
```

The Student Portal should allow access only when:

```text
role = student
status = active
```

---

## 8. Certificate Management

Certificates are stored in:

```text
public.certificates
```

Important fields:

- `id`
- `student_id`
- `course_id`
- `certificate_number`
- `file_path`
- `issued_at`

The certificate stores `student_id`, not the student's name.

The student's displayed name should be resolved from:

```text
public.profiles.full_name
```

The Admin Portal can issue certificates after course completion and trainer approval.

---

## 9. Certificate RLS

Run this in Supabase SQL Editor:

```sql
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students read own certificates"
ON public.certificates;

CREATE POLICY "students read own certificates"
ON public.certificates
FOR SELECT
TO authenticated
USING (
    student_id = auth.uid()
    AND public.is_active_student()
);

DROP POLICY IF EXISTS "admins manage certificates"
ON public.certificates;

CREATE POLICY "admins manage certificates"
ON public.certificates
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.certificates
TO authenticated;
```

This allows an active student to see certificates issued to that student's profile.

---

## 10. Student Invitation Flow

The Admin Portal uses the `invite-student` Supabase Edge Function.

Expected flow:

```text
Admin Portal
     ↓
Invite Student
     ↓
Supabase Edge Function
     ↓
Create / reuse Auth user
     ↓
Create student profile
     ↓
Create course enrollment
     ↓
Optional batch assignment
     ↓
Send invitation email
```

The Edge Function must use the server-side Supabase secret/service-role key.

**Never put the service-role key in:**

- GitHub Pages
- Student Portal
- Admin Portal JavaScript
- Android application
- Public repositories

---

## 11. Supabase Edge Function Secret

From the Supabase CLI:

```bash
supabase login

supabase link --project-ref hkpvigvtdckxhmnsvdrh

supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SECRET_KEY"

supabase secrets list

supabase functions deploy invite-student
```

Use the actual secret value from your Supabase project.

Do not commit the secret to Git.

---

## 12. Admin Security Model

Recommended access:

| Account | Role | Status | Access |
|---|---|---|---|
| Admin | admin | active | Admin Portal |
| Admin | admin | inactive | Denied |
| Student | student | active | Student Portal |
| Student | student | inactive | Denied |
| No profile | — | — | Denied |

The Admin Portal should verify the authenticated user's profile before allowing administrative operations.

---

## 13. Troubleshooting

### Students are not appearing

Check:

```sql
SELECT
    p.id,
    p.full_name,
    p.student_id,
    p.phone,
    p.role,
    p.status,
    u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'student';
```

Confirm that:

1. The Auth user exists.
2. A matching `profiles` row exists.
3. `profiles.id = auth.users.id`.
4. `profiles.role = 'student'`.
5. The Admin account has `role = 'admin'`.
6. The Admin account has `status = 'active'`.

### Student name shows "Student Name"

Update:

```sql
UPDATE public.profiles p
SET full_name = 'ACTUAL STUDENT NAME'
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = lower('STUDENT_EMAIL');
```

Then refresh the Admin Portal.

### Certificate cannot be issued

Check the `certificates` RLS policies and make sure the logged-in Admin profile satisfies:

```text
role = admin
status = active
```

### Certificate is issued but student cannot see it

Verify:

```sql
SELECT *
FROM public.certificates
WHERE student_id = 'STUDENT_PROFILE_UUID';
```

Then verify the student is logged in with the same Supabase Auth user whose UUID matches `certificates.student_id`.

---

## 14. Production Checklist

Before production use:

- [ ] Supabase Auth configured
- [ ] Admin profile created
- [ ] Admin status is `active`
- [ ] Admin role is `admin`
- [ ] Student profiles created correctly
- [ ] Student emails exist in `auth.users`
- [ ] Student names exist in `profiles.full_name`
- [ ] Student status is `active`
- [ ] `admin_list_students_with_email()` deployed
- [ ] Certificate RLS enabled
- [ ] Recording RLS enabled
- [ ] `invite-student` Edge Function deployed
- [ ] Service-role key stored only as an Edge Function secret
- [ ] No service-role key committed to GitHub
- [ ] Admin Portal tested
- [ ] Student Portal tested
- [ ] Certificate issuance tested
- [ ] Certificate visibility tested

---

## 15. Key Rule

**Do not query `profiles.email`.**

Use:

```text
profiles.full_name
profiles.student_id
profiles.phone
profiles.role
profiles.status
```

and obtain the login email from:

```text
auth.users.email
```

The recommended secure approach is the `admin_list_students_with_email()` RPC above.
