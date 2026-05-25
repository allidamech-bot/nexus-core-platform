-- Phase 84: read-only grounded patch preview proposals.
-- Additive only: no project files, previews, uploads, threads, messages, or usage rows are modified.

create table if not exists public.project_patch_previews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  ingestion_job_id uuid references public.project_ingestion_jobs(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text,
  status text not null default 'draft',
  source text not null default 'manual_foundation',
  summary text,
  grounded_files jsonb not null default '[]'::jsonb,
  diff jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_patch_previews_status_check check (status in ('draft', 'ready', 'rejected', 'failed')),
  constraint project_patch_previews_source_check check (source in ('manual_foundation', 'ai_foundation'))
);

create index if not exists project_patch_previews_project_idx
  on public.project_patch_previews(project_id, created_at desc);

create index if not exists project_patch_previews_created_by_idx
  on public.project_patch_previews(created_by, created_at desc);

create index if not exists project_patch_previews_status_idx
  on public.project_patch_previews(status, created_at desc);

alter table public.project_patch_previews enable row level security;

drop policy if exists "project_patch_previews_select_own_project" on public.project_patch_previews;
drop policy if exists "project_patch_previews_insert_own_project" on public.project_patch_previews;
drop policy if exists "project_patch_previews_update_own_project" on public.project_patch_previews;

create policy "project_patch_previews_select_own_project" on public.project_patch_previews
  for select
  using (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = project_patch_previews.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "project_patch_previews_insert_own_project" on public.project_patch_previews
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = project_patch_previews.project_id
        and projects.user_id = auth.uid()
    )
  );
