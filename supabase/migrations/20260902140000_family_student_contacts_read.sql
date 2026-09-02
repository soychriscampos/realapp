-- Read active contacts for an authorized student in the family portal.
-- RLS exposes a tutor's own relationship only, so this function performs the
-- narrower family-access check before returning contacts for that student.
create or replace function public.family_student_contacts(p_student_id uuid)
returns table (guardian_id uuid, full_name text, phone text, email text, relationship text, via_whatsapp boolean, via_email boolean)
language sql stable security definer set search_path = ''
as $$
    select sg.guardian_id, g.full_name, g.phone, g.email, sg.relationship, sg.via_whatsapp, sg.via_email
    from public.student_guardians sg
    join public.guardians g on g.id = sg.guardian_id
    where p_student_id is not null
      and (select auth.uid()) is not null
      and sg.student_id = p_student_id
      and sg.is_active
      and app_private.current_user_has_family_access(p_student_id)
    order by sg.priority, g.full_name;
$$;

revoke all on function public.family_student_contacts(uuid) from public, anon, authenticated;
grant execute on function public.family_student_contacts(uuid) to authenticated;
