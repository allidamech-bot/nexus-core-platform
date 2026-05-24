-- Phase 77: ensure archived projects do not consume max_projects quota.
-- This is additive/idempotent and does not modify project rows, files, threads, or messages.

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

create or replace function public.is_within_usage_limit(
  check_user_id uuid,
  limit_key text,
  increment bigint default 1
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  limit_value bigint;
  current_value bigint := 0;
begin
  limit_value := public.get_plan_limit(check_user_id, limit_key);
  if limit_value is null then
    return true;
  end if;

  if limit_key = 'max_projects' then
    current_value := public.get_usage_total(check_user_id, 'projects');
  elsif limit_key = 'max_active_threads' then
    current_value := public.get_usage_total(check_user_id, 'active_threads');
  elsif limit_key = 'max_text_preview_files' then
    current_value := public.get_usage_total(check_user_id, 'indexed_preview_files');
  elsif limit_key = 'max_indexed_preview_bytes' then
    current_value := public.get_usage_total(check_user_id, 'indexed_preview_bytes');
  elsif limit_key = 'max_uploads_monthly' then
    current_value := public.get_usage_total(check_user_id, 'project_upload_completed');
  elsif limit_key = 'max_ai_requests_monthly' then
    current_value := public.get_usage_total(check_user_id, 'ai_request');
  else
    current_value := 0;
  end if;

  return current_value + greatest(increment, 0) <= limit_value;
end;
$$;

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
for insert with check (
  auth.uid() = user_id
  and public.is_within_usage_limit(auth.uid(), 'max_projects', 1)
);
