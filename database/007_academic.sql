-- ============================================================
-- APP REAL
-- 007_academic.sql
--
-- Dominio académico:
-- - catálogo de materias
-- - configuración curricular por ciclo/grado
-- - periodos de evaluación
-- - asignaciones docentes históricas
-- - evaluaciones
-- - publicación a familias
-- ============================================================


-- ============================================================
-- CONSTRAINT AUXILIAR
-- ============================================================
-- Permite verificar posteriormente que publicaciones y otras
-- relaciones pertenecen al mismo ciclo que el grupo.

alter table public.groups
    add constraint groups_id_cycle_uq
    unique (id, cycle_id);

-- Permite validar que una evaluación use el mismo ciclo y
-- grado de la matrícula, sin depender del estado actual del
-- grupo.
alter table public.enrollments
    add constraint enrollments_id_cycle_grade_uq
    unique (id, cycle_id, grade_level_id);


-- ============================================================
-- 1. SUBJECTS
-- ============================================================
-- Catálogo reusable.
--
-- Ejemplos:
-- Lenguajes
-- Inglés
-- Educación Física
-- Artes
-- Francés
-- ============================================================

create table public.subjects (
    id uuid primary key default gen_random_uuid(),

    code text not null,
    name text not null,

    sort_order integer not null,
    is_active boolean not null default true,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint subjects_code_uq
        unique (code),

    constraint subjects_code_not_blank
        check (btrim(code) <> ''),

    constraint subjects_name_not_blank
        check (btrim(name) <> ''),

    constraint subjects_sort_order_positive
        check (sort_order > 0)
);


-- ============================================================
-- 2. CURRICULUM_SUBJECTS
-- ============================================================
-- Habilitación/configuración de una materia para un grado
-- durante un ciclo concreto.
--
-- Ejemplo:
--
-- 2026-27
-- Primaria 3°
-- Inglés
-- cuantitativa + cualitativa
--
-- Si Inglés aplica a seis grados de Primaria se crean seis
-- configuraciones explícitas.
-- ============================================================

create table public.curriculum_subjects (
    id uuid primary key default gen_random_uuid(),

    cycle_id uuid not null
        references public.school_cycles(id)
        on delete restrict,

    grade_level_id uuid not null
        references public.grade_levels(id)
        on delete restrict,

    subject_id uuid not null
        references public.subjects(id)
        on delete restrict,

    quantitative_enabled boolean not null default true,
    qualitative_enabled boolean not null default true,

    quantitative_min numeric(4,2),
    quantitative_max numeric(4,2),

    -- Operación actual: 250.
    qualitative_max_length integer,

    sort_order integer not null,

    is_active boolean not null default true,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint curriculum_subjects_cycle_grade_subject_uq
        unique (
            cycle_id,
            grade_level_id,
            subject_id
        ),

    constraint curriculum_subjects_evaluation_enabled_check
        check (
            quantitative_enabled = true
            or qualitative_enabled = true
        ),

    constraint curriculum_subjects_quantitative_config_check
        check (
            (
                quantitative_enabled = true
                and quantitative_min is not null
                and quantitative_max is not null
                and quantitative_max >= quantitative_min
            )
            or
            (
                quantitative_enabled = false
                and quantitative_min is null
                and quantitative_max is null
            )
        ),

    constraint curriculum_subjects_qualitative_config_check
        check (
            (
                qualitative_enabled = true
                and qualitative_max_length is not null
                and qualitative_max_length > 0
            )
            or
            (
                qualitative_enabled = false
                and qualitative_max_length is null
            )
        ),

    constraint curriculum_subjects_sort_order_positive
        check (sort_order > 0),

    -- Necesario para validar teacher_assignments.
    constraint curriculum_subjects_id_cycle_grade_uq
        unique (
            id,
            cycle_id,
            grade_level_id
        )
);


create index curriculum_subjects_cycle_idx
    on public.curriculum_subjects (cycle_id);

create index curriculum_subjects_grade_idx
    on public.curriculum_subjects (grade_level_id);

create index curriculum_subjects_subject_idx
    on public.curriculum_subjects (subject_id);


-- ============================================================
-- 3. EVALUATION_PERIODS
-- ============================================================
-- El periodo NO es un módulo.
--
-- Controla la ventana de captura dentro de Evaluar.
--
-- Estados:
-- CLOSED         -> no captura
-- OPEN           -> captura/modificación permitida
-- CAPTURE_CLOSED -> captura ordinaria bloqueada
--
-- Publicación familiar se controla aparte.
-- ============================================================

