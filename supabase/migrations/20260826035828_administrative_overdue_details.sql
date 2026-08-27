create or replace function public.administrative_overdue_details(
  p_cycle_id uuid default null
)
returns table (
  student_id uuid,
  student_name text,
  cycle_id uuid,
  cycle_code text,
  education_level_id uuid,
  education_level_name text,
  grade_level_id uuid,
  grade_name text,
  concept_code text,
  coverage_year integer,
  coverage_month integer,
  outstanding_amount numeric
)
language sql
security invoker
set search_path = ''
as $$
  select
    s.id as student_id,
    s.full_name as student_name,
    b.cycle_id,
    b.cycle_code,
    el.id as education_level_id,
    el.name as education_level_name,
    gl.id as grade_level_id,
    gl.name as grade_name,
    b.concept_code,
    b.coverage_year,
    b.coverage_month,
    b.outstanding_amount
  from public.students s
  cross join lateral public.student_charge_balances(s.id) b
  left join public.enrollments e
    on e.student_id = s.id
   and e.cycle_id = b.cycle_id
  left join public.grade_levels gl
    on gl.id = e.grade_level_id
  left join public.education_levels el
    on el.id = gl.education_level_id
  where b.is_overdue = true
    and b.outstanding_amount > 0
    and (
      p_cycle_id is null
      or b.cycle_id = p_cycle_id
    )
  order by
    s.full_name,
    b.due_date,
    b.charge_id;
$$;

revoke all
on function public.administrative_overdue_details(uuid)
from public, anon;

grant execute
on function public.administrative_overdue_details(uuid)
to authenticated;