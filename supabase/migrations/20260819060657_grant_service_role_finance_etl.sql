grant select
on public.financial_concepts,
   public.school_cycles
to service_role;

grant select, insert, update
on public.student_financial_agreements,
   public.charges,
   public.payments,
   public.payment_allocations
to service_role;