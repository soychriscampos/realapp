-- G1 — Gestión de ciclos escolares

create or replace function app_private.create_school_cycle_internal(
    p_code text,
    p_name text,
    p_starts_on date,
    p_ends_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_cycle_id uuid;
begin
    v_actor_id := auth.uid();

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;
    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;
    if not app_private.current_user_has_permission('cycles.manage', 'ALL') then
        raise exception 'Insufficient permission to manage school cycles';
    end if;
    if p_code is null or btrim(p_code) = '' then
        raise exception 'Cycle code is required';
    end if;
    if p_name is null or btrim(p_name) = '' then
        raise exception 'Cycle name is required';
    end if;
    if p_starts_on is null or p_ends_on is null then
        raise exception 'Cycle dates are required';
    end if;
    if p_ends_on < p_starts_on then
        raise exception 'Cycle end date must be on or after start date';
    end if;

    insert into public.school_cycles (code, name, starts_on, ends_on, status)
    values (btrim(p_code), btrim(p_name), p_starts_on, p_ends_on, 'PREPARATION')
    returning id into v_cycle_id;

    insert into public.audit_log (
        actor_profile_id, action, entity_name, entity_id,
        old_values, new_values, reason
    )
    values (
        v_actor_id,
        'SCHOOL_CYCLE_CREATED',
        'school_cycles',
        v_cycle_id,
        null,
        jsonb_build_object(
            'code', btrim(p_code),
            'name', btrim(p_name),
            'starts_on', p_starts_on,
            'ends_on', p_ends_on,
            'status', 'PREPARATION'
        ),
        null
    );

    return v_cycle_id;
exception
    when unique_violation then
        raise exception 'A school cycle with this code already exists';
end;
$$;

create or replace function public.create_school_cycle(
    p_code text,
    p_name text,
    p_starts_on date,
    p_ends_on date
)
returns uuid
language sql
security definer
set search_path = ''
as $$
    select app_private.create_school_cycle_internal(
        p_code, p_name, p_starts_on, p_ends_on
    );
$$;


create or replace function app_private.update_school_cycle_internal(
    p_cycle_id uuid,
    p_code text,
    p_name text,
    p_starts_on date,
    p_ends_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_old public.school_cycles%rowtype;
begin
    v_actor_id := auth.uid();

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;
    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;
    if not app_private.current_user_has_permission('cycles.manage', 'ALL') then
        raise exception 'Insufficient permission to manage school cycles';
    end if;
    if p_cycle_id is null then
        raise exception 'School cycle is required';
    end if;
    if p_code is null or btrim(p_code) = '' then
        raise exception 'Cycle code is required';
    end if;
    if p_name is null or btrim(p_name) = '' then
        raise exception 'Cycle name is required';
    end if;
    if p_starts_on is null or p_ends_on is null then
        raise exception 'Cycle dates are required';
    end if;
    if p_ends_on < p_starts_on then
        raise exception 'Cycle end date must be on or after start date';
    end if;

    select * into v_old
    from public.school_cycles
    where id = p_cycle_id
    for update;

    if not found then
        raise exception 'School cycle not found';
    end if;

    update public.school_cycles
    set code = btrim(p_code),
        name = btrim(p_name),
        starts_on = p_starts_on,
        ends_on = p_ends_on,
        updated_at = statement_timestamp()
    where id = p_cycle_id;

    insert into public.audit_log (
        actor_profile_id, action, entity_name, entity_id,
        old_values, new_values, reason
    )
    values (
        v_actor_id,
        'SCHOOL_CYCLE_UPDATED',
        'school_cycles',
        p_cycle_id,
        jsonb_build_object(
            'code', v_old.code,
            'name', v_old.name,
            'starts_on', v_old.starts_on,
            'ends_on', v_old.ends_on,
            'status', v_old.status
        ),
        jsonb_build_object(
            'code', btrim(p_code),
            'name', btrim(p_name),
            'starts_on', p_starts_on,
            'ends_on', p_ends_on,
            'status', v_old.status
        ),
        null
    );

    return p_cycle_id;
exception
    when unique_violation then
        raise exception 'A school cycle with this code already exists';
end;
$$;

create or replace function public.update_school_cycle(
    p_cycle_id uuid,
    p_code text,
    p_name text,
    p_starts_on date,
    p_ends_on date
)
returns uuid
language sql
security definer
set search_path = ''
as $$
    select app_private.update_school_cycle_internal(
        p_cycle_id, p_code, p_name, p_starts_on, p_ends_on
    );
$$;


create or replace function app_private.activate_school_cycle_internal(
    p_cycle_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_old public.school_cycles%rowtype;
begin
    v_actor_id := auth.uid();

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;
    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;
    if not app_private.current_user_has_permission('cycles.manage', 'ALL') then
        raise exception 'Insufficient permission to manage school cycles';
    end if;
    if p_cycle_id is null then
        raise exception 'School cycle is required';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('school_cycles_active'));

    select * into v_old
    from public.school_cycles
    where id = p_cycle_id
    for update;

    if not found then
        raise exception 'School cycle not found';
    end if;
    if v_old.status <> 'PREPARATION' then
        raise exception 'Only a school cycle in preparation can be activated';
    end if;
    if exists (select 1 from public.school_cycles where status = 'ACTIVE') then
        raise exception 'Another school cycle is already active';
    end if;

    update public.school_cycles
    set status = 'ACTIVE', updated_at = statement_timestamp()
    where id = p_cycle_id;

    insert into public.audit_log (
        actor_profile_id, action, entity_name, entity_id,
        old_values, new_values, reason
    )
    values (
        v_actor_id,
        'SCHOOL_CYCLE_ACTIVATED',
        'school_cycles',
        p_cycle_id,
        jsonb_build_object('status', 'PREPARATION', 'name', v_old.name),
        jsonb_build_object('status', 'ACTIVE', 'name', v_old.name),
        null
    );

    return p_cycle_id;
end;
$$;

create or replace function public.activate_school_cycle(p_cycle_id uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$
    select app_private.activate_school_cycle_internal(p_cycle_id);
$$;

revoke all on function public.create_school_cycle(text, text, date, date) from public, anon;
revoke all on function public.update_school_cycle(uuid, text, text, date, date) from public, anon;
revoke all on function public.activate_school_cycle(uuid) from public, anon;

grant execute on function public.create_school_cycle(text, text, date, date) to authenticated;
grant execute on function public.update_school_cycle(uuid, text, text, date, date) to authenticated;
grant execute on function public.activate_school_cycle(uuid) to authenticated;
