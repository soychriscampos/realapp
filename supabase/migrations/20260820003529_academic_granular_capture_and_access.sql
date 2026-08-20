-- ============================================================
-- M5 — Académico granular
-- ============================================================
--
-- 1. Materias que entran al promedio principal.
-- 2. Apertura granular de captura.
-- 3. Validación real de evaluaciones según curriculum.
-- 4. Historial cuantitativo.
-- 5. Corrección administrativa post-cierre con motivo.
-- 6. Derecho financiero adquirido por alumno + periodo.
-- 7. RLS familiar basada en derecho persistente.
-- 8. Lectura académica histórica para profesores.
-- ============================================================


-- ============================================================
-- 1. ADMINISTRATIVO PUEDE CAPTURAR / CORREGIR
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
  on p.code = 'grades.capture'
where r.code = 'ADMINISTRATIVO'
on conflict (role_id, permission_id)
do update
set scope = excluded.scope;


-- Permiso específico para administrar ventanas de captura.

insert into public.permissions (
    code,
    description
)
values (
    'grades.capture.manage',
    'Open, close and reopen granular academic capture scopes'
)
on conflict (code)
do update
set
    description = excluded.description,
    updated_at = statement_timestamp();


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
  on p.code = 'grades.capture.manage'
where r.code in ('MASTER', 'ADMINISTRATIVO')
on conflict (role_id, permission_id)
do update
set scope = excluded.scope;



-- ============================================================
-- 2. BANDERA DE PROMEDIO PRINCIPAL
-- ============================================================

alter table public.curriculum_subjects
    add column include_in_main_average boolean
        not null
        default false;


update public.curriculum_subjects cs
set include_in_main_average = true
from public.subjects s
where s.id = cs.subject_id
  and s.code in (
      'LENGUAJES',
      'SABERES_PENSAMIENTO_CIENTIFICO',
      'ETICA_NATURALEZA_SOCIEDADES',
      'HUMANO_COMUNITARIO'
  );


-- Inglés y Educación Física quedan false.



-- ============================================================
-- 3. VENTANAS GRANULARES DE CAPTURA
-- ============================================================

create table public.academic_capture_windows (
    id uuid primary key
        default gen_random_uuid(),

    evaluation_period_id uuid not null,

    cycle_id uuid not null,

    grade_level_id uuid not null,

    group_id uuid not null,

    curriculum_subject_id uuid not null,

    teacher_assignment_id uuid not null
        references public.teacher_assignments(id)
        on delete restrict,

    status text not null
        default 'CLOSED',

    opened_at timestamptz,
    opened_by uuid
        references public.profiles(id)
        on delete restrict,

    closed_at timestamptz,
    closed_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null
        default statement_timestamp(),

    updated_at timestamptz not null
        default statement_timestamp(),

    constraint academic_capture_windows_status_check
        check (
            status in ('OPEN', 'CLOSED')
        ),

    constraint academic_capture_windows_period_fk
        foreign key (
            evaluation_period_id,
            cycle_id
        )
        references public.evaluation_periods(
            id,
            cycle_id
        )
        on delete restrict,

    constraint academic_capture_windows_group_fk
        foreign key (
            group_id,
            cycle_id,
            grade_level_id
        )
        references public.groups(
            id,
            cycle_id,
            grade_level_id
        )
        on delete restrict,

    constraint academic_capture_windows_curriculum_fk
        foreign key (
            curriculum_subject_id,
            cycle_id,
            grade_level_id
        )
        references public.curriculum_subjects(
            id,
            cycle_id,
            grade_level_id
        )
        on delete restrict,

    constraint academic_capture_windows_teacher_context_fk
        foreign key (
            teacher_assignment_id,
            group_id,
            curriculum_subject_id
        )
        references public.teacher_assignments(
            id,
            group_id,
            curriculum_subject_id
        )
        on delete restrict,

    constraint academic_capture_windows_open_state_check
        check (
            status <> 'OPEN'
            or (
                opened_at is not null
                and opened_by is not null
            )
        ),

    constraint academic_capture_windows_closed_state_check
        check (
            status <> 'CLOSED'
            or opened_at is null
            or closed_at is not null
        )
);


create unique index academic_capture_windows_period_assignment_uq
    on public.academic_capture_windows(
        evaluation_period_id,
        teacher_assignment_id
    );


