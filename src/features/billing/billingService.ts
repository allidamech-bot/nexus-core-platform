import { supabase } from "@/integrations/supabase/client";

export interface BillingPlan {
  id: string;
  name: string;
  status: string;
  monthly_price_cents: number | null;
  stripe_price_id: string | null;
}

export async function fetchBillingPlans(): Promise<BillingPlan[]> {
  const { data, error } = await supabase
    .from("billing_plans")
    .select("*")
    .eq("status", "active")
    .order("id");

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function initiateCheckoutSession(planId: string): Promise<string> {
  const response = await fetch("/api/billing/checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to initiate checkout session");
  }

  const data = await response.json();
  return data.url;
}
