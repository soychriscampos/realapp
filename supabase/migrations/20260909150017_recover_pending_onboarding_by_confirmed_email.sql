-- Recuperación de onboarding pendiente después de autenticación.
--
-- Permite que un usuario autenticado y con correo confirmado complete
-- una invitación pendiente aunque ya no conserve el token original.
--
-- La identidad se determina exclusivamente mediante:
--   auth.uid()
--   auth.users.email confirmado
--
-- No se recibe email, guardian_id, staff_id ni invitation_id desde cliente.


-- ============================================================
-- FAMILY
-- ============================================================

create or replace function public.complete_pending_family_onboarding()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_user uuid := auth.uid();
    v_email text;
    v_invitation_id uuid;
    v_token_hash bytea;
    v_match_count integer;
    v_result jsonb;
begin
    if v_user is null then
        raise exception 'Sesión requerida';
    end if;

    select lower(btrim(email))
    into v_email
    from auth.users
    where id = v_user
      and email_confirmed_at is not null;

    if v_email is null then
        raise exception 'El correo debe estar confirmado';
    end if;

    select
        count(*),
        min(fi.id),
        min(fi.token_hash)
    into
        v_match_count,
        v_invitation_id,
        v_token_hash
    from public.family_invitations fi
    join public.guardians g
      on g.id = fi.guardian_id
    where fi.status = 'PENDING'
      and fi.expires_at > statement_timestamp()
      and fi.revoked_at is null
      and lower(btrim(g.email)) = v_email;

    if v_match_count = 0 then
        return jsonb_build_object(
            'status', 'NONE',
            'type', 'FAMILY'
        );
    end if;

    if v_match_count > 1 then
        raise exception 'Existe más de una invitación familiar pendiente para esta cuenta';
    end if;

    -- Reutiliza el contrato y todas las validaciones existentes.
    v_result := public.complete_family_onboarding(
        encode(v_token_hash, 'hex')
    );

    return jsonb_build_object(
        'status', 'COMPLETED',
        'type', 'FAMILY',
        'invitation_id', v_invitation_id,
        'result', v_result
    );
end;
$function$;


-- ============================================================
-- STAFF
-- ============================================================

create or replace function public.complete_pending_staff_onboarding()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_user uuid := auth.uid();
    v_email text;
    v_invitation_id uuid;
    v_token_hash bytea;
    v_match_count integer;
    v_profile_id uuid;
begin
    if v_user is null then
        raise exception 'Sesión requerida';
    end if;

    select lower(btrim(email))
    into v_email
    from auth.users
    where id = v_user
      and email_confirmed_at is not null;

    if v_email is null then
        raise exception 'El correo debe estar confirmado';
    end if;

    select
        count(*),
        min(si.id),
        min(si.token_hash)
    into
        v_match_count,
        v_invitation_id,
        v_token_hash
    from public.staff_invitations si
    where si.status = 'PENDING'
      and si.expires_at > statement_timestamp()
      and si.revoked_at is null
      and si.accepted_user_id is null
      and lower(btrim(si.email)) = v_email;

    if v_match_count = 0 then
        return jsonb_build_object(
            'status', 'NONE',
            'type', 'STAFF'
        );
    end if;

    if v_match_count > 1 then
        raise exception 'Existe más de una invitación de personal pendiente para esta cuenta';
    end if;

    -- Reutiliza el contrato y todas las validaciones existentes.
    v_profile_id := public.complete_staff_onboarding(
        encode(v_token_hash, 'hex')
    );

    return jsonb_build_object(
        'status', 'COMPLETED',
        'type', 'STAFF',
        'invitation_id', v_invitation_id,
        'profile_id', v_profile_id
    );
end;
$function$;


-- ============================================================
-- PERMISSIONS
-- ============================================================

revoke all on function public.complete_pending_family_onboarding() from public;
revoke all on function public.complete_pending_staff_onboarding() from public;

grant execute on function public.complete_pending_family_onboarding() to authenticated;
grant execute on function public.complete_pending_staff_onboarding() to authenticated;