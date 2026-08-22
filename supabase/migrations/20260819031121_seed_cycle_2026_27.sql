-- ============================================================
-- SEED: CICLO ESCOLAR 2026-27
-- ============================================================
-- Configuración inicial del primer ciclo operado nativamente
-- por App REAL.
--
-- Incluye:
-- - ciclo escolar
-- - grupos
-- - periodos de evaluación
--
-- No incluye todavía:
-- - tarifas
-- - planes financieros
-- - curriculum_subjects
-- - asignaciones docentes
-- ============================================================


-- ============================================================
-- 1. CICLO ESCOLAR
-- ============================================================

insert into public.school_cycles (
    code,
    name,
    starts_on,
    ends_on,
    status
)
values (
    '26-27',
    'Ciclo Escolar 26-27',
    date '2026-08-31',
    date '2027-07-31',
    'PREPARATION'
)
on conflict (code)
do update set
    name = excluded.name,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    status = excluded.status,
    updated_at = statement_timestamp();


-- ============================================================
-- 2. GRUPOS
-- ============================================================
-- Actualmente existe un grupo A por grado.
--
-- Los grupos son específicos del ciclo.
-- ============================================================

insert into public.groups (
    cycle_id,
    grade_level_id,
    code,
    name
)
select
    sc.id,
    gl.id,
    'A',
    el.name || ' ' || gl.name || ' A'
from public.school_cycles sc
cross join public.grade_levels gl
join public.education_levels el
    on el.id = gl.education_level_id
where sc.code = '26-27'
on conflict (cycle_id, grade_level_id, code)
do update set
    name = excluded.name,
    is_active = true,
    updated_at = statement_timestamp();


-- ============================================================
-- 3. PERIODOS DE EVALUACIÓN
-- ============================================================
-- Inicialmente tres periodos.
--
-- Todos comienzan CLOSED.
-- Master/Admin los abrirán desde la aplicación cuando
-- corresponda.
--
-- No sembramos fechas porque la apertura/cierre es una acción
-- administrativa, no una fecha automática.
-- ============================================================

insert into public.evaluation_periods (
    cycle_id,
    code,
    name,
    sort_order,
    capture_status
)
select
    sc.id,
    v.code,
    v.name,
    v.sort_order,
    'CLOSED'
from public.school_cycles sc
cross join (
    values
        ('P1', 'Periodo 1', 1),
        ('P2', 'Periodo 2', 2),
        ('P3', 'Periodo 3', 3)
) as v(code, name, sort_order)
where sc.code = '26-27'
on conflict (cycle_id, code)
do update set
    name = excluded.name,
    sort_order = excluded.sort_order,
    capture_status = excluded.capture_status,
    updated_at = statement_timestamp();