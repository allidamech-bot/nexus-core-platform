export function parseNexusIgnore(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export function isPathIgnored(path: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    if (pattern.endsWith("/")) {
      if (path.startsWith(pattern) || path.includes(`/${pattern}`)) {
        return true;
      }
    } else if (path.includes(pattern)) {
      return true;
    }
  }
  return false;
}
