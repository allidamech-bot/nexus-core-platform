create table if not exists public.project_text_previews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_id uuid not null references public.project_files(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  preview_text text not null,
  summary text not null,
  detected_language text,
  indexed_at timestamptz not null default now(),
  truncated boolean not null default false,
  line_count integer not null default 0,
  token_estimate integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint project_text_previews_project_file_unique unique (project_id, file_id),
  constraint project_text_previews_preview_length_check check (char_length(preview_text) <= 12000)
);

create index if not exists project_text_previews_project_idx
  on public.project_text_previews(project_id, indexed_at desc);

create index if not exists project_text_previews_user_idx
  on public.project_text_previews(user_id, indexed_at desc);

alter table public.project_text_previews enable row level security;

drop policy if exists "project_text_previews_select_own_project" on public.project_text_previews;
drop policy if exists "project_text_previews_insert_own_project" on public.project_text_previews;
drop policy if exists "project_text_previews_update_own_project" on public.project_text_previews;
drop policy if exists "project_text_previews_delete_own_project" on public.project_text_previews;

create policy "project_text_previews_select_own_project" on public.project_text_previews
for select using (
  exists (
    select 1 from public.projects
    where projects.id = project_text_previews.project_id
      and projects.user_id = auth.uid()
  )
);

create policy "project_text_previews_insert_own_project" on public.project_text_previews
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.projects
    where projects.id = project_text_previews.project_id
      and projects.user_id = auth.uid()
  )
  and exists (
    select 1 from public.project_files
    where project_files.id = project_text_previews.file_id
      and project_files.project_id = project_text_previews.project_id
      and project_files.user_id = auth.uid()
  )
);

create policy "project_text_previews_update_own_project" on public.project_text_previews
for update using (
  exists (
    select 1 from public.projects
    where projects.id = project_text_previews.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.projects
    where projects.id = project_text_previews.project_id
      and projects.user_id = auth.uid()
  )
  and exists (
    select 1 from public.project_files
    where project_files.id = project_text_previews.file_id
      and project_files.project_id = project_text_previews.project_id
      and project_files.user_id = auth.uid()
  )
);

create policy "project_text_previews_delete_own_project" on public.project_text_previews
for delete using (
  exists (
    select 1 from public.projects
    where projects.id = project_text_previews.project_id
      and projects.user_id = auth.uid()
  )
);
