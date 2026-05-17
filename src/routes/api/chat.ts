import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

type Body = { messages?: unknown; mode?: string };

const SYSTEM_PROMPT = `You are Nexus Core — an AI operating system for businesses and developers.

Every response MUST be structured into the following markdown sections, in order, with bold section headers. Skip a section only when it is genuinely not applicable.

**Understanding**
A 1–3 sentence restatement of the user's intent.

**Plan**
Numbered list of concrete steps you would take.

**Risks**
Bulleted list of potential risks, regressions, or things to watch. If none, say "No material risks detected."

**Files to inspect or change**
Bulleted list of file paths or module names.

**Proposed actions**
Specific commands, edits, or operations you would execute (in a fenced code block when useful).

**Execution log**
Mock or anticipated execution log lines, one per line in a fenced code block.

**Verification**
Bulleted list of checks: Typecheck, Lint, Build, Tests, Security Scan — with PASSED / WARNING / FAILED / NOT RUN labels.

**Final result**
A concise summary of the outcome and next recommended action.

Tone: precise, senior-engineer, business-grade. Never refuse without giving a structured alternative. Never produce filler.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { messages, mode } = (await request.json()) as Body;
        if (!Array.isArray(messages)) {
          return new Response("Messages required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const system = mode
          ? `${SYSTEM_PROMPT}\n\nActive agent mode: ${mode.toUpperCase()}. Bias the response toward this discipline.`
          : SYSTEM_PROMPT;

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
