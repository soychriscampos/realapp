create or replace function
app_private.finalize_active_enrollments_internal(
    p_cycle_id uuid,
    p_effective_on date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_cycle_start date;
    v_cycle_end date;
    v_cycle_status text;
    v_finalized_count integer := 0;
    v_enrollment record;
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
        raise exception 'Insufficient permission to finalize enrollments';
    end if;

    if p_cycle_id is null then
        raise exception 'cycle_id is required';
    end if;

    if p_effective_on is null then
        raise exception 'effective_on is required';
    end if;

    select sc.starts_on, sc.ends_on, sc.status
    into v_cycle_start, v_cycle_end, v_cycle_status
    from public.school_cycles sc
    where sc.id = p_cycle_id
    for update;

    if not found then
        raise exception 'School cycle not found';
    end if;

    if v_cycle_status <> 'ACTIVE' then
        raise exception 'Only an active school cycle can be finalized';
    end if;

    if p_effective_on < v_cycle_start or p_effective_on > v_cycle_end then
        raise exception 'effective_on must belong to school cycle';
    end if;

    for v_enrollment in
        select e.id, e.status
        from public.enrollments e
        where e.cycle_id = p_cycle_id
          and e.status = 'ACTIVA'
        order by e.id
        for update
    loop
        update public.enrollments
        set status = 'FINALIZADA',
            updated_at = statement_timestamp()
        where id = v_enrollment.id
          and status = 'ACTIVA';

        if not found then
            raise exception 'Enrollment changed while finalizing cycle';
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
            'ENROLLMENT_FINALIZED',
            'enrollments',
            v_enrollment.id,
            jsonb_build_object('status', v_enrollment.status),
            jsonb_build_object('status', 'FINALIZADA', 'event_id', v_event_id),
            null,
            gen_random_uuid()
        );

        v_finalized_count := v_finalized_count + 1;
    end loop;

    return v_finalized_count;
end;
$$;

create or replace function
public.finalize_active_enrollments(
    p_cycle_id uuid,
    p_effective_on date
)
returns integer
language sql
set search_path = ''
as $$
    select app_private.finalize_active_enrollments_internal(
        p_cycle_id,
        p_effective_on
    );
$$;

revoke all on function public.finalize_active_enrollments(uuid, date) from public, anon;
grant execute on function public.finalize_active_enrollments(uuid, date) to authenticated;
