# Target Data Model

## Propósito

Define las entidades objetivo de App REAL, su responsabilidad, relaciones y decisiones estructurales.

No define SQL final, constraints, índices, RLS, triggers, migraciones ni frontend.

Fuentes complementarias:
- `business-rules.md`: reglas funcionales.
- `financial-model.md`: reglas financieras.
- `permissions.md`: autorización.
- `academic-model.md`: dominio académico.

Si existe contradicción, prevalecen las reglas de negocio.

---

# 1. Principios

- `students` representa identidad permanente; `enrollments` representa participación por ciclo.
- El historial relevante debe conservarse; el estado actual no sustituye hechos históricos.
- El saldo se deriva de cargos, ajustes, aplicaciones, créditos y reversos.
- Una persona puede existir sin cuenta de acceso.
- La cuenta familiar pertenece al tutor, no al alumno.
- Los datos personales no deben duplicarse entre dominios.

---

# 2. Identidad y familia

## `students`

Identidad permanente del alumno.

Campos clave:
- `id`
- `student_code`
- `full_name`
- `sex`
- `birth_date`
- `legacy_id`
- timestamps

Reglas:
- `student_code` es único, permanente y no reutilizable.
- Puede ser `NULL` antes de la primera matrícula formal.
- No contiene ciclo, nivel, grado, grupo, estatus, clasificación, colegiatura ni saldo.

Relaciones:
- 1:N `enrollments`
- N:M `guardians` vía `student_guardians`
- 1:N `preregistrations`
- 1:N `charges`
- 1:N `payments`

---

## `guardians`

Persona real relacionada con uno o más alumnos.

Campos clave:
- `id`
- `full_name`
- `phone`
- `email`
- datos fiscales opcionales
- `auth_user_id`
- `legacy_id`
- timestamps

Reglas:
- `email` es el correo principal para comunicación, comprobantes y onboarding.
- Si existe cuenta, el correo debe mantenerse consistente con Supabase Auth.
- `auth_user_id` es nullable, único y referencia `auth.users.id`.
- Un tutor puede tener como máximo una cuenta.

Relaciones:
- N:M `students` vía `student_guardians`
- 0..1 cuenta Auth
- 1:N `family_invitations`
- 1:N `family_access`

---

## `student_guardians`

Relación administrativa N:M alumno–tutor.

Campos clave:
- `id`
- `student_id`
- `guardian_id`
- `relationship`
- `priority`
- `via_whatsapp`
- `via_email`
- `is_active`
- `started_at`
- `ended_at`

Regla:
- No concede acceso digital por sí sola.

---

# 3. Estructura escolar

## `school_cycles`

- `id`
- `code`
- `name`
- `starts_on`
- `ends_on`
- `status`
- timestamps

Estados iniciales:
- `PREPARATION`
- `ACTIVE`
- `CLOSED`

## `education_levels`

- `id`
- `code`
- `name`
- `sort_order`
- `is_active`

## `grade_levels`

- `id`
- `education_level_id`
- `code`
- `name`
- `sort_order`
- `is_active`

Relación:
- `education_levels 1:N grade_levels`

## `groups`

- `id`
- `cycle_id`
- `grade_level_id`
- `name`
- `is_active`

Cada grupo pertenece a un ciclo específico.

## `enrollment_classifications`

- `id`
- `code`
- `name`
- `counts_for_sep`
- `counts_for_campus`
- `is_active`

Valores iniciales:
- `OFFICIAL_SEP`
- `CAMPUS`
- `VISITOR`

---

# 4. Matrícula

## `enrollments`

Participación del alumno en un ciclo.

Campos clave:
- `id`
- `student_id`
- `cycle_id`
- `grade_level_id`
- `group_id`
- `classification_id`
- `status`
- `enrolled_on`
- `classes_start_on`
- `closed_on`
- `created_by`
- timestamps