create index academic_capture_windows_scope_idx
    on public.academic_capture_windows(
        evaluation_period_id,
        group_id,
        curriculum_subject_id,
        status
    );


create index academic_capture_windows_teacher_idx
    on public.academic_capture_windows(
        teacher_assignment_id,
        status
    );


alter table public.academic_capture_windows
    enable row level security;


create policy academic_capture_windows_manage
on public.academic_capture_windows
for all
to authenticated
using (
    app_private.current_user_has_permission(
        'grades.capture.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'grades.capture.manage',
        'ALL'
    )
);


create policy academic_capture_windows_select_teacher
on public.academic_capture_windows
for select
to authenticated
using (
    teacher_assignment_id in (
        select ta.id
        from public.teacher_assignments ta
        where ta.teacher_staff_id =
              app_private.current_staff_id()
    )
);


grant select, insert, update
on public.academic_capture_windows
to authenticated;



-- ============================================================
-- 4. TEACHER CAPTURE USA VENTANA GRANULAR
-- ============================================================

create or replace function
app_private.current_teacher_can_capture(
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

        join public.teacher_assignments ta
          on ta.teacher_staff_id =
                app_private.current_staff_id()

         and ta.group_id =
                requested_group_id

         and ta.group_id =
                e.group_id

         and ta.cycle_id =
                e.cycle_id

         and ta.grade_level_id =
                e.grade_level_id

         and ta.curriculum_subject_id =
                requested_curriculum_subject_id

        join public.academic_capture_windows acw
          on acw.teacher_assignment_id = ta.id
         and acw.evaluation_period_id =
                requested_period_id
         and acw.group_id =
                requested_group_id
         and acw.curriculum_subject_id =
                requested_curriculum_subject_id
         and acw.status = 'OPEN'

        where e.id =
              requested_enrollment_id

          -- Sólo la asignación docente vigente puede editar.
          and ta.valid_from <= current_date

          and (
              ta.valid_until is null
              or ta.valid_until >= current_date
          )
    );
$$;



-- ============================================================
-- 5. LECTURA HISTÓRICA DEL PROFESOR
-- ============================================================
--
-- Lectura != edición.
--
-- Mientras el staff siga activo, puede consultar grupos en los
-- que tuvo una asignación histórica.
-- ============================================================

create or replace function
app_private.current_teacher_has_enrollment(
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
         and ta.grade_level_id =
             e.grade_level_id

        where e.id =
              requested_enrollment_id

          and ta.teacher_staff_id =
              app_private.current_staff_id()
    );
$$;



-- ============================================================
-- 6. VALIDACIÓN REAL DE EVALUACIONES
-- ============================================================
--
-- La configuración viene de curriculum_subjects.
--
-- Para las seis materias actuales:
-- cuantitativa obligatoria 6-10 entero
-- cualitativa obligatoria <= 250
-- ============================================================

create or replace function
app_private.validate_student_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_quantitative_enabled boolean;
    v_qualitative_enabled boolean;

    v_quantitative_min numeric;
    v_quantitative_max numeric;

    v_qualitative_max_length integer;
begin

    select
        cs.quantitative_enabled,
        cs.qualitative_enabled,
        cs.quantitative_min,
        cs.quantitative_max,
        cs.qualitative_max_length
    into
        v_quantitative_enabled,
        v_qualitative_enabled,
        v_quantitative_min,
        v_quantitative_max,
        v_qualitative_max_length
    from public.curriculum_subjects cs
    where cs.id = new.curriculum_subject_id;


    if not found then
        raise exception
            'Curriculum subject not found';
    end if;


    -- --------------------------
    -- CUANTITATIVA
    -- --------------------------

    if v_quantitative_enabled then

        if new.quantitative_value is null then
            raise exception
                'Quantitative value is required';
        end if;


        if new.quantitative_value <>
           trunc(new.quantitative_value)
        then
            raise exception
                'Quantitative value must be an integer';
        end if;


        if new.quantitative_value <
           v_quantitative_min
           or
           new.quantitative_value >
           v_quantitative_max
        then
            raise exception
                'Quantitative value must be between % and %',
                v_quantitative_min,
                v_quantitative_max;
        end if;

    elsif new.quantitative_value is not null then

        raise exception
            'Quantitative value is not enabled for this subject';

    end if;


    -- --------------------------
    -- CUALITATIVA
    -- --------------------------

    if v_qualitative_enabled then

        if new.qualitative_comment is null
           or btrim(new.qualitative_comment) = ''
        then
            raise exception
                'Qualitative comment is required';
        end if;


        if char_length(
            new.qualitative_comment
        ) > v_qualitative_max_length
        then
            raise exception
                'Qualitative comment exceeds maximum length %',
                v_qualitative_max_length;
        end if;

    elsif new.qualitative_comment is not null then

        raise exception
            'Qualitative comment is not enabled for this subject';

    end if;


    return new;
