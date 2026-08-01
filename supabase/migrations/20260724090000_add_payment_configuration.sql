create table if not exists public.payment_configuration (
  id boolean primary key default true check (id),
  instructions text not null default '',
  is_test_mode boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.payment_configuration enable row level security;

create policy "payment configuration is readable"
on public.payment_configuration
for select
to anon, authenticated
using (true);

create policy "admins update payment configuration"
on public.payment_configuration
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

insert into public.payment_configuration (id, instructions, is_test_mode)
values (
  true,
  'ТУРШИЛТЫН ТӨЛБӨР — БОДИТ ШИЛЖҮҮЛЭГ БҮҮ ХИЙНЭ ҮҮ.\n\nБанк: Demo Bank\nДанс эзэмшигч: Mind Academy Test\nДансны дугаар: 0000 0000 0000 0000\nГүйлгээний утга: TEST',
  true
)
on conflict (id) do nothing;
