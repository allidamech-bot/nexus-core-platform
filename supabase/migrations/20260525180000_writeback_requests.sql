-- Phase 89: governed source writeback request foundation.
-- Additive only: no source writeback, no storage writeback, and no mutation of original project files or text previews.

create table if not exists public.project_writeback_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  patch_preview_id uuid not null references public.project_patch_previews(id) on delete cascade,
  snapshot_id uuid not null references public.project_patch_snapshots(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft',
  title text,
  requester_note text,
  reviewer_note text,
  risk_level text not null default 'medium',
  changed_files_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  snapshot_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  constraint project_writeback_requests_status_check check (
    status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled', 'blocked')
  ),
  constraint project_writeback_requests_risk_level_check check (
    risk_level in ('low', 'medium', 'high', 'blocked')
  )
);

create index if not exists project_writeback_requests_project_idx
  on public.project_writeback_requests(project_id, created_at desc);

create index if not exists project_writeback_requests_preview_idx
  on public.project_writeback_requests(patch_preview_id, created_at desc);

create index if not exists project_writeback_requests_snapshot_idx
  on public.project_writeback_requests(snapshot_id, created_at desc);

create index if not exists project_writeback_requests_requested_by_idx
  on public.project_writeback_requests(requested_by, created_at desc);

create index if not exists project_writeback_requests_status_idx
  on public.project_writeback_requests(status, created_at desc);

create unique index if not exists project_writeback_requests_unique_open_snapshot_idx
  on public.project_writeback_requests(project_id, snapshot_id, requested_by)
  where status in ('draft', 'submitted');

alter table public.project_writeback_requests enable row level security;

drop policy if exists "project_writeback_requests_select_own_project" on public.project_writeback_requests;
drop policy if exists "project_writeback_requests_insert_own_project" on public.project_writeback_requests;
drop policy if exists "project_writeback_requests_update_own_open_request" on public.project_writeback_requests;

create policy "project_writeback_requests_select_own_project" on public.project_writeback_requests
  for select
  using (
    requested_by = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = project_writeback_requests.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "project_writeback_requests_insert_own_project" on public.project_writeback_requests
  for insert
  with check (
    requested_by = auth.uid()
    and reviewer_id is null
    and status in ('draft', 'blocked')
    and exists (
      select 1 from public.projects
      where projects.id = project_writeback_requests.project_id
        and projects.user_id = auth.uid()
    )
    and exists (
      select 1 from public.project_patch_snapshots
      where project_patch_snapshots.id = project_writeback_requests.snapshot_id
        and project_patch_snapshots.project_id = project_writeback_requests.project_id
        and project_patch_snapshots.patch_preview_id = project_writeback_requests.patch_preview_id
        and project_patch_snapshots.created_by = auth.uid()
    )
  );

create policy "project_writeback_requests_update_own_open_request" on public.project_writeback_requests
  for update
  using (
    requested_by = auth.uid()
    and status in ('draft', 'submitted')
    and exists (
      select 1 from public.projects
      where projects.id = project_writeback_requests.project_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    requested_by = auth.uid()
    and status in ('submitted', 'cancelled')
    and reviewer_id is null
    and reviewed_at is null
    and exists (
      select 1 from public.projects
      where projects.id = project_writeback_requests.project_id
        and projects.user_id = auth.uid()
    )
  );
