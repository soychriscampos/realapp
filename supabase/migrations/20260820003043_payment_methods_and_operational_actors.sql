-- ============================================================
-- M3 — Métodos de pago y actores operativos
-- ============================================================

-- ============================================================
-- 1. CATÁLOGO DE MÉTODOS
-- ============================================================

create table public.payment_methods (
    id uuid primary key default gen_random_uuid(),

    code text not null,
    name text not null,

    classification text not null,

    requires_description boolean not null default false,
    is_active boolean not null default true,
    sort_order integer not null default 100,

    created_by uuid
        references public.profiles(id)
        on delete restrict,

    created_at timestamptz not null
        default statement_timestamp(),

    updated_at timestamptz not null
        default statement_timestamp(),

    constraint payment_methods_code_not_blank
        check (btrim(code) <> ''),

    constraint payment_methods_name_not_blank
        check (btrim(name) <> ''),

    constraint payment_methods_classification_check
        check (
            classification in (
                'MONETARY',
                'IN_KIND'
            )
        ),

    constraint payment_methods_sort_order_positive
        check (sort_order > 0)
);


create unique index payment_methods_code_uq
    on public.payment_methods(
        upper(btrim(code))
    );


alter table public.payment_methods
    enable row level security;


-- Métodos iniciales.

insert into public.payment_methods (
    code,
    name,
    classification,
    requires_description,
    sort_order
)
values
    ('CASH',     'Efectivo',      'MONETARY', false, 10),
    ('TRANSFER', 'Transferencia', 'MONETARY', false, 20),
    ('DEPOSIT',  'Depósito',      'MONETARY', false, 30),
    ('CARD',     'Tarjeta',       'MONETARY', false, 40),
    ('IN_KIND',  'Especie',       'IN_KIND',  true,  50),
    ('OTHER',    'Otro',          'MONETARY', false, 60);



-- ============================================================
-- 2. PERMISO PARA CONFIGURAR MÉTODOS
-- ============================================================

insert into public.permissions (
    code,
    description
)
values (
    'payment_methods.manage',
    'Manage payment methods'
)
on conflict (code)
do update
set
    description = excluded.description,
    updated_at = statement_timestamp();


-- Sólo Master configura métodos.

insert into public.role_permissions (
    role_id,
    permission_id,
    scope
)
select
    r.id,
    p.id,
    'ALL'
from public.roles r
join public.permissions p
  on p.code = 'payment_methods.manage'
where r.code = 'MASTER'
on conflict (role_id, permission_id)
do update
set scope = excluded.scope;


-- Permiso explícito para registrar pagos a nombre de otro receptor.

insert into public.permissions (
    code,
    description
)
values (
    'payments.receive_for_others',
    'Register payments on behalf of another authorized receiver'
)
on conflict (code)
do update
set
    description = excluded.description,
    updated_at = statement_timestamp();


insert into public.role_permissions (
    role_id,
    permission_id,
    scope
)
select
    r.id,
    p.id,
    'ALL'
from public.roles r
join public.permissions p
  on p.code = 'payments.receive_for_others'
where r.code = 'MASTER'
on conflict (role_id, permission_id)
do update
set scope = excluded.scope;



-- ============================================================
-- 3. RLS MÉTODOS
-- ============================================================

create policy payment_methods_select_staff
on public.payment_methods
for select
to authenticated
using (
    app_private.current_user_has_permission(
        'payments.view',
        'ALL'
    )
    or
    app_private.current_user_has_permission(
        'payments.create',
        'ALL'
    )
);


grant select
on public.payment_methods
to authenticated;



-- ============================================================
-- 4. PAYMENTS — MÉTODO CONFIGURABLE
-- ============================================================

alter table public.payments
    add column payment_method_id uuid
        references public.payment_methods(id)
        on delete restrict;


alter table public.payments
    add column method_name_snapshot text;


alter table public.payments
    add column method_classification_snapshot text;


-- Backfill histórico CASH / TRANSFER.

update public.payments p
set
    payment_method_id = pm.id,
    method_name_snapshot = pm.name,
    method_classification_snapshot = pm.classification
from public.payment_methods pm
where upper(btrim(pm.code)) =
      upper(btrim(p.method));


