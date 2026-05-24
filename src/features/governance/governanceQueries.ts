import { useQuery } from "@tanstack/react-query";
import { getUsageOverview } from "./governanceService";

export const governanceKeys = {
  all: ["governance"] as const,
  usage: (userId: string) => ["governance", "usage", userId] as const,
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
