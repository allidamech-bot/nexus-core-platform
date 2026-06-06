-- 1. Tenants (Organizations/Workspaces)
CREATE TABLE IF NOT EXISTS public.tenants (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Tenant Members
CREATE TABLE IF NOT EXISTS public.tenant_members (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    user_id uuid not null,
    role text not null default 'viewer', -- 'owner', 'reviewer', 'developer', 'viewer'
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(tenant_id, user_id)
);

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- 3. Teams
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 4. Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete cascade,
    user_id uuid not null,
    role text not null default 'member',
    created_at timestamptz not null default now(),
    unique(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 5. Add tenant_id to primary tables
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tenant_id uuid references public.tenants(id) on delete cascade;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS tenant_id uuid references public.tenants(id) on delete cascade;
ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS tenant_id uuid references public.tenants(id) on delete cascade;

-- RLS Updates for tenant-level isolation
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their tenants" ON public.tenants;
  DROP POLICY IF EXISTS "Users can view tenant members" ON public.tenant_members;
  DROP POLICY IF EXISTS "Users can view teams in their tenants" ON public.teams;
  DROP POLICY IF EXISTS "Users can view team members in their teams or tenants" ON public.team_members;
END $$;

CREATE POLICY "Users can view their tenants"
ON public.tenants FOR SELECT TO authenticated
USING (id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view tenant members"
ON public.tenant_members FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view teams in their tenants"
ON public.teams FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view team members in their teams or tenants"
ON public.team_members FOR SELECT TO authenticated
USING (team_id IN (SELECT id FROM public.teams WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())));

-- 6. Writeback Request Approvals (Quorum System)
CREATE TABLE IF NOT EXISTS public.writeback_request_approvals (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null references public.project_writeback_requests(id) on delete cascade,
    reviewer_id uuid not null,
    status text not null default 'pending', -- 'approved', 'rejected', 'pending'
    note text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(request_id, reviewer_id)
);

ALTER TABLE public.writeback_request_approvals ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view approvals for their projects" ON public.writeback_request_approvals;
  DROP POLICY IF EXISTS "Reviewers can insert/update their approvals" ON public.writeback_request_approvals;
END $$;

CREATE POLICY "Users can view approvals for their projects"
ON public.writeback_request_approvals FOR SELECT TO authenticated
USING (request_id IN (
    SELECT req.id FROM public.project_writeback_requests req
    JOIN public.projects p ON p.id = req.project_id
    WHERE p.user_id = auth.uid()
       OR p.tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
));

CREATE POLICY "Reviewers can insert/update their approvals"
ON public.writeback_request_approvals FOR ALL TO authenticated
USING (reviewer_id = auth.uid())
WITH CHECK (reviewer_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writeback_request_approvals TO authenticated;
