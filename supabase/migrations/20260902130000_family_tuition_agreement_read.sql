-- Lectura contractual de colegiatura para el portal familiar.
--
-- SECURITY DEFINER es necesario porque student_financial_agreements no tiene
-- una política de lectura para TUTOR. La función valida explícitamente la
-- sesión y family_access ACTIVE antes de leer cualquier acuerdo.

create or replace function public.family_student_tuition_agreement(
    p_student_id uuid,
    p_cycle_id uuid
)
returns table (
    student_id uuid,
    enrollment_id uuid,
    cycle_id uuid,
    agreed_amount numeric,
    has_multiple_amounts boolean,
    agreement_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
    with eligible_enrollment as (
        select
            e.id as enrollment_id,
            e.student_id,
            e.cycle_id,
            sc.starts_on,
            sc.ends_on
        from public.enrollments e
        join public.school_cycles sc
          on sc.id = e.cycle_id
        where e.student_id = p_student_id
          and e.cycle_id = p_cycle_id
          and p_student_id is not null
          and p_cycle_id is not null
            and (select auth.uid()) is not null
            and app_private.current_user_has_family_access(e.student_id)
    ),
    cycle_agreements as (
        select
            ee.student_id,
            ee.enrollment_id,
            ee.cycle_id,
            sfa.agreed_amount,
            sfa.valid_from,
            sfa.valid_until
        from eligible_enrollment ee
        join public.student_financial_agreements sfa
          on sfa.enrollment_id = ee.enrollment_id
         and sfa.valid_from <= ee.ends_on
         and (
                sfa.valid_until is null
                or sfa.valid_until >= ee.starts_on
         )
        join public.financial_concepts fc
          on fc.id = sfa.financial_concept_id
         and fc.code = 'TUITION'
    )
    , cycle_summary as (
        select
            ca.student_id,
            ca.enrollment_id,
            ca.cycle_id,
            count(*)::integer as agreement_count,
            count(distinct ca.agreed_amount) > 1 as has_multiple_amounts,
            max(ca.agreed_amount) as single_amount
        from cycle_agreements ca
        group by ca.student_id, ca.enrollment_id, ca.cycle_id
    ),
    current_agreements as (
        select
            ca.enrollment_id,
            count(*)::integer as current_agreement_count,
            max(ca.agreed_amount) as current_amount
        from cycle_agreements ca
        join eligible_enrollment ee
          on ee.enrollment_id = ca.enrollment_id
        where current_date between ee.starts_on and ee.ends_on
          and ca.valid_from <= current_date
          and (
                ca.valid_until is null
                or ca.valid_until >= current_date
          )
        group by ca.enrollment_id
    ),
    future_start_agreements as (
        select
            ca.enrollment_id,
            count(*)::integer as start_agreement_count,
            max(ca.agreed_amount) as start_amount
        from cycle_agreements ca
        join eligible_enrollment ee
          on ee.enrollment_id = ca.enrollment_id
        where current_date < ee.starts_on
          and ca.valid_from <= ee.starts_on
          and (
                ca.valid_until is null
                or ca.valid_until >= ee.starts_on
          )
        group by ca.enrollment_id
    )
    select
        cs.student_id,
        cs.enrollment_id,
        cs.cycle_id,
        case
            when current_date between ee.starts_on and ee.ends_on
                then ca.current_amount
            when current_date > ee.ends_on
                 and not cs.has_multiple_amounts
                then cs.single_amount
            when current_date < ee.starts_on
                then fsa.start_amount
            else null
        end as agreed_amount,
        cs.has_multiple_amounts,
        cs.agreement_count
    from cycle_summary cs
    join eligible_enrollment ee
      on ee.enrollment_id = cs.enrollment_id
    left join current_agreements ca
      on ca.enrollment_id = cs.enrollment_id
     and ca.current_agreement_count = 1
    left join future_start_agreements fsa
      on fsa.enrollment_id = cs.enrollment_id
     and fsa.start_agreement_count = 1
    where (
            current_date > ee.ends_on
          )
       or (
            current_date between ee.starts_on and ee.ends_on
            and ca.current_amount is not null
          )
       or (
            current_date < ee.starts_on
            and fsa.start_amount is not null
          );
$$;

revoke all
on function public.family_student_tuition_agreement(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.family_student_tuition_agreement(uuid, uuid)
to authenticated;
