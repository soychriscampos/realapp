-- ============================================================
-- FINANCE RPC: REGISTER PAYMENT
-- ============================================================
--
-- Registra un pago completo en una sola transacción:
--
-- 1. valida usuario y permiso;
-- 2. valida cargos/asignaciones;
-- 3. bloquea cargos involucrados;
-- 4. crea payment;
-- 5. crea payment_allocations;
-- 6. convierte sobrante en crédito;
-- 7. registra auditoría.
--
-- La fecha financiera (received_at) puede ser histórica.
-- created_at conserva cuándo se capturó realmente en App REAL.
-- ============================================================


-- ============================================================
-- 1. IMPLEMENTACIÓN PRIVADA
-- ============================================================

create or replace function app_private.register_payment_internal(
    p_student_id uuid,
    p_received_at timestamptz,
    p_amount numeric,
    p_method text,
    p_notes text default null,
    p_allocations jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_receiver_name text;

    v_payment_id uuid;
    v_payment_code text;

    v_allocated_total numeric := 0;
    v_credit_amount numeric := 0;

    v_charge_original numeric;
    v_charge_outstanding numeric;

    v_allocation record;

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
        raise exception 'Insufficient permission to register payments';
    end if;


    -- --------------------------------------------------------
    -- VALIDACIONES GENERALES
    -- --------------------------------------------------------

    if p_student_id is null then
        raise exception 'student_id is required';
    end if;

    if not exists (
        select 1
        from public.students s
        where s.id = p_student_id
    ) then
        raise exception 'Student does not exist';
    end if;

    if p_received_at is null then
        raise exception 'received_at is required';
    end if;

    if p_amount is null or p_amount <= 0 then
        raise exception 'Payment amount must be greater than zero';
    end if;

    if p_method not in (
        'CASH',
        'TRANSFER',
        'CARD',
        'IN_KIND',
        'OTHER'
    ) then
        raise exception 'Invalid payment method';
    end if;

    if p_method in ('IN_KIND', 'OTHER')
       and (
            p_notes is null
            or btrim(p_notes) = ''
       )
    then
        raise exception 'Notes are required for IN_KIND or OTHER';
    end if;

    if p_allocations is null then
        p_allocations := '[]'::jsonb;
    end if;

    if jsonb_typeof(p_allocations) <> 'array' then
        raise exception 'allocations must be a JSON array';
    end if;


    -- --------------------------------------------------------
    -- EVITAR CARGO DUPLICADO EN EL MISMO PAGO
    -- --------------------------------------------------------

    if exists (
        select 1
        from (
            select
                value ->> 'charge_id' as charge_id,
                count(*) as occurrences
            from jsonb_array_elements(p_allocations)
            group by value ->> 'charge_id'
        ) x
        where x.charge_id is null
           or x.charge_id = ''
           or x.occurrences > 1
    ) then
        raise exception 'Each charge may appear only once in allocations';
    end if;


    -- --------------------------------------------------------
    -- OBTENER SNAPSHOT DEL RECEPTOR
    -- --------------------------------------------------------

    select p.display_name
    into v_receiver_name
    from public.profiles p
    where p.id = v_actor_id
      and p.is_active = true;

    if v_receiver_name is null then
        raise exception 'Active receiver profile not found';
    end if;


    -- --------------------------------------------------------
    -- VALIDAR ASIGNACIONES Y BLOQUEAR CARGOS
    -- --------------------------------------------------------
    --
    -- El ORDER BY ayuda a que operaciones concurrentes bloqueen
    -- cargos siempre en el mismo orden.
    -- --------------------------------------------------------

    for v_allocation in
        select
            (value ->> 'charge_id')::uuid as charge_id,
            (value ->> 'amount')::numeric as amount
        from jsonb_array_elements(p_allocations)
        order by (value ->> 'charge_id')::uuid
    loop

        if v_allocation.amount is null
           or v_allocation.amount <= 0
        then
            raise exception 'Allocation amount must be greater than zero';
        end if;


        -- Bloquear el cargo para evitar asignaciones concurrentes.

        select c.original_amount
        into v_charge_original
        from public.charges c
        where c.id = v_allocation.charge_id
          and c.student_id = p_student_id
          and c.status = 'ACTIVE'
        for update;

        if not found then
            raise exception
                'Active charge % does not belong to student %',
                v_allocation.charge_id,
                p_student_id;
        end if;


        -- Saldo actual del cargo.

        select
            v_charge_original

            + coalesce((
                select sum(ca.amount)
                from public.charge_adjustments ca
                where ca.charge_id = v_allocation.charge_id
            ), 0)

            - coalesce((
                select sum(pa.amount)
                from public.payment_allocations pa
                join public.payments p
                  on p.id = pa.payment_id
                where pa.charge_id = v_allocation.charge_id
                  and pa.reversed_at is null
                  and p.status = 'CONFIRMED'
            ), 0)

            - coalesce((
                select sum(capp.amount)
                from public.credit_applications capp
                join public.credits cr
                  on cr.id = capp.credit_id
                where capp.charge_id = v_allocation.charge_id
                  and capp.reversed_at is null
                  and cr.status = 'ACTIVE'
            ), 0)

        into v_charge_outstanding;


        if v_charge_outstanding <= 0 then
            raise exception
                'Charge % has no outstanding balance',
                v_allocation.charge_id;
        end if;


        if v_allocation.amount > v_charge_outstanding then
            raise exception
                'Allocation % exceeds outstanding balance % for charge %',
                v_allocation.amount,
                v_charge_outstanding,
                v_allocation.charge_id;
        end if;


        v_allocated_total :=
            v_allocated_total + v_allocation.amount;

    end loop;


    -- --------------------------------------------------------
    -- EL TOTAL ASIGNADO NO PUEDE SUPERAR EL PAGO
    -- --------------------------------------------------------

    if v_allocated_total > p_amount then
        raise exception
            'Allocated total % exceeds payment amount %',
            v_allocated_total,
            p_amount;
    end if;


    -- --------------------------------------------------------
    -- GENERAR CÓDIGO DEL PAGO
    -- --------------------------------------------------------

    v_payment_code :=
        'PAY-'
        || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
        || '-'
        || upper(substr(gen_random_uuid()::text, 1, 8));


    -- --------------------------------------------------------
    -- CREAR PAGO
    -- --------------------------------------------------------

    insert into public.payments (
        payment_code,
        student_id,
        received_at,
        amount,
        method,
        status,
        received_by,
        received_by_name_snapshot,
        notes
    )
    values (
        v_payment_code,
        p_student_id,
        p_received_at,
        p_amount,
        p_method,
        'CONFIRMED',
        v_actor_id,
        v_receiver_name,
        p_notes
    )
    returning id
    into v_payment_id;


    -- --------------------------------------------------------
    -- CREAR ASIGNACIONES
    -- --------------------------------------------------------

    for v_allocation in
        select
            (value ->> 'charge_id')::uuid as charge_id,
            (value ->> 'amount')::numeric as amount
        from jsonb_array_elements(p_allocations)
        order by (value ->> 'charge_id')::uuid
    loop

        insert into public.payment_allocations (
            student_id,
            payment_id,
            charge_id,
            amount,
            allocation_mode,
            created_by
        )
        values (
            p_student_id,
            v_payment_id,
            v_allocation.charge_id,
            v_allocation.amount,
            'MANUAL',
            v_actor_id
        );

    end loop;


    -- --------------------------------------------------------
    -- SOBRANTE → CRÉDITO GENERAL
    -- --------------------------------------------------------

    v_credit_amount := p_amount - v_allocated_total;

    if v_credit_amount > 0 then

        insert into public.credits (
            student_id,
            source_payment_id,
            original_amount,
            reserved_charge_id,
            status
        )
        values (
            p_student_id,
            v_payment_id,
            v_credit_amount,
            null,
            'ACTIVE'
        );

    end if;


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
        'PAYMENT_REGISTERED',
        'payments',
        v_payment_id,
        null,
        jsonb_build_object(
            'payment_code', v_payment_code,
            'student_id', p_student_id,
            'received_at', p_received_at,
            'amount', p_amount,
            'method', p_method,
            'allocated_amount', v_allocated_total,
            'credit_amount', v_credit_amount
        ),
        null,
        v_correlation_id
    );


    return v_payment_id;
end;
$$;


revoke all
on function app_private.register_payment_internal(
    uuid,
    timestamptz,
    numeric,
    text,
    text,
    jsonb
)
from public;

grant execute
on function app_private.register_payment_internal(
    uuid,
    timestamptz,
    numeric,
    text,
    text,
    jsonb
)
to authenticated;


-- ============================================================
-- 2. RPC PÚBLICA
-- ============================================================
--
-- Wrapper SECURITY INVOKER.
--
-- La función privilegiada permanece en app_private.
-- ============================================================

create or replace function public.register_payment(
    p_student_id uuid,
    p_received_at timestamptz,
    p_amount numeric,
    p_method text,
    p_notes text default null,
    p_allocations jsonb default '[]'::jsonb
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
    select app_private.register_payment_internal(
        p_student_id,
        p_received_at,
        p_amount,
        p_method,
        p_notes,
        p_allocations
    );
$$;


revoke all
on function public.register_payment(
    uuid,
    timestamptz,
    numeric,
    text,
    text,
    jsonb
)
from public;

grant execute
on function public.register_payment(
    uuid,
    timestamptz,
    numeric,
    text,
    text,
    jsonb
)
to authenticated;