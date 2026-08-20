-- ============================================================
-- M2 — Configuración financiera por alumno
-- ============================================================
--
-- Objetivos:
--
-- 1. Formalizar planes de 10 / 12 pagos.
-- 2. Persistir selección de plan por enrollment con historial.
-- 3. Persistir fecha económica.
-- 4. Crear categorías de reducción por ciclo.
-- 5. Versionar el valor de las categorías.
-- 6. Permitir una sola categoría vigente por enrollment.
-- 7. Completar snapshots de acuerdos financieros.
--
-- NO:
-- - genera cargos todavía;
-- - cambia cargos históricos;
-- - implementa cambio de plan;
-- - implementa condonaciones;
-- - expone mutaciones financieras directas.
--
-- Esas operaciones transaccionales se implementarán después.
-- ============================================================


-- ============================================================
-- 1. PERMISO DE CONFIGURACIÓN FINANCIERA
-- ============================================================

insert into public.permissions (
    code,
    description
)
values (
    'finance.configure',
    'Manage financial plans, rates, discount categories and student financial configuration'
)
on conflict (code)
do update
set
    description = excluded.description,
    updated_at = statement_timestamp();


-- MASTER

insert into public.role_permissions (
    role_id,
    permission_id,
    scope
)
select
    r.id,
    p.id,
    'ALL'
from public.roles r
join public.permissions p
  on p.code = 'finance.configure'
where r.code = 'MASTER'
on conflict (role_id, permission_id)
do update
set scope = excluded.scope;


-- ADMINISTRATIVO
-- Bloque C establece que también puede configurar tarifas,
-- categorías y condiciones financieras.

insert into public.role_permissions (
    role_id,
    permission_id,
    scope
)
select
    r.id,
    p.id,
    'ALL'
from public.roles r
join public.permissions p
  on p.code = 'finance.configure'
where r.code = 'ADMINISTRATIVO'
on conflict (role_id, permission_id)
do update
set scope = excluded.scope;



-- ============================================================
-- 2. PLANES: 10 / 12 PAGOS
-- ============================================================
--
-- El monto individual mensual sigue viviendo en
-- student_financial_agreements.
--
-- Monto de cada pago:
--
-- mensual_individual * 12 / installment_count
--
-- Plan 12:
-- mensual * 12 / 12 = mensual
--
-- Plan 10:
-- mensual * 12 / 10
-- ============================================================

alter table public.financial_plans
    add column installment_count smallint;


-- Los planes ya existentes son los regulares de 12 pagos.

update public.financial_plans
set installment_count = 12
where installment_count is null;


alter table public.financial_plans
    alter column installment_count
    set not null;


alter table public.financial_plans
    add constraint financial_plans_installment_count_check
    check (
        installment_count in (10, 12)
    );


-- Sólo puede existir un plan default por ciclo + nivel.

create unique index financial_plans_one_default_per_cycle_level_uq
    on public.financial_plans(
        cycle_id,
        education_level_id
    )
    where is_default = true;



-- ============================================================
-- 3. CREAR PLAN DE 10 PAGOS
-- ============================================================
--
-- Uno por nivel.
-- No es el default.
-- Sep-Jun.
-- Las fechas se copian del plan regular ya configurado.
-- ============================================================

insert into public.financial_plans (
    cycle_id,
    education_level_id,
    name,
    is_default,
    status,
    installment_count
)
select
    sc.id,
    el.id,
    'Plan 10 pagos 2026-27',
    false,
    'DRAFT',
    10
from public.school_cycles sc
cross join public.education_levels el
where sc.code = '2026-27'
  and el.code in (
      'PREESCOLAR',
      'PRIMARIA'
  )
on conflict (
    cycle_id,
    education_level_id,
    name
)
do update
set
    installment_count = excluded.installment_count,
    is_default = false,
    updated_at = statement_timestamp();



