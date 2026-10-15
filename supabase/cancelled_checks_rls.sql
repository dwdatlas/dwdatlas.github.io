alter table public.cancelled_checks enable row level security;

drop policy if exists "Allow all" on public.cancelled_checks;
create policy "Allow all" on public.cancelled_checks
  for all
  using (true)
  with check (true);
