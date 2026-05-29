-- Migration: fix_project_upload_storage_and_project_files_constraint
-- Ensure storage bucket 'project-uploads' exists.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-uploads',
  'project-uploads',
  false,
  52428800,
  array[
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove duplicate project_files rows keeping the lowest id (oldest) row.
delete from public.project_files a
where a.id not in (
  select min(id)
  from public.project_files
  group by project_id, path
);

-- Safely add unique constraint to project_files table on (project_id, path) if it doesn't already exist.
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'project_files'
      and constraint_name = 'project_files_project_path_unique'
  ) then
    alter table public.project_files
      add constraint project_files_project_path_unique unique (project_id, path);
  end if;
end;
$$;
