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
      'failed'
    )
  );
