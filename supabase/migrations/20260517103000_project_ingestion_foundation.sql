create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  source_type text not null default 'zip',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_source_type_check check (source_type in ('zip', 'github', 'local', 'manual')),
  constraint projects_status_check check (status in ('pending', 'validating', 'uploaded', 'indexing_mocked', 'completed', 'failed', 'archived'))
);

create index if not exists projects_user_updated_idx on public.projects(user_id, updated_at desc);

create table if not exists public.project_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  stage text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_ingestion_jobs_status_check check (status in ('pending', 'validating', 'uploaded', 'indexing_mocked', 'completed', 'failed'))
);

create index if not exists project_ingestion_jobs_project_created_idx on public.project_ingestion_jobs(project_id, created_at desc);
create index if not exists project_ingestion_jobs_user_created_idx on public.project_ingestion_jobs(user_id, created_at desc);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  name text not null,
  extension text,
  size_bytes bigint,
  mime_type text,
  checksum text,
  created_at timestamptz not null default now(),
  constraint project_files_project_path_unique unique (project_id, path)
);

create index if not exists project_files_project_path_idx on public.project_files(project_id, path);
create index if not exists project_files_user_created_idx on public.project_files(user_id, created_at desc);

create table if not exists public.project_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  event_type text not null,
  severity text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint project_security_events_severity_check check (severity in ('info', 'warning', 'critical'))
);

create index if not exists project_security_events_user_created_idx on public.project_security_events(user_id, created_at desc);
create index if not exists project_security_events_project_created_idx on public.project_security_events(project_id, created_at desc);

alter table public.projects enable row level security;
alter table public.project_ingestion_jobs enable row level security;
alter table public.project_files enable row level security;
alter table public.project_security_events enable row level security;

drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "projects_select_own" on public.projects
for select using (auth.uid() = user_id);

create policy "projects_insert_own" on public.projects
for insert with check (auth.uid() = user_id);

create policy "projects_update_own" on public.projects
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "projects_delete_own" on public.projects
for delete using (auth.uid() = user_id);

drop policy if exists "project_ingestion_jobs_select_own_project" on public.project_ingestion_jobs;
drop policy if exists "project_ingestion_jobs_insert_own_project" on public.project_ingestion_jobs;
drop policy if exists "project_ingestion_jobs_update_own_project" on public.project_ingestion_jobs;
drop policy if exists "project_ingestion_jobs_delete_own_project" on public.project_ingestion_jobs;

create policy "project_ingestion_jobs_select_own_project" on public.project_ingestion_jobs
for select using (
  exists (
    select 1 from public.projects
    where projects.id = project_ingestion_jobs.project_id
      and projects.user_id = auth.uid()
  )
);

create policy "project_ingestion_jobs_insert_own_project" on public.project_ingestion_jobs
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.projects
    where projects.id = project_ingestion_jobs.project_id
      and projects.user_id = auth.uid()
  )
);

create policy "project_ingestion_jobs_update_own_project" on public.project_ingestion_jobs
for update using (
  exists (
    select 1 from public.projects
    where projects.id = project_ingestion_jobs.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.projects
    where projects.id = project_ingestion_jobs.project_id
      and projects.user_id = auth.uid()
  )
);

create policy "project_ingestion_jobs_delete_own_project" on public.project_ingestion_jobs
for delete using (
  exists (
    select 1 from public.projects
    where projects.id = project_ingestion_jobs.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "project_files_select_own_project" on public.project_files;
drop policy if exists "project_files_insert_own_project" on public.project_files;
drop policy if exists "project_files_update_own_project" on public.project_files;
drop policy if exists "project_files_delete_own_project" on public.project_files;

create policy "project_files_select_own_project" on public.project_files
for select using (
  exists (
    select 1 from public.projects
    where projects.id = project_files.project_id
      and projects.user_id = auth.uid()
  )
);

create policy "project_files_insert_own_project" on public.project_files
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.projects
    where projects.id = project_files.project_id
      and projects.user_id = auth.uid()
  )
);

create policy "project_files_update_own_project" on public.project_files
for update using (
  exists (
    select 1 from public.projects
    where projects.id = project_files.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.projects
    where projects.id = project_files.project_id
      and projects.user_id = auth.uid()
  )
);

create policy "project_files_delete_own_project" on public.project_files
for delete using (
  exists (
    select 1 from public.projects
    where projects.id = project_files.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "project_security_events_select_own" on public.project_security_events;
drop policy if exists "project_security_events_insert_own" on public.project_security_events;
drop policy if exists "project_security_events_update_own" on public.project_security_events;
drop policy if exists "project_security_events_delete_own" on public.project_security_events;

create policy "project_security_events_select_own" on public.project_security_events
for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.projects
    where projects.id = project_security_events.project_id
      and projects.user_id = auth.uid()
  )
);

create policy "project_security_events_insert_own" on public.project_security_events
for insert with check (
  auth.uid() = user_id
  and (
    project_id is null
    or exists (
      select 1 from public.projects
      where projects.id = project_security_events.project_id
        and projects.user_id = auth.uid()
    )
  )
);

create policy "project_security_events_update_own" on public.project_security_events
for update using (
  auth.uid() = user_id
  or exists (
    select 1 from public.projects
    where projects.id = project_security_events.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and (
    project_id is null
    or exists (
      select 1 from public.projects
      where projects.id = project_security_events.project_id
        and projects.user_id = auth.uid()
    )
  )
);

create policy "project_security_events_delete_own" on public.project_security_events
for delete using (
  auth.uid() = user_id
  or exists (
    select 1 from public.projects
    where projects.id = project_security_events.project_id
      and projects.user_id = auth.uid()
  )
);
