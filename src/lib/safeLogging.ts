type LoggableError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
  name?: string;
  status?: number;
  statusCode?: number;
};

export type CorrelationContext = {
  correlationId: string;
};

const SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /\b(?:access|refresh|id)_token["'\s:=]+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:api[_-]?key|service[_-]?role|authorization|cookie|jwt)["'\s:=]+[^\s"',}]+/gi,
  /\bLovable-API-Key["'\s:=]+[^\s"',}]+/gi,
];

const CORRELATION_ID_HEADER = "x-correlation-id";

export function createCorrelationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getRequestCorrelationId(request: Request): string {
  const incoming = request.headers.get(CORRELATION_ID_HEADER)?.trim();
  if (incoming && /^[a-zA-Z0-9_.:-]{8,120}$/.test(incoming)) return incoming;
  return createCorrelationId();
}

export function withCorrelationHeader(request: Request, correlationId: string): Request {
  const headers = new Headers(request.headers);
  headers.set(CORRELATION_ID_HEADER, correlationId);
  return new Request(request, { headers });
}

export function applyCorrelationHeader(response: Response, correlationId: string): Response {
  const headers = new Headers(response.headers);
  headers.set(CORRELATION_ID_HEADER, correlationId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function withLogContext<T extends Record<string, unknown>>(
  context: CorrelationContext,
  fields?: T,
): CorrelationContext & T {
  return { correlationId: context.correlationId, ...(fields ?? ({} as T)) };
}

function redactText(value: string) {
  return SECRET_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, "[redacted]"),
    value,
  ).slice(0, 240);
}

function asLoggableError(error: unknown): LoggableError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const record = error as Record<string, unknown>;
    return {
      code: typeof record.code === "string" ? record.code : undefined,
      details: typeof record.details === "string" ? record.details : undefined,
      hint: typeof record.hint === "string" ? record.hint : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
      name: typeof record.name === "string" ? record.name : undefined,
      status: typeof record.status === "number" ? record.status : undefined,
      statusCode: typeof record.statusCode === "number" ? record.statusCode : undefined,
    };
  }
  return { message: String(error ?? "Unknown error") };
}

export function safeErrorLog(error: unknown): LoggableError {
  const loggable = asLoggableError(error);
  return Object.fromEntries(
    Object.entries(loggable)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, typeof value === "string" ? redactText(value) : value]),
  ) as LoggableError;
}

export function safeErrorMessage(error: unknown, fallback = "Unknown error") {
  return safeErrorLog(error).message ?? fallback;
}