-- ============================================================
-- 4. PERIODOS DEL PLAN DE 10
-- ============================================================
--
-- Copiamos Sep-Jun del plan default correspondiente.
--
-- No existen periodos Jul/Ago independientes.
-- No existen anchors Dec/Jul ni Mar/Ago.
-- ============================================================

with target_plans as (
    select
        fp.id,
        fp.cycle_id,
        fp.education_level_id
    from public.financial_plans fp
    join public.school_cycles sc
      on sc.id = fp.cycle_id
    where sc.code = '2026-27'
      and fp.name = 'Plan 10 pagos 2026-27'
),
source_periods as (
    select
        target.id as target_plan_id,
        fpp.financial_concept_id,
        fpp.coverage_year,
        fpp.coverage_month,
        fpp.due_date,
        fpp.sort_order
    from target_plans target

    join public.financial_plans source_plan
      on source_plan.cycle_id = target.cycle_id
     and source_plan.education_level_id =
         target.education_level_id
     and source_plan.is_default = true

    join public.financial_plan_periods fpp
      on fpp.financial_plan_id =
         source_plan.id

    join public.financial_concepts fc
      on fc.id = fpp.financial_concept_id
     and fc.code = 'TUITION'

    where fpp.sort_order between 1 and 10
)
insert into public.financial_plan_periods (
    financial_plan_id,
    financial_concept_id,
    coverage_year,
    coverage_month,
    due_date,
    anchor_period_id,
    sort_order
)
select
    target_plan_id,
    financial_concept_id,
    coverage_year,
    coverage_month,
    due_date,
    null,
    sort_order
from source_periods
on conflict (
    financial_plan_id,
    financial_concept_id,
    coverage_year,
    coverage_month
)
do update
set
    due_date = excluded.due_date,
    anchor_period_id = null,
    sort_order = excluded.sort_order,
    updated_at = statement_timestamp();



-- ============================================================
-- 5. HISTORIAL DEL PLAN DEL ENROLLMENT
-- ============================================================
--
-- Una participación puede tener historial de selección de plan.
--
-- El RPC posterior impedirá cambiarlo después del primer pago.
--
-- economic_start_on:
-- fecha desde la cual empiezan las obligaciones económicas.
--
-- Puede diferir de:
-- - enrolled_on
-- - classes_start_on
-- - created_at
-- ============================================================

create table public.enrollment_financial_plan_assignments (
    id uuid primary key
        default gen_random_uuid(),

    enrollment_id uuid not null
        references public.enrollments(id)
        on delete restrict,

    financial_plan_id uuid not null
        references public.financial_plans(id)
        on delete restrict,

    economic_start_on date not null,

    valid_from date not null,
    valid_until date,

    reason text not null,

    authorized_by uuid not null
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null
        default statement_timestamp(),

    updated_at timestamptz not null
        default statement_timestamp(),

    constraint enrollment_financial_plan_dates_check
        check (
            valid_until is null
            or valid_until >= valid_from
        ),

    constraint enrollment_financial_plan_reason_not_blank
        check (
            btrim(reason) <> ''
        )
);


-- Un enrollment no puede tener dos planes efectivos
-- simultáneamente.

alter table public.enrollment_financial_plan_assignments
    add constraint enrollment_financial_plan_no_overlap
    exclude using gist (
        enrollment_id with =,
        daterange(
            valid_from,
            case
                when valid_until is null
                    then 'infinity'::date
                else valid_until + 1
            end,
            '[)'
        ) with &&
    );


create index enrollment_financial_plan_enrollment_idx
    on public.enrollment_financial_plan_assignments(
        enrollment_id,
        valid_from
    );


create index enrollment_financial_plan_plan_idx
    on public.enrollment_financial_plan_assignments(
        financial_plan_id
    );


alter table public.enrollment_financial_plan_assignments
    enable row level security;



