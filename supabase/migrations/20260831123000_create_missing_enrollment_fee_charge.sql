create or replace function public.create_enrollment_fee_charge(
  p_enrollment_id uuid,
  p_amount numeric,
  p_due_date date,
  p_reason text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_student_id uuid;
  v_cycle_id uuid;
  v_concept_id uuid;
  v_charge_id uuid;
begin
  if v_actor is null or not app_private.current_user_is_active() or not app_private.current_user_has_permission('finance.configure','ALL') then raise exception 'Insufficient permission to create enrollment fee charge'; end if;
  if p_enrollment_id is null or p_amount is null or p_amount < 0 or p_due_date is null or p_reason is null or btrim(p_reason) = '' then raise exception 'Invalid enrollment fee charge input'; end if;
  select e.student_id, e.cycle_id into v_student_id, v_cycle_id from public.enrollments e where e.id = p_enrollment_id and e.status = 'ACTIVA';
  if not found then raise exception 'Active enrollment not found'; end if;
  if exists (select 1 from public.charges c join public.financial_concepts fc on fc.id = c.financial_concept_id where c.enrollment_id = p_enrollment_id and c.status = 'ACTIVE' and fc.code = 'ENROLLMENT_FEE') then raise exception 'Enrollment fee charge already exists'; end if;
  select id into v_concept_id from public.financial_concepts where code = 'ENROLLMENT_FEE' and is_active = true;
  if v_concept_id is null then raise exception 'Active ENROLLMENT_FEE concept not found'; end if;
  insert into public.charges(student_id, enrollment_id, cycle_id, financial_concept_id, original_amount, due_date, origin, status, created_by)
  values(v_student_id, p_enrollment_id, v_cycle_id, v_concept_id, p_amount, p_due_date, 'ADMIN_CORRECTION', 'ACTIVE', v_actor)
  returning id into v_charge_id;
  insert into public.audit_log(actor_profile_id, action, entity_name, entity_id, old_values, new_values, reason, correlation_id)
  values(v_actor, 'ENROLLMENT_FEE_CHARGE_CREATED', 'charges', v_charge_id, null, jsonb_build_object('enrollment_id', p_enrollment_id, 'amount', p_amount), btrim(p_reason), gen_random_uuid());
  return v_charge_id;
end; $$;
revoke all on function public.create_enrollment_fee_charge(uuid,numeric,date,text) from public, anon;
grant execute on function public.create_enrollment_fee_charge(uuid,numeric,date,text) to authenticated;
