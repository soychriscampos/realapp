alter table public.students
drop constraint if exists students_sex_check;

alter table public.students
add constraint students_sex_check
check (
  sex is null
  or sex in ('H', 'M')
);