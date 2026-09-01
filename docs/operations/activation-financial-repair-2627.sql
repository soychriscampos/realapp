-- MANUAL OPERATIONS SCRIPT — DO NOT RUN AUTOMATICALLY.
-- Replace the cycle name if the production catalog uses another label.
-- The SELECTs are read-only. The repair block is intentionally last and must
-- be reviewed against the diagnostic output before execution.

-- A. Paid preregistration fee with no enrollment link.
select e.id as enrollment_id, s.full_name, pr.id as preregistration_id,
       c.id as charge_id, c.original_amount,
       coalesce((select sum(pa.amount) from public.payment_allocations pa
                  join public.payments p on p.id = pa.payment_id
                 where pa.charge_id = c.id and pa.reversed_at is null
                   and p.status = 'CONFIRMED'), 0) as payments_applied,
       coalesce((select sum(ca.amount) from public.credit_applications ca
                  join public.credits cr on cr.id = ca.credit_id
                 where ca.charge_id = c.id and ca.reversed_at is null
                   and cr.status = 'ACTIVE'), 0) as credits_applied,
       pr.status as preregistration_status
  from public.enrollments e
  join public.school_cycles sc on sc.id = e.cycle_id and sc.name = '26-27'
  join public.students s on s.id = e.student_id
  join public.preregistrations pr on pr.student_id = e.student_id
                                   and pr.target_cycle_id = e.cycle_id
  join public.charges c on c.id = pr.charge_id
  join public.financial_concepts fc on fc.id = c.financial_concept_id
 where e.status = 'ACTIVA' and c.enrollment_id is null and c.status = 'ACTIVE'
   and fc.code = 'ENROLLMENT_FEE'
   and pr.status not in ('CANCELLED', 'NO_CONTINUA')
   and app_private.charge_is_paid_without_refund(c.id)
 order by s.full_name;

-- B. Active enrollment with a non-final preregistration.
select e.id as enrollment_id, s.full_name, pr.id as preregistration_id,
       pr.status, pr.resolution, pr.resolved_at
  from public.enrollments e
  join public.school_cycles sc on sc.id = e.cycle_id and sc.name = '26-27'
  join public.students s on s.id = e.student_id
  join public.preregistrations pr on pr.student_id = e.student_id
                                   and pr.target_cycle_id = e.cycle_id
 where e.status = 'ACTIVA'
   and pr.status not in ('RESOLVED', 'CANCELLED', 'NO_CONTINUA')
 order by s.full_name;

-- C. Discount agreement has a version but no equivalent current assignment.
select e.id as enrollment_id, s.full_name, sfa.id as agreement_id,
       sfa.discount_category_version_id, tdcv.category_id,
       tdc.name as category_name, tdcv.value, sfa.agreed_amount,
       sfa.valid_from as agreement_valid_from, sfa.valid_until
  from public.enrollments e
  join public.school_cycles sc on sc.id = e.cycle_id and sc.name = '26-27'
  join public.students s on s.id = e.student_id
  join public.student_financial_agreements sfa on sfa.enrollment_id = e.id
  join public.financial_concepts fc on fc.id = sfa.financial_concept_id
  join public.tuition_discount_category_versions tdcv on tdcv.id = sfa.discount_category_version_id
  join public.tuition_discount_categories tdc on tdc.id = tdcv.category_id
 where e.status = 'ACTIVA' and fc.code = 'TUITION'
   and sfa.discount_category_version_id is not null
   and sfa.valid_until is null
   and not exists (
       select 1 from public.enrollment_tuition_discount_assignments a
        where a.enrollment_id = e.id and a.category_id = tdcv.category_id
          and a.valid_until is null and a.valid_from = sfa.valid_from
   )
 order by s.full_name;

