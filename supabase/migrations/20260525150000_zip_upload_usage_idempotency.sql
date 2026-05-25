-- Phase 82B: make successful real ZIP upload usage idempotent for new writes.
-- Existing usage rows are left untouched. The partial unique index only applies when
-- idempotency_key is set, so historical duplicate/null rows cannot make this migration fail.

alter table public.usage_events
  add column if not exists idempotency_key text;

create unique index if not exists usage_events_zip_upload_idempotency_idx
  on public.usage_events(user_id, event_type, idempotency_key)
  where event_type = 'project_upload_completed'
    and idempotency_key is not null;
