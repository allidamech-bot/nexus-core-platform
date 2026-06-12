-- Lovable publish security gate: explicitly block user_roles self-insert escalation.
--
-- Existing user_roles write policy is admin-only, but security scanners can still flag
-- the table when no explicit INSERT guard documents the self-escalation boundary.
-- Service-role operations and the SECURITY DEFINER admin bootstrap trigger run outside
-- normal authenticated self-insert and remain the supported bootstrap path.

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
