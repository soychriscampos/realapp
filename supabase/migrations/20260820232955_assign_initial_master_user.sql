insert into public.profiles (
  id,
  display_name
)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
where u.email = 'camposregalado01@gmail.com'
  and not exists (
    select 1
    from public.profiles p
    where p.id = u.id
  );

insert into public.user_roles (
  user_id,
  role_id
)
select
  u.id,
  r.id
from auth.users u
cross join public.roles r
where u.email = 'camposregalado01@gmail.com'
  and r.code = 'MASTER'
  and not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = u.id
      and ur.role_id = r.id
      and ur.valid_until is null
  );