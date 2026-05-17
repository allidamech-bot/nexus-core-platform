
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Session',
  mode text not null default 'engineering',
  project_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index threads_user_idx on public.threads(user_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages(thread_id, created_at asc);

alter table public.threads enable row level security;
alter table public.messages enable row level security;

create policy "threads_select_own" on public.threads for select using (auth.uid() = user_id);
create policy "threads_insert_own" on public.threads for insert with check (auth.uid() = user_id);
create policy "threads_update_own" on public.threads for update using (auth.uid() = user_id);
create policy "threads_delete_own" on public.threads for delete using (auth.uid() = user_id);

create policy "messages_select_own" on public.messages for select using (auth.uid() = user_id);
create policy "messages_insert_own" on public.messages for insert with check (auth.uid() = user_id);
create policy "messages_delete_own" on public.messages for delete using (auth.uid() = user_id);
