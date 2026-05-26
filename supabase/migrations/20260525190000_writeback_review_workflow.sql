-- Phase 90: writeback review and approval workflow.
-- Additive only: approval is governance state only and does not apply patches,
-- write to object storage, or mutate project_files/project_text_previews.

alter table public.project_writeback_requests
  add column if not exists review_decision text,
  add column if not exists review_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_writeback_requests_review_decision_check'
      and conrelid = 'public.project_writeback_requests'::regclass
  ) then
    alter table public.project_writeback_requests
      add constraint project_writeback_requests_review_decision_check
      check (review_decision is null or review_decision in ('approved', 'rejected'));
  end if;
end $$;

create index if not exists project_writeback_requests_review_idx
  on public.project_writeback_requests(status, risk_level, created_at desc);

create or replace function public.touch_project_writeback_requests_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_project_writeback_requests_updated_at
  on public.project_writeback_requests;
create trigger touch_project_writeback_requests_updated_at
before update on public.project_writeback_requests
for each row execute function public.touch_project_writeback_requests_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_patch_previews'
      and policyname = 'project_patch_previews_admin_select'
  ) then
    create policy "project_patch_previews_admin_select" on public.project_patch_previews
      for select using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_patch_snapshots'
      and policyname = 'project_patch_snapshots_admin_select'
  ) then
    create policy "project_patch_snapshots_admin_select" on public.project_patch_snapshots
      for select using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_patch_snapshot_files'
      and policyname = 'project_patch_snapshot_files_admin_select'
  ) then
    create policy "project_patch_snapshot_files_admin_select" on public.project_patch_snapshot_files
      for select using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_writeback_requests'
      and policyname = 'project_writeback_requests_admin_select'
  ) then
    create policy "project_writeback_requests_admin_select" on public.project_writeback_requests
      for select using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_writeback_requests'
      and policyname = 'project_writeback_requests_admin_review_update'
  ) then
    create policy "project_writeback_requests_admin_review_update" on public.project_writeback_requests
      for update
      using (
        public.is_admin()
        and status in ('submitted', 'blocked')
      )
      with check (
        public.is_admin()
        and status in ('approved', 'rejected')
        and reviewer_id = auth.uid()
        and reviewed_at is not null
        and review_decision in ('approved', 'rejected')
      );
  end if;
end $$;