Reglas estructurales:
- una sola matrícula por alumno y ciclo;
- `grade_level_id` es obligatorio;
- `group_id` es opcional;
- el grado pertenece directamente a la matrícula;
- el grupo es una asignación adicional dentro del grado;
- los grupos se crean por ciclo y no se reutilizan entre ciclos;
- las matrículas históricas conservan sus referencias originales de grado y grupo.

Estados iniciales:
- `PREINSCRITA`
- `PENDIENTE`
- `ACTIVA`
- `BAJA`
- `FINALIZADA`
- `NO_CONTINUA`
- `EGRESADA`

Relaciones:
- N:1 `students`
- N:1 `school_cycles`
- N:1 `grade_levels`
- N:1 `groups`
- N:1 `enrollment_classifications`
- 1:N `enrollment_events`
- 1:N `student_financial_agreements`
- 1:N `enrollment_charge_rules`
- 1:N `charges`

---

## `enrollment_events`

Historial de cambios dentro de una matrícula.

Campos clave:
- `id`
- `enrollment_id`
- `event_type`
- `effective_on`
- `recorded_at`
- `reason`
- `notes`
- `created_by`
- `metadata`

Tipos iniciales:
- `ENROLLED`
- `ACTIVATED`
- `GROUP_CHANGED`
- `CLASSIFICATION_CHANGED`
- `WITHDRAWN`
- `REACTIVATED`
- `FINALIZED`
- `MARKED_NO_CONTINUA`
- `GRADUATED`

---

## `enrollment_financial_exits`

Tratamiento financiero asociado a una baja.

Campos:
- `id`
- `enrollment_event_id`
- `mode`
- `reason`
- `authorized_by`
- timestamps

Modos:
- `STOP_FUTURE`
- `KEEP_REMAINING`
- `CUSTOM`

---

# 5. Configuración financiera

## `financial_concepts`

- `id`
- `code`
- `name`
- `category`
- `is_active`

Valores iniciales:
- `TUITION`
- `ENROLLMENT_FEE`
- `PREREGISTRATION`
- `LATE_FEE`
- `OTHER`

## `base_rates`

Tarifa institucional por ciclo, nivel, concepto y vigencia.

Campos:
- `id`
- `cycle_id`
- `education_level_id`
- `financial_concept_id`
- `amount`
- `valid_from`
- `valid_until`
- `created_by`
- timestamps

## `benefits`

- `id`
- `name`
- `benefit_type`
- `value`
- `is_active`
- timestamps

Tipos:
- `PERCENTAGE`
- `FIXED_AMOUNT`

## `student_financial_agreements`

Condición financiera individual con vigencia.

Campos:
- `id`
- `enrollment_id`
- `financial_concept_id`
- `base_rate_id`
- `benefit_id`
- `base_amount_snapshot`
- `benefit_type_snapshot`
- `benefit_value_snapshot`
- `agreed_amount`
- `valid_from`
- `valid_until`
- `reason`
- `authorized_by`
- timestamps

Regla:
- los cambios crean nuevas vigencias; no sobrescriben acuerdos anteriores.

## `financial_plans`

Plantilla institucional de obligaciones.

Campos:
- `id`
- `cycle_id`
- `education_level_id`
- `name`
- `is_default`
- `status`
- timestamps

## `financial_plan_periods`

Periodos y anclas del plan.

Campos:
- `id`
- `financial_plan_id`
- `financial_concept_id`
- `coverage_year`
- `coverage_month`
- `due_date`
- `anchor_period_id`
- `sort_order`

## `enrollment_charge_rules`

Excepciones individuales al plan.

Campos:
- `id`
- `enrollment_id`
- `financial_plan_period_id`
- `action`
- `custom_due_date`
- `custom_amount`
- `reason`
- `authorized_by`
- timestamps

Acciones iniciales:
- `STANDARD`
- `NOT_APPLICABLE`
- `CHARGE_NOW`
- `CHARGE_LATER`
- `CUSTOM`

