import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  applyCorrelationHeader,
  getRequestCorrelationId,
  safeErrorLog,
  withLogContext,
} from "./lib/safeLogging";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(correlationId?: string): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(correlationId ? { "x-correlation-id": correlationId } : {}),
    },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  correlationId: string,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(
    "[server] catastrophic SSR response",
    withLogContext({ correlationId }, safeErrorLog(consumeLastCapturedError() ?? new Error(body))),
  );
  return brandedErrorResponse(correlationId);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const correlationId = getRequestCorrelationId(request);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return applyCorrelationHeader(
        await normalizeCatastrophicSsrResponse(response, correlationId),
        correlationId,
      );
    } catch (error) {
      console.error(
        "[server] request failed",
        withLogContext({ correlationId }, safeErrorLog(error)),
      );
      return brandedErrorResponse(correlationId);
    }
  },
};
