alter table public.enrollment_events
    drop constraint enrollment_events_type_check;

alter table public.enrollment_events
    add constraint enrollment_events_type_check
    check (
        event_type in (
            'ENROLLED',
            'ACTIVATED',
            'GROUP_CHANGED',
            'CLASSIFICATION_CHANGED',
            'GRADE_CHANGED',
            'ACADEMIC_DATES_CORRECTED',
            'WITHDRAWN',
            'REACTIVATED',
            'FINALIZED',
            'MARKED_NO_CONTINUA',
            'GRADUATED'
        )
    );

create or replace function
app_private.change_enrollment_grade_internal(
    p_enrollment_id uuid,
    p_grade_level_id uuid,
    p_group_id uuid,
    p_effective_on date,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_cycle_id uuid;
    v_old_grade_level_id uuid;
    v_old_group_id uuid;
    v_cycle_start date;
    v_cycle_end date;
    v_event_id uuid;
begin
    v_actor_id := (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;
    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;
    if not app_private.current_user_has_permission('students.manage', 'ALL') then
        raise exception 'Insufficient permission to correct enrollment grade';
    end if;
    if p_enrollment_id is null or p_grade_level_id is null then
        raise exception 'enrollment_id and grade_level_id are required';
    end if;
    if p_effective_on is null then
        raise exception 'effective_on is required';
    end if;
    if p_reason is null or btrim(p_reason) = '' then
        raise exception 'Reason is required';
    end if;

    if not exists (
        select 1
        from public.grade_levels gl
        where gl.id = p_grade_level_id
          and gl.is_active = true
    ) then
        raise exception 'Grade level not found';
    end if;

    select e.cycle_id, e.grade_level_id, e.group_id, sc.starts_on, sc.ends_on
    into v_cycle_id, v_old_grade_level_id, v_old_group_id, v_cycle_start, v_cycle_end
    from public.enrollments e
    join public.school_cycles sc on sc.id = e.cycle_id
    where e.id = p_enrollment_id
    for update of e;

    if not found then
        raise exception 'Enrollment not found';
    end if;
    if p_effective_on < v_cycle_start or p_effective_on > v_cycle_end then
        raise exception 'effective_on must belong to enrollment cycle';
    end if;
    if p_group_id is not null and not exists (
        select 1
        from public.groups g
        where g.id = p_group_id
          and g.cycle_id = v_cycle_id
          and g.grade_level_id = p_grade_level_id
          and g.is_active = true
    ) then
        raise exception 'Group does not belong to enrollment cycle and grade';
    end if;
    if v_old_grade_level_id is not distinct from p_grade_level_id
       and v_old_group_id is not distinct from p_group_id then
        raise exception 'No changes requested';
    end if;

    update public.enrollments
    set grade_level_id = p_grade_level_id,
        group_id = p_group_id,
        updated_at = statement_timestamp()
    where id = p_enrollment_id;

    v_event_id := app_private.record_enrollment_event_internal(
        p_enrollment_id,
        'GRADE_CHANGED',
        p_effective_on,
        p_reason,
        jsonb_build_object('grade_level_id', v_old_grade_level_id, 'group_id', v_old_group_id),
        jsonb_build_object('grade_level_id', p_grade_level_id, 'group_id', p_group_id),
        v_actor_id
    );

    insert into public.audit_log (
        actor_profile_id, action, entity_name, entity_id,
        old_values, new_values, reason, correlation_id
    )
    values (
        v_actor_id, 'ENROLLMENT_GRADE_CHANGED', 'enrollments', p_enrollment_id,
        jsonb_build_object('grade_level_id', v_old_grade_level_id, 'group_id', v_old_group_id),
        jsonb_build_object('grade_level_id', p_grade_level_id, 'group_id', p_group_id, 'event_id', v_event_id),
        btrim(p_reason), gen_random_uuid()
    );

    return v_event_id;
end;
$$;

create or replace function
public.change_enrollment_grade(
    p_enrollment_id uuid,
    p_grade_level_id uuid,
    p_group_id uuid,
    p_effective_on date,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select app_private.change_enrollment_grade_internal(
        p_enrollment_id, p_grade_level_id, p_group_id, p_effective_on, p_reason
    );
$$;

revoke all on function public.change_enrollment_grade(uuid, uuid, uuid, date, text) from public, anon;
grant execute on function public.change_enrollment_grade(uuid, uuid, uuid, date, text) to authenticated;

create or replace function
app_private.correct_enrollment_academic_dates_internal(
    p_enrollment_id uuid,
    p_enrolled_on date,
    p_classes_start_on date,
    p_effective_on date,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_old_enrolled_on date;
    v_old_classes_start_on date;
    v_closed_on date;
    v_cycle_start date;
    v_cycle_end date;
    v_event_id uuid;
begin
    v_actor_id := (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;
    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;
    if not app_private.current_user_has_permission('students.manage', 'ALL') then
        raise exception 'Insufficient permission to correct enrollment dates';
    end if;
    if p_enrollment_id is null or p_enrolled_on is null then
        raise exception 'enrollment_id and enrolled_on are required';
    end if;
    if p_effective_on is null then
        raise exception 'effective_on is required';
    end if;
    if p_reason is null or btrim(p_reason) = '' then
        raise exception 'Reason is required';
    end if;

    select e.enrolled_on, e.classes_start_on, e.closed_on, sc.starts_on, sc.ends_on
    into v_old_enrolled_on, v_old_classes_start_on, v_closed_on, v_cycle_start, v_cycle_end
    from public.enrollments e
    join public.school_cycles sc on sc.id = e.cycle_id
    where e.id = p_enrollment_id
    for update of e;

    if not found then
        raise exception 'Enrollment not found';
    end if;
    if p_effective_on < v_cycle_start or p_effective_on > v_cycle_end
       or p_enrolled_on < v_cycle_start or p_enrolled_on > v_cycle_end
       or (p_classes_start_on is not null and (p_classes_start_on < v_cycle_start or p_classes_start_on > v_cycle_end)) then
        raise exception 'Dates must belong to enrollment cycle';
    end if;
    if v_closed_on is not null and v_closed_on < p_enrolled_on then
        raise exception 'closed_on cannot precede enrolled_on';
    end if;
    if v_old_enrolled_on = p_enrolled_on
       and v_old_classes_start_on is not distinct from p_classes_start_on then
        raise exception 'No changes requested';
    end if;

    update public.enrollments
    set enrolled_on = p_enrolled_on,
        classes_start_on = p_classes_start_on,
        updated_at = statement_timestamp()
    where id = p_enrollment_id;

    v_event_id := app_private.record_enrollment_event_internal(
        p_enrollment_id,
        'ACADEMIC_DATES_CORRECTED',
        p_effective_on,
        p_reason,
        jsonb_build_object('enrolled_on', v_old_enrolled_on, 'classes_start_on', v_old_classes_start_on),
        jsonb_build_object('enrolled_on', p_enrolled_on, 'classes_start_on', p_classes_start_on),
        v_actor_id
    );

    insert into public.audit_log (
        actor_profile_id, action, entity_name, entity_id,
        old_values, new_values, reason, correlation_id
    )
    values (
        v_actor_id, 'ENROLLMENT_ACADEMIC_DATES_CORRECTED', 'enrollments', p_enrollment_id,
        jsonb_build_object('enrolled_on', v_old_enrolled_on, 'classes_start_on', v_old_classes_start_on),
        jsonb_build_object('enrolled_on', p_enrolled_on, 'classes_start_on', p_classes_start_on, 'event_id', v_event_id),
        btrim(p_reason), gen_random_uuid()
    );

    return v_event_id;
end;
$$;

create or replace function
public.correct_enrollment_academic_dates(
    p_enrollment_id uuid,
    p_enrolled_on date,
    p_classes_start_on date,
    p_effective_on date,
    p_reason text
)
returns uuid
language sql
set search_path = ''
as $$
    select app_private.correct_enrollment_academic_dates_internal(
        p_enrollment_id, p_enrolled_on, p_classes_start_on, p_effective_on, p_reason
    );
$$;

revoke all on function public.correct_enrollment_academic_dates(uuid, date, date, date, text) from public, anon;
grant execute on function public.correct_enrollment_academic_dates(uuid, date, date, date, text) to authenticated;
