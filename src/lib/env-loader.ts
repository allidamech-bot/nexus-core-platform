import fs from "fs";
import path from "path";

const ENV_PATHS = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), ".env.local")];

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) return null;

  const key = trimmed.slice(0, eqIndex).trim();
  if (!key) return null;

  let value = trimmed.slice(eqIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function loadEnvFile(filePath: string): void {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const rawLine of content.split("\n")) {
      const parsed = parseEnvLine(rawLine);
      if (parsed && !(parsed[0] in process.env)) {
        process.env[parsed[0]] = parsed[1];
      }
    }
  } catch {
    // File doesn't exist or is not readable — safe to ignore.
  }
}

for (const envPath of ENV_PATHS) {
  loadEnvFile(envPath);
}
