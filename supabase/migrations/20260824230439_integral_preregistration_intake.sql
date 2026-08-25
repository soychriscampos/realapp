-- ============================================================
-- H7.3B — FLUJO INTEGRAL "PREINSCRIBIR ALUMNO"
-- ============================================================


-- ------------------------------------------------------------
-- 1. FECHA REAL DE PREINSCRIPCIÓN
-- ------------------------------------------------------------

alter table public.preregistrations
add column if not exists preregistered_on date;

update public.preregistrations
set preregistered_on = created_at::date
where preregistered_on is null;

alter table public.preregistrations
alter column preregistered_on set not null;


-- ------------------------------------------------------------
-- 2. GRUPO DESTINO
-- ------------------------------------------------------------

alter table public.preregistrations
add column if not exists target_group_id uuid;

alter table public.preregistrations
add constraint preregistrations_target_group_fk
foreign key (
    target_group_id,
    target_cycle_id,
    target_grade_level_id
)
references public.groups (
    id,
    cycle_id,
    grade_level_id
)
on delete restrict;


-- ============================================================
-- 3. RPC INTERNA
--
-- p_student_id:
--   existente -> reutiliza alumno
--   null      -> crea alumno nuevo
--
-- p_contacts:
-- [
--   {
--     "guardian_id": "...", -- opcional
--     "full_name": "...",
--     "phone": "...",
--     "email": "...",
--     "relationship": "Madre"
--   }
-- ]
--
-- Máximo 2 contactos.
-- ============================================================