---

# 6. Finanzas operativas

## `charges`

Obligación económica concreta.

Campos:
- `id`
- `student_id`
- `enrollment_id`
- `cycle_id`
- `financial_concept_id`
- `financial_plan_period_id`
- `financial_agreement_id`
- `coverage_year`
- `coverage_month`
- `original_amount`
- `due_date`
- `origin`
- `status`
- `created_by`
- timestamps

Reglas:
- `coverage_year/month` pueden ser `NULL` para conceptos no mensuales.
- saldo, deuda e `is_overdue` se derivan; no son fuente primaria.

## `charge_adjustments`

- `id`
- `charge_id`
- `amount`
- `adjustment_type`
- `reason`
- `created_by`
- timestamps

Tipos iniciales:
- `DISCOUNT`
- `WAIVER`
- `CORRECTION`
- `WITHDRAWAL`
- `AGREEMENT`
- `OTHER`

## `payments`

Valor recibido.

Campos:
- `id`
- `payment_code`
- `student_id`
- `received_at`
- `amount`
- `method`
- `status`
- `received_by`
- `notes`
- timestamps

Métodos iniciales:
- `CASH`
- `TRANSFER`
- `CARD`
- `IN_KIND`
- `OTHER`

Regla:
- un pago puede aplicarse a cargos de distintos ciclos del mismo alumno.

## `payment_allocations`

Aplicación de un pago a un cargo.

Campos:
- `id`
- `payment_id`
- `charge_id`
- `amount`
- `allocation_mode`
- `created_by`
- `created_at`
- `reversed_at`

Modos:
- `AUTO`
- `MANUAL`

Relación:
- `payments N:M charges`

## `credits`

Saldo a favor.

Campos:
- `id`
- `student_id`
- `source_payment_id`
- `original_amount`
- `remaining_amount`
- `reserved_charge_id`
- `status`
- timestamps

## `credit_applications`

Uso de crédito sobre un cargo.

Campos:
- `id`
- `credit_id`
- `charge_id`
- `amount`
- `created_by`
- `created_at`
- `reversed_at`

## `payment_reversals`

Cancelación auditable de un pago.

Campos:
- `id`
- `payment_id`
- `reason`
- `reversed_by`
- `reversed_at`

## `refunds`

Devolución posterior de valor recibido.

Campos:
- `id`
- `payment_id`
- `amount`
- `reason`
- `refunded_at`
- `created_by`
- `authorized_by`
- timestamps

---

# 7. Preinscripciones

## `preregistration_campaigns`

- `id`
- `target_cycle_id`
- `education_level_id`
- `name`
- `starts_on`
- `ends_on`
- `price`
- `covered_concept_id`
- `allows_partial_payments`
- `non_continuation_policy`
- `status`
- timestamps

## `preregistrations`

Intención de incorporación a un ciclo futuro.

Campos:
- `id`
- `student_id`
- `campaign_id`
- `target_cycle_id`
- `target_education_level_id`
- `target_grade_level_id`
- `status`
- `created_by`
- `created_at`
- `resolved_at`
- `resolution`

Reglas:
- conserva ciclo, nivel y grado destino.
- no duplica datos personales.
- puede existir antes de `enrollment`.

---

# 8. Convenios

## `payment_agreements`

- `id`
- `enrollment_id`
- `agreement_type`
- `status`
- `original_value`
- `agreed_total`
- `starts_on`
- `accepted_on`
- `reason`
- `authorized_by`
- timestamps

Tipos iniciales:
- `SPECIAL_INSTALLMENTS`
- `DEBT_REPAYMENT`

## `payment_agreement_installments`

- `id`
- `agreement_id`
- `installment_number`
- `due_date`
- `amount`
- `status`

## `payment_agreement_charges`

- `agreement_id`
- `charge_id`
- `included_amount`

Regla:
- el convenio no sustituye los cargos originales.

---

# 9. Acceso familiar

