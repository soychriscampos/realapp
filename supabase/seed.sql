-- SOLO DESARROLLO LOCAL
-- Permite que el script de seed cree el usuario operativo.

grant select, insert, update
on public.profiles,
   public.user_roles,
   public.staff,
   public.roles
to service_role;