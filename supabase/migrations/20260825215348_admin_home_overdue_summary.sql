-- H8.1 — Administrative home overdue summary
--
-- Purpose:
-- - expose overdue balances for students enrolled in a given cycle;
-- - reuse the canonical public.student_charge_balances() calculation;
-- - avoid duplicating financial balance logic in application code;
-- - support:
--     * overdue balance KPI
--     * overdue student count
--     * top debtors
--     * future full overdue-student view
--
-- Important:
-- This function intentionally does NOT recalculate effective balances from
-- charges/payment allocations/credits. public.student_charge_balances() is the
-- canonical source for those derived values.

create or replace function public.admin_home_overdue_summary(
    p_cycle_id uuid
)
returns table (
    student_id uuid,
    student_name text,
    enrollment_id uuid,
    grade_level_id uuid,
    grade_name text,
    group_id uuid,
    group_name text,
    overdue_amount numeric,
    overdue_charge_count bigint
)
language sql
stable
set search_path = ''
as $$
    select
        e.student_id,
        s.full_name as student_name,
        e.id as enrollment_id,
        e.grade_level_id,
        gl.name as grade_name,
        e.group_id,
        g.name as group_name,
        coalesce(sum(b.outstanding_amount), 0)::numeric as overdue_amount,
        count(*)::bigint as overdue_charge_count
    from public.enrollments e
    join public.students s
        on s.id = e.student_id
    join public.grade_levels gl
        on gl.id = e.grade_level_id
    left join public.groups g
        on g.id = e.group_id
    cross join lateral public.student_charge_balances(e.student_id) b
    where e.cycle_id = p_cycle_id
      and b.cycle_id = p_cycle_id
      and b.is_overdue = true
      and b.outstanding_amount > 0
    group by
        e.student_id,
        s.full_name,
        e.id,
        e.grade_level_id,
        gl.name,
        e.group_id,
        g.name
    having coalesce(sum(b.outstanding_amount), 0) > 0
    order by
        overdue_amount desc,
        s.full_name asc;
$$;

revoke all on function public.admin_home_overdue_summary(uuid) from public;
grant execute on function public.admin_home_overdue_summary(uuid) to authenticated;