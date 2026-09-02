-- Fase 2: onboarding familiar y autorización digital explícita.
-- Esta migración no crea cuentas Auth: el alta se inicia en el cliente y
-- la vinculación final ocurre únicamente después de confirmar el correo.

create or replace function public.create_family_invitation(
    p_guardian_id uuid,
    p_student_ids uuid[],
    p_token_hash text,
    p_expires_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
    v_invitation_id uuid;
    v_user uuid := auth.uid();
    v_student_id uuid;
begin
    if not app_private.current_user_has_permission('family_access.manage', 'ALL') then raise exception 'Insufficient permission'; end if;
    if p_guardian_id is null or not exists (select 1 from public.guardians where id = p_guardian_id) then raise exception 'Guardian no encontrado'; end if;
    if p_student_ids is null or cardinality(p_student_ids) = 0 or cardinality(p_student_ids) <> (select count(distinct x) from unnest(p_student_ids) x) then raise exception 'Alumnos inválidos'; end if;
    if p_token_hash is null or p_token_hash !~ '^[0-9a-fA-F]{64}$' then raise exception 'Token inválido'; end if;
    if p_expires_at <= statement_timestamp() then raise exception 'La invitación debe tener una fecha futura'; end if;
    foreach v_student_id in array p_student_ids loop
        if not exists (select 1 from public.student_guardians where student_id = v_student_id and guardian_id = p_guardian_id and is_active) then raise exception 'El guardian no está relacionado con todos los alumnos seleccionados'; end if;
    end loop;
    insert into public.family_invitations (guardian_id, token_hash, expires_at, created_by)
    values (p_guardian_id, decode(lower(p_token_hash), 'hex'), p_expires_at, v_user)
    returning id into v_invitation_id;
    insert into public.family_invitation_students (invitation_id, guardian_id, student_id)
    select v_invitation_id, p_guardian_id, x from unnest(p_student_ids) x;
    return v_invitation_id;
end;
$$;

create or replace function public.get_family_invitation_by_token(p_token_hash text)
returns table (guardian_id uuid, guardian_name text, student_id uuid, student_name text)
language sql security definer set search_path = '' as $$
    select i.guardian_id, g.full_name, s.id, s.full_name
    from public.family_invitations i
    join public.guardians g on g.id = i.guardian_id
    join public.family_invitation_students fis on fis.invitation_id = i.id
    join public.students s on s.id = fis.student_id
    where i.token_hash = decode(lower(p_token_hash), 'hex') and i.status = 'PENDING' and i.expires_at > statement_timestamp()
      and exists (select 1 from public.student_guardians sg where sg.student_id = fis.student_id and sg.guardian_id = i.guardian_id and sg.is_active);
$$;

create or replace function public.complete_family_onboarding(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    v_invitation public.family_invitations%rowtype;
    v_guardian public.guardians%rowtype;
    v_user uuid := auth.uid();
    v_profile uuid;
    v_role uuid;
    v_student uuid;
    v_email text;
    v_count integer;
begin
    if v_user is null then raise exception 'Sesión requerida'; end if;
    select * into v_invitation from public.family_invitations where token_hash = decode(lower(p_token_hash), 'hex') for update;
    if not found or v_invitation.status <> 'PENDING' or v_invitation.expires_at <= statement_timestamp() then raise exception 'Invitación no válida, vencida o utilizada'; end if;
    select * into v_guardian from public.guardians where id = v_invitation.guardian_id for update;
    if v_guardian.auth_user_id is not null and v_guardian.auth_user_id <> v_user then raise exception 'El guardian ya está vinculado a otra cuenta'; end if;
    if exists (select 1 from public.guardians where auth_user_id = v_user and id <> v_guardian.id) then raise exception 'La cuenta ya está vinculada a otro guardian'; end if;
    select lower(btrim(email)) into v_email from auth.users where id = v_user and email_confirmed_at is not null;
    if v_email is null then raise exception 'El correo debe estar confirmado'; end if;
    for v_student in select fis.student_id from public.family_invitation_students fis where fis.invitation_id = v_invitation.id loop
        if not exists (select 1 from public.student_guardians where student_id = v_student and guardian_id = v_guardian.id and is_active) then
            raise exception 'La invitación ya no tiene relaciones activas con todos los alumnos';
        end if;
        perform 1 from public.students where id = v_student for update;
        select count(distinct guardian_id) into v_count from public.family_access where student_id = v_student and status = 'ACTIVE' and guardian_id <> v_guardian.id;
        if v_count >= 2 then raise exception 'El alumno ya tiene el máximo de accesos familiares'; end if;
    end loop;
    select id into v_profile from public.profiles where id = v_user;
    if v_profile is null then insert into public.profiles (id, display_name) values (v_user, v_guardian.full_name) returning id into v_profile; end if;
    update public.guardians set auth_user_id = v_user, email = v_email, updated_at = statement_timestamp() where id = v_guardian.id;
    select id into v_role from public.roles where code = 'TUTOR' and is_active;
    if v_role is null then raise exception 'Rol TUTOR no encontrado'; end if;
    if not exists (select 1 from public.user_roles where user_id = v_user and role_id = v_role and valid_until is null) then
        insert into public.user_roles (user_id, role_id, assigned_by) values (v_user, v_role, v_invitation.created_by);
    end if;
    insert into public.family_access (guardian_id, student_id, invitation_id, granted_by)
    select v_guardian.id, fis.student_id, v_invitation.id, v_invitation.created_by
    from public.family_invitation_students fis
    where fis.invitation_id = v_invitation.id
      and not exists (select 1 from public.family_access fa where fa.guardian_id = v_guardian.id and fa.student_id = fis.student_id and fa.status = 'ACTIVE');
    update public.family_invitations set status = 'ACCEPTED', accepted_by = v_profile, accepted_at = statement_timestamp(), updated_at = statement_timestamp() where id = v_invitation.id;
    return jsonb_build_object('guardian_id', v_guardian.id, 'student_count', (select count(*) from public.family_invitation_students where invitation_id = v_invitation.id));
end;
$$;

create or replace function public.get_family_guardian_context(p_guardian_id uuid)
returns table (student_id uuid, student_name text, access_status text, family_access_id uuid, invitation_status text, invitation_id uuid, invitation_expires_at timestamptz)
language sql security definer set search_path = '' as $$
    select sg.student_id, s.full_name, coalesce(fa.status, 'NONE'), fa.id, coalesce(i.status, 'NONE'), i.id, i.expires_at
    from public.student_guardians sg join public.students s on s.id = sg.student_id
    left join lateral (select id, status from public.family_access where guardian_id = sg.guardian_id and student_id = sg.student_id order by created_at desc limit 1) fa on true
    left join lateral (select i.id, i.status, i.expires_at from public.family_invitations i join public.family_invitation_students fis on fis.invitation_id = i.id where i.guardian_id = sg.guardian_id and fis.student_id = sg.student_id order by i.created_at desc limit 1) i on true
    where sg.guardian_id = p_guardian_id and sg.is_active and app_private.current_user_has_permission('family_access.manage', 'ALL')
    order by s.full_name;
$$;

create or replace function public.revoke_family_invitation(p_invitation_id uuid, p_reason text default 'Revocada por un administrador.')
returns boolean language plpgsql security definer set search_path = '' as $$
begin
    if not app_private.current_user_has_permission('family_access.manage', 'ALL') then raise exception 'Insufficient permission'; end if;
    update public.family_invitations set status = 'REVOKED', revoked_by = auth.uid(), revoked_at = statement_timestamp(), revocation_reason = coalesce(nullif(btrim(p_reason), ''), 'Revocada por un administrador.'), updated_at = statement_timestamp() where id = p_invitation_id and status = 'PENDING';
    return found;
end;
$$;

create or replace function public.regenerate_family_invitation(p_invitation_id uuid, p_token_hash text, p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_new uuid; v_guardian uuid; v_user uuid := auth.uid();
begin
    if not app_private.current_user_has_permission('family_access.manage', 'ALL') then raise exception 'Insufficient permission'; end if;
    if p_token_hash is null or p_token_hash !~ '^[0-9a-fA-F]{64}$' then raise exception 'Token inválido'; end if;
    if p_expires_at <= statement_timestamp() then raise exception 'La invitación debe tener una fecha futura'; end if;
    select guardian_id into v_guardian from public.family_invitations where id = p_invitation_id and status = 'PENDING' for update;
    if v_guardian is null then raise exception 'La invitación ya no está disponible'; end if;
    if exists (
        select 1
        from public.family_invitation_students fis
        where fis.invitation_id = p_invitation_id
          and not exists (
              select 1
              from public.student_guardians sg
              where sg.student_id = fis.student_id
                and sg.guardian_id = v_guardian
                and sg.is_active
          )
    ) then raise exception 'La invitación ya no tiene relaciones activas con todos los alumnos'; end if;
    update public.family_invitations set status = 'REVOKED', revoked_by = v_user, revoked_at = statement_timestamp(), revocation_reason = 'Regenerada', updated_at = statement_timestamp() where id = p_invitation_id;
    insert into public.family_invitations (guardian_id, token_hash, expires_at, created_by) values (v_guardian, decode(lower(p_token_hash), 'hex'), p_expires_at, v_user) returning id into v_new;
    insert into public.family_invitation_students (invitation_id, guardian_id, student_id) select v_new, guardian_id, student_id from public.family_invitation_students where invitation_id = p_invitation_id;
    return v_new;
end;
$$;

revoke all on function public.create_family_invitation(uuid, uuid[], text, timestamptz) from public, anon;
grant execute on function public.create_family_invitation(uuid, uuid[], text, timestamptz) to authenticated;
revoke all on function public.get_family_invitation_by_token(text) from public;
grant execute on function public.get_family_invitation_by_token(text) to anon, authenticated;
revoke all on function public.complete_family_onboarding(text) from public, anon;
grant execute on function public.complete_family_onboarding(text) to authenticated;
revoke all on function public.get_family_guardian_context(uuid) from public, anon;
grant execute on function public.get_family_guardian_context(uuid) to authenticated;
revoke all on function public.revoke_family_invitation(uuid, text) from public, anon;
grant execute on function public.revoke_family_invitation(uuid, text) to authenticated;
revoke all on function public.regenerate_family_invitation(uuid, text, timestamptz) from public, anon;
grant execute on function public.regenerate_family_invitation(uuid, text, timestamptz) to authenticated;

create or replace function public.revoke_family_access(
    p_family_access_id uuid,
    p_reason text
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
    if not app_private.current_user_has_permission('family_access.manage', 'ALL') then
        raise exception 'Insufficient permission';
    end if;
    if btrim(coalesce(p_reason, '')) = '' then
        raise exception 'El motivo de revocación es obligatorio';
    end if;
    update public.family_access
    set status = 'REVOKED',
        revoked_at = statement_timestamp(),
        revoked_by = auth.uid(),
        revocation_reason = btrim(p_reason),
        updated_at = statement_timestamp()
    where id = p_family_access_id and status = 'ACTIVE';
    if not found then
        if exists (select 1 from public.family_access where id = p_family_access_id and status = 'REVOKED') then
            raise exception 'El acceso familiar ya está revocado';
        end if;
        raise exception 'El acceso familiar no existe';
    end if;
    return true;
end;
$$;

revoke all on function public.revoke_family_access(uuid, text) from public, anon;
grant execute on function public.revoke_family_access(uuid, text) to authenticated;
