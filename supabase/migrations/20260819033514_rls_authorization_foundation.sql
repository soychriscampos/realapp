-- ============================================================
-- RLS: AUTHORIZATION FOUNDATION
-- ============================================================
--
-- Base de autorización para App REAL.
--
-- Crea helpers privados para:
-- - usuario activo
-- - rol activo
-- - permiso activo + scope
--
-- Y policies iniciales para:
-- - profiles
-- - roles
-- - permissions
-- - role_permissions
-- - user_roles
--
-- No abre todavía alumnos, finanzas ni académico.
-- ============================================================


-- ============================================================
-- 1. SCHEMA PRIVADO PARA HELPERS
-- ============================================================
--
-- No debe exponerse como schema de Data API.
-- ============================================================

create schema if not exists app_private;

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;


-- ============================================================
-- 2. ¿EL USUARIO ACTUAL TIENE PERFIL ACTIVO?
-- ============================================================

create or replace function app_private.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.is_active = true
    );
$$;

revoke all on function app_private.current_user_is_active() from public;
grant execute
    on function app_private.current_user_is_active()
    to authenticated;


-- ============================================================
-- 3. ¿EL USUARIO TIENE UN ROL ACTIVO?
-- ============================================================

create or replace function app_private.current_user_has_role(
    requested_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        app_private.current_user_is_active()
        and exists (
            select 1
            from public.user_roles ur
            join public.roles r
              on r.id = ur.role_id
            where ur.user_id = (select auth.uid())
              and r.code = requested_role
              and r.is_active = true
              and ur.valid_from <= statement_timestamp()
              and (
                    ur.valid_until is null
                    or ur.valid_until > statement_timestamp()
              )
        );
$$;

revoke all
    on function app_private.current_user_has_role(text)
    from public;

grant execute
    on function app_private.current_user_has_role(text)
    to authenticated;


-- ============================================================
-- 4. ¿EL USUARIO TIENE UN PERMISO?
-- ============================================================
--
-- requested_scope puede ser:
--
-- NULL      -> cualquier scope asignado
-- OWN
-- ASSIGNED
-- LINKED
-- ALL
--
-- Un permiso con scope ALL satisface cualquier scope requerido.
-- ============================================================

create or replace function app_private.current_user_has_permission(
    requested_permission text,
    requested_scope text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        app_private.current_user_is_active()
        and exists (
            select 1
            from public.user_roles ur
            join public.roles r
              on r.id = ur.role_id
            join public.role_permissions rp
              on rp.role_id = r.id
            join public.permissions p
              on p.id = rp.permission_id
            where ur.user_id = (select auth.uid())

              and r.is_active = true

              and ur.valid_from <= statement_timestamp()
              and (
                    ur.valid_until is null
                    or ur.valid_until > statement_timestamp()
              )

              and p.code = requested_permission

              and (
                    requested_scope is null
                    or rp.scope = requested_scope
                    or rp.scope = 'ALL'
              )
        );
$$;

revoke all
    on function app_private.current_user_has_permission(text, text)
    from public;

grant execute
    on function app_private.current_user_has_permission(text, text)
    to authenticated;


-- ============================================================
-- 5. PROFILES
-- ============================================================
--
-- Todo usuario activo puede leer su propio perfil.
--
-- Usuarios con users.manage / ALL pueden leer y administrar
-- perfiles.
--
-- La creación inicial del perfil durante onboarding no se
-- resolverá mediante INSERT directo del cliente.
-- ============================================================

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
    id = (select auth.uid())
);


create policy profiles_select_manage_users
on public.profiles
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


create policy profiles_update_own
on public.profiles
for update
to authenticated
using (
    id = (select auth.uid())
    and app_private.current_user_is_active()
)
with check (
    id = (select auth.uid())
);


create policy profiles_update_manage_users
on public.profiles
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


-- ============================================================
-- 6. ROLES
-- ============================================================
--
-- El catálogo puede ser leído por usuarios autenticados
-- activos.
-- Sólo users.manage / ALL podrá modificarlo.
-- ============================================================

create policy roles_select_authenticated
on public.roles
for select
to authenticated
using (
    app_private.current_user_is_active()
);


create policy roles_insert_manage_users
on public.roles
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


create policy roles_update_manage_users
on public.roles
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


-- ============================================================
-- 7. PERMISSIONS
-- ============================================================

create policy permissions_select_authenticated
on public.permissions
for select
to authenticated
using (
    app_private.current_user_is_active()
);


create policy permissions_insert_manage_users
on public.permissions
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


create policy permissions_update_manage_users
on public.permissions
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


-- ============================================================
-- 8. ROLE_PERMISSIONS
-- ============================================================

create policy role_permissions_select_authenticated
on public.role_permissions
for select
to authenticated
using (
    app_private.current_user_is_active()
);


create policy role_permissions_insert_manage_users
on public.role_permissions
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


create policy role_permissions_update_manage_users
on public.role_permissions
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


create policy role_permissions_delete_manage_users
on public.role_permissions
for delete
to authenticated
using (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


-- ============================================================
-- 9. USER_ROLES
-- ============================================================
--
-- Usuario:
-- puede conocer sus propios roles.
--
-- Master/users.manage:
-- puede consultar y administrar todos.
-- ============================================================

create policy user_roles_select_own
on public.user_roles
for select
to authenticated
using (
    user_id = (select auth.uid())
);


create policy user_roles_select_manage_users
on public.user_roles
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


create policy user_roles_insert_manage_users
on public.user_roles
for insert
to authenticated
with check (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


create policy user_roles_update_manage_users
on public.user_roles
for update
to authenticated
using (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
)
with check (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


create policy user_roles_delete_manage_users
on public.user_roles
for delete
to authenticated
using (
    app_private.current_user_has_permission(
        'users.manage',
        'ALL'
    )
);


-- ============================================================
-- 10. DATA API PRIVILEGES
-- ============================================================
--
-- Como "Automatically expose new tables" está desactivado,
-- RLS por sí solo no concede acceso vía API.
--
-- Damos únicamente los privilegios que las policies controlan.
-- ============================================================

grant select, update
    on public.profiles
    to authenticated;

grant select, insert, update
    on public.roles
    to authenticated;

grant select, insert, update
    on public.permissions
    to authenticated;

grant select, insert, update, delete
    on public.role_permissions
    to authenticated;

grant select, insert, update, delete
    on public.user_roles
    to authenticated;