-- D. Potential duplicate enrollment-fee charges and financial activity.
select e.id as enrollment_id, s.full_name, pr.id as preregistration_id,
       pc.id as preregistration_charge_id, ec.id as enrollment_charge_id,
       jsonb_build_object(
         'prereg_payments', (select coalesce(sum(pa.amount), 0) from public.payment_allocations pa join public.payments p on p.id = pa.payment_id where pa.charge_id = pc.id and pa.reversed_at is null and p.status = 'CONFIRMED'),
         'prereg_credits', (select coalesce(sum(ca.amount), 0) from public.credit_applications ca join public.credits cr on cr.id = ca.credit_id where ca.charge_id = pc.id and ca.reversed_at is null and cr.status = 'ACTIVE'),
         'prereg_adjustments', (select coalesce(sum(ca.amount), 0) from public.charge_adjustments ca where ca.charge_id = pc.id),
         'prereg_payment_reversals', (select count(*) from public.payment_reversals r where r.payment_id in (select pa.payment_id from public.payment_allocations pa where pa.charge_id = pc.id)),
         'prereg_refunds', (select coalesce(sum(r.amount), 0) from public.refunds r where r.payment_id in (select pa.payment_id from public.payment_allocations pa where pa.charge_id = pc.id)),
         'enrollment_payments', (select coalesce(sum(pa.amount), 0) from public.payment_allocations pa join public.payments p on p.id = pa.payment_id where pa.charge_id = ec.id and pa.reversed_at is null and p.status = 'CONFIRMED'),
         'enrollment_credits', (select coalesce(sum(ca.amount), 0) from public.credit_applications ca join public.credits cr on cr.id = ca.credit_id where ca.charge_id = ec.id and ca.reversed_at is null and cr.status = 'ACTIVE'),
         'enrollment_adjustments', (select coalesce(sum(ca.amount), 0) from public.charge_adjustments ca where ca.charge_id = ec.id),
         'enrollment_payment_reversals', (select count(*) from public.payment_reversals r where r.payment_id in (select pa.payment_id from public.payment_allocations pa where pa.charge_id = ec.id)),
         'enrollment_refunds', (select coalesce(sum(r.amount), 0) from public.refunds r where r.payment_id in (select pa.payment_id from public.payment_allocations pa where pa.charge_id = ec.id))
       ) as activity
  from public.enrollments e
  join public.school_cycles sc on sc.id = e.cycle_id and sc.name = '26-27'
  join public.students s on s.id = e.student_id
  join public.preregistrations pr on pr.student_id = e.student_id and pr.target_cycle_id = e.cycle_id
  join public.charges pc on pc.id = pr.charge_id
  join public.financial_concepts pfc on pfc.id = pc.financial_concept_id and pfc.code = 'ENROLLMENT_FEE'
  join public.charges ec on ec.enrollment_id = e.id and ec.cycle_id = e.cycle_id
  join public.financial_concepts efc on efc.id = ec.financial_concept_id and efc.code = 'ENROLLMENT_FEE'
 where e.status = 'ACTIVA' and pc.id <> ec.id;

-- E. Summary counts (the categories are deliberately not mutually exclusive).
with active as (
  select e.* from public.enrollments e join public.school_cycles sc on sc.id = e.cycle_id
   where e.status = 'ACTIVA' and sc.name = '26-27'
),
issues as (
  select distinct e.id, 'A' as kind from active e join public.preregistrations pr on pr.student_id=e.student_id and pr.target_cycle_id=e.cycle_id join public.charges c on c.id=pr.charge_id join public.financial_concepts fc on fc.id=c.financial_concept_id where c.enrollment_id is null and c.status='ACTIVE' and fc.code='ENROLLMENT_FEE' and pr.status not in ('CANCELLED','NO_CONTINUA') and app_private.charge_is_paid_without_refund(c.id)
  union all
  select distinct e.id, 'B' from active e join public.preregistrations pr on pr.student_id=e.student_id and pr.target_cycle_id=e.cycle_id where pr.status not in ('RESOLVED','CANCELLED','NO_CONTINUA')
  union all
  select distinct e.id, 'C' from active e join public.student_financial_agreements sfa on sfa.enrollment_id=e.id join public.financial_concepts fc on fc.id=sfa.financial_concept_id join public.tuition_discount_category_versions v on v.id=sfa.discount_category_version_id where fc.code='TUITION' and sfa.discount_category_version_id is not null and sfa.valid_until is null and not exists (select 1 from public.enrollment_tuition_discount_assignments a where a.enrollment_id=e.id and a.category_id=v.category_id and a.valid_until is null and a.valid_from=sfa.valid_from)
)
select (select count(*) from active) as total_active,
       count(distinct id) filter (where kind='A') as issue_a,
       count(distinct id) filter (where kind='B') as issue_b,
       count(distinct id) filter (where kind='C') as issue_c,
       (select count(*) from active) - count(distinct id) as clean_active
  from issues;

