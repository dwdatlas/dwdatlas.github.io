-- Dulag West District MOOE Dashboard — Supabase Schema
-- Run this in your Supabase project → SQL Editor

-- Schools / Accountable Officers
create table if not exists schools (
  id text primary key,
  name text not null,
  short_name text,
  school_code text,
  school_head text,
  designation text,
  confirmation_expiry date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MOOE Disbursements (ADA tracking)
create table if not exists disbursements (
  id text primary key,
  school_id text references schools(id) on delete cascade,
  ada_no text,
  ada_date date,
  fund_type text,
  amount numeric(14,2) default 0,
  status text default 'pending',
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CDR Headers (one per school per quarter)
create table if not exists cdr_headers (
  id text primary key,
  school_id text references schools(id) on delete cascade,
  year integer,
  quarter text,
  fund_type text,
  opening_balance numeric(14,2) default 0,
  entry_count integer default 0,
  created_at timestamptz default now()
);

-- CDR Entries (line items)
create table if not exists cdr_entries (
  id text primary key,
  cdr_id text references cdr_headers(id) on delete cascade,
  entry_date date,
  particulars text,
  uacs_code text,
  uacs_desc text,
  advances numeric(14,2) default 0,
  payment numeric(14,2) default 0,
  ref_no text,
  payee text,
  sort_order bigint,
  created_at timestamptz default now()
);

-- Resources (COA Circulars, DepEd Orders, PDFs, Links)
create table if not exists resources (
  id text primary key,
  title text not null,
  category text,
  url text,
  file_path text,
  description text,
  created_at timestamptz default now()
);

-- Row Level Security
alter table schools enable row level security;
alter table disbursements enable row level security;
alter table cdr_headers enable row level security;
alter table cdr_entries enable row level security;
alter table resources enable row level security;

create policy "Allow all" on schools for all using (true) with check (true);
create policy "Allow all" on disbursements for all using (true) with check (true);
create policy "Allow all" on cdr_headers for all using (true) with check (true);
create policy "Allow all" on cdr_entries for all using (true) with check (true);
create policy "Allow all" on resources for all using (true) with check (true);
