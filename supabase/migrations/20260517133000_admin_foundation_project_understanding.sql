create table if not exists public.admin_email_allowlist (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint admin_email_allowlist_lower_check check (email = lower(email))
);

insert into public.admin_email_allowlist (email)
values ('allidamech@gmail.com')
on conflict (email) do nothing;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_role_check check (role in ('user', 'admin'))
);

create index if not exists user_roles_role_idx on public.user_roles(role);

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_roles.user_id = check_user_id
      and user_roles.role = 'admin'
  );
$$;

create or replace function public.sync_admin_role_from_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and exists (
    select 1
    from public.admin_email_allowlist
    where admin_email_allowlist.email = lower(new.email)
  ) then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id) do update
      set role = 'admin',
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists sync_admin_role_from_email on auth.users;
create trigger sync_admin_role_from_email
after insert or update of email on auth.users
for each row execute function public.sync_admin_role_from_email();

insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = 'allidamech@gmail.com'
on conflict (user_id) do update
  set role = 'admin',
      updated_at = now();

create table if not exists public.billing_plans (
  id text primary key,
  name text not null,
  status text not null default 'active',
  monthly_price_cents integer,
  created_at timestamptz not null default now(),
  constraint billing_plans_status_check check (status in ('active', 'archived'))
);

insert into public.billing_plans (id, name, monthly_price_cents)
values
  ('starter', 'Starter', null),
  ('pro', 'Pro', null),
  ('business', 'Business', null),
  ('enterprise', 'Enterprise', null)
on conflict (id) do update
  set name = excluded.name;

create table if not exists public.plan_usage_limits (
  plan_id text primary key references public.billing_plans(id) on delete cascade,
  max_projects integer,
  max_upload_mb integer,
  max_text_preview_files integer,
  max_chat_context_previews integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plan_usage_limits (
  plan_id,
  max_projects,
  max_upload_mb,
  max_text_preview_files,
  max_chat_context_previews
)
values
  ('starter', 3, 50, 24, 4),
  ('pro', 20, 50, 48, 6),
  ('business', 100, 100, 96, 8),
  ('enterprise', null, 250, 200, 12)
on conflict (plan_id) do update
  set max_projects = excluded.max_projects,
      max_upload_mb = excluded.max_upload_mb,
      max_text_preview_files = excluded.max_text_preview_files,
      max_chat_context_previews = excluded.max_chat_context_previews,
      updated_at = now();

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null references public.billing_plans(id),
  status text not null default 'trialing',
  billing_status text not null default 'not_configured',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_subscriptions_status_check check (status in ('trialing', 'active', 'past_due', 'canceled')),
  constraint user_subscriptions_billing_status_check check (billing_status in ('not_configured', 'ok', 'requires_attention'))
);

alter table public.threads
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists threads_project_idx on public.threads(project_id);

drop policy if exists "threads_select_own" on public.threads;
drop policy if exists "threads_insert_own" on public.threads;
drop policy if exists "threads_update_own" on public.threads;
drop policy if exists "threads_delete_own" on public.threads;
create policy "threads_select_own" on public.threads
for select using (auth.uid() = user_id);
create policy "threads_insert_own" on public.threads
for insert with check (
  auth.uid() = user_id
  and (
    project_id is null
    or exists (
      select 1 from public.projects
      where projects.id = threads.project_id
        and projects.user_id = auth.uid()
    )
  )
);
create policy "threads_update_own" on public.threads
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    project_id is null
    or exists (
      select 1 from public.projects
      where projects.id = threads.project_id
        and projects.user_id = auth.uid()
    )
  )
);
create policy "threads_delete_own" on public.threads
for delete using (auth.uid() = user_id);

create table if not exists public.thread_context_selections (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  preview_id uuid references public.project_text_previews(id) on delete set null,
  file_id uuid references public.project_files(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint thread_context_selections_action_check check (action in ('attached_project', 'selected_preview', 'cleared_preview'))
);

create index if not exists thread_context_selections_thread_created_idx
  on public.thread_context_selections(thread_id, created_at desc);

create index if not exists thread_context_selections_project_created_idx
  on public.thread_context_selections(project_id, created_at desc);

alter table public.admin_email_allowlist enable row level security;
alter table public.user_roles enable row level security;
alter table public.billing_plans enable row level security;
alter table public.plan_usage_limits enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.thread_context_selections enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "project_security_events_select_own" on public.project_security_events;
create policy "project_security_events_select_own" on public.project_security_events
for select using (
  public.is_admin()
  or auth.uid() = user_id
  or exists (
    select 1 from public.projects
    where projects.id = project_security_events.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "admin_email_allowlist_admin_select" on public.admin_email_allowlist;
create policy "admin_email_allowlist_admin_select" on public.admin_email_allowlist
for select using (public.is_admin());

drop policy if exists "user_roles_select_own_or_admin" on public.user_roles;
drop policy if exists "user_roles_admin_write" on public.user_roles;
create policy "user_roles_select_own_or_admin" on public.user_roles
for select using (auth.uid() = user_id or public.is_admin());
create policy "user_roles_admin_write" on public.user_roles
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "billing_plans_authenticated_select" on public.billing_plans;
drop policy if exists "billing_plans_admin_write" on public.billing_plans;
create policy "billing_plans_authenticated_select" on public.billing_plans
for select using (auth.role() = 'authenticated');
create policy "billing_plans_admin_write" on public.billing_plans
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "plan_usage_limits_authenticated_select" on public.plan_usage_limits;
drop policy if exists "plan_usage_limits_admin_write" on public.plan_usage_limits;
create policy "plan_usage_limits_authenticated_select" on public.plan_usage_limits
for select using (auth.role() = 'authenticated');
create policy "plan_usage_limits_admin_write" on public.plan_usage_limits
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "user_subscriptions_select_own_or_admin" on public.user_subscriptions;
drop policy if exists "user_subscriptions_insert_own_default" on public.user_subscriptions;
drop policy if exists "user_subscriptions_admin_write" on public.user_subscriptions;
create policy "user_subscriptions_select_own_or_admin" on public.user_subscriptions
for select using (auth.uid() = user_id or public.is_admin());
create policy "user_subscriptions_admin_write" on public.user_subscriptions
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "thread_context_select_own_or_admin" on public.thread_context_selections;
drop policy if exists "thread_context_insert_own" on public.thread_context_selections;
create policy "thread_context_select_own_or_admin" on public.thread_context_selections
for select using (
  public.is_admin()
  or exists (
    select 1 from public.threads
    where threads.id = thread_context_selections.thread_id
      and threads.user_id = auth.uid()
  )
);
create policy "thread_context_insert_own" on public.thread_context_selections
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.threads
    where threads.id = thread_context_selections.thread_id
      and threads.user_id = auth.uid()
  )
  and exists (
    select 1 from public.projects
    where projects.id = thread_context_selections.project_id
      and projects.user_id = auth.uid()
  )
);
