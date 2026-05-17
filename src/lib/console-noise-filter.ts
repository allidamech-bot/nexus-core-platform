const NOISE_PATTERNS = [
  /checking for app updates/i,
  /app update check/i,
  /err_name_not_resolved/i,
  /err_quic_protocol_error/i,
  /firebase.*token/i,
  /api\.lovable\.dev/i,
  /lovable.*preview/i,
];

const THROTTLE_MS = 60_000;
const seenAt = new Map<string, number>();

function messageFromArgs(args: unknown[]) {
  return args
    .map((arg) => {
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

function matchedNoiseKey(message: string) {
  return NOISE_PATTERNS.find((pattern) => pattern.test(message))?.source ?? null;
}

function installConsoleNoiseFilter() {
  if (typeof window === "undefined") return;

  const globalKey = "__nexusConsoleNoiseFilterInstalled__";
  const globalObject = window as Window & { [globalKey]?: boolean };
  if (globalObject[globalKey]) return;
  globalObject[globalKey] = true;

  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  function shouldEmit(args: unknown[]) {
    const message = messageFromArgs(args);
    const key = matchedNoiseKey(message);
    if (!key) return true;

    const now = Date.now();
    const lastSeen = seenAt.get(key) ?? 0;
    if (now - lastSeen < THROTTLE_MS) return false;

    seenAt.set(key, now);
    return true;
  }

  console.log = (...args: unknown[]) => {
    if (shouldEmit(args)) original.log(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (shouldEmit(args)) original.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    if (shouldEmit(args)) original.error(...args);
  };
}

installConsoleNoiseFilter();
