-- RC stabilization: folder/local imports are not successful ZIP uploads.
-- Keep ZIP ingestion jobs behind max_uploads_monthly, but allow local folder
-- manifest-only jobs when the authenticated user owns the target project.
-- Project quota remains enforced by the projects INSERT policy.

drop policy if exists "project_ingestion_jobs_insert_own_project" on public.project_ingestion_jobs;

create policy "project_ingestion_jobs_insert_own_project" on public.project_ingestion_jobs
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.projects
    where projects.id = project_ingestion_jobs.project_id
      and projects.user_id = auth.uid()
      and (
        public.is_within_usage_limit(auth.uid(), 'max_uploads_monthly', 1)
        or (
          projects.source_type = 'local'
          and coalesce(project_ingestion_jobs.metadata->>'source_type', '') in ('folder', 'local')
          and coalesce(project_ingestion_jobs.metadata->>'extraction', '') = 'client_folder_manifest_only'
        )
      )
  )
);