-- MANUAL_REVIEW_CASES — excluded from automatic repair.
with active as (
  select e.id as enrollment_id, e.student_id, e.cycle_id, e.grade_level_id,
         e.group_id, s.full_name
    from public.enrollments e
    join public.school_cycles sc on sc.id=e.cycle_id and sc.name='26-27'
    join public.students s on s.id=e.student_id
   where e.status='ACTIVA'
),
prereg as (
  select a.*, pr.id as preregistration_id, pr.campaign_id,
         pr.charge_id as preregistration_charge_id,
         pr.target_grade_level_id, pr.target_education_level_id, pr.target_group_id,
         count(*) over (partition by a.enrollment_id) as prereg_count,
         (pr.target_grade_level_id = a.grade_level_id
          and pr.target_education_level_id = gl.education_level_id
          and (pr.target_group_id is null or pr.target_group_id = a.group_id)) as academic_match
    from active a
    join public.grade_levels gl on gl.id=a.grade_level_id
    join public.preregistrations pr on pr.student_id=a.student_id and pr.target_cycle_id=a.cycle_id
                                    and pr.status not in ('CANCELLED','NO_CONTINUA')
),
fee as (
  select p.*, c.id as candidate_charge_id,
         (c.id is not null and c.status='ACTIVE' and c.enrollment_id is null
          and c.student_id=p.student_id and c.cycle_id=p.cycle_id
          and c.origin='PREREGISTRATION_CAMPAIGN'
          and fc.code='ENROLLMENT_FEE' and pc.target_cycle_id=p.cycle_id
          and pc.covered_concept_id=fc.id
          and app_private.charge_is_paid_without_refund(c.id)) as valid_prereg_charge,
         (select c2.id from public.charges c2
           join public.financial_concepts fc2 on fc2.id=c2.financial_concept_id
          where c2.enrollment_id=p.enrollment_id and c2.status='ACTIVE'
            and fc2.code='ENROLLMENT_FEE' limit 1) as existing_enrollment_fee_charge_id
    from prereg p
    left join public.charges c on c.id=p.preregistration_charge_id
    left join public.financial_concepts fc on fc.id=c.financial_concept_id
    left join public.preregistration_campaigns pc on pc.id=p.campaign_id
)
select full_name, enrollment_id, preregistration_id, preregistration_charge_id,
       existing_enrollment_fee_charge_id, reason
  from (
    select f.full_name, f.enrollment_id, f.preregistration_id,
           f.preregistration_charge_id, f.existing_enrollment_fee_charge_id,
           'EXISTING_LINKED_ENROLLMENT_FEE' as reason
      from fee f
     where f.existing_enrollment_fee_charge_id is not null
       and (f.valid_prereg_charge or f.preregistration_charge_id is not null)
    union all
    select f.full_name, f.enrollment_id, f.preregistration_id,
           f.preregistration_charge_id, f.existing_enrollment_fee_charge_id,
           'MULTIPLE_PREREGISTRATIONS'
      from fee f where f.prereg_count > 1
    union all
    select f.full_name, f.enrollment_id, f.preregistration_id,
           f.preregistration_charge_id, f.existing_enrollment_fee_charge_id,
           'ACADEMIC_MISMATCH'
      from fee f where not f.academic_match
    union all
    select f.full_name, f.enrollment_id, f.preregistration_id,
           f.preregistration_charge_id, f.existing_enrollment_fee_charge_id,
           'INVALID_OR_UNPAID_PREREGISTRATION_CHARGE'
      from fee f
     where f.academic_match and f.preregistration_charge_id is not null
       and not f.valid_prereg_charge
    union all
    select a.full_name, a.enrollment_id, null, null, null,
           'DISCOUNT_ASSIGNMENT_CONFLICT'
      from active a
      join public.student_financial_agreements sfa on sfa.enrollment_id=a.enrollment_id
                                                   and sfa.valid_until is null
                                                   and sfa.discount_category_version_id is not null
      join public.financial_concepts fc on fc.id=sfa.financial_concept_id and fc.code='TUITION'
      join public.tuition_discount_category_versions v on v.id=sfa.discount_category_version_id
      join public.enrollment_tuition_discount_assignments da on da.enrollment_id=a.enrollment_id
                                                            and da.valid_until is null
                                                            and da.category_id<>v.category_id
  ) cases
 order by full_name, enrollment_id, reason;

