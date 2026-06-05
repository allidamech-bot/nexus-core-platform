import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/projects/ai-provider-readiness")({
  server: {
    handlers: {
      GET: async () => {
        const configured = Boolean(process.env.LOVABLE_API_KEY);

        return Response.json({
          configured,
          provider: "lovable",
          model: "google/gemini-3-flash-preview",
          status: configured ? "ready" : "blocked",
          code: configured ? null : "BLOCKED_AI_PROVIDER_REQUIRED",
          message: configured
            ? "AI provider is configured for governed patch preview generation."
            : "AI provider configuration is required before AI patch preview can run.",
          requiredEnv: configured ? [] : ["LOVABLE_API_KEY"],
        });
      },
    },
  },
});
