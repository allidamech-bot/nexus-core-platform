create table if not exists public.memory_feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_feature_flags_key_check check (
    key in (
      'memory_write_enabled',
      'memory_retrieval_enabled',
      'memory_search_enabled',
      'memory_auto_recall_enabled'
    )
  )
);

insert into public.memory_feature_flags (key, enabled, description)
values
  ('memory_write_enabled', false, 'Allows Project Memory write mutations when explicitly enabled.'),
  ('memory_retrieval_enabled', false, 'Allows manual Project Memory retrieval when explicitly enabled.'),
  ('memory_search_enabled', false, 'Allows Project Memory search when explicitly enabled.'),
  ('memory_auto_recall_enabled', false, 'Allows automatic Project Memory recall in AI flows when explicitly enabled.')
on conflict (key) do update
  set enabled = false,
      description = excluded.description,
      updated_at = now();

create or replace function public.is_memory_feature_enabled(feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select memory_feature_flags.enabled
      from public.memory_feature_flags
      where memory_feature_flags.key = feature_key
      limit 1
    ),
    false
  );
$$;

create table if not exists public.memory_categories (
  key text primary key,
  name text not null,
  description text not null,
  default_retention text not null default 'long_term',
  requires_approval boolean not null default true,
  auto_retrievable boolean not null default false,
  admin_only boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_categories_key_check check (
    key in (
      'project_facts',
      'repository_knowledge',
      'architecture_decisions',
      'approved_plans',
      'ai_findings',
      'operator_notes'
    )
  ),
  constraint memory_categories_retention_check check (
    default_retention in ('short_term', 'mid_term', 'long_term', 'archive')
  ),
  constraint memory_categories_status_check check (status in ('active', 'disabled', 'archived'))
);

insert into public.memory_categories (
  key,
  name,
  description,
  default_retention,
  requires_approval,
  auto_retrievable,
  admin_only,
  status
)
values
  (
    'project_facts',
    'Project Facts',
    'Stable project facts such as production target, release markers, and approved scope.',
    'long_term',
    true,
    false,
    false,
    'active'
  ),
  (
    'repository_knowledge',
    'Repository Knowledge',
    'Safe summaries of repository structure, frameworks, and ownership areas.',
    'mid_term',
    true,
    false,
    false,
    'active'
  ),
  (
    'architecture_decisions',
    'Architecture Decisions',
    'Approved architecture decisions with rationale and tradeoffs.',
    'long_term',
    true,
    false,
    false,
    'active'
  ),
  (
    'approved_plans',
    'Approved Plans',
    'User-approved implementation, QA, and release plans.',
    'mid_term',
    true,
    false,
    false,
    'active'
  ),
  (
    'ai_findings',
    'AI Findings',
    'AI-generated findings that require verification before durable use.',
    'mid_term',
    true,
    false,
    false,
    'active'
  ),
  (
    'operator_notes',
    'Operator Notes',
    'Safe operational notes for QA, deployment, and debugging.',
    'long_term',
    true,
    false,
    true,
    'active'
  )
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      default_retention = excluded.default_retention,
      requires_approval = excluded.requires_approval,
      auto_retrievable = false,
      admin_only = excluded.admin_only,
      status = excluded.status,
      updated_at = now();

create table if not exists public.memory_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  category_key text not null references public.memory_categories(key),
  title text not null,
  summary text not null,
  detailed_context text,
  source_type text not null default 'user_action',
  source_ref text,
  confidence_score numeric(4, 3) not null default 0,
  approval_state text not null default 'draft',
  retrieval_priority integer not null default 0,
  scope_visibility text not null default 'project',
  redaction_state text not null default 'clean',
  metadata jsonb not null default '{}'::jsonb,
  correlation_id text,
  approved_at timestamptz,
  archived_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_entries_approval_state_check check (
    approval_state in ('draft', 'verified', 'approved', 'archived', 'rejected')
  ),
  constraint memory_entries_scope_visibility_check check (
    scope_visibility in ('user', 'project', 'admin')
  ),
  constraint memory_entries_redaction_state_check check (
    redaction_state in ('clean', 'redacted', 'blocked', 'needs_review')
  ),
  constraint memory_entries_confidence_score_check check (
    confidence_score >= 0 and confidence_score <= 1
  ),
  constraint memory_entries_title_length_check check (
    char_length(title) between 1 and 160
  ),
  constraint memory_entries_summary_length_check check (
    char_length(summary) between 1 and 4000
  ),
  constraint memory_entries_detailed_context_length_check check (
    detailed_context is null or char_length(detailed_context) <= 12000
  ),
  constraint memory_entries_blocked_not_approved_check check (
    redaction_state <> 'blocked' or approval_state in ('draft', 'rejected')
  ),
  constraint memory_entries_archived_state_check check (
    (approval_state = 'archived') = (archived_at is not null)
  ),
  constraint memory_entries_rejected_state_check check (
    (approval_state = 'rejected') = (rejected_at is not null)
  )
);

