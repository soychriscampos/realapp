-- ============================================================
-- HISTORICAL FOUNDATION: SCHOOL CYCLE 25-26
-- ============================================================
--
-- Este ciclo existe únicamente para soportar la migración
-- histórica del sistema legacy.
--
-- Se crea directamente como CLOSED.
-- ============================================================


-- ============================================================
-- 1. SCHOOL CYCLE
-- ============================================================

insert into public.school_cycles (
    code,
    name,
    starts_on,
    ends_on,
    status
)
values (
    '25-26',
    'Ciclo Escolar 25-26',
    date '2025-09-01',
    date '2026-07-10',
    'CLOSED'
)
on conflict (code) do update
set
    name = excluded.name,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    status = excluded.status;


-- ============================================================
-- 2. GROUPS
-- ============================================================
--
-- Legacy no almacenaba grupo.
-- Para la migración histórica se asignará grupo A.
-- ============================================================

insert into public.groups (
    cycle_id,
    grade_level_id,
    code,
    name,
    is_active
)
select
    sc.id,
    gl.id,
    'A',
    gl.name || ' A',
    false
from public.school_cycles sc
cross join public.grade_levels gl
where sc.code = '25-26'
  and gl.is_active = true
on conflict (cycle_id, grade_level_id, code)
do update
set
    name = excluded.name,
    is_active = excluded.is_active;