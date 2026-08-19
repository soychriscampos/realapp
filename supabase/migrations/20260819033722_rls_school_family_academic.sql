-- ============================================================
-- RLS: SCHOOL + FAMILY + ACADEMIC
-- ============================================================
-- Abre acceso controlado a:
-- - alumnos
-- - matrículas
-- - tutores
-- - acceso familiar
-- - estructura académica
-- - asignaciones docentes
-- - evaluaciones
--
-- Finanzas se resolverá en una migración posterior.
-- Tutor todavía NO puede leer student_evaluations porque falta
-- aplicar la condición financiera de "sin adeudo vencido".
-- ============================================================


-- ============================================================
-- 1. HELPERS
-- ============================================================

create or replace function app_private.current_guardian_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select g.id
    from public.guardians g
    where g.auth_user_id = (select auth.uid())
    limit 1;
$$;

revoke all
    on function app_private.current_guardian_id()
    from public;

grant execute
    on function app_private.current_guardian_id()
    to authenticated;


create or replace function app_private.current_user_has_family_access(
    requested_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.family_access fa
        join public.guardians g
          on g.id = fa.guardian_id
        where g.auth_user_id = (select auth.uid())
          and fa.student_id = requested_student_id
          and fa.status = 'ACTIVE'
    );
$$;

revoke all
    on function app_private.current_user_has_family_access(uuid)
    from public;

grant execute
    on function app_private.current_user_has_family_access(uuid)
    to authenticated;


create or replace function app_private.current_teacher_has_student(
    requested_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.enrollments e
        join public.teacher_assignments ta
          on ta.group_id = e.group_id
         and ta.cycle_id = e.cycle_id
         and ta.grade_level_id = e.grade_level_id
        where e.student_id = requested_student_id
          and ta.teacher_profile_id = (select auth.uid())
          and ta.valid_from <= current_date
          and (
                ta.valid_until is null
                or ta.valid_until >= current_date
          )
    );
$$;

revoke all
    on function app_private.current_teacher_has_student(uuid)
    from public;

grant execute
    on function app_private.current_teacher_has_student(uuid)
    to authenticated;


create or replace function app_private.current_teacher_has_enrollment(
    requested_enrollment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.enrollments e
        join public.teacher_assignments ta
          on ta.group_id = e.group_id
         and ta.cycle_id = e.cycle_id
         and ta.grade_level_id = e.grade_level_id
        where e.id = requested_enrollment_id
          and ta.teacher_profile_id = (select auth.uid())
          and ta.valid_from <= current_date
          and (
                ta.valid_until is null
                or ta.valid_until >= current_date
          )
    );
$$;

revoke all
    on function app_private.current_teacher_has_enrollment(uuid)
    from public;

grant execute
    on function app_private.current_teacher_has_enrollment(uuid)
    to authenticated;


create or replace function app_private.current_teacher_can_capture(
    requested_enrollment_id uuid,
    requested_period_id uuid,
    requested_curriculum_subject_id uuid,
    requested_group_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.enrollments e
        join public.evaluation_periods ep
          on ep.id = requested_period_id
         and ep.cycle_id = e.cycle_id
        join public.teacher_assignments ta
          on ta.teacher_profile_id = (select auth.uid())
         and ta.group_id = requested_group_id
         and ta.group_id = e.group_id
         and ta.cycle_id = e.cycle_id
         and ta.grade_level_id = e.grade_level_id
         and ta.curriculum_subject_id = requested_curriculum_subject_id
        where e.id = requested_enrollment_id
          and ep.capture_status = 'OPEN'
          and ta.valid_from <= current_date
          and (
                ta.valid_until is null
                or ta.valid_until >= current_date
          )
    );
$$;

revoke all
    on function app_private.current_teacher_can_capture(
        uuid,
        uuid,
        uuid,
        uuid
    )
    from public;

