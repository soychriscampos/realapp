create or replace function public.create_family_invitation(
    p_guardian_id uuid,
    p_student_ids uuid[],
    p_token_hash text,
    p_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
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

    -- Lock canónico compartido con otros flujos del guardian.
    perform 1
    from public.guardians
    where id = p_guardian_id
    for update;

    if not found then
        raise exception 'Guardian no encontrado';
    end if;

    if p_student_ids is null
       or cardinality(p_student_ids) = 0
       or cardinality(p_student_ids) <> (
            select count(distinct x)
            from unnest(p_student_ids) x
       )
    then
        raise exception 'Alumnos inválidos';
    end if;

    if p_token_hash is null
       or p_token_hash !~ '^[0-9a-fA-F]{64}$'
    then
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

    -- Regla nueva:
    -- sólo puede existir una invitación PENDING vigente por guardian.
    update public.family_invitations
    set status = 'REVOKED',
        revoked_by = v_user,
        revoked_at = statement_timestamp(),
        revocation_reason = 'Reemplazada por una nueva invitación.',
        updated_at = statement_timestamp()
    where guardian_id = p_guardian_id
      and status = 'PENDING'
      and revoked_at is null;

    insert into public.family_invitations (
        guardian_id,
        token_hash,
        expires_at,
        created_by
    )
    values (
        p_guardian_id,
        decode(lower(p_token_hash), 'hex'),
        p_expires_at,
        v_user
    )
    returning id into v_invitation_id;

    insert into public.family_invitation_students (
        invitation_id,
        guardian_id,
        student_id
    )
    select
        v_invitation_id,
        p_guardian_id,
        x
    from unnest(p_student_ids) x;

    return v_invitation_id;
end;
$function$;