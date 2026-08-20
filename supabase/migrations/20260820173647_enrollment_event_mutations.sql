-- ============================================================
-- M6.1 — Historial transaccional de matrícula
-- ============================================================
--
-- enrollment_events ya existe.
--
-- Esta migración:
--
-- 1. Registra automáticamente ENROLLED en nuevas matrículas.
-- 2. Añade activación administrativa.
-- 3. Añade cambio de grupo.
-- 4. Añade cambio de clasificación.
-- 5. Añade reactivación administrativa.
-- 6. Da lectura administrativa a enrollment_events.
--
-- WITHDRAWN NO se duplica:
-- process_financial_withdrawal(...) ya:
--   - cambia enrollment a BAJA
--   - crea enrollment_event WITHDRAWN
--
-- IMPORTANTE:
-- reactivación administrativa NO reinicia obligaciones
-- financieras automáticamente.
--
-- ============================================================


-- ============================================================
-- 1. EVENTOS: LECTURA ADMINISTRATIVA
-- ============================================================

alter table public.enrollment_events
enable row level security;


drop policy if exists
enrollment_events_select_all
on public.enrollment_events;


create policy
enrollment_events_select_all
on public.enrollment_events
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'enrollments.view',
        'ALL'
    )
);


grant select
on public.enrollment_events
to authenticated;



-- ============================================================
-- 2. HELPER PRIVADO PARA INSERTAR EVENTOS
-- ============================================================

