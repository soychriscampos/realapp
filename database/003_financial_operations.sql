-- ============================================================
-- APP REAL
-- 003_financial_operations.sql
--
-- Motor financiero operativo:
-- - cargos
-- - ajustes
-- - pagos
-- - aplicaciones de pagos
-- - créditos
-- - aplicaciones de créditos
-- - reversos
-- - reembolsos
--
-- El saldo NO se almacena como columna.
-- Se deriva de los hechos financieros.
-- ============================================================


-- ============================================================
-- CONSTRAINTS AUXILIARES SOBRE TABLAS YA EXISTENTES
-- ============================================================
-- Permiten usar FKs compuestas para asegurar coherencia entre
-- alumno, matrícula, concepto y periodo financiero.


alter table public.enrollments
    add constraint enrollments_id_student_cycle_uq
    unique (id, student_id, cycle_id);


alter table public.student_financial_agreements
    add constraint student_financial_agreements_id_enrollment_concept_uq
    unique (
        id,
        enrollment_id,
        financial_concept_id
    );


alter table public.financial_plan_periods
    add constraint financial_plan_periods_id_concept_uq
    unique (
        id,
        financial_concept_id
    );


-- ============================================================
-- 1. CHARGES
-- ============================================================
-- Obligación económica concreta de un alumno.
--
-- Ejemplos:
-- - Colegiatura septiembre 2026
-- - Inscripción 2026-27
-- - Preinscripción
-- - Otro concepto autorizado
--
-- NO contiene:
-- - saldo actual
-- - pagado
-- - vencido
--
-- Esos valores se derivan.
-- ============================================================

create table public.charges (
    id uuid primary key default gen_random_uuid(),

    student_id uuid not null
        references public.students(id)
        on delete restrict,

    enrollment_id uuid,

    cycle_id uuid
        references public.school_cycles(id)
        on delete restrict,

    financial_concept_id uuid not null
        references public.financial_concepts(id)
        on delete restrict,

    financial_plan_period_id uuid,

    financial_agreement_id uuid,

    coverage_year smallint,
    coverage_month smallint,

    original_amount numeric(12,2) not null,

    due_date date not null,

    -- Valores previstos inicialmente:
    -- PLAN
    -- MANUAL
    -- PREREGISTRATION
    -- MIGRATION
    --
    -- Se deja como texto controlado por aplicación porque
    -- pueden aparecer nuevos orígenes válidos sin cambiar
    -- la naturaleza financiera del cargo.
    origin text not null,

    -- ACTIVE = obligación vigente.
    -- VOID = obligación anulada administrativamente.
    --
    -- PAID no existe porque "pagado" es un estado derivado.
    status text not null default 'ACTIVE',

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    -- Referencia opcional para reconciliación del ETL.
    -- No necesariamente es única: un hecho legacy puede
    -- convertirse en más de un cargo target.
    legacy_reference text,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint charges_amount_nonnegative
        check (original_amount >= 0),

    constraint charges_origin_not_blank
        check (btrim(origin) <> ''),

    constraint charges_status_check
        check (
            status in (
                'ACTIVE',
                'VOID'
            )
        ),

    constraint charges_coverage_pair
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

    constraint charges_coverage_year_check
        check (
            coverage_year is null
            or coverage_year between 2000 and 2200
        ),

    constraint charges_coverage_month_check
        check (
            coverage_month is null
            or coverage_month between 1 and 12
        ),

    -- Las FKs compuestas de PostgreSQL usan MATCH SIMPLE:
    -- si una columna es NULL, la validación puede omitirse.
    -- Estas reglas evitan referencias parciales incoherentes.
    constraint charges_enrollment_requires_cycle
        check (
            enrollment_id is null
            or cycle_id is not null
        ),

    constraint charges_plan_period_requires_cycle
        check (
            financial_plan_period_id is null
            or cycle_id is not null
        ),

    constraint charges_agreement_requires_enrollment
        check (
            financial_agreement_id is null
            or enrollment_id is not null
        ),

    -- Si existe enrollment, student y cycle deben corresponder
    -- a esa misma matrícula.
    constraint charges_enrollment_student_cycle_fk
        foreign key (
            enrollment_id,
            student_id,
            cycle_id
        )
        references public.enrollments (
            id,
            student_id,
            cycle_id
        )
        on delete restrict,

    -- Si existe periodo de plan, el concepto debe coincidir.
    constraint charges_plan_period_concept_fk
        foreign key (
            financial_plan_period_id,
            financial_concept_id
        )
        references public.financial_plan_periods (
            id,
            financial_concept_id
        )
        on delete restrict,

    -- Si existe acuerdo financiero, debe corresponder a la
    -- misma matrícula y concepto.
    constraint charges_agreement_enrollment_concept_fk
        foreign key (
            financial_agreement_id,
            enrollment_id,
            financial_concept_id
        )
        references public.student_financial_agreements (
            id,
            enrollment_id,
            financial_concept_id
        )
        on delete restrict,

    -- Necesario para impedir aplicaciones entre alumnos.
    constraint charges_id_student_uq
        unique (id, student_id),

    -- Permite validar que los cargos incluidos en convenios
    -- pertenezcan a la misma matrícula del convenio.
    constraint charges_id_enrollment_uq
        unique (id, enrollment_id)
);


