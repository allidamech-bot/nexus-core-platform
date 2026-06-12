-- Lovable publish security gate: explicitly block user_roles self-insert escalation.
--
-- Keep RLS enabled and add a restrictive INSERT guard so authenticated users cannot
-- grant themselves admin privileges. Service-role operations and the SECURITY
-- DEFINER admin bootstrap path remain outside normal authenticated self-insert.

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_restrict_insert_admin_only" on public.user_roles;

create policy "user_roles_restrict_insert_admin_only"
on public.user_roles
as restrictive
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.is_admin(auth.uid())
  and not (
    user_id = auth.uid()
    and role = 'admin'
  )
);

comment on policy "user_roles_restrict_insert_admin_only" on public.user_roles is
  'Prevents user_roles_self_insert privilege escalation. Authenticated users cannot grant themselves admin; admin/service bootstrap is handled by admin policy, service role, or sync_admin_role_from_email.';
