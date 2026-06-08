create table if not exists public.sandbox_execution_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  patch_preview_id uuid not null references public.project_patch_previews(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued',
  stdout text,
  stderr text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sandbox_execution_jobs_status_check check (status in ('queued', 'processing', 'completed', 'failed'))
);

create index if not exists sandbox_execution_jobs_project_idx on public.sandbox_execution_jobs(project_id, created_at desc);
create index if not exists sandbox_execution_jobs_preview_idx on public.sandbox_execution_jobs(patch_preview_id, created_at desc);

alter table public.sandbox_execution_jobs enable row level security;

create policy "sandbox_execution_jobs_select_own_project" on public.sandbox_execution_jobs
  for select
  using (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = sandbox_execution_jobs.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "sandbox_execution_jobs_insert_own_project" on public.sandbox_execution_jobs
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = sandbox_execution_jobs.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "sandbox_execution_jobs_update_own_project" on public.sandbox_execution_jobs
  for update
  using (
    created_by = auth.uid()
  );
