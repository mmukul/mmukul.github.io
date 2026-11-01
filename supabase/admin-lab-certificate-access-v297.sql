-- NextGen DevSecOps AI v297.2 — Admin lab assignment, revocation and access policies
-- Run in Supabase SQL Editor as database owner. Safe to re-run.
-- Keeps the public.is_admin() AAL2/MFA requirement; does not grant student writes.

ALTER TABLE public.lab_assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_assignments TO authenticated;

-- Older schema.sql versions allowed only assigned/active/inactive/expired.
-- The Admin Portal records removal as status='revoked'. Align the CHECK constraint.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.lab_assignments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.lab_assignments DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.lab_assignments
  ADD CONSTRAINT lab_assignments_status_check
  CHECK (status IN ('assigned','active','inactive','revoked','completed','expired'));

-- Remove older broad/partial admin policies and replace them with explicit actions.
DROP POLICY IF EXISTS "Admins manage lab assignments" ON public.lab_assignments;
DROP POLICY IF EXISTS "admins manage lab assignments" ON public.lab_assignments;
DROP POLICY IF EXISTS "Admins update lab assignments" ON public.lab_assignments;
DROP POLICY IF EXISTS "Admins insert lab assignments" ON public.lab_assignments;
DROP POLICY IF EXISTS "Admins delete lab assignments" ON public.lab_assignments;
DROP POLICY IF EXISTS "Admins read all lab assignments" ON public.lab_assignments;

CREATE POLICY "Admins read all lab assignments"
  ON public.lab_assignments FOR SELECT TO authenticated
  USING (public.is_admin() = true);

CREATE POLICY "Admins insert lab assignments"
  ON public.lab_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() = true);

CREATE POLICY "Admins update lab assignments"
  ON public.lab_assignments FOR UPDATE TO authenticated
  USING (public.is_admin() = true)
  WITH CHECK (public.is_admin() = true);

CREATE POLICY "Admins delete lab assignments"
  ON public.lab_assignments FOR DELETE TO authenticated
  USING (public.is_admin() = true);

-- Preserve student read-only access to their own non-revoked, non-expired labs.
DROP POLICY IF EXISTS "Students read own active labs" ON public.lab_assignments;
DROP POLICY IF EXISTS "students read own lab assignments" ON public.lab_assignments;
CREATE POLICY "Students read own active labs"
  ON public.lab_assignments FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    AND status IN ('assigned','active')
    AND (expires_at IS NULL OR expires_at > now())
    AND public.is_active_student() = true
  );

COMMENT ON TABLE public.lab_assignments IS
  'Student lab assignments. Admin writes require public.is_admin() (active admin with MFA AAL2); students can read only their own active, unexpired assignments.';
