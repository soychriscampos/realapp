update public.school_cycles
set
  code = '26-27',
  name = '26-27',
  updated_at = statement_timestamp()
where code = '2026-27';

update public.financial_plans fp
set
  name = case
    when fp.name = 'Plan regular 2026-27'
      then 'Plan regular 26-27'
    when fp.name = 'Plan 10 pagos 2026-27'
      then 'Plan 10 pagos 26-27'
    else fp.name
  end,
  updated_at = statement_timestamp()
where fp.cycle_id = (
  select id
  from public.school_cycles
  where code = '26-27'
);