alter table public.payments
    alter column payment_method_id
    set not null;


alter table public.payments
    alter column method_name_snapshot
    set not null;


alter table public.payments
    alter column method_classification_snapshot
    set not null;


alter table public.payments
    add constraint payments_method_name_snapshot_not_blank
    check (
        btrim(method_name_snapshot) <> ''
    );


alter table public.payments
    add constraint payments_method_classification_snapshot_check
    check (
        method_classification_snapshot in (
            'MONETARY',
            'IN_KIND'
        )
    );


-- method se conserva como snapshot histórico del código.
-- Ya no debe limitarse a una lista codificada.

alter table public.payments
    drop constraint payments_method_check;


alter table public.payments
    drop constraint payments_special_method_notes;


create index payments_payment_method_idx
    on public.payments(payment_method_id);



-- ============================================================
-- 5. PAYMENTS — RECEPTOR STAFF VS CAPTURISTA PROFILE
-- ============================================================

alter table public.payments
    drop constraint payments_received_by_fkey;


alter table public.payments
    rename column received_by
    to received_by_staff_id;


alter table public.payments
    add constraint payments_received_by_staff_id_fkey
    foreign key (received_by_staff_id)
    references public.staff(id)
    on delete restrict;


alter table public.payments
    add column captured_by_profile_id uuid
        references public.profiles(id)
        on delete restrict;


-- Histórico:
-- received_by_staff_id permanece NULL.
-- received_by_name_snapshot conserva receptor histórico.
-- captured_by_profile_id permanece NULL porque el ETL,
-- no una cuenta REAL, realizó la carga.


drop index if exists payments_received_by_idx;


create index payments_received_by_staff_idx
    on public.payments(received_by_staff_id)
    where received_by_staff_id is not null;


create index payments_received_by_staff_date_idx
    on public.payments(
        received_by_staff_id,
        received_at
    )
    where received_by_staff_id is not null;


create index payments_captured_by_profile_idx
    on public.payments(
        captured_by_profile_id,
        created_at
    )
    where captured_by_profile_id is not null;



-- ============================================================
-- 6. REFERENCIA / CONCEPTO VISIBLE
-- ============================================================
-- Separamos datos no financieros que B permite corregir
-- posteriormente con auditoría.

alter table public.payments
    add column bank_reference text;


alter table public.payments
    add column receipt_visible_note text;


alter table public.payments
    add constraint payments_bank_reference_not_blank
    check (
        bank_reference is null
        or btrim(bank_reference) <> ''
    );


alter table public.payments
    add constraint payments_receipt_visible_note_not_blank
    check (
        receipt_visible_note is null
        or btrim(receipt_visible_note) <> ''
    );



-- ============================================================
-- 7. REFUNDS — MÉTODO DE DEVOLUCIÓN
-- ============================================================

alter table public.refunds
    add column refund_method_id uuid
        references public.payment_methods(id)
        on delete restrict;


alter table public.refunds
    add column refund_method_code_snapshot text;


alter table public.refunds
    add column refund_method_name_snapshot text;


alter table public.refunds
    add column refund_method_classification_snapshot text;


alter table public.refunds
    add constraint refunds_method_code_snapshot_not_blank
    check (
        refund_method_code_snapshot is null
        or btrim(refund_method_code_snapshot) <> ''
    );


alter table public.refunds
    add constraint refunds_method_name_snapshot_not_blank
    check (
        refund_method_name_snapshot is null
        or btrim(refund_method_name_snapshot) <> ''
    );


alter table public.refunds
    add constraint refunds_method_classification_snapshot_check
    check (
        refund_method_classification_snapshot is null
        or refund_method_classification_snapshot in (
            'MONETARY',
            'IN_KIND'
        )
    );


create index refunds_method_idx
    on public.refunds(refund_method_id);



-- ============================================================
-- 8. NUEVO REGISTER_PAYMENT_INTERNAL
-- ============================================================

drop function if exists public.register_payment(
    uuid,
    timestamptz,
    numeric,
    text,
    text,
    jsonb
);


drop function if exists app_private.register_payment_internal(
    uuid,
    timestamptz,
    numeric,
    text,
    text,
    jsonb
);