-- ============================================================
-- 6. CATEGORÍAS DE REDUCCIÓN DE COLEGIATURA
-- ============================================================
--
-- La categoría pertenece al ciclo.
--
-- El tipo pertenece a la categoría:
-- - FIXED_AMOUNT
-- - PERCENTAGE
--
-- El valor NO vive aquí: vive en versiones.
-- ============================================================

create table public.tuition_discount_categories (
    id uuid primary key
        default gen_random_uuid(),

    cycle_id uuid not null
        references public.school_cycles(id)
        on delete restrict,

    name text not null,

    discount_type text not null,

    is_active boolean not null
        default true,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null
        default statement_timestamp(),

    updated_at timestamptz not null
        default statement_timestamp(),

    constraint tuition_discount_category_name_not_blank
        check (
            btrim(name) <> ''
        ),

    constraint tuition_discount_category_type_check
        check (
            discount_type in (
                'PERCENTAGE',
                'FIXED_AMOUNT'
            )
        )
);


-- Evitar nombres repetidos dentro del mismo ciclo
-- ignorando mayúsculas/espacios.

create unique index tuition_discount_categories_cycle_name_uq
    on public.tuition_discount_categories(
        cycle_id,
        lower(btrim(name))
    );


create index tuition_discount_categories_cycle_active_idx
    on public.tuition_discount_categories(
        cycle_id,
        is_active
    );


alter table public.tuition_discount_categories
    enable row level security;



-- ============================================================
-- 7. VERSIONES DE LAS CATEGORÍAS
-- ============================================================
--
-- Si cambia una categoría de $200 a $300:
--
-- NO se modifica la versión anterior.
--
-- Se cierra su vigencia y se crea otra.
-- ============================================================

create table public.tuition_discount_category_versions (
    id uuid primary key
        default gen_random_uuid(),

    category_id uuid not null
        references public.tuition_discount_categories(id)
        on delete restrict,

    value numeric not null,

    valid_from date not null,
    valid_until date,

    reason text not null,

    created_by uuid not null
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null
        default statement_timestamp(),

    constraint tuition_discount_category_version_dates_check
        check (
            valid_until is null
            or valid_until >= valid_from
        ),

    constraint tuition_discount_category_version_value_positive
        check (
            value > 0
        ),

    constraint tuition_discount_category_version_reason_not_blank
        check (
            btrim(reason) <> ''
        )
);


-- Una categoría no puede tener dos valores vigentes
-- simultáneamente.

alter table public.tuition_discount_category_versions
    add constraint tuition_discount_category_version_no_overlap
    exclude using gist (
        category_id with =,
        daterange(
            valid_from,
            case
                when valid_until is null
                    then 'infinity'::date
                else valid_until + 1
            end,
            '[)'
        ) with &&
    );


create index tuition_discount_category_versions_category_idx
    on public.tuition_discount_category_versions(
        category_id,
        valid_from
    );


alter table public.tuition_discount_category_versions
    enable row level security;



-- ============================================================
-- 8. VALIDAR PORCENTAJE <= 100
-- ============================================================
--
-- El tipo vive en la categoría, por lo que esta validación
-- requiere consultar la categoría.
--
-- No usamos CHECK porque un CHECK no debe depender de otra tabla.
-- La validación definitiva se hará en las RPC de configuración.
--
-- Aquí mantenemos value > 0 estructuralmente.
-- ============================================================



-- ============================================================
-- 9. ASIGNACIÓN DE CATEGORÍA AL ENROLLMENT
-- ============================================================
--
-- No tener fila = alumno sin categoría.
--
-- Máximo una categoría vigente por enrollment.
-- ============================================================

