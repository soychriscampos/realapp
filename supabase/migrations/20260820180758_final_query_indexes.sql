-- ============================================================
-- M7 — Índices finales + corrección temporal reporting
-- ============================================================
--
-- Sólo se agregan índices respaldados por consultas reales:
--
-- 1. enrollment_events por enrollment + fecha
-- 2. enrollments por ciclo + fecha de ingreso
--
-- Los índices financieros principales ya existen.
--
-- Además:
-- M6.4 filtraba timestamptz con received_at::date.
-- Se reemplaza por rangos timestamptz en America/Mazatlan:
--
--   >= inicio local del día inicial
--   <  inicio local del día posterior al final
--
-- Esto:
--   - respeta la fecha operativa del colegio
--   - permite usar payments_received_at_idx
--   - permite usar payments_received_by_staff_date_idx
--
-- ============================================================


-- ============================================================
-- 1. ENROLLMENT EVENTS — reconstrucción as-of
-- ============================================================

create index if not exists
enrollment_events_enrollment_effective_idx
on public.enrollment_events (
    enrollment_id,
    effective_on desc,
    recorded_at desc,
    id desc
);


-- ============================================================
-- 2. ENROLLMENTS — reporting por ciclo / fecha
-- ============================================================

create index if not exists
enrollments_cycle_enrolled_on_idx
on public.enrollments (
    cycle_id,
    enrolled_on
);



-- ============================================================
-- 3. PAYMENT REPORTING — rango temporal local
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
declare
    v_from_ts timestamptz;
    v_to_exclusive_ts timestamptz;
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


    -- Calendar dates are interpreted in the school's
    -- operational timezone.

    v_from_ts :=
        p_from::timestamp
        at time zone 'America/Mazatlan';


    v_to_exclusive_ts :=
        (p_to + 1)::timestamp
        at time zone 'America/Mazatlan';


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

    where p.received_at >=
          v_from_ts

      and p.received_at <
          v_to_exclusive_ts

    order by
        p.received_at,
        p.id;

end;
$$;



-- ============================================================
-- 4. RECEIVER INCOME — rango temporal local
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

    v_from_ts timestamptz;
    v_to_exclusive_ts timestamptz;
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


    v_from_ts :=
        p_from::timestamp
        at time zone 'America/Mazatlan';


    v_to_exclusive_ts :=
        (p_to + 1)::timestamp
        at time zone 'America/Mazatlan';


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

          and p.received_at >=
              v_from_ts

          and p.received_at <
              v_to_exclusive_ts
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


-- ============================================================
-- FIN M7
-- ============================================================