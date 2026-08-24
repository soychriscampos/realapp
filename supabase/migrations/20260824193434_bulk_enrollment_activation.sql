-- ============================================================
-- H7.2A — ACTIVACIÓN MASIVA DE CONTINUIDAD
--
-- Wrapper delgado sobre la lógica individual existente.
-- No duplica reglas de matrícula ni finanzas.
--
-- Cada alumno se procesa de forma independiente:
-- un error en uno no cancela los demás.
-- ============================================================

create or replace function app_private.bulk_create_and_activate_enrollments_internal(
    p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;
    v_item jsonb;

    v_enrollment_id uuid;
    v_results jsonb := '[]'::jsonb;

    v_student_id uuid;
begin

    -- --------------------------------------------------------
    -- AUTH
    -- --------------------------------------------------------

    v_actor_id := auth.uid();

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
            'Insufficient permission to create enrollments';
    end if;

    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    ) then
        raise exception
            'Insufficient permission to initialize enrollment financials';
    end if;


    -- --------------------------------------------------------
    -- INPUT
    -- --------------------------------------------------------

    if p_items is null
       or jsonb_typeof(p_items) <> 'array'
    then
        raise exception 'items must be a JSON array';
    end if;

    if jsonb_array_length(p_items) = 0 then
        raise exception 'items cannot be empty';
    end if;


    -- --------------------------------------------------------
    -- PROCESS
    -- --------------------------------------------------------

    for v_item in
        select value
        from jsonb_array_elements(p_items)
    loop

        begin

            v_student_id :=
                nullif(
                    v_item ->> 'student_id',
                    ''
                )::uuid;

            if v_student_id is null then
                raise exception 'student_id is required';
            end if;


            v_enrollment_id :=
                app_private.create_and_activate_enrollment_internal(
                    v_student_id,

                    nullif(
                        v_item ->> 'cycle_id',
                        ''
                    )::uuid,

                    nullif(
                        v_item ->> 'grade_level_id',
                        ''
                    )::uuid,

                    nullif(
                        v_item ->> 'classification_id',
                        ''
                    )::uuid,

                    nullif(
                        v_item ->> 'group_id',
                        ''
                    )::uuid,

                    nullif(
                        v_item ->> 'activated_on',
                        ''
                    )::date,

                    nullif(
                        v_item ->> 'classes_start_on',
                        ''
                    )::date,

                    nullif(
                        v_item ->> 'economic_start_on',
                        ''
                    )::date,

                    nullif(
                        v_item ->> 'initial_period_amount',
                        ''
                    )::numeric,

                    nullif(
                        v_item ->> 'initial_period_due_date',
                        ''
                    )::date,

                    nullif(
                        v_item ->> 'enrollment_fee_mode',
                        ''
                    ),

                    nullif(
                        v_item ->> 'enrollment_fee_amount',
                        ''
                    )::numeric,

                    coalesce(
                        nullif(
                            v_item ->> 'reason',
                            ''
                        ),
                        'Activación masiva de continuidad'
                    )
                );


            v_results :=
                v_results
                || jsonb_build_array(
                    jsonb_build_object(
                        'student_id',
                            v_student_id,
                        'success',
                            true,
                        'enrollment_id',
                            v_enrollment_id,
                        'error',
                            null
                    )
                );


        exception
            when others then

                v_results :=
                    v_results
                    || jsonb_build_array(
                        jsonb_build_object(
                            'student_id',
                                v_student_id,
                            'success',
                                false,
                            'enrollment_id',
                                null,
                            'error',
                                sqlerrm
                        )
                    );

        end;

    end loop;


    return v_results;

end;
$$;


create or replace function public.bulk_create_and_activate_enrollments(
    p_items jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
    select app_private.bulk_create_and_activate_enrollments_internal(
        p_items
    );
$$;


revoke all
on function app_private.bulk_create_and_activate_enrollments_internal(jsonb)
from public, anon, authenticated;

grant execute
on function public.bulk_create_and_activate_enrollments(jsonb)
to authenticated;