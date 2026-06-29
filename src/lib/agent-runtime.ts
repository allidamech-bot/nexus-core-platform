import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { generateWithNexusCore } from "./nexus-core-ai";
import { buildContextBundle, selectRelevantFiles } from "./agent-tools";
import {
  classifyTask,
  classifyIntent,
  type AgentTaskType,
  type AgentIntent,
} from "./agent-classifier";
import {
  classifyRisk,
  generateProposalId,
  buildUnifiedDiff,
  determineApprovalRequirement,
} from "./agent-risk-classifier";
import type {
  AgentSessionInput,
  AgentSessionResult,
  AgentLifecycleStage,
  AgentPlan,
  AgentValidationPlan,
  AgentFinalReport,
  ProposedChange,
  AgentContextBundle,
  PatchProposal,
  PatchProposalBundle,
} from "./agent-types";
import type { TaskType, UnifiedGenerateInput, UnifiedGenerateResult } from "./provider-types";
import type { ExecutionTrace } from "./provider-router";

const LIFECYCLE_STAGES: AgentLifecycleStage[] = [
  "user_instruction",
  "task_classification",
  "context_gathering",
  "planning",
  "proposed_changes",
  "validation_plan",
  "final_report",
];

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("```json")) {
    const jsonText = trimmed.slice(7).replace(/```$/, "").trim();
    return JSON.parse(jsonText);
  }
  if (trimmed.startsWith("```")) {
    const firstNewline = trimmed.indexOf("\n");
    if (firstNewline === -1) return JSON.parse(trimmed);
    const jsonText = trimmed
      .slice(firstNewline + 1)
      .replace(/```$/, "")
      .trim();
    return JSON.parse(jsonText);
  }
  return JSON.parse(trimmed);
}

function looksLikeUnifiedDiff(text: string): boolean {
  const lines = text.split("\n");
  return (
    lines.length > 1 &&
    lines.some((l) => l.startsWith("---")) &&
    lines.some((l) => l.startsWith("+++"))
  );
}

function mapTaskToProviderTask(taskType: AgentTaskType): TaskType {
  const mapping: Record<AgentTaskType, TaskType> = {
    coding: "coding",
    planning: "planning",
    summarization: "summarization",
    validation_explanation: "analysis",
    project_review: "analysis",
    refactor: "coding",
    bugfix: "coding",
  };
  return mapping[taskType];
}

async function generatePlan(
  taskType: AgentTaskType,
  instruction: string,
  context: AgentContextBundle,
): Promise<AgentPlan> {
  const relevantFiles = selectRelevantFiles(context, instruction);

  const fileContext = relevantFiles
    .slice(0, 10)
    .map((f) => `File: ${f.path}\n${f.previewText.slice(0, 2000)}`)
    .join("\n\n");

  const prompt = `You are Nexus Core AI, a helpful coding assistant. Generate a plan for the following task.

Task type: ${taskType}
Instruction: ${instruction}

Project context (selected files):
${fileContext.slice(0, 10000)}

Return a JSON plan with:
- summary: brief overview
- steps: array of {order, description, targetFiles, estimatedComplexity}

Respond with JSON only.`;

  const input: UnifiedGenerateInput = {
    taskType: mapTaskToProviderTask(taskType),
    prompt,
    system: "Return valid JSON only. No markdown.",
  };

  const result = await generateWithNexusCore(input, false);

  if (result.status === "error") {
    return {
      summary: "Could not generate plan due to AI error.",
      steps: [],
    };
  }

  try {
    const parsed = extractJsonFromText(result.text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        summary: String(
          (parsed as Record<string, unknown>).summary || "Plan generated successfully.",
        ),
        steps: Array.isArray((parsed as Record<string, unknown>).steps)
          ? ((parsed as Record<string, unknown>).steps as Record<string, unknown>[]).map((s) => ({
              order: typeof s.order === "number" ? s.order : 0,
              description: String(s.description || ""),
              targetFiles: Array.isArray(s.targetFiles) ? s.targetFiles.map(String) : [],
              estimatedComplexity: ["low", "medium", "high"].includes(String(s.estimatedComplexity))
                ? (s.estimatedComplexity as "low" | "medium" | "high")
                : "medium",
            }))
          : [],
      };
    }
  } catch {
    // fallback to raw text below
  }

  return {
    summary:
      result.status === "success"
        ? result.text.slice(0, 500)
        : "Could not generate plan due to AI error.",
    steps: [],
  };
}

async function generateProposedChanges(
  taskType: AgentTaskType,
  instruction: string,
  context: AgentContextBundle,
  plan?: AgentPlan,
): Promise<ProposedChange[]> {
  const relevantFiles = selectRelevantFiles(context, instruction);
  const planText = plan?.summary || "";

  const fileContext = relevantFiles
    .slice(0, 5)
    .map((f) => `File: ${f.path}\n${f.previewText.slice(0, 3000)}`)
    .join("\n\n");

  const prompt = `You are Nexus Core AI. Analyze the task and suggest changes.

Task: ${instruction}
Task type: ${taskType}
Plan summary: ${planText}

Project files:
${fileContext.slice(0, 15000)}

Guidelines:
- For "project_review": suggest multiple improvements across UI, structure, and safety.
- For "bugfix": suggest minimal, targeted fixes.
- For "refactor": suggest structural improvements with clear before/after.
- For "ui_improvement": focus on components, styling, and layout.
- For "coding": implement the requested code change.
- Preserve the user's language (including Arabic) in reasons and summaries.

Return JSON array of changes:
[{filePath, reason, suggestedPatch, riskLevel, changeType}]

For content changes: suggestedPatch should be the proposed FINAL file content (not a diff).
For diff-only proposals: set changeType to "diff" and suggestedPatch should be unified diff text.

Only suggest changes - do not claim files were written.
Respond with JSON only.`;

  const input: UnifiedGenerateInput = {
    taskType: mapTaskToProviderTask(taskType),
    prompt,
    system: "Return valid JSON array only. No markdown.",
  };

  const result = await generateWithNexusCore(input, false);

  if (result.status === "error") {
    return [];
  }

  try {
    const parsed = extractJsonFromText(result.text);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c: Record<string, unknown>) => ({
      filePath: String(c.filePath || ""),
      reason: String(c.reason || ""),
      suggestedPatch: String(c.suggestedPatch || ""),
      riskLevel: ["low", "medium", "high"].includes(String(c.riskLevel))
        ? (c.riskLevel as "low" | "medium" | "high")
        : "medium",
      changeType: c.changeType === "diff" ? "diff" : "content",
    }));
  } catch {
    return [];
  }
}

function convertToPatchProposals(
  changes: ProposedChange[],
  context: AgentContextBundle | undefined,
  instruction: string,
): PatchProposalBundle {
  const proposals: PatchProposal[] = changes.map((change, index) => {
    const risk = classifyRisk(change.filePath, "update", instruction);
    const approval = determineApprovalRequirement(risk.risk_level);

    const beforePreview =
      context?.previews.find((p) => p.path === change.filePath)?.previewText || "";

    const isDiff = change.changeType === "diff" || looksLikeUnifiedDiff(change.suggestedPatch);

    const afterPreview = isDiff
      ? "[Diff preview only — clean file preview unavailable]"
      : change.suggestedPatch.slice(0, 500);
    const unifiedDiff = isDiff
      ? change.suggestedPatch
      : buildUnifiedDiff(beforePreview, afterPreview, change.filePath);

    return {
      proposal_id: generateProposalId(change.filePath, index),
      target_file_path: change.filePath,
      change_summary: change.reason,
      risk_level: risk.risk_level,
      change_type: "update",
      before_preview: beforePreview.slice(0, 500),
      after_preview: afterPreview,
      unified_diff: unifiedDiff,
      approval_required: approval.required,
      approval_status: approval.status,
      blocked_reason: approval.blocked_reason,
      risk_reasons: risk.reasons,
      validation_suggestions: [],
      agent_confidence: risk.risk_level === "low" ? 0.9 : risk.risk_level === "medium" ? 0.7 : 0.5,
    };
  });

  const summary = {
    total: proposals.length,
    low: proposals.filter((p) => p.risk_level === "low").length,
    medium: proposals.filter((p) => p.risk_level === "medium").length,
    high: proposals.filter((p) => p.risk_level === "high").length,
    blocked: proposals.filter((p) => p.risk_level === "blocked").length,
    requires_approval: proposals.filter((p) => p.approval_required).length,
  };

  return { proposals, summary };
}

async function generateValidationPlan(
  taskType: AgentTaskType,
  instruction: string,
  proposedChanges: ProposedChange[],
): Promise<AgentValidationPlan> {
  const changesSummary = proposedChanges
    .slice(0, 5)
    .map((c) => `${c.filePath}: ${c.reason}`)
    .join("\n");

  const prompt = `You are Nexus Core AI. Suggest validation commands for:

Task: ${instruction}
Changes: ${changesSummary}

Return JSON:
{commands: ["npm test", "npm run build"], explanation: "..."}

Suggest safe, non-destructive verification commands only.
Respond with JSON only.`;

  const input: UnifiedGenerateInput = {
    taskType: "analysis",
    prompt,
    system: "Return valid JSON only. No markdown.",
  };

  const result = await generateWithNexusCore(input, false);

  if (result.status === "error") {
    return {
      commands: ["npm run typecheck", "npm run build"],
      explanation: "Default validation: type check and build.",
    };
  }

  try {
    const parsed = JSON.parse(result.text);
    return {
      commands: Array.isArray(parsed.commands) ? parsed.commands.map(String) : [],
      explanation: String(parsed.explanation || ""),
    };
  } catch {
    return {
      commands: ["npm run typecheck", "npm run build"],
      explanation: "Default validation commands.",
    };
  }
}

async function generateFinalReport(
  taskType: AgentTaskType,
  instruction: string,
  plan?: AgentPlan,
  proposedChanges: ProposedChange[] = [],
  patchProposals?: PatchProposalBundle,
  validationPlan?: AgentValidationPlan,
  developerMode = false,
): Promise<{ report: AgentFinalReport; trace?: ExecutionTrace }> {
  const baseRisks: string[] = [];
  for (const proposal of patchProposals?.proposals || []) {
    if (proposal.risk_level === "high" || proposal.risk_level === "blocked") {
      baseRisks.push(`Risk (${proposal.risk_level}) for ${proposal.target_file_path}`);
    }
  }
  if (plan?.steps && plan.steps.some((s) => s.estimatedComplexity === "high")) {
    baseRisks.push("Some plan steps are high complexity");
  }

  const changesText =
    patchProposals?.proposals
      .slice(0, 3)
      .map((p) => `- ${p.target_file_path}: ${p.change_summary}`)
      .join("\n") || "";

  const prompt = `Summarize the execution plan:

Task: ${instruction}
Plan: ${plan?.summary || "N/A"}
Changes: ${changesText || "None suggested"}
Risks: ${baseRisks.slice(0, 3).join(", ") || "None identified"}

Return JSON:
{summary: "...", risks: ["..."]}

Respond with JSON only.`;

  const input: UnifiedGenerateInput = {
    taskType: "summarization",
    prompt,
    system: "Return valid JSON only. No markdown.",
  };

  const result = await generateWithNexusCore(input, developerMode);

  let summary =
    result.status === "success" ? result.text.slice(0, 500) : "Agent session completed.";
  let risks = baseRisks.length > 0 ? baseRisks : ["Review proposed changes before applying"];

  if (result.status === "success") {
    try {
      const parsed = extractJsonFromText(result.text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.summary === "string" && obj.summary.trim()) {
          summary = obj.summary.trim();
        }
        if (Array.isArray(obj.risks)) {
          risks = obj.risks.map((r) => String(r)).filter(Boolean);
        } else if (typeof obj.risks === "string" && obj.risks.trim()) {
          risks = [obj.risks.trim()];
        }
      }
    } catch {
      // keep raw summary as fallback
    }
  }

  return {
    report: {
      summary,
      plan: plan || { summary: "No plan generated.", steps: [] },
      proposedChanges: proposedChanges,
      validationPlan: validationPlan || { commands: [], explanation: "" },
      risks,
    },
    trace: result.trace,
  };
}

async function generateNaturalResponse(
  intent: AgentIntent | undefined,
  instruction: string,
  projectName: string | undefined,
  hasIndexedFiles: boolean,
  developerMode = false,
): Promise<string> {
  if (intent === "greeting") {
    const isArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
      instruction,
    );
    if (isArabic) {
      const projectInfo = projectName ? `على مشروع ${projectName}. ` : "";
      const filesInfo = hasIndexedFiles ? "أقدر أراجع الملفات المفهرسة. " : "";
      return `أهلاً، أنا جاهز ${projectInfo}${filesInfo}ماذا تريد أن أفحص أولاً؟`;
    }
    const projectInfo = projectName ? `on the ${projectName} project. ` : "";
    const filesInfo = hasIndexedFiles ? "I can work with your indexed files. " : "";
    return `Hello! I'm ready ${projectInfo}${filesInfo}What would you like me to examine first?`;
  }

  if (intent === "general_chat") {
    const isArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
      instruction,
    );
    if (isArabic) {
      return projectName
        ? `أفهم طلبك. أنا هنا أساعدك في مشروع ${projectName}.`
        : "كيف يمكنني مساعدتك اليوم؟";
    }
    return projectName
      ? `I understand. I'm here to help with the ${projectName} project.`
      : "I'm ready to help. How can I assist you today?";
  }

  if (
    intent === "project_review" ||
    intent === "patch_request" ||
    intent === "bugfix" ||
    intent === "refactor"
  ) {
    const isArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
      instruction,
    );
    if (isArabic) {
      return projectName
        ? `**فهم المهمة**: طلبك يتعلق بتحليل أو مراجعة مشروع ${projectName}.
**السياق المتاح**: ${hasIndexedFiles ? "تم تحميل ملفات مفهرسة." : "لم يتم فهرسة ملفات بعد."}
**النتيجة**: تم تحضير ملخص التحليل والتقييمات في لوحة الآثار.
**الخطوة التالية**: راجع الخطة والتقارير على الجانب الأيمن للاطلاع على التفاصيل.`
        : `**فهم المهمة**: طلب تحليل أو مراجعة.
**السياق المتاح**: لا توجد مشروع مرتبط بهذه الجلسة.
**ملاحظة**: قم بإرفاق مشروع للحصول على تحليل مبني على محتوى فعلي.`;
    }
    return projectName
      ? `**Understanding**: Your request involves analysis or review of the ${projectName} project.
**Available context**: ${hasIndexedFiles ? "Indexed files are available." : "No indexed files attached yet."}
**Result**: Analysis summary and review artifacts are prepared in the right panel.
**Next step**: Review the plan and reports on the right for full details.`
      : `**Understanding**: Your request involves project review.
**Available context**: No project attached to this session.
**Note**: Attach a project for grounded analysis with actual file content.`;
  }

  const isArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
    instruction,
  );
  return isArabic ? "أنا جاهز للمساعدة." : "Ready to help.";
}