create index if not exists memory_entries_project_updated_idx
  on public.memory_entries(project_id, updated_at desc);
create index if not exists memory_entries_user_updated_idx
  on public.memory_entries(user_id, updated_at desc);
create index if not exists memory_entries_project_category_idx
  on public.memory_entries(project_id, category_key, updated_at desc);
create index if not exists memory_entries_project_state_idx
  on public.memory_entries(project_id, approval_state, updated_at desc);
create index if not exists memory_entries_correlation_idx
  on public.memory_entries(correlation_id)
  where correlation_id is not null;

create table if not exists public.memory_links (
  id uuid primary key default gen_random_uuid(),
  memory_entry_id uuid not null references public.memory_entries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  linked_type text not null,
  linked_ref text not null,
  link_summary text,
  metadata jsonb not null default '{}'::jsonb,
  correlation_id text,
  created_at timestamptz not null default now(),
  constraint memory_links_linked_type_check check (
    linked_type in (
      'thread',
      'message',
      'plan',
      'file_summary',
      'audit_event',
      'usage_event',
      'release_note',
      'operator_note',
      'project'
    )
  ),
  constraint memory_links_link_summary_length_check check (
    link_summary is null or char_length(link_summary) <= 2000
  )
);

create index if not exists memory_links_entry_created_idx
  on public.memory_links(memory_entry_id, created_at desc);
create index if not exists memory_links_project_created_idx
  on public.memory_links(project_id, created_at desc);

create table if not exists public.memory_feedback (
  id uuid primary key default gen_random_uuid(),
  memory_entry_id uuid not null references public.memory_entries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback_type text not null,
  feedback_summary text,
  metadata jsonb not null default '{}'::jsonb,
  correlation_id text,
  created_at timestamptz not null default now(),
  constraint memory_feedback_type_check check (
    feedback_type in ('helpful', 'stale', 'incorrect', 'unsafe', 'duplicate', 'approved', 'rejected', 'edited')
  ),
  constraint memory_feedback_summary_length_check check (
    feedback_summary is null or char_length(feedback_summary) <= 2000
  )
);

create index if not exists memory_feedback_entry_created_idx
  on public.memory_feedback(memory_entry_id, created_at desc);
create index if not exists memory_feedback_project_created_idx
  on public.memory_feedback(project_id, created_at desc);

create table if not exists public.memory_retrieval_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  route_area text not null,
  event_type text not null default 'search',
  scope_visibility text not null default 'project',
  query_summary text,
  result_count integer not null default 0,
  used_memory_ids uuid[] not null default '{}'::uuid[],
  excluded_reason text,
  latency_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  correlation_id text,
  created_at timestamptz not null default now(),
  constraint memory_retrieval_events_type_check check (
    event_type in ('search', 'auto_load', 'citation_open', 'excluded', 'error')
  ),
  constraint memory_retrieval_events_scope_visibility_check check (
    scope_visibility in ('user', 'project', 'admin')
  ),
  constraint memory_retrieval_events_result_count_check check (result_count >= 0),
  constraint memory_retrieval_events_latency_check check (latency_ms is null or latency_ms >= 0),
  constraint memory_retrieval_events_query_summary_length_check check (
    query_summary is null or char_length(query_summary) <= 1000
  )
);

create index if not exists memory_retrieval_events_project_created_idx
  on public.memory_retrieval_events(project_id, created_at desc);
create index if not exists memory_retrieval_events_user_created_idx
  on public.memory_retrieval_events(user_id, created_at desc);
create index if not exists memory_retrieval_events_correlation_idx
  on public.memory_retrieval_events(correlation_id)
  where correlation_id is not null;

