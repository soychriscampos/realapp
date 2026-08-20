-- ============================================================
-- M6.4 — Reporting canónico
-- ============================================================
--
-- Incluye:
--
-- 1. reports.income
--      permiso exclusivo MASTER para reporting institucional
--      de ingresos.
--
-- 2. enrollment_as_of(cycle, date)
--      reconstrucción de matrícula a una fecha.
--
-- 3. payment_reporting(from, to)
--      detalle institucional de pagos — MASTER.
--
-- 4. receiver_income(staff, from, to)
--      "Mis ingresos" para ADMIN;
--      cualquier receptor para MASTER.
--
-- IMPORTANTE HISTÓRICO:
-- enrollments migrados sin enrollment_events no permiten
-- reconstrucción temporal exacta.
--
-- enrollment_as_of devuelve history_quality:
--
--   EXACT_EVENTS
--   CURRENT_SNAPSHOT_ONLY
--
-- para que aplicación/reportes nunca presenten como exacta
-- una evolución histórica que la fuente no soporta.
--
-- ============================================================


-- ============================================================
-- 1. PERMISO REPORTING INSTITUCIONAL DE INGRESOS
-- ============================================================

insert into public.permissions (
    code,
    description
)
values (
    'reports.income',
    'View institutional income and payment reporting'
)
on conflict (code)
do update
set
    description =
        excluded.description,
    updated_at =
        statement_timestamp();


insert into public.role_permissions (
    role_id,
    permission_id,
    scope
)
select
    r.id,
    p.id,
    'ALL'

from public.roles r

join public.permissions p
  on p.code =
     'reports.income'

where r.code =
      'MASTER'

on conflict do nothing;



-- ============================================================
-- 2. MATRÍCULA AS OF
-- ============================================================

