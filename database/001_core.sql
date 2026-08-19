-- ============================================================
-- APP REAL
-- BLOQUE 1: Identidad, estructura escolar y matrícula
-- ============================================================


-- ============================================================
-- 1. PROFILES
-- ============================================================

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp()
);


-- ============================================================
-- 2. STUDENTS
-- ============================================================

create table public.students (
    id uuid primary key default gen_random_uuid(),

    student_code text,
    full_name text not null,
    sex text,
    birth_date date,

    legacy_id text,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint students_student_code_not_blank
        check (student_code is null or btrim(student_code) <> ''),

    constraint students_full_name_not_blank
        check (btrim(full_name) <> ''),

    constraint students_sex_check
        check (sex is null or sex in ('F', 'M'))
);

create unique index students_student_code_uq
    on public.students (student_code)
    where student_code is not null;

create unique index students_legacy_id_uq
    on public.students (legacy_id)
    where legacy_id is not null;


-- ============================================================
-- 3. GUARDIANS
-- ============================================================

create table public.guardians (
    id uuid primary key default gen_random_uuid(),

    full_name text not null,
    phone text,
    email text,

    auth_user_id uuid
        references auth.users(id)
        on delete set null,

    legacy_id text,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint guardians_full_name_not_blank
        check (btrim(full_name) <> ''),

    constraint guardians_phone_not_blank
        check (phone is null or btrim(phone) <> ''),

    constraint guardians_email_not_blank
        check (email is null or btrim(email) <> '')
);

-- Un tutor real puede tener como máximo una cuenta.
create unique index guardians_auth_user_id_uq
    on public.guardians (auth_user_id)
    where auth_user_id is not null;

-- El mismo email no debe crear dos identidades de tutor.
-- lower() evita duplicados por mayúsculas/minúsculas.
create unique index guardians_email_uq
    on public.guardians (lower(btrim(email)))
    where email is not null;

create unique index guardians_legacy_id_uq
    on public.guardians (legacy_id)
    where legacy_id is not null;


-- ============================================================
-- 4. STUDENT_GUARDIANS
-- ============================================================

create table public.student_guardians (
    id uuid primary key default gen_random_uuid(),

    student_id uuid not null
        references public.students(id)
        on delete restrict,

    guardian_id uuid not null
        references public.guardians(id)
        on delete restrict,

    relationship text not null,
    priority smallint not null,

    via_whatsapp boolean not null,
    via_email boolean not null,

    is_active boolean not null default true,
    started_at date not null default current_date,
    ended_at date,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint student_guardians_relationship_not_blank
        check (btrim(relationship) <> ''),

    constraint student_guardians_priority_positive
        check (priority > 0),

    constraint student_guardians_dates_check
        check (ended_at is null or ended_at >= started_at),

    constraint student_guardians_student_guardian_uq
        unique (student_id, guardian_id)
);

create index student_guardians_guardian_id_idx
    on public.student_guardians (guardian_id);

create index student_guardians_active_student_idx
    on public.student_guardians (student_id)
    where is_active = true;


-- ============================================================
-- 5. SCHOOL_CYCLES
-- ============================================================

create table public.school_cycles (
    id uuid primary key default gen_random_uuid(),

    code text not null,
    name text not null,

    starts_on date not null,
    ends_on date not null,

    status text not null default 'PREPARATION',

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint school_cycles_code_uq
        unique (code),

    constraint school_cycles_code_not_blank
        check (btrim(code) <> ''),

    constraint school_cycles_name_not_blank
        check (btrim(name) <> ''),

    constraint school_cycles_dates_check
        check (ends_on >= starts_on),

    constraint school_cycles_status_check
        check (status in ('PREPARATION', 'ACTIVE', 'CLOSED'))
);


-- ============================================================
-- 6. EDUCATION_LEVELS
-- ============================================================

create table public.education_levels (
    id uuid primary key default gen_random_uuid(),

    code text not null,
    name text not null,
    sort_order integer not null,
    is_active boolean not null default true,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint education_levels_code_uq unique (code),

    constraint education_levels_code_not_blank
        check (btrim(code) <> ''),

    constraint education_levels_name_not_blank
        check (btrim(name) <> ''),

    constraint education_levels_sort_order_positive
        check (sort_order > 0)
);


-- ============================================================
-- 7. GRADE_LEVELS
-- ============================================================

create table public.grade_levels (
    id uuid primary key default gen_random_uuid(),

    education_level_id uuid not null
        references public.education_levels(id)
        on delete restrict,

    code text not null,
    name text not null,
    sort_order integer not null,

    is_terminal boolean not null default false,
    is_active boolean not null default true,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint grade_levels_code_not_blank
        check (btrim(code) <> ''),

    constraint grade_levels_name_not_blank
        check (btrim(name) <> ''),

    constraint grade_levels_sort_order_positive
        check (sort_order > 0),

    constraint grade_levels_level_code_uq
        unique (education_level_id, code),

    -- Permite validar relaciones que declaran explícitamente
    -- grado + nivel educativo.
    constraint grade_levels_id_education_level_uq
        unique (id, education_level_id)
);

create index grade_levels_education_level_id_idx
    on public.grade_levels (education_level_id);


-- ============================================================
-- 8. GROUPS
-- ============================================================

