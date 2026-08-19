-- ============================================================
-- RLS: FINANCE + FAMILY GRADES
-- ============================================================
--
-- Reglas principales:
--
-- MASTER / ADMINISTRATIVO
--   - consulta financiera global según permisos.
--
-- TUTOR
--   - consulta finanzas sólo de alumnos vinculados.
--   - consulta calificaciones sólo cuando:
--       * family_access está ACTIVE
--       * grupo/periodo está PUBLISHED
--       * alumno no tiene adeudo vencido
--
-- Operaciones sensibles:
--   - pagos
--   - allocations
--   - créditos
--   - reversos
--   - reembolsos
--
-- NO se habilitan todavía para escritura directa.
-- Se resolverán mediante operaciones transaccionales/RPC.
-- ============================================================


-- ============================================================
-- 1. HELPER INTERNO: ¿TIENE ADEUDO VENCIDO?
-- ============================================================
--
-- Saldo del cargo:
--
-- original
-- + ajustes
-- - pagos aplicados vigentes
-- - créditos aplicados vigentes
--
-- Sólo cuentan cargos:
-- - ACTIVE
-- - cuyo due_date ya pasó
--
-- Cargos futuros NO bloquean calificaciones.
-- ============================================================

create or replace function app_private.student_has_overdue_balance(
    requested_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.charges c
        where c.student_id = requested_student_id
          and c.status = 'ACTIVE'
          and c.due_date < current_date

          and (
              c.original_amount

              + coalesce((
                    select sum(ca.amount)
                    from public.charge_adjustments ca
                    where ca.charge_id = c.id
                ), 0)

              - coalesce((
                    select sum(pa.amount)
                    from public.payment_allocations pa
                    join public.payments p
                      on p.id = pa.payment_id
                    where pa.charge_id = c.id
                      and pa.reversed_at is null
                      and p.status = 'CONFIRMED'
                ), 0)

              - coalesce((
                    select sum(capp.amount)
                    from public.credit_applications capp
                    join public.credits cr
                      on cr.id = capp.credit_id
                    where capp.charge_id = c.id
                      and capp.reversed_at is null
                      and cr.status = 'ACTIVE'
                ), 0)

          ) > 0
    );
$$;

revoke all
    on function app_private.student_has_overdue_balance(uuid)
    from public;


-- ============================================================
-- 2. ¿PUEDE VER FINANZAS DEL ALUMNO?
-- ============================================================

create or replace function app_private.current_user_can_view_student_finance(
    requested_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        app_private.current_user_has_permission(
            'balances.view',
            'ALL'
        )

        or (

            app_private.current_user_has_permission(
                'balances.view',
                'LINKED'
            )

            and app_private.current_user_has_family_access(
                requested_student_id
            )
        );
$$;

revoke all
    on function app_private.current_user_can_view_student_finance(uuid)
    from public;

grant execute
    on function app_private.current_user_can_view_student_finance(uuid)
    to authenticated;


-- ============================================================
-- 3. ¿PUEDE VER PAGOS DEL ALUMNO?
-- ============================================================

create or replace function app_private.current_user_can_view_student_payments(
    requested_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        app_private.current_user_has_permission(
            'payments.view',
            'ALL'
        )

        or (

            app_private.current_user_has_permission(
                'payments.view',
                'LINKED'
            )

            and app_private.current_user_has_family_access(
                requested_student_id
            )
        );
$$;

revoke all
    on function app_private.current_user_can_view_student_payments(uuid)
    from public;

grant execute
    on function app_private.current_user_can_view_student_payments(uuid)
    to authenticated;


-- ============================================================
-- 4. FINANZAS POR MATRÍCULA
-- ============================================================

create or replace function app_private.current_user_can_view_enrollment_finance(
    requested_enrollment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.enrollments e
        where e.id = requested_enrollment_id
          and app_private.current_user_can_view_student_finance(
              e.student_id
          )
    );
$$;

revoke all
    on function app_private.current_user_can_view_enrollment_finance(uuid)
    from public;

grant execute
    on function app_private.current_user_can_view_enrollment_finance(uuid)
    to authenticated;


-- ============================================================
-- 5. ACCESO FAMILIAR A CALIFICACIONES
-- ============================================================

create or replace function app_private.current_family_can_view_grade(
    requested_enrollment_id uuid,
    requested_group_id uuid,
    requested_period_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.enrollments e

        join public.group_period_publications gpp
          on gpp.group_id = requested_group_id
         and gpp.evaluation_period_id = requested_period_id
         and gpp.status = 'PUBLISHED'

        where e.id = requested_enrollment_id

          and e.group_id = requested_group_id

          and app_private.current_user_has_permission(
              'grades.view',
              'LINKED'
          )

          and app_private.current_user_has_family_access(
              e.student_id
          )

          and not app_private.student_has_overdue_balance(
              e.student_id
          )
    );
$$;

revoke all
    on function app_private.current_family_can_view_grade(
        uuid,
        uuid,
        uuid
    )
    from public;

grant execute
    on function app_private.current_family_can_view_grade(
        uuid,
        uuid,
        uuid
    )
    to authenticated;


-- ============================================================
-- 6. CALIFICACIONES PARA TUTOR
-- ============================================================

create policy student_evaluations_select_family
on public.student_evaluations
for select
to authenticated
using (
    app_private.current_family_can_view_grade(
        enrollment_id,
        group_id,
        evaluation_period_id
    )
);


-- ============================================================
-- 7. CONCEPTOS FINANCIEROS
-- ============================================================
-- Catálogo sin información sensible.
-- ============================================================

create policy financial_concepts_select_active
on public.financial_concepts
for select
to authenticated
using (
    app_private.current_user_is_active()
);


-- ============================================================
-- 8. CONFIGURACIÓN FINANCIERA
-- ============================================================
-- Tarifas y planes son visibles para personal con acceso
-- financiero global.
--
-- No abrimos modificación directa todavía.
-- ============================================================

create policy base_rates_select_staff
on public.base_rates
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'balances.view',
        'ALL'
    )
);