export async function runAgentSession(
  supabase: SupabaseClient<Database>,
  input: AgentSessionInput,
  developerMode = false,
): Promise<AgentSessionResult> {
  const intent = input.intent ?? classifyIntent(input.userInstruction);
  const taskType = classifyTask(input.userInstruction);
  let context: AgentContextBundle | undefined;
  let plan: AgentPlan | undefined;
  let proposedChanges: ProposedChange[] = [];
  let patchProposals: PatchProposalBundle | undefined;
  let validationPlan: AgentValidationPlan | undefined;

  const stageResults: Partial<Record<AgentLifecycleStage, string>> = {};

  stageResults.task_classification = taskType;

  const shouldGenerateArtifacts = intent !== "greeting" && intent !== "general_chat";

  try {
    context = await buildContextBundle(supabase, input.projectId, input.maxContextBytes);
    stageResults.context_gathering = `Collected ${context.files.length} files, ${context.previews.length} previews`;
  } catch (e) {
    stageResults.context_gathering = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }

  const hasIndexedFiles = context?.files.length ? context.files.length > 0 : false;
  const naturalResponse = await generateNaturalResponse(
    intent,
    input.userInstruction,
    context?.projectName,
    hasIndexedFiles,
    developerMode,
  );

  if (shouldGenerateArtifacts && context) {
    plan = await generatePlan(taskType, input.userInstruction, context);
    stageResults.planning = plan ? "Plan generated" : "Plan generation failed";
  }

  if (shouldGenerateArtifacts && context && plan) {
    proposedChanges = await generateProposedChanges(taskType, input.userInstruction, context, plan);
    stageResults.proposed_changes = `${proposedChanges.length} changes proposed`;
  }

  if (shouldGenerateArtifacts && proposedChanges.length > 0 && context) {
    patchProposals = convertToPatchProposals(proposedChanges, context, input.userInstruction);
  }

  if (shouldGenerateArtifacts && proposedChanges.length > 0) {
    validationPlan = await generateValidationPlan(taskType, input.userInstruction, proposedChanges);
    stageResults.validation_plan = `${validationPlan.commands.length} commands suggested`;
  }

  let finalReport: AgentFinalReport | undefined;
  let executionTrace: ExecutionTrace | undefined;

  if (shouldGenerateArtifacts) {
    const finalReportResult = await generateFinalReport(
      taskType,
      input.userInstruction,
      plan,
      proposedChanges,
      patchProposals,
      validationPlan,
      developerMode,
    );
    finalReport = finalReportResult.report;
    executionTrace = finalReportResult.trace;
    stageResults.final_report = "Generated";
  }

  return {
    stage: "final_report",
    taskType,
    providerUsed: "nexus-core-ai",
    modelUsed: "auto-selected",
    status: "success",
    context,
    plan: shouldGenerateArtifacts ? plan : undefined,
    proposedChanges: shouldGenerateArtifacts ? proposedChanges : undefined,
    validationPlan: shouldGenerateArtifacts ? validationPlan : undefined,
    finalReport,
    patchProposals,
    executionTrace: developerMode ? executionTrace : undefined,
    naturalResponse,
  };
}
