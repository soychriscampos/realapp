-- ============================================================
-- FINANCE RPC: APPLY CREDIT
-- ============================================================
--
-- Aplica crédito existente a un cargo en una sola transacción.
--
-- Reglas:
-- - usuario activo con payments.create / ALL
-- - crédito ACTIVE
-- - pago origen todavía CONFIRMED
-- - crédito y cargo pertenecen al mismo alumno
-- - respeta créditos reservados
-- - no supera saldo disponible del crédito
-- - no supera saldo pendiente del cargo
-- - bloquea crédito y cargo contra concurrencia
-- - registra auditoría
-- ============================================================


-- ============================================================
-- 1. IMPLEMENTACIÓN PRIVADA
-- ============================================================

create or replace function app_private.apply_credit_internal(
    p_credit_id uuid,
    p_charge_id uuid,
    p_amount numeric
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;

    v_student_id uuid;
    v_credit_original numeric;
    v_credit_remaining numeric;
    v_reserved_charge_id uuid;

    v_charge_original numeric;
    v_charge_outstanding numeric;

    v_application_id uuid;
    v_correlation_id uuid := gen_random_uuid();
begin

    -- --------------------------------------------------------
    -- AUTENTICACIÓN / AUTORIZACIÓN
    -- --------------------------------------------------------

    v_actor_id := (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'payments.create',
        'ALL'
    ) then
        raise exception 'Insufficient permission to apply credit';
    end if;


    -- --------------------------------------------------------
    -- VALIDACIONES BÁSICAS
    -- --------------------------------------------------------

    if p_credit_id is null then
        raise exception 'credit_id is required';
    end if;

    if p_charge_id is null then
        raise exception 'charge_id is required';
    end if;

    if p_amount is null or p_amount <= 0 then
        raise exception 'Amount must be greater than zero';
    end if;


    -- --------------------------------------------------------
    -- BLOQUEAR Y VALIDAR CRÉDITO
    -- --------------------------------------------------------

    select
        cr.student_id,
        cr.original_amount,
        cr.reserved_charge_id
    into
        v_student_id,
        v_credit_original,
        v_reserved_charge_id
    from public.credits cr
    join public.payments p
      on p.id = cr.source_payment_id
    where cr.id = p_credit_id
      and cr.status = 'ACTIVE'
      and p.status = 'CONFIRMED'
    for update of cr;

    if not found then
        raise exception 'Active credit not found';
    end if;


    -- Si el crédito fue reservado a un cargo concreto,
    -- no puede aplicarse a otro.

    if v_reserved_charge_id is not null
       and v_reserved_charge_id <> p_charge_id
    then
        raise exception
            'Credit is reserved for another charge';
    end if;


    -- --------------------------------------------------------
    -- SALDO DISPONIBLE DEL CRÉDITO
    -- --------------------------------------------------------

    select
        v_credit_original
        - coalesce(sum(ca.amount), 0)
    into v_credit_remaining
    from public.credit_applications ca
    where ca.credit_id = p_credit_id
      and ca.reversed_at is null;

    if v_credit_remaining <= 0 then
        raise exception 'Credit has no remaining balance';
    end if;

    if p_amount > v_credit_remaining then
        raise exception
            'Amount % exceeds available credit %',
            p_amount,
            v_credit_remaining;
    end if;


    -- --------------------------------------------------------
    -- BLOQUEAR Y VALIDAR CARGO
    -- --------------------------------------------------------

    select c.original_amount
    into v_charge_original
    from public.charges c
    where c.id = p_charge_id
      and c.student_id = v_student_id
      and c.status = 'ACTIVE'
    for update;

    if not found then
        raise exception
            'Active charge does not belong to credit student';
    end if;


    -- --------------------------------------------------------
    -- CALCULAR SALDO PENDIENTE DEL CARGO
    -- --------------------------------------------------------

    select
        v_charge_original

        + coalesce((
            select sum(adj.amount)
            from public.charge_adjustments adj
            where adj.charge_id = p_charge_id
        ), 0)

        - coalesce((
            select sum(pa.amount)
            from public.payment_allocations pa
            join public.payments p
              on p.id = pa.payment_id
            where pa.charge_id = p_charge_id
              and pa.reversed_at is null
              and p.status = 'CONFIRMED'
        ), 0)

        - coalesce((
            select sum(ca.amount)
            from public.credit_applications ca
            join public.credits cr
              on cr.id = ca.credit_id
            where ca.charge_id = p_charge_id
              and ca.reversed_at is null
              and cr.status = 'ACTIVE'
        ), 0)

    into v_charge_outstanding;


    if v_charge_outstanding <= 0 then
        raise exception 'Charge has no outstanding balance';
    end if;

    if p_amount > v_charge_outstanding then
        raise exception
            'Amount % exceeds charge outstanding balance %',
            p_amount,
            v_charge_outstanding;
    end if;


    -- --------------------------------------------------------
    -- CREAR APLICACIÓN
    -- --------------------------------------------------------

    insert into public.credit_applications (
        student_id,
        credit_id,
        charge_id,
        amount,
        created_by
    )
    values (
        v_student_id,
        p_credit_id,
        p_charge_id,
        p_amount,
        v_actor_id
    )
    returning id
    into v_application_id;


    -- --------------------------------------------------------
    -- AUDITORÍA
    -- --------------------------------------------------------

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
        'CREDIT_APPLIED',
        'credit_applications',
        v_application_id,
        null,
        jsonb_build_object(
            'credit_id', p_credit_id,
            'charge_id', p_charge_id,
            'student_id', v_student_id,
            'amount', p_amount,
            'credit_remaining_before', v_credit_remaining,
            'credit_remaining_after', v_credit_remaining - p_amount,
            'charge_balance_before', v_charge_outstanding,
            'charge_balance_after', v_charge_outstanding - p_amount
        ),
        null,
        v_correlation_id
    );


    return v_application_id;

end;
$$;


revoke all
on function app_private.apply_credit_internal(
    uuid,
    uuid,
    numeric
)
from public;

grant execute
on function app_private.apply_credit_internal(
    uuid,
    uuid,
    numeric
)
to authenticated;


-- ============================================================
-- 2. RPC PÚBLICA
-- ============================================================

create or replace function public.apply_credit(
    p_credit_id uuid,
    p_charge_id uuid,
    p_amount numeric
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
    select app_private.apply_credit_internal(
        p_credit_id,
        p_charge_id,
        p_amount
    );
$$;


revoke all
on function public.apply_credit(
    uuid,
    uuid,
    numeric
)
from public;

grant execute
on function public.apply_credit(
    uuid,
    uuid,
    numeric
)
to authenticated;