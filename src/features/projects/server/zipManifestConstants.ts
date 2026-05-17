export const ZIP_MANIFEST_LIMITS = {
  maxArchiveBytes: 50 * 1024 * 1024,
  maxCentralDirectoryBytes: 8 * 1024 * 1024,
  maxFileCount: 5_000,
  maxSingleFileBytes: 15 * 1024 * 1024,
  maxTotalUncompressedBytes: 150 * 1024 * 1024,
  maxPathLength: 512,
  maxDirectoriesInSummary: 80,
} as const;

export const BLOCKED_PATH_SEGMENTS = new Set([
  "..",
  ".git",
  ".hg",
  ".svn",
  "__macosx",
  "node_modules",
  ".next",
  "dist",
  "build",
]);

export const BLOCKED_FILENAMES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

export const DANGEROUS_EXTENSIONS = new Set([
  "bat",
  "cmd",
  "com",
  "dll",
  "dylib",
  "exe",
  "jar",
  "msi",
  "ps1",
  "scr",
  "sh",
  "so",
]);
