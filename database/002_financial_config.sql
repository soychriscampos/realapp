-- ============================================================
-- APP REAL
-- 002_financial_config.sql
--
-- Configuración financiera:
-- - conceptos
-- - tarifas institucionales
-- - beneficios
-- - acuerdos financieros individuales
-- - planes de obligaciones
-- - periodos del plan
-- - excepciones individuales
--
-- NO incluye cargos, pagos, créditos ni reembolsos.
-- ============================================================


-- ============================================================
-- EXTENSIONES
-- ============================================================
-- Necesaria para constraints de exclusión que evitan
-- vigencias financieras solapadas.

create extension if not exists btree_gist
    with schema extensions;


-- ============================================================
-- 1. FINANCIAL_CONCEPTS
-- ============================================================

create table public.financial_concepts (
    id uuid primary key default gen_random_uuid(),

    code text not null,
    name text not null,
    category text not null,

    is_active boolean not null default true,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint financial_concepts_code_uq
        unique (code),

    constraint financial_concepts_code_not_blank
        check (btrim(code) <> ''),

    constraint financial_concepts_name_not_blank
        check (btrim(name) <> ''),

    constraint financial_concepts_category_check
        check (
            category in (
                'TUITION',
                'ENROLLMENT_FEE',
                'PREREGISTRATION',
                'LATE_FEE',
                'OTHER'
            )
        )
);


-- ============================================================
-- 2. BASE_RATES
-- ============================================================
-- Tarifa institucional por:
--
-- ciclo + nivel educativo + concepto + vigencia
--
-- Ejemplo:
-- 2026-27 / Primaria / Colegiatura / $2,600
-- ============================================================

create table public.base_rates (
    id uuid primary key default gen_random_uuid(),

    cycle_id uuid not null
        references public.school_cycles(id)
        on delete restrict,

    education_level_id uuid not null
        references public.education_levels(id)
        on delete restrict,

    financial_concept_id uuid not null
        references public.financial_concepts(id)
        on delete restrict,

    amount numeric(12,2) not null,

    valid_from date not null,
    valid_until date,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint base_rates_amount_nonnegative
        check (amount >= 0),

    constraint base_rates_validity_check
        check (
            valid_until is null
            or valid_until >= valid_from
        )
);


-- No puede haber dos tarifas institucionales superpuestas
-- para el mismo ciclo + nivel + concepto.
--
-- valid_until se interpreta como fecha inclusiva.

alter table public.base_rates
    add constraint base_rates_no_overlapping_validity
    exclude using gist (
        cycle_id with =,
        education_level_id with =,
        financial_concept_id with =,
        daterange(
            valid_from,
            case
                when valid_until is null then 'infinity'::date
                else valid_until + 1
            end,
            '[)'
        ) with &&
    );


create index base_rates_cycle_id_idx
    on public.base_rates (cycle_id);

create index base_rates_education_level_id_idx
    on public.base_rates (education_level_id);

create index base_rates_financial_concept_id_idx
    on public.base_rates (financial_concept_id);


-- ============================================================
-- 3. BENEFITS
-- ============================================================
-- Catálogo de beneficios/descuentos.
--
-- Ejemplos:
-- - Beca 25%
-- - Hermanos $1,250
-- - Beca 100%
--
-- El beneficio NO es la fuente final del monto cobrado.
-- El monto pactado queda congelado en
-- student_financial_agreements.
-- ============================================================

create table public.benefits (
    id uuid primary key default gen_random_uuid(),

    name text not null,
    benefit_type text not null,
    value numeric(12,2) not null,

    is_active boolean not null default true,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint benefits_name_not_blank
        check (btrim(name) <> ''),

    constraint benefits_type_check
        check (
            benefit_type in (
                'PERCENTAGE',
                'FIXED_AMOUNT'
            )
        ),

    constraint benefits_value_check
        check (
            (
                benefit_type = 'PERCENTAGE'
                and value > 0
                and value <= 100
            )
            or
            (
                benefit_type = 'FIXED_AMOUNT'
                and value > 0
            )
        )
);


-- ============================================================
-- 4. STUDENT_FINANCIAL_AGREEMENTS
-- ============================================================
-- Condición financiera individual de una matrícula.
--
-- Esta tabla guarda el acuerdo REAL que gobierna los cargos.
--
-- Ejemplo:
-- Tarifa base:              $2,600
-- Beneficio hermanos:       $1,250
-- Importe individual:       $1,350
--
-- Si posteriormente cambia a $1,100:
-- NO se modifica el registro anterior.
-- Se cierra su vigencia y se crea uno nuevo.
-- ============================================================