grant execute
    on function app_private.current_teacher_can_capture(
        uuid,
        uuid,
        uuid,
        uuid
    )
    to authenticated;


-- ============================================================
-- 2. STUDENTS
-- ============================================================

create policy students_select_all
on public.students
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'students.view',
        'ALL'
    )
);


create policy students_select_teacher
on public.students
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'students.view',
        'ASSIGNED'
    )
    and app_private.current_teacher_has_student(id)
);


create policy students_select_family
on public.students
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'students.view',
        'LINKED'
    )
    and app_private.current_user_has_family_access(id)
);


create policy students_insert_manage
on public.students
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    )
);


create policy students_update_manage
on public.students
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    )
);


-- ============================================================
-- 3. ENROLLMENTS
-- ============================================================

create policy enrollments_select_all
on public.enrollments
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'enrollments.view',
        'ALL'
    )
);


create policy enrollments_select_teacher
on public.enrollments
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'enrollments.view',
        'ASSIGNED'
    )
    and app_private.current_teacher_has_enrollment(id)
);


create policy enrollments_select_family
on public.enrollments
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'students.view',
        'LINKED'
    )
    and app_private.current_user_has_family_access(student_id)
);


create policy enrollments_insert_manage
on public.enrollments
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    )
);


create policy enrollments_update_manage
on public.enrollments
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    )
);


-- ============================================================
-- 4. GUARDIANS
-- ============================================================

create policy guardians_select_self
on public.guardians
for select
to authenticated
using (
    auth_user_id = (select auth.uid())
);


create policy guardians_select_manage
on public.guardians
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
);


create policy guardians_insert_manage
on public.guardians
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
);


create policy guardians_update_manage
on public.guardians
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
);


-- ============================================================
-- 5. STUDENT_GUARDIANS
-- ============================================================

create policy student_guardians_select_self
on public.student_guardians
for select
to authenticated
using (
    guardian_id = app_private.current_guardian_id()
);


create policy student_guardians_select_manage
on public.student_guardians
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
);


create policy student_guardians_insert_manage
on public.student_guardians
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
);


create policy student_guardians_update_manage
on public.student_guardians
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
);


-- ============================================================
-- 6. FAMILY_ACCESS
-- ============================================================

create policy family_access_select_self
on public.family_access
for select
to authenticated
using (
    guardian_id = app_private.current_guardian_id()
);


create policy family_access_select_manage
on public.family_access
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
);


create policy family_access_insert_manage
on public.family_access
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
);


create policy family_access_update_manage
on public.family_access
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'family_access.manage',
        'ALL'
    )
);


-- ============================================================
-- 7. CATÁLOGOS ACADÉMICOS
-- ============================================================

create policy groups_select_active_user
on public.groups
for select
to authenticated
using (
    app_private.current_user_is_active()
);


create policy curriculum_subjects_select_active_user
on public.curriculum_subjects
for select
to authenticated
using (
    app_private.current_user_is_active()
);


create policy evaluation_periods_select_active_user
on public.evaluation_periods
for select
to authenticated
using (
    app_private.current_user_is_active()
);


create policy subjects_select_active_user
on public.subjects
for select
to authenticated
using (
    app_private.current_user_is_active()
);


-- Master / cycles.manage podrá administrar estructura.

create policy groups_manage
on public.groups
for all
to authenticated
using (
    app_private.current_user_has_permission(
        'cycles.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'cycles.manage',
        'ALL'
    )
);


create policy curriculum_subjects_manage
on public.curriculum_subjects
for all
to authenticated
using (
    app_private.current_user_has_permission(
        'cycles.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'cycles.manage',
        'ALL'
    )
);


create policy evaluation_periods_manage
on public.evaluation_periods
for all
to authenticated
using (
    app_private.current_user_has_permission(
        'cycles.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'cycles.manage',
        'ALL'
    )
);


create policy subjects_manage
on public.subjects
for all
to authenticated
using (
    app_private.current_user_has_permission(
        'cycles.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'cycles.manage',
        'ALL'
    )
);


