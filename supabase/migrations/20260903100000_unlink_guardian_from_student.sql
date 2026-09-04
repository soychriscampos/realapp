-- Desvincula un guardian de un alumno sin eliminar la persona canónica ni su cuenta.
-- La operación revoca primero el acceso de ese par alumno/guardian y conserva el historial.

create or replace function public.unlink_guardian_from_student(
    p_student_id uuid,
    p_guardian_id uuid,
    p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor uuid := auth.uid();
    v_relation_id uuid;
    v_invitation_id uuid;
    v_reason text := coalesce(
        nullif(btrim(p_reason), ''),
        'Acceso revocado por desvinculación del tutor del alumno.'
    );
    v_revoked_access_count integer := 0;
    v_revoked_invitation_count integer := 0;
    v_removed_invitation_student_count integer := 0;
    v_remaining_relation_count integer := 0;
    v_rows integer := 0;
begin
    if v_actor is null then
        raise exception 'Sesión requerida';
    end if;

    if p_student_id is null or p_guardian_id is null then
        raise exception 'Alumno y guardian son obligatorios';
    end if;

    if not app_private.current_user_has_permission('family_access.manage', 'ALL') then
        raise exception 'Insufficient permission';
    end if;

    -- Lock canónico compartido por todos los flujos que pueden autorizar
    -- o desvincular a este guardian.
    perform 1
    from public.guardians
    where id = p_guardian_id
    for update;

    if not found then
        raise exception 'Guardian no encontrado';
    end if;

    select id
    into v_relation_id
    from public.student_guardians
    where student_id = p_student_id
      and guardian_id = p_guardian_id
      and is_active
    for update;

    if v_relation_id is null then
        raise exception 'El guardian no tiene una relación activa con el alumno';
    end if;

    update public.family_access
    set status = 'REVOKED',
        revoked_at = statement_timestamp(),
        revoked_by = v_actor,
        revocation_reason = v_reason,
        updated_at = statement_timestamp()
    where guardian_id = p_guardian_id
      and student_id = p_student_id
      and status = 'ACTIVE';

    get diagnostics v_revoked_access_count = row_count;

    -- Una invitación puede incluir hermanos. Sólo se revoca completa cuando
    -- ya no conserva ningún otro alumno con relación activa. En caso contrario
    -- se retira únicamente la pertenencia de este alumno.
    for v_invitation_id in
        select distinct i.id
        from public.family_invitations i
        join public.family_invitation_students fis
          on fis.invitation_id = i.id
         and fis.guardian_id = p_guardian_id
         and fis.student_id = p_student_id
        where i.guardian_id = p_guardian_id
          and i.status = 'PENDING'
    loop
        perform 1
        from public.family_invitations
        where id = v_invitation_id
          and status = 'PENDING'
        for update;

        if not found then
            continue;
        end if;

        if not exists (
            select 1
            from public.family_invitation_students other_fis
            join public.student_guardians other_sg
              on other_sg.student_id = other_fis.student_id
             and other_sg.guardian_id = other_fis.guardian_id
             and other_sg.is_active
            where other_fis.invitation_id = v_invitation_id
              and other_fis.guardian_id = p_guardian_id
              and other_fis.student_id <> p_student_id
        ) then
            update public.family_invitations
            set status = 'REVOKED',
                revoked_by = v_actor,
                revoked_at = statement_timestamp(),
                revocation_reason = v_reason,
                updated_at = statement_timestamp()
            where id = v_invitation_id
              and status = 'PENDING';

            get diagnostics v_rows = row_count;
            v_revoked_invitation_count := v_revoked_invitation_count + v_rows;
        else
            delete from public.family_invitation_students
            where invitation_id = v_invitation_id
              and guardian_id = p_guardian_id
              and student_id = p_student_id;

            get diagnostics v_rows = row_count;
            v_removed_invitation_student_count := v_removed_invitation_student_count + v_rows;
        end if;
    end loop;

    update public.student_guardians
    set is_active = false,
        ended_at = current_date,
        updated_at = statement_timestamp()
    where id = v_relation_id
      and is_active;

    if not found then
        raise exception 'La relación del tutor ya no está activa';
    end if;

    select count(*)
    into v_remaining_relation_count
    from public.student_guardians
    where guardian_id = p_guardian_id
      and is_active;

    return jsonb_build_object(
        'student_id', p_student_id,
        'guardian_id', p_guardian_id,
        'relation_ended', true,
        'family_access_revoked_count', v_revoked_access_count,
        'invitations_revoked_count', v_revoked_invitation_count,
        'invitation_students_removed_count', v_removed_invitation_student_count,
        'remaining_active_student_count', v_remaining_relation_count
    );
end;
$$;

revoke all on function public.unlink_guardian_from_student(uuid, uuid, text) from public, anon;
grant execute on function public.unlink_guardian_from_student(uuid, uuid, text) to authenticated;

-- El alta de una invitación debe serializarse con la desvinculación y el onboarding
-- sobre el mismo guardian, aunque la invitación todavía no cree family_access.
create or replace function public.create_family_invitation(
    p_guardian_id uuid,
    p_student_ids uuid[],
    p_token_hash text,
    p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_invitation_id uuid;
    v_user uuid := auth.uid();
    v_student_id uuid;
begin
    if v_user is null then
        raise exception 'Sesión requerida';
    end if;

    if not app_private.current_user_has_permission('family_access.manage', 'ALL') then
        raise exception 'Insufficient permission';
    end if;

    -- Lock canónico compartido con unlink_guardian_from_student y
    -- complete_family_onboarding.
    perform 1
    from public.guardians
    where id = p_guardian_id
    for update;

    if not found then
        raise exception 'Guardian no encontrado';
    end if;

    if p_student_ids is null
       or cardinality(p_student_ids) = 0
       or cardinality(p_student_ids) <> (select count(distinct x) from unnest(p_student_ids) x)
    then
        raise exception 'Alumnos inválidos';
    end if;

    if p_token_hash is null or p_token_hash !~ '^[0-9a-fA-F]{64}$' then
        raise exception 'Token inválido';
    end if;

    if p_expires_at <= statement_timestamp() then
        raise exception 'La invitación debe tener una fecha futura';
    end if;

    foreach v_student_id in array p_student_ids loop
        if not exists (
            select 1
            from public.student_guardians
            where student_id = v_student_id
              and guardian_id = p_guardian_id
              and is_active
        ) then
            raise exception 'El guardian no está relacionado con todos los alumnos seleccionados';
        end if;
    end loop;

    insert into public.family_invitations (guardian_id, token_hash, expires_at, created_by)
    values (p_guardian_id, decode(lower(p_token_hash), 'hex'), p_expires_at, v_user)
    returning id into v_invitation_id;

    insert into public.family_invitation_students (invitation_id, guardian_id, student_id)
    select v_invitation_id, p_guardian_id, x
    from unnest(p_student_ids) x;

    return v_invitation_id;
end;
$$;

revoke all on function public.create_family_invitation(uuid, uuid[], text, timestamptz) from public, anon;
grant execute on function public.create_family_invitation(uuid, uuid[], text, timestamptz) to authenticated;

-- El onboarding toma el mismo lock canónico y en el mismo orden que la
-- desvinculación: guardian antes de validar/crear autorizaciones.
create or replace function public.complete_family_onboarding(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_invitation public.family_invitations%rowtype;
    v_guardian public.guardians%rowtype;
    v_guardian_id uuid;
    v_user uuid := auth.uid();
    v_profile uuid;
    v_role uuid;
    v_student uuid;
    v_email text;
    v_count integer;
begin
    if v_user is null then
        raise exception 'Sesión requerida';
    end if;

    -- El token sólo se usa para localizar el guardian. La fila de la
    -- invitación se bloquea después, manteniendo guardian como primer lock.
    select guardian_id
    into v_guardian_id
    from public.family_invitations
    where token_hash = decode(lower(p_token_hash), 'hex');

    if v_guardian_id is null then
        raise exception 'Invitación no válida, vencida o utilizada';
    end if;

    select *
    into v_guardian
    from public.guardians
    where id = v_guardian_id
    for update;

    if not found then
        raise exception 'Guardian no encontrado';
    end if;

    select *
    into v_invitation
    from public.family_invitations
    where token_hash = decode(lower(p_token_hash), 'hex')
    for update;

    if not found
       or v_invitation.status <> 'PENDING'
       or v_invitation.expires_at <= statement_timestamp()
    then
        raise exception 'Invitación no válida, vencida o utilizada';
    end if;

    if v_guardian.auth_user_id is not null and v_guardian.auth_user_id <> v_user then
        raise exception 'El guardian ya está vinculado a otra cuenta';
    end if;

    if exists (
        select 1
        from public.guardians
        where auth_user_id = v_user
          and id <> v_guardian.id
    ) then
        raise exception 'La cuenta ya está vinculada a otro guardian';
    end if;

    select lower(btrim(email))
    into v_email
    from auth.users
    where id = v_user
      and email_confirmed_at is not null;

    if v_email is null then
        raise exception 'El correo debe estar confirmado';
    end if;

    for v_student in
        select fis.student_id
        from public.family_invitation_students fis
        where fis.invitation_id = v_invitation.id
    loop
        if not exists (
            select 1
            from public.student_guardians
            where student_id = v_student
              and guardian_id = v_guardian.id
              and is_active
        ) then
            raise exception 'La invitación ya no tiene relaciones activas con todos los alumnos';
        end if;

        perform 1
        from public.students
        where id = v_student
        for update;

        select count(distinct guardian_id)
        into v_count
        from public.family_access
        where student_id = v_student
          and status = 'ACTIVE'
          and guardian_id <> v_guardian.id;

        if v_count >= 2 then
            raise exception 'El alumno ya tiene el máximo de accesos familiares';
        end if;
    end loop;

    select id
    into v_profile
    from public.profiles
    where id = v_user;

    if v_profile is null then
        insert into public.profiles (id, display_name)
        values (v_user, v_guardian.full_name)
        returning id into v_profile;
    end if;

    update public.guardians
    set auth_user_id = v_user,
        email = v_email,
        updated_at = statement_timestamp()
    where id = v_guardian.id;

    select id
    into v_role
    from public.roles
    where code = 'TUTOR'
      and is_active;

    if v_role is null then
        raise exception 'Rol TUTOR no encontrado';
    end if;

    if not exists (
        select 1
        from public.user_roles
        where user_id = v_user
          and role_id = v_role
          and valid_until is null
    ) then
        insert into public.user_roles (user_id, role_id, assigned_by)
        values (v_user, v_role, v_invitation.created_by);
    end if;

    insert into public.family_access (guardian_id, student_id, invitation_id, granted_by)
    select v_guardian.id, fis.student_id, v_invitation.id, v_invitation.created_by
    from public.family_invitation_students fis
    where fis.invitation_id = v_invitation.id
      and not exists (
          select 1
          from public.family_access fa
          where fa.guardian_id = v_guardian.id
            and fa.student_id = fis.student_id
            and fa.status = 'ACTIVE'
      );

    update public.family_invitations
    set status = 'ACCEPTED',
        accepted_by = v_profile,
        accepted_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where id = v_invitation.id;

    return jsonb_build_object(
        'guardian_id', v_guardian.id,
        'student_count', (
            select count(*)
            from public.family_invitation_students
            where invitation_id = v_invitation.id
        )
    );
end;
$$;

revoke all on function public.complete_family_onboarding(text) from public, anon;
grant execute on function public.complete_family_onboarding(text) to authenticated;
