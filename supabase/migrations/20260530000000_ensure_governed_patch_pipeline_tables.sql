-- 1. Helper for updated_at
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. project_patch_previews
CREATE TABLE IF NOT EXISTS public.project_patch_previews (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    ingestion_job_id uuid null,
    created_by uuid not null,
    title text null,
    status text not null default 'draft',
    source text not null default 'manual',
    summary text null,
    grounded_files jsonb not null default '[]'::jsonb,
    diff jsonb not null default '[]'::jsonb,
    warnings jsonb not null default '[]'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

ALTER TABLE public.project_patch_previews ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view patch previews for their projects" ON public.project_patch_previews;
  DROP POLICY IF EXISTS "Users can insert patch previews for their projects" ON public.project_patch_previews;
  DROP POLICY IF EXISTS "Users can update patch previews for their projects" ON public.project_patch_previews;
END $$;

CREATE POLICY "Users can view patch previews for their projects"
ON public.project_patch_previews FOR SELECT TO authenticated
USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert patch previews for their projects"
ON public.project_patch_previews FOR INSERT TO authenticated
WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update patch previews for their projects"
ON public.project_patch_previews FOR UPDATE TO authenticated
USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS project_patch_previews_project_id_idx ON public.project_patch_previews(project_id);

DROP TRIGGER IF EXISTS set_project_patch_previews_updated_at ON public.project_patch_previews;
CREATE TRIGGER set_project_patch_previews_updated_at
  BEFORE UPDATE ON public.project_patch_previews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 3. project_patch_snapshots
CREATE TABLE IF NOT EXISTS public.project_patch_snapshots (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    patch_preview_id uuid not null references public.project_patch_previews(id) on delete cascade,
    created_by uuid not null,
    status text not null default 'created',
    title text null,
    summary text null,
    source text not null default 'patch_preview_sandbox',
    verification_status text not null default 'not_run',
    changed_files_count integer not null default 0,
    warnings jsonb not null default '[]'::jsonb,
    blockers jsonb not null default '[]'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

ALTER TABLE public.project_patch_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view patch snapshots for their projects" ON public.project_patch_snapshots;
  DROP POLICY IF EXISTS "Users can insert patch snapshots for their projects" ON public.project_patch_snapshots;
END $$;

CREATE POLICY "Users can view patch snapshots for their projects"
ON public.project_patch_snapshots FOR SELECT TO authenticated
USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert patch snapshots for their projects"
ON public.project_patch_snapshots FOR INSERT TO authenticated
WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS project_patch_snapshots_project_id_idx ON public.project_patch_snapshots(project_id);
CREATE INDEX IF NOT EXISTS project_patch_snapshots_patch_preview_id_idx ON public.project_patch_snapshots(patch_preview_id);

-- 4. project_patch_snapshot_files
CREATE TABLE IF NOT EXISTS public.project_patch_snapshot_files (
    id uuid primary key default gen_random_uuid(),
    snapshot_id uuid not null references public.project_patch_snapshots(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    patch_preview_id uuid not null references public.project_patch_previews(id) on delete cascade,
    file_path text not null,
    original_content_sha256 text null,
    patched_content_sha256 text null,
    original_preview_text text null,
    patched_preview_text text null,
    changed boolean not null default false,
    preview_limited boolean not null default true,
    truncated boolean not null default false,
    warnings jsonb not null default '[]'::jsonb,
    blockers jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

ALTER TABLE public.project_patch_snapshot_files ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view patch snapshot files for their projects" ON public.project_patch_snapshot_files;
  DROP POLICY IF EXISTS "Users can insert patch snapshot files for their projects" ON public.project_patch_snapshot_files;
END $$;

CREATE POLICY "Users can view patch snapshot files for their projects"
ON public.project_patch_snapshot_files FOR SELECT TO authenticated
USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert patch snapshot files for their projects"
ON public.project_patch_snapshot_files FOR INSERT TO authenticated
WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS project_patch_snapshot_files_snapshot_id_idx ON public.project_patch_snapshot_files(snapshot_id);

-- 5. project_writeback_requests
CREATE TABLE IF NOT EXISTS public.project_writeback_requests (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    snapshot_id uuid not null references public.project_patch_snapshots(id) on delete cascade,
    requested_by uuid not null,
    reviewed_by uuid null,
    status text not null default 'draft',
    requester_note text null,
    reviewer_note text null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    submitted_at timestamptz null,
    reviewed_at timestamptz null
);

ALTER TABLE public.project_writeback_requests ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view writeback requests for their projects" ON public.project_writeback_requests;
  DROP POLICY IF EXISTS "Users can insert writeback requests for their projects" ON public.project_writeback_requests;
  DROP POLICY IF EXISTS "Users can update writeback requests for their projects" ON public.project_writeback_requests;
END $$;

CREATE POLICY "Users can view writeback requests for their projects"
ON public.project_writeback_requests FOR SELECT TO authenticated
USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert writeback requests for their projects"
ON public.project_writeback_requests FOR INSERT TO authenticated
WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update writeback requests for their projects"
ON public.project_writeback_requests FOR UPDATE TO authenticated
USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS project_writeback_requests_project_id_idx ON public.project_writeback_requests(project_id);

DROP TRIGGER IF EXISTS set_project_writeback_requests_updated_at ON public.project_writeback_requests;
CREATE TRIGGER set_project_writeback_requests_updated_at
  BEFORE UPDATE ON public.project_writeback_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 6. project_working_copies
CREATE TABLE IF NOT EXISTS public.project_working_copies (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    request_id uuid not null references public.project_writeback_requests(id) on delete cascade,
    snapshot_id uuid not null references public.project_patch_snapshots(id) on delete cascade,
    created_by uuid not null,
    status text not null default 'created',
    title text null,
    summary text null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

ALTER TABLE public.project_working_copies ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view working copies for their projects" ON public.project_working_copies;
  DROP POLICY IF EXISTS "Users can insert working copies for their projects" ON public.project_working_copies;
END $$;

CREATE POLICY "Users can view working copies for their projects"
ON public.project_working_copies FOR SELECT TO authenticated
USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert working copies for their projects"
ON public.project_working_copies FOR INSERT TO authenticated
WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS project_working_copies_project_id_idx ON public.project_working_copies(project_id);
CREATE INDEX IF NOT EXISTS project_working_copies_request_id_idx ON public.project_working_copies(request_id);

-- 7. project_working_copy_files
CREATE TABLE IF NOT EXISTS public.project_working_copy_files (
    id uuid primary key default gen_random_uuid(),
    working_copy_id uuid not null references public.project_working_copies(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    file_path text not null,
    original_preview_text text null,
    working_copy_text text null,
    changed boolean not null default false,
    warnings jsonb not null default '[]'::jsonb,
    blockers jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

ALTER TABLE public.project_working_copy_files ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view working copy files for their projects" ON public.project_working_copy_files;
  DROP POLICY IF EXISTS "Users can insert working copy files for their projects" ON public.project_working_copy_files;
END $$;

CREATE POLICY "Users can view working copy files for their projects"
ON public.project_working_copy_files FOR SELECT TO authenticated
USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert working copy files for their projects"
ON public.project_working_copy_files FOR INSERT TO authenticated
WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS project_working_copy_files_working_copy_id_idx ON public.project_working_copy_files(working_copy_id);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.project_patch_previews TO authenticated;
GRANT SELECT, INSERT ON public.project_patch_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.project_patch_snapshot_files TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.project_writeback_requests TO authenticated;
GRANT SELECT, INSERT ON public.project_working_copies TO authenticated;
GRANT SELECT, INSERT ON public.project_working_copy_files TO authenticated;