create table public.evaluation_periods (
    id uuid primary key default gen_random_uuid(),

    cycle_id uuid not null
        references public.school_cycles(id)
        on delete restrict,

    code text not null,
    name text not null,

    sort_order integer not null,

    capture_status text not null default 'CLOSED',

    opened_at timestamptz,

    opened_by uuid
        references public.profiles(id)
        on delete restrict,

    closed_at timestamptz,

    closed_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint evaluation_periods_cycle_code_uq
        unique (cycle_id, code),

    constraint evaluation_periods_cycle_sort_uq
        unique (cycle_id, sort_order),

    constraint evaluation_periods_code_not_blank
        check (btrim(code) <> ''),

    constraint evaluation_periods_name_not_blank
        check (btrim(name) <> ''),

    constraint evaluation_periods_sort_order_positive
        check (sort_order > 0),

    constraint evaluation_periods_capture_status_check
        check (
            capture_status in (
                'CLOSED',
                'OPEN',
                'CAPTURE_CLOSED'
            )
        ),

    constraint evaluation_periods_id_cycle_uq
        unique (id, cycle_id)
);


create index evaluation_periods_cycle_idx
    on public.evaluation_periods (cycle_id);

create index evaluation_periods_capture_status_idx
    on public.evaluation_periods (capture_status);


-- ============================================================
-- 4. TEACHER_ASSIGNMENTS
-- ============================================================
-- Relación explícita:
--
-- profesor + materia configurada + grupo + vigencia
--
-- Las asignaciones son HISTÓRICAS.
--
-- Si cambia el profesor:
-- - se cierra valid_until de la asignación anterior
-- - se crea otra
--
-- No se sobrescribe historia.
-- ============================================================

create table public.teacher_assignments (
    id uuid primary key default gen_random_uuid(),

    teacher_profile_id uuid not null
        references public.profiles(id)
        on delete restrict,

    curriculum_subject_id uuid not null,

    group_id uuid not null,

    -- Se guardan también para poder imponer consistencia
    -- estructural entre curriculum y grupo.
    cycle_id uuid not null,
    grade_level_id uuid not null,

    valid_from date not null,
    valid_until date,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint teacher_assignments_dates_check
        check (
            valid_until is null
            or valid_until >= valid_from
        ),

    constraint teacher_assignments_curriculum_fk
        foreign key (
            curriculum_subject_id,
            cycle_id,
            grade_level_id
        )
        references public.curriculum_subjects (
            id,
            cycle_id,
            grade_level_id
        )
        on delete restrict,

    constraint teacher_assignments_group_fk
        foreign key (
            group_id,
            cycle_id,
            grade_level_id
        )
        references public.groups (
            id,
            cycle_id,
            grade_level_id
        )
        on delete restrict,

    constraint teacher_assignments_id_group_curriculum_uq
        unique (
            id,
            group_id,
            curriculum_subject_id
        )
);


-- Un mismo profesor no debe tener duplicada la misma
-- asignación con vigencias solapadas.
--
-- Esto NO impide que dos profesores estén asignados al mismo
-- grupo/materia si algún día existe co-docencia.

