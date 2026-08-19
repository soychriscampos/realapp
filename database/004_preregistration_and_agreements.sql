-- ============================================================
-- APP REAL
-- 004_preregistration_and_agreements.sql
--
-- Procesos incluidos:
-- - campañas de preinscripción
-- - preinscripciones
-- - convenios financieros
-- - parcialidades de convenios
-- - cargos incluidos en convenios
--
-- Una preinscripción NO crea automáticamente una matrícula.
-- Un convenio NO sustituye los cargos originales.
-- ============================================================


-- ============================================================
-- 1. PREREGISTRATION_CAMPAIGNS
-- ============================================================
-- Define una campaña institucional de preinscripción.
--
-- Ejemplos:
-- - Preinscripción febrero 2027
-- - Preinscripción anticipada marzo-abril 2027
--
-- covered_concept_id indica qué concepto futuro puede quedar
-- satisfecho total o parcialmente por la campaña.
-- ============================================================

create table public.preregistration_campaigns (
    id uuid primary key default gen_random_uuid(),

    target_cycle_id uuid not null
        references public.school_cycles(id)
        on delete restrict,

    -- Puede ser NULL si la campaña aplica a más de un nivel.
    education_level_id uuid
        references public.education_levels(id)
        on delete restrict,

    name text not null,

    starts_on date not null,
    ends_on date not null,

    price numeric(12,2) not null,

    covered_concept_id uuid
        references public.financial_concepts(id)
        on delete restrict,

    allows_partial_payments boolean not null default false,

    non_continuation_policy text not null,

    status text not null default 'DRAFT',

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint preregistration_campaigns_name_not_blank
        check (btrim(name) <> ''),

    constraint preregistration_campaigns_dates_check
        check (ends_on >= starts_on),

    constraint preregistration_campaigns_price_nonnegative
        check (price >= 0),

    constraint preregistration_campaigns_non_continuation_policy_check
        check (
            non_continuation_policy in (
                'NON_REFUNDABLE',
                'REFUNDABLE',
                'TRANSFERABLE',
                'REASSIGNABLE',
                'MANUAL_REVIEW'
            )
        ),

    constraint preregistration_campaigns_status_check
        check (
            status in (
                'DRAFT',
                'ACTIVE',
                'CLOSED',
                'CANCELLED'
            )
        ),

    constraint preregistration_campaigns_cycle_name_uq
        unique (
            target_cycle_id,
            name
        ),

    -- Permite comprobar que una preinscripción que usa campaña
    -- conserve el mismo ciclo destino.
    constraint preregistration_campaigns_id_cycle_uq
        unique (
            id,
            target_cycle_id
        )
);


create index preregistration_campaigns_target_cycle_idx
    on public.preregistration_campaigns (target_cycle_id);

create index preregistration_campaigns_level_idx
    on public.preregistration_campaigns (education_level_id)
    where education_level_id is not null;

create index preregistration_campaigns_status_idx
    on public.preregistration_campaigns (status);


-- ============================================================
-- 2. PREREGISTRATIONS
-- ============================================================
-- Intención de incorporación o continuidad para un ciclo futuro.
--
-- Reutiliza:
-- - students
-- - guardians
-- - student_guardians
--
-- No duplica nombre, teléfono, email, etc.
--
-- Puede existir sin enrollment.
-- ============================================================

create table public.preregistrations (
    id uuid primary key default gen_random_uuid(),

    student_id uuid not null
        references public.students(id)
        on delete restrict,

    campaign_id uuid,

    target_cycle_id uuid not null
        references public.school_cycles(id)
        on delete restrict,

    target_education_level_id uuid not null
        references public.education_levels(id)
        on delete restrict,

    target_grade_level_id uuid not null,

    status text not null default 'PENDING',

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),

    resolved_at timestamptz,

    resolution text,

    notes text,

    legacy_reference text,

    constraint preregistrations_status_check
        check (
            status in (
                'PENDING',
                'CONFIRMED',
                'CANCELLED',
                'NO_CONTINUA',
                'RESOLVED'
            )
        ),

    constraint preregistrations_resolution_pair
        check (
            (
                resolved_at is null
                and resolution is null
            )
            or
            (
                resolved_at is not null
                and resolution is not null
                and btrim(resolution) <> ''
            )
        ),

    -- El grado destino debe pertenecer al nivel declarado.
    constraint preregistrations_grade_level_fk
        foreign key (
            target_grade_level_id,
            target_education_level_id
        )
        references public.grade_levels (
            id,
            education_level_id
        )
        on delete restrict,

    -- Si existe campaña, debe pertenecer al mismo ciclo destino.
    constraint preregistrations_campaign_cycle_fk
        foreign key (
            campaign_id,
            target_cycle_id
        )
        references public.preregistration_campaigns (
            id,
            target_cycle_id
        )
        on delete restrict,

    constraint preregistrations_student_cycle_uq
        unique (
            student_id,
            target_cycle_id
        )
);


create index preregistrations_student_idx
    on public.preregistrations (student_id);

create index preregistrations_campaign_idx
    on public.preregistrations (campaign_id)
    where campaign_id is not null;

create index preregistrations_target_cycle_idx
    on public.preregistrations (target_cycle_id);

create index preregistrations_target_grade_idx
    on public.preregistrations (target_grade_level_id);

create index preregistrations_status_idx
    on public.preregistrations (status);


-- ============================================================
-- 3. PAYMENT_AGREEMENTS
-- ============================================================
-- Convenio financiero especial.
--
-- Tipos iniciales:
--
-- SPECIAL_INSTALLMENTS
--   Ejemplo: convertir una condición anual en 10 parcialidades.
--
-- DEBT_REPAYMENT
--   Convenio para pagar deuda ya existente.
--
-- El convenio NO modifica ni reemplaza automáticamente los
-- cargos originales.
-- ============================================================

