update public.enrollment_classifications
set name = case code
    when 'OFFICIAL_SEP' then 'Oficial SEP'
    when 'CAMPUS' then 'Plantel no oficial'
    when 'VISITOR' then 'Oficial visita'
    else name
end,
updated_at = statement_timestamp()
where code in ('OFFICIAL_SEP', 'CAMPUS', 'VISITOR');