-- ============================================================
-- H7.5 — REGULARIZACIÓN RETROACTIVA DEL INICIO FINANCIERO
--
-- Corrige el economic_start_on de una matrícula ACTIVA
-- preservando historial financiero.
--
-- NO corrige pagos.
-- NO cambia beneficios.
-- NO cambia plan financiero.
-- NO cambia fecha académica de ingreso.
--
-- Si existen fondos aplicados sobre una obligación que dejaría
-- de existir, la operación se bloquea y esos fondos deben
-- corregirse primero mediante las RPCs financieras existentes.
-- ============================================================


create or replace function app_private.regularize_enrollment_financial_start_internal(
    p_enrollment_id uuid,
    p_economic_start_on date,
    p_initial_period_amount numeric default null,
    p_initial_period_due_date date default null,
    p_reason text default null
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
    v_enrolled_on date;
    v_cycle_start date;
    v_cycle_end date;
    v_enrollment_status text;

    v_tuition_concept_id uuid;

    v_assignment_id uuid;
    v_plan_id uuid;
    v_installment_count smallint;
    v_old_economic_start_on date;

    v_first_period_start date;

    v_target_period_id uuid;
    v_target_period_due_date date;
    v_target_month_start date;
    v_target_month_end date;

    v_is_preplan boolean := false;
    v_is_partial boolean := false;

    v_charge record;

    v_existing_charge_id uuid;
    v_existing_original numeric;
    v_existing_effective numeric;
    v_existing_applied numeric;
    v_existing_has_adjustments boolean;

    v_agreement_id uuid;
    v_agreed_amount numeric;
    v_standard_amount numeric;
    v_target_amount numeric;
    v_target_due_date date;
    v_delta numeric;

    v_voided_count integer := 0;
    v_created_count integer := 0;
    v_adjusted_count integer := 0;
    v_removed_rule_count integer := 0;
    v_upserted_rule boolean := false;

    v_preplan_charge_id uuid;

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
        'finance.configure',
        'ALL'
    ) then
        raise exception
            'Insufficient permission to regularize enrollment financial start';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_enrollment_id is null then
        raise exception 'enrollment_id is required';
    end if;

    if p_economic_start_on is null then
        raise exception 'economic_start_on is required';
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
        raise exception 'Reason is required';
    end if;


    -- ========================================================
    -- ENROLLMENT
    -- ========================================================

    select
        e.student_id,
        e.cycle_id,
        e.enrolled_on,
        e.status,
        sc.starts_on,
        sc.ends_on
    into
        v_student_id,
        v_cycle_id,
        v_enrolled_on,
        v_enrollment_status,
        v_cycle_start,
        v_cycle_end
    from public.enrollments e

    join public.school_cycles sc
      on sc.id = e.cycle_id

    where e.id = p_enrollment_id

    for update of e;


    if not found then
        raise exception 'Enrollment not found';
    end if;


    if v_enrollment_status <> 'ACTIVA' then
        raise exception
            'Only an active enrollment can have its financial start regularized';
    end if;


    -- Esta operación corrige únicamente el inicio financiero.
    -- No puede crear obligaciones anteriores al ingreso académico.

    if p_economic_start_on < v_enrolled_on then
        raise exception
            'economic_start_on cannot precede enrollment effective date %',
            v_enrolled_on;
    end if;


    if p_economic_start_on < v_cycle_start
       or p_economic_start_on > v_cycle_end
    then
        raise exception
            'economic_start_on must belong to enrollment cycle';
    end if;


    -- ========================================================
    -- TUITION
    -- ========================================================

    select fc.id
    into v_tuition_concept_id

    from public.financial_concepts fc

    where fc.code = 'TUITION'
      and fc.is_active = true;


    if v_tuition_concept_id is null then
        raise exception
            'Active TUITION financial concept not found';
    end if;


    -- ========================================================
    -- CURRENT PLAN ASSIGNMENT
    -- ========================================================

    select
        efpa.id,
        efpa.financial_plan_id,
        fp.installment_count,
        efpa.economic_start_on
    into
        v_assignment_id,
        v_plan_id,
        v_installment_count,
        v_old_economic_start_on

    from public.enrollment_financial_plan_assignments efpa

    join public.financial_plans fp
      on fp.id = efpa.financial_plan_id

    where efpa.enrollment_id = p_enrollment_id
      and efpa.valid_until is null

    for update of efpa;


    if not found then
        raise exception
            'Enrollment has no current financial plan assignment';
    end if;


    if p_economic_start_on = v_old_economic_start_on then
        raise exception
            'Requested economic_start_on is already the current value';
    end if;


    if v_installment_count not in (10, 12) then
        raise exception
            'Unsupported financial plan installment count';
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
    into v_first_period_start

    from public.financial_plan_periods fpp

    where fpp.financial_plan_id = v_plan_id
      and fpp.financial_concept_id = v_tuition_concept_id;


    if v_first_period_start is null then
        raise exception
            'Financial plan has no TUITION periods';
    end if;


    -- ========================================================
    -- CLASSIFY TARGET START
    -- ========================================================

    v_is_preplan :=
        p_economic_start_on < v_first_period_start;


    if v_is_preplan then

        -- Segmento extraordinario anterior al primer periodo.

        if p_initial_period_amount is null then
            raise exception
                'initial_period_amount is required before the first ordinary tuition period';
        end if;

        if p_initial_period_due_date is null then
            raise exception
                'initial_period_due_date is required before the first ordinary tuition period';
        end if;

        v_target_month_start :=
            date_trunc(
                'month',
                p_economic_start_on
            )::date;

        v_target_month_end :=
            (
                v_target_month_start
                + interval '1 month'
                - interval '1 day'
            )::date;

        v_is_partial := true;

    else

        select
            fpp.id,
            fpp.due_date,
            make_date(
                fpp.coverage_year,
                fpp.coverage_month,
                1
            ),
            (
                make_date(
                    fpp.coverage_year,
                    fpp.coverage_month,
                    1
                )
                + interval '1 month'
                - interval '1 day'
            )::date

        into
            v_target_period_id,
            v_target_period_due_date,
            v_target_month_start,
            v_target_month_end

        from public.financial_plan_periods fpp

        where fpp.financial_plan_id = v_plan_id
          and fpp.financial_concept_id = v_tuition_concept_id

          and p_economic_start_on between

              make_date(
                  fpp.coverage_year,
                  fpp.coverage_month,
                  1
              )

              and

              (
                  make_date(
                      fpp.coverage_year,
                      fpp.coverage_month,
                      1
                  )
                  + interval '1 month'
                  - interval '1 day'
              )::date

        limit 1;


        if v_target_period_id is null then
            raise exception
                'No TUITION financial period contains requested economic_start_on';
        end if;


        v_is_partial :=
            p_economic_start_on > v_target_month_start;


        if v_is_partial then

            if p_initial_period_amount is null then
                raise exception
                    'initial_period_amount is required for a partial initial tuition month';
            end if;

        else

            if p_initial_period_amount is not null then
                raise exception
                    'initial_period_amount must be null when economic start is the first day of an ordinary period';
            end if;

            if p_initial_period_due_date is not null then
                raise exception
                    'initial_period_due_date must be null when economic start is the first day of an ordinary period';
            end if;

        end if;

    end if;


    -- ========================================================
    -- LOCK ACTIVE TUITION CHARGES
    -- ========================================================

    perform c.id
    from public.charges c

    where c.enrollment_id = p_enrollment_id
      and c.financial_concept_id = v_tuition_concept_id
      and c.status = 'ACTIVE'

    order by c.id

    for update;


    -- ========================================================
    -- REMOVE OBLIGATIONS BEFORE CORRECT START
    -- ========================================================
    --
    -- They are VOIDed, never deleted.
    --
    -- Applied money must be corrected before this operation.
    -- ========================================================

    for v_charge in

        select
            c.id,
            c.coverage_year,
            c.coverage_month

        from public.charges c

        where c.enrollment_id = p_enrollment_id
          and c.financial_concept_id = v_tuition_concept_id
          and c.status = 'ACTIVE'

          and c.coverage_year is not null
          and c.coverage_month is not null

          and (
              make_date(
                  c.coverage_year,
                  c.coverage_month,
                  1
              )
              + interval '1 month'
              - interval '1 day'
          )::date < p_economic_start_on

    loop

        select
            coalesce((
                select sum(pa.amount)
                from public.payment_allocations pa
                join public.payments p
                  on p.id = pa.payment_id
                where pa.charge_id = v_charge.id
                  and pa.reversed_at is null
                  and p.status = 'CONFIRMED'
            ), 0)

            +

            coalesce((
                select sum(capp.amount)
                from public.credit_applications capp
                join public.credits cr
                  on cr.id = capp.credit_id
                where capp.charge_id = v_charge.id
                  and capp.reversed_at is null
                  and cr.status = 'ACTIVE'
            ), 0)

        into v_existing_applied;


        if v_existing_applied > 0 then
            raise exception
                'Charge % would no longer apply but has % already applied; correct payment/credit allocation first',
                v_charge.id,
                v_existing_applied;
        end if;


        update public.charges
        set
            status = 'VOID',
            updated_at = statement_timestamp()
        where id = v_charge.id;


        v_voided_count :=
            v_voided_count + 1;

    end loop;


    -- ========================================================
    -- REMOVE OBSOLETE CURRENT RULES
    -- ========================================================
    --
    -- enrollment_charge_rules represents the current exception
    -- state. Historical correction remains in audit_log.
    -- ========================================================

    delete from public.enrollment_charge_rules ecr

    using public.financial_plan_periods fpp

    where ecr.enrollment_id = p_enrollment_id

      and ecr.financial_plan_period_id = fpp.id

      and fpp.financial_plan_id = v_plan_id

      and fpp.financial_concept_id = v_tuition_concept_id

      and (
          (
              make_date(
                  fpp.coverage_year,
                  fpp.coverage_month,
                  1
              )
              + interval '1 month'
              - interval '1 day'
          )::date < p_economic_start_on

          or

          (
              not v_is_preplan
              and not v_is_partial
              and fpp.id = v_target_period_id
          )
      );


    get diagnostics
        v_removed_rule_count = row_count;


    -- ========================================================
    -- CORRECT STRUCTURAL ECONOMIC START
    -- ========================================================

    update public.enrollment_financial_plan_assignments
    set
        economic_start_on = p_economic_start_on,
        reason = btrim(p_reason),
        authorized_by = v_actor_id,
        updated_at = statement_timestamp()

    where id = v_assignment_id;


    -- ========================================================
    -- PRE-PLAN SPECIAL SEGMENT
    -- ========================================================

    if v_is_preplan then

        -- Applicable agreement at actual economic start.

        select
            sfa.id,
            sfa.agreed_amount

        into
            v_agreement_id,
            v_agreed_amount

        from public.student_financial_agreements sfa

        where sfa.enrollment_id = p_enrollment_id
          and sfa.financial_concept_id = v_tuition_concept_id

          and sfa.valid_from <= p_economic_start_on

          and (
              sfa.valid_until is null
              or sfa.valid_until >= p_economic_start_on
          )

        order by sfa.valid_from desc

        limit 1;


        if v_agreement_id is null then
            raise exception
                'No TUITION agreement exists at requested economic start';
        end if;


        select c.id
        into v_preplan_charge_id

        from public.charges c

        where c.enrollment_id = p_enrollment_id
          and c.financial_concept_id = v_tuition_concept_id
          and c.status = 'ACTIVE'
          and c.financial_plan_period_id is null
          and c.coverage_year =
              extract(year from p_economic_start_on)::integer
          and c.coverage_month =
              extract(month from p_economic_start_on)::integer

        order by c.created_at desc
        limit 1

        for update;


        if v_preplan_charge_id is null then

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

                extract(year from p_economic_start_on)::integer,
                extract(month from p_economic_start_on)::integer,

                p_initial_period_amount,
                p_initial_period_due_date,

                'INITIAL_PERIOD',
                'ACTIVE',

                v_actor_id
            );

            v_created_count :=
                v_created_count + 1;

        else

            select
                c.original_amount
                + coalesce((
                    select sum(ca.amount)
                    from public.charge_adjustments ca
                    where ca.charge_id = c.id
                ), 0),

                coalesce((
                    select sum(pa.amount)
                    from public.payment_allocations pa
                    join public.payments p
                      on p.id = pa.payment_id
                    where pa.charge_id = c.id
                      and pa.reversed_at is null
                      and p.status = 'CONFIRMED'
                ), 0)

                +

                coalesce((
                    select sum(capp.amount)
                    from public.credit_applications capp
                    join public.credits cr
                      on cr.id = capp.credit_id
                    where capp.charge_id = c.id
                      and capp.reversed_at is null
                      and cr.status = 'ACTIVE'
                ), 0),

                exists (
                    select 1
                    from public.charge_adjustments ca
                    where ca.charge_id = c.id
                )

            into
                v_existing_effective,
                v_existing_applied,
                v_existing_has_adjustments

            from public.charges c

            where c.id = v_preplan_charge_id;


            if p_initial_period_amount < v_existing_applied then
                raise exception
                    'Target initial amount % is below already applied amount %',
                    p_initial_period_amount,
                    v_existing_applied;
            end if;


            v_delta :=
                p_initial_period_amount
                - v_existing_effective;


            if v_delta <> 0 then

                insert into public.charge_adjustments (
                    charge_id,
                    amount,
                    adjustment_type,
                    reason,
                    created_by
                )
                values (
                    v_preplan_charge_id,
                    v_delta,
                    'CORRECTION',
                    btrim(p_reason),
                    v_actor_id
                );

                v_adjusted_count :=
                    v_adjusted_count + 1;

            end if;


            update public.charges
            set
                due_date = p_initial_period_due_date,
                updated_at = statement_timestamp()
            where id = v_preplan_charge_id;

        end if;

    end if;


    -- ========================================================
    -- MATERIALIZE / RECONCILE ORDINARY PLAN PERIODS
    -- ========================================================

    for v_charge in

        select
            fpp.id as period_id,
            fpp.coverage_year,
            fpp.coverage_month,
            fpp.due_date,
            fpp.sort_order

        from public.financial_plan_periods fpp

        where fpp.financial_plan_id = v_plan_id
          and fpp.financial_concept_id = v_tuition_concept_id

        order by fpp.sort_order

    loop

        v_target_month_start :=
            make_date(
                v_charge.coverage_year,
                v_charge.coverage_month,
                1
            );

        v_target_month_end :=
            (
                v_target_month_start
                + interval '1 month'
                - interval '1 day'
            )::date;


        if v_target_month_end < p_economic_start_on then
            continue;
        end if;


        -- Agreement applicable when obligation begins in period.

        select
            sfa.id,
            sfa.agreed_amount

        into
            v_agreement_id,
            v_agreed_amount

        from public.student_financial_agreements sfa

        where sfa.enrollment_id = p_enrollment_id
          and sfa.financial_concept_id = v_tuition_concept_id

          and sfa.valid_from <=
              greatest(
                  v_target_month_start,
                  p_economic_start_on
              )

          and (
              sfa.valid_until is null
              or
              sfa.valid_until >=
                  greatest(
                      v_target_month_start,
                      p_economic_start_on
                  )
          )

        order by sfa.valid_from desc

        limit 1;


        if v_agreement_id is null then
            raise exception
                'No TUITION financial agreement exists for period %-%',
                v_charge.coverage_year,
                v_charge.coverage_month;
        end if;


        v_standard_amount :=
            round(
                (
                    v_agreed_amount
                    * 12
                    / v_installment_count
                )::numeric,
                2
            );


        v_target_amount :=
            v_standard_amount;

        v_target_due_date :=
            v_charge.due_date;


        -- First partial ordinary period.

        if not v_is_preplan
           and v_charge.period_id = v_target_period_id
           and v_is_partial
        then

            v_target_amount :=
                p_initial_period_amount;

            v_target_due_date :=
                coalesce(
                    p_initial_period_due_date,
                    v_charge.due_date
                );

        end if;


        -- Existing active charge for this period.

        v_existing_charge_id := null;

        select c.id
        into v_existing_charge_id

        from public.charges c

        where c.enrollment_id = p_enrollment_id
          and c.financial_concept_id = v_tuition_concept_id
          and c.financial_plan_period_id = v_charge.period_id
          and c.status = 'ACTIVE'

        order by c.created_at desc
        limit 1

        for update;


        -- ----------------------------------------------------
        -- MISSING CHARGE
        -- ----------------------------------------------------

        if v_existing_charge_id is null then

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
                v_charge.period_id,
                v_agreement_id,

                v_charge.coverage_year,
                v_charge.coverage_month,

                v_target_amount,
                v_target_due_date,

                'FINANCIAL_REGULARIZATION',
                'ACTIVE',

                v_actor_id
            );


            v_created_count :=
                v_created_count + 1;


        -- ----------------------------------------------------
        -- EXISTING TARGET PARTIAL PERIOD
        -- ----------------------------------------------------

        elsif not v_is_preplan
              and v_charge.period_id = v_target_period_id
              and v_is_partial
        then

            select
                c.original_amount,

                c.original_amount
                + coalesce((
                    select sum(ca.amount)
                    from public.charge_adjustments ca
                    where ca.charge_id = c.id
                ), 0),

                coalesce((
                    select sum(pa.amount)
                    from public.payment_allocations pa
                    join public.payments p
                      on p.id = pa.payment_id
                    where pa.charge_id = c.id
                      and pa.reversed_at is null
                      and p.status = 'CONFIRMED'
                ), 0)

                +

                coalesce((
                    select sum(capp.amount)
                    from public.credit_applications capp
                    join public.credits cr
                      on cr.id = capp.credit_id
                    where capp.charge_id = c.id
                      and capp.reversed_at is null
                      and cr.status = 'ACTIVE'
                ), 0),

                exists (
                    select 1
                    from public.charge_adjustments ca
                    where ca.charge_id = c.id
                )

            into
                v_existing_original,
                v_existing_effective,
                v_existing_applied,
                v_existing_has_adjustments

            from public.charges c

            where c.id = v_existing_charge_id;


            if v_target_amount < v_existing_applied then
                raise exception
                    'Target amount % for charge % is below already applied amount %',
                    v_target_amount,
                    v_existing_charge_id,
                    v_existing_applied;
            end if;


            -- If financial history exists, append adjustment.
            -- Otherwise preserve old row as VOID and replace it.

            if v_existing_applied > 0
               or v_existing_has_adjustments
            then

                v_delta :=
                    v_target_amount
                    - v_existing_effective;


                if v_delta <> 0 then

                    insert into public.charge_adjustments (
                        charge_id,
                        amount,
                        adjustment_type,
                        reason,
                        created_by
                    )
                    values (
                        v_existing_charge_id,
                        v_delta,
                        'CORRECTION',
                        btrim(p_reason),
                        v_actor_id
                    );


                    v_adjusted_count :=
                        v_adjusted_count + 1;

                end if;


                update public.charges
                set
                    due_date = v_target_due_date,
                    updated_at = statement_timestamp()
                where id = v_existing_charge_id;


            else

                update public.charges
                set
                    status = 'VOID',
                    updated_at = statement_timestamp()
                where id = v_existing_charge_id;


                v_voided_count :=
                    v_voided_count + 1;


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
                    v_charge.period_id,
                    v_agreement_id,

                    v_charge.coverage_year,
                    v_charge.coverage_month,

                    v_target_amount,
                    v_target_due_date,

                    'FINANCIAL_REGULARIZATION',
                    'ACTIVE',

                    v_actor_id
                );


                v_created_count :=
                    v_created_count + 1;

            end if;

        end if;

    end loop;


    -- ========================================================
    -- CURRENT CUSTOM RULE FOR PARTIAL ORDINARY MONTH
    -- ========================================================

    if not v_is_preplan
       and v_is_partial
    then

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
            v_target_period_id,
            'CUSTOM',
            p_initial_period_due_date,
            p_initial_period_amount,
            btrim(p_reason),
            v_actor_id
        )

        on conflict (
            enrollment_id,
            financial_plan_period_id
        )
        do update
        set
            action = 'CUSTOM',
            custom_due_date =
                excluded.custom_due_date,
            custom_amount =
                excluded.custom_amount,
            reason =
                excluded.reason,
            authorized_by =
                excluded.authorized_by,
            updated_at =
                statement_timestamp();


        v_upserted_rule := true;

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

        'ENROLLMENT_FINANCIAL_START_REGULARIZED',

        'enrollment_financial_plan_assignments',

        v_assignment_id,

        jsonb_build_object(
            'economic_start_on',
                v_old_economic_start_on
        ),

        jsonb_build_object(
            'economic_start_on',
                p_economic_start_on,

            'initial_period_amount',
                p_initial_period_amount,

            'initial_period_due_date',
                p_initial_period_due_date,

            'preplan_initial_period',
                v_is_preplan,

            'partial_initial_period',
                v_is_partial,

            'voided_charges',
                v_voided_count,

            'created_charges',
                v_created_count,

            'adjusted_charges',
                v_adjusted_count,

            'removed_charge_rules',
                v_removed_rule_count,

            'custom_rule_upserted',
                v_upserted_rule
        ),

        btrim(p_reason),

        v_correlation_id
    );


    return v_assignment_id;

end;
$$;


-- ============================================================
-- PUBLIC WRAPPER
-- ============================================================

create or replace function public.regularize_enrollment_financial_start(
    p_enrollment_id uuid,
    p_economic_start_on date,
    p_initial_period_amount numeric default null,
    p_initial_period_due_date date default null,
    p_reason text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
    select
        app_private.regularize_enrollment_financial_start_internal(
            p_enrollment_id,
            p_economic_start_on,
            p_initial_period_amount,
            p_initial_period_due_date,
            p_reason
        );
$$;


-- ============================================================
-- PRIVILEGES
-- ============================================================

revoke all
on function app_private.regularize_enrollment_financial_start_internal(
    uuid,
    date,
    numeric,
    date,
    text
)
from public, anon, authenticated;


revoke all
on function public.regularize_enrollment_financial_start(
    uuid,
    date,
    numeric,
    date,
    text
)
from public, anon;


grant execute
on function public.regularize_enrollment_financial_start(
    uuid,
    date,
    numeric,
    date,
    text
)
to authenticated;