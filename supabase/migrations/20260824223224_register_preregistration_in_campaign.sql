-- ============================================================
-- H7.3B — REGISTRAR PREINSCRIPCIÓN EN CAMPAÑA
--
-- Crea:
-- - preregistration
-- - charge asociado por el precio de la campaña
--
-- No registra pagos.
-- No resuelve la preinscripción.
-- ============================================================

create or replace function app_private.register_preregistration_in_campaign_internal(
    p_campaign_id uuid,
    p_student_id uuid,
    p_target_grade_level_id uuid,
    p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;

    v_campaign public.preregistration_campaigns%rowtype;

    v_grade_level_id uuid;
    v_grade_education_level_id uuid;

    v_preregistration_id uuid;
    v_charge_id uuid;

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
            'Insufficient permission to create preregistration charge';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_campaign_id is null then
        raise exception 'campaign_id is required';
    end if;

    if p_student_id is null then
        raise exception 'student_id is required';
    end if;

    if p_target_grade_level_id is null then
        raise exception 'target_grade_level_id is required';
    end if;


    -- ========================================================
    -- CAMPAIGN
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
        raise exception
            'Preregistration campaign is not active';
    end if;


    -- ========================================================
    -- STUDENT
    -- ========================================================

    if not exists (
        select 1
        from public.students s
        where s.id = p_student_id
    ) then
        raise exception 'Student not found';
    end if;


    -- ========================================================
    -- GRADE
    -- ========================================================

    select
        gl.id,
        gl.education_level_id
    into
        v_grade_level_id,
        v_grade_education_level_id
    from public.grade_levels gl
    where gl.id = p_target_grade_level_id;

    if v_grade_level_id is null then
        raise exception 'Target grade not found';
    end if;


    -- Si la campaña está limitada a un nivel,
    -- el grado debe pertenecer a ese nivel.

    if v_campaign.education_level_id is not null
       and v_grade_education_level_id
           is distinct from v_campaign.education_level_id
    then
        raise exception
            'Target grade does not belong to campaign education level';
    end if;


    -- ========================================================
    -- DUPLICATE
    -- ========================================================

    if exists (
        select 1
        from public.preregistrations pr
        where pr.student_id = p_student_id
          and pr.target_cycle_id =
              v_campaign.target_cycle_id
    ) then
        raise exception
            'Student already has a preregistration for target cycle';
    end if;


    -- Si ya está matriculado en el ciclo destino,
    -- no tiene sentido crear preinscripción.

    if exists (
        select 1
        from public.enrollments e
        where e.student_id = p_student_id
          and e.cycle_id =
              v_campaign.target_cycle_id
    ) then
        raise exception
            'Student already has an enrollment for target cycle';
    end if;


    -- ========================================================
    -- CREATE PREREGISTRATION
    -- ========================================================

    insert into public.preregistrations (
        student_id,
        campaign_id,
        target_cycle_id,
        target_education_level_id,
        target_grade_level_id,
        status,
        created_by,
        notes
    )
    values (
        p_student_id,
        v_campaign.id,
        v_campaign.target_cycle_id,
        v_grade_education_level_id,
        v_grade_level_id,
        'PENDING',
        v_actor_id,
        nullif(btrim(p_notes), '')
    )
    returning id
    into v_preregistration_id;


    -- ========================================================
    -- CREATE CHARGE
    --
    -- El precio de la campaña se convierte en una obligación
    -- del alumno.
    --
    -- due_date = fin de campaña.
    --
    -- La regla que impida nuevos abonos después de ends_on
    -- NO se implementa todavía.
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
        p_student_id,
        null,
        v_campaign.target_cycle_id,
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


    -- ========================================================
    -- LINK CHARGE
    -- ========================================================

    update public.preregistrations
    set charge_id = v_charge_id
    where id = v_preregistration_id;


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
        v_actor_id,
        'PREREGISTRATION_CREATED',
        'preregistrations',
        v_preregistration_id,
        null,
        jsonb_build_object(
            'student_id',
                p_student_id,
            'campaign_id',
                v_campaign.id,
            'target_cycle_id',
                v_campaign.target_cycle_id,
            'target_grade_level_id',
                v_grade_level_id,
            'target_education_level_id',
                v_grade_education_level_id,
            'charge_id',
                v_charge_id,
            'price',
                v_campaign.price,
            'due_date',
                v_campaign.ends_on,
            'status',
                'PENDING'
        ),
        'Registro de preinscripción en campaña',
        v_correlation_id
    );


    return v_preregistration_id;

end;
$$;


-- ============================================================
-- PUBLIC RPC
-- ============================================================

create or replace function public.register_preregistration_in_campaign(
    p_campaign_id uuid,
    p_student_id uuid,
    p_target_grade_level_id uuid,
    p_notes text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
    select app_private.register_preregistration_in_campaign_internal(
        p_campaign_id,
        p_student_id,
        p_target_grade_level_id,
        p_notes
    );
$$;


-- ============================================================
-- GRANTS
-- ============================================================

revoke all
on function app_private.register_preregistration_in_campaign_internal(
    uuid,
    uuid,
    uuid,
    text
)
from public, anon, authenticated;


revoke all
on function public.register_preregistration_in_campaign(
    uuid,
    uuid,
    uuid,
    text
)
from public, anon;


grant execute
on function public.register_preregistration_in_campaign(
    uuid,
    uuid,
    uuid,
    text
)
to authenticated;