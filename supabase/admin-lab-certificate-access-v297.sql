-- NextGen DevSecOps AI v297 — Admin lab revocation and access alignment
-- Apply in Supabase SQL Editor. Does not weaken the is_admin() MFA/AAL2 check.

GRANT SELECT, INSERT, UPDATE ON public.lab_assignments TO authenticated;

DROP POLICY IF EXISTS "Admins update lab assignments" ON public.lab_assignments;
CREATE POLICY "Admins update lab assignments"
ON public.lab_assignments
FOR UPDATE TO authenticated
USING (public.is_admin() = true)
WITH CHECK (public.is_admin() = true);

-- Admins may read all assignments; the existing admin ALL policy is retained.
-- Do not add a broad student UPDATE policy.

-- Ensure the admin course-removal action is allowed only to active admins.
GRANT SELECT, DELETE ON public.enrollments TO authenticated;
DROP POLICY IF EXISTS "Admins delete enrollments" ON public.enrollments;
CREATE POLICY "Admins delete enrollments"
ON public.enrollments
FOR DELETE TO authenticated
USING (public.is_admin() = true);