create index charges_student_id_idx
    on public.charges (student_id);

create index charges_enrollment_id_idx
    on public.charges (enrollment_id)
    where enrollment_id is not null;

create index charges_cycle_id_idx
    on public.charges (cycle_id)
    where cycle_id is not null;

create index charges_concept_id_idx
    on public.charges (financial_concept_id);

create index charges_due_date_idx
    on public.charges (due_date);

create index charges_active_student_due_idx
    on public.charges (student_id, due_date)
    where status = 'ACTIVE';


-- ============================================================
-- 2. CHARGE_ADJUSTMENTS
-- ============================================================
-- Modificación auditable al valor de un cargo.
--
-- amount usa signo:
--
--   -500.00  = reduce el cargo
--    300.00  = aumenta el cargo
--
-- De esta forma:
--
-- valor ajustado =
-- original_amount + SUM(adjustments.amount)
--
-- Nunca se modifica original_amount para corregir historia.
-- ============================================================

create table public.charge_adjustments (
    id uuid primary key default gen_random_uuid(),

    charge_id uuid not null
        references public.charges(id)
        on delete restrict,

    amount numeric(12,2) not null,

    adjustment_type text not null,

    reason text not null,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),

    constraint charge_adjustments_amount_nonzero
        check (amount <> 0),

    constraint charge_adjustments_type_check
        check (
            adjustment_type in (
                'DISCOUNT',
                'WAIVER',
                'CORRECTION',
                'WITHDRAWAL',
                'AGREEMENT',
                'OTHER'
            )
        ),

    constraint charge_adjustments_reason_not_blank
        check (btrim(reason) <> '')
);


create index charge_adjustments_charge_id_idx
    on public.charge_adjustments (charge_id);


-- ============================================================
-- 3. PAYMENTS
-- ============================================================
-- Valor efectivamente recibido.
--
-- Un pago pertenece al alumno, NO a un ciclo.
-- Posteriormente puede distribuirse entre cargos de uno o
-- varios ciclos del mismo alumno.
--
-- received_by_name_snapshot conserva el nombre histórico
-- incluso si posteriormente cambia el perfil o se trata
-- de un pago migrado del sistema legacy.
-- ============================================================

create table public.payments (
    id uuid primary key default gen_random_uuid(),

    payment_code text not null,

    student_id uuid not null
        references public.students(id)
        on delete restrict,

    received_at timestamptz not null,

    amount numeric(12,2) not null,

    method text not null,

    status text not null default 'CONFIRMED',

    -- Puede ser NULL para hechos históricos migrados donde
    -- no exista una cuenta Auth equivalente.
    received_by uuid
        references public.profiles(id)
        on delete restrict,

    received_by_name_snapshot text not null,

    notes text,

    legacy_id text,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint payments_payment_code_uq
        unique (payment_code),

    constraint payments_payment_code_not_blank
        check (btrim(payment_code) <> ''),

    constraint payments_amount_positive
        check (amount > 0),

    constraint payments_method_check
        check (
            method in (
                'CASH',
                'TRANSFER',
                'CARD',
                'IN_KIND',
                'OTHER'
            )
        ),

    constraint payments_status_check
        check (
            status in (
                'CONFIRMED',
                'REVERSED'
            )
        ),

    constraint payments_receiver_snapshot_not_blank
        check (
            btrim(received_by_name_snapshot) <> ''
        ),

    -- Pago en especie u otro método requiere explicación.
    constraint payments_special_method_notes
        check (
            method not in ('IN_KIND', 'OTHER')
            or (
                notes is not null
                and btrim(notes) <> ''
            )
        ),

    -- Necesario para FKs compuestas de allocations.
    constraint payments_id_student_uq
        unique (id, student_id)
);


