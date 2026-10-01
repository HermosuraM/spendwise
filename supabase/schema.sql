-- SpendWise schema for Supabase (run in the SQL editor). Row-level security scopes every row to its owner,
-- so the browser can talk to the database directly with the public anon key.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  type text not null check (type in ('expense', 'income')),
  color_slot smallint check (color_slot between 0 and 7),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  description text not null check (char_length(description) between 1 and 200),
  amount_cents bigint not null check (amount_cents > 0),
  type text not null check (type in ('expense', 'income')),
  category_id uuid references public.categories on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date on public.transactions (user_id, date desc);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  category_id uuid not null references public.categories on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  limit_cents bigint not null check (limit_cents > 0),
  unique (user_id, category_id, month)
);

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

create policy "own categories" on public.categories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on public.transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own budgets" on public.budgets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
