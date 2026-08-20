-- ============================================================
-- M4.5 — Reversa / corrección de aplicaciones de crédito
-- ============================================================
--
-- El crédito:
--   - siempre pertenece al mismo alumno
--   - conserva source_payment_id
--   - conserva original_amount
--   - nunca se transfiere
--
-- Corrección:
--   aplicación anterior -> reversed_at
--   aplicación nueva    -> nueva fila
--
-- Autorización:
--   MASTER          payments.reverse ALL
--   ADMINISTRATIVO  payments.reverse OWN
--                    según receptor del pago origen
-- ============================================================


-- ============================================================
-- 1. REVERSAR UNA APLICACIÓN DE CRÉDITO
-- ============================================================

create or replace function
app_private.reverse_credit_application_internal(
    p_credit_application_id uuid,
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

    v_credit_id uuid;
    v_charge_id uuid;
    v_student_id uuid;
    v_amount numeric;
    v_created_at timestamptz;

    v_source_payment_id uuid;
    v_received_by_staff_id uuid;
    v_payment_status text;
    v_credit_status text;

    v_credit_available_before numeric;
    v_reversed_at timestamptz :=
        statement_timestamp();

    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- --------------------------------------------------------
    -- AUTH
    -- --------------------------------------------------------

    v_actor_profile_id :=
        (select auth.uid());

    if v_actor_profile_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if p_credit_application_id is null then
        raise exception 'credit_application_id is required';
    end if;

    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception 'Reversal reason is required';
    end if;


    -- --------------------------------------------------------
    -- LOCK APPLICATION
    -- --------------------------------------------------------

    select
        ca.credit_id,
        ca.charge_id,
        ca.student_id,
        ca.amount,
        ca.created_at

    into
        v_credit_id,
        v_charge_id,
        v_student_id,
        v_amount,
        v_created_at

    from public.credit_applications ca

    where ca.id =
          p_credit_application_id

      and ca.reversed_at is null

    for update;


    if not found then
        raise exception
            'Active credit application not found';
    end if;


    -- --------------------------------------------------------
    -- LOCK CREDIT + SOURCE PAYMENT
    -- --------------------------------------------------------

    select
        cr.source_payment_id,
        cr.status,
        p.received_by_staff_id,
        p.status

    into
        v_source_payment_id,
        v_credit_status,
        v_received_by_staff_id,
        v_payment_status

    from public.credits cr

    join public.payments p
      on p.id =
         cr.source_payment_id

    where cr.id =
          v_credit_id

    for update of cr, p;


    if not found then
        raise exception
            'Credit or source payment not found';
    end if;


    if v_credit_status <> 'ACTIVE' then
        raise exception
            'Only active credits can have applications reversed';
    end if;


    if v_payment_status <> 'CONFIRMED' then
        raise exception
            'Source payment must be confirmed';
    end if;


    -- --------------------------------------------------------
    -- AUTHORIZATION ALL / OWN
    -- --------------------------------------------------------

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
            'Insufficient permission to reverse credit application';
    end if;


    -- --------------------------------------------------------
    -- AVAILABLE CREDIT BEFORE
    -- --------------------------------------------------------

    v_credit_available_before :=
        app_private.credit_available_balance(
            v_credit_id
        );


    -- --------------------------------------------------------
    -- REVERSE
    -- --------------------------------------------------------

    update public.credit_applications
    set reversed_at =
        v_reversed_at
    where id =
          p_credit_application_id;


    -- --------------------------------------------------------
    -- AUDIT
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
        v_actor_profile_id,

        'CREDIT_APPLICATION_REVERSED',

        'credit_applications',

        p_credit_application_id,

        jsonb_build_object(
            'credit_id',
                v_credit_id,
            'charge_id',
                v_charge_id,
            'student_id',
                v_student_id,
            'amount',
                v_amount,
            'created_at',
                v_created_at,
            'reversed_at',
                null,
            'credit_available',
                v_credit_available_before
        ),

        jsonb_build_object(
            'credit_id',
                v_credit_id,
            'charge_id',
                v_charge_id,
            'student_id',
                v_student_id,
            'amount',
                v_amount,
            'reversed_at',
                v_reversed_at,
            'credit_available',
                v_credit_available_before
                + v_amount
        ),

        btrim(p_reason),

        v_correlation_id
    );


    return p_credit_application_id;

end;
$$;



-- ============================================================
-- 2. CORREGIR UNA APLICACIÓN
-- ============================================================

