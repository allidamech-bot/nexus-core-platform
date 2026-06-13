import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { getRequestCorrelationId, withLogContext } from "@/lib/safeLogging";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function createStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  const { default: Stripe } = await import("stripe");
  return new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
}

export const Route = createFileRoute("/api/billing/checkout-session")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        try {
          const authHeader = request.headers.get("Authorization");
          if (!authHeader) return new Response("Unauthorized", { status: 401 });

          const supabase = createClient<Database>(
            process.env.VITE_SUPABASE_URL || "",
            process.env.VITE_SUPABASE_ANON_KEY || "",
            { global: { headers: { Authorization: authHeader } } },
          );

          const {
            data: { user },
            error: authError,
          } = await supabase.auth.getUser();
          if (authError || !user) return new Response("Unauthorized", { status: 401 });

          const { planId } = (await request.json()) as { planId: string };

          const { data: plan, error: planError } = await supabase
            .from("billing_plans")
            .select("stripe_price_id")
            .eq("id", planId)
            .single();

          if (planError || !plan) {
            return new Response(JSON.stringify({ error: "Plan not found" }), { status: 400 });
          }

          if (!plan.stripe_price_id) {
            return new Response(
              JSON.stringify({ error: "Stripe Price ID not configured for this plan" }),
              { status: 400 },
            );
          }

          let stripe;
          try {
            stripe = await createStripeClient();
          } catch (error) {
            console.error(
              "[billing] Stripe configuration error",
              withLogContext({ correlationId }, { message: (error as Error).message }),
            );
            return Response.json(
              {
                error: "billing_not_configured",
                message: "Billing is not configured for this runtime environment.",
                correlationId,
              },
              { status: 503 },
            );
          }

          const { data: sub } = await supabase
            .from("user_subscriptions")
            .select("stripe_customer_id")
            .eq("user_id", user.id)
            .single();

          const customerId = sub?.stripe_customer_id || undefined;
          const origin = request.headers.get("origin") || new URL(request.url).origin;

          const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
            success_url: `${origin}/app/settings?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/app/settings`,
            client_reference_id: user.id,
            subscription_data: {
              metadata: {
                user_id: user.id,
                plan_id: planId,
              },
            },
          });

          return new Response(JSON.stringify({ url: session.url }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error(
            "[billing] Checkout session error",
            withLogContext({ correlationId }, { message: (error as Error).message }),
          );
          return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
        }
      },
    },
  },
});
