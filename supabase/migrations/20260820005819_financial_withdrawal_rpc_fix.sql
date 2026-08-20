-- ============================================================
-- M4.2 — Baja financiera
-- ============================================================
--
-- Coordina:
--
-- enrollments
-- enrollment_events
-- enrollment_financial_exits
-- enrollment_financial_plan_assignments
-- charges
-- charge_adjustments
-- audit_log
--
-- Periodo actual:
--   KEEP_FULL
--   PROPORTIONAL
--   AGREED
--   WAIVE
--
-- Futuro:
--   STOP_FUTURE
--   KEEP_REMAINING
--   CUSTOM
--
-- IMPORTANTE:
-- - deuda anterior nunca se toca;
-- - se usa coverage_year/month, no due_date;
-- - pagos/créditos nunca se borran;
-- - cargos futuros con dinero aplicado no se eliminan
--   silenciosamente.
-- ============================================================


create or replace function
app_private.process_financial_withdrawal_internal(
    p_enrollment_id uuid,
    p_withdrawn_on date,
    p_mode text,
    p_current_period_action text,
    p_current_period_amount numeric,
    p_custom_future_targets jsonb,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_id uuid;

    v_student_id uuid;
    v_cycle_id uuid;
    v_enrolled_on date;
    v_cycle_start date;
    v_cycle_end date;
    v_old_status text;

    v_tuition_concept_id uuid;

    v_event_id uuid;
    v_exit_id uuid;

    v_current_charge_id uuid;
    v_current_charge_count integer := 0;

    v_current_original numeric;
    v_current_adjustments numeric;
    v_current_effective numeric;
    v_current_applied numeric;
    v_current_target numeric;
    v_current_delta numeric;

    v_future_charge record;
    v_custom_item record;

    v_future_applied numeric;
    v_future_effective numeric;
    v_target_amount numeric;
    v_delta numeric;

    v_voided_future_count integer := 0;
    v_adjusted_future_count integer := 0;
    v_current_adjusted boolean := false;

    v_correlation_id uuid := gen_random_uuid();
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


    -- Baja toca matrícula + configuración financiera.

    if not app_private.current_user_has_permission(
        'students.manage',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to manage enrollment';
    end if;


    if not app_private.current_user_has_permission(
        'finance.configure',
        'ALL'
    )
    then
        raise exception
            'Insufficient permission to process financial withdrawal';
    end if;


    -- ========================================================
    -- INPUT
    -- ========================================================

    if p_enrollment_id is null then
        raise exception 'enrollment_id is required';
    end if;


    if p_withdrawn_on is null then
        raise exception 'withdrawn_on is required';
    end if;


    if p_mode not in (
        'STOP_FUTURE',
        'KEEP_REMAINING',
        'CUSTOM'
    )
    then
        raise exception
            'Invalid financial withdrawal mode';
    end if;


    if p_current_period_action not in (
        'KEEP_FULL',
        'PROPORTIONAL',
        'AGREED',
        'WAIVE'
    )
    then
        raise exception
            'Invalid current period action';
    end if;


    if p_current_period_action in (
        'PROPORTIONAL',
        'AGREED'
    )
    and (
        p_current_period_amount is null
        or p_current_period_amount < 0
    )
    then
        raise exception
            'current_period_amount is required for PROPORTIONAL or AGREED';
    end if;


    if p_current_period_action not in (
        'PROPORTIONAL',
        'AGREED'
    )
    and p_current_period_amount is not null
    then
        raise exception
            'current_period_amount is only valid for PROPORTIONAL or AGREED';
    end if;


    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Withdrawal reason is required';
    end if;


    if p_custom_future_targets is null then
        p_custom_future_targets := '[]'::jsonb;
    end if;


    if jsonb_typeof(
        p_custom_future_targets
    ) <> 'array'
    then
        raise exception
            'custom_future_targets must be a JSON array';
    end if;


    if p_mode <> 'CUSTOM'
       and jsonb_array_length(
            p_custom_future_targets
       ) > 0
    then
        raise exception
            'custom_future_targets is only valid in CUSTOM mode';
    end if;


    -- ========================================================
    -- LOCK ENROLLMENT
    -- ========================================================

    select
        e.student_id,
        e.cycle_id,
        e.enrolled_on,
        e.status,
        sc.starts_on,
        sc.ends_on
    into
        v_student_id,
        v_cycle_id,
        v_enrolled_on,
        v_old_status,
        v_cycle_start,
        v_cycle_end
    from public.enrollments e

    join public.school_cycles sc
      on sc.id = e.cycle_id

    where e.id = p_enrollment_id

    for update of e;


    if not found then
        raise exception
            'Enrollment not found';
    end if;


    -- Una baja real parte de una matrícula activa.

    if v_old_status <> 'ACTIVA' then
        raise exception
            'Only an active enrollment can be withdrawn';
    end if;


    if p_withdrawn_on < v_enrolled_on then
        raise exception
            'withdrawn_on cannot precede enrolled_on';
    end if;


    if p_withdrawn_on < v_cycle_start
       or p_withdrawn_on > v_cycle_end
    then
        raise exception
            'withdrawn_on must belong to enrollment cycle';
    end if;


    -- ========================================================
    -- TUITION
    -- ========================================================

    select fc.id
    into v_tuition_concept_id
    from public.financial_concepts fc
    where fc.code = 'TUITION';


    if v_tuition_concept_id is null then
        raise exception
            'TUITION financial concept not found';
    end if;


    -- ========================================================
    -- LOCK TUITION CHARGES FROM CURRENT MONTH FORWARD
    -- ========================================================

    perform c.id
    from public.charges c

    where c.enrollment_id =
          p_enrollment_id

      and c.financial_concept_id =
          v_tuition_concept_id

      and c.status = 'ACTIVE'

      and c.coverage_year is not null
      and c.coverage_month is not null

      and make_date(
          c.coverage_year,
          c.coverage_month,
          1
      ) >= date_trunc(
          'month',
          p_withdrawn_on
      )::date

    order by c.id

    for update;


    -- ========================================================
    -- CURRENT COVERAGE PERIOD
    -- ========================================================

    select count(*)
    into v_current_charge_count

    from public.charges c

    where c.enrollment_id =
          p_enrollment_id

      and c.financial_concept_id =
          v_tuition_concept_id

      and c.status = 'ACTIVE'

      and c.coverage_year =
          extract(
              year
              from p_withdrawn_on
          )::integer

      and c.coverage_month =
          extract(
              month
              from p_withdrawn_on
          )::integer;


    if v_current_charge_count > 1 then
        raise exception
            'Multiple active tuition charges exist for withdrawal month';
    end if;


    if v_current_charge_count = 0
       and p_current_period_action <>
           'KEEP_FULL'
    then
        raise exception
            'No active tuition charge exists for withdrawal month';
    end if;


    if v_current_charge_count = 1 then

        select c.id
        into v_current_charge_id

        from public.charges c

        where c.enrollment_id =
              p_enrollment_id

          and c.financial_concept_id =
              v_tuition_concept_id

          and c.status = 'ACTIVE'

          and c.coverage_year =
              extract(
                  year
                  from p_withdrawn_on
              )::integer

          and c.coverage_month =
              extract(
                  month
                  from p_withdrawn_on
              )::integer

        limit 1;


        -- --------------------------------------------
        -- Current effective obligation
        -- --------------------------------------------

        select
            c.original_amount,

            coalesce((
                select sum(ca.amount)
                from public.charge_adjustments ca
                where ca.charge_id = c.id
            ), 0),

            c.original_amount
            + coalesce((
                select sum(ca.amount)
                from public.charge_adjustments ca
                where ca.charge_id = c.id
            ), 0),

            coalesce((
                select sum(pa.amount)

                from public.payment_allocations pa

                join public.payments p
                  on p.id = pa.payment_id

                where pa.charge_id = c.id
                  and pa.reversed_at is null
                  and p.status = 'CONFIRMED'
            ), 0)

            +

            coalesce((
                select sum(capp.amount)

                from public.credit_applications capp

                join public.credits cr
                  on cr.id = capp.credit_id

                where capp.charge_id = c.id
                  and capp.reversed_at is null
                  and cr.status = 'ACTIVE'
            ), 0)

        into
            v_current_original,
            v_current_adjustments,
            v_current_effective,
            v_current_applied

        from public.charges c
        where c.id =
              v_current_charge_id;


        -- --------------------------------------------
        -- Determine target
        -- --------------------------------------------

        if p_current_period_action =
           'KEEP_FULL'
        then

            v_current_target :=
                v_current_effective;


        elsif p_current_period_action in (
            'PROPORTIONAL',
            'AGREED'
        )
        then

            v_current_target :=
                p_current_period_amount;


        elsif p_current_period_action =
              'WAIVE'
        then

            v_current_target := 0;

        end if;


        -- Nunca podemos convertir dinero ya aplicado
        -- en saldo negativo.

        if v_current_target <
           v_current_applied
        then
            raise exception
                'Current period target % is below already applied amount %',
                v_current_target,
                v_current_applied;
        end if;


        v_current_delta :=
            v_current_target
            - v_current_effective;


        if v_current_delta <> 0 then

            insert into public.charge_adjustments (
                charge_id,
                amount,
                adjustment_type,
                reason,
                created_by
            )
            values (
                v_current_charge_id,
                v_current_delta,

                case
                    when p_current_period_action =
                         'WAIVE'
                    then 'WITHDRAWAL'

                    when p_current_period_action =
                         'PROPORTIONAL'
                    then 'WITHDRAWAL'

                    else 'AGREEMENT'
                end,

                btrim(p_reason),
                v_actor_id
            );


            v_current_adjusted := true;

        end if;

    end if;


    -- ========================================================
    -- FUTURE — STOP_FUTURE
    -- ========================================================
    --
    -- "Future" means coverage month AFTER withdrawal month.
    --
    -- This deliberately ignores due_date because Jul/Aug may
    -- have been anchored to earlier collection dates.
    -- ========================================================

    if p_mode = 'STOP_FUTURE' then

        -- First ensure none has money applied.

        if exists (

            select 1

            from public.charges c

            where c.enrollment_id =
                  p_enrollment_id

              and c.financial_concept_id =
                  v_tuition_concept_id

              and c.status = 'ACTIVE'

              and c.coverage_year is not null
              and c.coverage_month is not null

              and make_date(
                  c.coverage_year,
                  c.coverage_month,
                  1
              ) >
                  date_trunc(
                      'month',
                      p_withdrawn_on
                  )::date

              and (

                  exists (
                      select 1

                      from public.payment_allocations pa

                      join public.payments p
                        on p.id = pa.payment_id

                      where pa.charge_id = c.id
                        and pa.reversed_at is null
                        and p.status = 'CONFIRMED'
                        and pa.amount > 0
                  )

                  or

                  exists (
                      select 1

                      from public.credit_applications capp

                      join public.credits cr
                        on cr.id =
                           capp.credit_id

                      where capp.charge_id = c.id
                        and capp.reversed_at is null
                        and cr.status = 'ACTIVE'
                        and capp.amount > 0
                  )
              )
        )
        then
            raise exception
                'Future tuition has applied money; use CUSTOM after resolving payment/credit allocation';
        end if;


        update public.charges c
        set
            status = 'VOID',
            updated_at =
                statement_timestamp()

        where c.enrollment_id =
              p_enrollment_id

          and c.financial_concept_id =
              v_tuition_concept_id

          and c.status = 'ACTIVE'

          and c.coverage_year is not null
          and c.coverage_month is not null

          and make_date(
              c.coverage_year,
              c.coverage_month,
              1
          ) >
              date_trunc(
                  'month',
                  p_withdrawn_on
              )::date;


        get diagnostics
            v_voided_future_count =
                row_count;


    -- ========================================================
    -- FUTURE — KEEP_REMAINING
    -- ========================================================

    elsif p_mode = 'KEEP_REMAINING' then

        -- Intentionally no financial mutation.
        null;


    -- ========================================================
    -- FUTURE — CUSTOM
    -- ========================================================

    elsif p_mode = 'CUSTOM' then

        -- Duplicate / malformed ids prohibited.

        if exists (
            select 1

            from (
                select
                    value ->> 'charge_id'
                        as charge_id,

                    count(*)
                        as occurrences

                from jsonb_array_elements(
                    p_custom_future_targets
                )

                group by
                    value ->> 'charge_id'
            ) x

            where x.charge_id is null
               or x.charge_id = ''
               or x.occurrences > 1
        )
        then
            raise exception
                'Each custom future charge must appear exactly once';
        end if;


        -- CUSTOM must explicitly describe every currently
        -- active future tuition charge.

        if (
            select count(*)

            from public.charges c

            where c.enrollment_id =
                  p_enrollment_id

              and c.financial_concept_id =
                  v_tuition_concept_id

              and c.status = 'ACTIVE'

              and c.coverage_year is not null
              and c.coverage_month is not null

              and make_date(
                  c.coverage_year,
                  c.coverage_month,
                  1
              ) >
                  date_trunc(
                      'month',
                      p_withdrawn_on
                  )::date
        )
        <>
        jsonb_array_length(
            p_custom_future_targets
        )
        then
            raise exception
                'CUSTOM mode must specify every active future tuition charge';
        end if;


        for v_custom_item in

            select
                (
                    value ->> 'charge_id'
                )::uuid
                    as charge_id,

                (
                    value ->> 'target_amount'
                )::numeric
                    as target_amount

            from jsonb_array_elements(
                p_custom_future_targets
            )

        loop

            if v_custom_item.target_amount
               is null

               or v_custom_item.target_amount < 0
            then
                raise exception
                    'Custom target amount must be zero or greater';
            end if;


            -- Ensure it really is a future tuition charge.

            select
                c.original_amount

                + coalesce((
                    select sum(ca.amount)
                    from public.charge_adjustments ca
                    where ca.charge_id = c.id
                ), 0),

                coalesce((
                    select sum(pa.amount)

                    from public.payment_allocations pa

                    join public.payments p
                      on p.id = pa.payment_id

                    where pa.charge_id = c.id
                      and pa.reversed_at is null
                      and p.status = 'CONFIRMED'
                ), 0)

                +

                coalesce((
                    select sum(capp.amount)

                    from public.credit_applications capp

                    join public.credits cr
                      on cr.id =
                         capp.credit_id

                    where capp.charge_id = c.id
                      and capp.reversed_at is null
                      and cr.status = 'ACTIVE'
                ), 0)

            into
                v_future_effective,
                v_future_applied

            from public.charges c

            where c.id =
                  v_custom_item.charge_id

              and c.enrollment_id =
                  p_enrollment_id

              and c.financial_concept_id =
                  v_tuition_concept_id

              and c.status = 'ACTIVE'

              and c.coverage_year is not null
              and c.coverage_month is not null

              and make_date(
                  c.coverage_year,
                  c.coverage_month,
                  1
              ) >
                  date_trunc(
                      'month',
                      p_withdrawn_on
                  )::date

            for update;


            if not found then
                raise exception
                    'Custom charge % is not an active future tuition charge',
                    v_custom_item.charge_id;
            end if;


            v_target_amount :=
                v_custom_item.target_amount;


            if v_target_amount <
               v_future_applied
            then
                raise exception
                    'Custom target % for charge % is below already applied amount %',
                    v_target_amount,
                    v_custom_item.charge_id,
                    v_future_applied;
            end if;


            -- If obligation is zero AND there is no money
            -- applied, VOID expresses "this future charge
            -- no longer applies" better than a zero adjustment.

            if v_target_amount = 0
               and v_future_applied = 0
            then

                update public.charges
                set
                    status = 'VOID',
                    updated_at =
                        statement_timestamp()

                where id =
                      v_custom_item.charge_id;


                v_voided_future_count :=
                    v_voided_future_count + 1;


            else

                v_delta :=
                    v_target_amount
                    - v_future_effective;


                if v_delta <> 0 then

                    insert into public.charge_adjustments (
                        charge_id,
                        amount,
                        adjustment_type,
                        reason,
                        created_by
                    )
                    values (
                        v_custom_item.charge_id,
                        v_delta,
                        'WITHDRAWAL',
                        btrim(p_reason),
                        v_actor_id
                    );


                    v_adjusted_future_count :=
                        v_adjusted_future_count + 1;

                end if;

            end if;

        end loop;

    end if;


    -- ========================================================
    -- CLOSE CURRENT FINANCIAL PLAN ASSIGNMENT
    -- ========================================================

    update public.enrollment_financial_plan_assignments
    set
        valid_until = p_withdrawn_on,
        updated_at = statement_timestamp()

    where enrollment_id =
          p_enrollment_id

      and valid_until is null

      and valid_from <=
          p_withdrawn_on;


    -- ========================================================
    -- ENROLLMENT EVENT
    -- ========================================================

    insert into public.enrollment_events (
        enrollment_id,
        event_type,
        effective_on,
        reason,
        notes,
        old_values,
        new_values,
        created_by
    )
    values (
        p_enrollment_id,

        'WITHDRAWN',

        p_withdrawn_on,

        btrim(p_reason),

        null,

        jsonb_build_object(
            'status',
                v_old_status
        ),

        jsonb_build_object(
            'status',
                'BAJA',
            'financial_mode',
                p_mode,
            'current_period_action',
                p_current_period_action,
            'current_period_amount',
                p_current_period_amount
        ),

        v_actor_id
    )
    returning id
    into v_event_id;


    -- ========================================================
    -- FINANCIAL EXIT
    -- ========================================================

    insert into public.enrollment_financial_exits (
        enrollment_event_id,
        mode,
        reason,
        authorized_by
    )
    values (
        v_event_id,
        p_mode,
        btrim(p_reason),
        v_actor_id
    )
    returning id
    into v_exit_id;


    -- ========================================================
    -- UPDATE CURRENT ENROLLMENT STATE
    -- ========================================================

    update public.enrollments
    set
        status = 'BAJA',
        closed_on = p_withdrawn_on,
        updated_at = statement_timestamp()

    where id = p_enrollment_id;


    -- ========================================================
    -- AUDIT
    -- ========================================================

    insert into public.audit_log (
        actor_profile_id,
        action,
        entity_name,
        entity_id,
        old_values,
        new_values,
        reason,
        correlation_id
    )
    values (
        v_actor_id,

        'ENROLLMENT_WITHDRAWN',

        'enrollments',

        p_enrollment_id,

        jsonb_build_object(
            'status',
                v_old_status,
            'closed_on',
                null
        ),

        jsonb_build_object(
            'status',
                'BAJA',
            'closed_on',
                p_withdrawn_on,
            'event_id',
                v_event_id,
            'financial_exit_id',
                v_exit_id,
            'mode',
                p_mode,
            'current_period_action',
                p_current_period_action,
            'current_period_amount',
                p_current_period_amount,
            'current_period_adjusted',
                v_current_adjusted,
            'future_voided',
                v_voided_future_count,
            'future_adjusted',
                v_adjusted_future_count
        ),

        btrim(p_reason),

        v_correlation_id
    );


    return v_event_id;

end;
$$;



-- ============================================================
-- PRIVILEGIOS INTERNAL
-- ============================================================

revoke all
on function
app_private.process_financial_withdrawal_internal(
    uuid,
    date,
    text,
    text,
    numeric,
    jsonb,
    text
)
from public, anon;


grant execute
on function
app_private.process_financial_withdrawal_internal(
    uuid,
    date,
    text,
    text,
    numeric,
    jsonb,
    text
)
to authenticated;



-- ============================================================
-- RPC PÚBLICA
-- ============================================================

create or replace function
public.process_financial_withdrawal(
    p_enrollment_id uuid,
    p_withdrawn_on date,
    p_mode text,
    p_current_period_action text,
    p_current_period_amount numeric default null,
    p_custom_future_targets jsonb default '[]'::jsonb,
    p_reason text default null
)
returns uuid
language sql
set search_path = ''
as $$
    select
        app_private.process_financial_withdrawal_internal(
            p_enrollment_id,
            p_withdrawn_on,
            p_mode,
            p_current_period_action,
            p_current_period_amount,
            p_custom_future_targets,
            p_reason
        );
$$;


revoke all
on function
public.process_financial_withdrawal(
    uuid,
    date,
    text,
    text,
    numeric,
    jsonb,
    text
)
from public, anon;


grant execute
on function
public.process_financial_withdrawal(
    uuid,
    date,
    text,
    text,
    numeric,
    jsonb, 
    text
)
to authenticated;


-- ============================================================
-- FIN M4.2
-- ============================================================