create table public.groups (
    id uuid primary key default gen_random_uuid(),

    cycle_id uuid not null
        references public.school_cycles(id)
        on delete restrict,

    grade_level_id uuid not null
        references public.grade_levels(id)
        on delete restrict,

    code text not null,
    name text not null,

    is_active boolean not null default true,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint groups_code_not_blank
        check (btrim(code) <> ''),

    constraint groups_name_not_blank
        check (btrim(name) <> ''),

    constraint groups_cycle_grade_code_uq
        unique (cycle_id, grade_level_id, code),

    -- Permite posteriormente validar que un enrollment pertenece
    -- al mismo ciclo y grado que su grupo.
    constraint groups_id_cycle_grade_uq
        unique (id, cycle_id, grade_level_id)
);

create index groups_cycle_id_idx
    on public.groups (cycle_id);

create index groups_grade_level_id_idx
    on public.groups (grade_level_id);


-- ============================================================
-- 9. ENROLLMENT_CLASSIFICATIONS
-- ============================================================

create table public.enrollment_classifications (
    id uuid primary key default gen_random_uuid(),

    code text not null,
    name text not null,

    counts_for_sep boolean not null default false,
    counts_for_campus boolean not null default true,
    participates_academically boolean not null default true,

    is_active boolean not null default true,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint enrollment_classifications_code_uq
        unique (code),

    constraint enrollment_classifications_code_not_blank
        check (btrim(code) <> ''),

    constraint enrollment_classifications_name_not_blank
        check (btrim(name) <> '')
);


-- ============================================================
-- 10. ENROLLMENTS
-- ============================================================

create table public.enrollments (
    id uuid primary key default gen_random_uuid(),

    student_id uuid not null
        references public.students(id)
        on delete restrict,

    cycle_id uuid not null
        references public.school_cycles(id)
        on delete restrict,

    grade_level_id uuid not null
        references public.grade_levels(id)
        on delete restrict,

    group_id uuid,

    classification_id uuid not null
        references public.enrollment_classifications(id)
        on delete restrict,

    -- NULL = hereda la configuración de la clasificación.
    -- true/false = override explícito para esta matrícula.
    academic_participation_override boolean,

    status text not null default 'PENDIENTE',

    enrolled_on date not null,
    classes_start_on date,
    closed_on date,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    legacy_id text,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint enrollments_student_cycle_uq
        unique (student_id, cycle_id),

    constraint enrollments_status_check
        check (
            status in (
                'PREINSCRITA',
                'PENDIENTE',
                'ACTIVA',
                'BAJA',
                'FINALIZADA',
                'NO_CONTINUA',
                'EGRESADA'
            )
        ),

    constraint enrollments_dates_check
        check (
            closed_on is null
            or closed_on >= enrolled_on
        ),

    -- Si existe grupo, obliga a que sea del mismo ciclo y grado
    -- declarados en la matrícula.
    constraint enrollments_group_cycle_grade_fk
        foreign key (group_id, cycle_id, grade_level_id)
        references public.groups(id, cycle_id, grade_level_id)
        on delete restrict
);

create unique index enrollments_legacy_id_uq
    on public.enrollments (legacy_id)
    where legacy_id is not null;

create index enrollments_cycle_id_idx
    on public.enrollments (cycle_id);

create index enrollments_grade_level_id_idx
    on public.enrollments (grade_level_id);

create index enrollments_group_id_idx
    on public.enrollments (group_id)
    where group_id is not null;

create index enrollments_classification_id_idx
    on public.enrollments (classification_id);

create index enrollments_status_idx
    on public.enrollments (status);


-- ============================================================
-- 11. ENROLLMENT_EVENTS
-- ============================================================

create table public.enrollment_events (
    id uuid primary key default gen_random_uuid(),

    enrollment_id uuid not null
        references public.enrollments(id)
        on delete restrict,

    event_type text not null,
    effective_on date not null,

    reason text,
    notes text,

    old_values jsonb,
    new_values jsonb,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    recorded_at timestamptz not null default statement_timestamp(),

    constraint enrollment_events_type_check
        check (
            event_type in (
                'ENROLLED',
                'ACTIVATED',
                'GROUP_CHANGED',
                'CLASSIFICATION_CHANGED',
                'WITHDRAWN',
                'REACTIVATED',
                'FINALIZED',
                'MARKED_NO_CONTINUA',
                'GRADUATED'
            )
        )
);

create index enrollment_events_enrollment_id_idx
    on public.enrollment_events (enrollment_id);

create index enrollment_events_effective_on_idx
    on public.enrollment_events (effective_on);


-- ============================================================
-- 12. ENROLLMENT_FINANCIAL_EXITS
-- ============================================================

create table public.enrollment_financial_exits (
    id uuid primary key default gen_random_uuid(),

    enrollment_event_id uuid not null
        references public.enrollment_events(id)
        on delete restrict,

    mode text not null,
    reason text not null,

    authorized_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),

    constraint enrollment_financial_exits_event_uq
        unique (enrollment_event_id),

    constraint enrollment_financial_exits_mode_check
        check (
            mode in (
                'STOP_FUTURE',
                'KEEP_REMAINING',
                'CUSTOM'
            )
        ),

    constraint enrollment_financial_exits_reason_not_blank
        check (btrim(reason) <> '')
);


-- ============================================================
-- RLS
-- ============================================================
-- Aunque el proyecto tiene activado Auto-RLS para nuevas tablas,
-- lo declaramos explícitamente para que este SQL sea autocontenido.

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.school_cycles enable row level security;
alter table public.education_levels enable row level security;
alter table public.grade_levels enable row level security;
alter table public.groups enable row level security;
alter table public.enrollment_classifications enable row level security;
alter table public.enrollments enable row level security;
alter table public.enrollment_events enable row level security;
alter table public.enrollment_financial_exits enable row level security;