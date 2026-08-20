-- ============================================================
-- M4.4 — Corrección de allocations de un pago
-- ============================================================
--
-- Reemplaza el conjunto ACTIVO de allocations de un pago
-- confirmado, conservando exactamente el mismo total asignado.
--
-- No cambia:
--   payments.amount
--   payments.student_id
--   received_by_staff_id
--   captured_by_profile_id
--   payment method
--   credits
--
-- Historial:
--   allocations anteriores -> reversed_at
--   allocations nuevas      -> nuevas filas MANUAL
--
-- ============================================================


create or replace function
app_private.correct_payment_allocations_internal(
    p_payment_id uuid,
    p_allocations jsonb,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_profile_id uuid;
    v_actor_staff_id uuid;

    v_student_id uuid;
    v_payment_amount numeric;
    v_payment_code text;
    v_payment_status text;
    v_received_by_staff_id uuid;

    v_existing_allocated_total numeric := 0;
    v_new_allocated_total numeric := 0;

    v_reversed_at timestamptz :=
        statement_timestamp();

    v_allocation record;

    v_charge_original numeric;
    v_charge_effective numeric;
    v_other_payment_applied numeric;
    v_credit_applied numeric;
    v_charge_capacity numeric;

    v_old_allocations jsonb;
    v_new_allocations jsonb;

    v_reversed_count integer := 0;
    v_created_count integer := 0;

    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- ========================================================
    -- AUTH
    -- ========================================================

    v_actor_profile_id :=
        (select auth.uid());


    if v_actor_profile_id is null then
        raise exception
            'Authentication required';
    end if;


    if not app_private.current_user_is_active() then
        raise exception
            'Inactive user';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_payment_id is null then
        raise exception
            'payment_id is required';
    end if;


    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Correction reason is required';
    end if;


    if p_allocations is null then
        raise exception
            'allocations are required';
    end if;


    if jsonb_typeof(p_allocations) <> 'array' then
        raise exception
            'allocations must be a JSON array';
    end if;


    if jsonb_array_length(p_allocations) = 0 then
        raise exception
            'At least one allocation is required';
    end if;


    -- ========================================================
    -- LOCK PAYMENT
    -- ========================================================

    select
        p.student_id,
        p.amount,
        p.payment_code,
        p.status,
        p.received_by_staff_id

    into
        v_student_id,
        v_payment_amount,
        v_payment_code,
        v_payment_status,
        v_received_by_staff_id

    from public.payments p

    where p.id =
          p_payment_id

    for update;


    if not found then
        raise exception
            'Payment not found';
    end if;


    -- ========================================================
    -- AUTHORIZATION: ALL / OWN
    -- ========================================================

    v_actor_staff_id :=
        app_private.current_staff_id();


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

            and v_actor_staff_id is not null

            and v_received_by_staff_id =
                v_actor_staff_id
        )
    )
    then
        raise exception
            'Insufficient permission to correct payment allocations';
    end if;


    -- ========================================================
    -- PAYMENT STATE
    -- ========================================================

    if v_payment_status <> 'CONFIRMED' then
        raise exception
            'Only confirmed payments can have allocations corrected';
    end if;


    if exists (
        select 1

        from public.payment_reversals pr

        where pr.payment_id =
              p_payment_id
    )
    then
        raise exception
            'Reversed payment cannot have allocations corrected';
    end if;


    -- Refunds make allocation correction ambiguous because part
    -- of the payment has already been financially returned.

    if exists (
        select 1

        from public.refunds r

        where r.payment_id =
              p_payment_id
    )
    then
        raise exception
            'Payment with refunds cannot have allocations corrected';
    end if;


    -- ========================================================
    -- LOCK ACTIVE CURRENT ALLOCATIONS
    -- ========================================================

    perform pa.id

    from public.payment_allocations pa

    where pa.payment_id =
          p_payment_id

      and pa.reversed_at is null

    order by pa.id

    for update;


    -- ========================================================
    -- CURRENT ALLOCATION SNAPSHOT
    -- ========================================================

    select
        coalesce(
            sum(pa.amount),
            0
        ),

        coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'allocation_id',
                        pa.id,
                    'charge_id',
                        pa.charge_id,
                    'amount',
                        pa.amount,
                    'allocation_mode',
                        pa.allocation_mode
                )
                order by pa.created_at,
                         pa.id
            ),
            '[]'::jsonb
        )

    into
        v_existing_allocated_total,
        v_old_allocations

    from public.payment_allocations pa

    where pa.payment_id =
          p_payment_id

      and pa.reversed_at is null;


    if v_existing_allocated_total <= 0 then
        raise exception
            'Payment has no active allocations to correct';
    end if;


    -- ========================================================
    -- DUPLICATES / MALFORMED INPUT
    -- ========================================================

    if exists (
        select 1

        from (
            select
                value ->> 'charge_id'
                    as charge_id,

                count(*)
                    as occurrences

            from jsonb_array_elements(
                p_allocations
            )

            group by
                value ->> 'charge_id'
        ) x

        where x.charge_id is null
           or x.charge_id = ''
           or x.occurrences > 1
    )
    then
        raise exception
            'Each charge may appear only once in allocations';
    end if;


    -- ========================================================
    -- LOCK ALL TARGET CHARGES
    -- ========================================================

    perform c.id

    from public.charges c

    where c.id in (
        select
            (
                value ->> 'charge_id'
            )::uuid

        from jsonb_array_elements(
            p_allocations
        )
    )

    order by c.id

    for update;


    -- ========================================================
    -- VALIDATE NEW ALLOCATIONS
    -- ========================================================

    for v_allocation in

        select
            (
                value ->> 'charge_id'
            )::uuid
                as charge_id,

            (
                value ->> 'amount'
            )::numeric
                as amount

        from jsonb_array_elements(
            p_allocations
        )

        order by
            (
                value ->> 'charge_id'
            )::uuid

    loop

        if v_allocation.amount is null
           or v_allocation.amount <= 0
        then
            raise exception
                'Allocation amount must be greater than zero';
        end if;


        -- ----------------------------------------------------
        -- Charge must be ACTIVE and belong to same student.
        -- ----------------------------------------------------

        select
            c.original_amount

        into
            v_charge_original

        from public.charges c

        where c.id =
              v_allocation.charge_id

          and c.student_id =
              v_student_id

          and c.status =
              'ACTIVE';


        if not found then
            raise exception
                'Active charge % does not belong to payment student %',
                v_allocation.charge_id,
                v_student_id;
        end if;


        -- ----------------------------------------------------
        -- Effective obligation
        -- ----------------------------------------------------

        select
            v_charge_original

            + coalesce((
                select sum(ca.amount)

                from public.charge_adjustments ca

                where ca.charge_id =
                      v_allocation.charge_id
            ), 0)

        into
            v_charge_effective;


        -- ----------------------------------------------------
        -- Other payments already applied
        --
        -- IMPORTANT:
        -- excludes THIS payment because we are replacing its
        -- allocations.
        -- ----------------------------------------------------

        select
            coalesce(
                sum(pa.amount),
                0
            )

        into
            v_other_payment_applied

        from public.payment_allocations pa

        join public.payments p
          on p.id =
             pa.payment_id

        where pa.charge_id =
              v_allocation.charge_id

          and pa.payment_id <>
              p_payment_id

          and pa.reversed_at is null

          and p.status =
              'CONFIRMED';


        -- ----------------------------------------------------
        -- Active credits applied
        -- ----------------------------------------------------

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
              v_allocation.charge_id

          and capp.reversed_at is null

          and cr.status =
              'ACTIVE';


        v_charge_capacity :=
            v_charge_effective
            - v_other_payment_applied
            - v_credit_applied;


        if v_charge_capacity < 0 then
            raise exception
                'Charge % has invalid negative available capacity',
                v_allocation.charge_id;
        end if;


        if v_allocation.amount >
           v_charge_capacity
        then
            raise exception
                'Allocation % exceeds available amount % for charge %',
                v_allocation.amount,
                v_charge_capacity,
                v_allocation.charge_id;
        end if;


        v_new_allocated_total :=
            v_new_allocated_total
            + v_allocation.amount;

    end loop;


    -- ========================================================
    -- PRESERVE ALLOCATED TOTAL
    -- ========================================================

    if v_new_allocated_total <>
       v_existing_allocated_total
    then
        raise exception
            'New allocated total % must equal current allocated total %',
            v_new_allocated_total,
            v_existing_allocated_total;
    end if;


    if v_new_allocated_total >
       v_payment_amount
    then
        raise exception
            'Allocated total cannot exceed payment amount';
    end if;


    -- ========================================================
    -- REVERSE OLD ACTIVE ALLOCATIONS
    -- ========================================================

    update public.payment_allocations

    set reversed_at =
        v_reversed_at

    where payment_id =
          p_payment_id

      and reversed_at is null;


    get diagnostics
        v_reversed_count =
            row_count;


    -- ========================================================
    -- INSERT CORRECTED ALLOCATIONS
    -- ========================================================

    for v_allocation in

        select
            (
                value ->> 'charge_id'
            )::uuid
                as charge_id,

            (
                value ->> 'amount'
            )::numeric
                as amount

        from jsonb_array_elements(
            p_allocations
        )

        order by
            (
                value ->> 'charge_id'
            )::uuid

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
            v_student_id,
            p_payment_id,
            v_allocation.charge_id,
            v_allocation.amount,
            'MANUAL',
            v_actor_profile_id
        );


        v_created_count :=
            v_created_count + 1;

    end loop;


    -- ========================================================
    -- SNAPSHOT NEW ALLOCATIONS
    -- ========================================================

    select
        coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'allocation_id',
                        pa.id,
                    'charge_id',
                        pa.charge_id,
                    'amount',
                        pa.amount,
                    'allocation_mode',
                        pa.allocation_mode
                )
                order by pa.created_at,
                         pa.id
            ),
            '[]'::jsonb
        )

    into
        v_new_allocations

    from public.payment_allocations pa

    where pa.payment_id =
          p_payment_id

      and pa.reversed_at is null;


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
        v_actor_profile_id,

        'PAYMENT_ALLOCATIONS_CORRECTED',

        'payments',

        p_payment_id,

        jsonb_build_object(
            'payment_code',
                v_payment_code,

            'student_id',
                v_student_id,

            'payment_amount',
                v_payment_amount,

            'allocated_total',
                v_existing_allocated_total,

            'allocations',
                v_old_allocations
        ),

        jsonb_build_object(
            'payment_code',
                v_payment_code,

            'student_id',
                v_student_id,

            'payment_amount',
                v_payment_amount,

            'allocated_total',
                v_new_allocated_total,

            'reversed_allocations',
                v_reversed_count,

            'created_allocations',
                v_created_count,

            'allocations',
                v_new_allocations
        ),

        btrim(p_reason),

        v_correlation_id
    );


    return v_correlation_id;

end;
$$;



-- ============================================================
-- INTERNAL PRIVILEGES
-- ============================================================

revoke all
on function
app_private.correct_payment_allocations_internal(
    uuid,
    jsonb,
    text
)
from public, anon;


grant execute
on function
app_private.correct_payment_allocations_internal(
    uuid,
    jsonb,
    text
)
to authenticated;



-- ============================================================
-- PUBLIC RPC
-- ============================================================

create or replace function
public.correct_payment_allocations(
    p_payment_id uuid,
    p_allocations jsonb,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.correct_payment_allocations_internal(
            p_payment_id,
            p_allocations,
            p_reason
        );
$$;


revoke all
on function
public.correct_payment_allocations(
    uuid,
    jsonb,
    text
)
from public, anon;


grant execute
on function
public.correct_payment_allocations(
    uuid,
    jsonb,
    text
)
to authenticated;


-- ============================================================
-- FIN M4.4
-- ============================================================