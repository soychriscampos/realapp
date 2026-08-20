-- ============================================================
-- M1 — Staff y actores operativos
-- ============================================================
-- Objetivos:
-- 1. Separar persona staff de cuenta Auth/profile.
-- 2. Teacher assignments pasan de profile -> staff.
-- 3. Crear profesor principal histórico por grupo.
-- 4. Vincular invitaciones a un staff existente.
-- 5. Adaptar helpers/RLS docentes.
-- 6. Dar a ADMINISTRATIVO permisos funcionales acordados.
--
-- NO se modifican payments todavía.
-- Eso se hará junto con M3 (métodos/receptor/capturista).
-- ============================================================


-- ------------------------------------------------------------
-- 1. STAFF
-- ------------------------------------------------------------

create table public.staff (
    id uuid primary key default gen_random_uuid(),

    full_name text not null,
    phone text,

    status text not null default 'ACTIVE',

    -- Una persona staff puede existir sin acceso a REAL.
    -- Cuando hace onboarding se vincula a un profile.
    profile_id uuid unique
        references public.profiles(id)
        on delete set null,

    created_at timestamptz not null
        default statement_timestamp(),

    updated_at timestamptz not null
        default statement_timestamp(),

    constraint staff_full_name_not_blank
        check (btrim(full_name) <> ''),

    constraint staff_phone_not_blank
        check (
            phone is null
            or btrim(phone) <> ''
        ),

    constraint staff_status_check
        check (
            status in ('ACTIVE', 'INACTIVE')
        )
);


create index staff_profile_id_idx
    on public.staff(profile_id)
    where profile_id is not null;

create index staff_status_idx
    on public.staff(status);


alter table public.staff
    enable row level security;


-- ------------------------------------------------------------
-- 2. PERMISO STAFF.MANAGE
-- ------------------------------------------------------------

insert into public.permissions (
    code,
    description
)
values (
    'staff.manage',
    'Create, update, activate and deactivate staff members'
)
on conflict (code)
do update
set
    description = excluded.description,
    updated_at = statement_timestamp();


-- MASTER puede gestionar staff.

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
  on p.code = 'staff.manage'
where r.code = 'MASTER'
on conflict (role_id, permission_id)
do update
set scope = excluded.scope;


-- ADMINISTRATIVO también puede gestionar staff.

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
  on p.code = 'staff.manage'
where r.code = 'ADMINISTRATIVO'
on conflict (role_id, permission_id)
do update
set scope = excluded.scope;


-- ------------------------------------------------------------
-- 3. CORREGIR PERMISO DE ASIGNACIONES DOCENTES
-- ------------------------------------------------------------
-- El handoff D establece que ADMINISTRATIVO puede crear,
-- modificar y cerrar asignaciones de profesores.
-- Actualmente sólo MASTER tiene este permiso.

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
  on p.code = 'teacher_assignments.manage'
where r.code = 'ADMINISTRATIVO'
on conflict (role_id, permission_id)
do update
set scope = excluded.scope;


-- ------------------------------------------------------------
-- 4. HELPER: STAFF ACTUAL DEL USUARIO
-- ------------------------------------------------------------

create or replace function app_private.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select s.id
    from public.staff s
    where s.profile_id = (select auth.uid())
      and s.status = 'ACTIVE'
    limit 1;
$$;


revoke all
on function app_private.current_staff_id()
from public, anon;

grant execute
on function app_private.current_staff_id()
to authenticated;


-- ------------------------------------------------------------
-- 5. RLS STAFF
-- ------------------------------------------------------------

create policy staff_select_manage
on public.staff
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'staff.manage',
        'ALL'
    )
);


create policy staff_select_own
on public.staff
for select
to authenticated
using (
    profile_id = (select auth.uid())
);


create policy staff_insert_manage
on public.staff
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'staff.manage',
        'ALL'
    )
);


create policy staff_update_manage
on public.staff
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'staff.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'staff.manage',
        'ALL'
    )
);


grant select, insert, update
on public.staff
to authenticated;


-- ------------------------------------------------------------
-- 6. TEACHER ASSIGNMENTS: PROFILE -> STAFF
-- ------------------------------------------------------------
-- Actualmente no existen filas, por lo que podemos hacer
-- el cambio directamente sin backfill.

alter table public.teacher_assignments
    drop constraint
    teacher_assignments_teacher_profile_id_fkey;


alter table public.teacher_assignments
    rename column teacher_profile_id
    to teacher_staff_id;


