-- ============================================================
-- H7.1A — Correcciones de gestión de categorías
-- ============================================================


-- ------------------------------------------------------------
-- 1. Renombrar categoría
-- ------------------------------------------------------------

create or replace function app_private.rename_tuition_discount_category_internal(
    p_category_id uuid,
    p_name text,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_cycle_id uuid;
    v_old_name text;
begin
    v_actor_id := auth.uid();

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    ) then
        raise exception 'Insufficient permission to configure tuition discounts';
    end if;

    if p_name is null or btrim(p_name) = '' then
        raise exception 'Category name is required';
    end if;

    if p_reason is null or btrim(p_reason) = '' then
        raise exception 'Reason is required';
    end if;

    select cycle_id, name
    into v_cycle_id, v_old_name
    from public.tuition_discount_categories
    where id = p_category_id
    for update;

    if not found then
        raise exception 'Discount category not found';
    end if;

    if lower(btrim(v_old_name)) = lower(btrim(p_name)) then
        raise exception 'Category already has this name';
    end if;

    if exists (
        select 1
        from public.tuition_discount_categories
        where cycle_id = v_cycle_id
          and id <> p_category_id
          and lower(btrim(name)) = lower(btrim(p_name))
    ) then
        raise exception 'Another discount category with this name already exists';
    end if;

    update public.tuition_discount_categories
    set
        name = btrim(p_name),
        updated_at = statement_timestamp()
    where id = p_category_id;

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
        'TUITION_DISCOUNT_CATEGORY_RENAMED',
        'tuition_discount_categories',
        p_category_id,
        jsonb_build_object('name', v_old_name),
        jsonb_build_object('name', btrim(p_name)),
        btrim(p_reason)
    );

    return p_category_id;
end;
$$;


create or replace function public.rename_tuition_discount_category(
    p_category_id uuid,
    p_name text,
    p_reason text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
    select app_private.rename_tuition_discount_category_internal(
        p_category_id,
        p_name,
        p_reason
    );
$$;


-- ------------------------------------------------------------
-- 2. Activar / desactivar categoría
-- No se elimina: se conserva historial.
-- ------------------------------------------------------------

create or replace function app_private.set_tuition_discount_category_active_internal(
    p_category_id uuid,
    p_is_active boolean,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_old_active boolean;
begin
    v_actor_id := auth.uid();

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    ) then
        raise exception 'Insufficient permission to configure tuition discounts';
    end if;

    if p_is_active is null then
        raise exception 'is_active is required';
    end if;

    if p_reason is null or btrim(p_reason) = '' then
        raise exception 'Reason is required';
    end if;

    select is_active
    into v_old_active
    from public.tuition_discount_categories
    where id = p_category_id
    for update;

    if not found then
        raise exception 'Discount category not found';
    end if;

    if v_old_active = p_is_active then
        raise exception 'Category already has this status';
    end if;

    update public.tuition_discount_categories
    set
        is_active = p_is_active,
        updated_at = statement_timestamp()
    where id = p_category_id;

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
        'TUITION_DISCOUNT_CATEGORY_STATUS_CHANGED',
        'tuition_discount_categories',
        p_category_id,
        jsonb_build_object('is_active', v_old_active),
        jsonb_build_object('is_active', p_is_active),
        btrim(p_reason)
    );

    return p_category_id;
end;
$$;


create or replace function public.set_tuition_discount_category_active(
    p_category_id uuid,
    p_is_active boolean,
    p_reason text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
    select app_private.set_tuition_discount_category_active_internal(
        p_category_id,
        p_is_active,
        p_reason
    );
$$;


-- ------------------------------------------------------------
-- 3. Permisos
-- ------------------------------------------------------------

revoke all
on function app_private.rename_tuition_discount_category_internal(uuid, text, text)
from public, anon, authenticated;

revoke all
on function app_private.set_tuition_discount_category_active_internal(uuid, boolean, text)
from public, anon, authenticated;

grant execute
on function public.rename_tuition_discount_category(uuid, text, text)
to authenticated;

grant execute
on function public.set_tuition_discount_category_active(uuid, boolean, text)
to authenticated;


-- ------------------------------------------------------------
-- 4. Corrección de valor en la MISMA fecha
--
-- Si la versión todavía no ha sido utilizada por un acuerdo
-- financiero, permitimos corregir el valor en lugar de crear
-- una segunda versión imposible en la misma fecha.
-- ------------------------------------------------------------

create or replace function app_private.correct_tuition_discount_category_version_internal(
    p_category_id uuid,
    p_value numeric,
    p_effective_on date,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_version_id uuid;
    v_discount_type text;
    v_old_value numeric;
begin
    v_actor_id := auth.uid();

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    ) then
        raise exception 'Insufficient permission to configure tuition discounts';
    end if;

    if p_value is null or p_value <= 0 then
        raise exception 'value must be greater than zero';
    end if;

    if p_reason is null or btrim(p_reason) = '' then
        raise exception 'Reason is required';
    end if;

    select
        tdcv.id,
        tdcv.value,
        tdc.discount_type
    into
        v_version_id,
        v_old_value,
        v_discount_type
    from public.tuition_discount_category_versions tdcv
    join public.tuition_discount_categories tdc
      on tdc.id = tdcv.category_id
    where tdcv.category_id = p_category_id
      and tdcv.valid_from = p_effective_on
    for update of tdcv;

    if not found then
        raise exception 'No category version starts on this date';
    end if;

    if v_discount_type = 'PERCENTAGE'
       and p_value > 100
    then
        raise exception 'Percentage discount cannot exceed 100';
    end if;

    if v_old_value = p_value then
        raise exception 'Category version already has this value';
    end if;

    -- Una vez utilizada por un acuerdo de alumno,
    -- ya forma parte del historial financiero y no se modifica.
    if exists (
        select 1
        from public.student_financial_agreements sfa
        where sfa.discount_category_version_id = v_version_id
    ) then
        raise exception
            'Category version is already in use and cannot be corrected';
    end if;

    update public.tuition_discount_category_versions
    set value = p_value
    where id = v_version_id;

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
        'TUITION_DISCOUNT_CATEGORY_VERSION_CORRECTED',
        'tuition_discount_category_versions',
        v_version_id,
        jsonb_build_object(
            'value', v_old_value,
            'valid_from', p_effective_on
        ),
        jsonb_build_object(
            'value', p_value,
            'valid_from', p_effective_on
        ),
        btrim(p_reason)
    );

    return v_version_id;
end;
$$;


create or replace function public.correct_tuition_discount_category_version(
    p_category_id uuid,
    p_value numeric,
    p_effective_on date,
    p_reason text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
    select app_private.correct_tuition_discount_category_version_internal(
        p_category_id,
        p_value,
        p_effective_on,
        p_reason
    );
$$;


revoke all
on function app_private.correct_tuition_discount_category_version_internal(
    uuid,
    numeric,
    date,
    text
)
from public, anon, authenticated;

grant execute
on function public.correct_tuition_discount_category_version(
    uuid,
    numeric,
    date,
    text
)
to authenticated;