alter table public.teacher_assignments
    add constraint teacher_assignments_no_self_overlap
    exclude using gist (
        teacher_profile_id with =,
        curriculum_subject_id with =,
        group_id with =,
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


create index teacher_assignments_teacher_idx
    on public.teacher_assignments (teacher_profile_id);

create index teacher_assignments_group_idx
    on public.teacher_assignments (group_id);

create index teacher_assignments_curriculum_idx
    on public.teacher_assignments (curriculum_subject_id);

create index teacher_assignments_cycle_idx
    on public.teacher_assignments (cycle_id);


-- ============================================================
-- 5. STUDENT_EVALUATIONS
-- ============================================================
-- Una evaluación concreta:
--
-- matrícula + materia + periodo
--
-- La evaluación conserva además:
--
-- - grupo histórico en el momento de captura
-- - asignación docente utilizada, cuando aplica
-- - usuario creador
-- - usuario de última modificación
--
-- group_id NO depende del group_id ACTUAL del enrollment.
-- Es snapshot histórico del contexto académico.
-- ============================================================

create table public.student_evaluations (
    id uuid primary key default gen_random_uuid(),

    enrollment_id uuid not null,

    evaluation_period_id uuid not null,

    curriculum_subject_id uuid not null,

    group_id uuid not null,

    -- Redundancia técnica deliberada para imponer que
    -- matrícula, periodo, materia y grupo pertenezcan al mismo
    -- ciclo/grado.
    cycle_id uuid not null,
    grade_level_id uuid not null,

    teacher_assignment_id uuid,

    -- numeric permite conservar flexibilidad técnica.
    -- En la operación actual el frontend usa enteros 6-10.
    quantitative_value numeric(4,2),

    qualitative_comment text,

    created_by uuid not null
        references public.profiles(id)
        on delete restrict,

    updated_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint student_evaluations_unique_evaluation
        unique (
            enrollment_id,
            evaluation_period_id,
            curriculum_subject_id
        ),

    -- La matrícula fija ciclo y grado.
    constraint student_evaluations_enrollment_context_fk
        foreign key (
            enrollment_id,
            cycle_id,
            grade_level_id
        )
        references public.enrollments (
            id,
            cycle_id,
            grade_level_id
        )
        on delete restrict,

    -- El periodo debe pertenecer al mismo ciclo.
    constraint student_evaluations_period_cycle_fk
        foreign key (
            evaluation_period_id,
            cycle_id
        )
        references public.evaluation_periods (
            id,
            cycle_id
        )
        on delete restrict,

    -- La materia curricular debe pertenecer al mismo ciclo/grado.
    constraint student_evaluations_curriculum_context_fk
        foreign key (
            curriculum_subject_id,
            cycle_id,
            grade_level_id
        )
        references public.curriculum_subjects (
            id,
            cycle_id,
            grade_level_id
        )
        on delete restrict,

    -- group_id es snapshot histórico; se exige que sea un grupo
    -- válido del mismo ciclo/grado, pero NO que siga siendo el
    -- group_id actual del enrollment.
    constraint student_evaluations_group_context_fk
        foreign key (
            group_id,
            cycle_id,
            grade_level_id
        )
        references public.groups (
            id,
            cycle_id,
            grade_level_id
        )
        on delete restrict,

    -- Si se registra una asignación docente, debe ser
    -- exactamente la de ese grupo y materia.
    constraint student_evaluations_teacher_assignment_fk
        foreign key (
            teacher_assignment_id,
            group_id,
            curriculum_subject_id
        )
        references public.teacher_assignments (
            id,
            group_id,
            curriculum_subject_id
        )
        on delete restrict,

    -- Límite físico amplio.
    -- La configuración concreta 6-10 se valida contra
    -- curriculum_subjects en la operación transaccional.
    constraint student_evaluations_quantitative_range
        check (
            quantitative_value is null
            or quantitative_value between 0 and 10
        ),

    -- El máximo configurable puede variar, pero nunca dejamos
    -- crecer arbitrariamente el campo.
    constraint student_evaluations_qualitative_absolute_max
        check (
            qualitative_comment is null
            or char_length(qualitative_comment) <= 1000
        ),

    constraint student_evaluations_has_value
        check (
            quantitative_value is not null
            or (
                qualitative_comment is not null
                and btrim(qualitative_comment) <> ''
            )
        )
);


create index student_evaluations_enrollment_idx
    on public.student_evaluations (enrollment_id);

create index student_evaluations_period_idx
    on public.student_evaluations (evaluation_period_id);

create index student_evaluations_curriculum_idx
    on public.student_evaluations (curriculum_subject_id);

create index student_evaluations_group_idx
    on public.student_evaluations (group_id);

create index student_evaluations_teacher_assignment_idx
    on public.student_evaluations (teacher_assignment_id)
    where teacher_assignment_id is not null;


-- ============================================================
-- 6. GROUP_PERIOD_PUBLICATIONS
-- ============================================================
-- Control separado de publicación familiar.
--
-- Cerrar captura NO publica.
--
-- Se publica:
--
-- grupo + periodo
--
-- Por eso 3° A y 3° B pueden publicarse de forma independiente.
-- ============================================================

create table public.group_period_publications (
    id uuid primary key default gen_random_uuid(),

    group_id uuid not null,

    evaluation_period_id uuid not null,

    cycle_id uuid not null,

    status text not null default 'NOT_PUBLISHED',

    published_at timestamptz,

    published_by uuid
        references public.profiles(id)
        on delete restrict,

    revoked_at timestamptz,

    revoked_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint group_period_publications_group_period_uq
        unique (
            group_id,
            evaluation_period_id
        ),

    constraint group_period_publications_status_check
        check (
            status in (
                'NOT_PUBLISHED',
                'PUBLISHED'
            )
        ),

    constraint group_period_publications_group_cycle_fk
        foreign key (
            group_id,
            cycle_id
        )
        references public.groups (
            id,
            cycle_id
        )
        on delete restrict,

    constraint group_period_publications_period_cycle_fk
        foreign key (
            evaluation_period_id,
            cycle_id
        )
        references public.evaluation_periods (
            id,
            cycle_id
        )
        on delete restrict,

    constraint group_period_publications_publish_state_check
        check (
            (
                status = 'PUBLISHED'
                and published_at is not null
                and published_by is not null
            )
            or
            (
                status = 'NOT_PUBLISHED'
            )
        )
);


create index group_period_publications_group_idx
    on public.group_period_publications (group_id);

create index group_period_publications_period_idx
    on public.group_period_publications (evaluation_period_id);

create index group_period_publications_published_idx
    on public.group_period_publications (group_id, evaluation_period_id)
    where status = 'PUBLISHED';


-- ============================================================
-- RLS
-- ============================================================
-- Policies se definirán posteriormente.
--
-- Profesor:
--   acceso derivado de teacher_assignments.
--
-- Tutor:
--   acceso derivado de family_access + publicación + estado
--   financiero.
--
-- Administrativo/Master:
--   capacidades derivadas del modelo RBAC.
-- ============================================================

alter table public.subjects
    enable row level security;

alter table public.curriculum_subjects
    enable row level security;

alter table public.evaluation_periods
    enable row level security;

alter table public.teacher_assignments
    enable row level security;

alter table public.student_evaluations
    enable row level security;

alter table public.group_period_publications
    enable row level security;