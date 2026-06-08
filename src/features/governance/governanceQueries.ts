import { useQuery } from "@tanstack/react-query";
import { getUsageOverview } from "./governanceService";
import { supabase } from "@/integrations/supabase/client";

export const governanceKeys = {
  all: ["governance"] as const,
  usage: (userId: string) => ["governance", "usage", userId] as const,
  pendingQuorum: ["governance", "pendingQuorum"] as const,
};

export function useUsageOverviewQuery(userId: string | null) {
  return useQuery({
    enabled: Boolean(userId),
    queryKey: userId ? governanceKeys.usage(userId) : ["governance", "usage", "disabled"],
    queryFn: () => {
      if (!userId) throw new Error("User id required.");
      return getUsageOverview(userId);
    },
    staleTime: 30_000,
  });
}

export function usePendingQuorumCountQuery() {
  return useQuery({
    queryKey: governanceKeys.pendingQuorum,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("project_writeback_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_quorum");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });
}
