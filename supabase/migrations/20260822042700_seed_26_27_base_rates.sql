insert into public.base_rates (
    cycle_id,
    education_level_id,
    financial_concept_id,
    amount,
    valid_from,
    valid_until
)
select
    sc.id,
    el.id,
    fc.id,
    values_to_insert.amount,
    sc.starts_on,
    sc.ends_on
from (
    values
        ('Preescolar'::text, 'TUITION'::text, 1700::numeric),
        ('Primaria'::text,  'TUITION'::text, 1800::numeric),
        ('Preescolar'::text, 'ENROLLMENT_FEE'::text, 2800::numeric),
        ('Primaria'::text,  'ENROLLMENT_FEE'::text, 2800::numeric)
) as values_to_insert(level_name, concept_code, amount)
join public.school_cycles sc
  on sc.code = '26-27'
join public.education_levels el
  on el.name = values_to_insert.level_name
join public.financial_concepts fc
  on fc.code = values_to_insert.concept_code
where not exists (
    select 1
    from public.base_rates br
    where br.cycle_id = sc.id
      and br.education_level_id = el.id
      and br.financial_concept_id = fc.id
);