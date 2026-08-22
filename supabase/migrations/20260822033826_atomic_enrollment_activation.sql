create or replace function app_private.create_and_activate_enrollment_internal(
    p_student_id uuid,
    p_cycle_id uuid,
    p_grade_level_id uuid,
    p_classification_id uuid,
    p_group_id uuid,
    p_activated_on date,
    p_classes_start_on date,
    p_economic_start_on date,
    p_initial_period_amount numeric default null,
    p_initial_period_due_date date default null,
    p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_actor_id uuid;
    v_enrollment_id uuid;
begin
    -- ========================================================
    -- AUTH
    -- ========================================================

    v_actor_id := (select auth.uid());

    if v_actor_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    ) then
        raise exception
            'Insufficient permission to create enrollment';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    ) then
        raise exception
            'Insufficient permission to initialize enrollment financials';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_student_id is null then
        raise exception 'student_id is required';
    end if;

    if p_cycle_id is null then
        raise exception 'cycle_id is required';
    end if;

    if p_grade_level_id is null then
        raise exception 'grade_level_id is required';
    end if;

    if p_classification_id is null then
        raise exception 'classification_id is required';
    end if;

    if p_activated_on is null then
        raise exception 'activated_on is required';
    end if;

    if p_economic_start_on is null then
        raise exception 'economic_start_on is required';
    end if;

    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception 'Reason is required';
    end if;


    -- ========================================================
    -- DUPLICATE ENROLLMENT
    -- ========================================================

    if exists (
        select 1
        from public.enrollments e
        where e.student_id = p_student_id
          and e.cycle_id = p_cycle_id
    ) then
        raise exception
            'Student already has an enrollment for this cycle';
    end if;


    -- ========================================================
    -- CREATE PENDING ENROLLMENT
    -- ========================================================

    insert into public.enrollments (
        student_id,
        cycle_id,
        grade_level_id,
        group_id,
        classification_id,
        status,
        enrolled_on,
        classes_start_on,
        created_by
    )
    values (
        p_student_id,
        p_cycle_id,
        p_grade_level_id,
        p_group_id,
        p_classification_id,
        'PENDIENTE',
        p_activated_on,
        p_classes_start_on,
        v_actor_id
    )
    returning id
    into v_enrollment_id;


    -- ========================================================
    -- BASE TUITION AGREEMENT
    -- ========================================================

    perform app_private.create_tuition_base_agreement_internal(
        v_enrollment_id,
        p_activated_on,
        p_reason
    );


    -- ========================================================
    -- INITIAL FINANCIALS
    -- ========================================================

    perform app_private.initialize_enrollment_financials_internal(
        v_enrollment_id,
        p_activated_on,
        p_economic_start_on,
        p_initial_period_amount,
        p_initial_period_due_date,
        p_reason
    );


    -- ========================================================
    -- ACTIVATE ENROLLMENT
    -- ========================================================

    perform app_private.activate_enrollment_internal(
        v_enrollment_id,
        p_activated_on,
        p_group_id,
        p_classes_start_on,
        p_reason
    );


    -- Any exception above aborts this entire PostgreSQL
    -- statement/transaction, including the initial INSERT.

    return v_enrollment_id;
end;
$function$;


create or replace function public.create_and_activate_enrollment(
    p_student_id uuid,
    p_cycle_id uuid,
    p_grade_level_id uuid,
    p_classification_id uuid,
    p_group_id uuid,
    p_activated_on date,
    p_classes_start_on date,
    p_economic_start_on date,
    p_initial_period_amount numeric default null,
    p_initial_period_due_date date default null,
    p_reason text default null
)
returns uuid
language sql
set search_path = ''
as $function$
    select app_private.create_and_activate_enrollment_internal(
        p_student_id,
        p_cycle_id,
        p_grade_level_id,
        p_classification_id,
        p_group_id,
        p_activated_on,
        p_classes_start_on,
        p_economic_start_on,
        p_initial_period_amount,
        p_initial_period_due_date,
        p_reason
    );
$function$;


revoke all on function app_private.create_and_activate_enrollment_internal(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text
) from public, anon, authenticated;


revoke all on function public.create_and_activate_enrollment(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text
) from public, anon;


grant execute on function public.create_and_activate_enrollment(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    date,
    date,
    date,
    numeric,
    date,
    text
) to authenticated;