-- Initial activation financial options: tuition discount and explicit fee modes.

create or replace function app_private.create_initial_tuition_agreement_internal(
    p_enrollment_id uuid,
    p_effective_on date,
    p_discount_category_id uuid,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid := auth.uid();
    v_cycle_id uuid; v_education_level_id uuid; v_cycle_start date; v_cycle_end date;
    v_concept_id uuid; v_rate_id uuid; v_base numeric;
    v_type text; v_active boolean; v_category_cycle_id uuid; v_version_id uuid; v_value numeric;
    v_reduction numeric := 0; v_agreed numeric; v_agreement_id uuid;
begin
    if v_actor_id is null then raise exception 'Authentication required'; end if;
    if not app_private.current_user_is_active() then raise exception 'Inactive user'; end if;
    if not app_private.current_user_has_permission('finance.configure', 'ALL') then raise exception 'Insufficient permission to create tuition agreement'; end if;
    if p_enrollment_id is null or p_effective_on is null then raise exception 'enrollment_id and effective_on are required'; end if;
    if p_reason is null or btrim(p_reason) = '' then raise exception 'Reason is required'; end if;

    select e.cycle_id, gl.education_level_id, sc.starts_on, sc.ends_on
    into v_cycle_id, v_education_level_id, v_cycle_start, v_cycle_end
    from public.enrollments e join public.grade_levels gl on gl.id = e.grade_level_id
    join public.school_cycles sc on sc.id = e.cycle_id where e.id = p_enrollment_id for update of e;
    if not found then raise exception 'Enrollment not found'; end if;
    if p_effective_on < v_cycle_start or p_effective_on > v_cycle_end then raise exception 'effective_on must belong to enrollment cycle'; end if;
    if exists (select 1 from public.student_financial_agreements sfa join public.financial_concepts fc on fc.id=sfa.financial_concept_id where sfa.enrollment_id=p_enrollment_id and fc.code='TUITION') then raise exception 'Enrollment already has TUITION agreement history'; end if;

    select id into v_concept_id from public.financial_concepts where code='TUITION' and is_active=true;
    if v_concept_id is null then raise exception 'Active TUITION financial concept not found'; end if;
    select id, amount into v_rate_id, v_base from public.base_rates where cycle_id=v_cycle_id and education_level_id=v_education_level_id and financial_concept_id=v_concept_id and valid_from<=p_effective_on and (valid_until is null or valid_until>=p_effective_on) order by valid_from desc limit 1 for update;
    if v_rate_id is null then raise exception 'No TUITION base rate exists for enrollment level, cycle and effective date'; end if;

    if p_discount_category_id is not null then
      select cycle_id, discount_type, is_active into v_category_cycle_id, v_type, v_active from public.tuition_discount_categories where id=p_discount_category_id for update;
      if not found then raise exception 'Tuition discount category not found'; end if;
      if not v_active then raise exception 'Tuition discount category is inactive'; end if;
      if v_category_cycle_id <> v_cycle_id then raise exception 'Tuition discount category belongs to another cycle'; end if;
      select id, value into v_version_id, v_value from public.tuition_discount_category_versions where category_id=p_discount_category_id and valid_from<=p_effective_on and (valid_until is null or valid_until>=p_effective_on) order by valid_from desc limit 1 for update;
      if v_version_id is null then raise exception 'No category version exists at effective_on'; end if;
      v_reduction := least(v_base, greatest(0, case when v_type='PERCENTAGE' then round((v_base*v_value/100)::numeric,2) when v_type='FIXED_AMOUNT' then v_value else null end));
      if v_reduction is null then raise exception 'Unsupported tuition discount type'; end if;
    end if;
    v_agreed := v_base-v_reduction;
    insert into public.student_financial_agreements(enrollment_id, financial_concept_id, base_rate_id, benefit_id, benefit_type_snapshot, benefit_value_snapshot, base_amount_snapshot, reduction_amount_snapshot, agreed_amount, discount_category_version_id, valid_from, valid_until, reason, authorized_by)
    values(p_enrollment_id,v_concept_id,v_rate_id,null,null,null,v_base,v_reduction,v_agreed,v_version_id,p_effective_on,null,btrim(p_reason),v_actor_id) returning id into v_agreement_id;
    insert into public.audit_log(actor_profile_id,action,entity_name,entity_id,old_values,new_values,reason,correlation_id)
    values(v_actor_id,case when p_discount_category_id is null then 'TUITION_BASE_AGREEMENT_CREATED' else 'TUITION_INITIAL_DISCOUNT_AGREEMENT_CREATED' end,'student_financial_agreements',v_agreement_id,null,jsonb_build_object('enrollment_id',p_enrollment_id,'base_amount_snapshot',v_base,'reduction_amount_snapshot',v_reduction,'agreed_amount',v_agreed,'discount_category_version_id',v_version_id,'valid_from',p_effective_on),btrim(p_reason),gen_random_uuid());
    return v_agreement_id;
end;
$$;

-- New required argument intentionally makes this an unambiguous overload while
-- preserving the historical endpoint for already deployed clients.
create function app_private.create_and_activate_enrollment_internal(
    p_student_id uuid,p_cycle_id uuid,p_grade_level_id uuid,p_classification_id uuid,p_group_id uuid,
    p_activated_on date,p_classes_start_on date,p_economic_start_on date,p_initial_period_amount numeric,p_initial_period_due_date date,
    p_enrollment_fee_mode text,p_enrollment_fee_amount numeric,p_reason text,p_discount_category_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor_id uuid:=auth.uid(); v_enrollment_id uuid; v_level_id uuid; v_fee_concept uuid; v_fee_covered boolean; v_fee_base numeric; v_fee_charge uuid; v_correlation uuid:=gen_random_uuid();
begin
 if v_actor_id is null then raise exception 'Authentication required'; end if;
 if not app_private.current_user_is_active() then raise exception 'Inactive user'; end if;
 if not app_private.current_user_has_permission('students.manage','ALL') then raise exception 'Insufficient permission to create enrollment'; end if;
 if not app_private.current_user_has_permission('finance.configure','ALL') then raise exception 'Insufficient permission to initialize enrollment financials'; end if;
 if p_student_id is null or p_cycle_id is null or p_grade_level_id is null or p_classification_id is null or p_activated_on is null or p_economic_start_on is null then raise exception 'Required activation input is missing'; end if;
 if p_enrollment_fee_mode is not null and p_enrollment_fee_mode not in ('FULL','PROPORTIONAL','NO_FEE') then raise exception 'Invalid enrollment fee mode'; end if;
 if p_enrollment_fee_amount is not null and p_enrollment_fee_amount <= 0 then raise exception 'enrollment_fee_amount must be greater than zero'; end if;
 if p_enrollment_fee_mode='PROPORTIONAL' and p_enrollment_fee_amount is null then raise exception 'enrollment_fee_amount is required in PROPORTIONAL mode'; end if;
 if p_enrollment_fee_mode in ('FULL','NO_FEE') and p_enrollment_fee_amount is not null then raise exception 'enrollment_fee_amount is only allowed in PROPORTIONAL mode'; end if;
 if p_reason is null or btrim(p_reason)='' then raise exception 'Reason is required'; end if;
 select education_level_id into v_level_id from public.grade_levels where id=p_grade_level_id; if v_level_id is null then raise exception 'Grade level not found'; end if;
 if exists(select 1 from public.enrollments where student_id=p_student_id and cycle_id=p_cycle_id) then raise exception 'Student already has an enrollment for this cycle'; end if;
 insert into public.enrollments(student_id,cycle_id,grade_level_id,group_id,classification_id,status,enrolled_on,classes_start_on,created_by) values(p_student_id,p_cycle_id,p_grade_level_id,p_group_id,p_classification_id,'PENDIENTE',p_activated_on,p_classes_start_on,v_actor_id) returning id into v_enrollment_id;
 perform app_private.create_initial_tuition_agreement_internal(v_enrollment_id,p_activated_on,p_discount_category_id,p_reason);
 perform app_private.initialize_enrollment_financials_internal(v_enrollment_id,p_activated_on,p_economic_start_on,p_initial_period_amount,p_initial_period_due_date,p_reason);
 select id into v_fee_concept from public.financial_concepts where code='ENROLLMENT_FEE' and is_active=true; if v_fee_concept is null then raise exception 'Active ENROLLMENT_FEE concept not found'; end if;
 v_fee_covered:=app_private.enrollment_fee_is_covered(p_student_id,p_cycle_id);
 if v_fee_covered then if p_enrollment_fee_mode is not null or p_enrollment_fee_amount is not null then raise exception 'Enrollment fee is already covered for this cycle'; end if;
 elsif p_enrollment_fee_mode is null then raise exception 'Enrollment fee is required; choose FULL, PROPORTIONAL or NO_FEE';
 elsif p_enrollment_fee_mode <> 'NO_FEE' then
   select amount into v_fee_base from public.base_rates where cycle_id=p_cycle_id and education_level_id=v_level_id and financial_concept_id=v_fee_concept and valid_from<=p_activated_on and (valid_until is null or valid_until>=p_activated_on) order by valid_from desc limit 1;
   if v_fee_base is null then raise exception 'No enrollment fee base rate exists for activation date'; end if;
   insert into public.charges(student_id,enrollment_id,cycle_id,financial_concept_id,financial_plan_period_id,financial_agreement_id,coverage_year,coverage_month,original_amount,due_date,origin,status,created_by) values(p_student_id,v_enrollment_id,p_cycle_id,v_fee_concept,null,null,null,null,case when p_enrollment_fee_mode='FULL' then v_fee_base else p_enrollment_fee_amount end,p_activated_on,'ENROLLMENT_ACTIVATION','ACTIVE',v_actor_id) returning id into v_fee_charge;
 end if;
 perform app_private.activate_enrollment_internal(v_enrollment_id,p_activated_on,p_group_id,p_classes_start_on,p_reason);
 insert into public.audit_log(actor_profile_id,action,entity_name,entity_id,old_values,new_values,reason,correlation_id) values(v_actor_id,'ENROLLMENT_INITIAL_ACTIVATION_FINANCIALS','enrollments',v_enrollment_id,null,jsonb_build_object('economic_start_on',p_economic_start_on,'discount_category_id',p_discount_category_id,'enrollment_fee_already_covered',v_fee_covered,'enrollment_fee_mode',case when v_fee_covered then null else p_enrollment_fee_mode end,'enrollment_fee_charge_id',v_fee_charge),btrim(p_reason),v_correlation);
 return v_enrollment_id;
end; $$;

create function public.create_and_activate_enrollment(
    p_student_id uuid,p_cycle_id uuid,p_grade_level_id uuid,p_classification_id uuid,p_group_id uuid,p_activated_on date,p_classes_start_on date,p_economic_start_on date,p_initial_period_amount numeric,p_initial_period_due_date date,p_enrollment_fee_mode text,p_enrollment_fee_amount numeric,p_reason text,p_discount_category_id uuid
) returns uuid language sql security definer set search_path = '' as $$ select app_private.create_and_activate_enrollment_internal(p_student_id,p_cycle_id,p_grade_level_id,p_classification_id,p_group_id,p_activated_on,p_classes_start_on,p_economic_start_on,p_initial_period_amount,p_initial_period_due_date,p_enrollment_fee_mode,p_enrollment_fee_amount,p_reason,p_discount_category_id); $$;
revoke all on function app_private.create_and_activate_enrollment_internal(uuid,uuid,uuid,uuid,uuid,date,date,date,numeric,date,text,numeric,text,uuid) from public, anon, authenticated;
revoke all on function public.create_and_activate_enrollment(uuid,uuid,uuid,uuid,uuid,date,date,date,numeric,date,text,numeric,text,uuid) from public, anon;
grant execute on function public.create_and_activate_enrollment(uuid,uuid,uuid,uuid,uuid,date,date,date,numeric,date,text,numeric,text,uuid) to authenticated;

create or replace function app_private.bulk_create_and_activate_enrollments_internal(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_item jsonb; v_student_id uuid; v_enrollment_id uuid; v_results jsonb:='[]'::jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not app_private.current_user_is_active() or not app_private.current_user_has_permission('students.manage','ALL') or not app_private.current_user_has_permission('finance.configure','ALL') then raise exception 'Insufficient permission to create enrollments'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'items must be a non-empty JSON array'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop begin
   v_student_id:=nullif(v_item->>'student_id','')::uuid;
   v_enrollment_id:=app_private.create_and_activate_enrollment_internal(v_student_id,nullif(v_item->>'cycle_id','')::uuid,nullif(v_item->>'grade_level_id','')::uuid,nullif(v_item->>'classification_id','')::uuid,nullif(v_item->>'group_id','')::uuid,nullif(v_item->>'activated_on','')::date,nullif(v_item->>'classes_start_on','')::date,nullif(v_item->>'economic_start_on','')::date,nullif(v_item->>'initial_period_amount','')::numeric,nullif(v_item->>'initial_period_due_date','')::date,nullif(v_item->>'enrollment_fee_mode',''),nullif(v_item->>'enrollment_fee_amount','')::numeric,coalesce(nullif(v_item->>'reason',''),'Activación masiva de continuidad'),nullif(v_item->>'discount_category_id','')::uuid);
   v_results:=v_results||jsonb_build_array(jsonb_build_object('student_id',v_student_id,'success',true,'enrollment_id',v_enrollment_id,'error',null));
 exception when others then v_results:=v_results||jsonb_build_array(jsonb_build_object('student_id',v_student_id,'success',false,'enrollment_id',null,'error',sqlerrm)); end; end loop;
 return v_results;
end; $$;

create function app_private.resolve_preregistration_to_enrollment_internal(
 p_preregistration_id uuid,p_classification_id uuid,p_group_id uuid,p_activated_on date,p_classes_start_on date,p_economic_start_on date,p_initial_period_amount numeric,p_initial_period_due_date date,p_enrollment_fee_mode text,p_enrollment_fee_amount numeric,p_reason text,p_discount_category_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_pr public.preregistrations%rowtype; v_enrollment_id uuid; v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception 'Authentication required'; end if;
 if not app_private.current_user_is_active() or not app_private.current_user_has_permission('students.manage','ALL') or not app_private.current_user_has_permission('finance.configure','ALL') then raise exception 'Insufficient permission to resolve preregistration'; end if;
 if p_preregistration_id is null or p_classification_id is null or p_activated_on is null or p_economic_start_on is null or p_reason is null or btrim(p_reason)='' then raise exception 'Required preregistration activation input is missing'; end if;
 select * into v_pr from public.preregistrations where id=p_preregistration_id for update; if not found then raise exception 'Preregistration not found'; end if;
 if v_pr.status not in ('PENDING','CONFIRMED') then raise exception 'Preregistration cannot be enrolled from its current status'; end if;
 if v_pr.student_id is null or v_pr.target_cycle_id is null or v_pr.target_grade_level_id is null then raise exception 'Preregistration is incomplete'; end if;
 v_enrollment_id:=app_private.create_and_activate_enrollment_internal(v_pr.student_id,v_pr.target_cycle_id,v_pr.target_grade_level_id,p_classification_id,p_group_id,p_activated_on,p_classes_start_on,p_economic_start_on,p_initial_period_amount,p_initial_period_due_date,p_enrollment_fee_mode,p_enrollment_fee_amount,p_reason,p_discount_category_id);
 update public.preregistrations set status='RESOLVED',resolved_at=statement_timestamp(),resolution='ENROLLED' where id=v_pr.id;
 return v_enrollment_id;
end; $$;
create function public.resolve_preregistration_to_enrollment(
 p_preregistration_id uuid,p_classification_id uuid,p_group_id uuid,p_activated_on date,p_classes_start_on date,p_economic_start_on date,p_initial_period_amount numeric,p_initial_period_due_date date,p_enrollment_fee_mode text,p_enrollment_fee_amount numeric,p_reason text,p_discount_category_id uuid
) returns uuid language sql security definer set search_path='' as $$ select app_private.resolve_preregistration_to_enrollment_internal(p_preregistration_id,p_classification_id,p_group_id,p_activated_on,p_classes_start_on,p_economic_start_on,p_initial_period_amount,p_initial_period_due_date,p_enrollment_fee_mode,p_enrollment_fee_amount,p_reason,p_discount_category_id); $$;
revoke all on function app_private.resolve_preregistration_to_enrollment_internal(uuid,uuid,uuid,date,date,date,numeric,date,text,numeric,text,uuid) from public, anon, authenticated;
revoke all on function public.resolve_preregistration_to_enrollment(uuid,uuid,uuid,date,date,date,numeric,date,text,numeric,text,uuid) from public, anon;
grant execute on function public.resolve_preregistration_to_enrollment(uuid,uuid,uuid,date,date,date,numeric,date,text,numeric,text,uuid) to authenticated;

-- PostgREST cannot safely dispatch overloaded public RPCs. All application
-- callers use the expanded signatures above; retire the old public endpoints.
drop function if exists public.create_and_activate_enrollment(uuid,uuid,uuid,uuid,uuid,date,date,date,numeric,date,text,numeric,text);
drop function if exists public.resolve_preregistration_to_enrollment(uuid,uuid,uuid,date,date,date,numeric,date,text,numeric,text);

create or replace function app_private.create_new_student_enrollment_internal(
 p_student_full_name text,p_student_sex text,p_student_birth_date date,p_contacts jsonb,p_cycle_id uuid,p_grade_level_id uuid,p_classification_id uuid,p_group_id uuid,p_activated_on date,p_classes_start_on date,p_economic_start_on date,p_initial_period_amount numeric default null,p_initial_period_due_date date default null,p_enrollment_fee_mode text default null,p_enrollment_fee_amount numeric default null,p_discount_category_id uuid default null,p_reason text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_student_id uuid; v_guardian_id uuid; v_contact jsonb; v_priority smallint:=1; v_enrollment_id uuid; v_name text;
begin
 if v_actor is null then raise exception 'Authentication required'; end if;
 if not app_private.current_user_is_active() or not app_private.current_user_has_permission('students.manage','ALL') or not app_private.current_user_has_permission('finance.configure','ALL') then raise exception 'Insufficient permission to create student enrollment'; end if;
 v_name:=nullif(btrim(p_student_full_name),''); if v_name is null then raise exception 'Student full name is required'; end if;
 if p_student_sex not in ('H','M') then raise exception 'Invalid student sex'; end if;
 if p_contacts is null or jsonb_typeof(p_contacts)<>'array' or jsonb_array_length(p_contacts) not between 1 and 2 then raise exception 'One or two contacts are required'; end if;
 insert into public.students(full_name,sex,birth_date) values(v_name,p_student_sex,p_student_birth_date) returning id into v_student_id;
 for v_contact in select value from jsonb_array_elements(p_contacts) loop
   if nullif(btrim(v_contact->>'full_name'),'') is null or nullif(btrim(v_contact->>'phone'),'') is null or nullif(btrim(v_contact->>'relationship'),'') is null then raise exception 'Contact full name, phone and relationship are required'; end if;
   insert into public.guardians(full_name,phone,email) values(btrim(v_contact->>'full_name'),btrim(v_contact->>'phone'),nullif(btrim(v_contact->>'email'),'')) returning id into v_guardian_id;
   insert into public.student_guardians(student_id,guardian_id,relationship,priority,via_whatsapp,via_email,is_active,started_at) values(v_student_id,v_guardian_id,btrim(v_contact->>'relationship'),v_priority,true,nullif(btrim(v_contact->>'email'),'') is not null,true,p_activated_on); v_priority:=v_priority+1;
 end loop;
 v_enrollment_id:=app_private.create_and_activate_enrollment_internal(v_student_id,p_cycle_id,p_grade_level_id,p_classification_id,p_group_id,p_activated_on,p_classes_start_on,p_economic_start_on,p_initial_period_amount,p_initial_period_due_date,p_enrollment_fee_mode,p_enrollment_fee_amount,p_reason,p_discount_category_id);
 return jsonb_build_object('student_id',v_student_id,'enrollment_id',v_enrollment_id,'discount_category_id',p_discount_category_id);
end; $$;
