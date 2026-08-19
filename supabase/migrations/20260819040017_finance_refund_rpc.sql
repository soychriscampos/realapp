-- ============================================================
-- FINANCE RPC: REFUND PAYMENT
-- ============================================================
--
-- Permite reembolsos parciales/totales de un pago confirmado.
--
-- Un refund debe indicar de dónde sale el valor devuelto:
--
-- PAYMENT_ALLOCATION
--   → reduce lo aplicado a un cargo y reabre saldo.
--
-- CREDIT
--   → reduce crédito todavía disponible.
--
-- El pago original permanece CONFIRMED.
-- ============================================================


-- ============================================================
-- 1. COMPONENTES DEL REEMBOLSO
-- ============================================================

create table public.refund_components (
    id uuid primary key default gen_random_uuid(),

    refund_id uuid not null
        references public.refunds(id)
        on delete restrict,

    payment_allocation_id uuid
        references public.payment_allocations(id)
        on delete restrict,

    credit_id uuid
        references public.credits(id)
        on delete restrict,

    amount numeric not null,

    created_at timestamptz not null
        default statement_timestamp(),

    constraint refund_components_one_source
        check (
            num_nonnulls(
                payment_allocation_id,
                credit_id
            ) = 1
        ),

    constraint refund_components_amount_positive
        check (amount > 0)
);


create index refund_components_refund_idx
    on public.refund_components(refund_id);

create index refund_components_credit_idx
    on public.refund_components(credit_id)
    where credit_id is not null;

create index refund_components_payment_allocation_idx
    on public.refund_components(payment_allocation_id)
    where payment_allocation_id is not null;


alter table public.refund_components
enable row level security;


-- ============================================================
-- 2. RLS DE LECTURA
-- ============================================================

create policy refund_components_select_finance
on public.refund_components
for select
to authenticated
using (
    exists (
        select 1
        from public.refunds r
        join public.payments p
          on p.id = r.payment_id
        where r.id = refund_components.refund_id
          and app_private.current_user_can_view_student_payments(
              p.student_id
          )
    )
);


grant select
on public.refund_components
to authenticated;


-- ============================================================
-- 3. SALDO DISPONIBLE DE UN CRÉDITO
-- ============================================================

create or replace function app_private.credit_available_balance(
    requested_credit_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
    select greatest(
        cr.original_amount

        - coalesce((
            select sum(ca.amount)
            from public.credit_applications ca
            where ca.credit_id = cr.id
              and ca.reversed_at is null
        ), 0)

        - coalesce((
            select sum(rc.amount)
            from public.refund_components rc
            where rc.credit_id = cr.id
        ), 0),

        0
    )
    from public.credits cr
    where cr.id = requested_credit_id
      and cr.status = 'ACTIVE';
$$;


revoke all
on function app_private.credit_available_balance(uuid)
from public;


-- ============================================================
-- 4. ACTUALIZAR APPLY_CREDIT
-- ============================================================
--
-- Ahora también descuenta créditos ya reembolsados.
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
    v_credit_remaining numeric;
    v_reserved_charge_id uuid;

    v_charge_original numeric;
    v_charge_outstanding numeric;

    v_application_id uuid;
    v_correlation_id uuid := gen_random_uuid();
begin

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
    -- BLOQUEAR CRÉDITO
    -- --------------------------------------------------------

    select
        cr.student_id,
        cr.reserved_charge_id
    into
        v_student_id,
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


    if v_reserved_charge_id is not null
       and v_reserved_charge_id <> p_charge_id
    then
        raise exception
            'Credit is reserved for another charge';
    end if;


    v_credit_remaining :=
        app_private.credit_available_balance(
            p_credit_id
        );


    if v_credit_remaining is null
       or v_credit_remaining <= 0
    then
        raise exception 'Credit has no remaining balance';
    end if;


    if p_amount > v_credit_remaining then
        raise exception
            'Amount % exceeds available credit %',
            p_amount,
            v_credit_remaining;
    end if;


    -- --------------------------------------------------------
    -- BLOQUEAR CARGO
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
    -- SALDO DEL CARGO
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
            'credit_remaining_before',
                v_credit_remaining,
            'credit_remaining_after',
                v_credit_remaining - p_amount,
            'charge_balance_before',
                v_charge_outstanding,
            'charge_balance_after',
                v_charge_outstanding - p_amount
        ),
        null,
        v_correlation_id
    );


    return v_application_id;
