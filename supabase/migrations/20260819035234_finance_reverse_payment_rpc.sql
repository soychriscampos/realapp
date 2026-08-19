-- ============================================================
-- FINANCE RPC: REVERSE PAYMENT
-- ============================================================
--
-- Revierte un pago confirmado de forma atómica.
--
-- Efectos:
-- 1. valida autorización;
-- 2. bloquea el pago;
-- 3. impide doble reverso;
-- 4. impide reversar pagos que ya tengan reembolsos;
-- 5. revierte payment_allocations;
-- 6. revierte aplicaciones de créditos originados por el pago;
-- 7. invalida esos créditos;
-- 8. marca payment como REVERSED;
-- 9. crea payment_reversals;
-- 10. registra auditoría.
--
-- No elimina historia.
-- ============================================================


-- ============================================================
-- 1. IMPLEMENTACIÓN PRIVADA
-- ============================================================

create or replace function app_private.reverse_payment_internal(
    p_payment_id uuid,
    p_reason text
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
    v_payment_amount numeric;
    v_payment_code text;
    v_received_by uuid;
    v_payment_status text;

    v_reversal_id uuid;
    v_reversed_at timestamptz := statement_timestamp();
    v_correlation_id uuid := gen_random_uuid();

    v_allocation_count integer := 0;
    v_credit_count integer := 0;
    v_credit_application_count integer := 0;
begin

    -- --------------------------------------------------------
    -- AUTENTICACIÓN
    -- --------------------------------------------------------

    v_actor_id := (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;


    -- --------------------------------------------------------
    -- VALIDACIONES BÁSICAS
    -- --------------------------------------------------------

    if p_payment_id is null then
        raise exception 'payment_id is required';
    end if;

    if p_reason is null or btrim(p_reason) = '' then
        raise exception 'Reversal reason is required';
    end if;


    -- --------------------------------------------------------
    -- BLOQUEAR PAGO
    -- --------------------------------------------------------

    select
        p.student_id,
        p.amount,
        p.payment_code,
        p.received_by,
        p.status
    into
        v_student_id,
        v_payment_amount,
        v_payment_code,
        v_received_by,
        v_payment_status
    from public.payments p
    where p.id = p_payment_id
    for update;

    if not found then
        raise exception 'Payment not found';
    end if;


    -- --------------------------------------------------------
    -- AUTORIZACIÓN
    -- --------------------------------------------------------
    --
    -- MASTER:
    -- payments.reverse / ALL
    --
    -- ADMINISTRATIVO:
    -- payments.reverse / OWN
    -- y sólo puede revertir un pago recibido por él mismo.
    -- --------------------------------------------------------

    if not (
        app_private.current_user_has_permission(
            'payments.reverse',
            'ALL'
        )

        or (

            app_private.current_user_has_permission(
                'payments.reverse',
                'OWN'
            )

            and v_received_by = v_actor_id
        )
    ) then
        raise exception 'Insufficient permission to reverse payment';
    end if;


    -- --------------------------------------------------------
    -- ESTADO DEL PAGO
    -- --------------------------------------------------------

    if v_payment_status <> 'CONFIRMED' then
        raise exception 'Only confirmed payments can be reversed';
    end if;

    if exists (
        select 1
        from public.payment_reversals pr
        where pr.payment_id = p_payment_id
    ) then
        raise exception 'Payment has already been reversed';
    end if;


    -- --------------------------------------------------------
    -- REEMBOLSOS
    -- --------------------------------------------------------
    --
    -- Reembolso y reverso son operaciones distintas.
    -- Un pago que ya tuvo devolución no se puede reversar
    -- directamente.
    -- --------------------------------------------------------

    if exists (
        select 1
        from public.refunds r
        where r.payment_id = p_payment_id
    ) then
        raise exception
            'Payment has refunds and cannot be reversed';
    end if;


    -- --------------------------------------------------------
    -- BLOQUEAR CRÉDITOS ORIGINADOS POR EL PAGO
    -- --------------------------------------------------------
    --
    -- Evita que simultáneamente alguien aplique uno de estos
    -- créditos mientras el pago está siendo revertido.
    -- --------------------------------------------------------

    perform cr.id
    from public.credits cr
    where cr.source_payment_id = p_payment_id
    order by cr.id
    for update;


    -- --------------------------------------------------------
    -- REVERTIR APLICACIONES DE CRÉDITO
    -- --------------------------------------------------------
    --
    -- Si un sobrante de este pago ya había sido aplicado a
    -- otro cargo, esa aplicación deja de tener efecto.
    --
    -- La fila NO se elimina.
    -- --------------------------------------------------------

    update public.credit_applications ca
    set reversed_at = v_reversed_at
    where ca.credit_id in (
        select cr.id
        from public.credits cr
        where cr.source_payment_id = p_payment_id
    )
      and ca.reversed_at is null;

    get diagnostics
        v_credit_application_count = row_count;


    -- --------------------------------------------------------
    -- INVALIDAR CRÉDITOS DEL PAGO
    -- --------------------------------------------------------

    update public.credits cr
    set
        status = 'VOID',
        updated_at = v_reversed_at
    where cr.source_payment_id = p_payment_id
      and cr.status = 'ACTIVE';

    get diagnostics
        v_credit_count = row_count;


    -- --------------------------------------------------------
    -- REVERTIR PAYMENT ALLOCATIONS
    -- --------------------------------------------------------

    update public.payment_allocations pa
    set reversed_at = v_reversed_at
    where pa.payment_id = p_payment_id
      and pa.reversed_at is null;

    get diagnostics
        v_allocation_count = row_count;


    -- --------------------------------------------------------
    -- CREAR EVENTO DE REVERSO
    -- --------------------------------------------------------

    insert into public.payment_reversals (
        payment_id,
        reason,
        reversed_by,
        reversed_at
    )
    values (
        p_payment_id,
        btrim(p_reason),
        v_actor_id,
        v_reversed_at
    )
    returning id
    into v_reversal_id;


    -- --------------------------------------------------------
    -- MARCAR PAGO COMO REVERSED
    -- --------------------------------------------------------

    update public.payments
    set
        status = 'REVERSED',
        updated_at = v_reversed_at
    where id = p_payment_id;


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
        'PAYMENT_REVERSED',
        'payments',
        p_payment_id,

        jsonb_build_object(
            'status', 'CONFIRMED',
            'payment_code', v_payment_code,
            'student_id', v_student_id,
            'amount', v_payment_amount
        ),

        jsonb_build_object(
            'status', 'REVERSED',
            'reversal_id', v_reversal_id,
            'reversed_allocations', v_allocation_count,
            'voided_credits', v_credit_count,
            'reversed_credit_applications',
                v_credit_application_count
        ),

        btrim(p_reason),
        v_correlation_id
    );


    return v_reversal_id;

end;
$$;


revoke all
on function app_private.reverse_payment_internal(
    uuid,
    text
)
from public;

grant execute
on function app_private.reverse_payment_internal(
    uuid,
    text
)
to authenticated;


-- ============================================================
-- 2. RPC PÚBLICA
-- ============================================================

create or replace function public.reverse_payment(
    p_payment_id uuid,
    p_reason text
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
    select app_private.reverse_payment_internal(
        p_payment_id,
        p_reason
    );
$$;


revoke all
on function public.reverse_payment(
    uuid,
    text
)
from public;

grant execute
on function public.reverse_payment(
    uuid,
    text
)
to authenticated;