end;
$$;


revoke all
on function app_private.validate_student_evaluation()
from public, anon, authenticated;


create trigger student_evaluations_validate
before insert or update
on public.student_evaluations
for each row
execute function
app_private.validate_student_evaluation();



-- ============================================================
-- 7. HISTORIAL CUANTITATIVO
-- ============================================================

create table public.student_evaluation_quantitative_history (
    id uuid primary key
        default gen_random_uuid(),

    student_evaluation_id uuid not null
        references public.student_evaluations(id)
        on delete restrict,

    old_value numeric,
    new_value numeric,

    changed_by uuid
        references public.profiles(id)
        on delete restrict,

    reason text,

    changed_at timestamptz not null
        default statement_timestamp(),

    constraint student_eval_quant_history_changed
        check (
            old_value is distinct from new_value
        )
);


create index student_eval_quant_history_evaluation_idx
    on public.student_evaluation_quantitative_history(
        student_evaluation_id,
        changed_at
    );


alter table public.student_evaluation_quantitative_history
    enable row level security;


create policy student_eval_quant_history_select_admin
on public.student_evaluation_quantitative_history
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'grades.view',
        'ALL'
    )
);


grant select
on public.student_evaluation_quantitative_history
to authenticated;



-- ============================================================
-- 8. MOTIVO TEMPORAL PARA CORRECCIÓN ADMINISTRATIVA
-- ============================================================
--
-- Se usa como input de la mutación.
-- El trigger lo registra y después lo limpia, para no dejar
-- una "razón actual" engañosa en la evaluación.
-- ============================================================

alter table public.student_evaluations
    add column correction_reason text;



-- ============================================================
-- 9. HISTORIAL Y CORRECCIÓN POST-CIERRE
-- ============================================================

create or replace function
app_private.track_student_evaluation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;

    v_scope_open boolean := false;

    v_changed boolean := false;
begin

    v_actor_id :=
        (select auth.uid());


    v_changed :=
        old.quantitative_value
            is distinct from
        new.quantitative_value

        or

        old.qualitative_comment
            is distinct from
        new.qualitative_comment;


    if not v_changed then
        new.correction_reason := null;
        return new;
    end if;


    -- ¿Existe alguna ventana abierta para este scope?
    --
    -- Para profesor, RLS además exige SU ventana concreta.
    -- Aquí sólo necesitamos distinguir edición normal
    -- vs corrección administrativa con scope cerrado.

    select exists (
        select 1
        from public.academic_capture_windows acw
        where acw.evaluation_period_id =
              new.evaluation_period_id

          and acw.group_id =
              new.group_id

          and acw.curriculum_subject_id =
              new.curriculum_subject_id

          and acw.status = 'OPEN'
    )
    into v_scope_open;


    -- Si el scope está cerrado y quien modifica tiene
    -- permiso administrativo ALL, el motivo es obligatorio.

    if not v_scope_open
       and app_private.current_user_has_permission(
           'grades.capture',
           'ALL'
       )
       and (
           new.correction_reason is null
           or btrim(new.correction_reason) = ''
       )
    then
        raise exception
            'Correction reason is required when capture scope is closed';
    end if;


    -- Historial cuantitativo.

    if old.quantitative_value
       is distinct from
       new.quantitative_value
    then

        insert into public.student_evaluation_quantitative_history (
            student_evaluation_id,
            old_value,
            new_value,
            changed_by,
            reason
        )
        values (
            old.id,
            old.quantitative_value,
            new.quantitative_value,
            v_actor_id,
            nullif(
                btrim(new.correction_reason),
                ''
            )
        );

    end if;


    -- Corrección administrativa post-cierre:
    -- también va a audit_log.
    --
    -- Para cualitativa no mantenemos historial exhaustivo.

    if not v_scope_open
       and app_private.current_user_has_permission(
           'grades.capture',
           'ALL'
       )
    then

        insert into public.audit_log (
            actor_profile_id,
            action,
            entity_name,
            entity_id,
            old_values,
            new_values,
            reason
        )
        values (
            v_actor_id,
            'EVALUATION_POST_CLOSE_CORRECTION',
            'student_evaluations',
            old.id,

            jsonb_build_object(
                'quantitative_value',
                    old.quantitative_value,
                'qualitative_comment',
                    old.qualitative_comment
            ),

            jsonb_build_object(
                'quantitative_value',
                    new.quantitative_value,
                'qualitative_comment',
                    new.qualitative_comment
            ),

            btrim(new.correction_reason)
        );

    end if;


    if v_actor_id is not null then
        new.updated_by := v_actor_id;
    end if;


    new.updated_at :=
        statement_timestamp();


    -- No persistimos el input temporal.
    new.correction_reason := null;


    return new;
