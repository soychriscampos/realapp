-- ============================================================
-- APP REAL
-- 005_family_access_and_auth.sql
--
-- Incluye:
-- - onboarding familiar
-- - acceso digital tutor -> alumno
-- - roles de aplicación
-- - permisos
-- - asignación de permisos a roles
-- - asignación de roles a usuarios
--
-- IMPORTANTE:
-- guardians representa PERSONAS.
-- auth.users representa CUENTAS.
-- family_access representa AUTORIZACIÓN DIGITAL.
-- ============================================================


-- ============================================================
-- 1. FAMILY_INVITATIONS
-- ============================================================
-- El colegio genera una invitación para un guardian que YA
-- existe en la base.
--
-- Ejemplo:
--
-- Alumno
--   └── Tutor 1: María López
--          [ Generar onboarding ]
--
-- La invitación NO crea al tutor.
-- El tutor ya existe en guardians y está relacionado con el
-- alumno mediante student_guardians.
--
-- token_hash guarda únicamente el hash del token.
-- Nunca almacenamos el token de onboarding en texto plano.
-- ============================================================

create table public.family_invitations (
    id uuid primary key default gen_random_uuid(),

    guardian_id uuid not null
        references public.guardians(id)
        on delete restrict,

    token_hash bytea not null,

    status text not null default 'PENDING',

    expires_at timestamptz not null,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    accepted_by uuid
        references public.profiles(id)
        on delete restrict,

    accepted_at timestamptz,

    revoked_by uuid
        references public.profiles(id)
        on delete restrict,

    revoked_at timestamptz,

    revocation_reason text,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint family_invitations_token_hash_uq
        unique (token_hash),

    constraint family_invitations_status_check
        check (
            status in (
                'PENDING',
                'ACCEPTED',
                'REVOKED'
            )
        ),

    constraint family_invitations_expiration_check
        check (
            expires_at > created_at
        ),

    constraint family_invitations_accepted_state_check
        check (
            (
                status = 'ACCEPTED'
                and accepted_at is not null
            )
            or
            (
                status <> 'ACCEPTED'
            )
        ),

    constraint family_invitations_revoked_state_check
        check (
            (
                status = 'REVOKED'
                and revoked_at is not null
                and revocation_reason is not null
                and btrim(revocation_reason) <> ''
            )
            or
            (
                status <> 'REVOKED'
            )
        ),

    -- Necesaria para FKs compuestas posteriores.
    constraint family_invitations_id_guardian_uq
        unique (
            id,
            guardian_id
        )
);


create index family_invitations_guardian_idx
    on public.family_invitations (guardian_id);

create index family_invitations_pending_idx
    on public.family_invitations (guardian_id, expires_at)
    where status = 'PENDING';


-- ============================================================
-- 2. FAMILY_INVITATION_STUDENTS
-- ============================================================
-- Una misma invitación puede conceder posteriormente acceso
-- a varios hermanos.
--
-- guardian_id parece redundante porque puede obtenerse desde
-- family_invitations, pero se conserva deliberadamente para
-- permitir a PostgreSQL verificar que:
--
-- 1. la invitación pertenece a ese tutor;
-- 2. ese tutor YA tiene relación administrativa con el alumno.
--
-- Así una invitación nunca puede agregar accidentalmente a un
-- niño que no está relacionado con el tutor.
-- ============================================================

create table public.family_invitation_students (
    invitation_id uuid not null,

    guardian_id uuid not null,

    student_id uuid not null,

    created_at timestamptz not null default statement_timestamp(),

    primary key (
        invitation_id,
        student_id
    ),

    constraint family_invitation_students_invitation_guardian_fk
        foreign key (
            invitation_id,
            guardian_id
        )
        references public.family_invitations (
            id,
            guardian_id
        )
        on delete restrict,

    constraint family_invitation_students_guardian_relation_fk
        foreign key (
            student_id,
            guardian_id
        )
        references public.student_guardians (
            student_id,
            guardian_id
        )
        on delete restrict,

    -- Necesaria para comprobar después que un family_access
    -- originado por una invitación estaba incluido en ella.
    constraint family_invitation_students_invitation_student_uq
        unique (
            invitation_id,
            student_id
        )
);


