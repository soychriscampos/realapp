create or replace function
app_private.graduate_enrollment_internal(
    p_enrollment_id uuid,
    p_effective_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_old_status text;
    v_grade_is_terminal boolean;
    v_event_id uuid;
begin
    v_actor_id := (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;
    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;
    if not app_private.current_user_has_permission('students.manage', 'ALL') then
        raise exception 'Insufficient permission to graduate enrollment';
    end if;
    if p_enrollment_id is null then
        raise exception 'enrollment_id is required';
    end if;
    if p_effective_on is null then
        raise exception 'effective_on is required';
    end if;

    select e.status, gl.is_terminal
    into v_old_status, v_grade_is_terminal
    from public.enrollments e
    join public.grade_levels gl on gl.id = e.grade_level_id
    where e.id = p_enrollment_id
    for update of e;

    if not found then
        raise exception 'Enrollment not found';
    end if;
    if v_old_status <> 'FINALIZADA' then
        raise exception 'Only FINALIZADA enrollment can be graduated';
    end if;
    if not v_grade_is_terminal then
        raise exception 'Enrollment grade is not eligible for graduation';
    end if;

    update public.enrollments
    set status = 'EGRESADA', updated_at = statement_timestamp()
    where id = p_enrollment_id and status = 'FINALIZADA';
    if not found then
        raise exception 'Enrollment changed while graduating';
    end if;

    v_event_id := app_private.record_enrollment_event_internal(
        p_enrollment_id,
        'GRADUATED',
        p_effective_on,
        null,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object('status', 'EGRESADA'),
        v_actor_id
    );

    insert into public.audit_log (
        actor_profile_id, action, entity_name, entity_id,
        old_values, new_values, reason, correlation_id
    )
    values (
        v_actor_id, 'ENROLLMENT_GRADUATED', 'enrollments', p_enrollment_id,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object('status', 'EGRESADA', 'event_id', v_event_id),
        null, gen_random_uuid()
    );

    return v_event_id;
end;
$$;
