-- ============================================================
-- M4.10 — Asignación / cambio / retiro de categoría financiera
-- ============================================================
--
-- p_category_id:
--   UUID  -> asignar/cambiar categoría
--   NULL  -> retirar categoría y volver al monto base
--
-- p_effect_mode:
--   CURRENT
--      aplica el nuevo monto completo desde el periodo actual
--
--   NEXT
--      mantiene el periodo actual y aplica desde el siguiente
--
--   PROPORTIONAL
--      el operador define explícitamente el monto final del
--      periodo actual mediante p_current_period_amount.
--      Los periodos siguientes usan el monto completo resultante
--      de la categoría.
--
-- Reglas:
--   - máximo una categoría vigente por enrollment
--   - categoría del mismo ciclo
--   - usa versión vigente de categoría
--   - crea/versiona student_financial_agreements
--   - nunca modifica original_amount de un cargo existente
--   - cargos sin actividad: VOID + cargo nuevo
--   - cargos con actividad: ajuste append-only
--   - plan 10: monto mensual acordado * 12 / 10
--   - plan 12: monto mensual acordado
--   - reducción nunca supera tarifa base
--   - 100% => obligación $0
--
-- ============================================================


create or replace function
app_private.set_enrollment_tuition_discount_internal(
    p_enrollment_id uuid,
    p_category_id uuid,
    p_effective_on date,
    p_effect_mode text,
    p_current_period_amount numeric,
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
    v_cycle_start date;
    v_cycle_end date;

    v_tuition_concept_id uuid;

    -- Current plan
    v_plan_assignment_id uuid;
    v_plan_id uuid;
    v_installment_count smallint;
    v_economic_start_on date;

    -- Current agreement
    v_old_agreement_id uuid;
    v_old_agreement_valid_from date;
    v_base_rate_id uuid;
    v_base_amount numeric;

    v_old_discount_version_id uuid;
    v_old_agreed_amount numeric;

    -- Category/version
    v_category_cycle_id uuid;
    v_category_type text;
    v_category_active boolean;

    v_category_version_id uuid;
    v_category_value numeric;

    v_reduction_amount numeric;
    v_new_agreed_amount numeric;

    -- Discount assignment history
    v_current_assignment_id uuid;
    v_current_assignment_category_id uuid;
    v_current_assignment_valid_from date;
    v_new_assignment_id uuid;

    -- New agreement
    v_new_agreement_id uuid;

    -- Period selection
    v_current_coverage_sort integer;
    v_start_sort integer;

    -- Charge iteration
    v_charge record;

    v_standard_charge_amount numeric;
    v_target_charge_amount numeric;

    v_effective_charge_amount numeric;
    v_payment_applied numeric;
    v_credit_applied numeric;
    v_has_adjustments boolean;
    v_has_activity boolean;

    v_adjustment_amount numeric;

    v_voided_count integer := 0;
    v_created_count integer := 0;
    v_adjusted_count integer := 0;

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
            'Insufficient permission to configure tuition discount';
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


    if p_effect_mode not in (
        'CURRENT',
        'NEXT',
        'PROPORTIONAL'
    )
    then
        raise exception
            'effect_mode must be CURRENT, NEXT or PROPORTIONAL';
    end if;


    if p_effect_mode = 'PROPORTIONAL' then

        if p_current_period_amount is null then
            raise exception
                'current_period_amount is required for PROPORTIONAL';
        end if;


        if p_current_period_amount < 0 then
            raise exception
                'current_period_amount cannot be negative';
        end if;

    else

        if p_current_period_amount is not null then
            raise exception
                'current_period_amount is only allowed for PROPORTIONAL';
        end if;

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
        sc.starts_on,
        sc.ends_on

    into
        v_student_id,
        v_cycle_id,
        v_cycle_start,
        v_cycle_end

    from public.enrollments e

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
    -- CURRENT FINANCIAL PLAN
    -- ========================================================

    select
        efpa.id,
        efpa.financial_plan_id,
        fp.installment_count,
        efpa.economic_start_on

    into
        v_plan_assignment_id,
        v_plan_id,
        v_installment_count,
        v_economic_start_on

    from public.enrollment_financial_plan_assignments efpa

    join public.financial_plans fp
      on fp.id =
         efpa.financial_plan_id

    where efpa.enrollment_id =
          p_enrollment_id

      and efpa.valid_until is null

    for update of efpa;


    if not found then
        raise exception
            'Enrollment has no current financial plan';
    end if;


    if v_installment_count not in (10, 12) then
        raise exception
            'Unsupported financial plan installment count';
    end if;


    -- ========================================================
    -- CURRENT TUITION AGREEMENT
    -- ========================================================

    select
        sfa.id,
        sfa.valid_from,
        sfa.base_rate_id,
        sfa.base_amount_snapshot,
        sfa.discount_category_version_id,
        sfa.agreed_amount

    into
        v_old_agreement_id,
        v_old_agreement_valid_from,
        v_base_rate_id,
        v_base_amount,
        v_old_discount_version_id,
        v_old_agreed_amount

    from public.student_financial_agreements sfa

    where sfa.enrollment_id =
          p_enrollment_id

      and sfa.financial_concept_id =
          v_tuition_concept_id

      and sfa.valid_until is null

    for update;


    if not found then
        raise exception
            'Enrollment has no current TUITION agreement';
    end if;


    if v_base_rate_id is null then
        raise exception
            'Current TUITION agreement has no base rate';
    end if;


    if p_effective_on <
       v_old_agreement_valid_from
    then
        raise exception
            'effective_on cannot precede current tuition agreement';
    end if;


    -- ========================================================
    -- CURRENT DISCOUNT ASSIGNMENT
    -- ========================================================

    select
        etda.id,
        etda.category_id,
        etda.valid_from

    into
        v_current_assignment_id,
        v_current_assignment_category_id,
        v_current_assignment_valid_from

    from public.enrollment_tuition_discount_assignments etda

    where etda.enrollment_id =
          p_enrollment_id

      and etda.valid_until is null

    for update;


    -- ========================================================
    -- CATEGORY / VERSION
    -- ========================================================
    --
    -- NULL means removal of category.
    -- ========================================================

    if p_category_id is null then

        if v_current_assignment_id is null
           and v_old_discount_version_id is null
        then
            raise exception
                'Enrollment has no tuition discount to remove';
        end if;


        v_category_version_id := null;
        v_category_value := null;
        v_category_type := null;

        v_reduction_amount := 0;
        v_new_agreed_amount :=
            v_base_amount;

    else

        select
            tdc.cycle_id,
            tdc.discount_type,
            tdc.is_active

        into
            v_category_cycle_id,
            v_category_type,
            v_category_active

        from public.tuition_discount_categories tdc

        where tdc.id =
              p_category_id

        for update;


        if not found then
            raise exception
                'Tuition discount category not found';
        end if;


        if not v_category_active then
            raise exception
                'Tuition discount category is inactive';
        end if;


        if v_category_cycle_id <>
           v_cycle_id
        then
            raise exception
                'Tuition discount category belongs to another cycle';
        end if;


        select
            tdcv.id,
            tdcv.value

        into
            v_category_version_id,
            v_category_value

        from public.tuition_discount_category_versions tdcv

        where tdcv.category_id =
              p_category_id

          and tdcv.valid_from <=
              p_effective_on

          and (
              tdcv.valid_until is null
              or
              tdcv.valid_until >=
              p_effective_on
          )

        order by
            tdcv.valid_from desc

        limit 1

        for update;


        if v_category_version_id is null then
            raise exception
                'No category version exists at effective_on';
        end if;


        if v_category_type =
           'PERCENTAGE'
        then

            v_reduction_amount :=
                round(
                    (
                        v_base_amount
                        * v_category_value
                        / 100
                    )::numeric,
                    2
                );

        elsif v_category_type =
              'FIXED_AMOUNT'
        then

            v_reduction_amount :=
                least(
                    v_base_amount,
                    v_category_value
                );

        else

            raise exception
                'Unsupported tuition discount type';

        end if;


        v_reduction_amount :=
            least(
                v_base_amount,
                greatest(
                    0,
                    v_reduction_amount
                )
            );


        v_new_agreed_amount :=
            v_base_amount
            - v_reduction_amount;

    end if;


    -- ========================================================
    -- FIND PERIOD CONTAINING EFFECTIVE DATE
    -- ========================================================

    select
        min(fpp.sort_order)

    into
        v_current_coverage_sort

    from public.financial_plan_periods fpp

    where fpp.financial_plan_id =
          v_plan_id

      and fpp.financial_concept_id =
          v_tuition_concept_id

      and p_effective_on between

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
          )::date;


    -- ========================================================
    -- DETERMINE FIRST AFFECTED ACTIVE CHARGE
    -- ========================================================

    if p_effect_mode = 'NEXT'
       and v_current_coverage_sort is not null
    then

        select min(fpp.sort_order)

        into v_start_sort

        from public.charges c

        join public.financial_plan_periods fpp
          on fpp.id =
             c.financial_plan_period_id

        where c.enrollment_id =
              p_enrollment_id

          and c.status =
              'ACTIVE'

          and fpp.financial_plan_id =
              v_plan_id

          and fpp.financial_concept_id =
              v_tuition_concept_id

          and fpp.sort_order >
              v_current_coverage_sort;

    else

        select min(fpp.sort_order)

        into v_start_sort

        from public.charges c

        join public.financial_plan_periods fpp
          on fpp.id =
             c.financial_plan_period_id

        where c.enrollment_id =
              p_enrollment_id

          and c.status =
              'ACTIVE'

          and fpp.financial_plan_id =
              v_plan_id

          and fpp.financial_concept_id =
              v_tuition_concept_id

          and (
              (
                  p_effect_mode in (
                      'CURRENT',
                      'PROPORTIONAL'
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
                  )::date >=
                  p_effective_on
              )

              or

              (
                  p_effect_mode = 'NEXT'
                  and
                  make_date(
                      fpp.coverage_year,
                      fpp.coverage_month,
                      1
                  ) >
                  p_effective_on
              )
          );

    end if;


    if v_start_sort is null then
        raise exception
            'No active tuition period exists for requested effect';
    end if;


    -- ========================================================
    -- DISCOUNT ASSIGNMENT HISTORY
    -- ========================================================

    if v_current_assignment_id is not null then

        if p_effective_on <
           v_current_assignment_valid_from
        then
            raise exception
                'effective_on cannot precede current discount assignment';
        end if;


        if p_effective_on =
           v_current_assignment_valid_from
        then

            -- Same-day replacement:
            -- no distinct business validity existed yet.

            if p_category_id is not null then

                update public.enrollment_tuition_discount_assignments
                set
                    category_id =
                        p_category_id,

                    reason =
                        btrim(p_reason),

                    authorized_by =
                        v_actor_id,

                    updated_at =
                        statement_timestamp()

                where id =
                      v_current_assignment_id

                returning id
                into v_new_assignment_id;

            else

                -- Preserve the assignment row when removing
                -- on the same date.

                update public.enrollment_tuition_discount_assignments
                set
                    valid_until =
                        p_effective_on,

                    reason =
                        btrim(p_reason),

                    authorized_by =
                        v_actor_id,

                    updated_at =
                        statement_timestamp()

                where id =
                      v_current_assignment_id;


                v_new_assignment_id := null;

            end if;

        else

            update public.enrollment_tuition_discount_assignments
            set
                valid_until =
                    p_effective_on - 1,

                updated_at =
                    statement_timestamp()

            where id =
                  v_current_assignment_id;


            if p_category_id is not null then

                insert into public.enrollment_tuition_discount_assignments (
                    enrollment_id,
                    category_id,
                    valid_from,
                    valid_until,
                    reason,
                    authorized_by
                )
                values (
                    p_enrollment_id,
                    p_category_id,
                    p_effective_on,
                    null,
                    btrim(p_reason),
                    v_actor_id
                )
                returning id
                into v_new_assignment_id;

            end if;

        end if;

    elsif p_category_id is not null then

        insert into public.enrollment_tuition_discount_assignments (
            enrollment_id,
            category_id,
            valid_from,
            valid_until,
            reason,
            authorized_by
        )
        values (
            p_enrollment_id,
            p_category_id,
            p_effective_on,
            null,
            btrim(p_reason),
            v_actor_id
        )
        returning id
        into v_new_assignment_id;

    end if;


    -- ========================================================
    -- AGREEMENT HISTORY
    -- ========================================================

    if p_effective_on =
       v_old_agreement_valid_from
    then

        -- Same-day replacement:
        -- reuse agreement because no previous distinct validity
        -- period existed.

        update public.student_financial_agreements
        set
            benefit_id =
                null,

            benefit_type_snapshot =
                null,

            benefit_value_snapshot =
                null,

            reduction_amount_snapshot =
                v_reduction_amount,

            agreed_amount =
                v_new_agreed_amount,

            discount_category_version_id =
                v_category_version_id,

            reason =
                btrim(p_reason),

            authorized_by =
                v_actor_id,

            updated_at =
                statement_timestamp()

        where id =
              v_old_agreement_id

        returning id
        into v_new_agreement_id;

    else

        update public.student_financial_agreements
        set
            valid_until =
                p_effective_on - 1,

            updated_at =
                statement_timestamp()

        where id =
              v_old_agreement_id;


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
            v_reduction_amount,
            v_new_agreed_amount,

            v_category_version_id,

            p_effective_on,
            null,

            btrim(p_reason),
            v_actor_id
        )
        returning id
        into v_new_agreement_id;

    end if;


    -- ========================================================
    -- LOCK AFFECTED ACTIVE CHARGES
    -- ========================================================

    perform c.id

    from public.charges c

    join public.financial_plan_periods fpp
      on fpp.id =
         c.financial_plan_period_id

    where c.enrollment_id =
          p_enrollment_id

      and c.status =
          'ACTIVE'

      and fpp.financial_plan_id =
          v_plan_id

      and fpp.financial_concept_id =
          v_tuition_concept_id

      and fpp.sort_order >=
          v_start_sort

    order by fpp.sort_order

    for update of c;


    -- ========================================================
    -- RECONCILE CHARGES
    -- ========================================================

    for v_charge in

        select
            c.id,
            c.financial_plan_period_id,
            c.coverage_year,
            c.coverage_month,
            c.due_date,
            c.original_amount,
            c.financial_agreement_id,

            fpp.sort_order

        from public.charges c

        join public.financial_plan_periods fpp
          on fpp.id =
             c.financial_plan_period_id

        where c.enrollment_id =
              p_enrollment_id

          and c.status =
              'ACTIVE'

          and fpp.financial_plan_id =
              v_plan_id

          and fpp.financial_concept_id =
              v_tuition_concept_id

          and fpp.sort_order >=
              v_start_sort

        order by fpp.sort_order

    loop

        -- Standard installment resulting from agreement.

        v_standard_charge_amount :=
            round(
                (
                    v_new_agreed_amount
                    * 12
                    / v_installment_count
                )::numeric,
                2
            );


        if p_effect_mode = 'PROPORTIONAL'
           and
           v_charge.sort_order =
               v_start_sort
        then

            v_target_charge_amount :=
                p_current_period_amount;

        else

            v_target_charge_amount :=
                v_standard_charge_amount;

        end if;


        -- -----------------------------------------------
        -- Current effective charge value
        -- -----------------------------------------------

        select
            v_charge.original_amount
            +
            coalesce(
                sum(ca.amount),
                0
            )

        into
            v_effective_charge_amount

        from public.charge_adjustments ca

        where ca.charge_id =
              v_charge.id;


        -- -----------------------------------------------
        -- Active confirmed payment allocations
        -- -----------------------------------------------

        select
            coalesce(
                sum(pa.amount),
                0
            )

        into
            v_payment_applied

        from public.payment_allocations pa

        join public.payments p
          on p.id =
             pa.payment_id

        where pa.charge_id =
              v_charge.id

          and pa.reversed_at is null

          and p.status =
              'CONFIRMED';


        -- -----------------------------------------------
        -- Active credit applications
        -- -----------------------------------------------

        select
            coalesce(
                sum(ca.amount),
                0
            )

        into
            v_credit_applied

        from public.credit_applications ca

        join public.credits cr
          on cr.id =
             ca.credit_id

        where ca.charge_id =
              v_charge.id

          and ca.reversed_at is null

          and cr.status =
              'ACTIVE';


        select exists (
            select 1

            from public.charge_adjustments ca

            where ca.charge_id =
                  v_charge.id
        )
        into v_has_adjustments;


        v_has_activity :=
            (
                v_payment_applied > 0
                or
                v_credit_applied > 0
                or
                v_has_adjustments
            );


        -- New obligation cannot fall below already-applied money.

        if v_target_charge_amount <
           (
               v_payment_applied
               + v_credit_applied
           )
        then
            raise exception
                'Target tuition amount % for charge % is below applied funds %',
                v_target_charge_amount,
                v_charge.id,
                (
                    v_payment_applied
                    + v_credit_applied
                );
        end if;


        -- ====================================================
        -- CHARGE WITH FINANCIAL HISTORY
        -- ====================================================
        --
        -- Do not replace it. Preserve original row and append
        -- an AGREEMENT adjustment to reach target.
        -- ====================================================

        if v_has_activity then

            v_adjustment_amount :=
                v_target_charge_amount
                - v_effective_charge_amount;


            if v_adjustment_amount <> 0 then

                insert into public.charge_adjustments (
                    charge_id,
                    amount,
                    adjustment_type,
                    reason,
                    created_by
                )
                values (
                    v_charge.id,
                    v_adjustment_amount,
                    'AGREEMENT',
                    btrim(p_reason),
                    v_actor_id
                );


                v_adjusted_count :=
                    v_adjusted_count + 1;

            end if;


        -- ====================================================
        -- CHARGE WITHOUT FINANCIAL HISTORY
        -- ====================================================
        --
        -- Preserve old row as VOID and create replacement
        -- pointing to the new financial agreement.
        -- ====================================================

        else

            update public.charges
            set
                status =
                    'VOID',

                updated_at =
                    statement_timestamp()

            where id =
                  v_charge.id;


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
                v_charge.financial_plan_period_id,
                v_new_agreement_id,

                v_charge.coverage_year,
                v_charge.coverage_month,

                v_target_charge_amount,
                v_charge.due_date,

                'FINANCIAL_PLAN',
                'ACTIVE',

                v_actor_id
            );


            v_created_count :=
                v_created_count + 1;

        end if;

    end loop;


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

        case
            when p_category_id is null
                then 'TUITION_DISCOUNT_REMOVED'
            when v_current_assignment_id is null
                then 'TUITION_DISCOUNT_ASSIGNED'
            else 'TUITION_DISCOUNT_CHANGED'
        end,

        'enrollment_tuition_discount_assignments',

        coalesce(
            v_new_assignment_id,
            v_current_assignment_id
        ),

        jsonb_build_object(
            'category_id',
                v_current_assignment_category_id,

            'agreement_id',
                v_old_agreement_id,

            'discount_category_version_id',
                v_old_discount_version_id,

            'agreed_amount',
                v_old_agreed_amount
        ),

        jsonb_build_object(
            'category_id',
                p_category_id,

            'category_version_id',
                v_category_version_id,

            'discount_type',
                v_category_type,

            'category_value',
                v_category_value,

            'base_amount',
                v_base_amount,

            'reduction_amount',
                v_reduction_amount,

            'agreed_amount',
                v_new_agreed_amount,

            'effect_mode',
                p_effect_mode,

            'effective_on',
                p_effective_on,

            'first_affected_sort_order',
                v_start_sort,

            'proportional_current_amount',
                case
                    when p_effect_mode = 'PROPORTIONAL'
                    then p_current_period_amount
                    else null
                end,

            'new_agreement_id',
                v_new_agreement_id,

            'voided_charges',
                v_voided_count,

            'created_charges',
                v_created_count,

            'adjusted_charges',
                v_adjusted_count
        ),

        btrim(p_reason),

        v_correlation_id
    );


    return v_new_agreement_id;

