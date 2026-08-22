do $$
declare
    v_oid oid;
    v_definition text;
begin
    select p.oid
    into v_oid
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname = 'initialize_enrollment_financials_internal'
      and pg_get_function_identity_arguments(p.oid) =
          'p_enrollment_id uuid, p_effective_on date, p_economic_start_on date, p_initial_period_amount numeric, p_initial_period_due_date date, p_reason text';

    if v_oid is null then
        raise exception 'initialize_enrollment_financials_internal not found';
    end if;

    v_definition := pg_get_functiondef(v_oid);

    if position('min(fp.id)' in v_definition) = 0 then
        raise exception 'Expected min(fp.id) expression not found';
    end if;

    v_definition :=
        replace(
            v_definition,
            'min(fp.id)',
            'min(fp.id::text)::uuid'
        );

    execute v_definition;
end;
$$;