create table public.enrollment_tuition_discount_assignments (
    id uuid primary key
        default gen_random_uuid(),

    enrollment_id uuid not null
        references public.enrollments(id)
        on delete restrict,

    category_id uuid not null
        references public.tuition_discount_categories(id)
        on delete restrict,

    valid_from date not null,
    valid_until date,

    reason text not null,

    authorized_by uuid not null
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null
        default statement_timestamp(),

    updated_at timestamptz not null
        default statement_timestamp(),

    constraint enrollment_tuition_discount_dates_check
        check (
            valid_until is null
            or valid_until >= valid_from
        ),

    constraint enrollment_tuition_discount_reason_not_blank
        check (
            btrim(reason) <> ''
        )
);


alter table public.enrollment_tuition_discount_assignments
    add constraint enrollment_tuition_discount_no_overlap
    exclude using gist (
        enrollment_id with =,
        daterange(
            valid_from,
            case
                when valid_until is null
                    then 'infinity'::date
                else valid_until + 1
            end,
            '[)'
        ) with &&
    );


create index enrollment_tuition_discount_enrollment_idx
    on public.enrollment_tuition_discount_assignments(
        enrollment_id,
        valid_from
    );


create index enrollment_tuition_discount_category_idx
    on public.enrollment_tuition_discount_assignments(
        category_id
    );


alter table public.enrollment_tuition_discount_assignments
    enable row level security;



-- ============================================================
-- 10. SNAPSHOT DE REDUCCIÓN EN ACUERDOS
-- ============================================================
--
-- Ya existen:
--
-- base_amount_snapshot
-- benefit_type_snapshot
-- benefit_value_snapshot
-- agreed_amount
--
-- Agregamos:
--
-- reduction_amount_snapshot
-- discount_category_version_id
--
-- suggested_amount se puede derivar:
--
-- base_amount_snapshot - reduction_amount_snapshot
--
-- agreed_amount sigue siendo el monto final aceptado.
-- ============================================================

alter table public.student_financial_agreements
    add column reduction_amount_snapshot numeric;


-- Backfill histórico.
--
-- Los datos actuales fueron previamente verificados:
-- agreed_amount nunca supera base_amount_snapshot.

update public.student_financial_agreements
set reduction_amount_snapshot =
    base_amount_snapshot - agreed_amount
where reduction_amount_snapshot is null;


alter table public.student_financial_agreements
    alter column reduction_amount_snapshot
    set not null;


alter table public.student_financial_agreements
    add constraint student_financial_agreements_reduction_snapshot_check
    check (
        reduction_amount_snapshot >= 0
        and reduction_amount_snapshot <= base_amount_snapshot
    );


alter table public.student_financial_agreements
    add column discount_category_version_id uuid
        references public.tuition_discount_category_versions(id)
        on delete restrict;


create index student_financial_agreements_discount_version_idx
    on public.student_financial_agreements(
        discount_category_version_id
    )
    where discount_category_version_id is not null;



-- ============================================================
-- 11. RLS — CONFIGURACIÓN
-- ============================================================
--
-- No habilitamos mutaciones directas todavía.
--
-- M4 proporcionará RPCs auditadas.
-- ============================================================

create policy tuition_discount_categories_select
on public.tuition_discount_categories
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    )
);


create policy tuition_discount_category_versions_select
on public.tuition_discount_category_versions
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    )
);


create policy enrollment_financial_plan_assignments_select
on public.enrollment_financial_plan_assignments
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'balances.view',
        'ALL'
    )
);


create policy enrollment_tuition_discount_assignments_select
on public.enrollment_tuition_discount_assignments
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'balances.view',
        'ALL'
    )
);



-- ============================================================
-- 12. GRANTS DE LECTURA
-- ============================================================
--
-- No INSERT/UPDATE/DELETE desde cliente.
-- Las futuras escrituras pasarán por RPC.
-- ============================================================

grant select
on public.tuition_discount_categories
to authenticated;


grant select
on public.tuition_discount_category_versions
to authenticated;


grant select
on public.enrollment_financial_plan_assignments
to authenticated;


grant select
on public.enrollment_tuition_discount_assignments
to authenticated;



-- ============================================================
-- FIN M2
-- ============================================================