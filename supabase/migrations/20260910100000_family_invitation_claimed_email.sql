-- Permite que el correo de la cuenta Auth sea distinto del dato de contacto
-- que existía en guardians cuando se generó la invitación.

alter table public.family_invitations
    add column if not exists claimed_email text;

create or replace function public.claim_family_invitation_email(
    p_token_hash text,
    p_email text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_invitation public.family_invitations;
    v_email text := lower(btrim(coalesce(p_email, '')));
begin
    if p_token_hash is null or p_token_hash !~ '^[0-9a-fA-F]{64}$' then
        raise exception 'Token inválido';
    end if;

    if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
        raise exception 'Correo inválido';
    end if;

    select *
    into v_invitation
    from public.family_invitations
    where token_hash = decode(lower(p_token_hash), 'hex')
    for update;

    if not found
       or v_invitation.status <> 'PENDING'
       or v_invitation.expires_at <= statement_timestamp()
       or v_invitation.revoked_at is not null
    then
        raise exception 'La invitación no es válida o ya expiró';
    end if;

    if v_invitation.claimed_email is not null
       and lower(btrim(v_invitation.claimed_email)) <> v_email
    then
        raise exception 'Esta invitación ya está asociada a otro correo';
    end if;

    if v_invitation.claimed_email is null then
        update public.family_invitations
        set claimed_email = v_email,
            updated_at = statement_timestamp()
        where id = v_invitation.id;
    end if;

    return true;
end;
$function$;

revoke all on function public.claim_family_invitation_email(text, text) from public;
grant execute on function public.claim_family_invitation_email(text, text) to anon, authenticated;

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
        count(*)
    into
        v_match_count
    from public.family_invitations fi
    where fi.status = 'PENDING'
      and fi.expires_at > statement_timestamp()
      and fi.revoked_at is null
      and fi.claimed_email is not null
      and lower(btrim(fi.claimed_email)) = v_email;

    if v_match_count = 0 then
        return jsonb_build_object(
            'status', 'NONE',
            'type', 'FAMILY'
        );
    end if;

    if v_match_count > 1 then
        raise exception 'Existe más de una invitación familiar pendiente para esta cuenta';
    end if;

    select fi.id, fi.token_hash
    into v_invitation_id, v_token_hash
    from public.family_invitations fi
    where fi.status = 'PENDING'
      and fi.expires_at > statement_timestamp()
      and fi.revoked_at is null
      and fi.claimed_email is not null
      and lower(btrim(fi.claimed_email)) = v_email;

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

revoke all on function public.complete_pending_family_onboarding() from public;
grant execute on function public.complete_pending_family_onboarding() to authenticated;