create table public.payment_agreements (
    id uuid primary key default gen_random_uuid(),

    enrollment_id uuid not null
        references public.enrollments(id)
        on delete restrict,

    agreement_type text not null,

    status text not null default 'DRAFT',

    original_value numeric(12,2) not null,

    agreed_total numeric(12,2) not null,

    starts_on date not null,

    accepted_on date,

    reason text not null,

    authorized_by uuid
        references public.profiles(id)
        on delete restrict,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    -- Si un convenio cerrado necesita modificarse, no se
    -- sobrescribe silenciosamente. Este campo permite enlazar
    -- una nueva versión con la anterior.
    supersedes_agreement_id uuid,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint payment_agreements_type_check
        check (
            agreement_type in (
                'SPECIAL_INSTALLMENTS',
                'DEBT_REPAYMENT'
            )
        ),

    constraint payment_agreements_status_check
        check (
            status in (
                'DRAFT',
                'ACTIVE',
                'COMPLETED',
                'CANCELLED',
                'SUPERSEDED'
            )
        ),

    constraint payment_agreements_original_value_nonnegative
        check (original_value >= 0),

    constraint payment_agreements_agreed_total_nonnegative
        check (agreed_total >= 0),

    constraint payment_agreements_reason_not_blank
        check (btrim(reason) <> ''),

    -- Un borrador puede cancelarse antes de ser aceptado.
    -- ACTIVE/COMPLETED/SUPERSEDED sí requieren aceptación.
    constraint payment_agreements_acceptance_check
        check (
            status not in (
                'ACTIVE',
                'COMPLETED',
                'SUPERSEDED'
            )
            or accepted_on is not null
        ),

    constraint payment_agreements_supersedes_not_self
        check (
            supersedes_agreement_id is null
            or supersedes_agreement_id <> id
        ),

    -- Una enmienda sólo puede sustituir un convenio de la
    -- misma matrícula.
    constraint payment_agreements_id_enrollment_uq
        unique (
            id,
            enrollment_id
        ),

    constraint payment_agreements_supersedes_same_enrollment_fk
        foreign key (
            supersedes_agreement_id,
            enrollment_id
        )
        references public.payment_agreements (
            id,
            enrollment_id
        )
        on delete restrict
);


create index payment_agreements_enrollment_idx
    on public.payment_agreements (enrollment_id);

create index payment_agreements_status_idx
    on public.payment_agreements (status);

create unique index payment_agreements_supersedes_uq
    on public.payment_agreements (supersedes_agreement_id)
    where supersedes_agreement_id is not null;


-- ============================================================
-- 4. PAYMENT_AGREEMENT_INSTALLMENTS
-- ============================================================
-- Calendario pactado del convenio.
--
-- Este calendario describe compromisos del convenio.
-- No sustituye los cargos reales.
--
-- Ejemplo:
-- Convenio especial 10 pagos:
-- 1 / 31-ago / 3,120
-- 2 / 30-sep / 3,120
-- ...
-- ============================================================

create table public.payment_agreement_installments (
    id uuid primary key default gen_random_uuid(),

    agreement_id uuid not null
        references public.payment_agreements(id)
        on delete restrict,

    installment_number smallint not null,

    due_date date not null,

    amount numeric(12,2) not null,

    status text not null default 'PENDING',

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint payment_agreement_installments_number_positive
        check (installment_number > 0),

    constraint payment_agreement_installments_amount_nonnegative
        check (amount >= 0),

    constraint payment_agreement_installments_status_check
        check (
            status in (
                'PENDING',
                'FULFILLED',
                'OVERDUE',
                'CANCELLED'
            )
        ),

    constraint payment_agreement_installments_number_uq
        unique (
            agreement_id,
            installment_number
        )
);


create index payment_agreement_installments_agreement_idx
    on public.payment_agreement_installments (agreement_id);

create index payment_agreement_installments_due_date_idx
    on public.payment_agreement_installments (due_date);


-- ============================================================
-- 5. PAYMENT_AGREEMENT_CHARGES
-- ============================================================
-- Relación entre un convenio y los cargos reales que cubre.
--
-- Esto es especialmente importante para convenios de deuda:
-- el convenio organiza el pago, pero la deuda original sigue
-- viviendo en charges.
-- ============================================================

create table public.payment_agreement_charges (
    agreement_id uuid not null,

    charge_id uuid not null,

    -- Redundancia técnica deliberada para impedir que un
    -- convenio incluya cargos de otra matrícula.
    enrollment_id uuid not null,

    included_amount numeric(12,2) not null,

    created_at timestamptz not null default statement_timestamp(),

    primary key (
        agreement_id,
        charge_id
    ),

    constraint payment_agreement_charges_amount_positive
        check (included_amount > 0),

    constraint payment_agreement_charges_agreement_enrollment_fk
        foreign key (
            agreement_id,
            enrollment_id
        )
        references public.payment_agreements (
            id,
            enrollment_id
        )
        on delete restrict,

    constraint payment_agreement_charges_charge_enrollment_fk
        foreign key (
            charge_id,
            enrollment_id
        )
        references public.charges (
            id,
            enrollment_id
        )
        on delete restrict
);


create index payment_agreement_charges_charge_idx
    on public.payment_agreement_charges (charge_id);


-- ============================================================
-- RLS
-- ============================================================

alter table public.preregistration_campaigns
    enable row level security;

alter table public.preregistrations
    enable row level security;

alter table public.payment_agreements
    enable row level security;

alter table public.payment_agreement_installments
    enable row level security;

alter table public.payment_agreement_charges
    enable row level security;