create table if not exists public.memory_archives (
  id uuid primary key default gen_random_uuid(),
  memory_entry_id uuid not null references public.memory_entries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  archived_by uuid not null references auth.users(id) on delete cascade,
  archive_reason text not null,
  archived_summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  correlation_id text,
  archived_at timestamptz not null default now(),
  constraint memory_archives_reason_check check (
    archive_reason in ('superseded', 'stale', 'rejected', 'user_archived', 'policy_blocked', 'deleted_by_user')
  ),
  constraint memory_archives_summary_length_check check (
    char_length(archived_summary) between 1 and 4000
  )
);

create index if not exists memory_archives_entry_archived_idx
  on public.memory_archives(memory_entry_id, archived_at desc);
create index if not exists memory_archives_project_archived_idx
  on public.memory_archives(project_id, archived_at desc);

alter table public.memory_feature_flags enable row level security;
alter table public.memory_categories enable row level security;
alter table public.memory_entries enable row level security;
alter table public.memory_links enable row level security;
alter table public.memory_feedback enable row level security;
alter table public.memory_retrieval_events enable row level security;
alter table public.memory_archives enable row level security;

drop policy if exists "memory_feature_flags_admin_select" on public.memory_feature_flags;
drop policy if exists "memory_feature_flags_admin_write" on public.memory_feature_flags;
create policy "memory_feature_flags_admin_select" on public.memory_feature_flags
for select using (public.is_admin());
create policy "memory_feature_flags_admin_write" on public.memory_feature_flags
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "memory_categories_authenticated_select" on public.memory_categories;
drop policy if exists "memory_categories_admin_write" on public.memory_categories;
create policy "memory_categories_authenticated_select" on public.memory_categories
for select using (
  auth.role() = 'authenticated'
  and status = 'active'
  and (
    admin_only = false
    or public.is_admin()
  )
);
create policy "memory_categories_admin_write" on public.memory_categories
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "memory_entries_select_foundation" on public.memory_entries;
drop policy if exists "memory_entries_insert_foundation" on public.memory_entries;
drop policy if exists "memory_entries_update_foundation" on public.memory_entries;
drop policy if exists "memory_entries_delete_foundation" on public.memory_entries;
create policy "memory_entries_select_foundation" on public.memory_entries
for select using (
  public.is_memory_feature_enabled('memory_search_enabled')
  and approval_state not in ('archived', 'rejected')
  and archived_at is null
  and rejected_at is null
  and (
    public.is_admin()
    or (
      scope_visibility <> 'admin'
      and auth.uid() = user_id
      and exists (
        select 1 from public.projects
        where projects.id = memory_entries.project_id
          and projects.user_id = auth.uid()
      )
    )
  )
);
create policy "memory_entries_insert_foundation" on public.memory_entries
for insert with check (
  public.is_memory_feature_enabled('memory_write_enabled')
  and auth.uid() = user_id
  and auth.uid() = created_by
  and (
    scope_visibility <> 'admin'
    or public.is_admin()
  )
  and exists (
    select 1 from public.projects
    where projects.id = memory_entries.project_id
      and projects.user_id = auth.uid()
  )
);
create policy "memory_entries_update_foundation" on public.memory_entries
for update using (
  public.is_memory_feature_enabled('memory_write_enabled')
  and (
    public.is_admin()
    or (
      scope_visibility <> 'admin'
      and
      auth.uid() = user_id
      and exists (
        select 1 from public.projects
        where projects.id = memory_entries.project_id
          and projects.user_id = auth.uid()
      )
    )
  )
)
with check (
  public.is_memory_feature_enabled('memory_write_enabled')
  and (
    public.is_admin()
    or (
      scope_visibility <> 'admin'
      and auth.uid() = user_id
      and exists (
        select 1 from public.projects
        where projects.id = memory_entries.project_id
          and projects.user_id = auth.uid()
      )
    )
  )
);
create policy "memory_entries_delete_foundation" on public.memory_entries
for delete using (
  public.is_memory_feature_enabled('memory_write_enabled')
  and (
    public.is_admin()
    or (
      auth.uid() = user_id
      and exists (
        select 1 from public.projects
        where projects.id = memory_entries.project_id
          and projects.user_id = auth.uid()
      )
    )
  )
);