create unique index payments_legacy_id_uq
    on public.payments (legacy_id)
    where legacy_id is not null;

create index payments_student_id_idx
    on public.payments (student_id);

create index payments_received_at_idx
    on public.payments (received_at);

create index payments_received_by_idx
    on public.payments (received_by)
    where received_by is not null;

create index payments_status_idx
    on public.payments (status);


-- ============================================================
-- 4. PAYMENT_ALLOCATIONS
-- ============================================================
-- Aplicación de un pago a un cargo.
--
-- El student_id redundante existe deliberadamente para que
-- PostgreSQL pueda demostrar que pago y cargo pertenecen
-- al MISMO alumno.
--
-- reversed_at conserva historia sin borrar la aplicación.
-- ============================================================

create table public.payment_allocations (
    id uuid primary key default gen_random_uuid(),

    student_id uuid not null
        references public.students(id)
        on delete restrict,

    payment_id uuid not null,

    charge_id uuid not null,

    amount numeric(12,2) not null,

    allocation_mode text not null,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),

    reversed_at timestamptz,

    legacy_id text,

    constraint payment_allocations_amount_positive
        check (amount > 0),

    constraint payment_allocations_mode_check
        check (
            allocation_mode in (
                'AUTO',
                'MANUAL'
            )
        ),

    constraint payment_allocations_reversed_date_check
        check (
            reversed_at is null
            or reversed_at >= created_at
        ),

    constraint payment_allocations_payment_student_fk
        foreign key (
            payment_id,
            student_id
        )
        references public.payments (
            id,
            student_id
        )
        on delete restrict,

    constraint payment_allocations_charge_student_fk
        foreign key (
            charge_id,
            student_id
        )
        references public.charges (
            id,
            student_id
        )
        on delete restrict
);


create unique index payment_allocations_legacy_id_uq
    on public.payment_allocations (legacy_id)
    where legacy_id is not null;

create index payment_allocations_payment_id_idx
    on public.payment_allocations (payment_id);

create index payment_allocations_charge_id_idx
    on public.payment_allocations (charge_id);

create index payment_allocations_active_charge_idx
    on public.payment_allocations (charge_id)
    where reversed_at is null;

create index payment_allocations_active_payment_idx
    on public.payment_allocations (payment_id)
    where reversed_at is null;


-- ============================================================
-- 5. CREDITS
-- ============================================================
-- Saldo a favor generado por valor recibido que no quedó
-- aplicado directamente a cargos.
--
-- NO almacenamos remaining_amount.
--
-- Crédito disponible =
--
-- original_amount
-- - aplicaciones de crédito vigentes
--
-- Si reserved_charge_id tiene valor, el crédito se encuentra
-- reservado para una obligación concreta.
-- ============================================================

create table public.credits (
    id uuid primary key default gen_random_uuid(),

    student_id uuid not null
        references public.students(id)
        on delete restrict,

    source_payment_id uuid not null,

    original_amount numeric(12,2) not null,

    reserved_charge_id uuid,

    status text not null default 'ACTIVE',

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint credits_original_amount_positive
        check (original_amount > 0),

    constraint credits_status_check
        check (
            status in (
                'ACTIVE',
                'VOID'
            )
        ),

    constraint credits_source_payment_student_fk
        foreign key (
            source_payment_id,
            student_id
        )
        references public.payments (
            id,
            student_id
        )
        on delete restrict,

    constraint credits_reserved_charge_student_fk
        foreign key (
            reserved_charge_id,
            student_id
        )
        references public.charges (
            id,
            student_id
        )
        on delete restrict,

    constraint credits_id_student_uq
        unique (id, student_id)
);


create index credits_student_id_idx
    on public.credits (student_id);

create index credits_source_payment_id_idx
    on public.credits (source_payment_id);

create index credits_reserved_charge_id_idx
    on public.credits (reserved_charge_id)
    where reserved_charge_id is not null;

