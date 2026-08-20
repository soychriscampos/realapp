-- ============================================================
-- M4.1 — Cambio de plan financiero 12 -> 10
-- ============================================================

-- ------------------------------------------------------------
-- 1. Evitar dos cargos ACTIVE para el mismo periodo del plan
-- ------------------------------------------------------------

create unique index if not exists
charges_active_enrollment_plan_period_uq
on public.charges(
    enrollment_id,
    financial_plan_period_id
)
where enrollment_id is not null
  and financial_plan_period_id is not null
  and status = 'ACTIVE';


-- ------------------------------------------------------------
-- 2. RPC INTERNA
-- ------------------------------------------------------------

create or replace function
app_private.change_enrollment_financial_plan_internal(
    p_enrollment_id uuid,
    p_target_financial_plan_id uuid,
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

    v_student_id uuid;
    v_cycle_id uuid;
    v_grade_level_id uuid;
    v_education_level_id uuid;

    v_cycle_start date;
    v_cycle_end date;

    v_current_assignment_id uuid;
    v_current_plan_id uuid;
    v_current_installments smallint;
    v_current_valid_from date;
    v_economic_start_on date;

    v_target_installments smallint;
    v_target_cycle_id uuid;
    v_target_level_id uuid;
    v_target_status text;

    v_tuition_concept_id uuid;

    v_new_assignment_id uuid;

    v_period record;

    v_agreement_id uuid;
    v_monthly_amount numeric;
    v_installment_amount numeric;

    v_period_month_start date;
    v_period_month_end date;

    v_voided_charge_count integer := 0;
    v_created_charge_count integer := 0;

    v_correlation_id uuid := gen_random_uuid();
begin

    -- ========================================================
    -- AUTH
    -- ========================================================

    v_actor_id := (select auth.uid());

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
            'Insufficient permission to change financial plan';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_enrollment_id is null then
        raise exception 'enrollment_id is required';
    end if;

    if p_target_financial_plan_id is null then
        raise exception
            'target_financial_plan_id is required';
    end if;

    if p_effective_on is null then
        raise exception 'effective_on is required';
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
      on gl.id = e.grade_level_id

    join public.school_cycles sc
      on sc.id = e.cycle_id

    where e.id = p_enrollment_id

    for update of e;


    if not found then
        raise exception 'Enrollment not found';
    end if;


    if p_effective_on < v_cycle_start
       or p_effective_on > v_cycle_end
    then
        raise exception
            'effective_on must belong to enrollment cycle';
    end if;


    -- ========================================================
    -- CURRENT PLAN
    -- ========================================================

    select
        efpa.id,
        efpa.financial_plan_id,
        fp.installment_count,
        efpa.valid_from,
        efpa.economic_start_on
    into
        v_current_assignment_id,
        v_current_plan_id,
        v_current_installments,
        v_current_valid_from,
        v_economic_start_on
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


    if v_current_installments <> 12 then
        raise exception
            'Only a 12-payment plan can be changed to the 10-payment plan';
    end if;


    if v_current_plan_id =
       p_target_financial_plan_id
    then
        raise exception
            'Target plan is already the current plan';
    end if;


    if p_effective_on < v_current_valid_from then
        raise exception
            'effective_on cannot precede current plan assignment';
    end if;


    -- ========================================================
    -- TARGET PLAN
    -- ========================================================

    select
        fp.installment_count,
        fp.cycle_id,
        fp.education_level_id,
        fp.status
    into
        v_target_installments,
        v_target_cycle_id,
        v_target_level_id,
        v_target_status
    from public.financial_plans fp
    where fp.id =
          p_target_financial_plan_id;


    if not found then
        raise exception
            'Target financial plan not found';
    end if;


    if v_target_installments <> 10 then
        raise exception
            'Target plan must contain 10 installments';
    end if;


    if v_target_cycle_id <> v_cycle_id then
        raise exception
            'Target plan belongs to a different cycle';
    end if;


    if v_target_level_id <>
       v_education_level_id
    then
        raise exception
            'Target plan belongs to a different education level';
    end if;


    if v_target_status = 'INACTIVE' then
        raise exception
            'Target financial plan is inactive';
    end if;


    -- ========================================================
    -- TUITION CONCEPT
    -- ========================================================

    select fc.id
    into v_tuition_concept_id
    from public.financial_concepts fc
    where fc.code = 'TUITION';


    if v_tuition_concept_id is null then
        raise exception
            'TUITION financial concept not found';
    end if;


    -- ========================================================
    -- FIRST PAYMENT RULE
    -- ========================================================
    --
    -- Cualquier allocation histórica sobre una colegiatura
    -- de este enrollment significa que ya existió el primer
    -- pago.
    --
    -- Incluso si posteriormente fue revertida, la operación
    -- ya ocurrió y el plan queda fijado.
    -- ========================================================

    if exists (
        select 1

        from public.payment_allocations pa

        join public.charges c
          on c.id = pa.charge_id

        where c.enrollment_id =
              p_enrollment_id

          and c.financial_concept_id =
              v_tuition_concept_id
    )
    then
        raise exception
            'Financial plan cannot be changed after the first tuition payment';
    end if;


    -- ========================================================
    -- NO CREDIT ACTIVITY
    -- ========================================================

    if exists (
        select 1

        from public.credit_applications ca

        join public.charges c
          on c.id = ca.charge_id

        where c.enrollment_id =
              p_enrollment_id

          and c.financial_concept_id =
              v_tuition_concept_id
    )
    then
        raise exception
            'Financial plan cannot be changed after tuition credit activity';
    end if;


    -- ========================================================
    -- NO CHARGE ADJUSTMENTS
    -- ========================================================

    if exists (
        select 1

        from public.charge_adjustments ca

        join public.charges c
          on c.id = ca.charge_id

        where c.enrollment_id =
              p_enrollment_id

          and c.financial_concept_id =
              v_tuition_concept_id
    )
    then
        raise exception
            'Financial plan cannot be changed while tuition charges have adjustments';
    end if;


    -- ========================================================
    -- NO SPECIAL CHARGE RULES
    -- ========================================================
    --
    -- Una regla manual/proporcional requiere tratamiento
    -- explícito y no debe reinterpretarse silenciosamente
    -- durante un cambio de plan.
    -- ========================================================

    if exists (
        select 1

        from public.enrollment_charge_rules ecr

        join public.financial_plan_periods fpp
          on fpp.id =
             ecr.financial_plan_period_id

        where ecr.enrollment_id =
              p_enrollment_id

          and fpp.financial_plan_id =
              v_current_plan_id
    )
    then
        raise exception
            'Enrollment has charge rules that must be resolved before changing plan';
    end if;


    -- ========================================================
    -- LOCK CURRENT TUITION CHARGES
    -- ========================================================

    perform c.id

    from public.charges c

    join public.financial_plan_periods fpp
      on fpp.id =
         c.financial_plan_period_id

    where c.enrollment_id =
          p_enrollment_id

      and c.financial_concept_id =
          v_tuition_concept_id

      and fpp.financial_plan_id =
          v_current_plan_id

      and c.status = 'ACTIVE'

    order by c.id

    for update;


    -- ========================================================
    -- CLOSE / REPLACE PLAN ASSIGNMENT
    -- ========================================================
    --
    -- Si el cambio ocurre el mismo día en que nació la
    -- asignación, no podemos crear dos rangos date distintos.
    --
    -- En ese caso simplemente sustituimos esa asignación:
    -- todavía no existió una vigencia económica distinta.
    -- ========================================================

    if p_effective_on =
       v_current_valid_from
    then

        update public.enrollment_financial_plan_assignments
        set
            financial_plan_id =
                p_target_financial_plan_id,

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

        update public.enrollment_financial_plan_assignments
        set
            valid_until =
                p_effective_on - 1,

            updated_at =
                statement_timestamp()

        where id =
              v_current_assignment_id;


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
            p_target_financial_plan_id,
            v_economic_start_on,
            p_effective_on,
            null,
            btrim(p_reason),
            v_actor_id
        )
        returning id
        into v_new_assignment_id;

    end if;


    -- ========================================================
    -- VOID OLD ACTIVE PLAN CHARGES
    -- ========================================================

    update public.charges c
    set
        status = 'VOID',
        updated_at = statement_timestamp()

    from public.financial_plan_periods fpp

    where c.financial_plan_period_id =
          fpp.id

      and c.enrollment_id =
          p_enrollment_id

      and c.financial_concept_id =
          v_tuition_concept_id

      and fpp.financial_plan_id =
          v_current_plan_id

      and c.status = 'ACTIVE';


    get diagnostics
        v_voided_charge_count = row_count;


    -- ========================================================
    -- GENERATE TARGET PLAN CHARGES
    -- ========================================================

    for v_period in

        select
            fpp.id,
            fpp.coverage_year,
            fpp.coverage_month,
            fpp.due_date

        from public.financial_plan_periods fpp

        where fpp.financial_plan_id =
              p_target_financial_plan_id

          and fpp.financial_concept_id =
              v_tuition_concept_id

        order by fpp.sort_order

    loop

        -- Coverage month boundaries.

        v_period_month_start :=
            make_date(
                v_period.coverage_year,
                v_period.coverage_month,
                1
            );


        v_period_month_end :=
            (
                v_period_month_start
                + interval '1 month'
                - interval '1 day'
            )::date;


        -- Periods fully before economic start are ignored.

        if v_period_month_end <
           v_economic_start_on
        then
            continue;
        end if;


        -- If economic start falls inside this month,
        -- the amount may require proportional treatment.
        --
        -- We refuse to invent that amount here.

        if v_economic_start_on >
           v_period_month_start
           and
           v_economic_start_on <=
           v_period_month_end
        then
            raise exception
                'Economic start % falls inside coverage month %-%; proportional/custom charge must be resolved explicitly',
                v_economic_start_on,
                v_period.coverage_year,
                v_period.coverage_month;
        end if;


        -- ----------------------------------------------------
        -- AGREEMENT APPLICABLE TO THIS INSTALLMENT
        -- ----------------------------------------------------

        select
            sfa.id,
            sfa.agreed_amount

        into
            v_agreement_id,
            v_monthly_amount

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

        order by sfa.valid_from desc

        limit 1;


        if v_agreement_id is null then
            raise exception
                'No TUITION financial agreement exists for period %-%',
                v_period.coverage_year,
                v_period.coverage_month;
        end if;


        -- Plan 10:
        --
        -- individual monthly amount * 12 / 10

        v_installment_amount :=
            round(
                (
                    v_monthly_amount
                    * 12
                    / v_target_installments
                )::numeric,
                2
            );


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

            v_installment_amount,
            v_period.due_date,

            'FINANCIAL_PLAN',
            'ACTIVE',

            v_actor_id
        );


        v_created_charge_count :=
            v_created_charge_count + 1;

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

        'FINANCIAL_PLAN_CHANGED',

        'enrollment_financial_plan_assignments',

        v_new_assignment_id,

        jsonb_build_object(
            'financial_plan_id',
                v_current_plan_id,
            'installment_count',
                v_current_installments
        ),

        jsonb_build_object(
            'financial_plan_id',
                p_target_financial_plan_id,
            'installment_count',
                v_target_installments,
            'effective_on',
                p_effective_on,
            'voided_charges',
                v_voided_charge_count,
            'created_charges',
                v_created_charge_count
        ),

        btrim(p_reason),

        v_correlation_id
    );


    return v_new_assignment_id;

end;
$$;


-- ------------------------------------------------------------
-- 3. PRIVILEGIOS RPC INTERNA
-- ------------------------------------------------------------

revoke all
on function
app_private.change_enrollment_financial_plan_internal(
    uuid,
    uuid,
    date,
    text
)
from public, anon;


grant execute
on function
app_private.change_enrollment_financial_plan_internal(
    uuid,
    uuid,
    date,
    text
)
to authenticated;



-- ------------------------------------------------------------
-- 4. RPC PÚBLICA
-- ------------------------------------------------------------

create or replace function
public.change_enrollment_financial_plan(
    p_enrollment_id uuid,
    p_target_financial_plan_id uuid,
    p_effective_on date,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.change_enrollment_financial_plan_internal(
            p_enrollment_id,
            p_target_financial_plan_id,
            p_effective_on,
            p_reason
        );
$$;


revoke all
on function
public.change_enrollment_financial_plan(
    uuid,
    uuid,
    date,
    text
)
from public, anon;


grant execute
on function
public.change_enrollment_financial_plan(
    uuid,
    uuid,
    date,
    text
)
to authenticated;


-- ============================================================
-- FIN M4.1
-- ============================================================