create table public.student_financial_agreements (
    id uuid primary key default gen_random_uuid(),

    enrollment_id uuid not null
        references public.enrollments(id)
        on delete restrict,

    financial_concept_id uuid not null
        references public.financial_concepts(id)
        on delete restrict,

    base_rate_id uuid
        references public.base_rates(id)
        on delete restrict,

    benefit_id uuid
        references public.benefits(id)
        on delete restrict,

    -- Snapshot de la condición existente al autorizar el acuerdo.
    -- Evita que cambios futuros en catálogos modifiquen historia.
    base_amount_snapshot numeric(12,2) not null,

    benefit_type_snapshot text,
    benefit_value_snapshot numeric(12,2),

    -- Fuente final para la generación de obligaciones.
    agreed_amount numeric(12,2) not null,

    valid_from date not null,
    valid_until date,

    reason text,

    authorized_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint student_financial_agreements_base_amount_check
        check (base_amount_snapshot >= 0),

    constraint student_financial_agreements_agreed_amount_check
        check (agreed_amount >= 0),

    constraint student_financial_agreements_dates_check
        check (
            valid_until is null
            or valid_until >= valid_from
        ),

    -- Tipo y valor del beneficio deben existir juntos o ambos
    -- permanecer NULL.
    constraint student_financial_agreements_benefit_snapshot_pair
        check (
            (
                benefit_type_snapshot is null
                and benefit_value_snapshot is null
            )
            or
            (
                benefit_type_snapshot is not null
                and benefit_value_snapshot is not null
            )
        ),

    constraint student_financial_agreements_benefit_type_check
        check (
            benefit_type_snapshot is null
            or benefit_type_snapshot in (
                'PERCENTAGE',
                'FIXED_AMOUNT'
            )
        ),

    constraint student_financial_agreements_benefit_value_check
        check (
            benefit_type_snapshot is null
            or (
                benefit_type_snapshot = 'PERCENTAGE'
                and benefit_value_snapshot > 0
                and benefit_value_snapshot <= 100
            )
            or (
                benefit_type_snapshot = 'FIXED_AMOUNT'
                and benefit_value_snapshot > 0
            )
        ),

    -- Si se vincula un beneficio del catálogo, también debe
    -- existir el snapshot histórico.
    constraint student_financial_agreements_benefit_snapshot_required
        check (
            benefit_id is null
            or (
                benefit_type_snapshot is not null
                and benefit_value_snapshot is not null
            )
        )
);


-- Una matrícula no puede tener simultáneamente dos acuerdos
-- vigentes para el mismo concepto.
--
-- valid_until es inclusivo.

alter table public.student_financial_agreements
    add constraint student_financial_agreements_no_overlap
    exclude using gist (
        enrollment_id with =,
        financial_concept_id with =,
        daterange(
            valid_from,
            case
                when valid_until is null then 'infinity'::date
                else valid_until + 1
            end,
            '[)'
        ) with &&
    );


create index student_financial_agreements_enrollment_id_idx
    on public.student_financial_agreements (enrollment_id);

create index student_financial_agreements_concept_id_idx
    on public.student_financial_agreements (financial_concept_id);

create index student_financial_agreements_base_rate_id_idx
    on public.student_financial_agreements (base_rate_id)
    where base_rate_id is not null;

create index student_financial_agreements_benefit_id_idx
    on public.student_financial_agreements (benefit_id)
    where benefit_id is not null;


-- ============================================================
-- 5. FINANCIAL_PLANS
-- ============================================================
-- Plantilla institucional de obligaciones.
--
-- Ejemplo:
-- Ciclo: 2026-27
-- Nivel: Primaria
-- Plan: 12 mensualidades estándar
--
-- El plan describe QUÉ obligaciones normalmente corresponden.
-- No representa el saldo de un alumno.
-- ============================================================

create table public.financial_plans (
    id uuid primary key default gen_random_uuid(),

    cycle_id uuid not null
        references public.school_cycles(id)
        on delete restrict,

    education_level_id uuid not null
        references public.education_levels(id)
        on delete restrict,

    name text not null,

    is_default boolean not null default false,

    status text not null default 'DRAFT',

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint financial_plans_name_not_blank
        check (btrim(name) <> ''),

    constraint financial_plans_status_check
        check (
            status in (
                'DRAFT',
                'ACTIVE',
                'INACTIVE'
            )
        ),

    constraint financial_plans_cycle_level_name_uq
        unique (cycle_id, education_level_id, name)
);


-- Sólo puede existir un plan ACTIVO marcado como default
-- por ciclo y nivel.

create unique index financial_plans_one_active_default_uq
    on public.financial_plans (
        cycle_id,
        education_level_id
    )
    where (
        is_default = true
        and status = 'ACTIVE'
    );


create index financial_plans_cycle_id_idx
    on public.financial_plans (cycle_id);

create index financial_plans_education_level_id_idx
    on public.financial_plans (education_level_id);


-- ============================================================
-- 6. FINANCIAL_PLAN_PERIODS
-- ============================================================
-- Cada fila representa una obligación prevista por el plan.
--
-- Para colegiaturas mensuales:
-- coverage_year / coverage_month identifican el mes REAL que
-- se está cobrando, independientemente de cuándo venza.
--
-- Ejemplo:
-- Julio sigue siendo JULIO aunque su fecha de vencimiento
-- corresponda a diciembre.
--
-- anchor_period_id permite asociar una obligación adelantada
-- con el periodo que funciona como ancla.
-- ============================================================

