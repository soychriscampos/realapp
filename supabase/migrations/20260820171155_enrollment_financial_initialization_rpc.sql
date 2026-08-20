-- ============================================================
-- M4.7 — Inicialización financiera de una matrícula
-- ============================================================
--
-- Responsabilidad:
--   1. Resolver automáticamente el plan DEFAULT de 12 pagos
--      para ciclo + nivel educativo.
--   2. Crear la primera asignación financiera.
--   3. Guardar economic_start_on independientemente de la
--      fecha operativa de activación.
--   4. Materializar las colegiaturas del plan.
--   5. Si economic_start_on cae dentro de un mes cubierto,
--      exigir monto explícito para ese primer periodo.
--
-- No:
--   - modifica enrollment.status
--   - calcula proporcional automáticamente
--   - crea inscripción/preinscripción
--   - cambia descuentos
--   - toca cargos históricos
--
-- ============================================================


create or replace function
app_private.initialize_enrollment_financials_internal(
    p_enrollment_id uuid,
    p_effective_on date,
    p_economic_start_on date,
    p_initial_period_amount numeric,
    p_initial_period_due_date date,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;

    v_student_id uuid;
    v_cycle_id uuid;
    v_grade_level_id uuid;
    v_education_level_id uuid;

    v_cycle_start date;
    v_cycle_end date;

    v_plan_id uuid;
    v_plan_count integer;
    v_plan_status text;
    v_installment_count smallint;

    v_tuition_concept_id uuid;

    v_assignment_id uuid;

    v_period_count integer;
    v_period record;

    v_month_start date;
    v_month_end date;

    v_agreement_id uuid;
    v_agreed_amount numeric;

    v_charge_amount numeric;
    v_charge_due_date date;

    v_partial_period_id uuid := null;
    v_partial_period_found boolean := false;

    v_created_charge_count integer := 0;
    v_created_rule_count integer := 0;

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
            'Insufficient permission to initialize enrollment financials';
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


    if p_economic_start_on is null then
        raise exception
            'economic_start_on is required';
    end if;


    if p_initial_period_amount is not null
       and p_initial_period_amount < 0
    then
        raise exception
            'initial_period_amount cannot be negative';
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
        e.student_id,
        e.cycle_id,
        e.grade_level_id,
        gl.education_level_id,
        sc.starts_on,
        sc.ends_on

    into
        v_student_id,
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
    -- DATES
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


    if p_economic_start_on <
       v_cycle_start
       or
       p_economic_start_on >
       v_cycle_end
    then
        raise exception
            'economic_start_on must belong to enrollment cycle';
    end if;


    -- ========================================================
    -- MUST BE TRUE INITIALIZATION
    -- ========================================================
    --
    -- This RPC is deliberately not a reactivation RPC.
    -- If this enrollment already had a financial-plan history,
    -- another operation must handle reactivation explicitly.
    -- ========================================================

    if exists (
        select 1

        from public.enrollment_financial_plan_assignments efpa

        where efpa.enrollment_id =
              p_enrollment_id
    )
    then
        raise exception
            'Enrollment already has financial plan assignment history';
    end if;


    if exists (
        select 1

        from public.charges c

        where c.enrollment_id =
              p_enrollment_id

          and c.financial_plan_period_id is not null
    )
    then
        raise exception
            'Enrollment already has plan-generated charge history';
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
    -- RESOLVE DEFAULT 12-PAYMENT PLAN
    -- ========================================================

    select
        count(*),
        min(fp.id),
        min(fp.status),
        min(fp.installment_count)

    into
        v_plan_count,
        v_plan_id,
        v_plan_status,
        v_installment_count

    from public.financial_plans fp

    where fp.cycle_id =
          v_cycle_id

      and fp.education_level_id =
          v_education_level_id

      and fp.is_default = true

      and fp.installment_count = 12

      and fp.status <> 'INACTIVE';


    if v_plan_count = 0 then
        raise exception
            'No default 12-payment financial plan exists for enrollment level and cycle';
    end if;


    if v_plan_count > 1 then
        raise exception
            'More than one default 12-payment financial plan exists for enrollment level and cycle';
    end if;


    -- ========================================================
    -- VERIFY PLAN CONFIGURATION
    -- ========================================================

    select count(*)
    into v_period_count

    from public.financial_plan_periods fpp

    where fpp.financial_plan_id =
          v_plan_id

      and fpp.financial_concept_id =
          v_tuition_concept_id;


    if v_period_count <> 12 then
        raise exception
            'Default 12-payment plan must contain exactly 12 TUITION periods; found %',
            v_period_count;
    end if;


    if exists (
        select 1

        from public.financial_plan_periods fpp

        where fpp.financial_plan_id =
              v_plan_id

          and fpp.financial_concept_id =
              v_tuition_concept_id

          and (
              fpp.coverage_year is null
              or
              fpp.coverage_month is null
          )
    )
    then
        raise exception
            'All TUITION plan periods must have coverage year and month';
    end if;


    -- ========================================================
    -- CREATE INITIAL ASSIGNMENT
    -- ========================================================

    insert into public.enrollment_financial_plan_assignments (
        enrollment_id,
        financial_plan_id,
        economic_start_on,
        valid_from,
        valid_until,
        reason,
        authorized_by
    )
    values (
        p_enrollment_id,
        v_plan_id,
        p_economic_start_on,
        p_effective_on,
        null,
        btrim(p_reason),
        v_actor_id
    )
    returning id
    into v_assignment_id;


    -- ========================================================
    -- MATERIALIZE TUITION PERIODS
    -- ========================================================

    for v_period in

        select
            fpp.id,
            fpp.coverage_year,
            fpp.coverage_month,
            fpp.due_date,
            fpp.sort_order

        from public.financial_plan_periods fpp

        where fpp.financial_plan_id =
              v_plan_id

          and fpp.financial_concept_id =
              v_tuition_concept_id

        order by fpp.sort_order

    loop

        v_month_start :=
            make_date(
                v_period.coverage_year,
                v_period.coverage_month,
                1
            );


        v_month_end :=
            (
                v_month_start
                + interval '1 month'
                - interval '1 day'
            )::date;


        -- ----------------------------------------------------
        -- Completely before economic start: no obligation.
        -- ----------------------------------------------------

        if v_month_end <
           p_economic_start_on
        then
            continue;
        end if;


        -- ----------------------------------------------------
        -- Applicable tuition agreement
        -- ----------------------------------------------------

        v_agreement_id := null;
        v_agreed_amount := null;


        select
            sfa.id,
            sfa.agreed_amount

        into
            v_agreement_id,
            v_agreed_amount

        from public.student_financial_agreements sfa

        where sfa.enrollment_id =
              p_enrollment_id

          and sfa.financial_concept_id =
              v_tuition_concept_id

          and sfa.valid_from <=
              v_period.due_date

          and (
              sfa.valid_until is null
              or
              sfa.valid_until >=
              v_period.due_date
          )

        order by
            sfa.valid_from desc

        limit 1;


        if v_agreement_id is null then
            raise exception
                'No TUITION financial agreement exists for period %-%',
                v_period.coverage_year,
                v_period.coverage_month;
        end if;


        v_charge_amount :=
            v_agreed_amount;

        v_charge_due_date :=
            v_period.due_date;


        -- ====================================================
        -- FIRST PARTIAL/CUSTOM COVERAGE MONTH
        -- ====================================================

        if p_economic_start_on >
           v_month_start
           and
           p_economic_start_on <=
           v_month_end
        then

            if v_partial_period_found then
                raise exception
                    'More than one partial initial period was detected';
            end if;


            if p_initial_period_amount is null then
                raise exception
                    'economic_start_on % falls inside coverage month %-%; initial_period_amount must be supplied explicitly',
                    p_economic_start_on,
                    v_period.coverage_year,
                    v_period.coverage_month;
            end if;


            v_partial_period_found :=
                true;

            v_partial_period_id :=
                v_period.id;

            v_charge_amount :=
                p_initial_period_amount;


            if p_initial_period_due_date is not null then
                v_charge_due_date :=
                    p_initial_period_due_date;
            end if;


            -- Persist why this period differs from standard.

            insert into public.enrollment_charge_rules (
                enrollment_id,
                financial_plan_period_id,
                action,
                custom_due_date,
                custom_amount,
                reason,
                authorized_by
            )
            values (
                p_enrollment_id,
                v_period.id,
                'CUSTOM',
                p_initial_period_due_date,
                p_initial_period_amount,
                btrim(p_reason),
                v_actor_id
            );


            v_created_rule_count :=
                v_created_rule_count + 1;

        end if;


        -- ====================================================
        -- CREATE CHARGE
        -- ====================================================

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
            p_enrollment_id,
            v_cycle_id,

            v_tuition_concept_id,
            v_period.id,
            v_agreement_id,

            v_period.coverage_year,
            v_period.coverage_month,

            v_charge_amount,
            v_charge_due_date,

            'FINANCIAL_PLAN',
            'ACTIVE',

            v_actor_id
        );


        v_created_charge_count :=
            v_created_charge_count + 1;

    end loop;


    -- ========================================================
    -- INPUT CONSISTENCY
    -- ========================================================
    --
    -- If an explicit first-period amount was supplied but no
    -- partial coverage month existed, reject rather than silently
    -- ignore operator input.
    -- ========================================================

    if p_initial_period_amount is not null
       and not v_partial_period_found
    then
        raise exception
            'initial_period_amount was supplied but economic_start_on does not fall inside a covered month';
    end if;


    if p_initial_period_due_date is not null
       and not v_partial_period_found
    then
        raise exception
            'initial_period_due_date was supplied but no custom initial period exists';
    end if;


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

        'ENROLLMENT_FINANCIALS_INITIALIZED',

        'enrollment_financial_plan_assignments',

        v_assignment_id,

        null,

        jsonb_build_object(
            'enrollment_id',
                p_enrollment_id,

            'student_id',
                v_student_id,

            'financial_plan_id',
                v_plan_id,

            'installment_count',
                v_installment_count,

            'effective_on',
                p_effective_on,

            'economic_start_on',
                p_economic_start_on,

            'created_charges',
                v_created_charge_count,

            'custom_initial_period',
                v_partial_period_id,

            'custom_initial_amount',
                case
                    when v_partial_period_found
                    then p_initial_period_amount
                    else null
                end,

            'created_charge_rules',
                v_created_rule_count
        ),

        btrim(p_reason),

        v_correlation_id
    );


    return v_assignment_id;