alter table public.teacher_assignments
    add constraint teacher_assignments_teacher_staff_id_fkey
    foreign key (teacher_staff_id)
    references public.staff(id)
    on delete restrict;


-- El índice y exclusión existentes se actualizan internamente
-- al renombrar la columna; sus nombres físicos pueden conservar
-- el nombre antiguo sin afectar funcionalidad.


-- ------------------------------------------------------------
-- 7. RLS TEACHER ASSIGNMENTS
-- ------------------------------------------------------------

drop policy if exists
    teacher_assignments_select_own
on public.teacher_assignments;


create policy teacher_assignments_select_own
on public.teacher_assignments
for select
to authenticated
using (
    teacher_staff_id =
        app_private.current_staff_id()
);


-- ------------------------------------------------------------
-- 8. HELPERS DOCENTES
-- ------------------------------------------------------------

create or replace function
app_private.current_teacher_has_student(
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
          and ta.teacher_staff_id =
              app_private.current_staff_id()
          and ta.valid_from <= current_date
          and (
                ta.valid_until is null
                or ta.valid_until >= current_date
          )
    );
$$;


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
         and ta.grade_level_id = e.grade_level_id
        where e.id = requested_enrollment_id
          and ta.teacher_staff_id =
              app_private.current_staff_id()
          and ta.valid_from <= current_date
          and (
                ta.valid_until is null
                or ta.valid_until >= current_date
          )
    );
$$;


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

        join public.evaluation_periods ep
          on ep.id = requested_period_id
         and ep.cycle_id = e.cycle_id

        join public.teacher_assignments ta
          on ta.teacher_staff_id =
                app_private.current_staff_id()
         and ta.group_id = requested_group_id
         and ta.group_id = e.group_id
         and ta.cycle_id = e.cycle_id
         and ta.grade_level_id = e.grade_level_id
         and ta.curriculum_subject_id =
                requested_curriculum_subject_id

        where e.id = requested_enrollment_id

          -- Esto se sustituirá por ventanas granulares en M5.
          and ep.capture_status = 'OPEN'

          and ta.valid_from <= current_date
          and (
                ta.valid_until is null
                or ta.valid_until >= current_date
          )
    );
$$;


-- ------------------------------------------------------------
-- 9. PROFESOR PRINCIPAL POR GRUPO
-- ------------------------------------------------------------

create table public.group_primary_teacher_assignments (
    id uuid primary key
        default gen_random_uuid(),

    group_id uuid not null,
    cycle_id uuid not null,

    staff_id uuid not null
        references public.staff(id)
        on delete restrict,

    valid_from date not null,
    valid_until date,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null
        default statement_timestamp(),

    updated_at timestamptz not null
        default statement_timestamp(),

    constraint group_primary_teacher_dates_check
        check (
            valid_until is null
            or valid_until >= valid_from
        ),

    constraint group_primary_teacher_group_fk
        foreign key (
            group_id,
            cycle_id
        )
        references public.groups(
            id,
            cycle_id
        )
        on delete restrict
);


alter table public.group_primary_teacher_assignments
    add constraint group_primary_teacher_no_overlap
    exclude using gist (
        group_id with =,
        daterange(
            valid_from,
            case
                when valid_until is null
                    then 'infinity'::date
                else valid_until + 1
            end,
            '[)'
        ) with &&
    );


create index group_primary_teacher_staff_idx
    on public.group_primary_teacher_assignments(
        staff_id
    );

create index group_primary_teacher_cycle_idx
    on public.group_primary_teacher_assignments(
        cycle_id
    );


alter table public.group_primary_teacher_assignments
    enable row level security;


create policy group_primary_teacher_manage
on public.group_primary_teacher_assignments
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


create policy group_primary_teacher_select_own
on public.group_primary_teacher_assignments
for select
to authenticated
using (
    staff_id =
        app_private.current_staff_id()
);


grant select, insert, update
on public.group_primary_teacher_assignments
to authenticated;


-- ------------------------------------------------------------
-- 10. STAFF INVITATIONS -> STAFF
-- ------------------------------------------------------------
-- Hoy la tabla está vacía, por lo que podemos exigir staff_id
-- desde este momento.

alter table public.staff_invitations
    add column staff_id uuid not null
    references public.staff(id)
    on delete restrict;


create index staff_invitations_staff_idx
    on public.staff_invitations(staff_id);


-- ------------------------------------------------------------
-- FIN M1
-- ------------------------------------------------------------