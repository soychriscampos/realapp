-- ============================================================
-- SERVICE ROLE PRIVILEGES FOR CONTROLLED ETL
-- ============================================================
--
-- La Data API no concede privilegios automáticamente porque
-- "Automatically expose new tables" está deshabilitado.
--
-- service_role sigue sujeto a los GRANT SQL aunque bypass RLS.
-- ============================================================


-- Catálogos necesarios para resolver IDs
grant select
on public.school_cycles,
   public.education_levels,
   public.grade_levels,
   public.groups,
   public.enrollment_classifications
to service_role;


-- Entidades que carga ETL 02
grant select, insert, update
on public.students,
   public.guardians,
   public.student_guardians,
   public.enrollments
to service_role;