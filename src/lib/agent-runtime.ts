import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { generateWithNexusCore } from "./nexus-core-ai";
import { buildContextBundle, selectRelevantFiles } from "./agent-tools";
import { classifyTask, type AgentTaskType } from "./agent-classifier";
import type {
  AgentSessionInput,
  AgentSessionResult,
  AgentLifecycleStage,
  AgentPlan,
  AgentValidationPlan,
  AgentFinalReport,
  ProposedChange,
  AgentContextBundle,
} from "./agent-types";
import type { TaskType, UnifiedGenerateInput, UnifiedGenerateResult } from "./provider-types";

const LIFECYCLE_STAGES: AgentLifecycleStage[] = [
  "user_instruction",
  "task_classification",
  "context_gathering",
  "planning",
  "proposed_changes",
  "validation_plan",
  "final_report",
];

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

  const result = await generateWithNexusCore(input);

  if (result.status === "error") {
    return {
      summary: "Could not generate plan due to AI error.",
      steps: [],
    };
  }

  try {
    const parsed = JSON.parse(result.text);
    return {
      summary: parsed.summary || "Plan generated successfully.",
      steps: parsed.steps || [],
    };
  } catch {
    return {
      summary: "Plan generated but could not be parsed as JSON.",
      steps: [],
    };
  }
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

  const prompt = `You are Nexus Core AI. Suggest changes to accomplish the task.

Task: ${instruction}
Plan summary: ${planText}

Project files:
${fileContext.slice(0, 15000)}

Return JSON array of changes:
[{filePath, reason, suggestedPatch, riskLevel}]

Only suggest changes - do not claim files were written.
Respond with JSON only.`;

  const input: UnifiedGenerateInput = {
    taskType: mapTaskToProviderTask(taskType),
    prompt,
    system: "Return valid JSON array only. No markdown.",
  };

  const result = await generateWithNexusCore(input);

  if (result.status === "error") {
    return [];
  }

  try {
    const parsed = JSON.parse(result.text);
    return Array.isArray(parsed)
      ? parsed.map((c: Record<string, unknown>) => ({
          filePath: String(c.filePath || ""),
          reason: String(c.reason || ""),
          suggestedPatch: String(c.suggestedPatch || ""),
          riskLevel: (c.riskLevel as "low" | "medium" | "high") || "medium",
        }))
      : [];
  } catch {
    return [];
  }
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

  const result = await generateWithNexusCore(input);

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
  validationPlan?: AgentValidationPlan,
): Promise<AgentFinalReport> {
  const risks: string[] = [];
  for (const change of proposedChanges) {
    if (change.riskLevel === "high") {
      risks.push(`High risk change to ${change.filePath}`);
    }
  }
  if (plan?.steps && plan.steps.some((s) => s.estimatedComplexity === "high")) {
    risks.push("Some plan steps are high complexity");
  }

  const changesText = proposedChanges
    .slice(0, 3)
    .map((c) => `- ${c.filePath}: ${c.reason}`)
    .join("\n");

  const prompt = `Summarize the execution plan:

Task: ${instruction}
Plan: ${plan?.summary || "N/A"}
Changes: ${changesText || "None suggested"}
Risks: ${risks.slice(0, 3).join(", ") || "None identified"}

Return JSON:
{summary: "...", risks: ["..."]}

Respond with JSON only.`;

  const input: UnifiedGenerateInput = {
    taskType: "summarization",
    prompt,
    system: "Return valid JSON only. No markdown.",
  };

  const result = await generateWithNexusCore(input);

  return {
    summary: result.status === "success" ? result.text.slice(0, 500) : "Agent session completed.",
    plan: plan || { summary: "No plan generated.", steps: [] },
    proposedChanges,
    validationPlan: validationPlan || { commands: [], explanation: "" },
    risks: risks.length > 0 ? risks : ["Review proposed changes before applying"],
  };
}

export async function runAgentSession(
  supabase: SupabaseClient<Database>,
  input: AgentSessionInput,
): Promise<AgentSessionResult> {
  const taskType = classifyTask(input.userInstruction);
  let context: AgentContextBundle | undefined;
  let plan: AgentPlan | undefined;
  let proposedChanges: ProposedChange[] = [];
  let validationPlan: AgentValidationPlan | undefined;

  const stageResults: Partial<Record<AgentLifecycleStage, string>> = {};

  stageResults.task_classification = taskType;

  try {
    context = await buildContextBundle(supabase, input.projectId, input.maxContextBytes);
    stageResults.context_gathering = `Collected ${context.files.length} files, ${context.previews.length} previews`;
  } catch (e) {
    stageResults.context_gathering = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }

  if (context) {
    plan = await generatePlan(taskType, input.userInstruction, context);
    stageResults.planning = plan ? "Plan generated" : "Plan generation failed";
  }

  if (context && plan) {
    proposedChanges = await generateProposedChanges(taskType, input.userInstruction, context, plan);
    stageResults.proposed_changes = `${proposedChanges.length} changes proposed`;
  }

  if (proposedChanges.length > 0) {
    validationPlan = await generateValidationPlan(taskType, input.userInstruction, proposedChanges);
    stageResults.validation_plan = `${validationPlan.commands.length} commands suggested`;
  }

  const finalReport = generateFinalReport(
    taskType,
    input.userInstruction,
    plan,
    proposedChanges,
    validationPlan,
  );
  stageResults.final_report = "Generated";

  return {
    stage: "final_report",
    taskType,
    providerUsed: "nexus-core-ai",
    modelUsed: "auto-selected",
    status: "success",
    context,
    plan,
    proposedChanges,
    validationPlan,
    finalReport: await finalReport,
  };
}
