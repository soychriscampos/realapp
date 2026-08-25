-- ============================================================
-- H7.4 FIX — PRIMER PERIODO ANTERIOR AL PLAN ORDINARIO
--
-- Completa initialize_enrollment_financials_internal(...)
-- para soportar un ingreso económico anterior al primer
-- financial_plan_period.
--
-- Ejemplo 26-27:
--
-- ciclo inicia:              31-ago-2026
-- primer periodo ordinario:  sep-2026
--
-- Si NO se cobra agosto:
--   economic_start_on = 01-sep-2026
--   initial_period_amount = null
--
-- Si SÍ se cobra agosto:
--   economic_start_on = 31-ago-2026
--   initial_period_amount = monto explícito
--   initial_period_due_date = fecha explícita
--
-- El cargo de agosto:
-- - es TUITION;
-- - pertenece al enrollment;
-- - NO pertenece a financial_plan_periods;
-- - conserva coverage_year/month;
-- - no altera SEP en adelante.
--
-- También conserva intacto el comportamiento existente para
-- ingresos parciales dentro de un periodo ordinario, ej. 18 SEP.
-- ============================================================


create or replace function app_private.initialize_enrollment_financials_internal(
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

    -- Existing partial-period support.
    v_partial_period_id uuid := null;
    v_partial_period_found boolean := false;

    -- New: segment before first ordinary plan period.
    v_first_standard_period_start date;
    v_preplan_initial_found boolean := false;
    v_preplan_charge_id uuid := null;

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
    -- TRUE INITIALIZATION ONLY
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
    -- TUITION
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
    -- DEFAULT 12-PAYMENT PLAN
    -- ========================================================

    select
        count(*),
        min(fp.id::text)::uuid,
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
    -- VERIFY PLAN
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
    -- FIRST ORDINARY PERIOD
    -- ========================================================

    select
        min(
            make_date(
                fpp.coverage_year,
                fpp.coverage_month,
                1
            )
        )
    into
        v_first_standard_period_start

    from public.financial_plan_periods fpp

    where fpp.financial_plan_id =
          v_plan_id

      and fpp.financial_concept_id =
          v_tuition_concept_id;


    if v_first_standard_period_start is null then
        raise exception
            'Default 12-payment plan has no TUITION periods';
    end if;


    -- ========================================================
    -- PRE-PLAN INITIAL SEGMENT
    -- ========================================================
    --
    -- Example:
    -- economic_start_on = 31 AUG
    -- first plan period  = 01 SEP
    --
    -- If economic_start_on remains in AUG, that means the
    -- operator explicitly chose to create an initial obligation.
    --
    -- If August must NOT be charged, the caller must send
    -- economic_start_on = 01 SEP instead.
    -- ========================================================

    if p_economic_start_on <
       v_first_standard_period_start
    then

        v_preplan_initial_found := true;

        if p_initial_period_amount is null then
            raise exception
                'economic_start_on precedes first standard tuition period; initial_period_amount must be supplied explicitly';
        end if;

        if p_initial_period_due_date is null then
            raise exception
                'initial_period_due_date is required when economic_start_on precedes first standard tuition period';
        end if;

    end if;


    -- ========================================================
    -- CREATE PLAN ASSIGNMENT
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
    -- CREATE PRE-PLAN INITIAL CHARGE
    -- ========================================================
    --
    -- This is deliberately NOT a financial_plan_period.
    --
    -- It is a tuition obligation tied to the enrollment and
    -- its financial agreement, with explicit coverage month.
    -- ========================================================

    if v_preplan_initial_found then

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
              p_economic_start_on

          and (
              sfa.valid_until is null
              or
              sfa.valid_until >=
              p_economic_start_on
          )

        order by
            sfa.valid_from desc

        limit 1;


        if v_agreement_id is null then
            raise exception
                'No TUITION financial agreement exists for initial economic period';
        end if;


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
            null,
            v_agreement_id,

            extract(
                year
                from p_economic_start_on
            )::smallint,

            extract(
                month
                from p_economic_start_on
            )::smallint,

            p_initial_period_amount,
            p_initial_period_due_date,

            'INITIAL_PERIOD',
            'ACTIVE',

            v_actor_id
        )
        returning id
        into v_preplan_charge_id;


        v_created_charge_count :=
            v_created_charge_count + 1;


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

            'INITIAL_TUITION_PERIOD_CREATED',

            'charges',
            v_preplan_charge_id,

            null,

            jsonb_build_object(
                'enrollment_id',
                    p_enrollment_id,

                'student_id',
                    v_student_id,

                'economic_start_on',
                    p_economic_start_on,

                'coverage_year',
                    extract(
                        year
                        from p_economic_start_on
                    )::integer,

                'coverage_month',
                    extract(
                        month
                        from p_economic_start_on
                    )::integer,

                'amount',
                    p_initial_period_amount,

                'due_date',
                    p_initial_period_due_date,

                'origin',
                    'INITIAL_PERIOD'
            ),

            btrim(p_reason),

            v_correlation_id
        );

    end if;


    -- ========================================================
    -- MATERIALIZE ORDINARY TUITION PERIODS
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
        -- Completely before economic start
        -- ----------------------------------------------------

        if v_month_end <
           p_economic_start_on
        then
            continue;
        end if;


        -- ----------------------------------------------------
        -- Applicable agreement
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
        -- PARTIAL PERIOD INSIDE ORDINARY COVERAGE
        -- ====================================================
        --
        -- Existing behavior remains intact.
        --
        -- Example: economic_start_on = 18 SEP
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
        -- CREATE ORDINARY CHARGE
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
    -- An explicit amount is valid when either:
    -- - there was a custom partial ordinary period; OR
    -- - there was a pre-plan initial segment.
    -- ========================================================

    if p_initial_period_amount is not null
       and not v_partial_period_found
       and not v_preplan_initial_found
    then
        raise exception
            'initial_period_amount was supplied but no custom initial period exists';
    end if;


    if p_initial_period_due_date is not null
       and not v_partial_period_found
       and not v_preplan_initial_found
    then
        raise exception
            'initial_period_due_date was supplied but no custom initial period exists';
    end if;


    -- ========================================================
    -- AUDIT SUMMARY
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

            'first_standard_period_start',
                v_first_standard_period_start,

            'created_charges',
                v_created_charge_count,

            'custom_initial_period',
                v_partial_period_id,

            'preplan_initial_charge',
                v_preplan_charge_id,

            'custom_initial_amount',
                case
                    when v_partial_period_found
                         or v_preplan_initial_found
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