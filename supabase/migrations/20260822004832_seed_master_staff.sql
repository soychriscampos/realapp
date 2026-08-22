insert into public.staff (
  full_name,
  phone,
  status,
  profile_id
)
select
  'Christian',
  null,
  'ACTIVE',
  p.id
from public.profiles p
join public.user_roles ur
  on ur.user_id = p.id
join public.roles r
  on r.id = ur.role_id
where p.is_active = true
  and r.code = 'MASTER'
  and not exists (
    select 1
    from public.staff s
    where s.profile_id = p.id
  );