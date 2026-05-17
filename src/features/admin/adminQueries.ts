import { useQuery } from "@tanstack/react-query";
import { getAdminDashboardData, getIsAdmin } from "./adminService";

export const adminKeys = {
  isAdmin: ["admin", "is-admin"] as const,
  dashboard: ["admin", "dashboard"] as const,
};

export function useIsAdminQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: adminKeys.isAdmin,
    queryFn: getIsAdmin,
    retry: false,
  });
}

export function useAdminDashboardQuery(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: adminKeys.dashboard,
    queryFn: getAdminDashboardData,
    retry: false,
  });
}
