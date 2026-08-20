-- ============================================================
-- M6.2 — Auditoría automática no financiera
-- ============================================================
--
-- Audita INSERT / UPDATE / DELETE en tablas administrativas
-- que todavía permiten mutación directa.
--
-- NO se aplica a:
--   - enrollments           -> enrollment_events + RPC audit
--   - student_evaluations   -> historial académico propio
--   - tablas financieras    -> RPCs transaccionales
--
-- audit_log permanece sin escritura directa para authenticated.
-- ============================================================


-- ============================================================
-- GENERIC TRIGGER FUNCTION
-- ============================================================

create or replace function
app_private.audit_nonfinancial_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;

    v_old_values jsonb;
    v_new_values jsonb;

    v_entity_id uuid := null;

    v_id_text text;

    v_action text;

    v_correlation_id uuid :=
        gen_random_uuid();
begin

    -- Actor authenticated, if any.
    v_actor_id :=
        (select auth.uid());


    -- ========================================================
    -- SNAPSHOTS
    -- ========================================================
    --
    -- created_at / updated_at are omitted because they are
    -- mechanical timestamps and otherwise create audit noise.
    -- ========================================================

    if tg_op = 'INSERT' then

        v_old_values := null;

        v_new_values :=
            to_jsonb(new)
            - 'created_at'
            - 'updated_at';

        v_action :=
            'NONFINANCIAL_INSERT';


    elsif tg_op = 'UPDATE' then

        v_old_values :=
            to_jsonb(old)
            - 'created_at'
            - 'updated_at';

        v_new_values :=
            to_jsonb(new)
            - 'created_at'
            - 'updated_at';


        -- No business change -> no audit row.
        if v_old_values =
           v_new_values
        then
            return new;
        end if;


        v_action :=
            'NONFINANCIAL_UPDATE';


    elsif tg_op = 'DELETE' then

        v_old_values :=
            to_jsonb(old)
            - 'created_at'
            - 'updated_at';

        v_new_values := null;

        v_action :=
            'NONFINANCIAL_DELETE';


    else

        raise exception
            'Unsupported trigger operation %',
            tg_op;

    end if;


    -- ========================================================
    -- ENTITY ID
    -- ========================================================
    --
    -- Most audited tables have UUID id.
    -- Junction tables such as role_permissions/user_roles may
    -- not have a single id; entity_id remains NULL there.
    -- ========================================================

    v_id_text :=
        coalesce(
            v_new_values ->> 'id',
            v_old_values ->> 'id'
        );


    if v_id_text is not null
       and v_id_text <> ''
    then
        begin

            v_entity_id :=
                v_id_text::uuid;

        exception
            when invalid_text_representation then
                v_entity_id := null;
        end;
    end if;


    -- ========================================================
    -- AUDIT LOG
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
        v_action,
        tg_table_name,
        v_entity_id,
        v_old_values,
        v_new_values,
        null,
        v_correlation_id
    );


    if tg_op = 'DELETE' then
        return old;
    end if;


    return new;

end;
$$;


-- Trigger function is not an RPC endpoint.

revoke all
on function app_private.audit_nonfinancial_mutation()
from public, anon, authenticated;



-- ============================================================
-- INSTALL TRIGGERS
-- ============================================================

do $$
declare
    v_table text;
begin

    foreach v_table in array array[

        -- Students / family
        'students',
        'guardians',
        'student_guardians',
        'family_access',

        -- School structure
        'groups',

        -- Staff / authorization
        'profiles',
        'staff',
        'roles',
        'permissions',
        'role_permissions',
        'user_roles',

        -- Academic configuration
        'subjects',
        'curriculum_subjects',
        'evaluation_periods',
        'academic_capture_windows',
        'group_period_publications',
        'teacher_assignments',
        'group_primary_teacher_assignments'

    ]
    loop

        execute format(
            'drop trigger if exists audit_nonfinancial_mutation on public.%I',
            v_table
        );


        execute format(
            $trigger$
                create trigger audit_nonfinancial_mutation
                after insert or update or delete
                on public.%I
                for each row
                execute function
                app_private.audit_nonfinancial_mutation()
            $trigger$,
            v_table
        );

    end loop;

end;
$$;


-- ============================================================
-- FIN M6.2
-- ============================================================