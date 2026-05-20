type LoggableError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
  name?: string;
  status?: number;
  statusCode?: number;
};

const SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /\b(?:access|refresh|id)_token["'\s:=]+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:api[_-]?key|service[_-]?role|authorization|cookie|jwt)["'\s:=]+[^\s"',}]+/gi,
  /\bLovable-API-Key["'\s:=]+[^\s"',}]+/gi,
];

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
