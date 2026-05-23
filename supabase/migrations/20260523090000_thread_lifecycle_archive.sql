alter table public.threads
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.threads
  drop constraint if exists threads_status_check,
  add constraint threads_status_check check (status in ('active', 'archived'));

alter table public.threads
  drop constraint if exists threads_archive_state_check,
  add constraint threads_archive_state_check check (
    (status = 'active' and archived_at is null and archived_by is null)
    or
    (status = 'archived' and archived_at is not null and archived_by is not null)
  );

create index if not exists threads_user_status_updated_idx
  on public.threads(user_id, status, updated_at desc);

create index if not exists threads_archived_at_idx
  on public.threads(archived_at desc)
  where archived_at is not null;

create or replace function public.prevent_thread_unarchive()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'archived' then
    raise exception 'archived_threads_are_read_only';
  end if;

  return new;
end;
$$;

drop trigger if exists threads_prevent_unarchive on public.threads;
create trigger threads_prevent_unarchive
before update on public.threads
for each row
execute function public.prevent_thread_unarchive();

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
      and status <> 'archived';
  elsif metric_name = 'active_threads' then
    select count(*) into total
    from public.threads
    where user_id = check_user_id
      and status = 'active'
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

drop policy if exists "threads_update_own" on public.threads;
create policy "threads_update_own" on public.threads
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (archived_by is null or archived_by = auth.uid())
  and (
    project_id is null
    or exists (
      select 1 from public.projects
      where projects.id = threads.project_id
        and projects.user_id = auth.uid()
    )
  )
);
