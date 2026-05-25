-- Phase 82: normalize real ZIP processing manifest fields on project_files.
-- This is additive/idempotent and does not modify existing project, file, thread, message, or usage rows.

alter table public.project_files
  add column if not exists ingestion_job_id uuid references public.project_ingestion_jobs(id) on delete set null,
  add column if not exists content_sha256 text,
  add column if not exists is_text boolean not null default false,
  add column if not exists is_previewable boolean not null default false,
  add column if not exists skipped boolean not null default false,
  add column if not exists skip_reason text,
  add column if not exists indexed_at timestamptz;

create index if not exists project_files_ingestion_job_idx
  on public.project_files(ingestion_job_id);

create index if not exists project_files_project_ingestion_path_idx
  on public.project_files(project_id, ingestion_job_id, path);

alter table public.projects drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check check (
    status in (
      'pending',
      'validating',
      'uploaded',
      'processing',
      'indexing_mocked',
      'indexed_manifest',
      'completed',
      'failed',
      'rejected',
      'archived'
    )
  );

alter table public.project_ingestion_jobs drop constraint if exists project_ingestion_jobs_status_check;

alter table public.project_ingestion_jobs
  add constraint project_ingestion_jobs_status_check check (
    status in (
      'pending',
      'validating',
      'uploaded',
      'processing',
      'indexing_mocked',
      'completed',
      'failed',
      'rejected'
    )
  );
