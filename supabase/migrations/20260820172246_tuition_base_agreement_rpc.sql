-- ============================================================
-- M4.9 — Acuerdo financiero base de colegiatura
-- ============================================================
--
-- Crea el PRIMER acuerdo TUITION de un enrollment:
--
--   base_amount_snapshot     = tarifa base vigente
--   reduction_amount_snapshot = 0
--   agreed_amount             = tarifa base vigente
--   discount_category_version_id = null
--   benefit_id / snapshots    = null
--
-- No:
--   - crea cargos
--   - asigna plan
--   - asigna categoría
--   - modifica acuerdos existentes
--
-- Después de esta RPC puede ejecutarse:
--   initialize_enrollment_financials(...)
--
-- ============================================================


create or replace function
app_private.create_tuition_base_agreement_internal(
    p_enrollment_id uuid,
    p_effective_on date,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;

    v_cycle_id uuid;
    v_grade_level_id uuid;
    v_education_level_id uuid;

    v_cycle_start date;
    v_cycle_end date;

    v_tuition_concept_id uuid;

    v_base_rate_id uuid;
    v_base_amount numeric;

    v_agreement_id uuid;

    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- ========================================================
    -- AUTH
    -- ========================================================

    v_actor_id :=
        (select auth.uid());


    if v_actor_id is null then
        raise exception
            'Authentication required';
    end if;


    if not app_private.current_user_is_active() then
        raise exception
            'Inactive user';
    end if;


    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to create tuition agreement';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_enrollment_id is null then
        raise exception
            'enrollment_id is required';
    end if;


    if p_effective_on is null then
        raise exception
            'effective_on is required';
    end if;


    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Reason is required';
    end if;


    -- ========================================================
    -- LOCK ENROLLMENT
    -- ========================================================

    select
        e.cycle_id,
        e.grade_level_id,
        gl.education_level_id,
        sc.starts_on,
        sc.ends_on

    into
        v_cycle_id,
        v_grade_level_id,
        v_education_level_id,
        v_cycle_start,
        v_cycle_end

    from public.enrollments e

    join public.grade_levels gl
      on gl.id =
         e.grade_level_id

    join public.school_cycles sc
      on sc.id =
         e.cycle_id

    where e.id =
          p_enrollment_id

    for update of e;


    if not found then
        raise exception
            'Enrollment not found';
    end if;


    -- ========================================================
    -- DATE VALIDATION
    -- ========================================================

    if p_effective_on <
       v_cycle_start
       or
       p_effective_on >
       v_cycle_end
    then
        raise exception
            'effective_on must belong to enrollment cycle';
    end if;


    -- ========================================================
    -- TUITION CONCEPT
    -- ========================================================

    select fc.id

    into v_tuition_concept_id

    from public.financial_concepts fc

    where fc.code =
          'TUITION'

      and fc.is_active = true;


    if v_tuition_concept_id is null then
        raise exception
            'Active TUITION financial concept not found';
    end if;


    -- ========================================================
    -- TRUE INITIAL AGREEMENT ONLY
    -- ========================================================

    if exists (
        select 1

        from public.student_financial_agreements sfa

        where sfa.enrollment_id =
              p_enrollment_id

          and sfa.financial_concept_id =
              v_tuition_concept_id
    )
    then
        raise exception
            'Enrollment already has TUITION agreement history';
    end if;


    -- ========================================================
    -- LOCK APPLICABLE BASE RATE
    -- ========================================================

    select
        br.id,
        br.amount

    into
        v_base_rate_id,
        v_base_amount

    from public.base_rates br

    where br.cycle_id =
          v_cycle_id

      and br.education_level_id =
          v_education_level_id

      and br.financial_concept_id =
          v_tuition_concept_id

      and br.valid_from <=
          p_effective_on

      and (
          br.valid_until is null
          or
          br.valid_until >=
          p_effective_on
      )

    order by br.valid_from desc

    limit 1

    for update;


    if v_base_rate_id is null then
        raise exception
            'No TUITION base rate exists for enrollment level, cycle and effective date';
    end if;


    -- ========================================================
    -- CREATE BASE AGREEMENT
    -- ========================================================

    insert into public.student_financial_agreements (
        enrollment_id,
        financial_concept_id,

        base_rate_id,

        benefit_id,
        benefit_type_snapshot,
        benefit_value_snapshot,

        base_amount_snapshot,
        reduction_amount_snapshot,
        agreed_amount,

        discount_category_version_id,

        valid_from,
        valid_until,

        reason,
        authorized_by
    )
    values (
        p_enrollment_id,
        v_tuition_concept_id,

        v_base_rate_id,

        null,
        null,
        null,

        v_base_amount,
        0,
        v_base_amount,

        null,

        p_effective_on,
        null,

        btrim(p_reason),
        v_actor_id
    )
    returning id
    into v_agreement_id;


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

        'TUITION_BASE_AGREEMENT_CREATED',

        'student_financial_agreements',

        v_agreement_id,

        null,

        jsonb_build_object(
            'enrollment_id',
                p_enrollment_id,

            'cycle_id',
                v_cycle_id,

            'grade_level_id',
                v_grade_level_id,

            'education_level_id',
                v_education_level_id,

            'financial_concept_id',
                v_tuition_concept_id,

            'base_rate_id',
                v_base_rate_id,

            'base_amount_snapshot',
                v_base_amount,

            'reduction_amount_snapshot',
                0,

            'agreed_amount',
                v_base_amount,

            'valid_from',
                p_effective_on
        ),

        btrim(p_reason),

        v_correlation_id
    );


    return v_agreement_id;

end;
$$;



-- ============================================================
-- INTERNAL PRIVILEGES
-- ============================================================

revoke all
on function
app_private.create_tuition_base_agreement_internal(
    uuid,
    date,
    text
)
from public, anon;


grant execute
on function
app_private.create_tuition_base_agreement_internal(
    uuid,
    date,
    text
)
to authenticated;



-- ============================================================
-- PUBLIC RPC
-- ============================================================

create or replace function
public.create_tuition_base_agreement(
    p_enrollment_id uuid,
    p_effective_on date,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.create_tuition_base_agreement_internal(
            p_enrollment_id,
            p_effective_on,
            p_reason
        );
$$;


revoke all
on function
public.create_tuition_base_agreement(
    uuid,
    date,
    text
)
from public, anon;


grant execute
on function
public.create_tuition_base_agreement(
    uuid,
    date,
    text
)
to authenticated;


-- ============================================================
-- FIN M4.9
-- ============================================================