-- Read-only preflight counts for the automatic repair below.
with active as (
  select e.id as enrollment_id, e.student_id, e.cycle_id, e.grade_level_id, e.group_id
    from public.enrollments e
    join public.school_cycles sc on sc.id=e.cycle_id and sc.name='26-27'
   where e.status='ACTIVA'
),
charge_candidates as (
  select e.id as enrollment_id, pr.id as preregistration_id, c.id as charge_id,
         row_number() over (partition by e.id order by pr.id) as rn,
         count(*) over (partition by e.id) as candidate_count
    from active e
    join public.grade_levels gl on gl.id=e.grade_level_id
    join public.preregistrations pr on pr.student_id=e.student_id and pr.target_cycle_id=e.cycle_id
                                    and pr.status not in ('CANCELLED','NO_CONTINUA')
    join public.preregistration_campaigns pc on pc.id=pr.campaign_id and pc.target_cycle_id=e.cycle_id
    join public.charges c on c.id=pr.charge_id and c.enrollment_id is null and c.status='ACTIVE'
    join public.financial_concepts fc on fc.id=c.financial_concept_id and fc.code='ENROLLMENT_FEE'
   where pr.target_grade_level_id=e.grade_level_id
     and pr.target_education_level_id=gl.education_level_id
     and (pr.target_group_id is null or pr.target_group_id=e.group_id)
     and c.student_id=e.student_id and c.cycle_id=e.cycle_id
     and c.origin='PREREGISTRATION_CAMPAIGN'
     and pc.covered_concept_id=fc.id
     and app_private.charge_is_paid_without_refund(c.id)
     and (pr.status <> 'RESOLVED' or pr.resolution = 'ENROLLED')
     and not exists (select 1 from public.charges ec join public.financial_concepts efc on efc.id=ec.financial_concept_id where ec.enrollment_id=e.id and ec.status='ACTIVE' and efc.code='ENROLLMENT_FEE')
),
prereg_to_resolve as (
  select distinct e.id as enrollment_id, pr.id as preregistration_id
    from active e
    join public.grade_levels gl on gl.id=e.grade_level_id
    join public.preregistrations pr on pr.student_id=e.student_id and pr.target_cycle_id=e.cycle_id
                                    and pr.status in ('PENDING','CONFIRMED')
   where pr.target_grade_level_id=e.grade_level_id
     and pr.target_education_level_id=gl.education_level_id
     and (pr.target_group_id is null or pr.target_group_id=e.group_id)
     and not exists (select 1 from public.preregistrations other where other.student_id=pr.student_id and other.target_cycle_id=pr.target_cycle_id and other.status in ('PENDING','CONFIRMED') and other.id<>pr.id)
     and (pr.charge_id is null or exists (select 1 from public.charges c join public.preregistration_campaigns pc on pc.id=pr.campaign_id join public.financial_concepts fc on fc.id=c.financial_concept_id where c.id=pr.charge_id and c.student_id=e.student_id and c.cycle_id=e.cycle_id and c.enrollment_id is null and c.status='ACTIVE' and c.origin='PREREGISTRATION_CAMPAIGN' and fc.code='ENROLLMENT_FEE' and pc.target_cycle_id=e.cycle_id and pc.covered_concept_id=fc.id and app_private.charge_is_paid_without_refund(c.id)))
     and not exists (select 1 from public.charges ec join public.financial_concepts efc on efc.id=ec.financial_concept_id where ec.enrollment_id=e.id and ec.status='ACTIVE' and efc.code='ENROLLMENT_FEE')
),
assignment_candidates as (
  select distinct e.id as enrollment_id
    from active e
    join public.student_financial_agreements sfa on sfa.enrollment_id=e.id and sfa.valid_until is null and sfa.discount_category_version_id is not null
    join public.financial_concepts fc on fc.id=sfa.financial_concept_id and fc.code='TUITION'
    join public.tuition_discount_category_versions v on v.id=sfa.discount_category_version_id
   where not exists (select 1 from public.enrollment_tuition_discount_assignments a where a.enrollment_id=e.id and a.valid_until is null)
     and v.valid_from <= sfa.valid_from and (v.valid_until is null or v.valid_until >= sfa.valid_from)
),
manual_cases as (
  select distinct e.id as enrollment_id
    from active e
    join public.grade_levels gl on gl.id=e.grade_level_id
    join public.preregistrations pr on pr.student_id=e.student_id and pr.target_cycle_id=e.cycle_id and pr.status not in ('CANCELLED','NO_CONTINUA')
    join public.preregistration_campaigns pc on pc.id=pr.campaign_id and pc.target_cycle_id=e.cycle_id
    join public.charges c on c.id=pr.charge_id and c.status='ACTIVE'
    join public.financial_concepts fc on fc.id=c.financial_concept_id and fc.code='ENROLLMENT_FEE' and pc.covered_concept_id=fc.id
   where pr.target_grade_level_id=e.grade_level_id and pr.target_education_level_id=gl.education_level_id
     and (pr.target_group_id is null or pr.target_group_id=e.group_id)
     and c.student_id=e.student_id and c.cycle_id=e.cycle_id and c.origin='PREREGISTRATION_CAMPAIGN'
     and app_private.charge_is_paid_without_refund(c.id)
     and exists (select 1 from public.charges ec join public.financial_concepts efc on efc.id=ec.financial_concept_id where ec.enrollment_id=e.id and ec.status='ACTIVE' and efc.code='ENROLLMENT_FEE')
)
select (select count(*) from charge_candidates where rn=1 and candidate_count=1) as charge_links_to_apply,
       (select count(*) from prereg_to_resolve) as preregistrations_to_resolve,
       (select count(*) from assignment_candidates) as discount_assignments_to_insert,
       (select count(*) from manual_cases) as manual_review_cases;

