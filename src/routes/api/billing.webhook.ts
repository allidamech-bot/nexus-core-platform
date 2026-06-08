import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getRequestCorrelationId, withLogContext } from "@/lib/safeLogging";
import type { Database } from "@/integrations/supabase/types";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_mock";

const supabaseAdmin = createClient<Database>(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

export const Route = createFileRoute("/api/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        try {
          const signature = request.headers.get("stripe-signature");
          if (!signature) {
            return new Response("No signature", { status: 400 });
          }

          const body = await request.text();
          let event: Stripe.Event;

          try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
          } catch (err) {
            console.error("Webhook signature verification failed.", err);
            return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
          }

          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as any;
              const userId = session.client_reference_id;

              if (userId && session.customer && session.subscription) {
                await supabaseAdmin
                  .from("user_subscriptions")
                  .update({
                    stripe_customer_id: session.customer as string,
                    stripe_subscription_id: session.subscription as string,
                  })
                  .eq("user_id", userId);
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated": {
              const subscription = event.data.object as any;
              const userId = subscription.metadata.user_id;
              const planId = subscription.metadata.plan_id;

              if (userId) {
                await supabaseAdmin
                  .from("user_subscriptions")
                  .update({
                    status: subscription.status === "active" ? "active" : subscription.status,
                    current_period_end: new Date(
                      subscription.current_period_end * 1000,
                    ).toISOString(),
                    ...(planId ? { plan_id: planId } : {}),
                  })
                  .eq("user_id", userId);
              }
              break;
            }
            case "customer.subscription.deleted": {
              const subscription = event.data.object as any;
              const userId = subscription.metadata.user_id;
              if (userId) {
                await supabaseAdmin
                  .from("user_subscriptions")
                  .update({
                    status: "canceled",
                    billing_status: "not_configured",
                  })
                  .eq("user_id", userId);
              }
              break;
            }
            case "invoice.payment_succeeded": {
              const invoice = event.data.object as any;
              if (invoice.subscription) {
                await supabaseAdmin
                  .from("user_subscriptions")
                  .update({
                    billing_status: "ok",
                  })
                  .eq("stripe_subscription_id", invoice.subscription as string);
              }
              break;
            }
            case "invoice.payment_failed": {
              const invoice = event.data.object as any;
              if (invoice.subscription) {
                await supabaseAdmin
                  .from("user_subscriptions")
                  .update({
                    billing_status: "requires_attention",
                  })
                  .eq("stripe_subscription_id", invoice.subscription as string);
              }
              break;
            }
          }

          return new Response(JSON.stringify({ received: true }), { status: 200 });
        } catch (error) {
          console.error("Webhook processing failed", error);
          return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
        }
      },
    },
  },
});