end;
$$;


-- ============================================================
-- INTERNAL PRIVILEGES
-- ============================================================

revoke all
on function
app_private.initialize_enrollment_financials_internal(
    uuid,
    date,
    date,
    numeric,
    date,
    text
)
from public, anon;


grant execute
on function
app_private.initialize_enrollment_financials_internal(
    uuid,
    date,
    date,
    numeric,
    date,
    text
)
to authenticated;


-- ============================================================
-- PUBLIC RPC
-- ============================================================

create or replace function
public.initialize_enrollment_financials(
    p_enrollment_id uuid,
    p_effective_on date,
    p_economic_start_on date,
    p_initial_period_amount numeric default null,
    p_initial_period_due_date date default null,
    p_reason text default null
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.initialize_enrollment_financials_internal(
            p_enrollment_id,
            p_effective_on,
            p_economic_start_on,
            p_initial_period_amount,
            p_initial_period_due_date,
            p_reason
        );
$$;


revoke all
on function
public.initialize_enrollment_financials(
    uuid,
    date,
    date,
    numeric,
    date,
    text
)
from public, anon;


grant execute
on function
public.initialize_enrollment_financials(
    uuid,
    date,
    date,
    numeric,
    date,
    text
)
to authenticated;


-- ============================================================
-- FIN M4.7
-- ============================================================