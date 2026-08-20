-- ============================================================
-- M4.8 — Configuración financiera versionada
-- ============================================================
--
-- 1. Versionar tarifa base por:
--      ciclo + nivel + concepto
--
-- 2. Crear categoría de reducción + primera versión
--
-- 3. Crear una nueva versión de una categoría existente
--
-- No reescribe historia.
-- No toca acuerdos de alumnos.
-- No recalcula cargos automáticamente.
-- ============================================================


-- ============================================================
-- 1. SET / VERSION BASE RATE
-- ============================================================

create or replace function
app_private.set_base_rate_internal(
    p_cycle_id uuid,
    p_education_level_id uuid,
    p_financial_concept_id uuid,
    p_amount numeric,
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

    v_cycle_start date;
    v_cycle_end date;

    v_current_id uuid;
    v_current_amount numeric;
    v_current_valid_from date;

    v_new_id uuid;
    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- AUTH

    v_actor_id :=
        (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to configure base rates';
    end if;


    -- INPUT

    if p_cycle_id is null
       or p_education_level_id is null
       or p_financial_concept_id is null
    then
        raise exception
            'cycle, education level and financial concept are required';
    end if;

    if p_amount is null
       or p_amount < 0
    then
        raise exception
            'amount must be zero or greater';
    end if;

    if p_effective_on is null then
        raise exception
            'effective_on is required';
    end if;

    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Reason is required';
    end if;


    -- CYCLE

    select
        sc.starts_on,
        sc.ends_on
    into
        v_cycle_start,
        v_cycle_end
    from public.school_cycles sc
    where sc.id =
          p_cycle_id;

    if not found then
        raise exception
            'School cycle not found';
    end if;

    if p_effective_on <
       v_cycle_start
       or
       p_effective_on >
       v_cycle_end
    then
        raise exception
            'effective_on must belong to school cycle';
    end if;


    -- REFERENCES

    if not exists (
        select 1
        from public.education_levels el
        where el.id =
              p_education_level_id
    )
    then
        raise exception
            'Education level not found';
    end if;

    if not exists (
        select 1
        from public.financial_concepts fc
        where fc.id =
              p_financial_concept_id
    )
    then
        raise exception
            'Financial concept not found';
    end if;


    -- LOCK CONFIGURATION SERIES

    perform br.id
    from public.base_rates br
    where br.cycle_id =
          p_cycle_id
      and br.education_level_id =
          p_education_level_id
      and br.financial_concept_id =
          p_financial_concept_id
    order by br.valid_from
    for update;


    -- Do not insert behind an already scheduled future version.

    if exists (
        select 1
        from public.base_rates br
        where br.cycle_id =
              p_cycle_id
          and br.education_level_id =
              p_education_level_id
          and br.financial_concept_id =
              p_financial_concept_id
          and br.valid_from >
              p_effective_on
    )
    then
        raise exception
            'A future base-rate version already exists after effective_on';
    end if;


    -- CURRENT VERSION AT EFFECTIVE DATE

    select
        br.id,
        br.amount,
        br.valid_from
    into
        v_current_id,
        v_current_amount,
        v_current_valid_from
    from public.base_rates br
    where br.cycle_id =
          p_cycle_id
      and br.education_level_id =
          p_education_level_id
      and br.financial_concept_id =
          p_financial_concept_id
      and br.valid_from <=
          p_effective_on
      and (
          br.valid_until is null
          or
          br.valid_until >=
          p_effective_on
      )
    order by br.valid_from desc
    limit 1;


    if v_current_id is not null then

        if v_current_amount =
           p_amount
        then
            raise exception
                'Base rate already has this amount';
        end if;

        -- Do not rewrite the beginning of an existing version.

        if v_current_valid_from =
           p_effective_on
        then
            raise exception
                'A base-rate version already starts on effective_on';
        end if;


        update public.base_rates
        set
            valid_until =
                p_effective_on - 1,
            updated_at =
                statement_timestamp()
        where id =
              v_current_id;

    end if;


    -- NEW VERSION

    insert into public.base_rates (
        cycle_id,
        education_level_id,
        financial_concept_id,
        amount,
        valid_from,
        valid_until,
        created_by
    )
    values (
        p_cycle_id,
        p_education_level_id,
        p_financial_concept_id,
        p_amount,
        p_effective_on,
        null,
        v_actor_id
    )
    returning id
    into v_new_id;


    -- AUDIT

    insert into public.audit_log (
        actor_profile_id,
        action,
        entity_name,
        entity_id,
        old_values,
        new_values,
        reason,
        correlation_id
    )
    values (
        v_actor_id,
        'BASE_RATE_VERSION_CREATED',
        'base_rates',
        v_new_id,

        case
            when v_current_id is null then null
            else jsonb_build_object(
                'base_rate_id',
                    v_current_id,
                'amount',
                    v_current_amount,
                'valid_from',
                    v_current_valid_from,
                'valid_until',
                    p_effective_on - 1
            )
        end,

        jsonb_build_object(
            'cycle_id',
                p_cycle_id,
            'education_level_id',
                p_education_level_id,
            'financial_concept_id',
                p_financial_concept_id,
            'amount',
                p_amount,
            'valid_from',
                p_effective_on
        ),

        btrim(p_reason),
        v_correlation_id
    );


    return v_new_id;

end;
$$;



-- ============================================================
-- 2. CREATE DISCOUNT CATEGORY + FIRST VERSION
-- ============================================================

create or replace function
app_private.create_tuition_discount_category_internal(
    p_cycle_id uuid,
    p_name text,
    p_discount_type text,
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

    v_cycle_start date;
    v_cycle_end date;

    v_category_id uuid;
    v_version_id uuid;

    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- AUTH

    v_actor_id :=
        (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to configure tuition discounts';
    end if;


    -- INPUT

    if p_cycle_id is null then
        raise exception
            'cycle_id is required';
    end if;

    if p_name is null
       or btrim(p_name) = ''
    then
        raise exception
            'Category name is required';
    end if;

    if p_discount_type not in (
        'PERCENTAGE',
        'FIXED_AMOUNT'
    )
    then
        raise exception
            'discount_type must be PERCENTAGE or FIXED_AMOUNT';
    end if;

    if p_value is null
       or p_value <= 0
    then
        raise exception
            'value must be greater than zero';
    end if;

    if p_discount_type = 'PERCENTAGE'
       and p_value > 100
    then
        raise exception
            'Percentage discount cannot exceed 100';
    end if;

    if p_effective_on is null then
        raise exception
            'effective_on is required';
    end if;

    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Reason is required';
    end if;


    -- CYCLE

    select
        sc.starts_on,
        sc.ends_on
    into
        v_cycle_start,
        v_cycle_end
    from public.school_cycles sc
    where sc.id =
          p_cycle_id;

    if not found then
        raise exception
            'School cycle not found';
    end if;

    if p_effective_on <
       v_cycle_start
       or
       p_effective_on >
       v_cycle_end
    then
        raise exception
            'effective_on must belong to school cycle';
    end if;


    -- Prevent confusing duplicate active names.

    if exists (
        select 1
        from public.tuition_discount_categories tdc
        where tdc.cycle_id =
              p_cycle_id
          and lower(btrim(tdc.name)) =
              lower(btrim(p_name))
          and tdc.is_active = true
    )
    then
        raise exception
            'An active discount category with this name already exists';
    end if;


    -- CATEGORY

    insert into public.tuition_discount_categories (
        cycle_id,
        name,
        discount_type,
        is_active,
        created_by
    )
    values (
        p_cycle_id,
        btrim(p_name),
        p_discount_type,
        true,
        v_actor_id
    )
    returning id
    into v_category_id;


    -- FIRST VERSION

    insert into public.tuition_discount_category_versions (
        category_id,
        value,
        valid_from,
        valid_until,
        reason,
        created_by
    )
    values (
        v_category_id,
        p_value,
        p_effective_on,
        null,
        btrim(p_reason),
        v_actor_id
    )
    returning id
    into v_version_id;


    -- AUDIT

    insert into public.audit_log (
        actor_profile_id,
        action,
        entity_name,
        entity_id,
        old_values,
        new_values,
        reason,
        correlation_id
    )
    values (
        v_actor_id,
        'TUITION_DISCOUNT_CATEGORY_CREATED',
        'tuition_discount_categories',
        v_category_id,
        null,

        jsonb_build_object(
            'category_id',
                v_category_id,
            'version_id',
                v_version_id,
            'cycle_id',
                p_cycle_id,
            'name',
                btrim(p_name),
            'discount_type',
                p_discount_type,
            'value',
                p_value,
            'valid_from',
                p_effective_on
        ),

        btrim(p_reason),
        v_correlation_id
    );


    return v_category_id;

end;
$$;



-- ============================================================
-- 3. NEW VERSION OF EXISTING DISCOUNT CATEGORY
-- ============================================================

create or replace function
app_private.change_tuition_discount_category_version_internal(
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

    v_cycle_id uuid;
    v_discount_type text;
    v_is_active boolean;

    v_cycle_start date;
    v_cycle_end date;

    v_current_version_id uuid;
    v_current_value numeric;
    v_current_valid_from date;

    v_new_version_id uuid;

    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- AUTH

    v_actor_id :=
        (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to configure tuition discounts';
    end if;


    -- INPUT

    if p_category_id is null then
        raise exception
            'category_id is required';
    end if;

    if p_value is null
       or p_value <= 0
    then
        raise exception
            'value must be greater than zero';
    end if;

    if p_effective_on is null then
        raise exception
            'effective_on is required';
    end if;

    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Reason is required';
    end if;


    -- LOCK CATEGORY

    select
        tdc.cycle_id,
        tdc.discount_type,
        tdc.is_active,
        sc.starts_on,
        sc.ends_on

    into
        v_cycle_id,
        v_discount_type,
        v_is_active,
        v_cycle_start,
        v_cycle_end

    from public.tuition_discount_categories tdc

    join public.school_cycles sc
      on sc.id =
         tdc.cycle_id

    where tdc.id =
          p_category_id

    for update of tdc;


    if not found then
        raise exception
            'Discount category not found';
    end if;


    if not v_is_active then
        raise exception
            'Discount category is inactive';
    end if;


    if v_discount_type = 'PERCENTAGE'
       and p_value > 100
    then
        raise exception
            'Percentage discount cannot exceed 100';
    end if;


    if p_effective_on <
       v_cycle_start
       or
       p_effective_on >
       v_cycle_end
    then
        raise exception
            'effective_on must belong to category cycle';
    end if;


    -- LOCK VERSIONS

    perform tdcv.id

    from public.tuition_discount_category_versions tdcv

    where tdcv.category_id =
          p_category_id

    order by tdcv.valid_from

    for update;


    if exists (
        select 1

        from public.tuition_discount_category_versions tdcv

        where tdcv.category_id =
              p_category_id

          and tdcv.valid_from >
              p_effective_on
    )
    then
        raise exception
            'A future category version already exists after effective_on';
    end if;


    -- VERSION ACTIVE AT EFFECTIVE DATE

    select
        tdcv.id,
        tdcv.value,
        tdcv.valid_from

    into
        v_current_version_id,
        v_current_value,
        v_current_valid_from

    from public.tuition_discount_category_versions tdcv

    where tdcv.category_id =
          p_category_id

      and tdcv.valid_from <=
          p_effective_on

      and (
          tdcv.valid_until is null
          or
          tdcv.valid_until >=
          p_effective_on
      )

    order by tdcv.valid_from desc

    limit 1;


    if v_current_version_id is null then
        raise exception
            'No category version exists at effective_on';
    end if;


    if v_current_value =
       p_value
    then
        raise exception
            'Category version already has this value';
    end if;


    if v_current_valid_from =
       p_effective_on
    then
        raise exception
            'A category version already starts on effective_on';
    end if;


    -- CLOSE OLD VERSION

    update public.tuition_discount_category_versions

    set valid_until =
        p_effective_on - 1

    where id =
          v_current_version_id;


    -- CREATE NEW VERSION

    insert into public.tuition_discount_category_versions (
        category_id,
        value,
        valid_from,
        valid_until,
        reason,
        created_by
    )
    values (
        p_category_id,
        p_value,
        p_effective_on,
        null,
        btrim(p_reason),
        v_actor_id
    )
    returning id
    into v_new_version_id;


    -- AUDIT

    insert into public.audit_log (
        actor_profile_id,
        action,
        entity_name,
        entity_id,
        old_values,
        new_values,
        reason,
        correlation_id
    )
    values (
        v_actor_id,

        'TUITION_DISCOUNT_CATEGORY_VERSION_CHANGED',

        'tuition_discount_category_versions',

        v_new_version_id,

        jsonb_build_object(
            'version_id',
                v_current_version_id,
            'value',
                v_current_value,
            'valid_from',
                v_current_valid_from,
            'valid_until',
                p_effective_on - 1
        ),

        jsonb_build_object(
            'version_id',
                v_new_version_id,
            'category_id',
                p_category_id,
            'value',
                p_value,
            'valid_from',
                p_effective_on
        ),

        btrim(p_reason),

        v_correlation_id
    );


    return v_new_version_id;

end;
$$;



-- ============================================================
-- INTERNAL PRIVILEGES
-- ============================================================

revoke all
on function
app_private.set_base_rate_internal(
    uuid,
    uuid,
    uuid,
    numeric,
    date,
    text
)
from public, anon;

grant execute
on function
app_private.set_base_rate_internal(
    uuid,
    uuid,
    uuid,
    numeric,
    date,
    text
)
to authenticated;


revoke all
on function
app_private.create_tuition_discount_category_internal(
    uuid,
    text,
    text,
    numeric,
    date,
    text
)
from public, anon;

grant execute
on function
app_private.create_tuition_discount_category_internal(
    uuid,
    text,
    text,
    numeric,
    date,
    text
)
to authenticated;


revoke all
on function
app_private.change_tuition_discount_category_version_internal(
    uuid,
    numeric,
    date,
    text
)
from public, anon;

grant execute
on function
app_private.change_tuition_discount_category_version_internal(
    uuid,
    numeric,
    date,
    text
)
to authenticated;



-- ============================================================
-- PUBLIC RPC 1
-- ============================================================

create or replace function
public.set_base_rate(
    p_cycle_id uuid,
    p_education_level_id uuid,
    p_financial_concept_id uuid,
    p_amount numeric,
    p_effective_on date,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select app_private.set_base_rate_internal(
        p_cycle_id,
        p_education_level_id,
        p_financial_concept_id,
        p_amount,
        p_effective_on,
        p_reason
    );
$$;

revoke all
on function
public.set_base_rate(
    uuid,
    uuid,
    uuid,
    numeric,
    date,
    text
)
from public, anon;

grant execute
on function
public.set_base_rate(
    uuid,
    uuid,
    uuid,
    numeric,
    date,
    text
)
to authenticated;



-- ============================================================
-- PUBLIC RPC 2
-- ============================================================

create or replace function
public.create_tuition_discount_category(
    p_cycle_id uuid,
    p_name text,
    p_discount_type text,
    p_value numeric,
    p_effective_on date,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.create_tuition_discount_category_internal(
            p_cycle_id,
            p_name,
            p_discount_type,
            p_value,
            p_effective_on,
            p_reason
        );
$$;

revoke all
on function
public.create_tuition_discount_category(
    uuid,
    text,
    text,
    numeric,
    date,
    text
)
from public, anon;

grant execute
on function
public.create_tuition_discount_category(
    uuid,
    text,
    text,
    numeric,
    date,
    text
)
to authenticated;



-- ============================================================
-- PUBLIC RPC 3
-- ============================================================

create or replace function
public.change_tuition_discount_category_version(
    p_category_id uuid,
    p_value numeric,
    p_effective_on date,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.change_tuition_discount_category_version_internal(
            p_category_id,
            p_value,
            p_effective_on,
            p_reason
        );
$$;

revoke all
on function
public.change_tuition_discount_category_version(
    uuid,
    numeric,
    date,
    text
)
from public, anon;

grant execute
on function
public.change_tuition_discount_category_version(
    uuid,
    numeric,
    date,
    text
)
to authenticated;


-- ============================================================
-- FIN M4.8
-- ============================================================