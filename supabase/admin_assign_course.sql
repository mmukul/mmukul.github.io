-- NextGen DevSecOps AI
-- Admin Course Assignment RPC
-- Run this once in Supabase SQL Editor.
--
-- Purpose:
--   Lets an authenticated active admin assign/update a course for a student
--   without relying on browser-side INSERT/UPDATE privileges on enrollments.
--
-- Security:
--   SECURITY DEFINER is used only for this narrowly scoped admin operation.
--   The function verifies public.is_admin() before changing data.
--   No service-role key is exposed to the browser.

create or replace function public.admin_assign_course(
  p_student_id uuid,
  p_course_id uuid,
  p_batch_id uuid default null,
  p_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment_id uuid;
begin
  -- Only an active administrator may call this operation.
  if not public.is_admin() then
    raise exception 'Only an active administrator can assign courses.';
  end if;

  -- Validate status explicitly.
  if p_status not in ('active', 'completed', 'cancelled') then
    raise exception 'Invalid enrollment status: %. Use active, completed, or cancelled.', p_status;
  end if;

  -- Student must exist and have the student role.
  if not exists (
    select 1
    from public.profiles
    where id = p_student_id
      and lower(trim(role)) = 'student'
  ) then
    raise exception 'Student profile was not found or is not a student account.';
  end if;

  -- Course must exist.
  if not exists (
    select 1
    from public.courses
    where id = p_course_id
  ) then
    raise exception 'Selected course does not exist.';
  end if;

  -- If a batch was selected, make sure it belongs to the selected course.
  if p_batch_id is not null and not exists (
    select 1
    from public.batches
    where id = p_batch_id
      and course_id = p_course_id
  ) then
    raise exception 'Selected batch does not belong to the selected course.';
  end if;

  -- Reuse the newest existing enrollment for this student/course.
  select e.id
    into v_enrollment_id
  from public.enrollments e
  where e.student_id = p_student_id
    and e.course_id = p_course_id
  order by e.enrolled_at desc
  limit 1;

  if v_enrollment_id is not null then
    update public.enrollments
       set batch_id = p_batch_id,
           status = p_status
     where id = v_enrollment_id;

    return v_enrollment_id;
  end if;

  insert into public.enrollments (
    student_id,
    course_id,
    batch_id,
    status
  )
  values (
    p_student_id,
    p_course_id,
    p_batch_id,
    p_status
  )
  returning id into v_enrollment_id;

  return v_enrollment_id;
end;
$$;

revoke all on function public.admin_assign_course(uuid, uuid, uuid, text)
from public;

grant execute on function public.admin_assign_course(uuid, uuid, uuid, text)
to authenticated;
