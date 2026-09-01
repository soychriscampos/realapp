-- Canonical activation reconciliation.
-- This migration is intentionally data-preserving: it only makes future
-- activations consistent and adds a guard against a duplicate fee charge.

create or replace function app_private.create_initial_tuition_agreement_internal(
    p_enrollment_id uuid,
    p_effective_on date,
    p_discount_category_id uuid,
    p_reason text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
    v_actor_id uuid := auth.uid();
    v_cycle_id uuid; v_education_level_id uuid; v_cycle_start date; v_cycle_end date;
    v_concept_id uuid; v_rate_id uuid; v_base numeric;
    v_type text; v_active boolean; v_category_cycle_id uuid; v_category_id uuid; v_version_id uuid; v_value numeric;
    v_reduction numeric := 0; v_agreed numeric; v_agreement_id uuid;
    v_existing_assignment_category uuid; v_existing_assignment_from date;
begin
    if v_actor_id is null then raise exception 'Authentication required'; end if;
    if not app_private.current_user_is_active() then raise exception 'Inactive user'; end if;
    if not app_private.current_user_has_permission('finance.configure', 'ALL') then raise exception 'Insufficient permission to create tuition agreement'; end if;
    if p_enrollment_id is null or p_effective_on is null then raise exception 'enrollment_id and effective_on are required'; end if;
    if p_reason is null or btrim(p_reason) = '' then raise exception 'Reason is required'; end if;

    select e.cycle_id, gl.education_level_id, sc.starts_on, sc.ends_on
      into v_cycle_id, v_education_level_id, v_cycle_start, v_cycle_end
      from public.enrollments e
      join public.grade_levels gl on gl.id = e.grade_level_id
      join public.school_cycles sc on sc.id = e.cycle_id
     where e.id = p_enrollment_id
     for update of e;
    if not found then raise exception 'Enrollment not found'; end if;
    if p_effective_on < v_cycle_start or p_effective_on > v_cycle_end then raise exception 'effective_on must belong to enrollment cycle'; end if;
    if exists (select 1 from public.student_financial_agreements sfa join public.financial_concepts fc on fc.id = sfa.financial_concept_id where sfa.enrollment_id = p_enrollment_id and fc.code = 'TUITION') then raise exception 'Enrollment already has TUITION agreement history'; end if;

    select id into v_concept_id from public.financial_concepts where code = 'TUITION' and is_active = true;
    if v_concept_id is null then raise exception 'Active TUITION financial concept not found'; end if;
    select id, amount into v_rate_id, v_base from public.base_rates where cycle_id = v_cycle_id and education_level_id = v_education_level_id and financial_concept_id = v_concept_id and valid_from <= p_effective_on and (valid_until is null or valid_until >= p_effective_on) order by valid_from desc limit 1 for update;
    if v_rate_id is null then raise exception 'No TUITION base rate exists for enrollment level, cycle and effective date'; end if;

    if p_discount_category_id is not null then
        select cycle_id, discount_type, is_active into v_category_cycle_id, v_type, v_active from public.tuition_discount_categories where id = p_discount_category_id for update;
        if not found then raise exception 'Tuition discount category not found'; end if;
        if not v_active then raise exception 'Tuition discount category is inactive'; end if;
        if v_category_cycle_id <> v_cycle_id then raise exception 'Tuition discount category belongs to another cycle'; end if;
        select category_id, id, value into v_category_id, v_version_id, v_value from public.tuition_discount_category_versions where category_id = p_discount_category_id and valid_from <= p_effective_on and (valid_until is null or valid_until >= p_effective_on) order by valid_from desc limit 1 for update;
        if v_version_id is null then raise exception 'No category version exists at effective_on'; end if;
        v_reduction := least(v_base, greatest(0, case when v_type = 'PERCENTAGE' then round((v_base * v_value / 100)::numeric, 2) when v_type = 'FIXED_AMOUNT' then v_value else null end));
        if v_reduction is null then raise exception 'Unsupported tuition discount type'; end if;
    end if;
    v_agreed := v_base - v_reduction;
    insert into public.student_financial_agreements(enrollment_id, financial_concept_id, base_rate_id, benefit_id, benefit_type_snapshot, benefit_value_snapshot, base_amount_snapshot, reduction_amount_snapshot, agreed_amount, discount_category_version_id, valid_from, valid_until, reason, authorized_by)
    values(p_enrollment_id, v_concept_id, v_rate_id, null, null, null, v_base, v_reduction, v_agreed, v_version_id, p_effective_on, null, btrim(p_reason), v_actor_id)
    returning id into v_agreement_id;

    -- The agreement stores the immutable version; the assignment stores the
    -- operational category used by the financial UI and later plan changes.
    if v_category_id is not null then
        select category_id, valid_from into v_existing_assignment_category, v_existing_assignment_from
          from public.enrollment_tuition_discount_assignments
         where enrollment_id = p_enrollment_id and valid_until is null;
        if found then
            if v_existing_assignment_category <> v_category_id then
                raise exception 'Enrollment has a conflicting current tuition discount assignment';
            end if;
            if v_existing_assignment_from <> p_effective_on then
                raise exception 'Enrollment tuition discount assignment dates are inconsistent';
            end if;
        else
            insert into public.enrollment_tuition_discount_assignments(enrollment_id, category_id, valid_from, valid_until, reason, authorized_by)
            values(p_enrollment_id, v_category_id, p_effective_on, null, btrim(p_reason), v_actor_id);
        end if;
    end if;

    insert into public.audit_log(actor_profile_id, action, entity_name, entity_id, old_values, new_values, reason, correlation_id)
    values(v_actor_id, case when p_discount_category_id is null then 'TUITION_BASE_AGREEMENT_CREATED' else 'TUITION_INITIAL_DISCOUNT_AGREEMENT_CREATED' end, 'student_financial_agreements', v_agreement_id, null, jsonb_build_object('enrollment_id', p_enrollment_id, 'base_amount_snapshot', v_base, 'reduction_amount_snapshot', v_reduction, 'agreed_amount', v_agreed, 'discount_category_version_id', v_version_id, 'discount_category_id', p_discount_category_id, 'valid_from', p_effective_on), btrim(p_reason), gen_random_uuid());
    return v_agreement_id;
end;
$$;

create or replace function app_private.create_and_activate_enrollment_internal(
    p_student_id uuid, p_cycle_id uuid, p_grade_level_id uuid, p_classification_id uuid, p_group_id uuid,
    p_activated_on date, p_classes_start_on date, p_economic_start_on date, p_initial_period_amount numeric,
    p_initial_period_due_date date, p_enrollment_fee_mode text, p_enrollment_fee_amount numeric,
    p_reason text, p_discount_category_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
    v_actor_id uuid := auth.uid(); v_enrollment_id uuid; v_level_id uuid;
    v_fee_concept uuid; v_fee_covered boolean; v_fee_base numeric; v_fee_charge uuid;
    v_preregistration_id uuid; v_preregistration_charge_id uuid; v_preregistration_count integer;
    v_preregistration_academic_match boolean := false; v_prereg_charge_valid boolean := false; v_correlation uuid := gen_random_uuid();
begin
    if v_actor_id is null then raise exception 'Authentication required'; end if;
    if not app_private.current_user_is_active() then raise exception 'Inactive user'; end if;
    if not app_private.current_user_has_permission('students.manage', 'ALL') then raise exception 'Insufficient permission to create enrollment'; end if;
    if not app_private.current_user_has_permission('finance.configure', 'ALL') then raise exception 'Insufficient permission to initialize enrollment financials'; end if;
    if p_student_id is null or p_cycle_id is null or p_grade_level_id is null or p_classification_id is null or p_activated_on is null or p_economic_start_on is null then raise exception 'Required activation input is missing'; end if;
    if p_enrollment_fee_mode is not null and p_enrollment_fee_mode not in ('FULL', 'PROPORTIONAL', 'NO_FEE') then raise exception 'Invalid enrollment fee mode'; end if;
    if p_enrollment_fee_amount is not null and p_enrollment_fee_amount <= 0 then raise exception 'enrollment_fee_amount must be greater than zero'; end if;
    if p_enrollment_fee_mode = 'PROPORTIONAL' and p_enrollment_fee_amount is null then raise exception 'enrollment_fee_amount is required in PROPORTIONAL mode'; end if;
    if p_enrollment_fee_mode in ('FULL', 'NO_FEE') and p_enrollment_fee_amount is not null then raise exception 'enrollment_fee_amount is only allowed in PROPORTIONAL mode'; end if;
    if p_reason is null or btrim(p_reason) = '' then raise exception 'Reason is required'; end if;

    select education_level_id into v_level_id from public.grade_levels where id = p_grade_level_id;
    if v_level_id is null then raise exception 'Grade level not found'; end if;

    -- Resolve exactly one current preregistration for this student/cycle.
    select count(*) into v_preregistration_count
      from public.preregistrations pr
     where pr.student_id = p_student_id and pr.target_cycle_id = p_cycle_id and pr.status in ('PENDING', 'CONFIRMED');
    if v_preregistration_count > 1 then raise exception 'Multiple applicable preregistrations require manual review'; end if;
    if v_preregistration_count = 1 then
        select pr.id, pr.charge_id,
               pr.target_grade_level_id = p_grade_level_id
               and pr.target_education_level_id = v_level_id
               and (pr.target_group_id is null or pr.target_group_id = p_group_id)
          into v_preregistration_id, v_preregistration_charge_id, v_preregistration_academic_match
          from public.preregistrations pr
         where pr.student_id = p_student_id and pr.target_cycle_id = p_cycle_id and pr.status in ('PENDING', 'CONFIRMED')
         for update;
    end if;

    if exists(select 1 from public.enrollments where student_id = p_student_id and cycle_id = p_cycle_id) then raise exception 'Student already has an enrollment for this cycle'; end if;

    insert into public.enrollments(student_id, cycle_id, grade_level_id, group_id, classification_id, status, enrolled_on, classes_start_on, created_by)
    values(p_student_id, p_cycle_id, p_grade_level_id, p_group_id, p_classification_id, 'PENDIENTE', p_activated_on, p_classes_start_on, v_actor_id)
    returning id into v_enrollment_id;

    perform app_private.create_initial_tuition_agreement_internal(v_enrollment_id, p_activated_on, p_discount_category_id, p_reason);
    perform app_private.initialize_enrollment_financials_internal(v_enrollment_id, p_activated_on, p_economic_start_on, p_initial_period_amount, p_initial_period_due_date, p_reason);

    select id into v_fee_concept from public.financial_concepts where code = 'ENROLLMENT_FEE' and is_active = true;
    if v_fee_concept is null then raise exception 'Active ENROLLMENT_FEE concept not found'; end if;
    v_fee_covered := app_private.enrollment_fee_is_covered(p_student_id, p_cycle_id);

    if v_fee_covered then
        if p_enrollment_fee_mode is not null or p_enrollment_fee_amount is not null then raise exception 'Enrollment fee is already covered for this cycle'; end if;
        -- The preregistration charge_id is the canonical candidate. Do not
        -- choose among unrelated paid charges for the same student/cycle.
        if v_preregistration_id is not null and v_preregistration_charge_id is not null then
            select exists (select 1 from public.charges c
                            join public.preregistrations pr on pr.id = v_preregistration_id
                            join public.preregistration_campaigns pc on pc.id = pr.campaign_id
                           where c.id = v_preregistration_charge_id
                             and c.student_id = p_student_id
                             and c.cycle_id = p_cycle_id
                             and c.financial_concept_id = v_fee_concept
                             and c.origin = 'PREREGISTRATION_CAMPAIGN'
                             and pc.target_cycle_id = p_cycle_id
                             and pc.covered_concept_id = v_fee_concept
                             and c.status = 'ACTIVE'
                             and c.enrollment_id is null
                             and app_private.charge_is_paid_without_refund(c.id))
              into v_prereg_charge_valid;
            if not v_preregistration_academic_match then
                if v_prereg_charge_valid then
                    raise exception 'Applicable preregistration is academically incompatible with this activation; manual review required';
                end if;
            elsif v_prereg_charge_valid then
                update public.charges set enrollment_id = v_enrollment_id where id = v_preregistration_charge_id;
            else
                raise exception 'Covered preregistration charge is invalid or ambiguous; manual review required';
            end if;
        end if;
    elsif p_enrollment_fee_mode is null then
        raise exception 'Enrollment fee is required; choose FULL, PROPORTIONAL or NO_FEE';
    elsif p_enrollment_fee_mode <> 'NO_FEE' then
        select amount into v_fee_base from public.base_rates where cycle_id = p_cycle_id and education_level_id = v_level_id and financial_concept_id = v_fee_concept and valid_from <= p_activated_on and (valid_until is null or valid_until >= p_activated_on) order by valid_from desc limit 1;
        if v_fee_base is null then raise exception 'No enrollment fee base rate exists for activation date'; end if;
        insert into public.charges(student_id, enrollment_id, cycle_id, financial_concept_id, original_amount, due_date, origin, status, created_by)
        values(p_student_id, v_enrollment_id, p_cycle_id, v_fee_concept, case when p_enrollment_fee_mode = 'FULL' then v_fee_base else p_enrollment_fee_amount end, p_activated_on, 'ENROLLMENT_ACTIVATION', 'ACTIVE', v_actor_id)
        returning id into v_fee_charge;
    end if;

    perform app_private.activate_enrollment_internal(v_enrollment_id, p_activated_on, p_group_id, p_classes_start_on, p_reason);
    if v_preregistration_id is not null and v_preregistration_academic_match then
        update public.preregistrations set status = 'RESOLVED', resolved_at = statement_timestamp(), resolution = 'ENROLLED' where id = v_preregistration_id;
    end if;
    insert into public.audit_log(actor_profile_id, action, entity_name, entity_id, old_values, new_values, reason, correlation_id)
    values(v_actor_id, 'ENROLLMENT_INITIAL_ACTIVATION_FINANCIALS', 'enrollments', v_enrollment_id, null, jsonb_build_object('economic_start_on', p_economic_start_on, 'discount_category_id', p_discount_category_id, 'enrollment_fee_already_covered', v_fee_covered, 'enrollment_fee_charge_id', v_fee_charge, 'preregistration_id', v_preregistration_id), btrim(p_reason), v_correlation);
    return v_enrollment_id;
end;
$$;

create or replace function public.create_enrollment_fee_charge(
    p_enrollment_id uuid, p_amount numeric, p_due_date date, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_student_id uuid; v_cycle_id uuid; v_concept_id uuid; v_charge_id uuid;
begin
    if v_actor is null or not app_private.current_user_is_active() or not app_private.current_user_has_permission('finance.configure', 'ALL') then raise exception 'Insufficient permission to create enrollment fee charge'; end if;
    if p_enrollment_id is null or p_amount is null or p_amount <= 0 or p_due_date is null or p_reason is null or btrim(p_reason) = '' then raise exception 'Invalid enrollment fee charge input'; end if;
    select e.student_id, e.cycle_id into v_student_id, v_cycle_id from public.enrollments e where e.id = p_enrollment_id and e.status = 'ACTIVA';
    if not found then raise exception 'Active enrollment not found'; end if;
    if exists (select 1 from public.charges c join public.financial_concepts fc on fc.id = c.financial_concept_id where c.enrollment_id = p_enrollment_id and c.status = 'ACTIVE' and fc.code = 'ENROLLMENT_FEE') then raise exception 'Enrollment fee charge already exists'; end if;
    if app_private.enrollment_fee_is_covered(v_student_id, v_cycle_id) then raise exception 'Enrollment fee is already covered for this student and cycle'; end if;
    select id into v_concept_id from public.financial_concepts where code = 'ENROLLMENT_FEE' and is_active = true;
    if v_concept_id is null then raise exception 'Active ENROLLMENT_FEE concept not found'; end if;
    insert into public.charges(student_id, enrollment_id, cycle_id, financial_concept_id, original_amount, due_date, origin, status, created_by)
    values(v_student_id, p_enrollment_id, v_cycle_id, v_concept_id, p_amount, p_due_date, 'ADMIN_CORRECTION', 'ACTIVE', v_actor) returning id into v_charge_id;
    insert into public.audit_log(actor_profile_id, action, entity_name, entity_id, old_values, new_values, reason, correlation_id)
    values(v_actor, 'ENROLLMENT_FEE_CHARGE_CREATED', 'charges', v_charge_id, null, jsonb_build_object('enrollment_id', p_enrollment_id, 'amount', p_amount), btrim(p_reason), gen_random_uuid());
    return v_charge_id;
end;
$$;