-- MANUAL REPAIR (do not run until the SELECT results above are approved).
-- It is idempotent, does not delete or alter amounts/payments/credits, and
-- intentionally skips ambiguous rows.
begin;

with candidates as (
  select e.id as enrollment_id, pr.id as preregistration_id, c.id as charge_id,
         row_number() over (partition by e.id order by pr.id) as rn,
         count(*) over (partition by e.id) as candidate_count
    from public.enrollments e
    join public.school_cycles sc on sc.id=e.cycle_id and sc.name='26-27'
    join public.grade_levels gl on gl.id=e.grade_level_id
    join public.preregistrations pr on pr.student_id=e.student_id and pr.target_cycle_id=e.cycle_id
                                    and pr.status not in ('CANCELLED','NO_CONTINUA')
    join public.preregistration_campaigns pc on pc.id=pr.campaign_id and pc.target_cycle_id=e.cycle_id
                                             and pc.covered_concept_id is not null
    join public.charges c on c.id=pr.charge_id and c.enrollment_id is null and c.status='ACTIVE'
    join public.financial_concepts fc on fc.id=c.financial_concept_id and fc.code='ENROLLMENT_FEE' and pc.covered_concept_id=fc.id
   where e.status='ACTIVA'
     and pr.target_grade_level_id=e.grade_level_id
     and pr.target_education_level_id=gl.education_level_id
     and (pr.target_group_id is null or pr.target_group_id=e.group_id)
     and c.student_id=e.student_id and c.cycle_id=e.cycle_id
     and c.origin='PREREGISTRATION_CAMPAIGN'
     and app_private.charge_is_paid_without_refund(c.id)
     and (pr.status <> 'RESOLVED' or pr.resolution = 'ENROLLED')
     and not exists (select 1 from public.charges ec join public.financial_concepts efc on efc.id=ec.financial_concept_id where ec.enrollment_id=e.id and ec.status='ACTIVE' and efc.code='ENROLLMENT_FEE')
)
update public.charges c set enrollment_id=x.enrollment_id
  from candidates x
 where x.rn=1 and x.candidate_count=1 and c.id=x.charge_id and c.enrollment_id is null;

