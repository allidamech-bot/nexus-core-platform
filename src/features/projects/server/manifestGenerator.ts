import type { ProjectManifest } from "../types";
import { ZIP_MANIFEST_LIMITS } from "./zipManifestConstants";
import { detectStackFromPaths } from "./stackDetector";
import type { ZipInventoryResult } from "./zipCentralDirectory";

export function generateProjectManifest(inventory: ZipInventoryResult): ProjectManifest {
  const paths = inventory.files.map((file) => file.path);
  const stack = detectStackFromPaths(paths);
  const directoryCounts = new Map<string, number>();

  for (const file of inventory.files) {
    const parts = file.path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      const directory = parts.slice(0, index).join("/");
      directoryCounts.set(directory, (directoryCounts.get(directory) ?? 0) + 1);
    }
  }

  const directories = Array.from(directoryCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, ZIP_MANIFEST_LIMITS.maxDirectoriesInSummary)
    .map(([path, file_count]) => ({ path, file_count }));

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    file_count: inventory.files.length,
    directory_count: inventory.directoryCount,
    total_size_bytes: inventory.totalSizeBytes,
    skipped_file_count: Object.values(inventory.skipped).reduce((sum, count) => sum + count, 0),
    skipped_reasons: inventory.skipped,
    languages: stack.languages,
    frameworks: stack.frameworks,
    package_managers: stack.packageManagers,
    root_config_files: stack.rootConfigFiles,
    likely_entry_points: stack.likelyEntryPoints,
    directories,
    stack_hints: stack.stackHints,
  };
}
