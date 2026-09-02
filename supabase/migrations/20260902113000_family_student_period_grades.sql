-- Fuente canónica de calificaciones publicadas para el portal familiar.
--
-- El promedio oficial del periodo es la media aritmética de los valores
-- cuantitativos no nulos de las materias cuyo curriculum_subjects
-- include_in_main_average = true. El modelo no define ponderaciones.

create or replace function public.family_student_period_grades(
    p_student_id uuid,
    p_period_id uuid
)
returns table (
    enrollment_id uuid,
    cycle_id uuid,
    group_id uuid,
    evaluation_period_id uuid,
    subject_id uuid,
    subject_name text,
    subject_sort_order integer,
    numeric_grade numeric,
    qualitative_comment text,
    include_in_main_average boolean,
    official_average numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
    with visible_enrollments as (
        select
            e.id as enrollment_id,
            e.cycle_id,
            e.grade_level_id,
            e.group_id,
            ep.id as evaluation_period_id
        from public.enrollments e
        join public.evaluation_periods ep
          on ep.id = p_period_id
         and ep.cycle_id = e.cycle_id
        where e.student_id = p_student_id
          and e.group_id is not null
          and app_private.current_family_can_view_grade(
              e.id,
              e.group_id,
              ep.id
          )
    ),
    visible_subjects as (
        select
            ve.enrollment_id,
            ve.cycle_id,
            ve.group_id,
            ve.evaluation_period_id,
            cs.id as curriculum_subject_id,
            cs.subject_id,
            s.name as subject_name,
            cs.sort_order as subject_sort_order,
            cs.include_in_main_average
        from visible_enrollments ve
        join public.curriculum_subjects cs
          on cs.cycle_id = ve.cycle_id
         and cs.grade_level_id = ve.grade_level_id
         and cs.is_active = true
        join public.subjects s
          on s.id = cs.subject_id
    ),
    rows_with_evaluations as (
        select
            vs.enrollment_id,
            vs.cycle_id,
            vs.group_id,
            vs.evaluation_period_id,
            vs.subject_id,
            vs.subject_name,
            vs.subject_sort_order,
            se.quantitative_value as numeric_grade,
            se.qualitative_comment,
            vs.include_in_main_average
        from visible_subjects vs
        left join public.student_evaluations se
         on se.enrollment_id = vs.enrollment_id
         and se.evaluation_period_id = vs.evaluation_period_id
         and se.curriculum_subject_id = vs.curriculum_subject_id
    )
    select
        rwe.enrollment_id,
        rwe.cycle_id,
        rwe.group_id,
        rwe.evaluation_period_id,
        rwe.subject_id,
        rwe.subject_name,
        rwe.subject_sort_order,
        rwe.numeric_grade,
        rwe.qualitative_comment,
        rwe.include_in_main_average,
        avg(rwe.numeric_grade) filter (
            where rwe.include_in_main_average = true
        ) over (
            partition by rwe.enrollment_id, rwe.evaluation_period_id
        ) as official_average
    from rows_with_evaluations rwe
    order by
        rwe.subject_sort_order,
        rwe.subject_name;
$$;

revoke all
on function public.family_student_period_grades(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.family_student_period_grades(uuid, uuid)
to authenticated;
