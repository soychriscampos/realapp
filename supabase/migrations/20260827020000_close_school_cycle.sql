create or replace function
app_private.close_school_cycle_internal(
    p_cycle_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_cycle_status text;
    v_cycle_name text;
    v_active_count integer;
    v_correlation_id uuid := gen_random_uuid();
begin
    v_actor_id := (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;
    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;
    if not app_private.current_user_has_permission('students.manage', 'ALL') then
        raise exception 'Insufficient permission to close school cycle';
    end if;
    if p_cycle_id is null then
        raise exception 'cycle_id is required';
    end if;

    select sc.status, sc.name
    into v_cycle_status, v_cycle_name
    from public.school_cycles sc
    where sc.id = p_cycle_id
    for update;

    if not found then
        raise exception 'School cycle not found';
    end if;
    if v_cycle_status <> 'ACTIVE' then
        raise exception 'Only an active school cycle can be closed';
    end if;

    select count(*)::integer
    into v_active_count
    from public.enrollments e
    where e.cycle_id = p_cycle_id
      and e.status = 'ACTIVA';

    if v_active_count > 0 then
        raise exception 'Active enrollments remain. Finalize enrollments before closing the school cycle.';
    end if;

    update public.school_cycles
    set status = 'CLOSED',
        updated_at = statement_timestamp()
    where id = p_cycle_id
      and status = 'ACTIVE';

    if not found then
        raise exception 'School cycle changed while closing';
    end if;

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
        'SCHOOL_CYCLE_CLOSED',
        'school_cycles',
        p_cycle_id,
        jsonb_build_object('status', 'ACTIVE', 'name', v_cycle_name),
        jsonb_build_object('status', 'CLOSED', 'name', v_cycle_name),
        null,
        v_correlation_id
    );

    return p_cycle_id;
end;
$$;

create or replace function
public.close_school_cycle(p_cycle_id uuid)
returns uuid
language sql
set search_path = ''
as $$
    select app_private.close_school_cycle_internal(p_cycle_id);
$$;

revoke all on function public.close_school_cycle(uuid) from public, anon;
grant execute on function public.close_school_cycle(uuid) to authenticated;