end;
$$;


revoke all
on function app_private.track_student_evaluation_change()
from public, anon, authenticated;


create trigger student_evaluations_track_change
before update
on public.student_evaluations
for each row
execute function
app_private.track_student_evaluation_change();



-- ============================================================
-- 10. DERECHO FINANCIERO ADQUIRIDO
-- ============================================================

create table public.grade_access_entitlements (
    id uuid primary key
        default gen_random_uuid(),

    enrollment_id uuid not null
        references public.enrollments(id)
        on delete restrict,

    evaluation_period_id uuid not null
        references public.evaluation_periods(id)
        on delete restrict,

    acquired_at timestamptz not null
        default statement_timestamp(),

    acquisition_reason text not null
        default 'PUBLISHED_AND_CURRENT',

    constraint grade_access_entitlements_reason_not_blank
        check (
            btrim(acquisition_reason) <> ''
        ),

    constraint grade_access_entitlements_enrollment_period_uq
        unique (
            enrollment_id,
            evaluation_period_id
        )
);


create index grade_access_entitlements_period_idx
    on public.grade_access_entitlements(
        evaluation_period_id
    );


alter table public.grade_access_entitlements
    enable row level security;


-- Sin INSERT/UPDATE/DELETE para cliente.
-- Es un hecho derivado y persistente administrado por DB.



-- ============================================================
-- 11. REFRESH DE ENTITLEMENTS POR ALUMNO
-- ============================================================

