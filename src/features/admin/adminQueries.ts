import { useQuery } from "@tanstack/react-query";
import { getAdminDashboardData, getIsAdmin } from "./adminService";

export const adminKeys = {
  isAdmin: (userId: string | null | undefined) =>
    ["admin", "is-admin", userId ?? "anonymous"] as const,
  dashboard: (userId: string | null | undefined) =>
    ["admin", "dashboard", userId ?? "anonymous"] as const,
};

export function useIsAdminQuery(enabled = true, userId?: string | null) {
  return useQuery({
    enabled: enabled && Boolean(userId),
    queryKey: adminKeys.isAdmin(userId),
    queryFn: getIsAdmin,
    retry: false,
  });
}

export function useAdminDashboardQuery(
  enabled: boolean,
  userId?: string | null,
  correlationId?: string,
) {
  return useQuery({
    enabled: enabled && Boolean(userId),
    queryKey: [...adminKeys.dashboard(userId), correlationId ?? "no-correlation"] as const,
    queryFn: () => getAdminDashboardData(correlationId),
    retry: false,
  });
}
