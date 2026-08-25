-- ============================================================
-- H7.3A — CREAR CAMPAÑA DE PREINSCRIPCIÓN
--
-- Permite fechas retroactivas.
-- La única regla temporal aquí es:
-- ends_on >= starts_on
-- ============================================================

create or replace function app_private.create_preregistration_campaign_internal(
    p_target_cycle_id uuid,
    p_education_level_id uuid,
    p_name text,
    p_starts_on date,
    p_ends_on date,
    p_price numeric,
    p_covered_concept_id uuid,
    p_allows_partial_payments boolean default false,
    p_non_continuation_policy text default 'MANUAL_REVIEW',
    p_status text default 'DRAFT'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_campaign_id uuid;
begin

    -- AUTH
    v_actor_id := auth.uid();

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    ) then
        raise exception
            'Insufficient permission to create preregistration campaign';
    end if;


    -- INPUT
    if p_target_cycle_id is null then
        raise exception 'target_cycle_id is required';
    end if;

    if p_name is null
       or btrim(p_name) = ''
    then
        raise exception 'Campaign name is required';
    end if;

    if p_starts_on is null
       or p_ends_on is null
    then
        raise exception 'Campaign dates are required';
    end if;

    if p_ends_on < p_starts_on then
        raise exception
            'Campaign end date cannot be before start date';
    end if;

    if p_price is null
       or p_price < 0
    then
        raise exception
            'Campaign price must be zero or greater';
    end if;

    if p_non_continuation_policy not in (
        'NON_REFUNDABLE',
        'REFUNDABLE',
        'TRANSFERABLE',
        'REASSIGNABLE',
        'MANUAL_REVIEW'
    ) then
        raise exception
            'Invalid non continuation policy';
    end if;

    if p_status not in (
        'DRAFT',
        'ACTIVE'
    ) then
        raise exception
            'New campaign status must be DRAFT or ACTIVE';
    end if;


    -- VALIDATE CYCLE
    if not exists (
        select 1
        from public.school_cycles sc
        where sc.id = p_target_cycle_id
    ) then
        raise exception 'Target cycle not found';
    end if;


    -- VALIDATE LEVEL
    if p_education_level_id is not null
       and not exists (
           select 1
           from public.education_levels el
           where el.id = p_education_level_id
       )
    then
        raise exception 'Education level not found';
    end if;


    -- VALIDATE COVERED CONCEPT
    if p_covered_concept_id is not null
       and not exists (
           select 1
           from public.financial_concepts fc
           where fc.id = p_covered_concept_id
             and fc.is_active = true
       )
    then
        raise exception
            'Covered financial concept not found or inactive';
    end if;


    -- CREATE
    insert into public.preregistration_campaigns (
        target_cycle_id,
        education_level_id,
        name,
        starts_on,
        ends_on,
        price,
        covered_concept_id,
        allows_partial_payments,
        non_continuation_policy,
        status,
        created_by
    )
    values (
        p_target_cycle_id,
        p_education_level_id,
        btrim(p_name),
        p_starts_on,
        p_ends_on,
        p_price,
        p_covered_concept_id,
        coalesce(p_allows_partial_payments, false),
        p_non_continuation_policy,
        p_status,
        v_actor_id
    )
    returning id
    into v_campaign_id;


    -- AUDIT
    insert into public.audit_log (
        actor_profile_id,
        action,
        entity_name,
        entity_id,
        old_values,
        new_values,
        reason
    )
    values (
        v_actor_id,
        'PREREGISTRATION_CAMPAIGN_CREATED',
        'preregistration_campaigns',
        v_campaign_id,
        null,
        jsonb_build_object(
            'target_cycle_id', p_target_cycle_id,
            'education_level_id', p_education_level_id,
            'name', btrim(p_name),
            'starts_on', p_starts_on,
            'ends_on', p_ends_on,
            'price', p_price,
            'covered_concept_id', p_covered_concept_id,
            'allows_partial_payments',
                coalesce(p_allows_partial_payments, false),
            'non_continuation_policy',
                p_non_continuation_policy,
            'status', p_status
        ),
        'Creación de campaña de preinscripción'
    );


    return v_campaign_id;

end;
$$;


create or replace function public.create_preregistration_campaign(
    p_target_cycle_id uuid,
    p_education_level_id uuid,
    p_name text,
    p_starts_on date,
    p_ends_on date,
    p_price numeric,
    p_covered_concept_id uuid,
    p_allows_partial_payments boolean default false,
    p_non_continuation_policy text default 'MANUAL_REVIEW',
    p_status text default 'DRAFT'
)
returns uuid
language sql
security definer
set search_path = ''
as $$
    select app_private.create_preregistration_campaign_internal(
        p_target_cycle_id,
        p_education_level_id,
        p_name,
        p_starts_on,
        p_ends_on,
        p_price,
        p_covered_concept_id,
        p_allows_partial_payments,
        p_non_continuation_policy,
        p_status
    );
$$;


revoke all
on function app_private.create_preregistration_campaign_internal(
    uuid,
    uuid,
    text,
    date,
    date,
    numeric,
    uuid,
    boolean,
    text,
    text
)
from public, anon, authenticated;


revoke all
on function public.create_preregistration_campaign(
    uuid,
    uuid,
    text,
    date,
    date,
    numeric,
    uuid,
    boolean,
    text,
    text
)
from public, anon;


grant execute
on function public.create_preregistration_campaign(
    uuid,
    uuid,
    text,
    date,
    date,
    numeric,
    uuid,
    boolean,
    text,
    text
)
to authenticated;