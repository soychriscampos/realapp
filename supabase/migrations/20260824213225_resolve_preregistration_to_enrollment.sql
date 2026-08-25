-- ============================================================
-- H7.3A — CONVERTIR PREINSCRIPCIÓN EN MATRÍCULA ACTIVA
--
-- La preinscripción es la fuente canónica de:
-- - student_id
-- - target_cycle_id
-- - target_grade_level_id
--
-- Reutiliza create_and_activate_enrollment_internal().
-- La activación y la resolución de la preinscripción ocurren
-- dentro de la misma transacción.
-- ============================================================


create or replace function app_private.resolve_preregistration_to_enrollment_internal(
    p_preregistration_id uuid,
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
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;

    v_preregistration public.preregistrations%rowtype;
    v_enrollment_id uuid;

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
            'Insufficient permission to resolve preregistration';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    ) then
        raise exception
            'Insufficient permission to initialize enrollment financials';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_preregistration_id is null then
        raise exception 'preregistration_id is required';
    end if;

    if p_classification_id is null then
        raise exception 'classification_id is required';
    end if;

    if p_activated_on is null then
        raise exception 'activated_on is required';
    end if;

    if p_economic_start_on is null then
        raise exception 'economic_start_on is required';
    end if;

    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception 'Reason is required';
    end if;


    -- ========================================================
    -- LOCK PREINSCRIPCIÓN
    -- ========================================================

    select pr.*
    into v_preregistration
    from public.preregistrations pr
    where pr.id = p_preregistration_id
    for update;

    if not found then
        raise exception 'Preregistration not found';
    end if;


    -- ========================================================
    -- ESTADO
    --
    -- Solamente una preinscripción todavía vigente puede
    -- convertirse en matrícula.
    -- CANCELLED / NO_CONTINUA / RESOLVED quedan históricas.
    -- ========================================================

    if v_preregistration.status not in (
        'PENDING',
        'CONFIRMED'
    ) then
        raise exception
            'Preregistration cannot be enrolled from its current status';
    end if;


    -- ========================================================
    -- INTEGRIDAD BÁSICA
    -- ========================================================

    if v_preregistration.student_id is null then
        raise exception
            'Preregistration has no student';
    end if;

    if v_preregistration.target_cycle_id is null then
        raise exception
            'Preregistration has no target cycle';
    end if;

    if v_preregistration.target_grade_level_id is null then
        raise exception
            'Preregistration has no target grade';
    end if;


    -- ========================================================
    -- EVITAR DOBLE RESOLUCIÓN
    -- ========================================================

    if exists (
        select 1
        from public.enrollments e
        where e.student_id =
            v_preregistration.student_id
          and e.cycle_id =
            v_preregistration.target_cycle_id
    ) then
        raise exception
            'Student already has an enrollment for the target cycle';
    end if;


    -- ========================================================
    -- ACTIVACIÓN CANÓNICA
    --
    -- Esta función existente:
    -- - crea enrollment;
    -- - crea acuerdo base;
    -- - inicializa plan 12;
    -- - genera colegiaturas;
    -- - revisa si inscripción ya está cubierta;
    -- - genera inscripción si corresponde;
    -- - activa enrollment;
    -- - audita.
    --
    -- No se replica ninguna de esas reglas aquí.
    -- ========================================================

    v_enrollment_id :=
        app_private.create_and_activate_enrollment_internal(
            v_preregistration.student_id,
            v_preregistration.target_cycle_id,
            v_preregistration.target_grade_level_id,
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
    -- RESOLVER PREINSCRIPCIÓN
    --
    -- Solo ocurre si toda la activación anterior terminó bien.
    -- Si cualquier parte falla, PostgreSQL revierte todo.
    -- ========================================================

    update public.preregistrations
    set
        status = 'RESOLVED',
        resolved_at = statement_timestamp(),
        resolution = 'ENROLLED'
    where id = v_preregistration.id;


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
        'PREREGISTRATION_ENROLLED',
        'preregistrations',
        v_preregistration.id,
        jsonb_build_object(
            'status',
                v_preregistration.status,
            'resolved_at',
                v_preregistration.resolved_at,
            'resolution',
                v_preregistration.resolution
        ),
        jsonb_build_object(
            'status',
                'RESOLVED',
            'resolution',
                'ENROLLED',
            'enrollment_id',
                v_enrollment_id,
            'student_id',
                v_preregistration.student_id,
            'cycle_id',
                v_preregistration.target_cycle_id,
            'grade_level_id',
                v_preregistration.target_grade_level_id
        ),
        btrim(p_reason),
        v_correlation_id
    );


    return v_enrollment_id;

end;
$$;


-- ============================================================
-- PUBLIC RPC
-- ============================================================

create or replace function public.resolve_preregistration_to_enrollment(
    p_preregistration_id uuid,
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
returns uuid
language sql
security definer
set search_path = ''
as $$
    select app_private.resolve_preregistration_to_enrollment_internal(
        p_preregistration_id,
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
-- GRANTS
-- ============================================================

revoke all
on function app_private.resolve_preregistration_to_enrollment_internal(
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
on function public.resolve_preregistration_to_enrollment(
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
on function public.resolve_preregistration_to_enrollment(
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