create function app_private.register_payment_internal(
    p_student_id uuid,
    p_received_at timestamptz,
    p_amount numeric,
    p_payment_method_id uuid,
    p_received_by_staff_id uuid,
    p_bank_reference text default null,
    p_notes text default null,
    p_receipt_visible_note text default null,
    p_allocations jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_profile_id uuid;
    v_actor_staff_id uuid;

    v_receiver_name text;

    v_method_code text;
    v_method_name text;
    v_method_classification text;
    v_method_requires_description boolean;

    v_payment_id uuid;
    v_payment_code text;

    v_allocated_total numeric := 0;
    v_credit_amount numeric := 0;

    v_charge_original numeric;
    v_charge_outstanding numeric;

    v_allocation record;

    v_correlation_id uuid := gen_random_uuid();
begin

    -- --------------------------------------------------------
    -- AUTH
    -- --------------------------------------------------------

    v_actor_profile_id := (select auth.uid());

    if v_actor_profile_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if not app_private.current_user_has_permission(
        'payments.create',
        'ALL'
    ) then
        raise exception
            'Insufficient permission to register payments';
    end if;


    -- --------------------------------------------------------
    -- VALIDACIONES GENERALES
    -- --------------------------------------------------------

    if p_student_id is null then
        raise exception 'student_id is required';
    end if;

    if not exists (
        select 1
        from public.students s
        where s.id = p_student_id
    ) then
        raise exception 'Student does not exist';
    end if;

    if p_received_at is null then
        raise exception 'received_at is required';
    end if;

    if p_amount is null or p_amount <= 0 then
        raise exception
            'Payment amount must be greater than zero';
    end if;

    if p_received_by_staff_id is null then
        raise exception 'received_by_staff_id is required';
    end if;


    -- --------------------------------------------------------
    -- RECEPTOR
    -- --------------------------------------------------------

    select
        s.full_name
    into
        v_receiver_name
    from public.staff s
    where s.id = p_received_by_staff_id
      and s.status = 'ACTIVE';

    if v_receiver_name is null then
        raise exception 'Active receiver staff not found';
    end if;


    v_actor_staff_id :=
        app_private.current_staff_id();


    -- ADMINISTRATIVO:
    -- sólo puede registrar pagos que él mismo recibió.
    --
    -- MASTER:
    -- puede registrar en nombre de otro receptor.

    if p_received_by_staff_id
       is distinct from v_actor_staff_id
       and not app_private.current_user_has_permission(
           'payments.receive_for_others',
           'ALL'
       )
    then
        raise exception
            'Cannot register payment for another receiver';
    end if;


    -- --------------------------------------------------------
    -- MÉTODO
    -- --------------------------------------------------------

    select
        upper(btrim(pm.code)),
        pm.name,
        pm.classification,
        pm.requires_description
    into
        v_method_code,
        v_method_name,
        v_method_classification,
        v_method_requires_description
    from public.payment_methods pm
    where pm.id = p_payment_method_id
      and pm.is_active = true;

    if v_method_code is null then
        raise exception 'Active payment method not found';
    end if;


    if v_method_requires_description
       and (
           p_notes is null
           or btrim(p_notes) = ''
       )
    then
        raise exception
            'Description is required for this payment method';
    end if;


    if p_allocations is null then
        p_allocations := '[]'::jsonb;
    end if;

    if jsonb_typeof(p_allocations) <> 'array' then
        raise exception 'allocations must be a JSON array';
    end if;


    -- --------------------------------------------------------
    -- EVITAR CARGO DUPLICADO
    -- --------------------------------------------------------

    if exists (
        select 1
        from (
            select
                value ->> 'charge_id' as charge_id,
                count(*) as occurrences
            from jsonb_array_elements(p_allocations)
            group by value ->> 'charge_id'
        ) x
        where x.charge_id is null
           or x.charge_id = ''
           or x.occurrences > 1
    ) then
        raise exception
            'Each charge may appear only once in allocations';
    end if;


    -- --------------------------------------------------------
    -- VALIDAR / BLOQUEAR CARGOS
    -- --------------------------------------------------------

    for v_allocation in
        select
            (value ->> 'charge_id')::uuid as charge_id,
            (value ->> 'amount')::numeric as amount
        from jsonb_array_elements(p_allocations)
        order by (value ->> 'charge_id')::uuid
    loop

        if v_allocation.amount is null
           or v_allocation.amount <= 0
        then
            raise exception
                'Allocation amount must be greater than zero';
        end if;


        select c.original_amount
        into v_charge_original
        from public.charges c
        where c.id = v_allocation.charge_id
          and c.student_id = p_student_id
          and c.status = 'ACTIVE'
        for update;

        if not found then
            raise exception
                'Active charge % does not belong to student %',
                v_allocation.charge_id,
                p_student_id;
        end if;


        select
            v_charge_original

            + coalesce((
                select sum(ca.amount)
                from public.charge_adjustments ca
                where ca.charge_id =
                      v_allocation.charge_id
            ), 0)

            - coalesce((
                select sum(pa.amount)
                from public.payment_allocations pa
                join public.payments p
                  on p.id = pa.payment_id
                where pa.charge_id =
                      v_allocation.charge_id
                  and pa.reversed_at is null
                  and p.status = 'CONFIRMED'
            ), 0)

            - coalesce((
                select sum(capp.amount)
                from public.credit_applications capp
                join public.credits cr
                  on cr.id = capp.credit_id
                where capp.charge_id =
                      v_allocation.charge_id
                  and capp.reversed_at is null
                  and cr.status = 'ACTIVE'
            ), 0)

        into v_charge_outstanding;


        if v_charge_outstanding <= 0 then
            raise exception
                'Charge % has no outstanding balance',
                v_allocation.charge_id;
        end if;


        if v_allocation.amount >
           v_charge_outstanding
        then
            raise exception
                'Allocation % exceeds outstanding balance % for charge %',
                v_allocation.amount,
                v_charge_outstanding,
                v_allocation.charge_id;
        end if;


        v_allocated_total :=
            v_allocated_total + v_allocation.amount;

    end loop;


    if v_allocated_total > p_amount then
        raise exception
            'Allocated total % exceeds payment amount %',
            v_allocated_total,
            p_amount;
    end if;


    -- --------------------------------------------------------
    -- CREAR PAGO
    -- --------------------------------------------------------

    v_payment_code :=
        'PAY-'
        || to_char(
            clock_timestamp(),
            'YYYYMMDDHH24MISSMS'
        )
        || '-'
        || upper(
            substr(
                gen_random_uuid()::text,
                1,
                8
            )
        );


    insert into public.payments (
        payment_code,
        student_id,
        received_at,
        amount,

        payment_method_id,
        method,
        method_name_snapshot,
        method_classification_snapshot,

        status,

        received_by_staff_id,
        received_by_name_snapshot,
        captured_by_profile_id,

        bank_reference,
        notes,
        receipt_visible_note
    )
    values (
        v_payment_code,
        p_student_id,
        p_received_at,
        p_amount,

        p_payment_method_id,
        v_method_code,
        v_method_name,
        v_method_classification,

        'CONFIRMED',

        p_received_by_staff_id,
        v_receiver_name,
        v_actor_profile_id,

        nullif(btrim(p_bank_reference), ''),
        nullif(btrim(p_notes), ''),
        nullif(btrim(p_receipt_visible_note), '')
    )
    returning id
    into v_payment_id;


    -- --------------------------------------------------------
    -- ALLOCATIONS
    -- --------------------------------------------------------

    for v_allocation in
        select
            (value ->> 'charge_id')::uuid as charge_id,
            (value ->> 'amount')::numeric as amount
        from jsonb_array_elements(p_allocations)
        order by (value ->> 'charge_id')::uuid
    loop

        insert into public.payment_allocations (
            student_id,
            payment_id,
            charge_id,
            amount,
            allocation_mode,
            created_by
        )
        values (
            p_student_id,
            v_payment_id,
            v_allocation.charge_id,
            v_allocation.amount,
            'MANUAL',
            v_actor_profile_id
        );

    end loop;


    -- --------------------------------------------------------
    -- EXCESO → CRÉDITO
    -- --------------------------------------------------------

    v_credit_amount :=
        p_amount - v_allocated_total;


    if v_credit_amount > 0 then

        insert into public.credits (
            student_id,
            source_payment_id,
            original_amount,
            reserved_charge_id,
            status
        )
        values (
            p_student_id,
            v_payment_id,
            v_credit_amount,
            null,
            'ACTIVE'
        );

    end if;


    -- --------------------------------------------------------
    -- AUDITORÍA
    -- --------------------------------------------------------

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
        v_actor_profile_id,
        'PAYMENT_REGISTERED',
        'payments',
        v_payment_id,
        null,
        jsonb_build_object(
            'payment_code', v_payment_code,
            'student_id', p_student_id,
            'received_at', p_received_at,
            'amount', p_amount,
            'payment_method_id', p_payment_method_id,
            'method_code', v_method_code,
            'method_classification',
                v_method_classification,
            'received_by_staff_id',
                p_received_by_staff_id,
            'receiver_name',
                v_receiver_name,
            'captured_by_profile_id',
                v_actor_profile_id,
            'allocated_amount',
                v_allocated_total,
            'credit_amount',
                v_credit_amount
        ),
        null,
        v_correlation_id
    );


    return v_payment_id;
