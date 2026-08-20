-- ============================================================
-- M4.3 — Ajuste / condonación de cargos
-- ============================================================
--
-- Nunca modifica charges.original_amount.
--
-- La aplicación envía el monto efectivo FINAL que debe
-- conservar la obligación.
--
-- Tipos permitidos desde esta RPC:
--
--   WAIVER      condonación total/parcial
--   CORRECTION  corrección administrativa
--   AGREEMENT   monto acordado
--   OTHER       caso excepcional
--
-- DISCOUNT queda reservado al modelo de categorías.
-- WITHDRAWAL queda reservado a M4.2.
--
-- ============================================================


create or replace function
app_private.adjust_charge_internal(
    p_charge_id uuid,
    p_target_amount numeric,
    p_adjustment_type text,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;

    v_student_id uuid;
    v_enrollment_id uuid;

    v_original_amount numeric;
    v_current_adjustments numeric;
    v_current_effective_amount numeric;

    v_payment_applied numeric;
    v_credit_applied numeric;
    v_total_applied numeric;

    v_delta numeric;

    v_adjustment_id uuid;

    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- ========================================================
    -- AUTH
    -- ========================================================

    v_actor_id :=
        (select auth.uid());


    if v_actor_id is null then
        raise exception
            'Authentication required';
    end if;


    if not app_private.current_user_is_active() then
        raise exception
            'Inactive user';
    end if;


    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to adjust charges';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_charge_id is null then
        raise exception
            'charge_id is required';
    end if;


    if p_target_amount is null then
        raise exception
            'target_amount is required';
    end if;


    if p_target_amount < 0 then
        raise exception
            'target_amount cannot be negative';
    end if;


    if p_adjustment_type not in (
        'WAIVER',
        'CORRECTION',
        'AGREEMENT',
        'OTHER'
    )
    then
        raise exception
            'Invalid adjustment type';
    end if;


    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Reason is required';
    end if;


    -- ========================================================
    -- LOCK CHARGE
    -- ========================================================

    select
        c.student_id,
        c.enrollment_id,
        c.original_amount

    into
        v_student_id,
        v_enrollment_id,
        v_original_amount

    from public.charges c

    where c.id =
          p_charge_id

      and c.status =
          'ACTIVE'

    for update;


    if not found then
        raise exception
            'Active charge not found';
    end if;


    -- ========================================================
    -- CURRENT EFFECTIVE AMOUNT
    -- ========================================================

    select
        coalesce(
            sum(ca.amount),
            0
        )

    into
        v_current_adjustments

    from public.charge_adjustments ca

    where ca.charge_id =
          p_charge_id;


    v_current_effective_amount :=
        v_original_amount
        + v_current_adjustments;


    -- Defensive integrity check.

    if v_current_effective_amount < 0 then
        raise exception
            'Charge currently has an invalid negative effective amount';
    end if;


    -- ========================================================
    -- MONEY ALREADY APPLIED
    -- ========================================================

    select
        coalesce(
            sum(pa.amount),
            0
        )

    into
        v_payment_applied

    from public.payment_allocations pa

    join public.payments p
      on p.id =
         pa.payment_id

    where pa.charge_id =
          p_charge_id

      and pa.reversed_at is null

      and p.status =
          'CONFIRMED';


    select
        coalesce(
            sum(capp.amount),
            0
        )

    into
        v_credit_applied

    from public.credit_applications capp

    join public.credits cr
      on cr.id =
         capp.credit_id

    where capp.charge_id =
          p_charge_id

      and capp.reversed_at is null

      and cr.status =
          'ACTIVE';


    v_total_applied :=
        v_payment_applied
        + v_credit_applied;


    -- ========================================================
    -- TARGET VALIDATION
    -- ========================================================

    if p_target_amount <
       v_total_applied
    then
        raise exception
            'Target amount % cannot be below already applied amount %',
            p_target_amount,
            v_total_applied;
    end if;


    if p_target_amount =
       v_current_effective_amount
    then
        raise exception
            'Target amount is already the current effective amount';
    end if;


    -- ========================================================
    -- CALCULATE DELTA
    -- ========================================================

    v_delta :=
        p_target_amount
        - v_current_effective_amount;


    -- ========================================================
    -- INSERT IMMUTABLE ADJUSTMENT
    -- ========================================================

    insert into public.charge_adjustments (
        charge_id,
        amount,
        adjustment_type,
        reason,
        created_by
    )
    values (
        p_charge_id,
        v_delta,
        p_adjustment_type,
        btrim(p_reason),
        v_actor_id
    )
    returning id
    into v_adjustment_id;


    -- ========================================================
    -- AUDIT
    -- ========================================================

    insert into public.audit_log (
        actor_profile_id,
        action,
        entity_name,
        entity_id,
        old_values,
        new_values,
        reason,
        correlation_id
    )
    values (
        v_actor_id,

        case
            when p_adjustment_type =
                 'WAIVER'
            then 'CHARGE_WAIVED'

            else 'CHARGE_ADJUSTED'
        end,

        'charges',

        p_charge_id,

        jsonb_build_object(
            'original_amount',
                v_original_amount,

            'adjustments_total',
                v_current_adjustments,

            'effective_amount',
                v_current_effective_amount,

            'payment_applied',
                v_payment_applied,

            'credit_applied',
                v_credit_applied,

            'total_applied',
                v_total_applied
        ),

        jsonb_build_object(
            'original_amount',
                v_original_amount,

            'adjustment_id',
                v_adjustment_id,

            'adjustment_amount',
                v_delta,

            'adjustment_type',
                p_adjustment_type,

            'effective_amount',
                p_target_amount,

            'remaining_balance',
                p_target_amount
                - v_total_applied
        ),

        btrim(p_reason),

        v_correlation_id
    );


    -- M5 tiene trigger sobre charge_adjustments.
    -- Si este ajuste deja al alumno al corriente,
    -- el entitlement académico correspondiente
    -- podrá adquirirse automáticamente.


    return v_adjustment_id;

end;
$$;



-- ============================================================
-- INTERNAL PRIVILEGES
-- ============================================================

revoke all
on function
app_private.adjust_charge_internal(
    uuid,
    numeric,
    text,
    text
)
from public, anon;


grant execute
on function
app_private.adjust_charge_internal(
    uuid,
    numeric,
    text,
    text
)
to authenticated;



-- ============================================================
-- PUBLIC RPC
-- ============================================================

create or replace function
public.adjust_charge(
    p_charge_id uuid,
    p_target_amount numeric,
    p_adjustment_type text,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.adjust_charge_internal(
            p_charge_id,
            p_target_amount,
            p_adjustment_type,
            p_reason
        );
$$;


revoke all
on function
public.adjust_charge(
    uuid,
    numeric,
    text,
    text
)
from public, anon;


grant execute
on function
public.adjust_charge(
    uuid,
    numeric,
    text,
    text
)
to authenticated;


-- ============================================================
-- FIN M4.3
-- ============================================================