import { createContext, useContext } from "react";
import type {
  ProjectChatMetadata,
  ProjectTextPreviewWithPath,
  ProjectWithLatestJob,
} from "./types";

export interface ProjectWorkspaceContextValue {
  projects: ProjectWithLatestJob[];
  projectsLoading: boolean;
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  activeProject: ProjectWithLatestJob | null;
  activeProjectPreviews: ProjectTextPreviewWithPath[];
  activeProjectPreviewsLoading: boolean;
  activeProjectMetadata: ProjectChatMetadata | null;
}

export const ProjectWorkspaceContext = createContext<ProjectWorkspaceContextValue | null>(null);

export function useProjectWorkspace() {
  const context = useContext(ProjectWorkspaceContext);
  if (!context) {
    throw new Error("useProjectWorkspace must be used within ProjectWorkspaceProvider");
  }
  return context;
}
