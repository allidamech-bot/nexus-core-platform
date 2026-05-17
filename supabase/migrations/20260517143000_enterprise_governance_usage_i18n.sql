alter table public.plan_usage_limits
  add column if not exists max_uploads_monthly integer,
  add column if not exists max_ai_requests_monthly integer,
  add column if not exists max_active_threads integer,
  add column if not exists max_context_previews integer,
  add column if not exists max_context_payload_bytes integer,
  add column if not exists max_indexed_preview_bytes integer;

update public.plan_usage_limits
set
  max_projects = case plan_id when 'starter' then 1 when 'pro' then 20 when 'business' then 100 else null end,
  max_upload_mb = case plan_id when 'starter' then 25 when 'pro' then 50 when 'business' then 100 else 250 end,
  max_text_preview_files = case plan_id when 'starter' then 12 when 'pro' then 48 when 'business' then 96 else 200 end,
  max_chat_context_previews = case plan_id when 'starter' then 2 when 'pro' then 6 when 'business' then 8 else 12 end,
  max_uploads_monthly = case plan_id when 'starter' then 3 when 'pro' then 25 when 'business' then 150 else null end,
  max_ai_requests_monthly = case plan_id when 'starter' then 100 when 'pro' then 1000 when 'business' then 10000 else null end,
  max_active_threads = case plan_id when 'starter' then 10 when 'pro' then 100 when 'business' then 1000 else null end,
  max_context_previews = case plan_id when 'starter' then 2 when 'pro' then 6 when 'business' then 8 else 12 end,
  max_context_payload_bytes = case plan_id when 'starter' then 12000 when 'pro' then 36000 when 'business' then 64000 else 120000 end,
  max_indexed_preview_bytes = case plan_id when 'starter' then 60000 when 'pro' then 400000 when 'business' then 1200000 else null end,
  updated_at = now();

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  thread_id uuid references public.threads(id) on delete set null,
  event_type text not null,
  quantity integer not null default 1,
  size_bytes bigint not null default 0,
  token_estimate integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint usage_events_quantity_check check (quantity >= 0),
  constraint usage_events_size_check check (size_bytes >= 0),
  constraint usage_events_token_check check (token_estimate >= 0)
);

create index if not exists usage_events_user_created_idx
  on public.usage_events(user_id, created_at desc);
create index if not exists usage_events_user_type_created_idx
  on public.usage_events(user_id, event_type, created_at desc);
create index if not exists usage_events_project_created_idx
  on public.usage_events(project_id, created_at desc);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  thread_id uuid references public.threads(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_severity_check check (severity in ('info', 'warning', 'critical'))
);

create index if not exists audit_events_user_created_idx
  on public.audit_events(user_id, created_at desc);
create index if not exists audit_events_actor_created_idx
  on public.audit_events(actor_user_id, created_at desc);
create index if not exists audit_events_type_created_idx
  on public.audit_events(event_type, created_at desc);

create table if not exists public.usage_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  plan_id text not null references public.billing_plans(id),
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

alter table public.usage_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.usage_daily_snapshots enable row level security;

create or replace function public.get_effective_plan_id(check_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select user_subscriptions.plan_id
      from public.user_subscriptions
      where user_subscriptions.user_id = check_user_id
        and user_subscriptions.status in ('trialing', 'active')
      limit 1
    ),
    'starter'
  );
$$;

create or replace function public.get_plan_limit(check_user_id uuid, limit_key text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case limit_key
    when 'max_projects' then limits.max_projects::bigint
    when 'max_upload_mb' then limits.max_upload_mb::bigint
    when 'max_text_preview_files' then limits.max_text_preview_files::bigint
    when 'max_chat_context_previews' then limits.max_chat_context_previews::bigint
    when 'max_uploads_monthly' then limits.max_uploads_monthly::bigint
    when 'max_ai_requests_monthly' then limits.max_ai_requests_monthly::bigint
    when 'max_active_threads' then limits.max_active_threads::bigint
    when 'max_context_previews' then limits.max_context_previews::bigint
    when 'max_context_payload_bytes' then limits.max_context_payload_bytes::bigint
    when 'max_indexed_preview_bytes' then limits.max_indexed_preview_bytes::bigint
    else null
  end
  from public.plan_usage_limits limits
  where limits.plan_id = public.get_effective_plan_id(check_user_id);
$$;

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
    where user_id = check_user_id;
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

drop policy if exists "usage_events_select_own_or_admin" on public.usage_events;
drop policy if exists "usage_events_insert_own" on public.usage_events;
create policy "usage_events_select_own_or_admin" on public.usage_events
for select using (auth.uid() = user_id or public.is_admin());
create policy "usage_events_insert_own" on public.usage_events
for insert with check (auth.uid() = user_id);

drop policy if exists "audit_events_select_own_or_admin" on public.audit_events;
drop policy if exists "audit_events_insert_own_or_admin" on public.audit_events;
create policy "audit_events_select_own_or_admin" on public.audit_events
for select using (public.is_admin() or auth.uid() = user_id or auth.uid() = actor_user_id);
create policy "audit_events_insert_own_or_admin" on public.audit_events
for insert with check (public.is_admin() or auth.uid() = actor_user_id or auth.uid() = user_id);

drop policy if exists "usage_daily_snapshots_select_own_or_admin" on public.usage_daily_snapshots;
drop policy if exists "usage_daily_snapshots_admin_write" on public.usage_daily_snapshots;
create policy "usage_daily_snapshots_select_own_or_admin" on public.usage_daily_snapshots
for select using (auth.uid() = user_id or public.is_admin());
create policy "usage_daily_snapshots_admin_write" on public.usage_daily_snapshots
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
for insert with check (
  auth.uid() = user_id
  and public.is_within_usage_limit(auth.uid(), 'max_projects', 1)
);

drop policy if exists "threads_insert_own" on public.threads;
create policy "threads_insert_own" on public.threads
for insert with check (
  auth.uid() = user_id
  and public.is_within_usage_limit(auth.uid(), 'max_active_threads', 1)
  and (
    project_id is null
    or exists (
      select 1 from public.projects
      where projects.id = threads.project_id
        and projects.user_id = auth.uid()
    )
  )
);

drop policy if exists "project_text_previews_insert_own" on public.project_text_previews;
create policy "project_text_previews_insert_own" on public.project_text_previews
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.projects
    where projects.id = project_text_previews.project_id
      and projects.user_id = auth.uid()
  )
  and public.is_within_usage_limit(auth.uid(), 'max_text_preview_files', 1)
  and public.is_within_usage_limit(auth.uid(), 'max_indexed_preview_bytes', length(preview_text))
);