create or replace function
app_private.refresh_grade_access_entitlements_for_student(
    requested_student_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin

    if requested_student_id is null then
        return;
    end if;


    -- Si actualmente tiene cualquier deuda vencida,
    -- no adquiere derechos nuevos.
    --
    -- Los derechos existentes JAMÁS se eliminan aquí.

    if app_private.student_has_overdue_balance(
        requested_student_id
    )
    then
        return;
    end if;


    insert into public.grade_access_entitlements (
        enrollment_id,
        evaluation_period_id,
        acquisition_reason
    )
    select
        e.id,
        gpp.evaluation_period_id,
        'PUBLISHED_AND_CURRENT'

    from public.enrollments e

    join public.group_period_publications gpp
      on gpp.group_id = e.group_id
     and gpp.cycle_id = e.cycle_id
     and gpp.status = 'PUBLISHED'

    where e.student_id =
          requested_student_id

      and e.group_id is not null

    on conflict (
        enrollment_id,
        evaluation_period_id
    )
    do nothing;

end;
$$;


revoke all
on function
app_private.refresh_grade_access_entitlements_for_student(uuid)
from public, anon, authenticated;



-- ============================================================
-- 12. PUBLICAR → ADQUIRIR DERECHO A QUIEN ESTÁ AL CORRIENTE
-- ============================================================

create or replace function
app_private.refresh_entitlements_after_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_student record;
begin

    if new.status = 'PUBLISHED' then

        for v_student in

            select distinct e.student_id
            from public.enrollments e
            where e.group_id = new.group_id
              and e.cycle_id = new.cycle_id

        loop

            perform
                app_private.refresh_grade_access_entitlements_for_student(
                    v_student.student_id
                );

        end loop;

    end if;


    return new;
end;
$$;


revoke all
on function app_private.refresh_entitlements_after_publication()
from public, anon, authenticated;


create trigger group_period_publications_refresh_entitlements
after insert or update of status
on public.group_period_publications
for each row
execute function
app_private.refresh_entitlements_after_publication();



-- ============================================================
-- 13. CAMBIO FINANCIERO → REVISAR SI AHORA ESTÁ AL CORRIENTE
-- ============================================================

create or replace function
app_private.refresh_entitlements_from_payment_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

    perform
        app_private.refresh_grade_access_entitlements_for_student(
            new.student_id
        );

    return new;
end;
$$;


revoke all
on function app_private.refresh_entitlements_from_payment_allocation()
from public, anon, authenticated;


create trigger payment_allocations_refresh_grade_access
after insert or update of reversed_at
on public.payment_allocations
for each row
execute function
app_private.refresh_entitlements_from_payment_allocation();



-- Credit applications do not contain student_id,
-- so derive through the credit.

create or replace function
app_private.refresh_entitlements_from_credit_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_student_id uuid;
begin

    select cr.student_id
    into v_student_id
    from public.credits cr
    where cr.id = new.credit_id;


    perform
        app_private.refresh_grade_access_entitlements_for_student(
            v_student_id
        );


    return new;
end;
$$;


revoke all
on function app_private.refresh_entitlements_from_credit_application()
from public, anon, authenticated;


create trigger credit_applications_refresh_grade_access
after insert or update of reversed_at
on public.credit_applications
for each row
execute function
app_private.refresh_entitlements_from_credit_application();



-- Ajustes/condonaciones también pueden dejar al alumno
-- al corriente.

create or replace function
app_private.refresh_entitlements_from_charge_adjustment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_student_id uuid;
begin

    select c.student_id
    into v_student_id
    from public.charges c
    where c.id = new.charge_id;


    perform
        app_private.refresh_grade_access_entitlements_for_student(
            v_student_id
        );


    return new;
end;
$$;


revoke all
on function app_private.refresh_entitlements_from_charge_adjustment()
from public, anon, authenticated;


create trigger charge_adjustments_refresh_grade_access
after insert or update of amount
on public.charge_adjustments
for each row
execute function
app_private.refresh_entitlements_from_charge_adjustment();



-- Cambios del propio cargo también pueden cambiar su condición.

create or replace function
app_private.refresh_entitlements_from_charge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

    perform
        app_private.refresh_grade_access_entitlements_for_student(
            new.student_id
        );

    return new;
end;
$$;


revoke all
on function app_private.refresh_entitlements_from_charge()
from public, anon, authenticated;


create trigger charges_refresh_grade_access
after insert or update of
    status,
    due_date,
    original_amount
on public.charges
for each row
execute function
app_private.refresh_entitlements_from_charge();



-- ============================================================
-- 14. ALTA / CAMBIO DE GRUPO → REVISAR ENTITLEMENT
-- ============================================================

create or replace function
app_private.refresh_entitlements_from_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

    perform
        app_private.refresh_grade_access_entitlements_for_student(
            new.student_id
        );

    return new;
end;
$$;


revoke all
on function app_private.refresh_entitlements_from_enrollment()
from public, anon, authenticated;


create trigger enrollments_refresh_grade_access
after insert or update of
    status,
    group_id
on public.enrollments
for each row
execute function
app_private.refresh_entitlements_from_enrollment();



-- ============================================================
-- 15. NUEVA RLS FAMILIAR
-- ============================================================
--
-- Tutor puede ver si:
--
-- 1. tiene grades.view LINKED
-- 2. tiene family_access al alumno
-- 3. periodo está publicado
-- 4. existe entitlement persistente
--
-- NO se consulta deuda actual.
-- ============================================================

create or replace function
app_private.current_family_can_view_grade(
    requested_enrollment_id uuid,
    requested_group_id uuid,
    requested_period_id uuid
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

        join public.group_period_publications gpp
          on gpp.group_id =
                requested_group_id

         and gpp.evaluation_period_id =
                requested_period_id

         and gpp.cycle_id =
                e.cycle_id

         and gpp.status =
                'PUBLISHED'

        join public.grade_access_entitlements gae
          on gae.enrollment_id =
                e.id

         and gae.evaluation_period_id =
                requested_period_id

        where e.id =
              requested_enrollment_id

          and e.group_id =
              requested_group_id

          and app_private.current_user_has_permission(
              'grades.view',
              'LINKED'
          )

          and app_private.current_user_has_family_access(
              e.student_id
          )
    );
$$;



-- ============================================================
-- FIN M5
-- ============================================================