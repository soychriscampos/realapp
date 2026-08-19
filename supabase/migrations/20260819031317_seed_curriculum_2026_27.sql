-- ============================================================
-- SEED: CURRÍCULO ACADÉMICO 2026-27
-- ============================================================
-- Para todos los grados de Preescolar y Primaria:
--
-- - 4 campos formativos
-- - Inglés
-- - Educación Física
--
-- Evaluación inicial:
-- - cuantitativa: 6 a 10
-- - cualitativa: habilitada
-- - máximo 250 caracteres
-- ============================================================


insert into public.curriculum_subjects (
    cycle_id,
    grade_level_id,
    subject_id,
    quantitative_enabled,
    qualitative_enabled,
    quantitative_min,
    quantitative_max,
    qualitative_max_length,
    sort_order,
    is_active
)
select
    sc.id,
    gl.id,
    s.id,
    true,
    true,
    6,
    10,
    250,
    s.sort_order,
    true
from public.school_cycles sc
cross join public.grade_levels gl
cross join public.subjects s
where sc.code = '2026-27'
  and s.code in (
      'LENGUAJES',
      'SABERES_PENSAMIENTO_CIENTIFICO',
      'ETICA_NATURALEZA_SOCIEDADES',
      'HUMANO_COMUNITARIO',
      'INGLES',
      'EDUCACION_FISICA'
  )
on conflict (
    cycle_id,
    grade_level_id,
    subject_id
)
do update set
    quantitative_enabled = excluded.quantitative_enabled,
    qualitative_enabled = excluded.qualitative_enabled,
    quantitative_min = excluded.quantitative_min,
    quantitative_max = excluded.quantitative_max,
    qualitative_max_length = excluded.qualitative_max_length,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = statement_timestamp();