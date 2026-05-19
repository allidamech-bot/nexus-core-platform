import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { useAdminDashboardQuery, useIsAdminQuery } from "@/features/admin/adminQueries";
import { useAuth } from "@/lib/auth";
import { recordAuditEvent } from "@/features/governance/governanceService";

export const Route = createFileRoute("/app/admin")({
  component: AdminRoute,
});

function AdminRoute() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const {
    data: isAdmin = false,
    isLoading: checkingAdmin,
    isError,
  } = useIsAdminQuery(Boolean(userId), userId);
  const { data, isLoading: loadingDashboard } = useAdminDashboardQuery(isAdmin, userId);

  useEffect(() => {
    if (!isAdmin || !session?.user.id) return;
    recordAuditEvent({
      userId: session.user.id,
      actorUserId: session.user.id,
      eventType: "admin_dashboard_viewed",
      payload: { route: "/app/admin" },
    }).catch(() => {});
  }, [isAdmin, session?.user.id]);

  if (checkingAdmin) {
    return (
      <div className="grid flex-1 place-items-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="grid flex-1 place-items-center bg-background p-8">
        <div className="max-w-md text-center">
          <ShieldAlert className="mx-auto mb-4 size-6 text-destructive" />
          <h1 className="text-xl font-semibold">Admin access could not be verified.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The admin control plane is blocked until role verification succeeds.
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/app" replace />;
  }

  if (loadingDashboard || !data) {
    return (
      <div className="grid flex-1 place-items-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <AdminDashboard data={data} />;
}
