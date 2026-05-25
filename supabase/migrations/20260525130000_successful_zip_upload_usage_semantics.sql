-- Phase 81: count max_uploads_monthly as successful real ZIP uploads only.
-- This is idempotent and does not modify projects, files, threads, messages, or usage rows.

create or replace function public.get_usage_total(
  check_user_id uuid,
  metric_name text,
  since_at timestamptz default date_trunc('month', now())
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  total bigint;
begin
  if metric_name = 'projects' then
    select count(*) into total
    from public.projects
    where user_id = check_user_id
      and coalesce(status, 'pending') <> 'archived';
  elsif metric_name = 'active_threads' then
    select count(*) into total
    from public.threads
    where user_id = check_user_id
      and coalesce(status, 'active') = 'active'
      and archived_at is null;
  elsif metric_name = 'indexed_preview_files' then
    select count(*) into total
    from public.project_text_previews
    where user_id = check_user_id;
  elsif metric_name = 'indexed_preview_bytes' then
    select coalesce(sum(length(preview_text)), 0) into total
    from public.project_text_previews
    where user_id = check_user_id;
  elsif metric_name = 'security_events' then
    select count(*) into total
    from public.project_security_events
    where user_id = check_user_id
      and created_at >= since_at;
  elsif metric_name = 'project_upload_completed' then
    select coalesce(sum(quantity), 0) into total
    from public.usage_events
    where user_id = check_user_id
      and event_type = 'project_upload_completed'
      and created_at >= since_at
      and coalesce(metadata->>'source_type', 'zip') = 'zip'
      and metadata->>'storage_available' = 'true'
      and coalesce(metadata->>'status', 'indexed_manifest') in ('indexed_manifest', 'completed');
  else
    select coalesce(sum(quantity), 0) into total
    from public.usage_events
    where user_id = check_user_id
      and event_type = metric_name
      and created_at >= since_at;
  end if;

  return coalesce(total, 0);
end;
$$;
