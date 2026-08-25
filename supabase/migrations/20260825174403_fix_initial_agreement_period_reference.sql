do $$
declare
    v_signature regprocedure :=
        'app_private.initialize_enrollment_financials_internal(uuid,date,date,numeric,date,text)'::regprocedure;

    v_original text;
    v_step1 text;
    v_patched text;
begin

    select pg_get_functiondef(v_signature)
    into v_original;

    v_step1 :=
        regexp_replace(
            v_original,
            'sfa\.valid_from\s*<=\s*v_period\.due_date',
            'sfa.valid_from <= greatest(v_month_start, p_economic_start_on)',
            'g'
        );

    if v_step1 = v_original then
        raise exception
            'Could not find TUITION agreement valid_from comparison';
    end if;

    v_patched :=
        regexp_replace(
            v_step1,
            'sfa\.valid_until\s*>=\s*v_period\.due_date',
            'sfa.valid_until >= greatest(v_month_start, p_economic_start_on)',
            'g'
        );

    if v_patched = v_step1 then
        raise exception
            'Could not find TUITION agreement valid_until comparison';
    end if;

    execute v_patched;

end;
$$;