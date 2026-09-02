-- Fase 2: concede acceso digital a un guardian que ya tiene cuenta Auth.

create or replace function public.grant_family_access_to_existing_guardian(
    p_guardian_id uuid,
    p_student_id uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
    v_user uuid := auth.uid();
    v_guardian_auth_user_id uuid;
    v_access_id uuid;
    v_role uuid;
    v_count integer;
begin
    if not app_private.current_user_has_permission('family_access.manage', 'ALL') then
        raise exception 'Insufficient permission';
    end if;

    select auth_user_id into v_guardian_auth_user_id
    from public.guardians
    where id = p_guardian_id
    for update;
    if v_guardian_auth_user_id is null then
        raise exception 'El guardian no tiene una cuenta Auth vinculada';
    end if;

    if not exists (
        select 1 from public.student_guardians
        where student_id = p_student_id and guardian_id = p_guardian_id and is_active
    ) then
        raise exception 'El guardian no tiene una relación activa con el alumno';
    end if;

    perform 1 from public.students where id = p_student_id for update;

    select id into v_access_id
    from public.family_access
    where guardian_id = p_guardian_id and student_id = p_student_id and status = 'ACTIVE'
    limit 1;
    if v_access_id is not null then return v_access_id; end if;

    select count(distinct guardian_id) into v_count
    from public.family_access
    where student_id = p_student_id and status = 'ACTIVE';
    if v_count >= 2 then raise exception 'El alumno ya tiene el máximo de accesos familiares'; end if;

    select id into v_role from public.roles where code = 'TUTOR' and is_active;
    if v_role is null then raise exception 'Rol TUTOR no encontrado'; end if;
    if not exists (
        select 1 from public.user_roles
        where user_id = v_guardian_auth_user_id and role_id = v_role and valid_until is null
    ) then
        if not exists (select 1 from public.profiles where id = v_guardian_auth_user_id) then
            raise exception 'El guardian no tiene perfil de acceso';
        end if;
        insert into public.user_roles (user_id, role_id, assigned_by)
        values (v_guardian_auth_user_id, v_role, v_user);
    end if;

    insert into public.family_access (guardian_id, student_id, granted_by)
    values (p_guardian_id, p_student_id, v_user)
    returning id into v_access_id;
    return v_access_id;
end;
$$;

revoke all on function public.grant_family_access_to_existing_guardian(uuid, uuid) from public, anon;
grant execute on function public.grant_family_access_to_existing_guardian(uuid, uuid) to authenticated;
