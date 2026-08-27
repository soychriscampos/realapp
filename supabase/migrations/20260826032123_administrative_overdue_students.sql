create or replace function public.administrative_overdue_students()
returns table (
    student_id uuid,
    overdue_amount numeric,
    overdue_charge_count bigint
)
language sql
security invoker
set search_path = ''
as $$
    select
        s.id as student_id,
        sum(b.outstanding_amount)::numeric as overdue_amount,
        count(*)::bigint as overdue_charge_count
    from public.students s
    cross join lateral public.student_charge_balances(s.id) b
    where b.is_overdue = true
      and b.outstanding_amount > 0
    group by s.id
    order by overdue_amount desc, s.id;
$$;

revoke all
on function public.administrative_overdue_students()
from public, anon;

grant execute
on function public.administrative_overdue_students()
to authenticated;