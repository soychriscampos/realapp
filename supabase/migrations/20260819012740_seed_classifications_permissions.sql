-- ============================================================
-- SEED: CLASIFICACIONES Y PERMISOS BASE
-- ============================================================


-- ============================================================
-- 1. CLASIFICACIONES DE MATRÍCULA
-- ============================================================
--
-- OFFICIAL_SEP
--   Cuenta oficialmente para SEP y para población del plantel.
--
-- CAMPUS
--   Pertenece al plantel, pero no cuenta oficialmente para SEP.
--
-- VISITOR
--   No cuenta para SEP, sí forma parte de la operación del
--   plantel y participa académicamente por defecto.
-- ============================================================

insert into public.enrollment_classifications (
    code,
    name,
    counts_for_sep,
    counts_for_campus,
    participates_academically
)
values
    (
        'OFFICIAL_SEP',
        'Oficial SEP',
        true,
        true,
        true
    ),
    (
        'CAMPUS',
        'Plantel',
        false,
        true,
        true
    ),
    (
        'VISITOR',
        'Visitante',
        false,
        true,
        true
    )
on conflict (code)
do update set
    name = excluded.name,
    counts_for_sep = excluded.counts_for_sep,
    counts_for_campus = excluded.counts_for_campus,
    participates_academically = excluded.participates_academically,
    is_active = true,
    updated_at = statement_timestamp();


-- ============================================================
-- 2. CATÁLOGO DE PERMISOS
-- ============================================================

insert into public.permissions (
    code,
    description
)
values

    -- Alumnos y matrícula
    (
        'students.view',
        'Consultar alumnos'
    ),
    (
        'students.manage',
        'Crear y modificar alumnos y matrículas'
    ),
    (
        'enrollments.view',
        'Consultar matrículas'
    ),

    -- Finanzas operativas
    (
        'payments.create',
        'Registrar pagos'
    ),
    (
        'payments.view',
        'Consultar pagos e historial de pagos'
    ),
    (
        'payments.reverse',
        'Revertir o cancelar pagos'
    ),
    (
        'balances.view',
        'Consultar saldo y obligaciones financieras'
    ),
    (
        'collections.view',
        'Consultar cobranza'
    ),
    (
        'finance.view_income',
        'Consultar ingresos institucionales consolidados'
    ),

    -- Configuración escolar
    (
        'cycles.manage',
        'Administrar ciclos escolares'
    ),
    (
        'campaigns.manage',
        'Administrar campañas y configuración de preinscripción'
    ),
    (
        'preregistrations.manage',
        'Operar preinscripciones'
    ),

    -- Familias
    (
        'family_access.manage',
        'Administrar invitaciones y accesos familiares'
    ),

    -- Académico
    (
        'teacher_assignments.manage',
        'Administrar asignaciones docentes'
    ),
    (
        'grades.capture',
        'Capturar y modificar evaluaciones'
    ),
    (
        'grades.publish',
        'Publicar calificaciones a familias'
    ),
    (
        'grades.view',
        'Consultar calificaciones'
    ),

    -- Usuarios y autorización
    (
        'users.manage',
        'Administrar usuarios, onboarding y roles'
    )

on conflict (code)
do update set
    description = excluded.description,
    updated_at = statement_timestamp();


-- ============================================================
-- 3. PERMISOS MASTER
-- ============================================================

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
    on p.code in (
        'students.view',
        'students.manage',
        'enrollments.view',

        'payments.create',
        'payments.view',
        'payments.reverse',
        'balances.view',
        'collections.view',
        'finance.view_income',

        'cycles.manage',
        'campaigns.manage',
        'preregistrations.manage',

        'family_access.manage',

        'teacher_assignments.manage',
        'grades.publish',
        'grades.view',
        'grades.capture',

        'users.manage'
    )
where r.code = 'MASTER'
on conflict (role_id, permission_id)
do update set
    scope = excluded.scope;


-- ============================================================
-- 4. PERMISOS ADMINISTRATIVO
-- ============================================================

insert into public.role_permissions (
    role_id,
    permission_id,
    scope
)
select
    r.id,
    p.id,
    v.scope
from public.roles r
join (
    values
        ('students.view',          'ALL'),
        ('students.manage',        'ALL'),
        ('enrollments.view',       'ALL'),

        ('payments.create',        'ALL'),
        ('payments.view',          'ALL'),
        ('payments.reverse',       'OWN'),
        ('balances.view',          'ALL'),
        ('collections.view',       'ALL'),

        ('preregistrations.manage','ALL'),
        ('family_access.manage',   'ALL'),

        ('grades.publish',         'ALL'),
        ('grades.view',            'ALL')
) as v(permission_code, scope)
    on true
join public.permissions p
    on p.code = v.permission_code
where r.code = 'ADMINISTRATIVO'
on conflict (role_id, permission_id)
do update set
    scope = excluded.scope;


-- ============================================================
-- 5. PERMISOS PROFESOR
-- ============================================================
--
-- ASSIGNED no significa simplemente "tiene rol PROFESOR".
-- Debe existir teacher_assignment vigente.
-- ============================================================

insert into public.role_permissions (
    role_id,
    permission_id,
    scope
)
select
    r.id,
    p.id,
    'ASSIGNED'
from public.roles r
join public.permissions p
    on p.code in (
        'students.view',
        'enrollments.view',
        'grades.capture',
        'grades.view'
    )
where r.code = 'PROFESOR'
on conflict (role_id, permission_id)
do update set
    scope = excluded.scope;


-- ============================================================
-- 6. PERMISOS TUTOR
-- ============================================================
--
-- LINKED requiere además family_access activo.
--
-- En grades.view también deberán cumplirse posteriormente:
-- - publicación del grupo/periodo;
-- - ausencia de adeudo vencido.
-- ============================================================

insert into public.role_permissions (
    role_id,
    permission_id,
    scope
)
select
    r.id,
    p.id,
    'LINKED'
from public.roles r
join public.permissions p
    on p.code in (
        'students.view',
        'payments.view',
        'balances.view',
        'grades.view'
    )
where r.code = 'TUTOR'
on conflict (role_id, permission_id)
do update set
    scope = excluded.scope;