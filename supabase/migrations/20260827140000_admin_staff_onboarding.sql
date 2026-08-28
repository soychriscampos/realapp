-- G3 — Usuarios y accesos administrativos
-- El correo se captura durante el onboarding, no al crear la invitación.

alter table public.staff_invitations
    alter column email drop not null;

alter table public.staff_invitations
    drop constraint staff_invitations_email_not_blank;

alter table public.staff_invitations
    add constraint staff_invitations_email_not_blank
    check (email is null or btrim(email) <> '');

alter table public.staff_invitations
    drop constraint staff_invitations_accepted_state_check;

alter table public.staff_invitations
    add constraint staff_invitations_accepted_state_check
    check (
        (
            status = 'ACCEPTED'
            and email is not null
            and accepted_user_id is not null
            and accepted_at is not null
        )
        or status <> 'ACCEPTED'
    );

-- La consulta administrativa sigue protegida por users.manage / ALL.
create policy staff_invitations_select_manage_users
on public.staff_invitations
for select
to authenticated
using (
    app_private.current_user_has_permission('users.manage', 'ALL')
);

create policy staff_invitations_insert_manage_users
on public.staff_invitations
for insert
to authenticated
with check (
    app_private.current_user_has_permission('users.manage', 'ALL')
);

create policy staff_invitations_update_manage_users
on public.staff_invitations
for update
to authenticated
using (
    app_private.current_user_has_permission('users.manage', 'ALL')
)
with check (
    app_private.current_user_has_permission('users.manage', 'ALL')
);

grant select, insert, update on public.staff_invitations to authenticated;