end;
$$;



-- ============================================================
-- INTERNAL PRIVILEGES
-- ============================================================

revoke all
on function
app_private.set_enrollment_tuition_discount_internal(
    uuid,
    uuid,
    date,
    text,
    numeric,
    text
)
from public, anon;


grant execute
on function
app_private.set_enrollment_tuition_discount_internal(
    uuid,
    uuid,
    date,
    text,
    numeric,
    text
)
to authenticated;



-- ============================================================
-- PUBLIC RPC
-- ============================================================

create or replace function
public.set_enrollment_tuition_discount(
    p_enrollment_id uuid,
    p_category_id uuid,
    p_effective_on date,
    p_effect_mode text,
    p_current_period_amount numeric default null,
    p_reason text default null
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.set_enrollment_tuition_discount_internal(
            p_enrollment_id,
            p_category_id,
            p_effective_on,
            p_effect_mode,
            p_current_period_amount,
            p_reason
        );
$$;


revoke all
on function
public.set_enrollment_tuition_discount(
    uuid,
    uuid,
    date,
    text,
    numeric,
    text
)
from public, anon;


grant execute
on function
public.set_enrollment_tuition_discount(
    uuid,
    uuid,
    date,
    text,
    numeric,
    text
)
to authenticated;


-- ============================================================
-- FIN M4.10
-- ============================================================