drop policy if exists "memory_links_select_foundation" on public.memory_links;
drop policy if exists "memory_links_insert_foundation" on public.memory_links;
drop policy if exists "memory_links_delete_foundation" on public.memory_links;
create policy "memory_links_select_foundation" on public.memory_links
for select using (
  public.is_memory_feature_enabled('memory_search_enabled')
  and exists (
    select 1 from public.memory_entries
    where memory_entries.id = memory_links.memory_entry_id
      and memory_entries.project_id = memory_links.project_id
  )
);
create policy "memory_links_insert_foundation" on public.memory_links
for insert with check (
  public.is_memory_feature_enabled('memory_write_enabled')
  and auth.uid() = user_id
  and auth.uid() = created_by
  and exists (
    select 1 from public.memory_entries
    where memory_entries.id = memory_links.memory_entry_id
      and memory_entries.project_id = memory_links.project_id
      and memory_entries.user_id = auth.uid()
  )
);
create policy "memory_links_delete_foundation" on public.memory_links
for delete using (
  public.is_memory_feature_enabled('memory_write_enabled')
  and (
    public.is_admin()
    or auth.uid() = user_id
  )
);

drop policy if exists "memory_feedback_select_foundation" on public.memory_feedback;
drop policy if exists "memory_feedback_insert_foundation" on public.memory_feedback;
create policy "memory_feedback_select_foundation" on public.memory_feedback
for select using (
  public.is_memory_feature_enabled('memory_search_enabled')
  and (
    public.is_admin()
    or auth.uid() = user_id
  )
  and exists (
    select 1 from public.memory_entries
    where memory_entries.id = memory_feedback.memory_entry_id
      and memory_entries.project_id = memory_feedback.project_id
  )
);
create policy "memory_feedback_insert_foundation" on public.memory_feedback
for insert with check (
  public.is_memory_feature_enabled('memory_write_enabled')
  and auth.uid() = user_id
  and exists (
    select 1 from public.memory_entries
    where memory_entries.id = memory_feedback.memory_entry_id
      and memory_entries.project_id = memory_feedback.project_id
      and (
        public.is_admin()
        or memory_entries.user_id = auth.uid()
      )
  )
);

drop policy if exists "memory_retrieval_events_select_foundation" on public.memory_retrieval_events;
drop policy if exists "memory_retrieval_events_insert_foundation" on public.memory_retrieval_events;
create policy "memory_retrieval_events_select_foundation" on public.memory_retrieval_events
for select using (
  public.is_memory_feature_enabled('memory_retrieval_enabled')
  and (
    public.is_admin()
    or (
      auth.uid() = user_id
      and exists (
        select 1 from public.projects
        where projects.id = memory_retrieval_events.project_id
          and projects.user_id = auth.uid()
      )
    )
  )
);
create policy "memory_retrieval_events_insert_foundation" on public.memory_retrieval_events
for insert with check (
  public.is_memory_feature_enabled('memory_retrieval_enabled')
  and auth.uid() = user_id
  and (
    scope_visibility <> 'admin'
    or public.is_admin()
  )
  and exists (
    select 1 from public.projects
    where projects.id = memory_retrieval_events.project_id
      and projects.user_id = auth.uid()
  )
);

drop policy if exists "memory_archives_select_foundation" on public.memory_archives;
drop policy if exists "memory_archives_insert_foundation" on public.memory_archives;
create policy "memory_archives_select_foundation" on public.memory_archives
for select using (
  public.is_memory_feature_enabled('memory_search_enabled')
  and (
    public.is_admin()
    or (
      auth.uid() = user_id
      and exists (
        select 1 from public.projects
        where projects.id = memory_archives.project_id
          and projects.user_id = auth.uid()
      )
      and exists (
        select 1 from public.memory_entries
        where memory_entries.id = memory_archives.memory_entry_id
          and memory_entries.project_id = memory_archives.project_id
          and memory_entries.scope_visibility <> 'admin'
      )
    )
  )
);
create policy "memory_archives_insert_foundation" on public.memory_archives
for insert with check (
  public.is_memory_feature_enabled('memory_write_enabled')
  and auth.uid() = user_id
  and auth.uid() = archived_by
  and exists (
    select 1 from public.memory_entries
    where memory_entries.id = memory_archives.memory_entry_id
      and memory_entries.project_id = memory_archives.project_id
      and (
        public.is_admin()
        or memory_entries.user_id = auth.uid()
      )
  )
);
