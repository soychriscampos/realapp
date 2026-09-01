-- Reporte administrativo: valor contractual mensual de matrícula.
-- Este reporte no utiliza pagos, saldos ni cargos para determinar valores.

create or replace function app_private.tuition_value_reporting_internal(
    p_cycle_id uuid,
    p_as_of date,
    p_education_level_id uuid default null
)
returns table (
    snapshot_date date,
    snapshot_kind text,
    enrollment_id uuid,
    student_id uuid,
    education_level_id uuid,
    education_level_name text,
    grade_level_id uuid,
    grade_name text,
    status text,
    price_list numeric,
    effective_value numeric,
    benefit_value numeric,
    benefit_category_id uuid,
    benefit_category_name text,
    history_quality text,
    has_financial_agreement boolean,
    included_in_metrics boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if p_cycle_id is null or p_as_of is null then
        raise exception 'cycle_id and as_of are required';
    end if;

    if not app_private.current_user_has_permission('enrollments.view', 'ALL') then
        raise exception 'Insufficient permission to view tuition value reporting';
    end if;

    if not exists (select 1 from public.school_cycles where id = p_cycle_id) then
        raise exception 'School cycle not found';
    end if;

    return query
    with cycle_scope as (
        select sc.starts_on, sc.ends_on, sc.status,
               least(sc.ends_on, p_as_of) as last_date
        from public.school_cycles sc
        where sc.id = p_cycle_id
    ),
    cuts as (
        select p_as_of as snapshot_date, 'CURRENT'::text as snapshot_kind
        union
        select (date_trunc('month', month_start) + interval '1 month - 1 day')::date,
               'MONTHLY'::text
        from cycle_scope cs
        cross join lateral generate_series(
            date_trunc('month', cs.starts_on)::date,
            date_trunc('month', cs.last_date)::date,
            interval '1 month'
        ) as months(month_start)
        where cs.last_date >= cs.starts_on
          and (date_trunc('month', month_start) + interval '1 month - 1 day')::date <= cs.last_date
    ),
    enrollment_base as (
        select e.id as enrollment_id, e.student_id, e.cycle_id,
               e.grade_level_id as current_grade_level_id,
               e.group_id as current_group_id,
               e.classification_id as current_classification_id,
               e.status as current_status, e.enrolled_on,
               exists (
                   select 1 from public.enrollment_events ev
                   where ev.enrollment_id = e.id
                     and ev.event_type = 'ENROLLED'
               ) as has_initial_event
        from public.enrollments e
        where e.cycle_id = p_cycle_id
          and e.enrolled_on <= p_as_of
    ),
    snapshots as (
        select c.snapshot_date, c.snapshot_kind, eb.*,
               case
                   when c.snapshot_kind = 'CURRENT' then eb.current_status
                   when eb.has_initial_event then coalesce((
                       select ev.new_values ->> 'status'
                       from public.enrollment_events ev
                       where ev.enrollment_id = eb.enrollment_id
                         and ev.effective_on <= c.snapshot_date
                         and ev.new_values ? 'status'
                       order by ev.effective_on desc, ev.recorded_at desc, ev.id desc
                       limit 1
                   ), 'PENDIENTE')
                   else eb.current_status
               end as status_as_of,
               case
                   when c.snapshot_kind = 'CURRENT' then eb.current_grade_level_id
                   when eb.has_initial_event then coalesce((
                       select nullif(ev.new_values ->> 'grade_level_id', '')::uuid
                       from public.enrollment_events ev
                       where ev.enrollment_id = eb.enrollment_id
                         and ev.effective_on <= c.snapshot_date
                         and ev.new_values ? 'grade_level_id'
                       order by ev.effective_on desc, ev.recorded_at desc, ev.id desc
                       limit 1
                   ), (
                       select nullif(ev.new_values ->> 'grade_level_id', '')::uuid
                       from public.enrollment_events ev
                       where ev.enrollment_id = eb.enrollment_id
                         and ev.event_type = 'ENROLLED'
                         and ev.new_values ? 'grade_level_id'
                       order by ev.effective_on, ev.recorded_at, ev.id
                       limit 1
                   ), eb.current_grade_level_id)
                   else eb.current_grade_level_id
               end as grade_level_as_of,
               case
                   when c.snapshot_kind = 'CURRENT' then eb.current_group_id
                   when eb.has_initial_event then coalesce((
                       select nullif(ev.new_values ->> 'group_id', '')::uuid
                       from public.enrollment_events ev
                       where ev.enrollment_id = eb.enrollment_id
                         and ev.effective_on <= c.snapshot_date
                         and ev.new_values ? 'group_id'
                       order by ev.effective_on desc, ev.recorded_at desc, ev.id desc
                       limit 1
                   ), (
                       select nullif(ev.new_values ->> 'group_id', '')::uuid
                       from public.enrollment_events ev
                       where ev.enrollment_id = eb.enrollment_id
                         and ev.event_type = 'ENROLLED'
                         and ev.new_values ? 'group_id'
                       order by ev.effective_on, ev.recorded_at, ev.id
                       limit 1
                   ), eb.current_group_id)
                   else eb.current_group_id
               end as group_as_of
        from cuts c
        cross join enrollment_base eb
        cross join cycle_scope cs
        where (
            eb.has_initial_event
            or (
                c.snapshot_kind = 'CURRENT'
                and cs.status in ('PREPARATION', 'ACTIVE')
                and p_as_of = (now() at time zone 'America/Mazatlan')::date
            )
        )
    ),
    quality_markers as (
        select distinct c.snapshot_date
        from cuts c
        cross join enrollment_base eb
        left join public.grade_levels current_grade
          on current_grade.id = eb.current_grade_level_id
        where c.snapshot_kind = 'MONTHLY'
          and not eb.has_initial_event
          and eb.enrolled_on <= c.snapshot_date
          and (p_education_level_id is null or current_grade.education_level_id = p_education_level_id)
    )
    , report_rows as (
    select s.snapshot_date,
           s.snapshot_kind,
           s.enrollment_id,
           s.student_id,
           el.id as education_level_id,
           el.name as education_level_name,
           gl.id as grade_level_id,
           gl.name as grade_name,
           s.status_as_of as status,
           agreement.base_amount_snapshot as price_list,
           agreement.agreed_amount as effective_value,
           coalesce(agreement.reduction_amount_snapshot,
                    greatest(agreement.base_amount_snapshot - agreement.agreed_amount, 0)) as benefit_value,
           category.id as benefit_category_id,
           category.name as benefit_category_name,
           case
               when not s.has_initial_event then 'CURRENT_SNAPSHOT_ONLY'
               when agreement.id is null then 'PARTIAL'
               when not exists (
                   select 1 from public.enrollment_events ev
                   where ev.enrollment_id = s.enrollment_id
                     and ev.effective_on <= s.snapshot_date
                     and (ev.new_values ? 'grade_level_id' or ev.event_type = 'ENROLLED')
               ) then 'PARTIAL'
               when agreement.reduction_amount_snapshot is not null
                    and abs(agreement.reduction_amount_snapshot -
                        greatest(agreement.base_amount_snapshot - agreement.agreed_amount, 0)) > 0.01
                    then 'PARTIAL'
               else 'EXACT_EVENTS'
           end,
           agreement.id is not null as has_financial_agreement,
           true as included_in_metrics
    from snapshots s
    left join public.grade_levels gl on gl.id = s.grade_level_as_of
    left join public.education_levels el on el.id = gl.education_level_id
    left join lateral (
        select sfa.id, sfa.base_amount_snapshot, sfa.agreed_amount,
               sfa.reduction_amount_snapshot, sfa.discount_category_version_id
        from public.student_financial_agreements sfa
        join public.financial_concepts fc on fc.id = sfa.financial_concept_id
        where sfa.enrollment_id = s.enrollment_id
          and fc.code = 'TUITION'
          and (
              (
                  not s.has_initial_event
                  and s.snapshot_kind = 'CURRENT'
                  and sfa.valid_until is null
              )
              or (
                  s.has_initial_event
                  and sfa.valid_from <= s.snapshot_date
                  and (sfa.valid_until is null or sfa.valid_until >= s.snapshot_date)
              )
          )
        order by sfa.valid_from desc, sfa.created_at desc, sfa.id desc
        limit 1
    ) agreement on true
    left join public.tuition_discount_category_versions version
      on version.id = agreement.discount_category_version_id
    left join public.tuition_discount_categories category
      on category.id = version.category_id
    where s.status_as_of = 'ACTIVA'
      and (p_education_level_id is null or el.id = p_education_level_id)
    union all
    select qm.snapshot_date,
           'MONTHLY',
           null::uuid,
           null::uuid,
           null::uuid,
           null::text,
           null::uuid,
           null::text,
           'HISTORICAL_UNKNOWN',
           null::numeric,
           null::numeric,
           null::numeric,
           null::uuid,
           null::text,
           'CURRENT_SNAPSHOT_ONLY',
           false,
           false
    from quality_markers qm
    )
    select * from report_rows
    order by snapshot_date, education_level_name, grade_name, enrollment_id;
end;
$$;

revoke all on function app_private.tuition_value_reporting_internal(uuid, date, uuid)
from public, anon;
grant execute on function app_private.tuition_value_reporting_internal(uuid, date, uuid)
to authenticated;

create or replace function public.tuition_value_reporting(
    p_cycle_id uuid,
    p_as_of date,
    p_education_level_id uuid default null
)
returns table (
    snapshot_date date,
    snapshot_kind text,
    enrollment_id uuid,
    student_id uuid,
    education_level_id uuid,
    education_level_name text,
    grade_level_id uuid,
    grade_name text,
    status text,
    price_list numeric,
    effective_value numeric,
    benefit_value numeric,
    benefit_category_id uuid,
    benefit_category_name text,
    history_quality text,
    has_financial_agreement boolean,
    included_in_metrics boolean
)
language sql
stable
set search_path = ''
as $$
    select * from app_private.tuition_value_reporting_internal(
        p_cycle_id, p_as_of, p_education_level_id
    );
$$;

revoke all on function public.tuition_value_reporting(uuid, date, uuid)
from public, anon;
grant execute on function public.tuition_value_reporting(uuid, date, uuid)
to authenticated;