end;
$$;


revoke all
on function app_private.register_payment_internal(
    uuid,
    timestamptz,
    numeric,
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb
)
from public, anon;


grant execute
on function app_private.register_payment_internal(
    uuid,
    timestamptz,
    numeric,
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb
)
to authenticated;



-- ============================================================
-- 9. RPC PÚBLICA REGISTER_PAYMENT
-- ============================================================

create function public.register_payment(
    p_student_id uuid,
    p_received_at timestamptz,
    p_amount numeric,
    p_payment_method_id uuid,
    p_received_by_staff_id uuid,
    p_bank_reference text default null,
    p_notes text default null,
    p_receipt_visible_note text default null,
    p_allocations jsonb default '[]'::jsonb
)
returns uuid
language sql
set search_path = ''
as $$
    select app_private.register_payment_internal(
        p_student_id,
        p_received_at,
        p_amount,
        p_payment_method_id,
        p_received_by_staff_id,
        p_bank_reference,
        p_notes,
        p_receipt_visible_note,
        p_allocations
    );
$$;


revoke all
on function public.register_payment(
    uuid,
    timestamptz,
    numeric,
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb
)
from public, anon;


grant execute
on function public.register_payment(
    uuid,
    timestamptz,
    numeric,
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb
)
to authenticated;



