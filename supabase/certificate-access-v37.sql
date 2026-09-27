-- NextGen DevSecOps AI — Certificate access/issuance migration v37
-- Run once in Supabase SQL Editor on an existing production database.
-- Issued certificates are standalone credentials; enrollment is not required
-- to issue or later view a certificate owned by the signed-in student.

drop policy if exists "students read own certificates" on public.certificates;
create policy "students read own certificates"
on public.certificates for select to authenticated
using (student_id = auth.uid() and public.is_active_student());