create index family_invitation_students_guardian_idx
    on public.family_invitation_students (guardian_id);

create index family_invitation_students_student_idx
    on public.family_invitation_students (student_id);


-- ============================================================
-- 3. FAMILY_ACCESS
-- ============================================================
-- Autorización digital explícita tutor -> alumno.
--
-- student_guardians:
--   "María es mamá de Ana."
--
-- family_access:
--   "La cuenta de María puede entrar al portal de Ana."
--
-- auth_user_id NO se repite aquí.
--
-- Se obtiene mediante:
--
-- family_access.guardian_id
--          ↓
-- guardians.auth_user_id
--          ↓
-- auth.users.id
--
-- invitation_id es NULLABLE porque un tutor que ya tiene cuenta
-- puede recibir acceso posteriormente a otro hijo sin repetir
-- onboarding.
-- ============================================================

create table public.family_access (
    id uuid primary key default gen_random_uuid(),

    guardian_id uuid not null
        references public.guardians(id)
        on delete restrict,

    student_id uuid not null
        references public.students(id)
        on delete restrict,

    invitation_id uuid,

    status text not null default 'ACTIVE',

    granted_at timestamptz not null default statement_timestamp(),

    granted_by uuid
        references public.profiles(id)
        on delete restrict,

    revoked_at timestamptz,

    revoked_by uuid
        references public.profiles(id)
        on delete restrict,

    revocation_reason text,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint family_access_status_check
        check (
            status in (
                'ACTIVE',
                'REVOKED'
            )
        ),

    -- El tutor debe existir como tutor administrativo
    -- del alumno antes de recibir acceso digital.
    constraint family_access_guardian_relation_fk
        foreign key (
            student_id,
            guardian_id
        )
        references public.student_guardians (
            student_id,
            guardian_id
        )
        on delete restrict,

    -- Si el acceso se originó en una invitación, esa invitación
    -- debe pertenecer al mismo guardian.
    constraint family_access_invitation_guardian_fk
        foreign key (
            invitation_id,
            guardian_id
        )
        references public.family_invitations (
            id,
            guardian_id
        )
        on delete restrict,

    -- Si hubo invitación, el alumno debe haber estado
    -- explícitamente incluido en ella.
    constraint family_access_invitation_student_fk
        foreign key (
            invitation_id,
            student_id
        )
        references public.family_invitation_students (
            invitation_id,
            student_id
        )
        on delete restrict,

    constraint family_access_revoked_state_check
        check (
            (
                status = 'REVOKED'
                and revoked_at is not null
                and revocation_reason is not null
                and btrim(revocation_reason) <> ''
            )
            or
            (
                status = 'ACTIVE'
                and revoked_at is null
            )
        )
);


-- Un mismo tutor no puede tener dos accesos ACTIVOS
-- simultáneos al mismo alumno.
create unique index family_access_active_guardian_student_uq
    on public.family_access (
        guardian_id,
        student_id
    )
    where status = 'ACTIVE';


create index family_access_student_idx
    on public.family_access (student_id);

create index family_access_guardian_idx
    on public.family_access (guardian_id);

create index family_access_invitation_idx
    on public.family_access (invitation_id)
    where invitation_id is not null;


-- ============================================================
-- NOTA SOBRE EL LÍMITE DE 2 CUENTAS FAMILIARES
-- ============================================================
--
-- Regla funcional:
--
-- máximo DOS cuentas familiares activas distintas por alumno.
--
-- Normalmente habrá sólo una.
--
-- Ejemplo:
--
-- Ana + Luis (hermanos)
--
-- Cuenta familiar 1:
--   María -> Ana
--   María -> Luis
--
-- Cuenta familiar 2 (opcional):
--   José -> Ana
--   José -> Luis
--
-- El límite de dos NO puede implementarse correctamente con
-- un CHECK de una sola fila.
--
-- Se validará de manera transaccional cuando implementemos la
-- operación que concede family_access.
--
-- NO se implementa aquí mediante trigger improvisado.


