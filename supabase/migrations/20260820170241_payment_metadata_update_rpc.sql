-- ============================================================
-- M4.6 — Edición auditada de metadata no financiera del pago
-- ============================================================
--
-- Campos editables:
--   bank_reference
--   notes
--   receipt_visible_note
--
-- Campos financieros / operativos que NO toca:
--   student_id
--   amount
--   received_at
--   payment_method_id
--   method snapshots
--   received_by_staff_id
--   received_by_name_snapshot
--   captured_by_profile_id
--   status
--
-- Autorización:
--   MASTER          payments.reverse ALL
--   ADMINISTRATIVO  payments.reverse OWN
--                    según receptor original
--
-- El receptor original nunca cambia.
-- ============================================================


create or replace function
app_private.update_payment_metadata_internal(
    p_payment_id uuid,
    p_patch jsonb,
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

    v_payment_status text;
    v_payment_code text;

    v_received_by_staff_id uuid;

    v_payment_method_id uuid;
    v_method_requires_description boolean;

    v_old_bank_reference text;
    v_old_notes text;
    v_old_receipt_visible_note text;

    v_new_bank_reference text;
    v_new_notes text;
    v_new_receipt_visible_note text;

    v_changed boolean := false;

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


    if p_patch is null
       or jsonb_typeof(p_patch) <> 'object'
    then
        raise exception
            'patch must be a JSON object';
    end if;


    if p_patch = '{}'::jsonb then
        raise exception
            'patch cannot be empty';
    end if;


    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Edit reason is required';
    end if;


    -- ========================================================
    -- ONLY ALLOWED KEYS
    -- ========================================================

    if exists (
        select 1

        from jsonb_object_keys(
            p_patch
        ) as k(key_name)

        where key_name not in (
            'bank_reference',
            'notes',
            'receipt_visible_note'
        )
    )
    then
        raise exception
            'Patch contains non-editable payment fields';
    end if;


    -- ========================================================
    -- LOCK PAYMENT
    -- ========================================================

    select
        p.status,
        p.payment_code,

        p.received_by_staff_id,

        p.payment_method_id,

        p.bank_reference,
        p.notes,
        p.receipt_visible_note

    into
        v_payment_status,
        v_payment_code,

        v_received_by_staff_id,

        v_payment_method_id,

        v_old_bank_reference,
        v_old_notes,
        v_old_receipt_visible_note

    from public.payments p

    where p.id =
          p_payment_id

    for update;


    if not found then
        raise exception
            'Payment not found';
    end if;


    -- Metadata sólo se corrige mientras el pago
    -- sigue siendo un registro confirmado vigente.

    if v_payment_status <> 'CONFIRMED' then
        raise exception
            'Only confirmed payments can have metadata edited';
    end if;


    -- ========================================================
    -- AUTHORIZATION ALL / OWN
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
            'Insufficient permission to edit payment metadata';
    end if;


    -- ========================================================
    -- START WITH CURRENT VALUES
    -- ========================================================

    v_new_bank_reference :=
        v_old_bank_reference;

    v_new_notes :=
        v_old_notes;

    v_new_receipt_visible_note :=
        v_old_receipt_visible_note;


    -- ========================================================
    -- APPLY PATCH
    -- ========================================================

    if p_patch ? 'bank_reference' then

        v_new_bank_reference :=
            nullif(
                btrim(
                    p_patch ->> 'bank_reference'
                ),
                ''
            );

    end if;


    if p_patch ? 'notes' then

        v_new_notes :=
            nullif(
                btrim(
                    p_patch ->> 'notes'
                ),
                ''
            );

    end if;


    if p_patch ? 'receipt_visible_note' then

        v_new_receipt_visible_note :=
            nullif(
                btrim(
                    p_patch ->> 'receipt_visible_note'
                ),
                ''
            );

    end if;


    -- ========================================================
    -- PAYMENT METHOD REQUIREMENTS
    -- ========================================================

    select
        pm.requires_description

    into
        v_method_requires_description

    from public.payment_methods pm

    where pm.id =
          v_payment_method_id;


    if not found then
        raise exception
            'Payment method not found';
    end if;


    -- Ej. IN_KIND necesita conservar descripción.

    if v_method_requires_description
       and (
           v_new_notes is null
           or btrim(v_new_notes) = ''
       )
    then
        raise exception
            'Description is required for this payment method';
    end if;


    -- ========================================================
    -- DETECT REAL CHANGE
    -- ========================================================

    v_changed :=
        v_old_bank_reference
            is distinct from
        v_new_bank_reference

        or

        v_old_notes
            is distinct from
        v_new_notes

        or

        v_old_receipt_visible_note
            is distinct from
        v_new_receipt_visible_note;


    if not v_changed then
        raise exception
            'Patch does not change payment metadata';
    end if;


    -- ========================================================
    -- UPDATE ONLY NON-FINANCIAL METADATA
    -- ========================================================

    update public.payments
    set
        bank_reference =
            v_new_bank_reference,

        notes =
            v_new_notes,

        receipt_visible_note =
            v_new_receipt_visible_note,

        updated_at =
            statement_timestamp()

    where id =
          p_payment_id;


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

        'PAYMENT_METADATA_UPDATED',

        'payments',

        p_payment_id,

        jsonb_build_object(
            'payment_code',
                v_payment_code,

            'bank_reference',
                v_old_bank_reference,

            'notes',
                v_old_notes,

            'receipt_visible_note',
                v_old_receipt_visible_note,

            'received_by_staff_id',
                v_received_by_staff_id
        ),

        jsonb_build_object(
            'payment_code',
                v_payment_code,

            'bank_reference',
                v_new_bank_reference,

            'notes',
                v_new_notes,

            'receipt_visible_note',
                v_new_receipt_visible_note,

            'received_by_staff_id',
                v_received_by_staff_id
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
app_private.update_payment_metadata_internal(
    uuid,
    jsonb,
    text
)
from public, anon;


grant execute
on function
app_private.update_payment_metadata_internal(
    uuid,
    jsonb,
    text
)
to authenticated;



-- ============================================================
-- PUBLIC RPC
-- ============================================================

create or replace function
public.update_payment_metadata(
    p_payment_id uuid,
    p_patch jsonb,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.update_payment_metadata_internal(
            p_payment_id,
            p_patch,
            p_reason
        );
$$;


revoke all
on function
public.update_payment_metadata(
    uuid,
    jsonb,
    text
)
from public, anon;


grant execute
on function
public.update_payment_metadata(
    uuid,
    jsonb,
    text
)
to authenticated;


-- ============================================================
-- FIN M4.6
-- ============================================================