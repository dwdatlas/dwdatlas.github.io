create table if not exists public.fund_types (
  id text primary key,
  name text not null,
  category text not null check (category in ('mooe', 'special')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists fund_types_name_category_key
  on public.fund_types (lower(name), category);

alter table public.fund_types enable row level security;

drop policy if exists "Allow all" on public.fund_types;
create policy "Allow all" on public.fund_types
  for all using (true) with check (true);

insert into public.fund_types (id, name, category) values
  ('ft_mooe_q1',    '1st Quarter MOOE', 'mooe'),
  ('ft_mooe_q2',    '2nd Quarter MOOE', 'mooe'),
  ('ft_mooe_q3',    '3rd Quarter MOOE', 'mooe'),
  ('ft_mooe_q4',    '4th Quarter MOOE', 'mooe'),
  ('ft_mooe_add',   'Additional MOOE', 'mooe'),
  ('ft_sf_water',   'LBP Water Testing', 'special'),
  ('ft_sf_dbpnut',  'DBP-Nutribun', 'special'),
  ('ft_sf_lbpnut',  'LBP-Nutribun', 'special'),
  ('ft_sf_dbpmilk', 'DBP-SBFP Milk', 'special'),
  ('ft_sf_dbpnlc',  'DBP-SBFP NLC', 'special'),
  ('ft_sf_lbpnlc',  'LBP-SBFP NLC', 'special'),
  ('ft_sf_lbpmilk', 'LBP-SBFP Milk', 'special'),
  ('ft_sf_dbparal', 'DBP-ARAL Program', 'special'),
  ('ft_sf_lbppsf',  'LBP-Special Needs Support PSF', 'special'),
  ('ft_sf_lbparal', 'LBP ARAL Program', 'special'),
  ('ft_sf_dbphaul', 'DBP-Hauling of Textbooks', 'special'),
  ('ft_sf_lbphaul', 'LBP-Hauling of Text', 'special'),
  ('ft_sf_lbpell',  'LBP-ELLNA', 'special'),
  ('ft_sf_dbpell',  'DBP-ELLNA', 'special'),
  ('ft_sf_lbplr',   'LBP-Delivery Support Fund for LRs', 'special'),
  ('ft_sf_lbplvl',  'LBP-Delivery Support Fund (Leveled Reader Mini Book)', 'special'),
  ('ft_sf_lbpemg',  'LBP-Delivery Support Fund (Emergency Situation)', 'special'),
  ('ft_sf_milkop',  'LBP-SBFP Milk Operational Expenses', 'special')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  updated_at = now();
