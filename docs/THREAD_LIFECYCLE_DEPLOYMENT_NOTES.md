# Thread Lifecycle Deployment Notes

Phase 45 adds non-destructive session archiving so active-thread quota can be freed without deleting threads or messages.

## Compatibility

The UI is defensive if it reaches an environment before the migration: the `/app` recent-session query falls back when lifecycle columns are missing, and the archive action is hidden unless the thread row includes lifecycle fields.

The archive capability still requires the migration. Apply the approved migration before publishing the Lovable UI when the goal is to enable session archiving in production.

## Safe Order

1. Apply `supabase/migrations/20260523090000_thread_lifecycle_archive.sql` through the approved migration flow.
2. Do not run manual production SQL outside the approved migration flow.
3. Verify `public.threads` has `status`, `archived_at`, and `archived_by`.
4. Publish the Lovable production app.
5. Run the post-deploy smoke checklist.

## Post-Deploy Smoke

- Open an existing active session.
- Archive the session and confirm it returns to `/app`.
- Confirm active-thread quota frees.
- Create a new Codex-style task from `/app`.
- Confirm the first message persists and navigation reaches `/app/$threadId`.
- Send a safe chat smoke and confirm `/api/chat` returns 200.
- Confirm logout and `/app/admin` protections still work.
