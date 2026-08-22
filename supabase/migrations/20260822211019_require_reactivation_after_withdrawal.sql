create or replace function app_private.reactivate_enrollment_financial_internal(
    p_enrollment_id uuid,
    p_reactivated_on date,
    p_group_id uuid,
    p_economic_start_on date,
    p_initial_tuition_amount numeric,
    p_initial_tuition_due_date date,
    p_enrollment_fee_mode text,
    p_enrollment_fee_amount numeric,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_actor_id uuid;

    v_student_id uuid;
    v_cycle_id uuid;
    v_grade_level_id uuid;
    v_education_level_id uuid;

    v_cycle_start date;
    v_cycle_end date;
    v_old_status text;
    v_old_group_id uuid;
    v_old_closed_on date;

    v_tuition_concept_id uuid;
    v_enrollment_fee_concept_id uuid;

    v_plan_id uuid;
    v_plan_count integer;

    v_assignment_id uuid;

    v_agreement_id uuid;
    v_agreed_amount numeric;

    v_period record;
    v_month_start date;
    v_month_end date;
    v_charge_amount numeric;
    v_charge_due_date date;

    v_existing_charge_id uuid;
    v_existing_effective numeric;
    v_delta numeric;

    v_partial_found boolean := false;

    v_fee_covered boolean;
    v_fee_base_rate_id uuid;
    v_fee_base_amount numeric;
    v_fee_amount numeric;
    v_fee_charge_id uuid;

    v_event_id uuid;
    v_correlation_id uuid := gen_random_uuid();
begin

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
        raise exception 'Insufficient permission to reactivate enrollment';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    ) then
        raise exception 'Insufficient permission to reactivate financials';
    end if;

    if p_enrollment_id is null then
        raise exception 'enrollment_id is required';
    end if;

    if p_reactivated_on is null then
        raise exception 'reactivated_on is required';
    end if;

    if p_economic_start_on is null then
        raise exception 'economic_start_on is required';
    end if;

    if p_initial_tuition_amount is not null
       and p_initial_tuition_amount < 0
    then
        raise exception 'initial_tuition_amount cannot be negative';
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
        raise exception 'enrollment_fee_amount cannot be negative';
    end if;

    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception 'Reason is required';
    end if;

    select
        e.student_id,
        e.cycle_id,
        e.grade_level_id,
        gl.education_level_id,
        e.status,
        e.group_id,
        e.closed_on,
        sc.starts_on,
        sc.ends_on
    into
        v_student_id,
        v_cycle_id,
        v_grade_level_id,
        v_education_level_id,
        v_old_status,
        v_old_group_id,
        v_old_closed_on,
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

    if v_old_status <> 'BAJA' then
        raise exception 'Only BAJA enrollment can be reactivated';
    end if;

    if p_reactivated_on < v_cycle_start
       or p_reactivated_on > v_cycle_end
    then
        raise exception 'reactivated_on must belong to enrollment cycle';
    end if;

    -- CAMBIO:
    -- debe ser estrictamente posterior a la baja.
    if v_old_closed_on is not null
       and p_reactivated_on <= v_old_closed_on
    then
        raise exception
            'Reactivation date must be after withdrawal date';
    end if;

    if p_economic_start_on < p_reactivated_on
       or p_economic_start_on > v_cycle_end
    then
        raise exception
            'economic_start_on must be on or after reactivation and inside cycle';
    end if;

    if p_group_id is not null
       and not exists (
           select 1
           from public.groups g
           where g.id = p_group_id
             and g.cycle_id = v_cycle_id
             and g.grade_level_id = v_grade_level_id
             and g.is_active = true
       )
    then
        raise exception
            'Group does not belong to enrollment cycle and grade';
    end if;

    select id
    into v_tuition_concept_id
    from public.financial_concepts
    where code = 'TUITION'
      and is_active = true;

    select id
    into v_enrollment_fee_concept_id
    from public.financial_concepts
    where code = 'ENROLLMENT_FEE'
      and is_active = true;

    if v_tuition_concept_id is null then
        raise exception 'Active TUITION concept not found';
    end if;

    if v_enrollment_fee_concept_id is null then
        raise exception 'Active ENROLLMENT_FEE concept not found';
    end if;

    select
        count(*),
        min(fp.id::text)::uuid
    into
        v_plan_count,
        v_plan_id
    from public.financial_plans fp
    where fp.cycle_id = v_cycle_id
      and fp.education_level_id = v_education_level_id
      and fp.is_default = true
      and fp.installment_count = 12
      and fp.status <> 'INACTIVE';

    if v_plan_count = 0 then
        raise exception
            'No default 12-payment plan exists for enrollment level and cycle';
    end if;

    if v_plan_count > 1 then
        raise exception
            'More than one default 12-payment plan exists';
    end if;

    select
        sfa.id,
        sfa.agreed_amount
    into
        v_agreement_id,
        v_agreed_amount
    from public.student_financial_agreements sfa
    where sfa.enrollment_id = p_enrollment_id
      and sfa.financial_concept_id = v_tuition_concept_id
      and sfa.valid_from <= p_reactivated_on
      and (
          sfa.valid_until is null
          or sfa.valid_until >= p_reactivated_on
      )
    order by sfa.valid_from desc
    limit 1;

    if v_agreement_id is null then
        raise exception
            'No active TUITION agreement exists for reactivation date';
    end if;

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
        p_reactivated_on,
        null,
        btrim(p_reason),
        v_actor_id
    )
    returning id
    into v_assignment_id;

    for v_period in
        select
            fpp.id,
            fpp.coverage_year,
            fpp.coverage_month,
            fpp.due_date,
            fpp.sort_order
        from public.financial_plan_periods fpp
        where fpp.financial_plan_id = v_plan_id
          and fpp.financial_concept_id = v_tuition_concept_id
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

        if v_month_end < p_economic_start_on then
            continue;
        end if;

        v_charge_amount := v_agreed_amount;
        v_charge_due_date := v_period.due_date;

        if p_economic_start_on > v_month_start
           and p_economic_start_on <= v_month_end
        then

            if p_initial_tuition_amount is null then
                raise exception
                    'Initial tuition amount is required for partial reactivation month';
            end if;

            v_partial_found := true;
            v_charge_amount := p_initial_tuition_amount;

            if p_initial_tuition_due_date is not null then
                v_charge_due_date :=
                    p_initial_tuition_due_date;
            end if;
        end if;

        v_existing_charge_id := null;

        select c.id
        into v_existing_charge_id
        from public.charges c
        where c.enrollment_id = p_enrollment_id
          and c.financial_concept_id = v_tuition_concept_id
          and c.status = 'ACTIVE'
          and c.coverage_year = v_period.coverage_year
          and c.coverage_month = v_period.coverage_month
        order by c.created_at desc
        limit 1
        for update;

        if v_existing_charge_id is not null then

            if v_month_start <= p_economic_start_on
               and p_economic_start_on <= v_month_end
               and v_partial_found
            then
                select
                    c.original_amount
                    + coalesce((
                        select sum(ca.amount)
                        from public.charge_adjustments ca
                        where ca.charge_id = c.id
                    ), 0)
                into v_existing_effective
                from public.charges c
                where c.id = v_existing_charge_id;

                v_delta :=
                    v_charge_amount
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
                        'AGREEMENT',
                        btrim(p_reason),
                        v_actor_id
                    );
                end if;
            end if;

            continue;
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
            v_period.id,
            v_agreement_id,
            v_period.coverage_year,
            v_period.coverage_month,
            v_charge_amount,
            v_charge_due_date,
            'REACTIVATION',
            'ACTIVE',
            v_actor_id
        );

    end loop;

    if p_initial_tuition_amount is not null
       and not v_partial_found
    then
        raise exception
            'Initial tuition amount supplied but reactivation month is not partial';
    end if;

    v_fee_covered :=
        app_private.enrollment_fee_is_covered(
            v_student_id,
            v_cycle_id
        );

    if not v_fee_covered then

        select
            br.id,
            br.amount
        into
            v_fee_base_rate_id,
            v_fee_base_amount
        from public.base_rates br
        where br.cycle_id = v_cycle_id
          and br.education_level_id =
              v_education_level_id
          and br.financial_concept_id =
              v_enrollment_fee_concept_id
          and br.valid_from <= p_reactivated_on
          and (
              br.valid_until is null
              or br.valid_until >= p_reactivated_on
          )
        order by br.valid_from desc
        limit 1;

        if v_fee_base_rate_id is null then
            raise exception
                'No enrollment fee base rate exists for reactivation date';
        end if;

        if p_enrollment_fee_mode is null then
            raise exception
                'Enrollment fee is required; choose FULL or PROPORTIONAL';
        end if;

        if p_enrollment_fee_mode = 'FULL' then
            v_fee_amount := v_fee_base_amount;

            if p_enrollment_fee_amount is not null then
                raise exception
                    'enrollment_fee_amount must be null in FULL mode';
            end if;

        else
            if p_enrollment_fee_amount is null then
                raise exception
                    'enrollment_fee_amount is required in PROPORTIONAL mode';
            end if;

            v_fee_amount := p_enrollment_fee_amount;
        end if;

        insert into public.charges (
            student_id,
            enrollment_id,
            cycle_id,
            financial_concept_id,
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
            v_enrollment_fee_concept_id,
            v_fee_amount,
            p_reactivated_on,
            'REACTIVATION',
            'ACTIVE',
            v_actor_id
        )
        returning id
        into v_fee_charge_id;

    end if;

    update public.enrollments
    set
        status = 'ACTIVA',
        group_id = coalesce(
            p_group_id,
            group_id
        ),
        closed_on = null,
        updated_at = statement_timestamp()
    where id = p_enrollment_id;

    v_event_id :=
        app_private.record_enrollment_event_internal(
            p_enrollment_id,
            'REACTIVATED',
            p_reactivated_on,
            p_reason,
            jsonb_build_object(
                'status', v_old_status,
                'group_id', v_old_group_id,
                'closed_on', v_old_closed_on
            ),
            jsonb_build_object(
                'status', 'ACTIVA',
                'group_id',
                    coalesce(
                        p_group_id,
                        v_old_group_id
                    ),
                'closed_on', null,
                'financial_plan_id', v_plan_id,
                'economic_start_on',
                    p_economic_start_on,
                'enrollment_fee_already_covered',
                    v_fee_covered,
                'enrollment_fee_charge_id',
                    v_fee_charge_id
            ),
            v_actor_id
        );

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
        'ENROLLMENT_REACTIVATED_FINANCIALLY',
        'enrollments',
        p_enrollment_id,
        jsonb_build_object(
            'status', v_old_status,
            'closed_on', v_old_closed_on
        ),
        jsonb_build_object(
            'status', 'ACTIVA',
            'event_id', v_event_id,
            'financial_plan_assignment_id',
                v_assignment_id,
            'economic_start_on',
                p_economic_start_on,
            'enrollment_fee_already_covered',
                v_fee_covered,
            'enrollment_fee_charge_id',
                v_fee_charge_id
        ),
        btrim(p_reason),
        v_correlation_id
    );

    return v_event_id;
end;
$function$;