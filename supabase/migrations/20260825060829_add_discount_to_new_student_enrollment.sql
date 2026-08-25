-- ============================================================
-- H7.4 — BENEFICIO OPCIONAL EN ALTA INTEGRAL DE ALUMNO NUEVO
--
-- Reutiliza:
--   create_new_student_enrollment_internal(...)
--   set_enrollment_tuition_discount_internal(...)
--
-- Objetivo:
-- alumno + matrícula + finanzas + beneficio = una transacción.
--
-- El importe del primer periodo sigue llegando explícitamente
-- desde la operación de matrícula.
-- ============================================================


-- ------------------------------------------------------------
-- Renombramos temporalmente la implementación actual para poder
-- envolverla sin duplicar toda su lógica.
-- ------------------------------------------------------------

alter function app_private.create_new_student_enrollment_internal(
    text,
    text,
    date,
    jsonb,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text,
    numeric,
    text
)
rename to create_new_student_enrollment_base_internal;


-- ------------------------------------------------------------
-- Retirar wrapper público anterior.
-- ------------------------------------------------------------

drop function if exists public.create_new_student_enrollment(
    text,
    text,
    date,
    jsonb,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text,
    numeric,
    text
);


-- ============================================================
-- NUEVA IMPLEMENTACIÓN INTERNA
-- ============================================================

create function app_private.create_new_student_enrollment_internal(
    p_student_full_name text,
    p_student_sex text,
    p_student_birth_date date,
    p_contacts jsonb,

    p_cycle_id uuid,
    p_grade_level_id uuid,
    p_classification_id uuid,
    p_group_id uuid,

    p_activated_on date,
    p_classes_start_on date,
    p_economic_start_on date,

    p_initial_period_amount numeric default null,
    p_initial_period_due_date date default null,

    p_enrollment_fee_mode text default null,
    p_enrollment_fee_amount numeric default null,

    p_discount_category_id uuid default null,

    p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_result jsonb;
    v_enrollment_id uuid;

    v_first_coverage_start date;
    v_effect_mode text;
    v_current_period_amount numeric;
begin

    -- ========================================================
    -- CREAR ALUMNO + CONTACTOS + MATRÍCULA + FINANZAS
    -- ========================================================

    v_result :=
        app_private.create_new_student_enrollment_base_internal(
            p_student_full_name,
            p_student_sex,
            p_student_birth_date,
            p_contacts,

            p_cycle_id,
            p_grade_level_id,
            p_classification_id,
            p_group_id,

            p_activated_on,
            p_classes_start_on,
            p_economic_start_on,

            p_initial_period_amount,
            p_initial_period_due_date,

            p_enrollment_fee_mode,
            p_enrollment_fee_amount,

            p_reason
        );


    v_enrollment_id :=
        (v_result ->> 'enrollment_id')::uuid;


    if v_enrollment_id is null then
        raise exception
            'New student enrollment did not return enrollment_id';
    end if;


    -- ========================================================
    -- BENEFICIO OPCIONAL
    -- ========================================================

    if p_discount_category_id is not null then

        -- ----------------------------------------------------
        -- Determinar si el ingreso económico cayó dentro de un
        -- periodo ordinario del plan.
        --
        -- Si cayó a mitad de SEP/OCT/NOV/etc. y existe un monto
        -- inicial explícito, ese primer importe se conserva.
        --
        -- Los periodos posteriores usan el nuevo importe
        -- individual resultante del beneficio.
        -- ----------------------------------------------------

        select
            min(
                make_date(
                    fpp.coverage_year,
                    fpp.coverage_month,
                    1
                )
            )
        into
            v_first_coverage_start

        from public.enrollment_financial_plan_assignments efpa

        join public.financial_plan_periods fpp
          on fpp.financial_plan_id =
             efpa.financial_plan_id

        join public.financial_concepts fc
          on fc.id =
             fpp.financial_concept_id

        where efpa.enrollment_id =
              v_enrollment_id

          and efpa.valid_until is null

          and fc.code =
              'TUITION';


        if v_first_coverage_start is null then
            raise exception
                'Enrollment financial plan has no tuition coverage';
        end if;


        -- ----------------------------------------------------
        -- PROPORTIONAL:
        -- ingreso dentro de un mes ordinario y ya existe un
        -- monto inicial confirmado por el operador.
        --
        -- Ej:
        -- 15 SEP
        -- 20 NOV
        -- 03 DIC
        --
        -- CURRENT:
        -- inicio normal del periodo o segmento previo al primer
        -- periodo ordinario.
        --
        -- En el segmento previo (ej. 31 AGO), el cargo inicial
        -- conserva el importe explícito enviado por matrícula;
        -- SEP en adelante recibe el beneficio.
        -- ----------------------------------------------------

        if p_initial_period_amount is not null
           and p_economic_start_on >= v_first_coverage_start
           and extract(day from p_economic_start_on) > 1
        then
            v_effect_mode :=
                'PROPORTIONAL';

            v_current_period_amount :=
                p_initial_period_amount;

        else
            v_effect_mode :=
                'CURRENT';

            v_current_period_amount :=
                null;
        end if;


        perform
            app_private.set_enrollment_tuition_discount_internal(
                v_enrollment_id,
                p_discount_category_id,
                p_activated_on,
                v_effect_mode,
                v_current_period_amount,
                coalesce(
                    nullif(btrim(p_reason), ''),
                    'Beneficio definido durante alta de alumno nuevo'
                )
            );

    end if;


    -- ========================================================
    -- RESULT
    -- ========================================================

    return
        v_result
        ||
        jsonb_build_object(
            'discount_category_id',
            p_discount_category_id
        );

end;
$$;


-- ============================================================
-- WRAPPER PÚBLICO
-- ============================================================

create function public.create_new_student_enrollment(
    p_student_full_name text,
    p_student_sex text,
    p_student_birth_date date,
    p_contacts jsonb,

    p_cycle_id uuid,
    p_grade_level_id uuid,
    p_classification_id uuid,
    p_group_id uuid,

    p_activated_on date,
    p_classes_start_on date,
    p_economic_start_on date,

    p_initial_period_amount numeric default null,
    p_initial_period_due_date date default null,

    p_enrollment_fee_mode text default null,
    p_enrollment_fee_amount numeric default null,

    p_discount_category_id uuid default null,

    p_reason text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
    select
        app_private.create_new_student_enrollment_internal(
            p_student_full_name,
            p_student_sex,
            p_student_birth_date,
            p_contacts,

            p_cycle_id,
            p_grade_level_id,
            p_classification_id,
            p_group_id,

            p_activated_on,
            p_classes_start_on,
            p_economic_start_on,

            p_initial_period_amount,
            p_initial_period_due_date,

            p_enrollment_fee_mode,
            p_enrollment_fee_amount,

            p_discount_category_id,

            p_reason
        );
$$;


-- ============================================================
-- PRIVILEGES
-- ============================================================

revoke all
on function app_private.create_new_student_enrollment_base_internal(
    text,
    text,
    date,
    jsonb,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text,
    numeric,
    text
)
from public, anon, authenticated;


revoke all
on function app_private.create_new_student_enrollment_internal(
    text,
    text,
    date,
    jsonb,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text,
    numeric,
    uuid,
    text
)
from public, anon, authenticated;


revoke all
on function public.create_new_student_enrollment(
    text,
    text,
    date,
    jsonb,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text,
    numeric,
    uuid,
    text
)
from public, anon;


grant execute
on function public.create_new_student_enrollment(
    text,
    text,
    date,
    jsonb,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text,
    numeric,
    uuid,
    text
)
to authenticated;