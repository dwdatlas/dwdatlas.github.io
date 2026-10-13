create table if not exists public.bookkeepers (
  id text primary key,
  name text not null,
  designation text not null,
  sort_order integer default 1,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.schools
  add column if not exists bookkeeper_id text
  references public.bookkeepers(id) on delete set null;

alter table public.bookkeepers enable row level security;

drop policy if exists "Allow all" on public.bookkeepers;
create policy "Allow all" on public.bookkeepers
  for all using (true) with check (true);

insert into public.bookkeepers (id, name, designation, sort_order, active)
values ('bookkeeper_1', 'JO ANN MARIE P. CAGARA', 'ADAS III (Senior Bookkeeper)', 1, true)
on conflict (id) do nothing;
