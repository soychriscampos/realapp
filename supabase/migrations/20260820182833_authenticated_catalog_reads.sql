-- ============================================================
-- QA FIX — Lectura de catálogos institucionales
-- ============================================================
--
-- Catálogos no sensibles requeridos por la aplicación:
--
--   school_cycles
--   education_levels
--   grade_levels
--   enrollment_classifications
--
-- Sólo SELECT.
-- No se habilitan mutaciones directas.
-- ============================================================


-- ============================================================
-- SCHOOL CYCLES
-- ============================================================

drop policy if exists
school_cycles_select_authenticated
on public.school_cycles;


create policy
school_cycles_select_authenticated
on public.school_cycles
for select
to authenticated
using (true);


grant select
on public.school_cycles
to authenticated;



-- ============================================================
-- EDUCATION LEVELS
-- ============================================================

drop policy if exists
education_levels_select_authenticated
on public.education_levels;


create policy
education_levels_select_authenticated
on public.education_levels
for select
to authenticated
using (true);


grant select
on public.education_levels
to authenticated;



-- ============================================================
-- GRADE LEVELS
-- ============================================================

drop policy if exists
grade_levels_select_authenticated
on public.grade_levels;


create policy
grade_levels_select_authenticated
on public.grade_levels
for select
to authenticated
using (true);


grant select
on public.grade_levels
to authenticated;



-- ============================================================
-- ENROLLMENT CLASSIFICATIONS
-- ============================================================

drop policy if exists
enrollment_classifications_select_authenticated
on public.enrollment_classifications;


create policy
enrollment_classifications_select_authenticated
on public.enrollment_classifications
for select
to authenticated
using (true);


grant select
on public.enrollment_classifications
to authenticated;


-- ============================================================
-- FIN QA FIX
-- ============================================================