-- HealthMetrics Option C: Supabase as source of truth
-- Run this in the Supabase SQL editor for your project.

-- Entries (symptoms, medications, vitamins)
create table if not exists public.entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('symptoms', 'medication', 'vitamin')),
  timestamp timestamptz not null,
  notes text not null default '',
  values jsonb,
  medication text,
  dose text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists entries_user_timestamp_idx
  on public.entries (user_id, timestamp desc);

create index if not exists entries_user_updated_idx
  on public.entries (user_id, updated_at);

-- Medication / vitamin presets
create table if not exists public.medication_presets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  default_dose text,
  times jsonb not null default '[]'::jsonb,
  days jsonb not null default '"daily"'::jsonb,
  active boolean not null default true,
  notes text,
  kind text not null default 'medication' check (kind in ('medication', 'vitamin')),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists medication_presets_user_idx
  on public.medication_presets (user_id);

-- Metrics catalog
create table if not exists public.metrics (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  label text not null,
  color text not null,
  active boolean not null default true,
  sort_order integer not null default 99,
  scale_labels jsonb not null default '["1","2","3","4","5","6","7","8","9","10"]'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- Check-in schedules
create table if not exists public.check_ins (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  times jsonb not null default '[]'::jsonb,
  days jsonb not null default '"daily"'::jsonb,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists check_ins_user_idx
  on public.check_ins (user_id);

-- Use database time for reliable cross-device incremental sync.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
before insert or update on public.entries
for each row execute function public.set_updated_at();

drop trigger if exists medication_presets_set_updated_at on public.medication_presets;
create trigger medication_presets_set_updated_at
before insert or update on public.medication_presets
for each row execute function public.set_updated_at();

drop trigger if exists metrics_set_updated_at on public.metrics;
create trigger metrics_set_updated_at
before insert or update on public.metrics
for each row execute function public.set_updated_at();

drop trigger if exists check_ins_set_updated_at on public.check_ins;
create trigger check_ins_set_updated_at
before insert or update on public.check_ins
for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.entries enable row level security;
alter table public.medication_presets enable row level security;
alter table public.metrics enable row level security;
alter table public.check_ins enable row level security;

drop policy if exists "entries_own" on public.entries;
create policy "entries_own"
  on public.entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "medication_presets_own" on public.medication_presets;
create policy "medication_presets_own"
  on public.medication_presets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "metrics_own" on public.metrics;
create policy "metrics_own"
  on public.metrics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "check_ins_own" on public.check_ins;
create policy "check_ins_own"
  on public.check_ins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Billing / trial profiles (30-day trial, then PayFast subscription)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired', 'exempt')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  payfast_token text,
  payfast_payment_id text,
  subscription_started_at timestamptz,
  current_period_end timestamptz,
  last_payment_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before insert or update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Users can insert their own profile row if the signup trigger missed them.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, status, trial_started_at, trial_ends_at)
  values (
    new.id,
    new.email,
    'trialing',
    now(),
    now() + interval '30 days'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