create or replace function
app_private.correct_credit_application_internal(
    p_credit_application_id uuid,
    p_target_charge_id uuid,
    p_target_amount numeric,
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

    v_credit_id uuid;
    v_old_charge_id uuid;
    v_student_id uuid;
    v_old_amount numeric;

    v_source_payment_id uuid;
    v_received_by_staff_id uuid;
    v_payment_status text;

    v_credit_status text;
    v_reserved_charge_id uuid;

    v_credit_available_before numeric;
    v_credit_available_after_reverse numeric;

    v_charge_original numeric;
    v_charge_effective numeric;
    v_payment_applied numeric;
    v_other_credit_applied numeric;
    v_charge_available numeric;

    v_new_application_id uuid;

    v_reversed_at timestamptz :=
        statement_timestamp();

    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- --------------------------------------------------------
    -- AUTH / INPUT
    -- --------------------------------------------------------

    v_actor_profile_id :=
        (select auth.uid());

    if v_actor_profile_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if p_credit_application_id is null then
        raise exception
            'credit_application_id is required';
    end if;

    if p_target_charge_id is null then
        raise exception
            'target_charge_id is required';
    end if;

    if p_target_amount is null
       or p_target_amount <= 0
    then
        raise exception
            'target_amount must be greater than zero';
    end if;

    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Correction reason is required';
    end if;


    -- --------------------------------------------------------
    -- LOCK CURRENT APPLICATION
    -- --------------------------------------------------------

    select
        ca.credit_id,
        ca.charge_id,
        ca.student_id,
        ca.amount

    into
        v_credit_id,
        v_old_charge_id,
        v_student_id,
        v_old_amount

    from public.credit_applications ca

    where ca.id =
          p_credit_application_id

      and ca.reversed_at is null

    for update;


    if not found then
        raise exception
            'Active credit application not found';
    end if;


    if v_old_charge_id =
       p_target_charge_id

       and v_old_amount =
           p_target_amount
    then
        raise exception
            'Correction does not change charge or amount';
    end if;


    -- --------------------------------------------------------
    -- LOCK CREDIT + PAYMENT
    -- --------------------------------------------------------

    select
        cr.source_payment_id,
        cr.status,
        cr.reserved_charge_id,
        p.received_by_staff_id,
        p.status

    into
        v_source_payment_id,
        v_credit_status,
        v_reserved_charge_id,
        v_received_by_staff_id,
        v_payment_status

    from public.credits cr

    join public.payments p
      on p.id =
         cr.source_payment_id

    where cr.id =
          v_credit_id

    for update of cr, p;


    if not found then
        raise exception
            'Credit or source payment not found';
    end if;


    if v_credit_status <> 'ACTIVE' then
        raise exception
            'Only active credits can be corrected';
    end if;


    if v_payment_status <> 'CONFIRMED' then
        raise exception
            'Source payment must be confirmed';
    end if;


    -- --------------------------------------------------------
    -- AUTHORIZATION ALL / OWN
    -- --------------------------------------------------------

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
            'Insufficient permission to correct credit application';
    end if;


    -- --------------------------------------------------------
    -- RESERVED CREDIT
    -- --------------------------------------------------------

    if v_reserved_charge_id is not null
       and v_reserved_charge_id <>
           p_target_charge_id
    then
        raise exception
            'Credit is reserved for another charge';
    end if;


    -- --------------------------------------------------------
    -- CREDIT CAPACITY
    -- --------------------------------------------------------

    v_credit_available_before :=
        app_private.credit_available_balance(
            v_credit_id
        );


    if v_credit_available_before is null then
        raise exception
            'Credit available balance could not be determined';
    end if;


    -- Al reversar la aplicación actual, su monto vuelve
    -- temporalmente al saldo disponible.

    v_credit_available_after_reverse :=
        v_credit_available_before
        + v_old_amount;


    if p_target_amount >
       v_credit_available_after_reverse
    then
        raise exception
            'Target amount % exceeds available credit after correction %',
            p_target_amount,
            v_credit_available_after_reverse;
    end if;


    -- --------------------------------------------------------
    -- LOCK TARGET CHARGE
    -- --------------------------------------------------------

    select c.original_amount
    into v_charge_original

    from public.charges c

    where c.id =
          p_target_charge_id

      and c.student_id =
          v_student_id

      and c.status =
          'ACTIVE'

    for update;


    if not found then
        raise exception
            'Target charge is not active or belongs to another student';
    end if;


    -- --------------------------------------------------------
    -- TARGET CHARGE EFFECTIVE AMOUNT
    -- --------------------------------------------------------

    select
        v_charge_original

        + coalesce((
            select sum(adj.amount)

            from public.charge_adjustments adj

            where adj.charge_id =
                  p_target_charge_id
        ), 0)

    into v_charge_effective;


    -- --------------------------------------------------------
    -- PAYMENTS ALREADY APPLIED
    -- --------------------------------------------------------

    select
        coalesce(
            sum(pa.amount),
            0
        )

    into v_payment_applied

    from public.payment_allocations pa

    join public.payments p
      on p.id =
         pa.payment_id

    where pa.charge_id =
          p_target_charge_id

      and pa.reversed_at is null

      and p.status =
          'CONFIRMED';


    -- --------------------------------------------------------
    -- OTHER ACTIVE CREDIT APPLICATIONS
    --
    -- Excludes the application currently being corrected.
    -- --------------------------------------------------------

    select
        coalesce(
            sum(ca.amount),
            0
        )

    into v_other_credit_applied

    from public.credit_applications ca

    join public.credits cr
      on cr.id =
         ca.credit_id

    where ca.charge_id =
          p_target_charge_id

      and ca.id <>
          p_credit_application_id

      and ca.reversed_at is null

      and cr.status =
          'ACTIVE';


    v_charge_available :=
        v_charge_effective
        - v_payment_applied
        - v_other_credit_applied;


    if v_charge_available <= 0 then
        raise exception
            'Target charge has no available balance';
    end if;


    if p_target_amount >
       v_charge_available
    then
        raise exception
            'Target amount % exceeds target charge available balance %',
            p_target_amount,
            v_charge_available;
    end if;


    -- --------------------------------------------------------
    -- REVERSE OLD APPLICATION
    -- --------------------------------------------------------

    update public.credit_applications
    set reversed_at =
        v_reversed_at
    where id =
          p_credit_application_id;


    -- --------------------------------------------------------
    -- CREATE CORRECTED APPLICATION
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
        v_credit_id,
        p_target_charge_id,
        p_target_amount,
        v_actor_profile_id
    )
    returning id
    into v_new_application_id;


    -- --------------------------------------------------------
    -- AUDIT
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
        v_actor_profile_id,

        'CREDIT_APPLICATION_CORRECTED',

        'credit_applications',

        v_new_application_id,

        jsonb_build_object(
            'application_id',
                p_credit_application_id,
            'credit_id',
                v_credit_id,
            'student_id',
                v_student_id,
            'charge_id',
                v_old_charge_id,
            'amount',
                v_old_amount,
            'credit_available_before',
                v_credit_available_before
        ),

        jsonb_build_object(
            'application_id',
                v_new_application_id,
            'replaces_application_id',
                p_credit_application_id,
            'credit_id',
                v_credit_id,
            'student_id',
                v_student_id,
            'charge_id',
                p_target_charge_id,
            'amount',
                p_target_amount,
            'credit_available_after',
                v_credit_available_after_reverse
                - p_target_amount
        ),

        btrim(p_reason),

        v_correlation_id
    );


    return v_new_application_id;

