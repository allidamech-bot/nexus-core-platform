create table if not exists public.user_github_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null,
  account_login text not null,
  account_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_github_installations_user_unique unique (user_id, installation_id)
);

create index if not exists user_github_installations_user_idx on public.user_github_installations(user_id);
create index if not exists user_github_installations_installation_idx on public.user_github_installations(installation_id);

alter table public.projects 
add column if not exists github_repo_full_name text,
add column if not exists github_installation_id text;

alter table public.user_github_installations enable row level security;

drop policy if exists "user_github_installations_select_own" on public.user_github_installations;
drop policy if exists "user_github_installations_insert_own" on public.user_github_installations;
drop policy if exists "user_github_installations_delete_own" on public.user_github_installations;

create policy "user_github_installations_select_own" on public.user_github_installations
for select using (auth.uid() = user_id);

create policy "user_github_installations_insert_own" on public.user_github_installations
for insert with check (auth.uid() = user_id);

create policy "user_github_installations_delete_own" on public.user_github_installations
for delete using (auth.uid() = user_id);
