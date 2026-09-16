-- NextGen DevSecOps AI — 2026-09-16 Admin Course Assignment RLS Fix
-- Run this in Supabase SQL Editor for an existing production database.

create or replace function public.admin_assign_course(
  target_student_id uuid,
  target_course_id uuid,
  target_batch_id uuid default null,
  target_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare existing_id uuid; result_id uuid;
begin
  if not public.is_admin() then raise exception 'Only active administrators can assign courses.'; end if;
  if target_status not in ('active','completed','cancelled') then raise exception 'Invalid enrollment status: %', target_status; end if;
  if not exists (select 1 from public.profiles where id=target_student_id and role='student' and status='active') then raise exception 'Target account is not an active student.'; end if;
  if not exists (select 1 from public.courses where id=target_course_id) then raise exception 'Course not found.'; end if;
  if target_batch_id is not null and not exists (select 1 from public.batches where id=target_batch_id and (course_id=target_course_id or course_id is null)) then raise exception 'Selected batch does not belong to the selected course.'; end if;

  select e.id into existing_id from public.enrollments e
  where e.student_id=target_student_id and e.course_id=target_course_id
  order by e.enrolled_at desc limit 1;

  if existing_id is not null then
    update public.enrollments set batch_id=target_batch_id,status=target_status
    where id=existing_id returning id into result_id;
  else
    insert into public.enrollments(student_id,course_id,batch_id,status)
    values(target_student_id,target_course_id,target_batch_id,target_status)
    returning id into result_id;
  end if;
  return result_id;
end;
$$;

revoke all on function public.admin_assign_course(uuid,uuid,uuid,text) from public;
grant execute on function public.admin_assign_course(uuid,uuid,uuid,text) to authenticated;
