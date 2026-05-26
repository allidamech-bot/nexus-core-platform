-- Phase 91: approved writeback execution to a versioned working copy.
-- Additive only: no source ZIP overwrite, no object storage writes, and no mutation of
-- project_files or project_text_previews.

create table if not exists public.project_working_copies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  writeback_request_id uuid not null references public.project_writeback_requests(id) on delete cascade,
  patch_preview_id uuid not null references public.project_patch_previews(id) on delete cascade,
  patch_snapshot_id uuid not null references public.project_patch_snapshots(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  executed_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'created',
  title text,
  summary text,
  source text not null default 'approved_writeback_request',
  changed_files_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint project_working_copies_status_check check (status in ('created', 'failed', 'blocked')),
  constraint project_working_copies_source_check check (source in ('approved_writeback_request'))
);

create table if not exists public.project_working_copy_files (
  id uuid primary key default gen_random_uuid(),
  working_copy_id uuid not null references public.project_working_copies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  writeback_request_id uuid not null references public.project_writeback_requests(id) on delete cascade,
  patch_snapshot_id uuid not null references public.project_patch_snapshots(id) on delete cascade,
  file_path text not null,
  content_sha256 text,
  content_text text not null default '',
  size_bytes integer not null default 0,
  changed boolean not null default true,
  preview_limited boolean not null default true,
  truncated boolean not null default false,
  warnings jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists project_working_copies_unique_request_idx
  on public.project_working_copies(project_id, writeback_request_id);

create index if not exists project_working_copies_project_idx
  on public.project_working_copies(project_id, created_at desc);

create index if not exists project_working_copies_request_idx
  on public.project_working_copies(writeback_request_id, created_at desc);

create index if not exists project_working_copies_snapshot_idx
  on public.project_working_copies(patch_snapshot_id, created_at desc);

create index if not exists project_working_copy_files_working_copy_idx
  on public.project_working_copy_files(working_copy_id, file_path);

create index if not exists project_working_copy_files_project_idx
  on public.project_working_copy_files(project_id, created_at desc);

create index if not exists project_working_copy_files_request_idx
  on public.project_working_copy_files(writeback_request_id, created_at desc);

create index if not exists project_working_copy_files_snapshot_idx
  on public.project_working_copy_files(patch_snapshot_id, created_at desc);

alter table public.project_working_copies enable row level security;
alter table public.project_working_copy_files enable row level security;

drop policy if exists "project_working_copies_select_own_or_admin" on public.project_working_copies;
drop policy if exists "project_working_copies_insert_approved_own_or_admin" on public.project_working_copies;
drop policy if exists "project_working_copy_files_select_own_or_admin" on public.project_working_copy_files;
drop policy if exists "project_working_copy_files_insert_own_working_copy" on public.project_working_copy_files;

create policy "project_working_copies_select_own_or_admin" on public.project_working_copies
  for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.projects
      where projects.id = project_working_copies.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "project_working_copies_insert_approved_own_or_admin" on public.project_working_copies
  for insert
  with check (
    executed_by = auth.uid()
    and status in ('created', 'blocked', 'failed')
    and exists (
      select 1 from public.project_writeback_requests
      join public.projects on projects.id = project_writeback_requests.project_id
      where project_writeback_requests.id = project_working_copies.writeback_request_id
        and project_writeback_requests.project_id = project_working_copies.project_id
        and project_writeback_requests.patch_preview_id = project_working_copies.patch_preview_id
        and project_writeback_requests.snapshot_id = project_working_copies.patch_snapshot_id
        and project_writeback_requests.status = 'approved'
        and (
          public.is_admin()
          or (
            projects.user_id = auth.uid()
            and project_writeback_requests.requested_by = auth.uid()
          )
        )
    )
  );

create policy "project_working_copy_files_select_own_or_admin" on public.project_working_copy_files
  for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.project_working_copies
      join public.projects on projects.id = project_working_copies.project_id
      where project_working_copies.id = project_working_copy_files.working_copy_id
        and project_working_copies.project_id = project_working_copy_files.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "project_working_copy_files_insert_own_working_copy" on public.project_working_copy_files
  for insert
  with check (
    exists (
      select 1 from public.project_working_copies
      where project_working_copies.id = project_working_copy_files.working_copy_id
        and project_working_copies.project_id = project_working_copy_files.project_id
        and project_working_copies.writeback_request_id = project_working_copy_files.writeback_request_id
        and project_working_copies.patch_snapshot_id = project_working_copy_files.patch_snapshot_id
        and project_working_copies.executed_by = auth.uid()
    )
  );