create policy benefits_select_staff
on public.benefits
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'balances.view',
        'ALL'
    )
);


create policy financial_plans_select_staff
on public.financial_plans
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'balances.view',
        'ALL'
    )
);


create policy financial_plan_periods_select_staff
on public.financial_plan_periods
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'balances.view',
        'ALL'
    )
);


-- ============================================================
-- 9. ACUERDOS FINANCIEROS DEL ALUMNO
-- ============================================================

create policy student_financial_agreements_select
on public.student_financial_agreements
for select
to authenticated
using (
    app_private.current_user_can_view_enrollment_finance(
        enrollment_id
    )
);


create policy enrollment_charge_rules_select
on public.enrollment_charge_rules
for select
to authenticated
using (
    app_private.current_user_can_view_enrollment_finance(
        enrollment_id
    )
);


-- ============================================================
-- 10. CHARGES
-- ============================================================

create policy charges_select_finance
on public.charges
for select
to authenticated
using (
    app_private.current_user_can_view_student_finance(
        student_id
    )
);


-- ============================================================
-- 11. CHARGE ADJUSTMENTS
-- ============================================================

create policy charge_adjustments_select_finance
on public.charge_adjustments
for select
to authenticated
using (
    exists (
        select 1
        from public.charges c
        where c.id = charge_id
          and app_private.current_user_can_view_student_finance(
              c.student_id
          )
    )
);


-- ============================================================
-- 12. PAYMENTS
-- ============================================================

create policy payments_select_finance
on public.payments
for select
to authenticated
using (
    app_private.current_user_can_view_student_payments(
        student_id
    )
);


-- ============================================================
-- 13. PAYMENT ALLOCATIONS
-- ============================================================

create policy payment_allocations_select_finance
on public.payment_allocations
for select
to authenticated
using (
    app_private.current_user_can_view_student_payments(
        student_id
    )
);


-- ============================================================
-- 14. CREDITS
-- ============================================================

create policy credits_select_finance
on public.credits
for select
to authenticated
using (
    app_private.current_user_can_view_student_finance(
        student_id
    )
);


create policy credit_applications_select_finance
on public.credit_applications
for select
to authenticated
using (
    app_private.current_user_can_view_student_finance(
        student_id
    )
);


-- ============================================================
-- 15. PAYMENT REVERSALS
-- ============================================================

create policy payment_reversals_select_finance
on public.payment_reversals
for select
to authenticated
using (
    exists (
        select 1
        from public.payments p
        where p.id = payment_id
          and app_private.current_user_can_view_student_payments(
              p.student_id
          )
    )
);


-- ============================================================
-- 16. REFUNDS
-- ============================================================

create policy refunds_select_finance
on public.refunds
for select
to authenticated
using (
    exists (
        select 1
        from public.payments p
        where p.id = payment_id
          and app_private.current_user_can_view_student_payments(
              p.student_id
          )
    )
);


-- ============================================================
-- 17. PAYMENT AGREEMENTS
-- ============================================================

create policy payment_agreements_select_finance
on public.payment_agreements
for select
to authenticated
using (
    app_private.current_user_can_view_enrollment_finance(
        enrollment_id
    )
);


create policy payment_agreement_installments_select_finance
on public.payment_agreement_installments
for select
to authenticated
using (
    exists (
        select 1
        from public.payment_agreements pa
        where pa.id = agreement_id
          and app_private.current_user_can_view_enrollment_finance(
              pa.enrollment_id
          )
    )
);


create policy payment_agreement_charges_select_finance
on public.payment_agreement_charges
for select
to authenticated
using (
    app_private.current_user_can_view_enrollment_finance(
        enrollment_id
    )
);


-- ============================================================
-- 18. PREINSCRIPCIONES
-- ============================================================
--
-- Por ahora sólo Master/Administrativo autorizado.
-- El portal familiar no opera preinscripciones directamente.
-- ============================================================

create policy preregistration_campaigns_select_manage
on public.preregistration_campaigns
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'preregistrations.manage',
        'ALL'
    )
    or
    app_private.current_user_has_permission(
        'campaigns.manage',
        'ALL'
    )
);


create policy preregistrations_select_manage
on public.preregistrations
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'preregistrations.manage',
        'ALL'
    )
);


-- ============================================================
-- 19. PRIVILEGIOS DATA API — SÓLO LECTURA
-- ============================================================

grant select
    on public.financial_concepts,
       public.base_rates,
       public.benefits,
       public.financial_plans,
       public.financial_plan_periods,
       public.student_financial_agreements,
       public.enrollment_charge_rules,
       public.charges,
       public.charge_adjustments,
       public.payments,
       public.payment_allocations,
       public.credits,
       public.credit_applications,
       public.payment_reversals,
       public.refunds,
       public.payment_agreements,
       public.payment_agreement_installments,
       public.payment_agreement_charges,
       public.preregistration_campaigns,
       public.preregistrations
    to authenticated;