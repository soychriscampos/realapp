-- ============================================================
-- Extender register_payment con motivo de override de aplicación
-- ============================================================

drop function public.register_payment(
    uuid,
    timestamptz,
    numeric,
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb
);


drop function app_private.register_payment_internal(
    uuid,
    timestamptz,
    numeric,
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb
);


create function app_private.register_payment_internal(
    p_student_id uuid,
    p_received_at timestamptz,
    p_amount numeric,
    p_payment_method_id uuid,
    p_received_by_staff_id uuid,
    p_bank_reference text default null,
    p_notes text default null,
    p_receipt_visible_note text default null,
    p_allocations jsonb default '[]'::jsonb,
    p_allocation_override_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_profile_id uuid;
    v_actor_staff_id uuid;

    v_receiver_name text;

    v_method_code text;
    v_method_name text;
    v_method_classification text;
    v_method_requires_description boolean;

    v_payment_id uuid;
    v_payment_code text;

    v_allocated_total numeric := 0;
    v_credit_amount numeric := 0;

    v_charge_original numeric;
    v_charge_outstanding numeric;

    v_allocation record;

    v_allocation_override_reason text;

    v_correlation_id uuid := gen_random_uuid();
begin

    -- --------------------------------------------------------
    -- AUTH
    -- --------------------------------------------------------

    v_actor_profile_id := (select auth.uid());

    if v_actor_profile_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'payments.create',
        'ALL'
    ) then
        raise exception
            'Insufficient permission to register payments';
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
        raise exception
            'Payment amount must be greater than zero';
    end if;

    if p_received_by_staff_id is null then
        raise exception 'received_by_staff_id is required';
    end if;


    v_allocation_override_reason :=
        nullif(btrim(p_allocation_override_reason), '');


    -- --------------------------------------------------------
    -- RECEPTOR
    -- --------------------------------------------------------

    select
        s.full_name
    into
        v_receiver_name
    from public.staff s
    where s.id = p_received_by_staff_id
      and s.status = 'ACTIVE';

    if v_receiver_name is null then
        raise exception 'Active receiver staff not found';
    end if;


    v_actor_staff_id :=
        app_private.current_staff_id();


    -- ADMINISTRATIVO:
    -- sólo puede registrar pagos que él mismo recibió.
    --
    -- MASTER:
    -- puede registrar en nombre de otro receptor.

    if p_received_by_staff_id
       is distinct from v_actor_staff_id
       and not app_private.current_user_has_permission(
           'payments.receive_for_others',
           'ALL'
       )
    then
        raise exception
            'Cannot register payment for another receiver';
    end if;


    -- --------------------------------------------------------
    -- MÉTODO
    -- --------------------------------------------------------

    select
        upper(btrim(pm.code)),
        pm.name,
        pm.classification,
        pm.requires_description
    into
        v_method_code,
        v_method_name,
        v_method_classification,
        v_method_requires_description
    from public.payment_methods pm
    where pm.id = p_payment_method_id
      and pm.is_active = true;

    if v_method_code is null then
        raise exception 'Active payment method not found';
    end if;


    if v_method_requires_description
       and (
           p_notes is null
           or btrim(p_notes) = ''
       )
    then
        raise exception
            'Description is required for this payment method';
    end if;


    if p_allocations is null then
        p_allocations := '[]'::jsonb;
    end if;

    if jsonb_typeof(p_allocations) <> 'array' then
        raise exception 'allocations must be a JSON array';
    end if;


    -- --------------------------------------------------------
    -- EVITAR CARGO DUPLICADO
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
        raise exception
            'Each charge may appear only once in allocations';
    end if;


    -- --------------------------------------------------------
    -- VALIDAR / BLOQUEAR CARGOS
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


        select
            v_charge_original

            + coalesce((
                select sum(ca.amount)
                from public.charge_adjustments ca
                where ca.charge_id =
                      v_allocation.charge_id
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


    if v_allocated_total > p_amount then
        raise exception
            'Allocated total % exceeds payment amount %',
            v_allocated_total,
            p_amount;
    end if;


    -- --------------------------------------------------------
    -- CREAR PAGO
    -- --------------------------------------------------------

    v_payment_code :=
        'PAY-'
        || to_char(
            clock_timestamp(),
            'YYYYMMDDHH24MISSMS'
        )
        || '-'
        || upper(
            substr(
                gen_random_uuid()::text,
                1,
                8
            )
        );


    insert into public.payments (
        payment_code,
        student_id,
        received_at,
        amount,

        payment_method_id,
        method,
        method_name_snapshot,
        method_classification_snapshot,

        status,

        received_by_staff_id,
        received_by_name_snapshot,
        captured_by_profile_id,

        bank_reference,
        notes,
        receipt_visible_note
    )
    values (
        v_payment_code,
        p_student_id,
        p_received_at,
        p_amount,

        p_payment_method_id,
        v_method_code,
        v_method_name,
        v_method_classification,

        'CONFIRMED',

        p_received_by_staff_id,
        v_receiver_name,
        v_actor_profile_id,

        nullif(btrim(p_bank_reference), ''),
        nullif(btrim(p_notes), ''),
        nullif(btrim(p_receipt_visible_note), '')
    )
    returning id
    into v_payment_id;


    -- --------------------------------------------------------
    -- ALLOCATIONS
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
            v_actor_profile_id
        );

    end loop;


    -- --------------------------------------------------------
    -- EXCESO → CRÉDITO
    -- --------------------------------------------------------

    v_credit_amount :=
        p_amount - v_allocated_total;


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
        v_actor_profile_id,
        'PAYMENT_REGISTERED',
        'payments',
        v_payment_id,
        null,
        jsonb_build_object(
            'payment_code', v_payment_code,
            'student_id', p_student_id,
            'received_at', p_received_at,
            'amount', p_amount,
            'payment_method_id', p_payment_method_id,
            'method_code', v_method_code,
            'method_classification',
                v_method_classification,
            'received_by_staff_id',
                p_received_by_staff_id,
            'receiver_name',
                v_receiver_name,
            'captured_by_profile_id',
                v_actor_profile_id,
            'allocated_amount',
                v_allocated_total,
            'credit_amount',
                v_credit_amount,
            'allocation_override_reason',
                v_allocation_override_reason
        ),
        v_allocation_override_reason,
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
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb,
    text
)
from public, anon;


grant execute
on function app_private.register_payment_internal(
    uuid,
    timestamptz,
    numeric,
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb,
    text
)
to authenticated;


create function public.register_payment(
    p_student_id uuid,
    p_received_at timestamptz,
    p_amount numeric,
    p_payment_method_id uuid,
    p_received_by_staff_id uuid,
    p_bank_reference text default null,
    p_notes text default null,
    p_receipt_visible_note text default null,
    p_allocations jsonb default '[]'::jsonb,
    p_allocation_override_reason text default null
)
returns uuid
language sql
set search_path = ''
as $$
    select app_private.register_payment_internal(
        p_student_id,
        p_received_at,
        p_amount,
        p_payment_method_id,
        p_received_by_staff_id,
        p_bank_reference,
        p_notes,
        p_receipt_visible_note,
        p_allocations,
        p_allocation_override_reason
    );
$$;


revoke all
on function public.register_payment(
    uuid,
    timestamptz,
    numeric,
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb,
    text
)
from public, anon;


grant execute
on function public.register_payment(
    uuid,
    timestamptz,
    numeric,
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb,
    text
)
to authenticated;
