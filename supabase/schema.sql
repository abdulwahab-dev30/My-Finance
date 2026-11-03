-- My Finance: user-owned personal finance data model.
-- Apply this in a fresh Supabase project. All amounts use numeric, never float.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'PKR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('nayapay','easypaisa','manual')),
  display_name text not null,
  currency text not null default 'PKR',
  connection_status text not null default 'pending' check (connection_status in ('pending','connected','disconnected','error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid references public.wallet_accounts(id) on delete set null,
  provider_transaction_id text,
  title text not null,
  description text,
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null default 'PKR',
  direction text not null check (direction in ('incoming','outgoing')),
  category_id uuid references public.categories(id) on delete set null,
  occurred_at timestamptz not null,
  source text not null default 'manual' check (source in ('provider_api','statement_import','manual')),
  transfer_group_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists transactions_provider_dedupe
  on public.transactions(user_id, wallet_id, provider_transaction_id)
  where provider_transaction_id is not null;

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  amount numeric(18,2) not null check (amount > 0),
  period text not null default 'monthly' check (period in ('weekly','monthly')),
  starts_on date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid references public.wallet_accounts(id) on delete set null,
  status text not null check (status in ('success','failed','pending')),
  message text,
  transactions_imported integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.wallet_accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.sync_logs enable row level security;

create policy "profile owner access" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "wallet owner access" on public.wallet_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "category owner access" on public.categories for all using (user_id is null or auth.uid() = user_id) with check (user_id is null or auth.uid() = user_id);
create policy "transaction owner access" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "budget owner access" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sync log owner read" on public.sync_logs for select using (auth.uid() = user_id);
create policy "sync log owner insert" on public.sync_logs for insert with check (auth.uid() = user_id);

create index if not exists transactions_user_date_idx on public.transactions(user_id, occurred_at desc);
create index if not exists wallets_user_idx on public.wallet_accounts(user_id);
create index if not exists budgets_user_idx on public.budgets(user_id, starts_on);