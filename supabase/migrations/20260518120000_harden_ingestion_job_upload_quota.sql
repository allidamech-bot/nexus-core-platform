drop policy if exists "project_ingestion_jobs_insert_own_project" on public.project_ingestion_jobs;

create policy "project_ingestion_jobs_insert_own_project" on public.project_ingestion_jobs
for insert with check (
  auth.uid() = user_id
  and public.is_within_usage_limit(auth.uid(), 'max_uploads_monthly', 1)
  and exists (
    select 1 from public.projects
    where projects.id = project_ingestion_jobs.project_id
      and projects.user_id = auth.uid()
  )
);