-- ============================================================
-- 8. TEACHER_ASSIGNMENTS
-- ============================================================

create policy teacher_assignments_select_own
on public.teacher_assignments
for select
to authenticated
using (
    teacher_profile_id = (select auth.uid())
);


create policy teacher_assignments_select_manage
on public.teacher_assignments
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'teacher_assignments.manage',
        'ALL'
    )
);


create policy teacher_assignments_manage
on public.teacher_assignments
for all
to authenticated
using (
    app_private.current_user_has_permission(
        'teacher_assignments.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'teacher_assignments.manage',
        'ALL'
    )
);


-- ============================================================
-- 9. STUDENT_EVALUATIONS
-- ============================================================
--
-- Master:
-- grades.capture / ALL
-- puede intervenir incluso si el periodo está cerrado.
--
-- Profesor:
-- grades.capture / ASSIGNED
-- sólo en su asignación vigente y periodo OPEN.
--
-- Tutor:
-- todavía no se abre aquí.
-- ============================================================

create policy student_evaluations_select_all
on public.student_evaluations
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'grades.view',
        'ALL'
    )
);


create policy student_evaluations_select_teacher
on public.student_evaluations
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'grades.view',
        'ASSIGNED'
    )
    and app_private.current_teacher_has_enrollment(enrollment_id)
);


create policy student_evaluations_insert_master
on public.student_evaluations
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'grades.capture',
        'ALL'
    )
);


create policy student_evaluations_insert_teacher
on public.student_evaluations
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'grades.capture',
        'ASSIGNED'
    )
    and app_private.current_teacher_can_capture(
        enrollment_id,
        evaluation_period_id,
        curriculum_subject_id,
        group_id
    )
    and created_by = (select auth.uid())
);


create policy student_evaluations_update_master
on public.student_evaluations
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'grades.capture',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'grades.capture',
        'ALL'
    )
);


create policy student_evaluations_update_teacher
on public.student_evaluations
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'grades.capture',
        'ASSIGNED'
    )
    and app_private.current_teacher_can_capture(
        enrollment_id,
        evaluation_period_id,
        curriculum_subject_id,
        group_id
    )
)
with check (
    app_private.current_user_has_permission(
        'grades.capture',
        'ASSIGNED'
    )
    and app_private.current_teacher_can_capture(
        enrollment_id,
        evaluation_period_id,
        curriculum_subject_id,
        group_id
    )
    and updated_by = (select auth.uid())
);


-- ============================================================
-- 10. PUBLICACIÓN DE CALIFICACIONES
-- ============================================================

create policy group_period_publications_select_staff
on public.group_period_publications
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'grades.view',
        'ALL'
    )
    or
    app_private.current_user_has_permission(
        'grades.publish',
        'ALL'
    )
);


create policy group_period_publications_manage
on public.group_period_publications
for all
to authenticated
using (
    app_private.current_user_has_permission(
        'grades.publish',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'grades.publish',
        'ALL'
    )
);


-- ============================================================
-- 11. PRIVILEGIOS DATA API
-- ============================================================

grant select, insert, update
    on public.students
    to authenticated;

grant select, insert, update
    on public.enrollments
    to authenticated;

grant select, insert, update
    on public.guardians
    to authenticated;

grant select, insert, update
    on public.student_guardians
    to authenticated;

grant select, insert, update
    on public.family_access
    to authenticated;

grant select, insert, update
    on public.groups
    to authenticated;

grant select, insert, update
    on public.subjects
    to authenticated;

grant select, insert, update
    on public.curriculum_subjects
    to authenticated;

grant select, insert, update
    on public.evaluation_periods
    to authenticated;

grant select, insert, update
    on public.teacher_assignments
    to authenticated;

grant select, insert, update
    on public.student_evaluations
    to authenticated;

grant select, insert, update
    on public.group_period_publications
    to authenticated;