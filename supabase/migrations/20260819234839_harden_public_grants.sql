-- ============================================================
-- M0 — Hardening de seguridad
-- ============================================================
-- No cambia RLS, reglas de negocio ni datos.
--
-- Objetivos:
-- 1. Eliminar privilegios estructurales innecesarios de roles
--    expuestos a Data API.
-- 2. Evitar que nuevas tablas creadas por postgres hereden
--    esos privilegios.
-- 3. Quitar rls_auto_enable() de la superficie RPC pública.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Tablas existentes
-- ------------------------------------------------------------

revoke truncate, references, trigger
on all tables in schema public
from anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 2. Nuevas tablas creadas por postgres
-- ------------------------------------------------------------
--
-- El proyecto tiene "Automatically expose new tables" desactivado,
-- pero los default ACL actuales todavía conceden estos privilegios
-- estructurales.
--
-- No revocamos SELECT / INSERT / UPDATE / DELETE aquí:
-- esos grants siguen siendo definidos explícitamente por cada
-- migración y protegidos por RLS.
-- ------------------------------------------------------------

alter default privileges
for role postgres
in schema public
revoke truncate, references, trigger
on tables
from anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 3. Función administrativa de auto-RLS
-- ------------------------------------------------------------
--
-- Es una función SECURITY DEFINER usada por un event trigger.
-- No forma parte de la API de aplicación y no necesita ser
-- ejecutable por clientes.
-- ------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute
    on function public.rls_auto_enable()
    from public, anon, authenticated, service_role;
  end if;
end
$$;