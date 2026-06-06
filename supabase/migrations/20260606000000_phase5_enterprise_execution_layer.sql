-- 1. external_apply_queue
CREATE TABLE IF NOT EXISTS public.external_apply_queue (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    working_copy_id uuid not null references public.project_working_copies(id) on delete cascade,
    adapter_type text not null,
    status text not null default 'pending',
    payload jsonb not null default '{}'::jsonb,
    result_metadata jsonb not null default '{}'::jsonb,
    created_by uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

ALTER TABLE public.external_apply_queue ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view apply queue items for their projects" ON public.external_apply_queue;
  DROP POLICY IF EXISTS "Users can insert apply queue items for their projects" ON public.external_apply_queue;
  DROP POLICY IF EXISTS "Users can update apply queue items for their projects" ON public.external_apply_queue;
END $$;

CREATE POLICY "Users can view apply queue items for their projects"
ON public.external_apply_queue FOR SELECT TO authenticated
USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert apply queue items for their projects"
ON public.external_apply_queue FOR INSERT TO authenticated
WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update apply queue items for their projects"
ON public.external_apply_queue FOR UPDATE TO authenticated
USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS external_apply_queue_project_id_idx ON public.external_apply_queue(project_id);
CREATE INDEX IF NOT EXISTS external_apply_queue_working_copy_id_idx ON public.external_apply_queue(working_copy_id);

DROP TRIGGER IF EXISTS set_external_apply_queue_updated_at ON public.external_apply_queue;
CREATE TRIGGER set_external_apply_queue_updated_at
  BEFORE UPDATE ON public.external_apply_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 2. audit_events
CREATE TABLE IF NOT EXISTS public.audit_events (
    id uuid primary key default gen_random_uuid(),
    timestamp timestamptz not null default now(),
    actor_id uuid not null,
    tenant_id uuid null,
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    previous_hash text null
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own audit events" ON public.audit_events;
  DROP POLICY IF EXISTS "Users can insert audit events" ON public.audit_events;
END $$;

CREATE POLICY "Users can view their own audit events"
ON public.audit_events FOR SELECT TO authenticated
USING (actor_id = auth.uid());

CREATE POLICY "Users can insert audit events"
ON public.audit_events FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

-- Prevent UPDATE or DELETE (Append-Only)
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is an append-only log. Updates and deletes are not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON public.audit_events;
CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON public.audit_events;
CREATE TRIGGER trg_prevent_audit_delete
  BEFORE DELETE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.external_apply_queue TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