create or replace function
app_private.enrollment_as_of_internal(
    p_cycle_id uuid,
    p_as_of date
)
returns table (
    enrollment_id uuid,
    student_id uuid,
    student_code text,
    student_name text,
    sex text,

    cycle_id uuid,
    cycle_code text,

    education_level_id uuid,
    education_level_code text,
    education_level_name text,

    grade_level_id uuid,
    grade_code text,
    grade_name text,

    group_id uuid,

    classification_id uuid,
    classification_code text,
    classification_name text,

    counts_for_sep boolean,
    counts_for_campus boolean,

    status text,

    enrolled_on date,
    classes_start_on date,
    closed_on date,

    as_of date,

    history_quality text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin

    if p_cycle_id is null then
        raise exception
            'cycle_id is required';
    end if;


    if p_as_of is null then
        raise exception
            'as_of is required';
    end if;


    if not app_private.current_user_has_permission(
        'enrollments.view',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to view enrollment reporting';
    end if;


    if not exists (
        select 1
        from public.school_cycles sc
        where sc.id =
              p_cycle_id
    )
    then
        raise exception
            'School cycle not found';
    end if;


    return query

    with base as (
        select
            e.id
                as enrollment_id,

            e.student_id,
            e.cycle_id,
            e.grade_level_id,

            e.group_id
                as current_group_id,

            e.classification_id
                as current_classification_id,

            e.status
                as current_status,

            e.enrolled_on,
            e.classes_start_on,
            e.closed_on,

            exists (
                select 1
                from public.enrollment_events ev
                where ev.enrollment_id =
                      e.id
            )
                as has_events

        from public.enrollments e

        where e.cycle_id =
              p_cycle_id

          and e.enrolled_on <=
              p_as_of
    ),

    reconstructed as (
        select
            b.*,

            -- --------------------------------------------
            -- STATUS AS OF
            -- --------------------------------------------

            case

                when b.has_events then

                    coalesce(
                        (
                            select
                                ev.new_values ->> 'status'

                            from public.enrollment_events ev

                            where ev.enrollment_id =
                                  b.enrollment_id

                              and ev.effective_on <=
                                  p_as_of

                              and ev.new_values ? 'status'

                            order by
                                ev.effective_on desc,
                                ev.recorded_at desc,
                                ev.id desc

                            limit 1
                        ),

                        'PENDIENTE'
                    )

                else
                    b.current_status

            end
                as status_as_of,


            -- --------------------------------------------
            -- GROUP AS OF
            -- --------------------------------------------

            case

                when b.has_events then

                    coalesce(
                        (
                            select
                                nullif(
                                    ev.new_values ->> 'group_id',
                                    ''
                                )::uuid

                            from public.enrollment_events ev

                            where ev.enrollment_id =
                                  b.enrollment_id

                              and ev.effective_on <=
                                  p_as_of

                              and ev.new_values ? 'group_id'

                            order by
                                ev.effective_on desc,
                                ev.recorded_at desc,
                                ev.id desc

                            limit 1
                        ),

                        (
                            select
                                nullif(
                                    ev.new_values ->> 'group_id',
                                    ''
                                )::uuid

                            from public.enrollment_events ev

                            where ev.enrollment_id =
                                  b.enrollment_id

                              and ev.event_type =
                                  'ENROLLED'

                            order by
                                ev.effective_on,
                                ev.recorded_at,
                                ev.id

                            limit 1
                        )
                    )

                else
                    b.current_group_id

            end
                as group_as_of,


            -- --------------------------------------------
            -- CLASSIFICATION AS OF
            -- --------------------------------------------

            case

                when b.has_events then

                    coalesce(
                        (
                            select
                                nullif(
                                    ev.new_values ->> 'classification_id',
                                    ''
                                )::uuid

                            from public.enrollment_events ev

                            where ev.enrollment_id =
                                  b.enrollment_id

                              and ev.effective_on <=
                                  p_as_of

                              and ev.new_values ?
                                  'classification_id'

                            order by
                                ev.effective_on desc,
                                ev.recorded_at desc,
                                ev.id desc

                            limit 1
                        ),

                        (
                            select
                                nullif(
                                    ev.new_values ->>
                                    'classification_id',
                                    ''
                                )::uuid

                            from public.enrollment_events ev

                            where ev.enrollment_id =
                                  b.enrollment_id

                              and ev.event_type =
                                  'ENROLLED'

                            order by
                                ev.effective_on,
                                ev.recorded_at,
                                ev.id

                            limit 1
                        )
                    )

                else
                    b.current_classification_id

            end
                as classification_as_of

        from base b
    )

    select
        r.enrollment_id,

        s.id
            as student_id,

        s.student_code,

        s.full_name
            as student_name,

        s.sex,

        sc.id
            as cycle_id,

        sc.code
            as cycle_code,

        el.id
            as education_level_id,

        el.code
            as education_level_code,

        el.name
            as education_level_name,

        gl.id
            as grade_level_id,

        gl.code
            as grade_code,

        gl.name
            as grade_name,

        r.group_as_of,

        ec.id
            as classification_id,

        ec.code
            as classification_code,

        ec.name
            as classification_name,

        ec.counts_for_sep,
        ec.counts_for_campus,

        r.status_as_of,

        r.enrolled_on,
        r.classes_start_on,

        case
            when r.has_events
            then
                (
                    select
                        ev.effective_on

                    from public.enrollment_events ev

                    where ev.enrollment_id =
                          r.enrollment_id

                      and ev.effective_on <=
                          p_as_of

                      and ev.event_type in (
                          'WITHDRAWN',
                          'FINALIZED',
                          'MARKED_NO_CONTINUA',
                          'GRADUATED'
                      )

                    order by
                        ev.effective_on desc,
                        ev.recorded_at desc

                    limit 1
                )

            else
                r.closed_on

        end
            as closed_on,

        p_as_of
            as as_of,

        case
            when r.has_events
            then 'EXACT_EVENTS'
            else 'CURRENT_SNAPSHOT_ONLY'
        end::text
            as history_quality

    from reconstructed r

    join public.students s
      on s.id =
         r.student_id

    join public.school_cycles sc
      on sc.id =
         r.cycle_id

    join public.grade_levels gl
      on gl.id =
         r.grade_level_id

    join public.education_levels el
      on el.id =
         gl.education_level_id

    left join public.enrollment_classifications ec
      on ec.id =
         r.classification_as_of

    order by
        el.sort_order,
        gl.sort_order,
        s.full_name,
        s.id;

end;
$$;



revoke all
on function
app_private.enrollment_as_of_internal(
    uuid,
    date
)
from public, anon;


grant execute
on function
app_private.enrollment_as_of_internal(
    uuid,
    date
)
to authenticated;



create or replace function
public.enrollment_as_of(
    p_cycle_id uuid,
    p_as_of date
)
returns table (
    enrollment_id uuid,
    student_id uuid,
    student_code text,
    student_name text,
    sex text,

    cycle_id uuid,
    cycle_code text,

    education_level_id uuid,
    education_level_code text,
    education_level_name text,

    grade_level_id uuid,
    grade_code text,
    grade_name text,

    group_id uuid,

    classification_id uuid,
    classification_code text,
    classification_name text,

    counts_for_sep boolean,
    counts_for_campus boolean,

    status text,

    enrolled_on date,
    classes_start_on date,
    closed_on date,

    as_of date,

    history_quality text
)
language sql
stable
set search_path = ''
as $$
    select *
    from app_private.enrollment_as_of_internal(
        p_cycle_id,
        p_as_of
    );
$$;


revoke all
on function
public.enrollment_as_of(
    uuid,
    date
)
from public, anon;


grant execute
on function
public.enrollment_as_of(
    uuid,
    date
)
to authenticated;



-- ============================================================
-- 3. PAYMENT REPORTING — MASTER ONLY
-- ============================================================

create or replace function
app_private.payment_reporting_internal(
    p_from date,
    p_to date
)
returns table (
    payment_id uuid,
    payment_code text,

    student_id uuid,
    student_code text,
    student_name text,

    received_at timestamptz,

    gross_amount numeric,
    refunded_amount numeric,
    net_amount numeric,

    payment_status text,

    payment_method_id uuid,
    method_code text,
    method_name text,
    method_classification text,

    received_by_staff_id uuid,
    received_by_name text,

    captured_by_profile_id uuid,

    bank_reference text,

    active_allocated_amount numeric,
    active_credit_amount numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin

    if p_from is null
       or p_to is null
    then
        raise exception
            'from and to dates are required';
    end if;


    if p_to < p_from then
        raise exception
            'to date cannot precede from date';
    end if;


    if not app_private.current_user_has_permission(
        'reports.income',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to view institutional payment reporting';
    end if;


    return query

    select
        p.id,

        p.payment_code,

        s.id,

        s.student_code,

        s.full_name,

        p.received_at,

        p.amount::numeric
            as gross_amount,

        coalesce(
            (
                select sum(r.amount)

                from public.refunds r

                where r.payment_id =
                      p.id
            ),
            0
        )::numeric
            as refunded_amount,

        case
            when p.status =
                 'REVERSED'
            then 0::numeric

            else
                (
                    p.amount

                    -

                    coalesce(
                        (
                            select sum(r.amount)

                            from public.refunds r

                            where r.payment_id =
                                  p.id
                        ),
                        0
                    )
                )::numeric

        end
            as net_amount,

        p.status,

        p.payment_method_id,
        p.method,
        p.method_name_snapshot,
        p.method_classification_snapshot,

        p.received_by_staff_id,
        p.received_by_name_snapshot,

        p.captured_by_profile_id,

        p.bank_reference,

        coalesce(
            (
                select sum(pa.amount)

                from public.payment_allocations pa

                where pa.payment_id =
                      p.id

                  and pa.reversed_at is null
            ),
            0
        )::numeric
            as active_allocated_amount,

        coalesce(
            (
                select sum(
                    app_private.credit_available_balance(
                        cr.id
                    )
                )

                from public.credits cr

                where cr.source_payment_id =
                      p.id

                  and cr.status =
                      'ACTIVE'
            ),
            0
        )::numeric
            as active_credit_amount

    from public.payments p

    join public.students s
      on s.id =
         p.student_id

    where p.received_at::date
          between p_from and p_to

    order by
        p.received_at,
        p.id;

end;
$$;



revoke all
on function
app_private.payment_reporting_internal(
    date,
    date
)
from public, anon;


grant execute
on function
app_private.payment_reporting_internal(
    date,
    date
)
to authenticated;



create or replace function
public.payment_reporting(
    p_from date,
    p_to date
)
returns table (
    payment_id uuid,
    payment_code text,

    student_id uuid,
    student_code text,
    student_name text,

    received_at timestamptz,

    gross_amount numeric,
    refunded_amount numeric,
    net_amount numeric,

    payment_status text,

    payment_method_id uuid,
    method_code text,
    method_name text,
    method_classification text,

    received_by_staff_id uuid,
    received_by_name text,

    captured_by_profile_id uuid,

    bank_reference text,

    active_allocated_amount numeric,
    active_credit_amount numeric
)
language sql
stable
set search_path = ''
as $$
    select *
    from app_private.payment_reporting_internal(
        p_from,
        p_to
    );
$$;


revoke all
on function
public.payment_reporting(
    date,
    date
)
from public, anon;


grant execute
on function
public.payment_reporting(
    date,
    date
)
to authenticated;



-- ============================================================
-- 4. INGRESOS POR RECEPTOR
-- ============================================================
--
-- ADMIN:
--   sólo puede consultar su propio staff_id.
--
-- MASTER:
--   puede consultar cualquier receptor.
--
-- Se usa received_by_staff_id, NO captured_by_profile_id.
--
-- ============================================================

create or replace function
app_private.receiver_income_internal(
    p_staff_id uuid,
    p_from date,
    p_to date
)
returns table (
    staff_id uuid,
    staff_name text,

    payment_count bigint,

    gross_amount numeric,
    refunded_amount numeric,
    net_amount numeric,

    cash_like_amount numeric,
    in_kind_amount numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_current_staff_id uuid;
begin

    if p_staff_id is null then
        raise exception
            'staff_id is required';
    end if;


    if p_from is null
       or p_to is null
    then
        raise exception
            'from and to dates are required';
    end if;


    if p_to < p_from then
        raise exception
            'to date cannot precede from date';
    end if;


    v_current_staff_id :=
        app_private.current_staff_id();


    if not (
        app_private.current_user_has_permission(
            'reports.income',
            'ALL'
        )

        or

        (
            v_current_staff_id is not null
            and
            v_current_staff_id =
            p_staff_id
        )
    )
    then
        raise exception
            'Insufficient permission to view receiver income';
    end if;


    if not exists (
        select 1
        from public.staff st
        where st.id =
              p_staff_id
    )
    then
        raise exception
            'Staff not found';
    end if;


    return query

    with receiver_payments as (
        select
            p.*,

            coalesce(
                (
                    select sum(r.amount)

                    from public.refunds r

                    where r.payment_id =
                          p.id
                ),
                0
            )::numeric
                as refunded_amount,

            case
                when p.status =
                     'REVERSED'
                then 0::numeric

                else
                    (
                        p.amount

                        -

                        coalesce(
                            (
                                select sum(r.amount)

                                from public.refunds r

                                where r.payment_id =
                                      p.id
                            ),
                            0
                        )
                    )::numeric

            end
                as net_amount

        from public.payments p

        where p.received_by_staff_id =
              p_staff_id

          and p.received_at::date
              between p_from and p_to
    )

    select
        st.id,

        st.full_name,

        count(rp.id)::bigint,

        coalesce(
            sum(rp.amount),
            0
        )::numeric
            as gross_amount,

        coalesce(
            sum(rp.refunded_amount),
            0
        )::numeric
            as refunded_amount,

        coalesce(
            sum(rp.net_amount),
            0
        )::numeric
            as net_amount,

        coalesce(
            sum(
                case
                    when rp.method_classification_snapshot
                         <> 'IN_KIND'
                    then rp.net_amount
                    else 0
                end
            ),
            0
        )::numeric
            as cash_like_amount,

        coalesce(
            sum(
                case
                    when rp.method_classification_snapshot =
                         'IN_KIND'
                    then rp.net_amount
                    else 0
                end
            ),
            0
        )::numeric
            as in_kind_amount

    from public.staff st

    left join receiver_payments rp
      on true

    where st.id =
          p_staff_id

    group by
        st.id,
        st.full_name;

end;
$$;



revoke all
on function
app_private.receiver_income_internal(
    uuid,
    date,
    date
)
from public, anon;


grant execute
on function
app_private.receiver_income_internal(
    uuid,
    date,
    date
)
to authenticated;



create or replace function
public.receiver_income(
    p_staff_id uuid,
    p_from date,
    p_to date
)
returns table (
    staff_id uuid,
    staff_name text,

    payment_count bigint,

    gross_amount numeric,
    refunded_amount numeric,
    net_amount numeric,

    cash_like_amount numeric,
    in_kind_amount numeric
)
language sql
stable
set search_path = ''
as $$
    select *
    from app_private.receiver_income_internal(
        p_staff_id,
        p_from,
        p_to
    );
$$;


revoke all
on function
public.receiver_income(
    uuid,
    date,
    date
)
from public, anon;


grant execute
on function
public.receiver_income(
    uuid,
    date,
    date
)
to authenticated;


-- ============================================================
-- FIN M6.4
-- ============================================================