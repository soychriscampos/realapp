-- ============================================================
-- H6 — ACTIVACIÓN INICIAL CON INSCRIPCIÓN
--
-- Extiende create_and_activate_enrollment para:
-- - reconocer inscripción/preinscripción ya cubierta;
-- - generar ENROLLMENT_FEE cuando corresponda;
-- - permitir inscripción completa o proporcional;
-- - mantener toda la activación atómica.
-- ============================================================


-- ============================================================
-- 1. Retirar versión anterior
-- ============================================================

drop function if exists public.create_and_activate_enrollment(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text
);

drop function if exists app_private.create_and_activate_enrollment_internal(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text
);


-- ============================================================
-- 2. Nueva implementación interna
-- ============================================================

create function app_private.create_and_activate_enrollment_internal(
    p_student_id uuid,
    p_cycle_id uuid,
    p_grade_level_id uuid,
    p_classification_id uuid,
    p_group_id uuid,

    p_activated_on date,
    p_classes_start_on date,
    p_economic_start_on date,

    -- Colegiatura inicial si el ingreso cae dentro de un
    -- periodo ya comenzado.
    p_initial_period_amount numeric default null,
    p_initial_period_due_date date default null,

    -- Inscripción:
    -- null si ya está cubierta por inscripción/preinscripción.
    -- FULL | PROPORTIONAL si debe generarse.
    p_enrollment_fee_mode text default null,
    p_enrollment_fee_amount numeric default null,

    p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_actor_id uuid;
    v_enrollment_id uuid;

    v_education_level_id uuid;

    v_enrollment_fee_concept_id uuid;
    v_fee_covered boolean;

    v_fee_base_rate_id uuid;
    v_fee_base_amount numeric;
    v_fee_amount numeric;
    v_fee_charge_id uuid;

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
            'Insufficient permission to create enrollment';
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

    if p_student_id is null then
        raise exception 'student_id is required';
    end if;

    if p_cycle_id is null then
        raise exception 'cycle_id is required';
    end if;

    if p_grade_level_id is null then
        raise exception 'grade_level_id is required';
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

    if p_enrollment_fee_mode is not null
       and p_enrollment_fee_mode not in (
           'FULL',
           'PROPORTIONAL'
       )
    then
        raise exception 'Invalid enrollment fee mode';
    end if;

    if p_enrollment_fee_amount is not null
       and p_enrollment_fee_amount < 0
    then
        raise exception
            'enrollment_fee_amount cannot be negative';
    end if;

    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception 'Reason is required';
    end if;


    -- ========================================================
    -- GRADE / LEVEL
    -- ========================================================

    select gl.education_level_id
    into v_education_level_id
    from public.grade_levels gl
    where gl.id = p_grade_level_id;

    if v_education_level_id is null then
        raise exception 'Grade level not found';
    end if;


    -- ========================================================
    -- DUPLICATE ENROLLMENT
    -- ========================================================

    if exists (
        select 1
        from public.enrollments e
        where e.student_id = p_student_id
          and e.cycle_id = p_cycle_id
    ) then
        raise exception
            'Student already has an enrollment for this cycle';
    end if;


    -- ========================================================
    -- CREATE PENDING ENROLLMENT
    -- ========================================================

    insert into public.enrollments (
        student_id,
        cycle_id,
        grade_level_id,
        group_id,
        classification_id,
        status,
        enrolled_on,
        classes_start_on,
        created_by
    )
    values (
        p_student_id,
        p_cycle_id,
        p_grade_level_id,
        p_group_id,
        p_classification_id,
        'PENDIENTE',
        p_activated_on,
        p_classes_start_on,
        v_actor_id
    )
    returning id
    into v_enrollment_id;


    -- ========================================================
    -- TUITION BASE AGREEMENT
    -- ========================================================

    perform app_private.create_tuition_base_agreement_internal(
        v_enrollment_id,
        p_activated_on,
        p_reason
    );


    -- ========================================================
    -- TUITION / PLAN 12
    -- ========================================================

    perform app_private.initialize_enrollment_financials_internal(
        v_enrollment_id,
        p_activated_on,
        p_economic_start_on,
        p_initial_period_amount,
        p_initial_period_due_date,
        p_reason
    );


    -- ========================================================
    -- ENROLLMENT FEE CONCEPT
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


    -- ========================================================
    -- ¿YA ESTÁ CUBIERTA?
    --
    -- Puede provenir de:
    -- - inscripción ya pagada para ese alumno/ciclo;
    -- - preinscripción pagada que cubre inscripción.
    -- ========================================================

    v_fee_covered :=
        app_private.enrollment_fee_is_covered(
            p_student_id,
            p_cycle_id
        );


    -- ========================================================
    -- INSCRIPCIÓN NO CUBIERTA
    -- ========================================================

    if not v_fee_covered then

        -- ----------------------------------------------------
        -- Tarifa base de inscripción
        -- ----------------------------------------------------

        select
            br.id,
            br.amount
        into
            v_fee_base_rate_id,
            v_fee_base_amount
        from public.base_rates br
        where br.cycle_id = p_cycle_id
          and br.education_level_id =
              v_education_level_id
          and br.financial_concept_id =
              v_enrollment_fee_concept_id
          and br.valid_from <= p_activated_on
          and (
              br.valid_until is null
              or br.valid_until >= p_activated_on
          )
        order by br.valid_from desc
        limit 1;

        if v_fee_base_rate_id is null then
            raise exception
                'No enrollment fee base rate exists for activation date';
        end if;


        -- ----------------------------------------------------
        -- Debe decidirse cuánto cobrar.
        -- ----------------------------------------------------

        if p_enrollment_fee_mode is null then
            raise exception
                'Enrollment fee is required; choose FULL or PROPORTIONAL';
        end if;


        if p_enrollment_fee_mode = 'FULL' then

            if p_enrollment_fee_amount is not null then
                raise exception
                    'enrollment_fee_amount must be null in FULL mode';
            end if;

            v_fee_amount :=
                v_fee_base_amount;


        elsif p_enrollment_fee_mode = 'PROPORTIONAL' then

            if p_enrollment_fee_amount is null then
                raise exception
                    'enrollment_fee_amount is required in PROPORTIONAL mode';
            end if;

            v_fee_amount :=
                p_enrollment_fee_amount;

        end if;


        -- ----------------------------------------------------
        -- Generar obligación de inscripción.
        --
        -- No implica que esté pagada.
        -- El pago puede registrarse después o retroactivamente.
        -- ----------------------------------------------------

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
            v_enrollment_id,
            p_cycle_id,
            v_enrollment_fee_concept_id,
            null,
            null,
            null,
            null,
            v_fee_amount,
            p_activated_on,
            'ENROLLMENT_ACTIVATION',
            'ACTIVE',
            v_actor_id
        )
        returning id
        into v_fee_charge_id;


        -- ----------------------------------------------------
        -- Audit específico del cargo de inscripción
        -- ----------------------------------------------------

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
            'ENROLLMENT_FEE_CHARGE_CREATED',
            'charges',
            v_fee_charge_id,
            null,
            jsonb_build_object(
                'student_id',
                    p_student_id,
                'enrollment_id',
                    v_enrollment_id,
                'cycle_id',
                    p_cycle_id,
                'financial_concept_id',
                    v_enrollment_fee_concept_id,
                'base_rate_id',
                    v_fee_base_rate_id,
                'base_amount',
                    v_fee_base_amount,
                'mode',
                    p_enrollment_fee_mode,
                'charged_amount',
                    v_fee_amount
            ),
            btrim(p_reason),
            v_correlation_id
        );

    else

        -- Si ya estaba cubierta, no aceptar datos de un
        -- nuevo cobro que serían ignorados silenciosamente.

        if p_enrollment_fee_mode is not null
           or p_enrollment_fee_amount is not null
        then
            raise exception
                'Enrollment fee is already covered for this cycle';
        end if;

    end if;


    -- ========================================================
    -- ACTIVATE ENROLLMENT
    -- ========================================================

    perform app_private.activate_enrollment_internal(
        v_enrollment_id,
        p_activated_on,
        p_group_id,
        p_classes_start_on,
        p_reason
    );


    -- ========================================================
    -- AUDIT RESUMEN
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
        'ENROLLMENT_INITIAL_ACTIVATION_FINANCIALS',
        'enrollments',
        v_enrollment_id,
        null,
        jsonb_build_object(
            'student_id',
                p_student_id,
            'cycle_id',
                p_cycle_id,
            'economic_start_on',
                p_economic_start_on,
            'enrollment_fee_already_covered',
                v_fee_covered,
            'enrollment_fee_charge_id',
                v_fee_charge_id,
            'enrollment_fee_mode',
                case
                    when v_fee_covered
                    then null
                    else p_enrollment_fee_mode
                end
        ),
        btrim(p_reason),
        v_correlation_id
    );


    return v_enrollment_id;
end;
$function$;


-- ============================================================
-- 3. Public RPC
-- ============================================================

create function public.create_and_activate_enrollment(
    p_student_id uuid,
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
returns uuid
language sql
security definer
set search_path = ''
as $function$
    select app_private.create_and_activate_enrollment_internal(
        p_student_id,
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
$function$;


-- ============================================================
-- 4. Permissions
-- ============================================================

revoke all
on function app_private.create_and_activate_enrollment_internal(
    uuid,
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

grant execute
on function public.create_and_activate_enrollment(
    uuid,
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