-- API interna de creación: el token recibido ya debe ser SHA-256 en hexadecimal.
create or replace function public.create_staff_invitation(
    p_full_name text,
    p_role_code text,
    p_token_hash text,
    p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_staff_id uuid;
    v_invitation_id uuid;
    v_role_id uuid;
begin
    if not app_private.current_user_has_permission('users.manage', 'ALL') then
        raise exception 'Insufficient permission to manage users';
    end if;

    if btrim(coalesce(p_full_name, '')) = '' then
        raise exception 'El nombre es obligatorio';
    end if;

    if p_role_code not in ('MASTER', 'ADMINISTRATIVO') then
        raise exception 'Rol administrativo inválido';
    end if;

    if p_token_hash is null or p_token_hash !~ '^[0-9a-fA-F]{64}$' then
        raise exception 'Token inválido';
    end if;

    select id into v_role_id
    from public.roles
    where code = p_role_code and is_active = true;

    if v_role_id is null then
        raise exception 'Rol administrativo no encontrado';
    end if;

    insert into public.staff (full_name, status)
    values (btrim(p_full_name), 'ACTIVE')
    returning id into v_staff_id;

    insert into public.staff_invitations (
        full_name, email, initial_role_id, token_hash, expires_at, created_by, staff_id
    )
    values (
        btrim(p_full_name), null, v_role_id, decode(lower(p_token_hash), 'hex'),
        p_expires_at, auth.uid(), v_staff_id
    )
    returning id into v_invitation_id;

    return v_invitation_id;
end;
$$;

revoke all on function public.create_staff_invitation(text, text, text, timestamptz) from public, anon;
grant execute on function public.create_staff_invitation(text, text, text, timestamptz) to authenticated;

-- Endpoint público de lectura mínima. Nunca devuelve el hash ni datos de autorización.
create or replace function public.get_staff_invitation_by_token(p_token_hash text)
returns table (
    full_name text,
    role_code text,
    role_name text
)
language sql
security definer
set search_path = ''
as $$
    select i.full_name, r.code, r.name
    from public.staff_invitations i
    join public.roles r on r.id = i.initial_role_id
    where i.token_hash = decode(lower(p_token_hash), 'hex')
      and i.status = 'PENDING'
      and i.expires_at > statement_timestamp();
$$;

revoke all on function public.get_staff_invitation_by_token(text) from public;
grant execute on function public.get_staff_invitation_by_token(text) to anon, authenticated;

create or replace function public.claim_staff_invitation_email(
    p_token_hash text,
    p_email text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_invitation public.staff_invitations;
    v_email text := lower(btrim(coalesce(p_email, '')));
begin
    if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
        raise exception 'Correo inválido';
    end if;

    select * into v_invitation
    from public.staff_invitations
    where token_hash = decode(lower(p_token_hash), 'hex')
    for update;

    if not found or v_invitation.status <> 'PENDING' or v_invitation.expires_at <= statement_timestamp() then
        raise exception 'La invitación no es válida o ya expiró';
    end if;

    if v_invitation.email is not null and lower(v_invitation.email) <> v_email then
        raise exception 'Esta invitación ya está asociada a otro correo';
    end if;

    update public.staff_invitations
    set email = v_email, updated_at = statement_timestamp()
    where id = v_invitation.id;

    return true;
end;
$$;

revoke all on function public.claim_staff_invitation_email(text, text) from public;
grant execute on function public.claim_staff_invitation_email(text, text) to anon, authenticated;

create or replace function public.complete_staff_onboarding(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_email text := lower(btrim(coalesce(auth.email(), '')));
    v_invitation public.staff_invitations;
    v_profile_id uuid;
begin
    if v_user_id is null then
        raise exception 'La sesión no es válida';
    end if;

    if not exists (
        select 1 from auth.users
        where id = v_user_id and email_confirmed_at is not null
    ) then
        raise exception 'El correo todavía no está confirmado';
    end if;

    select * into v_invitation
    from public.staff_invitations
    where token_hash = decode(lower(p_token_hash), 'hex')
    for update;

    if not found or v_invitation.status <> 'PENDING' or v_invitation.expires_at <= statement_timestamp() then
        raise exception 'La invitación no es válida, expiró o ya fue utilizada';
    end if;

    if v_invitation.accepted_user_id is not null then
        raise exception 'La invitación ya fue utilizada';
    end if;

    if v_invitation.email is null or lower(v_invitation.email) <> v_email then
        raise exception 'El correo no coincide con la invitación';
    end if;

    if exists (
        select 1
        from public.staff_invitations other_invitation
        where other_invitation.id <> v_invitation.id
          and other_invitation.accepted_user_id = v_user_id
          and other_invitation.status = 'ACCEPTED'
    ) then
        raise exception 'El usuario ya completó otra invitación administrativa';
    end if;

    if exists (
        select 1
        from public.staff_invitations other_invitation
        where other_invitation.id <> v_invitation.id
          and other_invitation.status = 'ACCEPTED'
          and lower(other_invitation.email) = v_email
    ) then
        raise exception 'El correo ya está vinculado a otra invitación administrativa';
    end if;

    if exists (
        select 1
        from public.staff_invitations other_invitation
        where other_invitation.id <> v_invitation.id
          and other_invitation.status = 'PENDING'
          and lower(other_invitation.email) = v_email
    ) then
        raise exception 'El correo tiene otra invitación administrativa pendiente';
    end if;

    if exists (select 1 from public.profiles where id = v_user_id) then
        raise exception 'El usuario ya tiene un perfil';
    end if;

    insert into public.profiles (id, display_name)
    values (v_user_id, v_invitation.full_name)
    returning id into v_profile_id;

    update public.staff
    set profile_id = v_user_id, updated_at = statement_timestamp()
    where id = v_invitation.staff_id and profile_id is null;

    if not found then
        raise exception 'El staff ya está vinculado o no existe';
    end if;

    insert into public.user_roles (user_id, role_id, assigned_by)
    values (v_user_id, v_invitation.initial_role_id, v_user_id);

    update public.staff_invitations
    set status = 'ACCEPTED', accepted_user_id = v_user_id,
        accepted_at = statement_timestamp(), updated_at = statement_timestamp()
    where id = v_invitation.id;

    return v_profile_id;
end;
$$;

revoke all on function public.complete_staff_onboarding(text) from public, anon;
grant execute on function public.complete_staff_onboarding(text) to authenticated;

create or replace function public.regenerate_staff_invitation(
    p_invitation_id uuid,
    p_token_hash text,
    p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not app_private.current_user_has_permission('users.manage', 'ALL') then
        raise exception 'Insufficient permission to manage users';
    end if;
    update public.staff_invitations
    set token_hash = decode(lower(p_token_hash), 'hex'),
        expires_at = p_expires_at, updated_at = statement_timestamp()
    where id = p_invitation_id and status = 'PENDING';
    return found;
end;
$$;

revoke all on function public.regenerate_staff_invitation(uuid, text, timestamptz) from public, anon;
grant execute on function public.regenerate_staff_invitation(uuid, text, timestamptz) to authenticated;

create or replace function public.revoke_staff_invitation(
    p_invitation_id uuid,
    p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not app_private.current_user_has_permission('users.manage', 'ALL') then
        raise exception 'Insufficient permission to manage users';
    end if;
    if btrim(coalesce(p_reason, '')) = '' then
        raise exception 'Indica un motivo para revocar';
    end if;
    update public.staff_invitations
    set status = 'REVOKED', revoked_by = auth.uid(), revoked_at = statement_timestamp(),
        revocation_reason = btrim(p_reason), updated_at = statement_timestamp()
    where id = p_invitation_id and status = 'PENDING';
    return found;
end;
$$;

revoke all on function public.revoke_staff_invitation(uuid, text) from public, anon;
grant execute on function public.revoke_staff_invitation(uuid, text) to authenticated;

create or replace function public.set_staff_access_active(
    p_user_id uuid,
    p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not app_private.current_user_has_permission('users.manage', 'ALL') then
        raise exception 'Insufficient permission to manage users';
    end if;
    update public.profiles
    set is_active = p_is_active, updated_at = statement_timestamp()
    where id = p_user_id;
    return found;
end;
$$;

revoke all on function public.set_staff_access_active(uuid, boolean) from public, anon;
grant execute on function public.set_staff_access_active(uuid, boolean) to authenticated;
