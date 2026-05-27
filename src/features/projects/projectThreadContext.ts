import type { ProjectWithLatestJob } from "./types";

export type ThreadProjectContextState = "attached" | "detached" | "none";

export interface ResolvedThreadProjectContext {
  state: ThreadProjectContextState;
  projectId: string | null;
  projectName: string | null;
  project: ProjectWithLatestJob | null;
  isAttached: boolean;
}

export function resolveThreadProjectContext(input: {
  threadProjectId: string | null;
  threadProjectName: string | null;
  activeProject: ProjectWithLatestJob | null;
  attachedProject: ProjectWithLatestJob | null;
}): ResolvedThreadProjectContext {
  if (input.threadProjectId) {
    const project =
      input.attachedProject ??
      (input.activeProject?.id === input.threadProjectId ? input.activeProject : null);

    return {
      state: "attached",
      projectId: input.threadProjectId,
      projectName: input.threadProjectName?.trim() || project?.name || null,
      project,
      isAttached: true,
    };
  }

  if (input.activeProject) {
    return {
      state: "detached",
      projectId: input.activeProject.id,
      projectName: input.activeProject.name,
      project: input.activeProject,
      isAttached: false,
    };
  }

  return {
    state: "none",
    projectId: null,
    projectName: null,
    project: null,
    isAttached: false,
  };
}