-- ============================================================
-- 10. REVERSE_PAYMENT — OWN CONTRA STAFF RECEPTOR
-- ============================================================

create or replace function
app_private.reverse_payment_internal(
    p_payment_id uuid,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_profile_id uuid;
    v_actor_staff_id uuid;

    v_student_id uuid;
    v_payment_amount numeric;
    v_payment_code text;
    v_received_by_staff_id uuid;
    v_payment_status text;

    v_reversal_id uuid;
    v_reversed_at timestamptz :=
        statement_timestamp();

    v_correlation_id uuid :=
        gen_random_uuid();

    v_allocation_count integer := 0;
    v_credit_count integer := 0;
    v_credit_application_count integer := 0;
begin

    v_actor_profile_id :=
        (select auth.uid());

    if v_actor_profile_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;

    if p_payment_id is null then
        raise exception 'payment_id is required';
    end if;

    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Reversal reason is required';
    end if;


    select
        p.student_id,
        p.amount,
        p.payment_code,
        p.received_by_staff_id,
        p.status
    into
        v_student_id,
        v_payment_amount,
        v_payment_code,
        v_received_by_staff_id,
        v_payment_status
    from public.payments p
    where p.id = p_payment_id
    for update;


    if not found then
        raise exception 'Payment not found';
    end if;


    v_actor_staff_id :=
        app_private.current_staff_id();


    if not (
        app_private.current_user_has_permission(
            'payments.reverse',
            'ALL'
        )

        or (

            app_private.current_user_has_permission(
                'payments.reverse',
                'OWN'
            )

            and v_actor_staff_id is not null
            and v_received_by_staff_id =
                v_actor_staff_id
        )
    )
    then
        raise exception
            'Insufficient permission to reverse payment';
    end if;


    if v_payment_status <> 'CONFIRMED' then
        raise exception
            'Only confirmed payments can be reversed';
    end if;


    if exists (
        select 1
        from public.payment_reversals pr
        where pr.payment_id = p_payment_id
    )
    then
        raise exception
            'Payment has already been reversed';
    end if;


    if exists (
        select 1
        from public.refunds r
        where r.payment_id = p_payment_id
    )
    then
        raise exception
            'Payment has refunds and cannot be reversed';
    end if;


    perform cr.id
    from public.credits cr
    where cr.source_payment_id = p_payment_id
    order by cr.id
    for update;


    update public.credit_applications ca
    set reversed_at = v_reversed_at
    where ca.credit_id in (
        select cr.id
        from public.credits cr
        where cr.source_payment_id =
              p_payment_id
    )
      and ca.reversed_at is null;

    get diagnostics
        v_credit_application_count = row_count;


    update public.credits cr
    set
        status = 'VOID',
        updated_at = v_reversed_at
    where cr.source_payment_id =
          p_payment_id
      and cr.status = 'ACTIVE';

    get diagnostics
        v_credit_count = row_count;


    update public.payment_allocations pa
    set reversed_at = v_reversed_at
    where pa.payment_id =
          p_payment_id
      and pa.reversed_at is null;

    get diagnostics
        v_allocation_count = row_count;


    insert into public.payment_reversals (
        payment_id,
        reason,
        reversed_by,
        reversed_at
    )
    values (
        p_payment_id,
        btrim(p_reason),
        v_actor_profile_id,
        v_reversed_at
    )
    returning id
    into v_reversal_id;


    update public.payments
    set
        status = 'REVERSED',
        updated_at = v_reversed_at
    where id = p_payment_id;


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
        v_actor_profile_id,
        'PAYMENT_REVERSED',
        'payments',
        p_payment_id,

        jsonb_build_object(
            'status', 'CONFIRMED',
            'payment_code', v_payment_code,
            'student_id', v_student_id,
            'amount', v_payment_amount,
            'received_by_staff_id',
                v_received_by_staff_id
        ),

        jsonb_build_object(
            'status', 'REVERSED',
            'reversal_id', v_reversal_id,
            'reversed_allocations',
                v_allocation_count,
            'voided_credits',
                v_credit_count,
            'reversed_credit_applications',
                v_credit_application_count
        ),

        btrim(p_reason),
        v_correlation_id
    );


    return v_reversal_id;