create or replace function app_private.create_preregistration_intake_internal(
    p_preregistered_on date,

    p_student_id uuid,
    p_student_full_name text,

    p_target_cycle_id uuid,
    p_target_education_level_id uuid,
    p_target_grade_level_id uuid,
    p_target_group_id uuid,

    p_campaign_id uuid,

    p_contacts jsonb,

    p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;

    v_student_id uuid;
    v_preregistration_id uuid;
    v_charge_id uuid;

    v_campaign public.preregistration_campaigns%rowtype;

    v_contact jsonb;
    v_guardian_id uuid;
    v_contact_count integer;
    v_priority smallint := 1;

    v_relationship text;
    v_full_name text;
    v_phone text;
    v_email text;

    v_correlation_id uuid := gen_random_uuid();
begin

    -- ========================================================
    -- AUTH
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
            'Insufficient permission to create preregistration';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    ) then
        raise exception
            'Insufficient permission to create preregistration financials';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_preregistered_on is null then
        raise exception 'preregistered_on is required';
    end if;

    if p_target_cycle_id is null then
        raise exception 'target_cycle_id is required';
    end if;

    if p_target_education_level_id is null then
        raise exception 'target_education_level_id is required';
    end if;

    if p_target_grade_level_id is null then
        raise exception 'target_grade_level_id is required';
    end if;

    if p_target_group_id is null then
        raise exception 'target_group_id is required';
    end if;

    if p_campaign_id is null then
        raise exception 'campaign_id is required';
    end if;


    -- ========================================================
    -- CAMPAÑA
    -- ========================================================

    select pc.*
    into v_campaign
    from public.preregistration_campaigns pc
    where pc.id = p_campaign_id
    for update;

    if not found then
        raise exception 'Preregistration campaign not found';
    end if;

    if v_campaign.status <> 'ACTIVE' then
        raise exception 'Preregistration campaign is not active';
    end if;


    -- La fecha REAL de preinscripción debe caer dentro
    -- de la campaña. Esto permite captura retroactiva.

    if p_preregistered_on < v_campaign.starts_on
       or p_preregistered_on > v_campaign.ends_on
    then
        raise exception
            'Preregistration date is outside campaign dates';
    end if;


    if v_campaign.target_cycle_id
       is distinct from p_target_cycle_id
    then
        raise exception
            'Campaign does not belong to target cycle';
    end if;


    if v_campaign.education_level_id is not null
       and v_campaign.education_level_id
           is distinct from p_target_education_level_id
    then
        raise exception
            'Campaign does not apply to target education level';
    end if;


    if v_campaign.covered_concept_id is null then
        raise exception
            'Campaign has no covered financial concept';
    end if;


    -- ========================================================
    -- DESTINO: NIVEL / GRADO / GRUPO
    -- ========================================================

    if not exists (
        select 1
        from public.grade_levels gl
        where gl.id = p_target_grade_level_id
          and gl.education_level_id =
              p_target_education_level_id
    ) then
        raise exception
            'Target grade does not belong to education level';
    end if;


    if not exists (
        select 1
        from public.groups g
        where g.id = p_target_group_id
          and g.cycle_id = p_target_cycle_id
          and g.grade_level_id =
              p_target_grade_level_id
          and g.is_active = true
    ) then
        raise exception
            'Target group is not valid for cycle and grade';
    end if;


    -- ========================================================
    -- ALUMNO EXISTENTE O NUEVO
    -- ========================================================

    if p_student_id is not null then

        select s.id
        into v_student_id
        from public.students s
        where s.id = p_student_id;

        if v_student_id is null then
            raise exception 'Student not found';
        end if;

    else

        if p_student_full_name is null
           or btrim(p_student_full_name) = ''
        then
            raise exception
                'Student full name is required for new student';
        end if;

        insert into public.students (
            full_name
        )
        values (
            btrim(p_student_full_name)
        )
        returning id
        into v_student_id;

    end if;


    -- ========================================================
    -- DUPLICADOS
    -- ========================================================

    if exists (
        select 1
        from public.preregistrations pr
        where pr.student_id = v_student_id
          and pr.target_cycle_id = p_target_cycle_id
    ) then
        raise exception
            'Student already has a preregistration for target cycle';
    end if;


    if exists (
        select 1
        from public.enrollments e
        where e.student_id = v_student_id
          and e.cycle_id = p_target_cycle_id
    ) then
        raise exception
            'Student already has an enrollment for target cycle';
    end if;


    -- ========================================================
    -- CONTACTOS
    -- ========================================================

    if p_contacts is null
       or jsonb_typeof(p_contacts) <> 'array'
    then
        raise exception 'contacts must be a JSON array';
    end if;

    v_contact_count := jsonb_array_length(p_contacts);

    if v_contact_count < 1 then
        raise exception
            'At least one contact is required';
    end if;

    if v_contact_count > 2 then
        raise exception
            'A maximum of two contacts is allowed';
    end if;


    for v_contact in
        select value
        from jsonb_array_elements(p_contacts)
    loop

        v_guardian_id :=
            nullif(v_contact ->> 'guardian_id', '')::uuid;

        v_full_name :=
            nullif(btrim(v_contact ->> 'full_name'), '');

        v_phone :=
            nullif(btrim(v_contact ->> 'phone'), '');

        v_email :=
            nullif(btrim(v_contact ->> 'email'), '');

        v_relationship :=
            coalesce(
                nullif(
                    btrim(v_contact ->> 'relationship'),
                    ''
                ),
                'Contacto'
            );


        if v_full_name is null then
            raise exception 'Contact full name is required';
        end if;

        if v_phone is null then
            raise exception 'Contact phone is required';
        end if;


        -- ----------------------------------------------------
        -- CONTACTO EXISTENTE
        -- ----------------------------------------------------

        if v_guardian_id is not null then

            -- Para evitar editar accidentalmente a un tutor
            -- ajeno, solo se acepta un guardian_id ya vinculado
            -- a este alumno.

            if not exists (
                select 1
                from public.student_guardians sg
                where sg.student_id = v_student_id
                  and sg.guardian_id = v_guardian_id
            ) then
                raise exception
                    'Existing contact is not linked to student';
            end if;


            update public.guardians
            set
                full_name = v_full_name,
                phone = v_phone,
                email = v_email,
                updated_at = statement_timestamp()
            where id = v_guardian_id;


            update public.student_guardians
            set
                relationship = v_relationship,
                priority = v_priority,
                via_whatsapp = true,
                via_email = (v_email is not null),
                is_active = true,
                ended_at = null,
                updated_at = statement_timestamp()
            where student_id = v_student_id
              and guardian_id = v_guardian_id;


        -- ----------------------------------------------------
        -- CONTACTO NUEVO
        -- ----------------------------------------------------

        else

            insert into public.guardians (
                full_name,
                phone,
                email
            )
            values (
                v_full_name,
                v_phone,
                v_email
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
                (v_email is not null),
                true,
                p_preregistered_on
            );

        end if;


        v_priority := v_priority + 1;

    end loop;


    -- ========================================================
    -- PREINSCRIPCIÓN
    -- ========================================================

    insert into public.preregistrations (
        student_id,
        campaign_id,

        target_cycle_id,
        target_education_level_id,
        target_grade_level_id,
        target_group_id,

        preregistered_on,

        status,
        created_by,
        notes
    )
    values (
        v_student_id,
        v_campaign.id,

        p_target_cycle_id,
        p_target_education_level_id,
        p_target_grade_level_id,
        p_target_group_id,

        p_preregistered_on,

        'PENDING',
        v_actor_id,
        nullif(btrim(p_notes), '')
    )
    returning id
    into v_preregistration_id;


    -- ========================================================
    -- CARGO
    --
    -- La fecha límite financiera queda como fin de campaña.
    -- NO implementamos todavía el candado posterior.
    -- ========================================================

    insert into public.charges (
        student_id,
        enrollment_id,
        cycle_id,
        financial_concept_id,
        financial_plan_period_id,
        financial_agreement_id,
        coverage_year,
        coverage_month,
        original_amount,
        due_date,
        origin,
        status,
        created_by
    )
    values (
        v_student_id,
        null,
        p_target_cycle_id,
        v_campaign.covered_concept_id,
        null,
        null,
        null,
        null,
        v_campaign.price,
        v_campaign.ends_on,
        'PREREGISTRATION_CAMPAIGN',
        'ACTIVE',
        v_actor_id
    )
    returning id
    into v_charge_id;


    update public.preregistrations
    set charge_id = v_charge_id
    where id = v_preregistration_id;


    -- ========================================================
    -- AUDITORÍA
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
        'PREREGISTRATION_INTAKE_CREATED',
        'preregistrations',
        v_preregistration_id,
        null,
        jsonb_build_object(
            'student_id', v_student_id,
            'campaign_id', v_campaign.id,
            'preregistered_on', p_preregistered_on,

            'target_cycle_id', p_target_cycle_id,
            'target_education_level_id',
                p_target_education_level_id,
            'target_grade_level_id',
                p_target_grade_level_id,
            'target_group_id',
                p_target_group_id,

            'charge_id', v_charge_id,
            'price', v_campaign.price
        ),
        'Registro integral de preinscripción',
        v_correlation_id
    );


    return v_preregistration_id;

end;
$$;


-- ============================================================
-- PUBLIC RPC
-- ============================================================

create or replace function public.create_preregistration_intake(
    p_preregistered_on date,

    p_student_id uuid,
    p_student_full_name text,

    p_target_cycle_id uuid,
    p_target_education_level_id uuid,
    p_target_grade_level_id uuid,
    p_target_group_id uuid,

    p_campaign_id uuid,

    p_contacts jsonb,

    p_notes text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
    select app_private.create_preregistration_intake_internal(
        p_preregistered_on,

        p_student_id,
        p_student_full_name,

        p_target_cycle_id,
        p_target_education_level_id,
        p_target_grade_level_id,
        p_target_group_id,

        p_campaign_id,

        p_contacts,

        p_notes
    );
$$;


-- ============================================================
-- GRANTS
-- ============================================================

revoke all
on function app_private.create_preregistration_intake_internal(
    date,
    uuid,
    text,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    jsonb,
    text
)
from public, anon, authenticated;


revoke all
on function public.create_preregistration_intake(
    date,
    uuid,
    text,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    jsonb,
    text
)
from public, anon;


grant execute
on function public.create_preregistration_intake(
    date,
    uuid,
    text,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    jsonb,
    text
)
to authenticated;