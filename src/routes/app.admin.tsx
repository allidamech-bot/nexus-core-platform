import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { useAdminDashboardQuery, useIsAdminQuery } from "@/features/admin/adminQueries";

export const Route = createFileRoute("/app/admin")({
  component: AdminRoute,
});

function AdminRoute() {
  const { data: isAdmin = false, isLoading: checkingAdmin, isError } = useIsAdminQuery();
  const { data, isLoading: loadingDashboard } = useAdminDashboardQuery(isAdmin);

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
