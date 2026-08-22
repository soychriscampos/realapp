-- ============================================================
-- Exponer receptor histórico en movimientos canónicos de cuenta
-- ============================================================

drop function public.student_account_movements(uuid);
drop function app_private.student_account_movements_internal(uuid);


create function
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
    received_by_name_snapshot text,

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

        null::text
            as received_by_name_snapshot,

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

        null::text
            as received_by_name_snapshot,

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

        null::text
            as received_by_name_snapshot,

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

        nullif(
            btrim(p.received_by_name_snapshot),
            ''
        )::text
            as received_by_name_snapshot,

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

        null::text
            as received_by_name_snapshot,

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

        null::text
            as received_by_name_snapshot,

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


create function
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
    received_by_name_snapshot text,

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
