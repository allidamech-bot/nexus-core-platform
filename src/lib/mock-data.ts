import type { ExecutionStep, FileNode, VerificationResult } from "./types";

export const mockFileTree: FileNode[] = [
  {
    id: "src",
    name: "src",
    path: "src",
    type: "dir",
    children: [
      {
        id: "f1",
        name: "auth-gateway.ts",
        path: "src/auth-gateway.ts",
        type: "file",
        status: "modified",
      },
      {
        id: "f2",
        name: "session.shim.ts",
        path: "src/session.shim.ts",
        type: "file",
        status: "added",
      },
      {
        id: "routes",
        name: "routes",
        path: "src/routes",
        type: "dir",
        children: [
          { id: "f3", name: "v1.ts", path: "src/routes/v1.ts", type: "file", status: "added" },
          { id: "f4", name: "index.ts", path: "src/routes/index.ts", type: "file" },
        ],
      },
      { id: "f5", name: "types.ts", path: "src/types.ts", type: "file" },
    ],
  },
  { id: "pkg", name: "package.json", path: "package.json", type: "file" },
  { id: "tsc", name: "tsconfig.json", path: "tsconfig.json", type: "file" },
];

export const mockExecutionSteps: ExecutionStep[] = [
  { id: "s1", title: "Analyze dependencies", status: "completed" },
  { id: "s2", title: "Map existing routes to controllers", status: "completed" },
  { id: "s3", title: "Generate compatibility shim", status: "running" },
  { id: "s4", title: "Prepare verification checklist", status: "pending" },
  { id: "s5", title: "Produce final report", status: "pending" },
];

export const mockVerification: VerificationResult[] = [
  { id: "v1", type: "Typecheck", status: "passed" },
  { id: "v2", type: "Linter", status: "warning", detail: "2 stylistic" },
  { id: "v3", type: "Build", status: "passed" },
  { id: "v4", type: "Unit Tests", status: "failed", detail: "1 of 84" },
  { id: "v5", type: "Security Scan", status: "passed" },
  { id: "v6", type: "Performance", status: "not_run" },
];

export const agentModes = [
  { id: "engineering", label: "Engineering" },
  { id: "business", label: "Business" },
  { id: "research", label: "Research" },
  { id: "workflow", label: "Workflow" },
  { id: "debugging", label: "Debugging" },
] as const;