-- ============================================================
-- 4. ROLES
-- ============================================================
-- Roles funcionales de App REAL.
--
-- NO son roles PostgreSQL.
--
-- Catálogo inicial esperado:
--
-- MASTER
-- ADMINISTRATIVO
-- PROFESOR
-- TUTOR
--
-- Pero el catálogo es extensible:
--
-- CAJAS
-- COORDINACION
-- etc.
-- ============================================================

create table public.roles (
    id uuid primary key default gen_random_uuid(),

    code text not null,
    name text not null,

    is_system boolean not null default false,
    is_active boolean not null default true,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint roles_code_uq
        unique (code),

    constraint roles_code_not_blank
        check (btrim(code) <> ''),

    constraint roles_name_not_blank
        check (btrim(name) <> '')
);


-- ============================================================
-- 5. STAFF_INVITATIONS
-- ============================================================
-- Onboarding general para personal interno.
--
-- Sirve para profesores, administrativos, cajas, coordinación
-- y otros roles futuros.
--
-- A diferencia del onboarding familiar, aquí la persona todavía
-- puede no existir en profiles porque su cuenta Auth se crea al
-- aceptar la invitación.
--
-- La invitación conserva el nombre, correo y rol inicial que
-- Master/administración preparó antes del registro.
-- ============================================================

create table public.staff_invitations (
    id uuid primary key default gen_random_uuid(),

    full_name text not null,
    email text not null,

    initial_role_id uuid not null
        references public.roles(id)
        on delete restrict,

    token_hash bytea not null,

    status text not null default 'PENDING',

    expires_at timestamptz not null,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    -- Se llena después de crear auth.users + profiles.
    accepted_user_id uuid
        references public.profiles(id)
        on delete restrict,

    accepted_at timestamptz,

    revoked_by uuid
        references public.profiles(id)
        on delete restrict,

    revoked_at timestamptz,
    revocation_reason text,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint staff_invitations_full_name_not_blank
        check (btrim(full_name) <> ''),

    constraint staff_invitations_email_not_blank
        check (btrim(email) <> ''),

    constraint staff_invitations_token_hash_uq
        unique (token_hash),

    constraint staff_invitations_status_check
        check (
            status in (
                'PENDING',
                'ACCEPTED',
                'REVOKED'
            )
        ),

    constraint staff_invitations_expiration_check
        check (expires_at > created_at),

    constraint staff_invitations_accepted_state_check
        check (
            (
                status = 'ACCEPTED'
                and accepted_user_id is not null
                and accepted_at is not null
            )
            or
            (
                status <> 'ACCEPTED'
            )
        ),

    constraint staff_invitations_revoked_state_check
        check (
            (
                status = 'REVOKED'
                and revoked_at is not null
                and revocation_reason is not null
                and btrim(revocation_reason) <> ''
            )
            or
            (
                status <> 'REVOKED'
            )
        )
);


-- Sólo una invitación pendiente por correo.
-- lower/btrim evita duplicados por mayúsculas o espacios.
create unique index staff_invitations_pending_email_uq
    on public.staff_invitations (lower(btrim(email)))
    where status = 'PENDING';

create index staff_invitations_initial_role_idx
    on public.staff_invitations (initial_role_id);

create index staff_invitations_accepted_user_idx
    on public.staff_invitations (accepted_user_id)
    where accepted_user_id is not null;


-- ============================================================
-- 6. PERMISSIONS
-- ============================================================
-- Capacidades concretas.
--
-- Ejemplos posteriores:
--
-- students.view
-- students.manage
-- payments.create
-- payments.view
-- payments.reverse
-- refunds.create
-- finance.view_income
-- roles.manage
--
-- Los permisos NO se almacenarán en user_metadata de Auth.
-- La fuente de verdad será esta estructura.
-- ============================================================

