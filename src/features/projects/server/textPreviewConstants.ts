export const TEXT_PREVIEW_LIMITS = {
  maxFileBytes: 96 * 1024,
  maxTotalBytes: 384 * 1024,
  maxPreviewChars: 4_000,
  maxContextChars: 8_000,
  maxPreviewRows: 24,
  maxContextPreviews: 6,
  maxLineLength: 1_200,
  maxLines: 600,
} as const;

export const ALLOWLISTED_TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "json",
  "yaml",
  "yml",
  "toml",
  "ts",
  "tsx",
  "js",
  "jsx",
  "py",
  "dart",
  "java",
  "rs",
  "go",
  "sql",
  "html",
  "css",
  "scss",
]);

export const ALLOWLISTED_TEXT_FILENAMES = new Set([".env.example", ".gitignore"]);

export const BLOCKED_PREVIEW_SEGMENTS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "vendor",
  "coverage",
  ".cache",
  ".turbo",
  ".vercel",
]);