update public.preregistrations pr
   set status='RESOLVED', resolution='ENROLLED', resolved_at=coalesce(pr.resolved_at, statement_timestamp())
  from public.enrollments e
 where e.status='ACTIVA' and e.cycle_id=pr.target_cycle_id and e.student_id=pr.student_id
   and pr.status in ('PENDING','CONFIRMED')
   and pr.target_grade_level_id=e.grade_level_id
   and pr.target_education_level_id=(select gl.education_level_id from public.grade_levels gl where gl.id=e.grade_level_id)
   and (pr.target_group_id is null or pr.target_group_id=e.group_id)
   and not exists (select 1 from public.preregistrations other where other.student_id=pr.student_id and other.target_cycle_id=pr.target_cycle_id and other.status in ('PENDING','CONFIRMED') and other.id<>pr.id)
   and (pr.charge_id is null or exists (select 1 from public.charges c join public.preregistration_campaigns pc on pc.id=pr.campaign_id join public.financial_concepts fc on fc.id=c.financial_concept_id where c.id=pr.charge_id and c.student_id=e.student_id and c.cycle_id=e.cycle_id and c.enrollment_id is null and c.status='ACTIVE' and c.origin='PREREGISTRATION_CAMPAIGN' and fc.code='ENROLLMENT_FEE' and pc.target_cycle_id=e.cycle_id and pc.covered_concept_id=fc.id and app_private.charge_is_paid_without_refund(c.id)))
   and not exists (select 1 from public.charges ec join public.financial_concepts efc on efc.id=ec.financial_concept_id where ec.enrollment_id=e.id and ec.status='ACTIVE' and efc.code='ENROLLMENT_FEE');

with candidates as (
  select e.id as enrollment_id, sfa.valid_from, v.category_id,
         sfa.reason, sfa.authorized_by
    from public.enrollments e
    join public.school_cycles sc on sc.id=e.cycle_id and sc.name='26-27'
    join public.student_financial_agreements sfa on sfa.enrollment_id=e.id and sfa.valid_until is null and sfa.discount_category_version_id is not null
    join public.financial_concepts fc on fc.id=sfa.financial_concept_id and fc.code='TUITION'
    join public.tuition_discount_category_versions v on v.id=sfa.discount_category_version_id
   where e.status='ACTIVA'
     and not exists (select 1 from public.enrollment_tuition_discount_assignments a where a.enrollment_id=e.id and a.valid_until is null)
     and v.category_id is not null
     and v.valid_from <= sfa.valid_from
     and (v.valid_until is null or v.valid_until >= sfa.valid_from)
)
insert into public.enrollment_tuition_discount_assignments(enrollment_id, category_id, valid_from, valid_until, reason, authorized_by)
select enrollment_id, category_id, valid_from, null, coalesce(nullif(btrim(reason),''), 'Historical activation reconciliation'), authorized_by
  from candidates
on conflict do nothing;

-- Review row counts in the transaction, then COMMIT explicitly.
-- rollback;
commit;
