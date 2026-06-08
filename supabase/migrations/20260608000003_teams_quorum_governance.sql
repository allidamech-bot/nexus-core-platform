-- Phase 9: Multi-Tenant Teams & Quorum Governance

-- 1. Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

-- Organization RLS
alter table public.organizations enable row level security;
create policy "organizations_read_member" on public.organizations
  for select using (
    owner_id = auth.uid() 
    or id in (select organization_id from public.organization_members where user_id = auth.uid())
  );
create policy "organizations_insert" on public.organizations
  for insert with check (owner_id = auth.uid());

-- 2. Organization Members
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  user_id uuid references auth.users(id) not null,
  role text not null check (role in ('admin', 'reviewer', 'developer')),
  created_at timestamptz default now(),
  unique(organization_id, user_id)
);

-- Org Members RLS
alter table public.organization_members enable row level security;
create policy "organization_members_read" on public.organization_members
  for select using (
    organization_id in (
      select id from public.organizations where owner_id = auth.uid()
      union
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

-- 3. Link Projects to Organizations
alter table public.projects 
  add column if not exists organization_id uuid references public.organizations(id);

-- Provide org members access to projects
create policy "projects_read_org_members" on public.projects
  for select using (
    organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  );

-- 4. Organization Invitations
create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  role text not null check (role in ('admin', 'reviewer', 'developer')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz default now()
);

alter table public.organization_invitations enable row level security;
create policy "org_invitations_read" on public.organization_invitations
  for select using (
    organization_id in (
      select id from public.organizations where owner_id = auth.uid()
      union
      select organization_id from public.organization_members where role = 'admin' and user_id = auth.uid()
    )
  );
create policy "org_invitations_insert" on public.organization_invitations
  for insert with check (
    organization_id in (
      select id from public.organizations where owner_id = auth.uid()
      union
      select organization_id from public.organization_members where role = 'admin' and user_id = auth.uid()
    )
  );

-- 5. Quorum logic for writeback requests
alter table public.project_writeback_requests 
  add column if not exists required_approvals integer default 1,
  add column if not exists current_approvals integer default 0;

-- Let's ensure default pending requests are now pending_quorum if required > 0
alter table public.project_writeback_requests drop constraint if exists project_writeback_requests_status_check;
alter table public.project_writeback_requests add constraint project_writeback_requests_status_check check (status in ('submitted', 'pending_quorum', 'approved', 'rejected', 'cancelled', 'completed', 'failed'));

-- 6. Writeback Approvals
create table public.writeback_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.project_writeback_requests(id) not null,
  reviewer_id uuid references auth.users(id) not null,
  decision text not null check (decision in ('approved', 'rejected')),
  created_at timestamptz default now(),
  unique(request_id, reviewer_id)
);

alter table public.writeback_approvals enable row level security;
create policy "writeback_approvals_read" on public.writeback_approvals
  for select using (
    request_id in (
      select id from public.project_writeback_requests where project_id in (
        select id from public.projects where user_id = auth.uid() 
        or organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
      )
    )
  );

create policy "writeback_approvals_insert" on public.writeback_approvals
  for insert with check (
    reviewer_id = auth.uid()
  );

-- 7. Trigger to auto-update quorum status
create or replace function public.update_writeback_quorum()
returns trigger
language plpgsql
security definer
as $$
declare
  req public.project_writeback_requests%rowtype;
  approved_count integer;
  rejected_count integer;
begin
  select * into req from public.project_writeback_requests where id = new.request_id;
  
  select count(*) into approved_count from public.writeback_approvals where request_id = new.request_id and decision = 'approved';
  select count(*) into rejected_count from public.writeback_approvals where request_id = new.request_id and decision = 'rejected';

  if rejected_count > 0 then
    update public.project_writeback_requests set status = 'rejected', current_approvals = approved_count where id = new.request_id;
  elsif approved_count >= coalesce(req.required_approvals, 1) then
    update public.project_writeback_requests set status = 'approved', current_approvals = approved_count where id = new.request_id;
  else
    update public.project_writeback_requests set status = 'pending_quorum', current_approvals = approved_count where id = new.request_id;
  end if;

  return new;
end;
$$;

drop trigger if exists writeback_approval_trigger on public.writeback_approvals;
create trigger writeback_approval_trigger
  after insert or update on public.writeback_approvals
  for each row execute function public.update_writeback_quorum();
