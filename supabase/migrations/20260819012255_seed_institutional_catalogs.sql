-- ============================================================
-- SEED: CATÁLOGOS INSTITUCIONALES
-- ============================================================
-- Datos estables que no dependen de un ciclo escolar concreto.
-- ============================================================


-- ============================================================
-- 1. NIVELES EDUCATIVOS
-- ============================================================

insert into public.education_levels (
    code,
    name,
    sort_order
)
values
    ('PREESCOLAR', 'Preescolar', 1),
    ('PRIMARIA',   'Primaria',   2)
on conflict (code) do nothing;


-- ============================================================
-- 2. GRADOS
-- ============================================================

insert into public.grade_levels (
    education_level_id,
    code,
    name,
    sort_order,
    is_terminal
)
select
    el.id,
    v.code,
    v.name,
    v.sort_order,
    v.is_terminal
from public.education_levels el
join (
    values
        ('PREESCOLAR', '1', '1°', 1, false),
        ('PREESCOLAR', '2', '2°', 2, false),
        ('PREESCOLAR', '3', '3°', 3, true),

        ('PRIMARIA', '1', '1°', 1, false),
        ('PRIMARIA', '2', '2°', 2, false),
        ('PRIMARIA', '3', '3°', 3, false),
        ('PRIMARIA', '4', '4°', 4, false),
        ('PRIMARIA', '5', '5°', 5, false),
        ('PRIMARIA', '6', '6°', 6, true)
) as v(
    education_level_code,
    code,
    name,
    sort_order,
    is_terminal
)
    on el.code = v.education_level_code
on conflict (education_level_id, code) do nothing;


-- ============================================================
-- 3. CONCEPTOS FINANCIEROS
-- ============================================================

insert into public.financial_concepts (
    code,
    name,
    category
)
values
    ('TUITION',         'Colegiatura',    'TUITION'),
    ('ENROLLMENT_FEE',  'Inscripción',    'ENROLLMENT_FEE'),
    ('PREREGISTRATION', 'Preinscripción', 'PREREGISTRATION'),
    ('LATE_FEE',        'Recargo',        'LATE_FEE'),
    ('OTHER',           'Otro',           'OTHER')
on conflict (code) do nothing;


-- ============================================================
-- 4. ROLES BASE
-- ============================================================

insert into public.roles (
    code,
    name,
    is_system
)
values
    ('MASTER',          'Master',          true),
    ('ADMINISTRATIVO',  'Administrativo',  true),
    ('PROFESOR',        'Profesor',        true),
    ('TUTOR',           'Tutor',           true)
on conflict (code) do nothing;


-- ============================================================
-- 5. MATERIAS / CAMPOS FORMATIVOS
-- ============================================================

insert into public.subjects (
    code,
    name,
    sort_order
)
values
    (
        'LENGUAJES',
        'Lenguajes',
        1
    ),
    (
        'SABERES_PENSAMIENTO_CIENTIFICO',
        'Saberes y pensamiento científico',
        2
    ),
    (
        'ETICA_NATURALEZA_SOCIEDADES',
        'Ética, naturaleza y sociedades',
        3
    ),
    (
        'HUMANO_COMUNITARIO',
        'De lo humano y lo comunitario',
        4
    ),
    (
        'INGLES',
        'Inglés',
        5
    ),
    (
        'EDUCACION_FISICA',
        'Educación Física',
        6
    )
on conflict (code) do nothing;