create or replace function
app_private.graduate_selected_enrollments_internal(
    p_enrollment_ids uuid[],
    p_effective_on date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_enrollment record;
    v_event_id uuid;
    v_graduated_count integer := 0;
begin
    v_actor_id := (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;
    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;
    if not app_private.current_user_has_permission('students.manage', 'ALL') then
        raise exception 'Insufficient permission to graduate enrollments';
    end if;
    if p_enrollment_ids is null or cardinality(p_enrollment_ids) = 0 then
        raise exception 'enrollment_ids are required';
    end if;
    if p_effective_on is null then
        raise exception 'effective_on is required';
    end if;

    for v_enrollment in
        select e.id, e.status, gl.is_terminal, sc.starts_on, sc.ends_on
        from public.enrollments e
        join public.grade_levels gl on gl.id = e.grade_level_id
        join public.school_cycles sc on sc.id = e.cycle_id
        where e.id = any(p_enrollment_ids)
        order by e.id
        for update of e
    loop
        if v_enrollment.status not in ('ACTIVA', 'FINALIZADA')
           or not v_enrollment.is_terminal then
            continue;
        end if;
        if p_effective_on < v_enrollment.starts_on or p_effective_on > v_enrollment.ends_on then
            raise exception 'effective_on must belong to enrollment cycle';
        end if;
    end loop;

    for v_enrollment in
        select e.id, e.status
        from public.enrollments e
        join public.grade_levels gl on gl.id = e.grade_level_id
        where e.id = any(p_enrollment_ids)
          and e.status in ('ACTIVA', 'FINALIZADA')
          and gl.is_terminal = true
        order by e.id
    loop
        update public.enrollments
        set status = 'EGRESADA', updated_at = statement_timestamp()
        where id = v_enrollment.id
          and status in ('ACTIVA', 'FINALIZADA');

        if not found then
            continue;
        end if;

        v_event_id := app_private.record_enrollment_event_internal(
            v_enrollment.id,
            'GRADUATED',
            p_effective_on,
            null,
            jsonb_build_object('status', v_enrollment.status),
            jsonb_build_object('status', 'EGRESADA'),
            v_actor_id
        );

        insert into public.audit_log (
            actor_profile_id, action, entity_name, entity_id,
            old_values, new_values, reason, correlation_id
        )
        values (
            v_actor_id, 'ENROLLMENT_GRADUATED', 'enrollments', v_enrollment.id,
            jsonb_build_object('status', v_enrollment.status),
            jsonb_build_object('status', 'EGRESADA', 'event_id', v_event_id),
            null, gen_random_uuid()
        );

        v_graduated_count := v_graduated_count + 1;
    end loop;

    return v_graduated_count;
end;
$$;

create or replace function
public.graduate_selected_enrollments(
    p_enrollment_ids uuid[],
    p_effective_on date
)
returns integer
language sql
set search_path = ''
as $$
    select app_private.graduate_selected_enrollments_internal(
        p_enrollment_ids,
        p_effective_on
    );
$$;

revoke all on function public.graduate_selected_enrollments(uuid[], date) from public, anon;
grant execute on function public.graduate_selected_enrollments(uuid[], date) to authenticated;