create table public.financial_plan_periods (
    id uuid primary key default gen_random_uuid(),

    financial_plan_id uuid not null
        references public.financial_plans(id)
        on delete restrict,

    financial_concept_id uuid not null
        references public.financial_concepts(id)
        on delete restrict,

    coverage_year smallint,
    coverage_month smallint,

    due_date date not null,

    anchor_period_id uuid,

    sort_order integer not null,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint financial_plan_periods_coverage_pair
        check (
            (
                coverage_year is null
                and coverage_month is null
            )
            or
            (
                coverage_year is not null
                and coverage_month is not null
            )
        ),

    constraint financial_plan_periods_year_check
        check (
            coverage_year is null
            or coverage_year between 2000 and 2200
        ),

    constraint financial_plan_periods_month_check
        check (
            coverage_month is null
            or coverage_month between 1 and 12
        ),

    constraint financial_plan_periods_sort_order_positive
        check (sort_order > 0),

    constraint financial_plan_periods_sort_order_uq
        unique (
            financial_plan_id,
            sort_order
        ),

    -- Evita duplicar el mismo concepto/periodo dentro
    -- del mismo plan.
    constraint financial_plan_periods_period_uq
        unique (
            financial_plan_id,
            financial_concept_id,
            coverage_year,
            coverage_month
        ),

    -- Necesario para la FK compuesta del ancla.
    constraint financial_plan_periods_id_plan_uq
        unique (id, financial_plan_id),

    constraint financial_plan_periods_anchor_not_self
        check (
            anchor_period_id is null
            or anchor_period_id <> id
        ),

    -- Un ancla nunca puede pertenecer a otro plan.
    constraint financial_plan_periods_anchor_fk
        foreign key (
            anchor_period_id,
            financial_plan_id
        )
        references public.financial_plan_periods (
            id,
            financial_plan_id
        )
        on delete restrict
        deferrable initially deferred
);


create index financial_plan_periods_plan_id_idx
    on public.financial_plan_periods (financial_plan_id);

create index financial_plan_periods_concept_id_idx
    on public.financial_plan_periods (financial_concept_id);

create index financial_plan_periods_anchor_id_idx
    on public.financial_plan_periods (anchor_period_id)
    where anchor_period_id is not null;


-- ============================================================
-- 7. ENROLLMENT_CHARGE_RULES
-- ============================================================
-- Excepciones individuales sobre un periodo del plan.
--
-- Ejemplos:
--
-- NOT_APPLICABLE
--   Alumno entró después y un periodo no le corresponde.
--
-- CHARGE_NOW
--   Una obligación anclada debe cobrarse al ingresar/reactivarse.
--
-- CHARGE_LATER
--   Sí corresponde, pero con otra fecha.
--
-- CUSTOM
--   Importe y/o fecha individual autorizados.
--
-- STANDARD
--   Mantener comportamiento normal.
-- ============================================================

create table public.enrollment_charge_rules (
    id uuid primary key default gen_random_uuid(),

    enrollment_id uuid not null
        references public.enrollments(id)
        on delete restrict,

    financial_plan_period_id uuid not null
        references public.financial_plan_periods(id)
        on delete restrict,

    action text not null,

    custom_due_date date,
    custom_amount numeric(12,2),

    reason text,

    authorized_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint enrollment_charge_rules_enrollment_period_uq
        unique (
            enrollment_id,
            financial_plan_period_id
        ),

    constraint enrollment_charge_rules_action_check
        check (
            action in (
                'STANDARD',
                'NOT_APPLICABLE',
                'CHARGE_NOW',
                'CHARGE_LATER',
                'CUSTOM'
            )
        ),

    constraint enrollment_charge_rules_custom_amount_check
        check (
            custom_amount is null
            or custom_amount >= 0
        ),

    -- Si se difiere explícitamente una obligación,
    -- necesitamos saber hasta cuándo.
    constraint enrollment_charge_rules_charge_later_date
        check (
            action <> 'CHARGE_LATER'
            or custom_due_date is not null
        ),

    -- Las excepciones deben quedar justificadas.
    constraint enrollment_charge_rules_exception_reason
        check (
            action = 'STANDARD'
            or (
                reason is not null
                and btrim(reason) <> ''
            )
        ),

    -- CUSTOM debe modificar al menos monto o vencimiento.
    constraint enrollment_charge_rules_custom_value
        check (
            action <> 'CUSTOM'
            or (
                custom_due_date is not null
                or custom_amount is not null
            )
        )
);


create index enrollment_charge_rules_enrollment_id_idx
    on public.enrollment_charge_rules (enrollment_id);

create index enrollment_charge_rules_plan_period_id_idx
    on public.enrollment_charge_rules (financial_plan_period_id);


-- ============================================================
-- RLS
-- ============================================================
-- No se crean policies ni GRANTs todavía.

alter table public.financial_concepts
    enable row level security;

alter table public.base_rates
    enable row level security;

alter table public.benefits
    enable row level security;

alter table public.student_financial_agreements
    enable row level security;

alter table public.financial_plans
    enable row level security;

alter table public.financial_plan_periods
    enable row level security;

alter table public.enrollment_charge_rules
    enable row level security;