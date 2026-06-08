import { isSensitivePreviewPath } from "./projectFileTree";
import type { ProjectPatchSnapshot, ProjectPatchSnapshotFile } from "./patchSnapshot";
import type { PatchSandboxIssue } from "./patchSandboxTypes";

export type WritebackRiskLevel = "low" | "medium" | "high" | "blocked";

export interface WritebackRiskSummary {
  riskLevel: WritebackRiskLevel;
  changedFilesCount: number;
  warnings: PatchSandboxIssue[];
  blockers: PatchSandboxIssue[];
}

function issue(
  code: string,
  message: string,
  severity: PatchSandboxIssue["severity"],
  filePath?: string,
): PatchSandboxIssue {
  return { code, message, severity, filePath };
}

function isPackageOrBuildConfig(path: string) {
  const fileName = path.split("/").pop()?.toLowerCase() ?? path.toLowerCase();
  return (
    fileName === "package.json" ||
    fileName.endsWith("-lock.json") ||
    fileName === "pnpm-lock.yaml" ||
    fileName === "yarn.lock" ||
    fileName === "bun.lockb" ||
    fileName === "vite.config.ts" ||
    fileName === "vite.config.js" ||
    fileName === "tsconfig.json" ||
    fileName.startsWith("eslint.config") ||
    fileName.startsWith("tailwind.config")
  );
}

function isSqlOrMigration(path: string) {
  const normalized = path.toLowerCase();
  return normalized.endsWith(".sql") || normalized.includes("/migrations/");
}

function maxRisk(current: WritebackRiskLevel, next: WritebackRiskLevel): WritebackRiskLevel {
  const order: WritebackRiskLevel[] = ["low", "medium", "high", "blocked"];
  return order.indexOf(next) > order.indexOf(current) ? next : current;
}

export function buildWritebackRequestRiskSummary(input: {
  snapshot: ProjectPatchSnapshot;
  files: ProjectPatchSnapshotFile[];
}): WritebackRiskSummary {
  const changedFiles = input.files.filter((file) => file.changed);
  const warnings: PatchSandboxIssue[] = [...input.snapshot.warnings];
  const blockers: PatchSandboxIssue[] = [...input.snapshot.blockers];
  let riskLevel: WritebackRiskLevel = changedFiles.length <= 1 ? "low" : "medium";

  if (input.snapshot.blockers.length > 0) {
    riskLevel = "blocked";
  }
  if (changedFiles.length === 0) {
    blockers.push(issue("no_changed_files", "Snapshot has no changed files.", "blocker"));
    riskLevel = "blocked";
  }
  if (changedFiles.length > 5) {
    riskLevel = maxRisk(riskLevel, "medium");
    warnings.push(issue("many_changed_files", "Snapshot changes multiple files.", "warning"));
  }

  for (const file of changedFiles) {
    if (file.blockers.length > 0) {
      blockers.push(...file.blockers);
      riskLevel = "blocked";
    }
    if (isSensitivePreviewPath(file.filePath)) {
      blockers.push(
        issue(
          "sensitive_file_target",
          "Sensitive files cannot be written back.",
          "blocker",
          file.filePath,
        ),
      );
      riskLevel = "blocked";
    }
    if (isPackageOrBuildConfig(file.filePath)) {
      riskLevel = maxRisk(riskLevel, "high");
      warnings.push(
        issue(
          "package_or_config_change",
          "Package, lockfile, or build configuration changes require heightened review.",
          "warning",
          file.filePath,
        ),
      );
    }
    if (isSqlOrMigration(file.filePath)) {
      riskLevel = maxRisk(riskLevel, "high");
      warnings.push(
        issue(
          "migration_or_sql_change",
          "SQL or migration changes require heightened review.",
          "warning",
          file.filePath,
        ),
      );
    }
    if (file.previewLimited || file.truncated) {
      riskLevel = maxRisk(riskLevel, file.truncated ? "high" : "medium");
      warnings.push(
        issue(
          file.truncated ? "truncated_snapshot_preview" : "preview_limited_snapshot",
          "Snapshot review is limited to indexed preview text.",
          "warning",
          file.filePath,
        ),
      );
    }
    warnings.push(...file.warnings);
  }

  return {
    riskLevel: blockers.length > 0 ? "blocked" : riskLevel,
    changedFilesCount: changedFiles.length,
    warnings,
    blockers,
  };
}
