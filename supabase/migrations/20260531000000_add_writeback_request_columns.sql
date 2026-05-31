-- Add missing columns to project_writeback_requests to match TypeScript service layer
ALTER TABLE public.project_writeback_requests
  ADD COLUMN IF NOT EXISTS patch_preview_id uuid null references public.project_patch_previews(id) on delete cascade,
  ADD COLUMN IF NOT EXISTS title text null,
  ADD COLUMN IF NOT EXISTS risk_level text not null default 'medium',
  ADD COLUMN IF NOT EXISTS changed_files_count integer not null default 0,
  ADD COLUMN IF NOT EXISTS warnings jsonb not null default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS blockers jsonb not null default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_summary jsonb not null default '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS review_metadata jsonb not null default '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS review_decision text null;

-- Update existing rows to have a valid patch_preview_id based on their snapshot if needed
-- But since this is a new table and currently failing, we can assume no valid rows exist or we can set it via a join if we need to make it NOT NULL later.
-- For safety on existing rows, we create it as NULL, but then we can alter it if required. Since the table was just added in the previous migration, it's safe to leave as nullable or make it not null if we empty the table first.
-- Let's just make it NOT NULL if the table is empty, or leave it nullable to be safe.
