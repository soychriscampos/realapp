-- ============================================================
-- SEED: PLANES FINANCIEROS 2026-27
-- ============================================================
--
-- Crea:
-- - Plan regular Preescolar
-- - Plan regular Primaria
-- - 12 periodos de colegiatura:
--     septiembre 2026 → agosto 2027
--
-- IMPORTANTE:
-- - Los vencimientos son configuración inicial y posteriormente
--   podrán editarse desde el panel.
-- - Julio 2027 se ancla a diciembre 2026.
-- - Agosto 2027 se ancla a marzo 2027.
-- - Agosto 2026 NO forma parte de este plan regular.
-- - No se definen montos todavía.
-- ============================================================


-- ============================================================
-- 1. PLANES FINANCIEROS
-- ============================================================
-- Permanecen DRAFT mientras no terminemos tarifas y demás
-- configuración financiera del ciclo.
-- ============================================================

insert into public.financial_plans (
    cycle_id,
    education_level_id,
    name,
    is_default,
    status
)
select
    sc.id,
    el.id,
    'Plan regular 2026-27',
    true,
    'DRAFT'
from public.school_cycles sc
cross join public.education_levels el
where sc.code = '2026-27'
  and el.code in (
      'PREESCOLAR',
      'PRIMARIA'
  )
on conflict (
    cycle_id,
    education_level_id,
    name
)
do update set
    is_default = true,
    status = 'DRAFT',
    updated_at = statement_timestamp();


-- ============================================================
-- 2. PERIODOS REGULARES DE COLEGIATURA
-- ============================================================
--
-- Cobertura           Vencimiento inicial
-- ------------------------------------------------------------
-- Sep 2026             05-sep-2026
-- Oct 2026             05-oct-2026
-- Nov 2026             05-nov-2026
-- Dic 2026             05-dic-2026
-- Ene 2027             05-ene-2027
-- Feb 2027             05-feb-2027
-- Mar 2027             05-mar-2027
-- Abr 2027             05-abr-2027
-- May 2027             05-may-2027
-- Jun 2027             05-jun-2027
-- Jul 2027             15-dic-2026
-- Ago 2027             15-mar-2027
--
-- Los días 15 de los meses dobles son valores iniciales.
-- Podrán ajustarse posteriormente según calendario.
-- ============================================================

insert into public.financial_plan_periods (
    financial_plan_id,
    financial_concept_id,
    coverage_year,
    coverage_month,
    due_date,
    anchor_period_id,
    sort_order
)
select
    fp.id,
    fc.id,
    v.coverage_year,
    v.coverage_month,
    v.due_date,
    null,
    v.sort_order
from public.financial_plans fp
join public.school_cycles sc
    on sc.id = fp.cycle_id
join public.financial_concepts fc
    on fc.code = 'TUITION'
cross join (
    values
        (2026::smallint,  9::smallint, date '2026-09-05',  1),
        (2026::smallint, 10::smallint, date '2026-10-05',  2),
        (2026::smallint, 11::smallint, date '2026-11-05',  3),
        (2026::smallint, 12::smallint, date '2026-12-05',  4),

        (2027::smallint,  1::smallint, date '2027-01-05',  5),
        (2027::smallint,  2::smallint, date '2027-02-05',  6),
        (2027::smallint,  3::smallint, date '2027-03-05',  7),
        (2027::smallint,  4::smallint, date '2027-04-05',  8),
        (2027::smallint,  5::smallint, date '2027-05-05',  9),
        (2027::smallint,  6::smallint, date '2027-06-05', 10),

        -- Periodos anclados
        (2027::smallint,  7::smallint, date '2026-12-15', 11),
        (2027::smallint,  8::smallint, date '2027-03-15', 12)
) as v(
    coverage_year,
    coverage_month,
    due_date,
    sort_order
)
where sc.code = '2026-27'
  and fp.name = 'Plan regular 2026-27'
on conflict (
    financial_plan_id,
    financial_concept_id,
    coverage_year,
    coverage_month
)
do update set
    due_date = excluded.due_date,
    sort_order = excluded.sort_order,
    updated_at = statement_timestamp();


-- ============================================================
-- 3. ANCLA JULIO 2027 → DICIEMBRE 2026
-- ============================================================
--
-- coverage_month sigue siendo JULIO.
-- anchor_period_id indica que su obligación está vinculada al
-- periodo de diciembre.
-- ============================================================

update public.financial_plan_periods july_period
set
    anchor_period_id = december_period.id,
    updated_at = statement_timestamp()
from public.financial_plan_periods december_period
join public.financial_plans fp
    on fp.id = december_period.financial_plan_id
join public.school_cycles sc
    on sc.id = fp.cycle_id
join public.financial_concepts fc
    on fc.id = december_period.financial_concept_id
where july_period.financial_plan_id = december_period.financial_plan_id
  and july_period.financial_concept_id = december_period.financial_concept_id

  and july_period.coverage_year = 2027
  and july_period.coverage_month = 7

  and december_period.coverage_year = 2026
  and december_period.coverage_month = 12

  and sc.code = '2026-27'
  and fp.name = 'Plan regular 2026-27'
  and fc.code = 'TUITION';


-- ============================================================
-- 4. ANCLA AGOSTO 2027 → MARZO 2027
-- ============================================================

update public.financial_plan_periods august_period
set
    anchor_period_id = march_period.id,
    updated_at = statement_timestamp()
from public.financial_plan_periods march_period
join public.financial_plans fp
    on fp.id = march_period.financial_plan_id
join public.school_cycles sc
    on sc.id = fp.cycle_id
join public.financial_concepts fc
    on fc.id = march_period.financial_concept_id
where august_period.financial_plan_id = march_period.financial_plan_id
  and august_period.financial_concept_id = march_period.financial_concept_id

  and august_period.coverage_year = 2027
  and august_period.coverage_month = 8

  and march_period.coverage_year = 2027
  and march_period.coverage_month = 3

  and sc.code = '2026-27'
  and fp.name = 'Plan regular 2026-27'
  and fc.code = 'TUITION';