end;
$$;



-- ============================================================
-- 3. INTERNAL PRIVILEGES
-- ============================================================

revoke all
on function
app_private.reverse_credit_application_internal(
    uuid,
    text
)
from public, anon;


grant execute
on function
app_private.reverse_credit_application_internal(
    uuid,
    text
)
to authenticated;


revoke all
on function
app_private.correct_credit_application_internal(
    uuid,
    uuid,
    numeric,
    text
)
from public, anon;


grant execute
on function
app_private.correct_credit_application_internal(
    uuid,
    uuid,
    numeric,
    text
)
to authenticated;



-- ============================================================
-- 4. PUBLIC RPC — REVERSE
-- ============================================================

create or replace function
public.reverse_credit_application(
    p_credit_application_id uuid,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.reverse_credit_application_internal(
            p_credit_application_id,
            p_reason
        );
$$;


revoke all
on function
public.reverse_credit_application(
    uuid,
    text
)
from public, anon;


grant execute
on function
public.reverse_credit_application(
    uuid,
    text
)
to authenticated;



-- ============================================================
-- 5. PUBLIC RPC — CORRECT
-- ============================================================

create or replace function
public.correct_credit_application(
    p_credit_application_id uuid,
    p_target_charge_id uuid,
    p_target_amount numeric,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.correct_credit_application_internal(
            p_credit_application_id,
            p_target_charge_id,
            p_target_amount,
            p_reason
        );
$$;


revoke all
on function
public.correct_credit_application(
    uuid,
    uuid,
    numeric,
    text
)
from public, anon;


grant execute
on function
public.correct_credit_application(
    uuid,
    uuid,
    numeric,
    text
)
to authenticated;


-- ============================================================
-- FIN M4.5
-- ============================================================