## `family_invitations`

- `id`
- `guardian_id`
- `token_hash`
- `expires_at`
- `status`
- `created_by`
- `accepted_by`
- `accepted_at`
- timestamps

## `family_invitation_students`

- `invitation_id`
- `student_id`

Una invitación puede incluir varios hermanos.

## `family_access`
## `family_access`

Autorización digital explícita entre tutor y alumno.

Campos:
- `id`
- `guardian_id`
- `student_id`
- `invitation_id`
- `status`
- `granted_at`
- `revoked_at`
- `granted_by`
- `revoked_by`
- `revocation_reason`
- timestamps

Reglas:
- `student_guardians` representa la relación administrativa.
- `family_access` representa el acceso digital.
- `auth_user_id` no se guarda aquí porque se obtiene mediante `guardians.auth_user_id`.
- `invitation_id` es opcional.
- un acceso puede originarse en una invitación o concederse directamente a un tutor que ya tiene cuenta.
- máximo dos cuentas familiares activas distintas por alumno.
- una misma cuenta puede acceder a varios hermanos.

---

# 10. Autenticación y autorización

## `profiles`

Perfil de aplicación asociado a `auth.users`.

Campos:
- `id`
- `display_name`
- `is_active`
- timestamps

`id` referencia `auth.users.id`.

## `roles`

- `id`
- `code`
- `name`
- `is_system`
- `is_active`

Roles iniciales:
- `MASTER`
- `ADMINISTRATIVO`
- `PROFESOR`
- `TUTOR`

El catálogo es extensible.

## `permissions`

- `id`
- `code`
- `description`

## `role_permissions`

- `role_id`
- `permission_id`
- `scope`

Scopes posibles:
- `OWN`
- `ASSIGNED`
- `LINKED`
- `ALL`

## `user_roles`

- `user_id`
- `role_id`
- `valid_from`
- `valid_until`
- `assigned_by`

---

# 11. Académico

El dominio académico se define en `academic-model.md`.

Se anticipa:

## `teacher_assignments`

Asignaciones activas de profesor por ciclo, grupo, materia/campo académico y vigencia.

La definición final se cerrará junto con el resto del modelo académico.

---

# 12. Auditoría

## `audit_log`

Auditoría transversal.

Campos:
- `id`
- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `old_values`
- `new_values`
- `reason`
- `occurred_at`

No sustituye historiales específicos como `enrollment_events` o `charge_adjustments`.

---

# 13. Relaciones principales

```text
students
└── enrollments
    ├── school_cycles
    ├── groups
    ├── enrollment_classifications
    └── enrollment_events

guardians
├── student_guardians ── students
└── family_access ────── students

auth.users
└── guardians.auth_user_id

enrollment
├── student_financial_agreements
│   ├── base_rates
│   └── benefits
├── enrollment_charge_rules
└── charges
    ├── charge_adjustments
    ├── payment_allocations ── payments
    └── credit_applications ── credits

auth.users
└── user_roles
    └── roles
        └── role_permissions
            └── permissions
```

---

# 14. Fuentes únicas de verdad

| Dato | Fuente |
|---|---|
| Correo del tutor | `guardians.email` |
| Datos del tutor | `guardians` |
| Relación alumno-tutor | `student_guardians` |
| Acceso familiar | `family_access` |
| Grado y grupo | `enrollments` + estructura escolar |
| Condición financiera | `student_financial_agreements` |
| Obligaciones | `charges` |
| Aplicación de pagos | `payment_allocations` |
| Saldo | derivado de hechos financieros |

---

# 15. Fuera de alcance por ahora

Se definirán después de contrastar este modelo con el schema anterior:

- tipos SQL definitivos;
- PK/FK;
- `UNIQUE`;
- `CHECK`;
- reglas de `NULL`;
- índices;
- triggers;
- RPC;
- RLS;
- vistas;
- migraciones;
- modelo académico final.
