-- ============================================================
-- H7.4 — ALTA INTEGRAL DE ALUMNO NUEVO
--
-- Crea:
-- - student
-- - 1 o 2 guardians
-- - student_guardians
-- - enrollment activo
-- - inicialización financiera mediante la RPC canónica existente
--
-- Todo ocurre en una sola transacción.
-- ============================================================


create or replace function app_private.create_new_student_enrollment_internal(
    p_student_full_name text,
    p_student_sex text,
    p_student_birth_date date,
    p_contacts jsonb,

    p_cycle_id uuid,
    p_grade_level_id uuid,
    p_classification_id uuid,
    p_group_id uuid,

    p_activated_on date,
    p_classes_start_on date,
    p_economic_start_on date,

    p_initial_period_amount numeric default null,
    p_initial_period_due_date date default null,

    p_enrollment_fee_mode text default null,
    p_enrollment_fee_amount numeric default null,

    p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;

    v_student_id uuid;
    v_enrollment_id uuid;

    v_contact_count integer;
    v_contact jsonb;
    v_priority smallint := 1;

    v_guardian_id uuid;
    v_guardian_full_name text;
    v_guardian_phone text;
    v_guardian_email text;
    v_relationship text;

    v_student_name text;
begin

    -- ========================================================
    -- AUTH / PERMISSIONS
    -- ========================================================

    v_actor_id := auth.uid();

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    ) then
        raise exception
            'Insufficient permission to create student';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    ) then
        raise exception
            'Insufficient permission to initialize enrollment financials';
    end if;


    -- ========================================================
    -- STUDENT INPUT
    -- ========================================================

    v_student_name :=
        nullif(
            btrim(p_student_full_name),
            ''
        );

    if v_student_name is null then
        raise exception 'Student full name is required';
    end if;

    if p_student_sex is not null
       and p_student_sex not in ('H', 'M')
    then
        raise exception 'Invalid student sex';
    end if;


    -- ========================================================
    -- CONTACTS
    -- ========================================================

    if p_contacts is null
       or jsonb_typeof(p_contacts) <> 'array'
    then
        raise exception 'contacts must be a JSON array';
    end if;

    v_contact_count :=
        jsonb_array_length(p_contacts);

    if v_contact_count < 1 then
        raise exception
            'At least one contact is required';
    end if;

    if v_contact_count > 2 then
        raise exception
            'A maximum of two contacts is allowed';
    end if;


    -- ========================================================
    -- CREATE STUDENT
    -- ========================================================

    insert into public.students (
        full_name,
        sex,
        birth_date
    )
    values (
        v_student_name,
        p_student_sex,
        p_student_birth_date
    )
    returning id
    into v_student_id;


    -- ========================================================
    -- CREATE CONTACTS
    -- ========================================================

    for v_contact in
        select value
        from jsonb_array_elements(p_contacts)
    loop

        v_guardian_full_name :=
            nullif(
                btrim(v_contact ->> 'full_name'),
                ''
            );

        v_guardian_phone :=
            nullif(
                btrim(v_contact ->> 'phone'),
                ''
            );

        v_guardian_email :=
            nullif(
                btrim(v_contact ->> 'email'),
                ''
            );

        v_relationship :=
            nullif(
                btrim(v_contact ->> 'relationship'),
                ''
            );


        if v_guardian_full_name is null then
            raise exception
                'Contact full name is required';
        end if;

        if v_guardian_phone is null then
            raise exception
                'Contact phone is required';
        end if;

        if v_relationship is null then
            raise exception
                'Contact relationship is required';
        end if;


        insert into public.guardians (
            full_name,
            phone,
            email
        )
        values (
            v_guardian_full_name,
            v_guardian_phone,
            v_guardian_email
        )
        returning id
        into v_guardian_id;


        insert into public.student_guardians (
            student_id,
            guardian_id,
            relationship,
            priority,
            via_whatsapp,
            via_email,
            is_active,
            started_at
        )
        values (
            v_student_id,
            v_guardian_id,
            v_relationship,
            v_priority,
            true,
            (v_guardian_email is not null),
            true,
            p_activated_on
        );


        v_priority :=
            v_priority + 1;

    end loop;


    -- ========================================================
    -- CREATE + ACTIVATE ENROLLMENT
    --
    -- Reutiliza completamente la lógica canónica existente.
    -- No duplicamos reglas financieras aquí.
    -- ========================================================

    v_enrollment_id :=
        app_private.create_and_activate_enrollment_internal(
            v_student_id,
            p_cycle_id,
            p_grade_level_id,
            p_classification_id,
            p_group_id,

            p_activated_on,
            p_classes_start_on,
            p_economic_start_on,

            p_initial_period_amount,
            p_initial_period_due_date,

            p_enrollment_fee_mode,
            p_enrollment_fee_amount,

            p_reason
        );


    -- ========================================================
    -- RESULT
    -- ========================================================

    return jsonb_build_object(
        'student_id',
            v_student_id,

        'enrollment_id',
            v_enrollment_id
    );

end;
$$;


-- ============================================================
-- PUBLIC RPC
-- ============================================================

create or replace function public.create_new_student_enrollment(
    p_student_full_name text,
    p_student_sex text,
    p_student_birth_date date,
    p_contacts jsonb,

    p_cycle_id uuid,
    p_grade_level_id uuid,
    p_classification_id uuid,
    p_group_id uuid,

    p_activated_on date,
    p_classes_start_on date,
    p_economic_start_on date,

    p_initial_period_amount numeric default null,
    p_initial_period_due_date date default null,

    p_enrollment_fee_mode text default null,
    p_enrollment_fee_amount numeric default null,

    p_reason text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
    select app_private.create_new_student_enrollment_internal(
        p_student_full_name,
        p_student_sex,
        p_student_birth_date,
        p_contacts,

        p_cycle_id,
        p_grade_level_id,
        p_classification_id,
        p_group_id,

        p_activated_on,
        p_classes_start_on,
        p_economic_start_on,

        p_initial_period_amount,
        p_initial_period_due_date,

        p_enrollment_fee_mode,
        p_enrollment_fee_amount,

        p_reason
    );
$$;


-- ============================================================
-- PRIVILEGES
-- ============================================================

revoke all
on function app_private.create_new_student_enrollment_internal(
    text,
    text,
    date,
    jsonb,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text,
    numeric,
    text
)
from public, anon, authenticated;


revoke all
on function public.create_new_student_enrollment(
    text,
    text,
    date,
    jsonb,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text,
    numeric,
    text
)
from public, anon;


grant execute
on function public.create_new_student_enrollment(
    text,
    text,
    date,
    jsonb,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text,
    numeric,
    text
)
to authenticated;