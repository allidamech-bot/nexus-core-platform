const SECRET_PATTERNS = [
  /([A-Z0-9_]*(?:API|AUTH|ACCESS|SECRET|PRIVATE|TOKEN|KEY|PASSWORD|PASS|CREDENTIAL)[A-Z0-9_]*\s*[:=]\s*)(["']?)[^\s"',}]+/gi,
  /(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g,
  /\b(sk-[A-Za-z0-9_-]{20,})\b/g,
  /\b(xox[baprs]-[A-Za-z0-9-]{20,})\b/g,
  /\b(gh[pousr]_[A-Za-z0-9_]{20,})\b/g,
];

export function containsLikelySecret(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

export function redactSecrets(text: string): { text: string; redacted: boolean } {
  let redacted = false;
  let output = text;

  output = output.replace(SECRET_PATTERNS[0], (_match, prefix: string, quote: string) => {
    redacted = true;
    return `${prefix}${quote}[REDACTED]`;
  });
  output = output.replace(SECRET_PATTERNS[1], () => {
    redacted = true;
    return "[REDACTED PRIVATE KEY]";
  });
  output = output.replace(SECRET_PATTERNS[2], () => {
    redacted = true;
    return "[REDACTED OPENAI-LIKE TOKEN]";
  });
  output = output.replace(SECRET_PATTERNS[3], () => {
    redacted = true;
    return "[REDACTED SLACK-LIKE TOKEN]";
  });
  output = output.replace(SECRET_PATTERNS[4], () => {
    redacted = true;
    return "[REDACTED GITHUB-LIKE TOKEN]";
  });

  return { text: output, redacted };
}
