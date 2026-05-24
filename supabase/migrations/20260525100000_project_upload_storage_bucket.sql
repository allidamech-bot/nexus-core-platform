-- Phase 79: create the private ZIP upload bucket and ownership-safe storage policies.
-- This does not modify user projects, files, threads, messages, or quotas.

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

drop policy if exists "project_uploads_insert_own_prefix" on storage.objects;
create policy "project_uploads_insert_own_prefix" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'project-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "project_uploads_select_own_prefix" on storage.objects;
create policy "project_uploads_select_own_prefix" on storage.objects
for select to authenticated
using (
  bucket_id = 'project-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "project_uploads_update_own_prefix" on storage.objects;
create policy "project_uploads_update_own_prefix" on storage.objects
for update to authenticated
using (
  bucket_id = 'project-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'project-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "project_uploads_delete_own_prefix" on storage.objects;
create policy "project_uploads_delete_own_prefix" on storage.objects
for delete to authenticated
using (
  bucket_id = 'project-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);