end;
$$;



-- ============================================================
-- 11. NUEVO REFUND_PAYMENT_INTERNAL
-- ============================================================

drop function if exists public.refund_payment(
    uuid,
    numeric,
    timestamptz,
    text,
    jsonb
);


drop function if exists app_private.refund_payment_internal(
    uuid,
    numeric,
    timestamptz,
    text,
    jsonb
);


create function app_private.refund_payment_internal(
    p_payment_id uuid,
    p_amount numeric,
    p_refunded_at timestamptz,
    p_refund_method_id uuid,
    p_reason text,
    p_components jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_profile_id uuid;
    v_actor_staff_id uuid;

    v_student_id uuid;
    v_payment_amount numeric;
    v_payment_status text;
    v_received_by_staff_id uuid;

    v_previous_refunds numeric := 0;
    v_component_total numeric := 0;

    v_refund_method_code text;
    v_refund_method_name text;
    v_refund_method_classification text;

    v_refund_id uuid;
    v_correlation_id uuid :=
        gen_random_uuid();

    v_component record;

    v_source_student_id uuid;
    v_source_payment_id uuid;

    v_source_amount numeric;
    v_remaining_amount numeric;

    v_charge_id uuid;
    v_allocation_mode text;
begin

    -- --------------------------------------------------------
    -- AUTH
    -- --------------------------------------------------------

    v_actor_profile_id :=
        (select auth.uid());

    if v_actor_profile_id is null then
        raise exception 'Authentication required';
    end if;

    if not app_private.current_user_is_active() then
        raise exception 'Inactive user';
    end if;


    -- --------------------------------------------------------
    -- VALIDACIONES
    -- --------------------------------------------------------

    if p_payment_id is null then
        raise exception 'payment_id is required';
    end if;

    if p_amount is null
       or p_amount <= 0
    then
        raise exception
            'Refund amount must be greater than zero';
    end if;

    if p_refunded_at is null then
        raise exception
            'refunded_at is required';
    end if;

    if p_reason is null
       or btrim(p_reason) = ''
    then
        raise exception
            'Refund reason is required';
    end if;


    if p_components is null
       or jsonb_typeof(p_components) <> 'array'
       or jsonb_array_length(p_components) = 0
    then
        raise exception
            'Refund components are required';
    end if;


    -- --------------------------------------------------------
    -- MÉTODO DE DEVOLUCIÓN
    -- --------------------------------------------------------

    select
        upper(btrim(pm.code)),
        pm.name,
        pm.classification
    into
        v_refund_method_code,
        v_refund_method_name,
        v_refund_method_classification
    from public.payment_methods pm
    where pm.id = p_refund_method_id
      and pm.is_active = true;


    if v_refund_method_code is null then
        raise exception
            'Active refund method not found';
    end if;


    -- --------------------------------------------------------
    -- BLOQUEAR PAGO
    -- --------------------------------------------------------

    select
        p.student_id,
        p.amount,
        p.status,
        p.received_by_staff_id
    into
        v_student_id,
        v_payment_amount,
        v_payment_status,
        v_received_by_staff_id
    from public.payments p
    where p.id = p_payment_id
    for update;


    if not found then
        raise exception 'Payment not found';
    end if;


    -- --------------------------------------------------------
    -- OWN / ALL
    -- --------------------------------------------------------

    v_actor_staff_id :=
        app_private.current_staff_id();


    if not (
        app_private.current_user_has_permission(
            'payments.reverse',
            'ALL'
        )

        or (

            app_private.current_user_has_permission(
                'payments.reverse',
                'OWN'
            )

            and v_actor_staff_id is not null
            and v_received_by_staff_id =
                v_actor_staff_id
        )
    )
    then
        raise exception
            'Insufficient permission to refund payment';
    end if;


    if v_payment_status <> 'CONFIRMED' then
        raise exception
            'Only confirmed payments can be refunded';
    end if;


    select coalesce(sum(r.amount), 0)
    into v_previous_refunds
    from public.refunds r
    where r.payment_id = p_payment_id;


    if p_amount >
       (
           v_payment_amount
           - v_previous_refunds
       )
    then
        raise exception
            'Refund exceeds remaining refundable payment amount';
    end if;


    select coalesce(
        sum(
            (value ->> 'amount')::numeric
        ),
        0
    )
    into v_component_total
    from jsonb_array_elements(
        p_components
    );


    if v_component_total <> p_amount then
        raise exception
            'Refund components total % must equal refund amount %',
            v_component_total,
            p_amount;
    end if;


    -- --------------------------------------------------------
    -- CREAR REFUND
    -- --------------------------------------------------------

    insert into public.refunds (
        payment_id,
        amount,
        reason,
        refunded_at,

        refund_method_id,
        refund_method_code_snapshot,
        refund_method_name_snapshot,
        refund_method_classification_snapshot,

        created_by,
        authorized_by
    )
    values (
        p_payment_id,
        p_amount,
        btrim(p_reason),
        p_refunded_at,

        p_refund_method_id,
        v_refund_method_code,
        v_refund_method_name,
        v_refund_method_classification,

        v_actor_profile_id,
        v_actor_profile_id
    )
    returning id
    into v_refund_id;


    -- --------------------------------------------------------
    -- COMPONENTES
    -- --------------------------------------------------------

    for v_component in
        select
            upper(
                value ->> 'source_type'
            ) as source_type,

            (
                value ->> 'source_id'
            )::uuid as source_id,

            (
                value ->> 'amount'
            )::numeric as amount

        from jsonb_array_elements(
            p_components
        )
    loop

        if v_component.amount is null
           or v_component.amount <= 0
        then
            raise exception
                'Component amount must be greater than zero';
        end if;


        if v_component.source_type =
           'PAYMENT_ALLOCATION'
        then

            select
                pa.student_id,
                pa.payment_id,
                pa.charge_id,
                pa.amount,
                pa.allocation_mode
            into
                v_source_student_id,
                v_source_payment_id,
                v_charge_id,
                v_source_amount,
                v_allocation_mode
            from public.payment_allocations pa
            where pa.id =
                  v_component.source_id
              and pa.reversed_at is null
            for update;


            if not found then
                raise exception
                    'Active payment allocation not found';
            end if;


            if v_source_student_id <>
               v_student_id
               or v_source_payment_id <>
                  p_payment_id
            then
                raise exception
                    'Payment allocation does not belong to payment';
            end if;


            if v_component.amount >
               v_source_amount
            then
                raise exception
                    'Refund component exceeds payment allocation';
            end if;


            update public.payment_allocations
            set reversed_at =
                statement_timestamp()
            where id =
                  v_component.source_id;


            v_remaining_amount :=
                v_source_amount
                - v_component.amount;


            if v_remaining_amount > 0 then

                insert into public.payment_allocations (
                    student_id,
                    payment_id,
                    charge_id,
                    amount,
                    allocation_mode,
                    created_by
                )
                values (
                    v_student_id,
                    p_payment_id,
                    v_charge_id,
                    v_remaining_amount,
                    v_allocation_mode,
                    v_actor_profile_id
                );

            end if;


            insert into public.refund_components (
                refund_id,
                payment_allocation_id,
                credit_id,
                amount
            )
            values (
                v_refund_id,
                v_component.source_id,
                null,
                v_component.amount
            );


        elsif v_component.source_type =
              'CREDIT'
        then

            select
                cr.student_id,
                cr.source_payment_id
            into
                v_source_student_id,
                v_source_payment_id
            from public.credits cr
            where cr.id =
                  v_component.source_id
              and cr.status = 'ACTIVE'
            for update;


            if not found then
                raise exception
                    'Active credit not found';
            end if;


            if v_source_student_id <>
               v_student_id
               or v_source_payment_id <>
                  p_payment_id
            then
                raise exception
                    'Credit does not belong to payment';
            end if;


            v_remaining_amount :=
                app_private.credit_available_balance(
                    v_component.source_id
                );


            if v_component.amount >
               v_remaining_amount
            then
                raise exception
                    'Refund component exceeds available credit';
            end if;


            insert into public.refund_components (
                refund_id,
                payment_allocation_id,
                credit_id,
                amount
            )
            values (
                v_refund_id,
                null,
                v_component.source_id,
                v_component.amount
            );


        else
            raise exception
                'Invalid refund source type: %',
                v_component.source_type;
        end if;

    end loop;


    -- --------------------------------------------------------
    -- AUDITORÍA
    -- --------------------------------------------------------

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
        v_actor_profile_id,
        'PAYMENT_REFUNDED',
        'refunds',
        v_refund_id,
        null,

        jsonb_build_object(
            'payment_id',
                p_payment_id,
            'student_id',
                v_student_id,
            'amount',
                p_amount,
            'refunded_at',
                p_refunded_at,
            'refund_method_id',
                p_refund_method_id,
            'refund_method_code',
                v_refund_method_code,
            'previous_refunds',
                v_previous_refunds,
            'total_refunded_after',
                v_previous_refunds
                + p_amount
        ),

        btrim(p_reason),
        v_correlation_id
    );


    return v_refund_id;
end;
$$;


revoke all
on function app_private.refund_payment_internal(
    uuid,
    numeric,
    timestamptz,
    uuid,
    text,
    jsonb
)
from public, anon;


grant execute
on function app_private.refund_payment_internal(
    uuid,
    numeric,
    timestamptz,
    uuid,
    text,
    jsonb
)
to authenticated;



-- ============================================================
-- 12. RPC PÚBLICA REFUND_PAYMENT
-- ============================================================

create function public.refund_payment(
    p_payment_id uuid,
    p_amount numeric,
    p_refunded_at timestamptz,
    p_refund_method_id uuid,
    p_reason text,
    p_components jsonb
)
returns uuid
language sql
set search_path = ''
as $$
    select app_private.refund_payment_internal(
        p_payment_id,
        p_amount,
        p_refunded_at,
        p_refund_method_id,
        p_reason,
        p_components
    );
$$;


revoke all
on function public.refund_payment(
    uuid,
    numeric,
    timestamptz,
    uuid,
    text,
    jsonb
)
from public, anon;


grant execute
on function public.refund_payment(
    uuid,
    numeric,
    timestamptz,
    uuid,
    text,
    jsonb
)
to authenticated;


-- ============================================================
-- FIN M3
-- ============================================================