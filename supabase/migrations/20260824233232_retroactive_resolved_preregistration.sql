-- ============================================================
-- H7.3 — PREINSCRIPCIÓN RETROACTIVA DE ALUMNO YA MATRICULADO
--
-- Reconstruye el antecedente histórico.
-- NO crea enrollment.
-- NO modifica enrollment.
-- NO duplica automáticamente la inscripción existente.
-- ============================================================

create or replace function app_private.create_retroactive_preregistration_internal(
    p_student_id uuid,
    p_campaign_id uuid,
    p_preregistered_on date,
    p_target_grade_level_id uuid,
    p_target_group_id uuid,
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
    v_enrollment public.enrollments%rowtype;

    v_target_education_level_id uuid;

    v_enrollment_fee_concept_id uuid;
    v_existing_charge_id uuid;
    v_existing_charge_count integer;

    v_preregistration_id uuid;

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
            'Insufficient permission to create retroactive preregistration';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_student_id is null then
        raise exception 'student_id is required';
    end if;

    if p_campaign_id is null then
        raise exception 'campaign_id is required';
    end if;

    if p_preregistered_on is null then
        raise exception 'preregistered_on is required';
    end if;

    if p_target_grade_level_id is null then
        raise exception 'target_grade_level_id is required';
    end if;

    if p_target_group_id is null then
        raise exception 'target_group_id is required';
    end if;


    -- ========================================================
    -- CAMPAÑA
    -- ========================================================

    select pc.*
    into v_campaign
    from public.preregistration_campaigns pc
    where pc.id = p_campaign_id;

    if not found then
        raise exception 'Preregistration campaign not found';
    end if;


    -- Para captura histórica puede estar actualmente cerrada.
    -- Lo importante es que haya sido válida en la fecha real.

    if v_campaign.status = 'CANCELLED' then
        raise exception
            'Cancelled campaign cannot be used';
    end if;


    if p_preregistered_on < v_campaign.starts_on
       or p_preregistered_on > v_campaign.ends_on
    then
        raise exception
            'Preregistration date is outside campaign dates';
    end if;


    -- ========================================================
    -- MATRÍCULA YA EXISTENTE
    -- ========================================================

    select e.*
    into v_enrollment
    from public.enrollments e
    where e.student_id = p_student_id
      and e.cycle_id = v_campaign.target_cycle_id
    limit 1;

    if not found then
        raise exception
            'Student has no enrollment for campaign target cycle';
    end if;


    -- La preinscripción debe haber sucedido antes o el mismo día
    -- en que quedó matriculado.

    if p_preregistered_on > v_enrollment.enrolled_on then
        raise exception
            'Retroactive preregistration date cannot be after enrollment date';
    end if;


    -- ========================================================
    -- DUPLICADO
    -- ========================================================

    if exists (
        select 1
        from public.preregistrations pr
        where pr.student_id = p_student_id
          and pr.target_cycle_id = v_campaign.target_cycle_id
    ) then
        raise exception
            'Student already has a preregistration for target cycle';
    end if;


    -- ========================================================
    -- DESTINO
    -- ========================================================

    select gl.education_level_id
    into v_target_education_level_id
    from public.grade_levels gl
    where gl.id = p_target_grade_level_id;

    if v_target_education_level_id is null then
        raise exception 'Target grade not found';
    end if;


    if v_campaign.education_level_id is not null
       and v_campaign.education_level_id
           is distinct from v_target_education_level_id
    then
        raise exception
            'Campaign does not apply to target education level';
    end if;


    if not exists (
        select 1
        from public.groups g
        where g.id = p_target_group_id
          and g.cycle_id = v_campaign.target_cycle_id
          and g.grade_level_id = p_target_grade_level_id
    ) then
        raise exception
            'Target group is not valid for cycle and grade';
    end if;


    -- ========================================================
    -- CARGO ECONÓMICO EXISTENTE
    --
    -- Para un alumno ya matriculado NO generamos otra
    -- inscripción automáticamente.
    --
    -- Si existe exactamente un cargo activo de inscripción
    -- para alumno/ciclo, lo vinculamos a la preinscripción.
    -- ========================================================

    select fc.id
    into v_enrollment_fee_concept_id
    from public.financial_concepts fc
    where fc.code = 'ENROLLMENT_FEE'
      and fc.is_active = true;

    if v_enrollment_fee_concept_id is null then
        raise exception
            'Active ENROLLMENT_FEE concept not found';
    end if;


    select
        count(*),
        min(c.id)
    into
        v_existing_charge_count,
        v_existing_charge_id
    from public.charges c
    where c.student_id = p_student_id
      and c.cycle_id = v_campaign.target_cycle_id
      and c.financial_concept_id =
          v_enrollment_fee_concept_id
      and c.status = 'ACTIVE';


    if v_existing_charge_count > 1 then
        raise exception
            'Multiple enrollment fee charges require manual review';
    end if;


    if v_existing_charge_count = 0 then
        v_existing_charge_id := null;
    end if;


    -- ========================================================
    -- CREAR HISTÓRICO
    -- ========================================================

    insert into public.preregistrations (
        student_id,
        campaign_id,

        target_cycle_id,
        target_education_level_id,
        target_grade_level_id,
        target_group_id,

        preregistered_on,

        charge_id,

        status,
        created_by,

        resolved_at,
        resolution,

        notes
    )
    values (
        p_student_id,
        v_campaign.id,

        v_campaign.target_cycle_id,
        v_target_education_level_id,
        p_target_grade_level_id,
        p_target_group_id,

        p_preregistered_on,

        v_existing_charge_id,

        'RESOLVED',
        v_actor_id,

        statement_timestamp(),
        'ENROLLED',

        nullif(btrim(p_notes), '')
    )
    returning id
    into v_preregistration_id;


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
        'RETROACTIVE_PREREGISTRATION_CREATED',
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
            'preregistered_on',
                p_preregistered_on,
            'enrollment_id',
                v_enrollment.id,
            'enrolled_on',
                v_enrollment.enrolled_on,
            'target_grade_level_id',
                p_target_grade_level_id,
            'target_group_id',
                p_target_group_id,
            'linked_charge_id',
                v_existing_charge_id,
            'status',
                'RESOLVED',
            'resolution',
                'ENROLLED'
        ),
        'Registro retroactivo de preinscripción',
        v_correlation_id
    );


    return v_preregistration_id;

end;
$$;


create or replace function public.create_retroactive_preregistration(
    p_student_id uuid,
    p_campaign_id uuid,
    p_preregistered_on date,
    p_target_grade_level_id uuid,
    p_target_group_id uuid,
    p_notes text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
    select app_private.create_retroactive_preregistration_internal(
        p_student_id,
        p_campaign_id,
        p_preregistered_on,
        p_target_grade_level_id,
        p_target_group_id,
        p_notes
    );
$$;


revoke all
on function app_private.create_retroactive_preregistration_internal(
    uuid,
    uuid,
    date,
    uuid,
    uuid,
    text
)
from public, anon, authenticated;


revoke all
on function public.create_retroactive_preregistration(
    uuid,
    uuid,
    date,
    uuid,
    uuid,
    text
)
from public, anon;


grant execute
on function public.create_retroactive_preregistration(
    uuid,
    uuid,
    date,
    uuid,
    uuid,
    text
)
to authenticated;