create table public.permissions (
    id uuid primary key default gen_random_uuid(),

    code text not null,
    description text not null,

    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp(),

    constraint permissions_code_uq
        unique (code),

    constraint permissions_code_not_blank
        check (btrim(code) <> ''),

    constraint permissions_description_not_blank
        check (btrim(description) <> '')
);


-- ============================================================
-- 7. ROLE_PERMISSIONS
-- ============================================================
-- Capacidades concedidas a un rol.
--
-- scope limita el alcance funcional.
--
-- OWN:
--   recursos propios.
--
-- ASSIGNED:
--   recursos académicos/asignaciones del usuario.
--
-- LINKED:
--   alumnos vinculados, principalmente familia.
--
-- ALL:
--   alcance institucional permitido por esa capacidad.
--
-- Una capability + scope NO sustituye las invariantes
-- estructurales del sistema.
-- ============================================================

create table public.role_permissions (
    role_id uuid not null
        references public.roles(id)
        on delete restrict,

    permission_id uuid not null
        references public.permissions(id)
        on delete restrict,

    scope text not null,

    created_at timestamptz not null default statement_timestamp(),

    primary key (
        role_id,
        permission_id
    ),

    constraint role_permissions_scope_check
        check (
            scope in (
                'OWN',
                'ASSIGNED',
                'LINKED',
                'ALL'
            )
        )
);


create index role_permissions_permission_idx
    on public.role_permissions (permission_id);


-- ============================================================
-- 8. USER_ROLES
-- ============================================================
-- Roles asignados a cuentas reales.
--
-- user_id referencia profiles.id, que a su vez es exactamente
-- auth.users.id.
--
-- La vigencia permite conservar historia:
--
-- Christian -> ADMINISTRATIVO
-- 2026-08-01 -> 2027-01-31
--
-- Christian -> otro rol posteriormente
--
-- Nunca necesitamos borrar la asignación anterior.
-- ============================================================

create table public.user_roles (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id)
        on delete restrict,

    role_id uuid not null
        references public.roles(id)
        on delete restrict,

    valid_from timestamptz not null default statement_timestamp(),

    valid_until timestamptz,

    assigned_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null default statement_timestamp(),

    constraint user_roles_validity_check
        check (
            valid_until is null
            or valid_until > valid_from
        )
);


-- Evita que la misma persona tenga dos asignaciones del mismo
-- rol con vigencias superpuestas.
--
-- btree_gist ya fue habilitado en 002_financial_config.sql.

alter table public.user_roles
    add constraint user_roles_no_overlapping_role
    exclude using gist (
        user_id with =,
        role_id with =,
        tstzrange(
            valid_from,
            coalesce(valid_until, 'infinity'::timestamptz),
            '[)'
        ) with &&
    );


create index user_roles_user_idx
    on public.user_roles (user_id);

create index user_roles_role_idx
    on public.user_roles (role_id);

create index user_roles_active_user_idx
    on public.user_roles (user_id, role_id)
    where valid_until is null;


-- ============================================================
-- RLS
-- ============================================================
-- RLS queda activado pero todavía NO creamos policies ni
-- otorgamos acceso Data API.
--
-- Las policies se diseñarán después sobre la base de:
--
-- roles
-- permissions
-- role_permissions
-- user_roles
-- family_access
-- teacher_assignments
--
-- No utilizaremos raw_user_meta_data como fuente de
-- autorización.
-- ============================================================

alter table public.family_invitations
    enable row level security;

alter table public.family_invitation_students
    enable row level security;

alter table public.family_access
    enable row level security;

alter table public.roles
    enable row level security;

alter table public.staff_invitations
    enable row level security;

alter table public.permissions
    enable row level security;

alter table public.role_permissions
    enable row level security;

alter table public.user_roles
    enable row level security;