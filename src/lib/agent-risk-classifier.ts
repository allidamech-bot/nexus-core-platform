import type { PatchProposal, PatchChangeType, ApprovalStatus } from "./agent-types";

const BLOCKED_PATH_PATTERNS = [
  "supabase/migrations",
  "migrations/",
  "-migration.sql",
  ".supabase",
  "auth",
  "permissions",
  "rls",
  "policies",
  "@auth",
];

const HIGH_RISK_PATTERNS = [
  "billing",
  "stripe",
  "payment",
  "secrets",
  ".env",
  "api_key",
  "apikey",
  "export",
  "pdf",
  "writeback",
  "@export",
  "process.env",
  "process.env.",
  "SUPABASE_SERVICE_ROLE",
  "STRIPE_SECRET",
  "OPENAI_API_KEY",
];

const MEDIUM_RISK_PATTERNS = [
  "package.json",
  "package-lock.json",
  "tsconfig",
  "vite.config",
  "tailwind.config",
  "middleware",
  "server.ts",
  "api/",
  "routes/api",
];

export function classifyRisk(
  filePath: string,
  changeType: PatchChangeType,
  instruction: string,
): { risk_level: "low" | "medium" | "high" | "blocked"; reasons: string[] } {
  const filePathLower = filePath.toLowerCase();
  const instructionLower = instruction.toLowerCase();
  const reasons: string[] = [];

  if (changeType === "delete") {
    const isDestructivePattern =
      filePathLower.includes("delete") || instructionLower.includes("delete");
    if (isDestructivePattern && !instructionLower.includes("explicitly request delete")) {
      return {
        risk_level: "blocked",
        reasons: ["Destructive file deletion blocked unless explicitly requested"],
      };
    }
    reasons.push("File deletion requires careful review");
    return { risk_level: "high", reasons };
  }

  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (filePathLower.includes(pattern) || instructionLower.includes(pattern)) {
      if (!instructionLower.includes(`explicitly request ${pattern}`)) {
        return {
          risk_level: "blocked",
          reasons: [`Changes to ${pattern} are blocked unless explicitly requested`],
        };
      }
    }
  }

  for (const pattern of HIGH_RISK_PATTERNS) {
    if (filePathLower.includes(pattern) || instructionLower.includes(pattern)) {
      reasons.push(`High-risk operation: ${pattern}`);
    }
  }

  if (reasons.length > 0) {
    return { risk_level: "high", reasons };
  }

  for (const pattern of MEDIUM_RISK_PATTERNS) {
    if (filePathLower.includes(pattern)) {
      reasons.push(`Medium-risk operation: ${pattern}`);
      return { risk_level: "medium", reasons };
    }
  }

  if (filePathLower.endsWith(".tsx") || filePathLower.endsWith(".jsx")) {
    return { risk_level: "low", reasons: [] };
  }

  return { risk_level: "medium", reasons: [] };
}

export function generateProposalId(filePath: string, index: number): string {
  const sanitized = filePath.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30);
  return `proposal-${sanitized}-${index}`;
}

export function buildUnifiedDiff(before: string, after: string, filePath: string): string {
  if (!before || !after) {
    return `Diff preview unavailable - insufficient context for ${filePath}`;
  }

  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  let diff = `--- a/${filePath}\n+++ b/${filePath}\n`;

  const maxLen = Math.max(beforeLines.length, afterLines.length);
  let changes = 0;

  for (let i = 0; i < maxLen && changes < 20; i++) {
    const beforeLine = beforeLines[i] || "";
    const afterLine = afterLines[i] || "";

    if (beforeLine !== afterLine) {
      diff += `-${beforeLine}\n+${afterLine}\n`;
      changes++;
    }
  }

  if (changes >= 20) {
    diff += "... (diff truncated for display)\n";
  }

  return diff;
}

export function determineApprovalRequirement(risk_level: "low" | "medium" | "high" | "blocked"): {
  required: boolean;
  status: ApprovalStatus;
  blocked_reason?: string;
} {
  if (risk_level === "blocked") {
    return {
      required: false,
      status: "blocked",
      blocked_reason: "Changes to this path require explicit override",
    };
  }

  if (risk_level === "high") {
    return { required: true, status: "pending_review" };
  }

  if (risk_level === "medium") {
    return { required: true, status: "pending_review" };
  }

  return { required: false, status: "approved" };
}
