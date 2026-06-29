import type { AgentTaskType } from "./agent-types";

export { type AgentTaskType } from "./agent-types";

export type AgentIntent =
  | "greeting"
  | "general_chat"
  | "project_review"
  | "patch_request"
  | "bugfix"
  | "refactor"
  | "planning";

const GREETING_PATTERNS = [
  "hello",
  "hi",
  "hey",
  "مرحبا",
  "السلام عليكم",
  "اهلا",
  "أهلا",
  "اهلين",
  "هلا",
  "سلام",
  "الو",
  "ألو",
  "الوو",
  "صباح الخير",
  "مساء الخير",
  "good morning",
  "good evening",
  "good night",
  "what's up",
  "thanks",
  "thank you",
  "شكرا",
  "شكراً",
];

const NAME_ASKING_PATTERNS = [
  "what is your name",
  "what's your name",
  "who are you",
  "tell me about yourself",
  "شو اسمك",
  "ما اسمك",
  "من أنت",
  "عرفني بنفسك",
  "what are you",
  "what can you do",
];

const KEYWORD_PATTERNS: Record<AgentTaskType, string[]> = {
  coding: ["implement", "create", "build", "add", "function", "class", "method", "api endpoint"],
  planning: ["plan", "organize", "structure", "architect", "design", "approach"],
  summarization: ["summarize", "summary", "overview", "explain", "describe"],
  validation_explanation: ["validate", "verify", "check", "test", "explain why"],
  project_review: ["review", "audit", "analyze", "inspect", "look at"],
  refactor: ["refactor", "cleanup", "improve", "modernize", "restructure"],
  bugfix: ["fix", "bug", "error", "issue", "problem", "crash", "fail"],
};

export function classifyIntent(instruction: string): AgentIntent {
  const instructionTrimmed = instruction.trim().toLowerCase();

  for (const pattern of GREETING_PATTERNS) {
    if (instructionTrimmed.includes(pattern.toLowerCase())) {
      return "greeting";
    }
  }

  for (const pattern of NAME_ASKING_PATTERNS) {
    if (instructionTrimmed.includes(pattern.toLowerCase())) {
      return "general_chat";
    }
  }

  if (instructionTrimmed.length < 10 && !/[a-zA-Z]/.test(instructionTrimmed)) {
    return "general_chat";
  }

  return "project_review";
}

export function classifyTask(instruction: string): AgentTaskType {
  const instructionLower = instruction.toLowerCase();
  let bestMatch: AgentTaskType = "coding";
  let bestScore = 0;

  for (const [taskType, keywords] of Object.entries(KEYWORD_PATTERNS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (instructionLower.includes(keyword)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = taskType as AgentTaskType;
    }
  }

  if (instructionLower.includes("what") || instructionLower.includes("how")) {
    return "summarization";
  }

  return bestMatch;
}

export function buildClassificationPrompt(instruction: string): string {
  return `Classify the following user instruction into one task type.
Return only the task type, nothing else.

Task types:
- coding: implementing new functionality
- planning: creating plans or strategies
- summarization: summarizing or explaining
- validation_explanation: explaining validation or why something works
- project_review: reviewing or auditing code
- refactor: restructuring existing code
- bugfix: fixing errors or issues

Instruction: ${instruction}`;
}
