-- ============================================================
-- M6.3 — Estado de cuenta canónico del alumno
-- ============================================================
--
-- Fuentes:
--   charges
--   charge_adjustments
--   payment_allocations
--   payments
--   credit_applications
--   credits
--   refunds
--   payment_reversals
--
-- No persiste balances.
--
-- Expone:
--   1. student_charge_balances(student_id)
--   2. student_account_summary(student_id)
--   3. student_account_movements(student_id)
--
-- Acceso:
--   app_private.current_user_can_view_student_finance(...)
--
-- ============================================================


-- ============================================================
-- 1. DETALLE CANÓNICO POR CARGO
-- ============================================================

create or replace function
app_private.student_charge_balances_internal(
    p_student_id uuid
)
returns table (
    charge_id uuid,
    enrollment_id uuid,
    cycle_id uuid,
    cycle_code text,

    financial_concept_id uuid,
    concept_code text,
    concept_name text,

    coverage_year smallint,
    coverage_month smallint,

    due_date date,
    origin text,

    original_amount numeric,
    adjustment_amount numeric,
    effective_amount numeric,

    payment_applied numeric,
    credit_applied numeric,
    total_applied numeric,

    outstanding_amount numeric,

    is_paid boolean,
    is_overdue boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin

    if p_student_id is null then
        raise exception
            'student_id is required';
    end if;


    if not app_private.current_user_can_view_student_finance(
        p_student_id
    )
    then
        raise exception
            'Insufficient permission to view student finance';
    end if;


    return query

    with adjustment_totals as (
        select
            ca.charge_id,
            sum(ca.amount)::numeric
                as amount

        from public.charge_adjustments ca

        group by ca.charge_id
    ),

    payment_totals as (
        select
            pa.charge_id,
            sum(pa.amount)::numeric
                as amount

        from public.payment_allocations pa

        join public.payments p
          on p.id =
             pa.payment_id

        where pa.reversed_at is null
          and p.status =
              'CONFIRMED'

        group by pa.charge_id
    ),

    credit_totals as (
        select
            ca.charge_id,
            sum(ca.amount)::numeric
                as amount

        from public.credit_applications ca

        join public.credits cr
          on cr.id =
             ca.credit_id

        where ca.reversed_at is null
          and cr.status =
              'ACTIVE'

        group by ca.charge_id
    ),

    calculated as (
        select
            c.id
                as charge_id,

            c.enrollment_id,
            c.cycle_id,

            sc.code
                as cycle_code,

            c.financial_concept_id,

            fc.code
                as concept_code,

            fc.name
                as concept_name,

            c.coverage_year,
            c.coverage_month,

            c.due_date,
            c.origin,

            c.original_amount,

            coalesce(
                at.amount,
                0
            )::numeric
                as adjustment_amount,

            (
                c.original_amount
                +
                coalesce(
                    at.amount,
                    0
                )
            )::numeric
                as effective_amount,

            coalesce(
                pt.amount,
                0
            )::numeric
                as payment_applied,

            coalesce(
                ct.amount,
                0
            )::numeric
                as credit_applied

        from public.charges c

        join public.financial_concepts fc
          on fc.id =
             c.financial_concept_id

        left join public.school_cycles sc
          on sc.id =
             c.cycle_id

        left join adjustment_totals at
          on at.charge_id =
             c.id

        left join payment_totals pt
          on pt.charge_id =
             c.id

        left join credit_totals ct
          on ct.charge_id =
             c.id

        where c.student_id =
              p_student_id

          and c.status =
              'ACTIVE'
    )

    select
        x.charge_id,
        x.enrollment_id,
        x.cycle_id,
        x.cycle_code,

        x.financial_concept_id,
        x.concept_code,
        x.concept_name,

        x.coverage_year,
        x.coverage_month,

        x.due_date,
        x.origin,

        x.original_amount,
        x.adjustment_amount,
        x.effective_amount,

        x.payment_applied,
        x.credit_applied,

        (
            x.payment_applied
            +
            x.credit_applied
        )::numeric
            as total_applied,

        greatest(
            x.effective_amount
            -
            x.payment_applied
            -
            x.credit_applied,
            0
        )::numeric
            as outstanding_amount,

        (
            greatest(
                x.effective_amount
                -
                x.payment_applied
                -
                x.credit_applied,
                0
            ) = 0
        )
            as is_paid,

        (
            x.due_date < current_date

            and

            greatest(
                x.effective_amount
                -
                x.payment_applied
                -
                x.credit_applied,
                0
            ) > 0
        )
            as is_overdue

    from calculated x

    order by
        x.due_date,
        x.coverage_year,
        x.coverage_month,
        x.charge_id;

end;
$$;



revoke all
on function
app_private.student_charge_balances_internal(uuid)
from public, anon;


grant execute
on function
app_private.student_charge_balances_internal(uuid)
to authenticated;



create or replace function
public.student_charge_balances(
    p_student_id uuid
)
returns table (
    charge_id uuid,
    enrollment_id uuid,
    cycle_id uuid,
    cycle_code text,

    financial_concept_id uuid,
    concept_code text,
    concept_name text,

    coverage_year smallint,
    coverage_month smallint,

    due_date date,
    origin text,

    original_amount numeric,
    adjustment_amount numeric,
    effective_amount numeric,

    payment_applied numeric,
    credit_applied numeric,
    total_applied numeric,

    outstanding_amount numeric,

    is_paid boolean,
    is_overdue boolean
)
language sql
stable
set search_path = ''
as $$
    select *
    from app_private.student_charge_balances_internal(
        p_student_id
    );
$$;


revoke all
on function
public.student_charge_balances(uuid)
from public, anon;


grant execute
on function
public.student_charge_balances(uuid)
to authenticated;



-- ============================================================
-- 2. RESUMEN CANÓNICO DEL ESTADO DE CUENTA
-- ============================================================

create or replace function
app_private.student_account_summary_internal(
    p_student_id uuid
)
returns table (
    student_id uuid,

    active_charge_count bigint,

    original_charge_total numeric,
    adjustment_total numeric,
    effective_charge_total numeric,

    payment_applied_total numeric,
    credit_applied_total numeric,

    outstanding_total numeric,
    overdue_total numeric,

    overdue_charge_count bigint,

    available_credit numeric,

    is_current boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin

    if p_student_id is null then
        raise exception
            'student_id is required';
    end if;


    if not app_private.current_user_can_view_student_finance(
        p_student_id
    )
    then
        raise exception
            'Insufficient permission to view student finance';
    end if;


    return query

    with balances as (
        select *
        from app_private.student_charge_balances_internal(
            p_student_id
        )
    ),

    charge_summary as (
        select
            count(*)::bigint
                as active_charge_count,

            coalesce(
                sum(original_amount),
                0
            )::numeric
                as original_charge_total,

            coalesce(
                sum(adjustment_amount),
                0
            )::numeric
                as adjustment_total,

            coalesce(
                sum(effective_amount),
                0
            )::numeric
                as effective_charge_total,

            coalesce(
                sum(payment_applied),
                0
            )::numeric
                as payment_applied_total,

            coalesce(
                sum(credit_applied),
                0
            )::numeric
                as credit_applied_total,

            coalesce(
                sum(outstanding_amount),
                0
            )::numeric
                as outstanding_total,

            coalesce(
                sum(
                    case
                        when is_overdue
                        then outstanding_amount
                        else 0
                    end
                ),
                0
            )::numeric
                as overdue_total,

            count(*) filter (
                where is_overdue
            )::bigint
                as overdue_charge_count

        from balances
    ),

    credit_summary as (
        select
            coalesce(
                sum(
                    app_private.credit_available_balance(
                        cr.id
                    )
                ),
                0
            )::numeric
                as available_credit

        from public.credits cr

        where cr.student_id =
              p_student_id

          and cr.status =
              'ACTIVE'
    )

    select
        p_student_id,

        cs.active_charge_count,

        cs.original_charge_total,
        cs.adjustment_total,
        cs.effective_charge_total,

        cs.payment_applied_total,
        cs.credit_applied_total,

        cs.outstanding_total,
        cs.overdue_total,

        cs.overdue_charge_count,

        crs.available_credit,

        (
            cs.overdue_total = 0
        )
            as is_current

    from charge_summary cs
    cross join credit_summary crs;

end;
$$;



revoke all
on function
app_private.student_account_summary_internal(uuid)
from public, anon;


grant execute
on function
app_private.student_account_summary_internal(uuid)
to authenticated;



create or replace function
public.student_account_summary(
    p_student_id uuid
)
returns table (
    student_id uuid,

    active_charge_count bigint,

    original_charge_total numeric,
    adjustment_total numeric,
    effective_charge_total numeric,

    payment_applied_total numeric,
    credit_applied_total numeric,

    outstanding_total numeric,
    overdue_total numeric,

    overdue_charge_count bigint,

    available_credit numeric,

    is_current boolean
)
language sql
stable
set search_path = ''
as $$
    select *
    from app_private.student_account_summary_internal(
        p_student_id
    );
$$;


revoke all
on function
public.student_account_summary(uuid)
from public, anon;


grant execute
on function
public.student_account_summary(uuid)
to authenticated;



-- ============================================================
-- 3. MOVIMIENTOS CRONOLÓGICOS DEL ESTADO DE CUENTA
-- ============================================================
--
-- debit:
--   aumenta obligación / revierte dinero recibido
--
-- credit:
--   reduce posición financiera / pago / devolución negativa
--
-- Una aplicación de crédito no aparece aquí porque no cambia
-- la posición financiera total del alumno; sólo distribuye un
-- crédito ya existente hacia un cargo.
--
-- El detalle de aplicación sí está en student_charge_balances.
-- ============================================================

create or replace function
app_private.student_account_movements_internal(
    p_student_id uuid
)
returns table (
    movement_on date,
    recorded_at timestamptz,

    movement_type text,

    reference_id uuid,
    parent_reference_id uuid,

    cycle_id uuid,
    financial_concept_id uuid,

    concept_code text,
    description text,

    debit numeric,
    credit numeric,

    status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin

    if p_student_id is null then
        raise exception
            'student_id is required';
    end if;


    if not app_private.current_user_can_view_student_finance(
        p_student_id
    )
    then
        raise exception
            'Insufficient permission to view student finance';
    end if;


    return query


    -- ========================================================
    -- CHARGES
    -- ========================================================

    select
        c.due_date
            as movement_on,

        c.created_at
            as recorded_at,

        'CHARGE'::text
            as movement_type,

        c.id
            as reference_id,

        null::uuid
            as parent_reference_id,

        c.cycle_id,
        c.financial_concept_id,

        fc.code
            as concept_code,

        fc.name
            as description,

        c.original_amount::numeric
            as debit,

        0::numeric
            as credit,

        c.status
            as status

    from public.charges c

    join public.financial_concepts fc
      on fc.id =
         c.financial_concept_id

    where c.student_id =
          p_student_id


    union all


    -- ========================================================
    -- CHARGE ADJUSTMENTS
    -- ========================================================

    select
        ca.created_at::date,

        ca.created_at,

        'CHARGE_ADJUSTMENT'::text,

        ca.id,

        ca.charge_id,

        c.cycle_id,
        c.financial_concept_id,

        fc.code,

        ca.adjustment_type
        || ': '
        || ca.reason,

        case
            when ca.amount > 0
            then ca.amount
            else 0
        end::numeric
            as debit,

        case
            when ca.amount < 0
            then abs(ca.amount)
            else 0
        end::numeric
            as credit,

        'APPLIED'::text
            as status

    from public.charge_adjustments ca

    join public.charges c
      on c.id =
         ca.charge_id

    join public.financial_concepts fc
      on fc.id =
         c.financial_concept_id

    where c.student_id =
          p_student_id


    union all


    -- ========================================================
    -- VOID CHARGE
    -- ========================================================
    --
    -- Reversa la obligación del cargo VOID.
    -- Incluye el importe efectivo, no sólo original_amount.
    -- ========================================================

    select
        c.updated_at::date,

        c.updated_at,

        'CHARGE_VOIDED'::text,

        c.id,

        null::uuid,

        c.cycle_id,
        c.financial_concept_id,

        fc.code,

        'Cargo anulado'::text,

        0::numeric
            as debit,

        (
            c.original_amount

            +

            coalesce(
                (
                    select sum(ca.amount)

                    from public.charge_adjustments ca

                    where ca.charge_id =
                          c.id
                ),
                0
            )
        )::numeric
            as credit,

        'VOID'::text
            as status

    from public.charges c

    join public.financial_concepts fc
      on fc.id =
         c.financial_concept_id

    where c.student_id =
          p_student_id

      and c.status =
          'VOID'


    union all


    -- ========================================================
    -- PAYMENTS
    -- ========================================================

    select
        p.received_at::date,

        p.received_at,

        'PAYMENT'::text,

        p.id,

        null::uuid,

        null::uuid,
        null::uuid,

        null::text,

        concat(
            p.payment_code,
            ' · ',
            p.method_name_snapshot
        )::text,

        0::numeric
            as debit,

        p.amount::numeric
            as credit,

        p.status
            as status

    from public.payments p

    where p.student_id =
          p_student_id


    union all


    -- ========================================================
    -- PAYMENT REVERSALS
    -- ========================================================

    select
        pr.reversed_at::date,

        pr.reversed_at,

        'PAYMENT_REVERSAL'::text,

        pr.id,

        pr.payment_id,

        null::uuid,
        null::uuid,

        null::text,

        pr.reason,

        p.amount::numeric
            as debit,

        0::numeric
            as credit,

        'REVERSED'::text
            as status

    from public.payment_reversals pr

    join public.payments p
      on p.id =
         pr.payment_id

    where p.student_id =
          p_student_id


    union all


    -- ========================================================
    -- REFUNDS
    -- ========================================================

    select
        r.refunded_at::date,

        r.refunded_at,

        'REFUND'::text,

        r.id,

        r.payment_id,

        null::uuid,
        null::uuid,

        null::text,

        r.reason,

        r.amount::numeric
            as debit,

        0::numeric
            as credit,

        'REFUNDED'::text
            as status

    from public.refunds r

    join public.payments p
      on p.id =
         r.payment_id

    where p.student_id =
          p_student_id


    order by
        movement_on,
        recorded_at,
        movement_type,
        reference_id;

end;
$$;



revoke all
on function
app_private.student_account_movements_internal(uuid)
from public, anon;


grant execute
on function
app_private.student_account_movements_internal(uuid)
to authenticated;



create or replace function
public.student_account_movements(
    p_student_id uuid
)
returns table (
    movement_on date,
    recorded_at timestamptz,

    movement_type text,

    reference_id uuid,
    parent_reference_id uuid,

    cycle_id uuid,
    financial_concept_id uuid,

    concept_code text,
    description text,

    debit numeric,
    credit numeric,

    status text
)
language sql
stable
set search_path = ''
as $$
    select *
    from app_private.student_account_movements_internal(
        p_student_id
    );
$$;


revoke all
on function
public.student_account_movements(uuid)
from public, anon;


grant execute
on function
public.student_account_movements(uuid)
to authenticated;


-- ============================================================
-- FIN M6.3
-- ============================================================