create index credits_active_student_idx
    on public.credits (student_id)
    where status = 'ACTIVE';


-- ============================================================
-- 6. CREDIT_APPLICATIONS
-- ============================================================
-- Uso de un crédito sobre un cargo.
--
-- Igual que payment_allocations, student_id permite asegurar
-- que crédito y cargo pertenecen al mismo alumno.
-- ============================================================

create table public.credit_applications (
    id uuid primary key default gen_random_uuid(),

    student_id uuid not null
        references public.students(id)
        on delete restrict,

    credit_id uuid not null,

    charge_id uuid not null,

    amount numeric(12,2) not null,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),

    reversed_at timestamptz,

    constraint credit_applications_amount_positive
        check (amount > 0),

    constraint credit_applications_reversed_date_check
        check (
            reversed_at is null
            or reversed_at >= created_at
        ),

    constraint credit_applications_credit_student_fk
        foreign key (
            credit_id,
            student_id
        )
        references public.credits (
            id,
            student_id
        )
        on delete restrict,

    constraint credit_applications_charge_student_fk
        foreign key (
            charge_id,
            student_id
        )
        references public.charges (
            id,
            student_id
        )
        on delete restrict
);


create index credit_applications_credit_id_idx
    on public.credit_applications (credit_id);

create index credit_applications_charge_id_idx
    on public.credit_applications (charge_id);

create index credit_applications_active_credit_idx
    on public.credit_applications (credit_id)
    where reversed_at is null;

create index credit_applications_active_charge_idx
    on public.credit_applications (charge_id)
    where reversed_at is null;


-- ============================================================
-- 7. PAYMENT_REVERSALS
-- ============================================================
-- Reverso administrativo de un pago confirmado.
--
-- NO elimina el pago.
-- NO representa una devolución de dinero.
--
-- Un pago sólo puede tener un reverso.
--
-- La operación transaccional que implementemos posteriormente
-- también deberá:
--
-- - marcar payment.status = REVERSED
-- - revertir allocations vigentes
-- - invalidar/revertir créditos derivados
--
-- Eso NO se intenta resolver con un simple trigger aquí.
-- ============================================================

create table public.payment_reversals (
    id uuid primary key default gen_random_uuid(),

    payment_id uuid not null
        references public.payments(id)
        on delete restrict,

    reason text not null,

    reversed_by uuid
        references public.profiles(id)
        on delete restrict,

    reversed_at timestamptz not null default statement_timestamp(),

    constraint payment_reversals_payment_uq
        unique (payment_id),

    constraint payment_reversals_reason_not_blank
        check (btrim(reason) <> '')
);


create index payment_reversals_reversed_at_idx
    on public.payment_reversals (reversed_at);


-- ============================================================
-- 8. REFUNDS
-- ============================================================
-- Devolución REAL de valor recibido.
--
-- Es distinta de payment_reversals:
--
-- reversal = corregir/anular una operación errónea
-- refund   = devolver dinero/valor posteriormente
--
-- Puede haber más de un refund parcial para un mismo pago.
--
-- La regla:
--
-- SUM(refunds.amount) <= payment.amount
--
-- requiere validación transaccional y se implementará
-- posteriormente; no puede garantizarse con CHECK de fila.
-- ============================================================

create table public.refunds (
    id uuid primary key default gen_random_uuid(),

    payment_id uuid not null
        references public.payments(id)
        on delete restrict,

    amount numeric(12,2) not null,

    reason text not null,

    refunded_at timestamptz not null,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    authorized_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),

    constraint refunds_amount_positive
        check (amount > 0),

    constraint refunds_reason_not_blank
        check (btrim(reason) <> '')
);


create index refunds_payment_id_idx
    on public.refunds (payment_id);

create index refunds_refunded_at_idx
    on public.refunds (refunded_at);


-- ============================================================
-- RLS
-- ============================================================
-- Policies y GRANTs se definirán posteriormente junto con
-- permissions.md y la arquitectura de autorización.
-- ============================================================

alter table public.charges
    enable row level security;

alter table public.charge_adjustments
    enable row level security;

alter table public.payments
    enable row level security;

alter table public.payment_allocations
    enable row level security;

alter table public.credits
    enable row level security;

alter table public.credit_applications
    enable row level security;

alter table public.payment_reversals
    enable row level security;

alter table public.refunds
    enable row level security;