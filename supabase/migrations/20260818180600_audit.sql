-- ============================================================
-- APP REAL
-- 006_audit.sql
--
-- Auditoría transversal de operaciones relevantes.
--
-- NO sustituye historiales de dominio como:
-- - enrollment_events
-- - charge_adjustments
-- - payment_reversals
-- - refunds
--
-- Sirve para registrar quién hizo qué, sobre qué entidad,
-- antes/después y bajo qué operación lógica.
-- ============================================================


-- ============================================================
-- 1. AUDIT_LOG
-- ============================================================

create table public.audit_log (
    id uuid primary key default gen_random_uuid(),

    actor_profile_id uuid
        references public.profiles(id)
        on delete restrict,

    action text not null,

    entity_name text not null,

    entity_id uuid,

    old_values jsonb,
    new_values jsonb,

    reason text,

    -- Permite agrupar varios cambios producidos por una misma
    -- operación lógica.
    --
    -- Ejemplo:
    --
    -- registrar pago
    -- ├── payments
    -- ├── payment_allocations
    -- └── credits
    --
    -- todos pueden compartir el mismo correlation_id.
    correlation_id uuid not null default gen_random_uuid(),

    occurred_at timestamptz not null default statement_timestamp(),

    constraint audit_log_action_not_blank
        check (btrim(action) <> ''),

    constraint audit_log_entity_name_not_blank
        check (btrim(entity_name) <> '')
);


create index audit_log_actor_profile_idx
    on public.audit_log (actor_profile_id)
    where actor_profile_id is not null;

create index audit_log_entity_idx
    on public.audit_log (entity_name, entity_id);

create index audit_log_correlation_idx
    on public.audit_log (correlation_id);

create index audit_log_occurred_at_idx
    on public.audit_log (occurred_at);


-- ============================================================
-- RLS
-- ============================================================

alter table public.audit_log
    enable row level security;