end;
$$;


-- ============================================================
-- 5. IMPLEMENTACIÓN PRIVADA DEL REEMBOLSO
-- ============================================================

create or replace function app_private.refund_payment_internal(
    p_payment_id uuid,
    p_amount numeric,
    p_refunded_at timestamptz,
    p_reason text,
    p_components jsonb
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
    v_payment_status text;

    v_previous_refunds numeric := 0;
    v_component_total numeric := 0;

    v_refund_id uuid;
    v_correlation_id uuid := gen_random_uuid();

    v_component record;

    v_source_student_id uuid;
    v_source_payment_id uuid;

    v_source_amount numeric;
    v_remaining_amount numeric;

    v_charge_id uuid;
    v_allocation_mode text;
begin

    -- --------------------------------------------------------
    -- AUTH
    -- --------------------------------------------------------

    v_actor_id := (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    -- Reembolso implica salida de dinero.
    -- Inicialmente sólo permiso ALL.

    if not app_private.current_user_has_permission(
        'payments.reverse',
        'ALL'
    ) then
        raise exception 'Insufficient permission to refund payment';
    end if;


    -- --------------------------------------------------------
    -- VALIDACIONES
    -- --------------------------------------------------------

    if p_payment_id is null then
        raise exception 'payment_id is required';
    end if;

    if p_amount is null or p_amount <= 0 then
        raise exception 'Refund amount must be greater than zero';
    end if;

    if p_refunded_at is null then
        raise exception 'refunded_at is required';
    end if;

    if p_reason is null or btrim(p_reason) = '' then
        raise exception 'Refund reason is required';
    end if;

    if p_components is null
       or jsonb_typeof(p_components) <> 'array'
       or jsonb_array_length(p_components) = 0
    then
        raise exception
            'Refund components are required';
    end if;


    -- --------------------------------------------------------
    -- BLOQUEAR PAGO
    -- --------------------------------------------------------

    select
        p.student_id,
        p.amount,
        p.status
    into
        v_student_id,
        v_payment_amount,
        v_payment_status
    from public.payments p
    where p.id = p_payment_id
    for update;

    if not found then
        raise exception 'Payment not found';
    end if;


    if v_payment_status <> 'CONFIRMED' then
        raise exception
            'Only confirmed payments can be refunded';
    end if;


    -- --------------------------------------------------------
    -- TOTAL YA REEMBOLSADO
    -- --------------------------------------------------------

    select coalesce(sum(r.amount), 0)
    into v_previous_refunds
    from public.refunds r
    where r.payment_id = p_payment_id;


    if p_amount >
       (v_payment_amount - v_previous_refunds)
    then
        raise exception
            'Refund exceeds remaining refundable payment amount';
    end if;


    -- --------------------------------------------------------
    -- VALIDAR TOTAL DE COMPONENTES
    -- --------------------------------------------------------

    select coalesce(
        sum((value ->> 'amount')::numeric),
        0
    )
    into v_component_total
    from jsonb_array_elements(p_components);


    if v_component_total <> p_amount then
        raise exception
            'Refund components total % must equal refund amount %',
            v_component_total,
            p_amount;
    end if;


    -- --------------------------------------------------------
    -- CREAR REFUND
    -- --------------------------------------------------------

    insert into public.refunds (
        payment_id,
        amount,
        reason,
        refunded_at,
        created_by,
        authorized_by
    )
    values (
        p_payment_id,
        p_amount,
        btrim(p_reason),
        p_refunded_at,
        v_actor_id,
        v_actor_id
    )
    returning id
    into v_refund_id;


    -- --------------------------------------------------------
    -- PROCESAR COMPONENTES
    -- --------------------------------------------------------

    for v_component in
        select
            upper(value ->> 'source_type') as source_type,
            (value ->> 'source_id')::uuid as source_id,
            (value ->> 'amount')::numeric as amount
        from jsonb_array_elements(p_components)
    loop

        if v_component.amount is null
           or v_component.amount <= 0
        then
            raise exception
                'Component amount must be greater than zero';
        end if;


        -- ====================================================
        -- COMPONENTE: PAYMENT_ALLOCATION
        -- ====================================================

        if v_component.source_type = 'PAYMENT_ALLOCATION'
        then

            select
                pa.student_id,
                pa.payment_id,
                pa.charge_id,
                pa.amount,
                pa.allocation_mode
            into
                v_source_student_id,
                v_source_payment_id,
                v_charge_id,
                v_source_amount,
                v_allocation_mode
            from public.payment_allocations pa
            where pa.id = v_component.source_id
              and pa.reversed_at is null
            for update;

            if not found then
                raise exception
                    'Active payment allocation not found';
            end if;


            if v_source_student_id <> v_student_id
               or v_source_payment_id <> p_payment_id
            then
                raise exception
                    'Payment allocation does not belong to payment';
            end if;


            if v_component.amount > v_source_amount then
                raise exception
                    'Refund component exceeds payment allocation';
            end if;


            -- Invalidamos la asignación original completa.

            update public.payment_allocations
            set reversed_at = statement_timestamp()
            where id = v_component.source_id;


            -- Si el reembolso es parcial, creamos una nueva
            -- asignación por el remanente.
            --
            -- De esta forma TODAS las fórmulas existentes de
            -- saldo siguen funcionando sin almacenar saldos.

            v_remaining_amount :=
                v_source_amount - v_component.amount;


            if v_remaining_amount > 0 then

                insert into public.payment_allocations (
                    student_id,
                    payment_id,
                    charge_id,
                    amount,
                    allocation_mode,
                    created_by
                )
                values (
                    v_student_id,
                    p_payment_id,
                    v_charge_id,
                    v_remaining_amount,
                    v_allocation_mode,
                    v_actor_id
                );

            end if;


            insert into public.refund_components (
                refund_id,
                payment_allocation_id,
                credit_id,
                amount
            )
            values (
                v_refund_id,
                v_component.source_id,
                null,
                v_component.amount
            );


        -- ====================================================
        -- COMPONENTE: CREDIT
        -- ====================================================

        elsif v_component.source_type = 'CREDIT'
        then

            select
                cr.student_id,
                cr.source_payment_id
            into
                v_source_student_id,
                v_source_payment_id
            from public.credits cr
            where cr.id = v_component.source_id
              and cr.status = 'ACTIVE'
            for update;

            if not found then
                raise exception 'Active credit not found';
            end if;


            if v_source_student_id <> v_student_id
               or v_source_payment_id <> p_payment_id
            then
                raise exception
                    'Credit does not belong to payment';
            end if;


            v_remaining_amount :=
                app_private.credit_available_balance(
                    v_component.source_id
                );


            if v_component.amount >
               v_remaining_amount
            then
                raise exception
                    'Refund component exceeds available credit';
            end if;


            insert into public.refund_components (
                refund_id,
                payment_allocation_id,
                credit_id,
                amount
            )
            values (
                v_refund_id,
                null,
                v_component.source_id,
                v_component.amount
            );


        else
            raise exception
                'Invalid refund source type: %',
                v_component.source_type;
        end if;

    end loop;


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
        'PAYMENT_REFUNDED',
        'refunds',
        v_refund_id,
        null,
        jsonb_build_object(
            'payment_id', p_payment_id,
            'student_id', v_student_id,
            'amount', p_amount,
            'refunded_at', p_refunded_at,
            'previous_refunds', v_previous_refunds,
            'total_refunded_after',
                v_previous_refunds + p_amount
        ),
        btrim(p_reason),
        v_correlation_id
    );


    return v_refund_id;

end;
$$;


revoke all
on function app_private.refund_payment_internal(
    uuid,
    numeric,
    timestamptz,
    text,
    jsonb
)
from public;

grant execute
on function app_private.refund_payment_internal(
    uuid,
    numeric,
    timestamptz,
    text,
    jsonb
)
to authenticated;


-- ============================================================
-- 6. RPC PÚBLICA
-- ============================================================

create or replace function public.refund_payment(
    p_payment_id uuid,
    p_amount numeric,
    p_refunded_at timestamptz,
    p_reason text,
    p_components jsonb
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
    select app_private.refund_payment_internal(
        p_payment_id,
        p_amount,
        p_refunded_at,
        p_reason,
        p_components
    );
$$;


revoke all
on function public.refund_payment(
    uuid,
    numeric,
    timestamptz,
    text,
    jsonb
)
from public;

grant execute
on function public.refund_payment(
    uuid,
    numeric,
    timestamptz,
    text,
    jsonb
)
to authenticated;