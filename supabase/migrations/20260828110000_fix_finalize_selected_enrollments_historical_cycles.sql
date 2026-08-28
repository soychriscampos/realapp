create or replace function
app_private.finalize_selected_enrollments_internal(
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
    v_finalized_count integer := 0;
begin
    v_actor_id := (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;
    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;
    if not app_private.current_user_has_permission('students.manage', 'ALL') then
        raise exception 'Insufficient permission to finalize enrollments';
    end if;
    if p_enrollment_ids is null or cardinality(p_enrollment_ids) = 0 then
        raise exception 'enrollment_ids are required';
    end if;
    if p_effective_on is null then
        raise exception 'effective_on is required';
    end if;

    -- Lock and validate the selected active rows before changing any of them.
    -- The cycle status is intentionally not checked: residual ACTIVA enrollments
    -- in historical cycles must still be correctable.
    for v_enrollment in
        select e.id, e.status, sc.starts_on, sc.ends_on
        from public.enrollments e
        join public.school_cycles sc on sc.id = e.cycle_id
        where e.id = any(p_enrollment_ids)
        order by e.id
        for update of e
    loop
        if v_enrollment.status <> 'ACTIVA' then
            continue;
        end if;
        if p_effective_on < v_enrollment.starts_on or p_effective_on > v_enrollment.ends_on then
            raise exception 'effective_on must belong to school cycle';
        end if;
    end loop;

    for v_enrollment in
        select e.id, e.status
        from public.enrollments e
        where e.id = any(p_enrollment_ids)
          and e.status = 'ACTIVA'
        order by e.id
    loop
        update public.enrollments
        set status = 'FINALIZADA', updated_at = statement_timestamp()
        where id = v_enrollment.id and status = 'ACTIVA';

        if not found then
            continue;
        end if;

        v_event_id := app_private.record_enrollment_event_internal(
            v_enrollment.id,
            'FINALIZED',
            p_effective_on,
            null,
            jsonb_build_object('status', v_enrollment.status),
            jsonb_build_object('status', 'FINALIZADA'),
            v_actor_id
        );

        insert into public.audit_log (
            actor_profile_id, action, entity_name, entity_id,
            old_values, new_values, reason, correlation_id
        )
        values (
            v_actor_id, 'ENROLLMENT_FINALIZED', 'enrollments', v_enrollment.id,
            jsonb_build_object('status', v_enrollment.status),
            jsonb_build_object('status', 'FINALIZADA', 'event_id', v_event_id),
            null, gen_random_uuid()
        );

        v_finalized_count := v_finalized_count + 1;
    end loop;

    return v_finalized_count;
end;
$$;
