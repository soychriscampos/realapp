-- Fase 1: permite reutilizar un guardian existente al crear un alumno nuevo.
create or replace function app_private.create_new_student_enrollment_internal(
 p_student_full_name text,p_student_sex text,p_student_birth_date date,p_contacts jsonb,p_cycle_id uuid,p_grade_level_id uuid,p_classification_id uuid,p_group_id uuid,p_activated_on date,p_classes_start_on date,p_economic_start_on date,p_initial_period_amount numeric default null,p_initial_period_due_date date default null,p_enrollment_fee_mode text default null,p_enrollment_fee_amount numeric default null,p_discount_category_id uuid default null,p_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_actor uuid := auth.uid(); v_student_id uuid; v_guardian_id uuid; v_contact jsonb; v_priority smallint := 1; v_enrollment_id uuid; v_name text; v_existing_guardian uuid; v_existing_email text;
begin
 if v_actor is null then raise exception 'Authentication required'; end if;
 if not app_private.current_user_is_active() or not app_private.current_user_has_permission('students.manage','ALL') or not app_private.current_user_has_permission('finance.configure','ALL') then raise exception 'Insufficient permission to create student enrollment'; end if;
 v_name := nullif(btrim(p_student_full_name), ''); if v_name is null then raise exception 'Student full name is required'; end if;
 if p_student_sex not in ('H', 'M') then raise exception 'Invalid student sex'; end if;
 if p_contacts is null or jsonb_typeof(p_contacts) <> 'array' or jsonb_array_length(p_contacts) > 2 then raise exception 'A maximum of two contacts is allowed'; end if;
 insert into public.students(full_name, sex, birth_date) values(v_name, p_student_sex, p_student_birth_date) returning id into v_student_id;
 for v_contact in select value from jsonb_array_elements(p_contacts) loop
   v_existing_guardian := nullif(v_contact ->> 'guardian_id', '')::uuid;
   if v_existing_guardian is not null then
     select id, email into v_guardian_id, v_existing_email from public.guardians where id = v_existing_guardian;
     if v_guardian_id is null then raise exception 'Existing guardian not found'; end if;
     if nullif(btrim(v_contact ->> 'relationship'), '') is null then raise exception 'Contact relationship is required'; end if;
   else
     if nullif(btrim(v_contact ->> 'full_name'), '') is null or nullif(btrim(v_contact ->> 'phone'), '') is null or nullif(btrim(v_contact ->> 'relationship'), '') is null then raise exception 'Contact full name, phone and relationship are required'; end if;
     insert into public.guardians(full_name, phone, email) values(btrim(v_contact ->> 'full_name'), btrim(v_contact ->> 'phone'), nullif(btrim(v_contact ->> 'email'), '')) returning id into v_guardian_id;
   end if;
   if exists (select 1 from public.student_guardians where student_id = v_student_id and guardian_id = v_guardian_id) then raise exception 'Student is already linked to this guardian'; end if;
   insert into public.student_guardians(student_id, guardian_id, relationship, priority, via_whatsapp, via_email, is_active, started_at)
   values(v_student_id, v_guardian_id, btrim(v_contact ->> 'relationship'), v_priority, coalesce((v_contact ->> 'via_whatsapp')::boolean, true), coalesce((v_contact ->> 'via_email')::boolean, case when v_existing_guardian is not null then nullif(btrim(v_existing_email), '') is not null else nullif(btrim(v_contact ->> 'email'), '') is not null end), true, p_activated_on);
   v_priority := v_priority + 1;
 end loop;
 v_enrollment_id := app_private.create_and_activate_enrollment_internal(v_student_id, p_cycle_id, p_grade_level_id, p_classification_id, p_group_id, p_activated_on, p_classes_start_on, p_economic_start_on, p_initial_period_amount, p_initial_period_due_date, p_enrollment_fee_mode, p_enrollment_fee_amount, p_reason, p_discount_category_id);
 return jsonb_build_object('student_id', v_student_id, 'enrollment_id', v_enrollment_id, 'discount_category_id', p_discount_category_id);
end; $$;
