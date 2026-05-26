-- Phase 87: safe derived patch snapshots.
-- Additive only: original project_files, project_text_previews, storage objects, and project sources are not modified.

create table if not exists public.project_patch_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  patch_preview_id uuid not null references public.project_patch_previews(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'created',
  title text,
  summary text,
  source text not null default 'patch_preview_sandbox',
  verification_status text not null,
  changed_files_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint project_patch_snapshots_status_check check (status in ('created', 'blocked', 'failed')),
  constraint project_patch_snapshots_source_check check (source in ('patch_preview_sandbox')),
  constraint project_patch_snapshots_verification_status_check check (verification_status in ('verified', 'partial'))
);

create table if not exists public.project_patch_snapshot_files (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.project_patch_snapshots(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  patch_preview_id uuid not null references public.project_patch_previews(id) on delete cascade,
  file_path text not null,
  original_content_sha256 text,
  patched_content_sha256 text,
  original_preview_text text,
  patched_preview_text text,
  changed boolean not null default false,
  preview_limited boolean not null default true,
  truncated boolean not null default false,
  warnings jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_patch_snapshots_project_idx
  on public.project_patch_snapshots(project_id, created_at desc);

create index if not exists project_patch_snapshots_preview_idx
  on public.project_patch_snapshots(patch_preview_id, created_at desc);

create index if not exists project_patch_snapshots_created_by_idx
  on public.project_patch_snapshots(created_by, created_at desc);

create unique index if not exists project_patch_snapshots_unique_user_preview_idx
  on public.project_patch_snapshots(project_id, patch_preview_id, created_by);

create index if not exists project_patch_snapshot_files_snapshot_idx
  on public.project_patch_snapshot_files(snapshot_id, file_path);

create index if not exists project_patch_snapshot_files_project_idx
  on public.project_patch_snapshot_files(project_id, created_at desc);

create index if not exists project_patch_snapshot_files_preview_idx
  on public.project_patch_snapshot_files(patch_preview_id, created_at desc);

alter table public.project_patch_snapshots enable row level security;
alter table public.project_patch_snapshot_files enable row level security;

drop policy if exists "project_patch_snapshots_select_own_project" on public.project_patch_snapshots;
drop policy if exists "project_patch_snapshots_insert_own_project" on public.project_patch_snapshots;
drop policy if exists "project_patch_snapshot_files_select_own_project" on public.project_patch_snapshot_files;
drop policy if exists "project_patch_snapshot_files_insert_own_project" on public.project_patch_snapshot_files;

create policy "project_patch_snapshots_select_own_project" on public.project_patch_snapshots
  for select
  using (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = project_patch_snapshots.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "project_patch_snapshots_insert_own_project" on public.project_patch_snapshots
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = project_patch_snapshots.project_id
        and projects.user_id = auth.uid()
    )
    and exists (
      select 1 from public.project_patch_previews
      where project_patch_previews.id = project_patch_snapshots.patch_preview_id
        and project_patch_previews.project_id = project_patch_snapshots.project_id
        and project_patch_previews.created_by = auth.uid()
    )
  );

create policy "project_patch_snapshot_files_select_own_project" on public.project_patch_snapshot_files
  for select
  using (
    exists (
      select 1 from public.project_patch_snapshots
      join public.projects on projects.id = project_patch_snapshots.project_id
      where project_patch_snapshots.id = project_patch_snapshot_files.snapshot_id
        and project_patch_snapshots.project_id = project_patch_snapshot_files.project_id
        and project_patch_snapshots.created_by = auth.uid()
        and projects.user_id = auth.uid()
    )
  );

create policy "project_patch_snapshot_files_insert_own_project" on public.project_patch_snapshot_files
  for insert
  with check (
    exists (
      select 1 from public.project_patch_snapshots
      join public.projects on projects.id = project_patch_snapshots.project_id
      where project_patch_snapshots.id = project_patch_snapshot_files.snapshot_id
        and project_patch_snapshots.project_id = project_patch_snapshot_files.project_id
        and project_patch_snapshots.patch_preview_id = project_patch_snapshot_files.patch_preview_id
        and project_patch_snapshots.created_by = auth.uid()
        and projects.user_id = auth.uid()
    )
  );
