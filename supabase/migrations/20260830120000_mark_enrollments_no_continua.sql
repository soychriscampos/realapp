-- Registra la decisión de no continuidad en el ciclo destino.
-- enrolled_on usa starts_on del ciclo destino: representa el alta administrativa
-- de la matrícula marcador y no inventa una fecha de asistencia histórica.

create or replace function app_private.mark_enrollments_no_continua_internal(
    p_source_enrollment_ids uuid[],
    p_target_cycle_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid := auth.uid();
    v_target record;
    v_previous_cycle_id uuid;
    v_source record;
    v_existing record;
    v_target_grade_id uuid;
    v_enrollment_id uuid;
    v_results jsonb := '[]'::jsonb;
begin
    if v_actor_id is null then raise exception 'Authentication required'; end if;
    if not app_private.current_user_is_active() then raise exception 'Inactive user'; end if;
    if not app_private.current_user_has_permission('students.manage', 'ALL') then
        raise exception 'Insufficient permission to mark enrollments no continua';
    end if;
    if p_target_cycle_id is null then raise exception 'target_cycle_id is required'; end if;
    if p_source_enrollment_ids is null or cardinality(p_source_enrollment_ids) = 0 then
        raise exception 'source_enrollment_ids are required';
    end if;

    select sc.id, sc.starts_on
    into v_target
    from public.school_cycles sc
    where sc.id = p_target_cycle_id
    for update;
    if not found then raise exception 'Target school cycle not found'; end if;

    select sc.id into v_previous_cycle_id
    from public.school_cycles sc
    where sc.starts_on < v_target.starts_on
    order by sc.starts_on desc
    limit 1;
    if v_previous_cycle_id is null then raise exception 'Previous cycle not found'; end if;

    for v_source in
        select e.id, e.student_id, e.cycle_id, e.grade_level_id, e.classification_id, e.status
        from public.enrollments e
        where e.id = any(p_source_enrollment_ids)
        order by e.id
        for update
    loop
        if v_source.status <> 'FINALIZADA' then
            v_results := v_results || jsonb_build_array(jsonb_build_object(
                'student_id', v_source.student_id, 'enrollment_id', null, 'success', false,
                'already_processed', false, 'error', 'Only FINALIZADA enrollment can be marked no continua'));
            continue;
        end if;
        if v_source.cycle_id <> v_previous_cycle_id then
            v_results := v_results || jsonb_build_array(jsonb_build_object(
                'student_id', v_source.student_id, 'enrollment_id', null, 'success', false,
                'already_processed', false, 'error', 'Source enrollment is not from the previous cycle'));
            continue;
        end if;

        select e.id, e.status into v_existing
        from public.enrollments e
        where e.student_id = v_source.student_id and e.cycle_id = p_target_cycle_id
        for update;
        if found then
            if v_existing.status = 'NO_CONTINUA' then
                v_results := v_results || jsonb_build_array(jsonb_build_object(
                    'student_id', v_source.student_id, 'enrollment_id', v_existing.id, 'success', true,
                    'already_processed', true, 'error', null));
            else
                v_results := v_results || jsonb_build_array(jsonb_build_object(
                    'student_id', v_source.student_id, 'enrollment_id', v_existing.id, 'success', false,
                    'already_processed', false, 'error', 'Student already has an enrollment for this cycle'));
            end if;
            continue;
        end if;

        -- Same ordering used by lib/admin/enrollment-destination.ts: project to the next grade.
        select next_grade.id into v_target_grade_id
        from public.grade_levels previous_grade
        join public.education_levels previous_level on previous_level.id = previous_grade.education_level_id
        join public.grade_levels next_grade on true
        join public.education_levels next_level on next_level.id = next_grade.education_level_id
        where previous_grade.id = v_source.grade_level_id
          and (next_level.sort_order, next_grade.sort_order) > (previous_level.sort_order, previous_grade.sort_order)
        order by next_level.sort_order, next_grade.sort_order
        limit 1;
        if v_target_grade_id is null then
            v_results := v_results || jsonb_build_array(jsonb_build_object(
                'student_id', v_source.student_id, 'enrollment_id', null, 'success', false,
                'already_processed', false, 'error', 'No projected grade exists for the target cycle'));
            continue;
        end if;

        begin
            insert into public.enrollments (
                student_id, cycle_id, grade_level_id, group_id, classification_id,
                status, enrolled_on, classes_start_on, created_by
            ) values (
                v_source.student_id, p_target_cycle_id, v_target_grade_id, null, v_source.classification_id,
                'NO_CONTINUA', v_target.starts_on, null, v_actor_id
            ) returning id into v_enrollment_id;
        exception when unique_violation then
            select e.id, e.status into v_existing
            from public.enrollments e
            where e.student_id = v_source.student_id and e.cycle_id = p_target_cycle_id
            for update;
            if v_existing.status = 'NO_CONTINUA' then
                v_results := v_results || jsonb_build_array(jsonb_build_object(
                    'student_id', v_source.student_id, 'enrollment_id', v_existing.id, 'success', true,
                    'already_processed', true, 'error', null));
            else
                v_results := v_results || jsonb_build_array(jsonb_build_object(
                    'student_id', v_source.student_id, 'enrollment_id', v_existing.id, 'success', false,
                    'already_processed', false, 'error', 'Student already has an enrollment for this cycle'));
            end if;
            continue;
        end;

        perform app_private.record_enrollment_event_internal(
            v_enrollment_id, 'MARKED_NO_CONTINUA', v_target.starts_on, null,
            jsonb_build_object('status', null),
            jsonb_build_object('status', 'NO_CONTINUA', 'source_enrollment_id', v_source.id),
            v_actor_id
        );
        insert into public.audit_log (
            actor_profile_id, action, entity_name, entity_id, old_values, new_values, reason, correlation_id
        ) values (
            v_actor_id, 'ENROLLMENT_MARKED_NO_CONTINUA', 'enrollments', v_enrollment_id,
            null, jsonb_build_object('status', 'NO_CONTINUA', 'source_enrollment_id', v_source.id),
            null, gen_random_uuid()
        );
        v_results := v_results || jsonb_build_array(jsonb_build_object(
            'student_id', v_source.student_id, 'enrollment_id', v_enrollment_id, 'success', true,
            'already_processed', false, 'error', null));
    end loop;
    return v_results;
end;
$$;

create or replace function public.mark_enrollments_no_continua(
    p_source_enrollment_ids uuid[], p_target_cycle_id uuid
)
returns jsonb language sql security definer set search_path = '' as $$
    select app_private.mark_enrollments_no_continua_internal(
        p_source_enrollment_ids, p_target_cycle_id
    );
$$;

revoke all on function app_private.mark_enrollments_no_continua_internal(uuid[], uuid) from public, anon, authenticated;
revoke all on function public.mark_enrollments_no_continua(uuid[], uuid) from public, anon;
grant execute on function public.mark_enrollments_no_continua(uuid[], uuid) to authenticated;
