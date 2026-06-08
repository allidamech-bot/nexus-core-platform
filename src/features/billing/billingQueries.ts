import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchBillingPlans, initiateCheckoutSession } from "./billingService";

export function useBillingPlansQuery() {
  return useQuery({
    queryKey: ["billingPlans"],
    queryFn: fetchBillingPlans,
  });
}

export function useCheckoutSessionMutation() {
  return useMutation({
    mutationFn: initiateCheckoutSession,
  });
}
