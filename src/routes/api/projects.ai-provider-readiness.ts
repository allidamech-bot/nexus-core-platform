import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { getProviderRegistry } from "@/lib/provider-registry";

function isDeveloperMode(request: Request): boolean {
  const devHeader = request.headers.get("x-developer-mode");
  return devHeader === "true" || process.env.NODE_ENV !== "production";
}

export const Route = createFileRoute("/api/projects/ai-provider-readiness")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const providers = getProviderRegistry();
        const configuredProviders = providers.filter((p) => p.status === "configured");
        const hasConfiguredProvider = configuredProviders.length > 0;

        const baseResponse = {
          configured: hasConfiguredProvider,
          provider: "nexus-core-ai",
          model: configuredProviders[0]?.defaultModel || "unknown",
          status: hasConfiguredProvider ? "ready" : "blocked",
          code: hasConfiguredProvider ? null : "BLOCKED_AI_PROVIDER_REQUIRED",
          message: hasConfiguredProvider
            ? "Nexus Core AI is ready for governed patch preview generation."
            : "AI provider configuration is required before AI patch preview can run.",
          requiredEnv: hasConfiguredProvider
            ? []
            : ["GEMINI_API_KEY", "OPENROUTER_FREE_API_KEY", "GROQ_API_KEY", "OLLAMA_BASE_URL"],
        };

        if (!isDeveloperMode(request)) {
          return Response.json(baseResponse);
        }

        const missingProviders = providers.filter((p) => p.status === "missing_key");
        return Response.json({
          ...baseResponse,
          _diagnostics: {
            totalProviders: providers.length,
            configuredCount: configuredProviders.length,
            missingKeyCount: missingProviders.length,
            providers: providers.map((p) => ({
              id: p.id,
              status: p.status,
              capabilities: p.capabilities,
              priority: p.priority,
              freeTier: p.freeTier,
              hasKey: p.status === "configured",
            })),
          },
        });
      },
    },
  },
});