import type { ProjectWritebackRequest } from "../projects/projectWritebackRequestService";
import type { ProjectWorkingCopyFile } from "../projects/projectWorkingCopyService";

export interface PolicyEvaluationResult {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
}

import type { WritebackApproval } from "./tenantTypes";

/**
 * Validates that the request has the required minimum number of approvals.
 * @param request The writeback request to evaluate.
 * @param approvals The list of approvals for the request.
 * @param requiredCount The minimum number of approvals needed.
 */
export function validateApprovalCount(
  request: ProjectWritebackRequest,
  approvals: WritebackApproval[],
  requiredCount: number = 1,
): PolicyEvaluationResult {
  const validApprovals = approvals.filter((a) => a.status === "approved");
  const approvalsFound = validApprovals.length;

  if (approvalsFound < requiredCount) {
    return {
      allowed: false,
      blockers: [`Requires at least ${requiredCount} human approval(s). Found ${approvalsFound}.`],
      warnings: [],
    };
  }

  return { allowed: true, blockers: [], warnings: [] };
}

/**
 * Blocks direct AI deployment that attempts to bypass human review.
 * @param request The writeback request.
 * @param workingCopyCreatorId The ID of the user who created the working copy.
 */
export function blockDirectAIDeployment(
  request: ProjectWritebackRequest,
  workingCopyCreatorId: string,
): PolicyEvaluationResult {
  if (request.status !== "approved" || !(request as any).reviewedBy) {
    return {
      allowed: false,
      blockers: ["Direct AI deployment is strictly blocked. Human review is required."],
      warnings: [],
    };
  }

  const isReviewedByAI = (request as any).reviewedBy === "system-ai-agent-id";
  if (isReviewedByAI) {
    return {
      allowed: false,
      blockers: ["Approval cannot be granted by an AI agent. Human review is required."],
      warnings: [],
    };
  }

  return { allowed: true, blockers: [], warnings: [] };
}

/**
 * Validates that the patched files do not modify restricted or critical system files.
 * @param files The array of working copy files to evaluate.
 * @param restrictedPatterns Array of regex patterns for restricted files.
 */
export function validateRestrictedFiles(
  files: ProjectWorkingCopyFile[],
  restrictedPatterns: RegExp[] = [/\.env$/, /wrangler\.toml$/, /^infra\//, /^config\//],
): PolicyEvaluationResult {
  const blockers: string[] = [];

  for (const file of files) {
    if (!file.changed) continue;

    for (const pattern of restrictedPatterns) {
      if (pattern.test(file.filePath)) {
        blockers.push(`Modifying restricted file is not allowed: ${file.filePath}`);
        break;
      }
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings: [],
  };
}

/**
 * Evaluates all governance policies before allowing a Working Copy into the External Apply Queue.
 */
export function evaluateWorkingCopyForApply(
  request: ProjectWritebackRequest,
  approvals: WritebackApproval[],
  files: ProjectWorkingCopyFile[],
  workingCopyCreatorId: string,
  targetEnv: "production" | "staging" | "development" = "production",
): PolicyEvaluationResult {
  const requiredApprovals = request.requiredApprovals ?? (targetEnv === "production" ? 2 : 1);

  const approvalEval = validateApprovalCount(request, approvals, requiredApprovals);
  const directAiEval = blockDirectAIDeployment(request, workingCopyCreatorId);
  const filesEval = validateRestrictedFiles(files);

  const blockers = [...approvalEval.blockers, ...directAiEval.blockers, ...filesEval.blockers];

  const warnings = [...approvalEval.warnings, ...directAiEval.warnings, ...filesEval.warnings];

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
  };
}