create or replace function
app_private.record_enrollment_event_internal(
    p_enrollment_id uuid,
    p_event_type text,
    p_effective_on date,
    p_reason text,
    p_old_values jsonb,
    p_new_values jsonb,
    p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_event_id uuid;
begin

    insert into public.enrollment_events (
        enrollment_id,
        event_type,
        effective_on,
        reason,
        notes,
        old_values,
        new_values,
        created_by
    )
    values (
        p_enrollment_id,
        p_event_type,
        p_effective_on,
        nullif(
            btrim(p_reason),
            ''
        ),
        null,
        p_old_values,
        p_new_values,
        p_actor_id
    )
    returning id
    into v_event_id;


    return v_event_id;

end;
$$;


revoke all
on function
app_private.record_enrollment_event_internal(
    uuid,
    text,
    date,
    text,
    jsonb,
    jsonb,
    uuid
)
from public, anon, authenticated;



-- ============================================================
-- 3. NUEVA MATRÍCULA -> ENROLLED AUTOMÁTICO
-- ============================================================

create or replace function
app_private.record_new_enrollment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

    perform
        app_private.record_enrollment_event_internal(
            new.id,
            'ENROLLED',
            new.enrolled_on,
            'Enrollment created',
            null,

            jsonb_build_object(
                'status',
                    new.status,

                'grade_level_id',
                    new.grade_level_id,

                'group_id',
                    new.group_id,

                'classification_id',
                    new.classification_id,

                'enrolled_on',
                    new.enrolled_on,

                'classes_start_on',
                    new.classes_start_on
            ),

            new.created_by
        );


    return new;

end;
$$;


drop trigger if exists
enrollments_record_created_event
on public.enrollments;


create trigger
enrollments_record_created_event
after insert
on public.enrollments
for each row
execute function
app_private.record_new_enrollment_event();



-- ============================================================
-- 4. ACTIVAR MATRÍCULA
-- ============================================================

create or replace function
app_private.activate_enrollment_internal(
    p_enrollment_id uuid,
    p_activated_on date,
    p_group_id uuid,
    p_classes_start_on date,
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
    v_grade_level_id uuid;

    v_cycle_start date;
    v_cycle_end date;

    v_old_status text;
    v_old_group_id uuid;
    v_old_classes_start_on date;

    v_event_id uuid;
    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- ========================================================
    -- AUTH
    -- ========================================================

    v_actor_id :=
        (select auth.uid());


    if v_actor_id is null then
        raise exception
            'Authentication required';
    end if;


    if not app_private.current_user_is_active() then
        raise exception
            'Inactive user';
    end if;


    if not app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to activate enrollment';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_enrollment_id is null then
        raise exception
            'enrollment_id is required';
    end if;


    if p_activated_on is null then
        raise exception
            'activated_on is required';
    end if;


    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Reason is required';
    end if;


    -- ========================================================
    -- LOCK
    -- ========================================================

    select
        e.cycle_id,
        e.grade_level_id,

        e.status,
        e.group_id,
        e.classes_start_on,

        sc.starts_on,
        sc.ends_on

    into
        v_cycle_id,
        v_grade_level_id,

        v_old_status,
        v_old_group_id,
        v_old_classes_start_on,

        v_cycle_start,
        v_cycle_end

    from public.enrollments e

    join public.school_cycles sc
      on sc.id =
         e.cycle_id

    where e.id =
          p_enrollment_id

    for update of e;


    if not found then
        raise exception
            'Enrollment not found';
    end if;


    if v_old_status not in (
        'PREINSCRITA',
        'PENDIENTE'
    )
    then
        raise exception
            'Only PREINSCRITA or PENDIENTE enrollment can be activated';
    end if;


    if p_activated_on <
       v_cycle_start
       or
       p_activated_on >
       v_cycle_end
    then
        raise exception
            'activated_on must belong to enrollment cycle';
    end if;


    if p_classes_start_on is not null
       and (
           p_classes_start_on < v_cycle_start
           or
           p_classes_start_on > v_cycle_end
       )
    then
        raise exception
            'classes_start_on must belong to enrollment cycle';
    end if;


    -- ========================================================
    -- GROUP VALIDATION
    -- ========================================================

    if p_group_id is not null
       and not exists (
           select 1

           from public.groups g

           where g.id =
                 p_group_id

             and g.cycle_id =
                 v_cycle_id

             and g.grade_level_id =
                 v_grade_level_id

             and g.is_active = true
       )
    then
        raise exception
            'Group does not belong to enrollment cycle and grade';
    end if;


    -- ========================================================
    -- UPDATE CURRENT STATE
    -- ========================================================

    update public.enrollments
    set
        status =
            'ACTIVA',

        group_id =
            coalesce(
                p_group_id,
                group_id
            ),

        classes_start_on =
            coalesce(
                p_classes_start_on,
                classes_start_on
            ),

        closed_on =
            null,

        updated_at =
            statement_timestamp()

    where id =
          p_enrollment_id;


    -- ========================================================
    -- EVENT
    -- ========================================================

    v_event_id :=
        app_private.record_enrollment_event_internal(
            p_enrollment_id,

            'ACTIVATED',

            p_activated_on,

            p_reason,

            jsonb_build_object(
                'status',
                    v_old_status,

                'group_id',
                    v_old_group_id,

                'classes_start_on',
                    v_old_classes_start_on
            ),

            jsonb_build_object(
                'status',
                    'ACTIVA',

                'group_id',
                    coalesce(
                        p_group_id,
                        v_old_group_id
                    ),

                'classes_start_on',
                    coalesce(
                        p_classes_start_on,
                        v_old_classes_start_on
                    )
            ),

            v_actor_id
        );


    -- ========================================================
    -- AUDIT
    -- ========================================================

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

        'ENROLLMENT_ACTIVATED',

        'enrollments',

        p_enrollment_id,

        jsonb_build_object(
            'status',
                v_old_status,
            'group_id',
                v_old_group_id,
            'classes_start_on',
                v_old_classes_start_on
        ),

        jsonb_build_object(
            'status',
                'ACTIVA',
            'group_id',
                coalesce(
                    p_group_id,
                    v_old_group_id
                ),
            'classes_start_on',
                coalesce(
                    p_classes_start_on,
                    v_old_classes_start_on
                ),
            'event_id',
                v_event_id
        ),

        btrim(p_reason),

        v_correlation_id
    );


    return v_event_id;

end;
$$;



-- ============================================================
-- 5. CAMBIO DE GRUPO
-- ============================================================

create or replace function
app_private.change_enrollment_group_internal(
    p_enrollment_id uuid,
    p_group_id uuid,
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
    v_grade_level_id uuid;
    v_status text;
    v_old_group_id uuid;

    v_cycle_start date;
    v_cycle_end date;

    v_event_id uuid;
    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- AUTH

    v_actor_id :=
        (select auth.uid());


    if v_actor_id is null then
        raise exception
            'Authentication required';
    end if;


    if not app_private.current_user_is_active() then
        raise exception
            'Inactive user';
    end if;


    if not app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to change enrollment group';
    end if;


    -- INPUT

    if p_enrollment_id is null then
        raise exception
            'enrollment_id is required';
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


    -- LOCK

    select
        e.cycle_id,
        e.grade_level_id,
        e.status,
        e.group_id,
        sc.starts_on,
        sc.ends_on

    into
        v_cycle_id,
        v_grade_level_id,
        v_status,
        v_old_group_id,
        v_cycle_start,
        v_cycle_end

    from public.enrollments e

    join public.school_cycles sc
      on sc.id =
         e.cycle_id

    where e.id =
          p_enrollment_id

    for update of e;


    if not found then
        raise exception
            'Enrollment not found';
    end if;


    if v_status in (
        'BAJA',
        'FINALIZADA',
        'NO_CONTINUA',
        'EGRESADA'
    )
    then
        raise exception
            'Closed enrollment cannot change group';
    end if;


    if p_effective_on <
       v_cycle_start
       or
       p_effective_on >
       v_cycle_end
    then
        raise exception
            'effective_on must belong to enrollment cycle';
    end if;


    if p_group_id is not null
       and not exists (
           select 1

           from public.groups g

           where g.id =
                 p_group_id

             and g.cycle_id =
                 v_cycle_id

             and g.grade_level_id =
                 v_grade_level_id

             and g.is_active = true
       )
    then
        raise exception
            'Group does not belong to enrollment cycle and grade';
    end if;


    if v_old_group_id is not distinct from
       p_group_id
    then
        raise exception
            'Enrollment is already assigned to requested group';
    end if;


    update public.enrollments
    set
        group_id =
            p_group_id,

        updated_at =
            statement_timestamp()

    where id =
          p_enrollment_id;


    v_event_id :=
        app_private.record_enrollment_event_internal(
            p_enrollment_id,

            'GROUP_CHANGED',

            p_effective_on,

            p_reason,

            jsonb_build_object(
                'group_id',
                    v_old_group_id
            ),

            jsonb_build_object(
                'group_id',
                    p_group_id
            ),

            v_actor_id
        );


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
        'ENROLLMENT_GROUP_CHANGED',
        'enrollments',
        p_enrollment_id,

        jsonb_build_object(
            'group_id',
                v_old_group_id
        ),

        jsonb_build_object(
            'group_id',
                p_group_id,
            'event_id',
                v_event_id
        ),

        btrim(p_reason),
        v_correlation_id
    );


    return v_event_id;

end;
$$;



-- ============================================================
-- 6. CAMBIO DE CLASIFICACIÓN
-- ============================================================

create or replace function
app_private.change_enrollment_classification_internal(
    p_enrollment_id uuid,
    p_classification_id uuid,
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

    v_status text;
    v_old_classification_id uuid;

    v_event_id uuid;
    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- AUTH

    v_actor_id :=
        (select auth.uid());


    if v_actor_id is null then
        raise exception
            'Authentication required';
    end if;


    if not app_private.current_user_is_active() then
        raise exception
            'Inactive user';
    end if;


    if not app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to change enrollment classification';
    end if;


    -- INPUT

    if p_enrollment_id is null
       or p_classification_id is null
    then
        raise exception
            'enrollment_id and classification_id are required';
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


    if not exists (
        select 1

        from public.enrollment_classifications ec

        where ec.id =
              p_classification_id
    )
    then
        raise exception
            'Enrollment classification not found';
    end if;


    -- LOCK

    select
        e.status,
        e.classification_id,
        sc.starts_on,
        sc.ends_on

    into
        v_status,
        v_old_classification_id,
        v_cycle_start,
        v_cycle_end

    from public.enrollments e

    join public.school_cycles sc
      on sc.id =
         e.cycle_id

    where e.id =
          p_enrollment_id

    for update of e;


    if not found then
        raise exception
            'Enrollment not found';
    end if;


    if v_status in (
        'BAJA',
        'FINALIZADA',
        'NO_CONTINUA',
        'EGRESADA'
    )
    then
        raise exception
            'Closed enrollment cannot change classification';
    end if;


    if p_effective_on <
       v_cycle_start
       or
       p_effective_on >
       v_cycle_end
    then
        raise exception
            'effective_on must belong to enrollment cycle';
    end if;


    if v_old_classification_id =
       p_classification_id
    then
        raise exception
            'Enrollment already has requested classification';
    end if;


    update public.enrollments
    set
        classification_id =
            p_classification_id,

        updated_at =
            statement_timestamp()

    where id =
          p_enrollment_id;


    v_event_id :=
        app_private.record_enrollment_event_internal(
            p_enrollment_id,

            'CLASSIFICATION_CHANGED',

            p_effective_on,

            p_reason,

            jsonb_build_object(
                'classification_id',
                    v_old_classification_id
            ),

            jsonb_build_object(
                'classification_id',
                    p_classification_id
            ),

            v_actor_id
        );


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
        'ENROLLMENT_CLASSIFICATION_CHANGED',
        'enrollments',
        p_enrollment_id,

        jsonb_build_object(
            'classification_id',
                v_old_classification_id
        ),

        jsonb_build_object(
            'classification_id',
                p_classification_id,
            'event_id',
                v_event_id
        ),

        btrim(p_reason),
        v_correlation_id
    );


    return v_event_id;

end;
$$;



-- ============================================================
-- 7. REACTIVACIÓN ADMINISTRATIVA
-- ============================================================

create or replace function
app_private.reactivate_enrollment_internal(
    p_enrollment_id uuid,
    p_reactivated_on date,
    p_group_id uuid,
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
    v_grade_level_id uuid;

    v_cycle_start date;
    v_cycle_end date;

    v_old_status text;
    v_old_group_id uuid;
    v_old_closed_on date;

    v_event_id uuid;
    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- AUTH

    v_actor_id :=
        (select auth.uid());


    if v_actor_id is null then
        raise exception
            'Authentication required';
    end if;


    if not app_private.current_user_is_active() then
        raise exception
            'Inactive user';
    end if;


    if not app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to reactivate enrollment';
    end if;


    -- INPUT

    if p_enrollment_id is null then
        raise exception
            'enrollment_id is required';
    end if;


    if p_reactivated_on is null then
        raise exception
            'reactivated_on is required';
    end if;


    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Reason is required';
    end if;


    -- LOCK

    select
        e.cycle_id,
        e.grade_level_id,
        e.status,
        e.group_id,
        e.closed_on,

        sc.starts_on,
        sc.ends_on

    into
        v_cycle_id,
        v_grade_level_id,
        v_old_status,
        v_old_group_id,
        v_old_closed_on,

        v_cycle_start,
        v_cycle_end

    from public.enrollments e

    join public.school_cycles sc
      on sc.id =
         e.cycle_id

    where e.id =
          p_enrollment_id

    for update of e;


    if not found then
        raise exception
            'Enrollment not found';
    end if;


    if v_old_status <>
       'BAJA'
    then
        raise exception
            'Only BAJA enrollment can be reactivated';
    end if;


    if p_reactivated_on <
       v_cycle_start
       or
       p_reactivated_on >
       v_cycle_end
    then
        raise exception
            'reactivated_on must belong to enrollment cycle';
    end if;


    if v_old_closed_on is not null
       and p_reactivated_on <
           v_old_closed_on
    then
        raise exception
            'reactivated_on cannot precede withdrawal date';
    end if;


    -- GROUP

    if p_group_id is not null
       and not exists (
           select 1

           from public.groups g

           where g.id =
                 p_group_id

             and g.cycle_id =
                 v_cycle_id

             and g.grade_level_id =
                 v_grade_level_id

             and g.is_active = true
       )
    then
        raise exception
            'Group does not belong to enrollment cycle and grade';
    end if;


    -- ADMINISTRATIVE REACTIVATION ONLY.
    --
    -- Deliberately does not recreate financial-plan
    -- assignments or charges.

    update public.enrollments
    set
        status =
            'ACTIVA',

        group_id =
            coalesce(
                p_group_id,
                group_id
            ),

        closed_on =
            null,

        updated_at =
            statement_timestamp()

    where id =
          p_enrollment_id;


    v_event_id :=
        app_private.record_enrollment_event_internal(
            p_enrollment_id,

            'REACTIVATED',

            p_reactivated_on,

            p_reason,

            jsonb_build_object(
                'status',
                    v_old_status,

                'group_id',
                    v_old_group_id,

                'closed_on',
                    v_old_closed_on
            ),

            jsonb_build_object(
                'status',
                    'ACTIVA',

                'group_id',
                    coalesce(
                        p_group_id,
                        v_old_group_id
                    ),

                'closed_on',
                    null
            ),

            v_actor_id
        );


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
        'ENROLLMENT_REACTIVATED',
        'enrollments',
        p_enrollment_id,

        jsonb_build_object(
            'status',
                v_old_status,

            'group_id',
                v_old_group_id,

            'closed_on',
                v_old_closed_on
        ),

        jsonb_build_object(
            'status',
                'ACTIVA',

            'group_id',
                coalesce(
                    p_group_id,
                    v_old_group_id
                ),

            'closed_on',
                null,

            'event_id',
                v_event_id,

            'financial_reactivation',
                false
        ),

        btrim(p_reason),
        v_correlation_id
    );


    return v_event_id;

end;
$$;



-- ============================================================
-- INTERNAL PRIVILEGES
-- ============================================================

revoke all
on function
app_private.activate_enrollment_internal(
    uuid,
    date,
    uuid,
    date,
    text
)
from public, anon;

grant execute
on function
app_private.activate_enrollment_internal(
    uuid,
    date,
    uuid,
    date,
    text
)
to authenticated;


revoke all
on function
app_private.change_enrollment_group_internal(
    uuid,
    uuid,
    date,
    text
)
from public, anon;

grant execute
on function
app_private.change_enrollment_group_internal(
    uuid,
    uuid,
    date,
    text
)
to authenticated;


revoke all
on function
app_private.change_enrollment_classification_internal(
    uuid,
    uuid,
    date,
    text
)
from public, anon;

grant execute
on function
app_private.change_enrollment_classification_internal(
    uuid,
    uuid,
    date,
    text
)
to authenticated;


revoke all
on function
app_private.reactivate_enrollment_internal(
    uuid,
    date,
    uuid,
    text
)
from public, anon;

grant execute
on function
app_private.reactivate_enrollment_internal(
    uuid,
    date,
    uuid,
    text
)
to authenticated;



-- ============================================================
-- PUBLIC WRAPPERS
-- ============================================================

create or replace function
public.activate_enrollment(
    p_enrollment_id uuid,
    p_activated_on date,
    p_group_id uuid default null,
    p_classes_start_on date default null,
    p_reason text default null
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.activate_enrollment_internal(
            p_enrollment_id,
            p_activated_on,
            p_group_id,
            p_classes_start_on,
            p_reason
        );
$$;


create or replace function
public.change_enrollment_group(
    p_enrollment_id uuid,
    p_group_id uuid,
    p_effective_on date,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.change_enrollment_group_internal(
            p_enrollment_id,
            p_group_id,
            p_effective_on,
            p_reason
        );
$$;


create or replace function
public.change_enrollment_classification(
    p_enrollment_id uuid,
    p_classification_id uuid,
    p_effective_on date,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.change_enrollment_classification_internal(
            p_enrollment_id,
            p_classification_id,
            p_effective_on,
            p_reason
        );
$$;


create or replace function
public.reactivate_enrollment(
    p_enrollment_id uuid,
    p_reactivated_on date,
    p_group_id uuid default null,
    p_reason text default null
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.reactivate_enrollment_internal(
            p_enrollment_id,
            p_reactivated_on,
            p_group_id,
            p_reason
        );
$$;



-- ============================================================
-- PUBLIC PRIVILEGES
-- ============================================================

revoke all
on function
public.activate_enrollment(
    uuid,
    date,
    uuid,
    date,
    text
)
from public, anon;

grant execute
on function
public.activate_enrollment(
    uuid,
    date,
    uuid,
    date,
    text
)
to authenticated;


revoke all
on function
public.change_enrollment_group(
    uuid,
    uuid,
    date,
    text
)
from public, anon;

grant execute
on function
public.change_enrollment_group(
    uuid,
    uuid,
    date,
    text
)
to authenticated;


revoke all
on function
public.change_enrollment_classification(
    uuid,
    uuid,
    date,
    text
)
from public, anon;

grant execute
on function
public.change_enrollment_classification(
    uuid,
    uuid,
    date,
    text
)
to authenticated;


revoke all
on function
public.reactivate_enrollment(
    uuid,
    date,
    uuid,
    text
)
from public, anon;

grant execute
on function
public.reactivate_enrollment(
    uuid,
    date,
    uuid,
    text
)
to authenticated;


-- ============================================================
-- FIN M6.1
-- ============================================================